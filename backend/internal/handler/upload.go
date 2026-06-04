package handler

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"jingpai/internal/pkg/response"
)

const (
	uploadDir      = "./uploads"
	maxFileSize    = 200 << 20 // 200 MB
)

var allowedExts = map[string]bool{
	".mp4":  true,
	".webm": true,
	".mov":  true,
	".avi":  true,
	".mkv":  true,
	".jpg":  true,
	".jpeg": true,
	".png":  true,
	".gif":  true,
	".webp": true,
}

var allowedMIME = map[string]bool{
	"video/mp4":       true,
	"video/webm":      true,
	"video/quicktime": true,
	"video/x-msvideo": true,
	"video/x-matroska": true,
	"image/jpeg":      true,
	"image/png":       true,
	"image/gif":       true,
	"image/webp":      true,
}

func init() {
	if err := os.MkdirAll(uploadDir, 0o755); err != nil {
		fmt.Printf("[upload] failed to create upload dir: %v\n", err)
	}
}

func randomHex(n int) string {
	b := make([]byte, n)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func (h *Handler) UploadFile(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxFileSize)

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		if err.Error() == "http: request body too large" {
			response.Fail(c, http.StatusRequestEntityTooLarge, 4000, fmt.Sprintf("文件大小不能超过 %d MB", maxFileSize>>20))
			return
		}
		response.BadRequest(c, "请选择要上传的文件")
		return
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if !allowedExts[ext] {
		response.BadRequest(c, "不支持的文件格式，允许: mp4, webm, mov, avi, mkv, jpg, png, gif, webp")
		return
	}

	buf := make([]byte, 512)
	n, _ := file.Read(buf)
	mime := http.DetectContentType(buf[:n])
	if !allowedMIME[mime] {
		response.BadRequest(c, "文件内容格式不合法")
		return
	}
	file.Seek(0, 0)

	dateDir := time.Now().Format("20060102")
	savePath := filepath.Join(uploadDir, dateDir)
	if err := os.MkdirAll(savePath, 0o755); err != nil {
		response.ServerError(c, "创建目录失败")
		return
	}

	filename := fmt.Sprintf("%s_%s%s", time.Now().Format("150405"), randomHex(8), ext)
	fullPath := filepath.Join(savePath, filename)

	if err := c.SaveUploadedFile(header, fullPath); err != nil {
		response.ServerError(c, "保存文件失败")
		return
	}

	url := fmt.Sprintf("/uploads/%s/%s", dateDir, filename)

	response.OK(c, gin.H{
		"url":      url,
		"filename": header.Filename,
		"size":     header.Size,
	})
}
