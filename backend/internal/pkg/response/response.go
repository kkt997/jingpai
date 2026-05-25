package response

import (
	"net/http"

	"github.com/gin-gonic/gin"
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
	Fail(c, http.StatusBadRequest, 4000, msg)
}

func Unauthorized(c *gin.Context) {
	Fail(c, http.StatusUnauthorized, 4011, "请先登录")
}

func Forbidden(c *gin.Context, msg string) {
	Fail(c, http.StatusForbidden, 4003, msg)
}

func NotFound(c *gin.Context, msg string) {
	Fail(c, http.StatusNotFound, 4004, msg)
}

func ServerError(c *gin.Context, msg string) {
	Fail(c, http.StatusInternalServerError, 5000, msg)
}
