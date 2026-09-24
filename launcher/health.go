package main

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"
)

// healthy, adresin gerçekten bir DestekOfis sunucusu olduğunu /api/health ile doğrular.
// Güncelleme/açılış sırasında (503 bakım yanıtı) da sunucu "bulundu" sayılır; tarayıcı bakım sayfasını gösterir.
func healthy(baseURL string, timeout time.Duration) bool {
	if baseURL == "" {
		return false
	}
	client := http.Client{Timeout: timeout}
	response, err := client.Get(strings.TrimRight(baseURL, "/") + "/api/health")
	if err != nil {
		return false
	}
	defer response.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(response.Body, 64*1024))
	if response.StatusCode == http.StatusServiceUnavailable {
		return strings.Contains(string(body), "MAINTENANCE")
	}
	if response.StatusCode != http.StatusOK {
		return false
	}
	var payload struct {
		Data struct {
			Service string `json:"service"`
		} `json:"data"`
	}
	return json.Unmarshal(body, &payload) == nil && strings.HasPrefix(payload.Data.Service, "destekofis")
}
