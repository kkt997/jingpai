package response

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"jingpai/internal/pkg/errcode"
)

type Response struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
	Data any    `json:"data,omitempty"`
}

func OK(c *gin.Context, data any) {
	c.JSON(http.StatusOK, Response{Code: 0, Msg: "success", Data: data})
}

func OKMsg(c *gin.Context, msg string) {
	c.JSON(http.StatusOK, Response{Code: 0, Msg: msg})
}

func Fail(c *gin.Context, httpCode int, code int, msg string) {
	c.JSON(httpCode, Response{Code: code, Msg: msg})
}

func BadRequest(c *gin.Context, msg string) {
	Fail(c, http.StatusBadRequest, errcode.CodeBadRequest, msg)
}

func Unauthorized(c *gin.Context) {
	Fail(c, http.StatusUnauthorized, errcode.CodeUnauthorized, "请先登录")
}

func Forbidden(c *gin.Context, msg string) {
	Fail(c, http.StatusForbidden, errcode.CodeForbidden, msg)
}

func NotFound(c *gin.Context, msg string) {
	Fail(c, http.StatusNotFound, errcode.CodeNotFound, msg)
}

func ServerError(c *gin.Context, msg string) {
	Fail(c, http.StatusInternalServerError, errcode.CodeInternalError, msg)
}
