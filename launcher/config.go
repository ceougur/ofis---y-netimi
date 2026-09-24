package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"time"
)

// Config, istemci bilgisayarda son bulunan sunucuyu saklar: %APPDATA%\DestekOfis\istemci.json
type Config struct {
	Server     string    `json:"server"`
	InstanceID string    `json:"instanceId,omitempty"`
	Host       string    `json:"host,omitempty"`
	Name       string    `json:"name,omitempty"`
	Browser    string    `json:"browser,omitempty"` // auto | edge | chrome | default
	UpdatedAt  time.Time `json:"updatedAt,omitempty"`
}

func configDir() string {
	if dir := os.Getenv("DESTEKOFIS_CONFIG_DIR"); dir != "" {
		return dir
	}
	base, err := os.UserConfigDir()
	if err != nil || base == "" {
		base = os.TempDir()
	}
	return filepath.Join(base, "DestekOfis")
}

func configPath() string { return filepath.Join(configDir(), "istemci.json") }

func loadConfig() Config {
	var cfg Config
	data, err := os.ReadFile(configPath())
	if err == nil {
		_ = json.Unmarshal(data, &cfg)
	}
	if cfg.Browser == "" {
		cfg.Browser = "auto"
	}
	return cfg
}

func saveConfig(cfg Config) error {
	if err := os.MkdirAll(configDir(), 0o755); err != nil {
		return err
	}
	cfg.UpdatedAt = time.Now()
	data, _ := json.MarshalIndent(cfg, "", "  ")
	tmp := configPath() + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, configPath())
}
