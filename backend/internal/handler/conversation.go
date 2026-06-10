package handler

import (
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"jingpai/internal/model"
	"jingpai/internal/pkg/response"
	"jingpai/internal/ws"
)

type createConversationRequest struct {
	PeerUserID uint `json:"peerUserId" binding:"required"`
}

type sendMessageRequest struct {
	Content string `json:"content" binding:"required"`
}

type readConversationRequest struct {
	MessageID uint `json:"messageId"`
}

func canonicalPair(a, b uint) (uint, uint) {
	if a < b {
		return a, b
	}
	return b, a
}

func (h *Handler) CreateConversation(c *gin.Context) {
	currentUserID := c.GetUint("userID")

	var req createConversationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	if req.PeerUserID == 0 || req.PeerUserID == currentUserID {
		response.BadRequest(c, "目标用户无效")
		return
	}

	var peer model.User
	if err := h.db.Select("id, nickname, avatar_url, role, status").First(&peer, req.PeerUserID).Error; err != nil {
		response.NotFound(c, "目标用户不存在")
		return
	}
	if peer.Status != model.UserActive {
		response.BadRequest(c, "目标用户不可联系")
		return
	}

	userA, userB := canonicalPair(currentUserID, req.PeerUserID)
	var conversation model.Conversation
	err := h.db.Where("user_a_id = ? AND user_b_id = ?", userA, userB).First(&conversation).Error
	if err == gorm.ErrRecordNotFound {
		conversation = model.Conversation{Kind: model.ConversationKindDirect, UserAID: userA, UserBID: userB}
		if err := h.db.Transaction(func(tx *gorm.DB) error {
			if err := tx.Create(&conversation).Error; err != nil {
				return err
			}
			participants := []model.ConversationParticipant{
				{ConversationID: conversation.ID, UserID: currentUserID},
				{ConversationID: conversation.ID, UserID: req.PeerUserID},
			}
			return tx.Create(&participants).Error
		}); err != nil {
			response.ServerError(c, "创建会话失败")
			return
		}
	} else if err != nil {
		response.ServerError(c, "获取会话失败")
		return
	}

	h.respondConversation(c, conversation.ID, 0)
}

func (h *Handler) ListConversations(c *gin.Context) {
	currentUserID := c.GetUint("userID")

	var conversations []model.Conversation
	if err := h.db.
		Preload("Participants").
		Preload("LastMessage").
		Where("user_a_id = ? OR user_b_id = ?", currentUserID, currentUserID).
		Order("COALESCE(last_message_at, created_at) DESC").
		Find(&conversations).Error; err != nil {
		response.ServerError(c, "获取会话列表失败")
		return
	}

	peerIDs := make([]uint, 0, len(conversations))
	for _, conversation := range conversations {
		peerID := conversation.UserAID
		if peerID == currentUserID {
			peerID = conversation.UserBID
		}
		peerIDs = append(peerIDs, peerID)
	}

	userMap := make(map[uint]model.User)
	if len(peerIDs) > 0 {
		var users []model.User
		h.db.Select("id, nickname, avatar_url, role").Where("id IN ?", peerIDs).Find(&users)
		for _, user := range users {
			userMap[user.ID] = user
		}
	}

	items := make([]gin.H, 0, len(conversations))
	for _, conversation := range conversations {
		peerID := conversation.UserAID
		if peerID == currentUserID {
			peerID = conversation.UserBID
		}
		peer := userMap[peerID]

		unreadCount := int64(0)
		for _, participant := range conversation.Participants {
			if participant.UserID == currentUserID {
				query := h.db.Model(&model.Message{}).Where("conversation_id = ?", conversation.ID)
				if participant.LastReadMessageID != nil {
					query = query.Where("id > ?", *participant.LastReadMessageID)
				}
				query.Where("sender_id != ?", currentUserID).Count(&unreadCount)
				break
			}
		}

		items = append(items, gin.H{
			"id":            conversation.ID,
			"kind":          conversation.Kind,
			"peer":          buildUserSummary(peer),
			"lastMessage":   buildMessageSummary(conversation.LastMessage),
			"lastMessageAt": conversation.LastMessageAt,
			"unreadCount":   unreadCount,
		})
	}

	response.OK(c, items)
}

func (h *Handler) GetConversation(c *gin.Context) {
	conversationID, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	if conversationID == 0 {
		response.BadRequest(c, "会话无效")
		return
	}

	h.respondConversation(c, uint(conversationID), 0)
}

func (h *Handler) ListConversationMessages(c *gin.Context) {
	currentUserID := c.GetUint("userID")
	conversationID, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	if conversationID == 0 {
		response.BadRequest(c, "会话无效")
		return
	}

	conversation, err := h.requireConversationMember(uint(conversationID), currentUserID)
	if err != nil {
		h.handleConversationAccessError(c, err)
		return
	}
	_ = conversation

	query := h.db.Preload("Sender").Where("conversation_id = ?", uint(conversationID)).Order("id DESC")
	if before := c.Query("before"); before != "" {
		if beforeID, err := strconv.ParseUint(before, 10, 64); err == nil && beforeID > 0 {
			query = query.Where("id < ?", beforeID)
		}
	}

	limit := 20
	if raw := c.Query("limit"); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n > 0 && n <= 100 {
			limit = n
		}
	}

	var messages []model.Message
	if err := query.Limit(limit).Find(&messages).Error; err != nil {
		response.ServerError(c, "获取消息失败")
		return
	}

	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}

	items := make([]gin.H, 0, len(messages))
	for _, message := range messages {
		items = append(items, gin.H{
			"id":         message.ID,
			"conversationId": message.ConversationID,
			"senderId":   message.SenderID,
			"type":       message.Type,
			"content":    message.Content,
			"createdAt":  message.CreatedAt,
			"sender":     buildUserSummary(message.Sender),
		})
	}

	response.OK(c, items)
}

func (h *Handler) SendConversationMessage(c *gin.Context) {
	currentUserID := c.GetUint("userID")
	conversationID, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	if conversationID == 0 {
		response.BadRequest(c, "会话无效")
		return
	}

	var req sendMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	req.Content = strings.TrimSpace(req.Content)
	if req.Content == "" {
		response.BadRequest(c, "消息不能为空")
		return
	}
	if len([]rune(req.Content)) > 1000 {
		response.BadRequest(c, "消息过长")
		return
	}

	conversation, err := h.requireConversationMember(uint(conversationID), currentUserID)
	if err != nil {
		h.handleConversationAccessError(c, err)
		return
	}

	var message model.Message
	now := time.Now()
	err = h.db.Transaction(func(tx *gorm.DB) error {
		message = model.Message{
			ConversationID: uint(conversationID),
			SenderID:       currentUserID,
			Type:           model.MessageTypeText,
			Content:        req.Content,
		}
		if err := tx.Create(&message).Error; err != nil {
			return err
		}
		if err := tx.Model(&model.Conversation{}).Where("id = ?", conversationID).Updates(map[string]any{
			"last_message_id": message.ID,
			"last_message_at": now,
		}).Error; err != nil {
			return err
		}
		if err := tx.Model(&model.ConversationParticipant{}).
			Where("conversation_id = ? AND user_id = ?", conversationID, currentUserID).
			Updates(map[string]any{
				"last_read_message_id": message.ID,
				"last_read_at":         now,
			}).Error; err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		response.ServerError(c, "发送消息失败")
		return
	}

	if err := h.db.Preload("Sender").First(&message, message.ID).Error; err != nil {
		response.ServerError(c, "获取消息失败")
		return
	}

	peerUserID := conversation.UserAID
	if peerUserID == currentUserID {
		peerUserID = conversation.UserBID
	}

	h.pushDirectMessage(peerUserID, conversation.ID, message)
	h.pushConversationUpdated(currentUserID, conversation.ID)
	h.pushConversationUpdated(peerUserID, conversation.ID)

	response.OK(c, gin.H{
		"id":             message.ID,
		"conversationId": message.ConversationID,
		"senderId":       message.SenderID,
		"type":           message.Type,
		"content":        message.Content,
		"createdAt":      message.CreatedAt,
		"sender":         buildUserSummary(message.Sender),
	})
}

func (h *Handler) MarkConversationRead(c *gin.Context) {
	currentUserID := c.GetUint("userID")
	conversationID, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	if conversationID == 0 {
		response.BadRequest(c, "会话无效")
		return
	}

	conversation, err := h.requireConversationMember(uint(conversationID), currentUserID)
	if err != nil {
		h.handleConversationAccessError(c, err)
		return
	}

	var req readConversationRequest
	_ = c.ShouldBindJSON(&req)

	messageID := req.MessageID
	if messageID == 0 {
		var latest model.Message
		if err := h.db.Select("id").Where("conversation_id = ?", conversationID).Order("id DESC").First(&latest).Error; err == nil {
			messageID = latest.ID
		}
	}

	now := time.Now()
	if err := h.db.Model(&model.ConversationParticipant{}).
		Where("conversation_id = ? AND user_id = ?", conversationID, currentUserID).
		Updates(map[string]any{
			"last_read_message_id": messageID,
			"last_read_at":         now,
		}).Error; err != nil {
		response.ServerError(c, "标记已读失败")
		return
	}

	peerUserID := conversation.UserAID
	if peerUserID == currentUserID {
		peerUserID = conversation.UserBID
	}
	h.pushConversationRead(peerUserID, uint(conversationID), currentUserID, messageID)
	h.pushConversationUpdated(currentUserID, uint(conversationID))

	response.OK(c, gin.H{"conversationId": uint(conversationID), "messageId": messageID})
}

func (h *Handler) requireConversationMember(conversationID uint, userID uint) (model.Conversation, error) {
	var conversation model.Conversation
	if err := h.db.Preload("Participants").First(&conversation, conversationID).Error; err != nil {
		return model.Conversation{}, err
	}
	if conversation.UserAID != userID && conversation.UserBID != userID {
		return model.Conversation{}, gorm.ErrRecordNotFound
	}
	return conversation, nil
}

func (h *Handler) handleConversationAccessError(c *gin.Context, err error) {
	if err == gorm.ErrRecordNotFound {
		response.NotFound(c, "会话不存在")
		return
	}
	response.ServerError(c, "获取会话失败")
}

func (h *Handler) respondConversation(c *gin.Context, conversationID uint, unreadOverride int64) {
	currentUserID := c.GetUint("userID")
	conversation, err := h.requireConversationMember(conversationID, currentUserID)
	if err != nil {
		h.handleConversationAccessError(c, err)
		return
	}

	if err := h.db.Preload("LastMessage").First(&conversation, conversationID).Error; err != nil {
		response.ServerError(c, "获取会话失败")
		return
	}

	peerID := conversation.UserAID
	if peerID == currentUserID {
		peerID = conversation.UserBID
	}

	var peer model.User
	if err := h.db.Select("id, nickname, avatar_url, role").First(&peer, peerID).Error; err != nil {
		response.ServerError(c, "获取对方资料失败")
		return
	}

	unreadCount := unreadOverride
	if unreadCount == 0 {
		var participant model.ConversationParticipant
		if err := h.db.Where("conversation_id = ? AND user_id = ?", conversationID, currentUserID).First(&participant).Error; err == nil {
			query := h.db.Model(&model.Message{}).Where("conversation_id = ? AND sender_id != ?", conversationID, currentUserID)
			if participant.LastReadMessageID != nil {
				query = query.Where("id > ?", *participant.LastReadMessageID)
			}
			query.Count(&unreadCount)
		}
	}

	response.OK(c, gin.H{
		"id":            conversation.ID,
		"kind":          conversation.Kind,
		"peer":          buildUserSummary(peer),
		"lastMessage":   buildMessageSummary(conversation.LastMessage),
		"lastMessageAt": conversation.LastMessageAt,
		"unreadCount":   unreadCount,
	})
}

func buildUserSummary(user model.User) gin.H {
	return gin.H{
		"id":        user.ID,
		"nickname":  user.Nickname,
		"avatarUrl": user.AvatarURL,
		"role":      user.Role,
	}
}

func buildMessageSummary(message *model.Message) any {
	if message == nil || message.ID == 0 {
		return nil
	}
	return gin.H{
		"id":             message.ID,
		"conversationId": message.ConversationID,
		"senderId":       message.SenderID,
		"type":           message.Type,
		"content":        message.Content,
		"createdAt":      message.CreatedAt,
	}
}

func (h *Handler) pushDirectMessage(targetUserID, conversationID uint, message model.Message) {
	h.hub.SendToUser(targetUserID, ws.ServerMessage{
		Type: ws.MsgDirectMessage,
		Code: 0,
		Data: gin.H{
			"conversationId": conversationID,
			"message": gin.H{
				"id":             message.ID,
				"conversationId": message.ConversationID,
				"senderId":       message.SenderID,
				"type":           message.Type,
				"content":        message.Content,
				"createdAt":      message.CreatedAt,
				"sender":         buildUserSummary(message.Sender),
			},
		},
		Ts: time.Now().UnixMilli(),
	})
}

func (h *Handler) pushConversationUpdated(targetUserID, conversationID uint) {
	h.hub.SendToUser(targetUserID, ws.ServerMessage{
		Type: ws.MsgConversationUpdated,
		Code: 0,
		Data: gin.H{"conversationId": conversationID},
		Ts:   time.Now().UnixMilli(),
	})
}

func (h *Handler) pushConversationRead(targetUserID, conversationID, readerUserID, messageID uint) {
	h.hub.SendToUser(targetUserID, ws.ServerMessage{
		Type: ws.MsgConversationRead,
		Code: 0,
		Data: gin.H{
			"conversationId": conversationID,
			"readerUserId":   readerUserID,
			"messageId":      messageID,
		},
		Ts: time.Now().UnixMilli(),
	})
}
