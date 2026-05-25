package errcode

import "errors"

var (
	ErrUserNotFound     = errors.New("用户不存在")
	ErrWrongPassword    = errors.New("密码错误")
	ErrPhoneRegistered  = errors.New("手机号已注册")
	ErrUnauthorized     = errors.New("未授权")
	ErrForbidden        = errors.New("无权限")

	ErrAuctionNotFound  = errors.New("竞拍不存在")
	ErrAuctionNotActive = errors.New("竞拍未在进行中")
	ErrAuctionEnded     = errors.New("竞拍已结束")

	ErrBidTooLow        = errors.New("出价太低")
	ErrBidTooFrequent   = errors.New("出价太频繁，每秒仅可出价1次")
	ErrBidCeilingHit    = errors.New("已达封顶价")

	ErrRoomNotFound     = errors.New("直播间不存在")
	ErrTooManyConns     = errors.New("连接数超限")

	ErrInvalidTransition = errors.New("无效的状态转移")
)

const (
	CodeOK               = 0
	CodeBidTooLow        = 4001
	CodeAuctionNotActive = 4002
	CodeBidTooFrequent   = 4003
	CodeNotInRoom        = 4004
	CodeDepositRequired  = 4005
	CodeInvalidPayload   = 4010
	CodeUnauthorized     = 4011
	CodeInternalError    = 5000
	CodeSystemBusy       = 5001
)
