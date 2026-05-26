package config

import (
	"fmt"

	"github.com/spf13/viper"
)

type Config struct {
	Server    ServerConfig    `mapstructure:"server"`
	Database  DatabaseConfig  `mapstructure:"database"`
	Redis     RedisConfig     `mapstructure:"redis"`
	JWT       JWTConfig       `mapstructure:"jwt"`
	Auction   AuctionConfig   `mapstructure:"auction"`
	WebSocket WebSocketConfig `mapstructure:"websocket"`
}

type ServerConfig struct {
	Port int    `mapstructure:"port"`
	Mode string `mapstructure:"mode"`
}

type DatabaseConfig struct {
	Host         string `mapstructure:"host"`
	Port         int    `mapstructure:"port"`
	User         string `mapstructure:"user"`
	Password     string `mapstructure:"password"`
	DBName       string `mapstructure:"dbname"`
	MaxOpenConns int    `mapstructure:"max_open_conns"`
	MaxIdleConns int    `mapstructure:"max_idle_conns"`
}

type RedisConfig struct {
	Addr     string `mapstructure:"addr"`
	Password string `mapstructure:"password"`
	DB       int    `mapstructure:"db"`
	PoolSize int    `mapstructure:"pool_size"`
}

type JWTConfig struct {
	Secret      string `mapstructure:"secret"`
	ExpireHours int    `mapstructure:"expire_hours"`
}

type AuctionConfig struct {
	DefaultExtendSeconds int     `mapstructure:"default_extend_seconds"`
	MinExtendSeconds     int     `mapstructure:"min_extend_seconds"`
	MaxExtendCount       int     `mapstructure:"max_extend_count"`
	DecayPerExtend       int     `mapstructure:"decay_per_extend"`
	DefaultDepositAmount float64 `mapstructure:"default_deposit_amount"`
}

type WebSocketConfig struct {
	MaxConnectionsPerUser int `mapstructure:"max_connections_per_user"`
	HeartbeatInterval     int `mapstructure:"heartbeat_interval"`
	HeartbeatTimeout      int `mapstructure:"heartbeat_timeout"`
	CountdownSyncInterval int `mapstructure:"countdown_sync_interval"`
}

func (d *DatabaseConfig) DSN() string {
	return d.User + ":" + d.Password + "@tcp(" + d.Host + ":" +
		itoa(d.Port) + ")/" + d.DBName + "?charset=utf8mb4&parseTime=True&loc=Local"
}

func itoa(n int) string {
	return fmt.Sprintf("%d", n)
}

var Global *Config

func Load(path string) (*Config, error) {
	viper.SetConfigFile(path)
	if err := viper.ReadInConfig(); err != nil {
		return nil, err
	}

	// Allow environment variables to override config (e.g. DATABASE_HOST, REDIS_ADDR)
	viper.SetEnvPrefix("")
	viper.AutomaticEnv()
	bindEnvOverrides()

	cfg := &Config{}
	if err := viper.Unmarshal(cfg); err != nil {
		return nil, err
	}
	Global = cfg
	return cfg, nil
}

func bindEnvOverrides() {
	viper.BindEnv("database.host", "DATABASE_HOST")
	viper.BindEnv("database.port", "DATABASE_PORT")
	viper.BindEnv("database.user", "DATABASE_USER")
	viper.BindEnv("database.password", "DATABASE_PASSWORD")
	viper.BindEnv("database.dbname", "DATABASE_DBNAME")
	viper.BindEnv("redis.addr", "REDIS_ADDR")
	viper.BindEnv("redis.password", "REDIS_PASSWORD")
	viper.BindEnv("jwt.secret", "JWT_SECRET")
	viper.BindEnv("server.port", "SERVER_PORT")
	viper.BindEnv("server.mode", "SERVER_MODE")
}
