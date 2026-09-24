package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"strings"
	"time"
)

const (
	discoveryRequest = "HukukOfisiServerNerede"
	discoveryMagic   = "HukukOfisiServerBurada"
)

// Reply, sunucunun keşif yanıtıdır.
type Reply struct {
	Magic      string `json:"magic"`
	Service    string `json:"service"`
	Address    string `json:"address"`
	Port       int    `json:"port"`
	URL        string `json:"url"`
	Host       string `json:"host"`
	Name       string `json:"name"`
	InstanceID string `json:"instanceId"`
	Version    string `json:"version"`
	State      string `json:"state"`
	From       string `json:"from"`
}

// ServerURL, yanıtın geldiği IP'yi tercih eder (VPN/sanal ağ kartı olan sunucularda doğru adres budur).
func (r Reply) ServerURL() string {
	if r.From != "" && r.Port > 0 {
		return fmt.Sprintf("http://%s:%d", r.From, r.Port)
	}
	return r.URL
}

func parseReply(data []byte, from string) (Reply, bool) {
	var reply Reply
	if err := json.Unmarshal(data, &reply); err != nil || reply.Magic != discoveryMagic || reply.Port <= 0 || reply.Port > 65535 {
		return Reply{}, false
	}
	reply.From = from
	return reply, true
}

// broadcastTargets: 255.255.255.255 ve her ağ kartının alt ağ yayın adresi (Windows sınırlı yayını tek karttan gönderebilir).
func broadcastTargets() []string {
	targets := []string{"255.255.255.255"}
	seen := map[string]bool{"255.255.255.255": true}
	interfaces, err := net.Interfaces()
	if err != nil {
		return targets
	}
	for _, iface := range interfaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			ipnet, ok := addr.(*net.IPNet)
			if !ok {
				continue
			}
			ip := ipnet.IP.To4()
			if ip == nil || len(ipnet.Mask) != 4 {
				continue
			}
			broadcast := make(net.IP, 4)
			for i := range ip {
				broadcast[i] = ip[i] | ^ipnet.Mask[i]
			}
			if key := broadcast.String(); !seen[key] {
				seen[key] = true
				targets = append(targets, key)
			}
		}
	}
	return targets
}

// discover, yerel ağa keşif sinyali gönderir ve süre dolana kadar gelen yanıtları toplar.
func discover(port int, timeout time.Duration, targets []string) ([]Reply, error) {
	if len(targets) == 0 {
		targets = broadcastTargets()
	}
	config := net.ListenConfig{Control: enableBroadcast}
	conn, err := config.ListenPacket(context.Background(), "udp4", ":0")
	if err != nil {
		return nil, err
	}
	defer conn.Close()
	payload := []byte(discoveryRequest)
	send := func() {
		for _, target := range targets {
			addr := &net.UDPAddr{IP: net.ParseIP(target), Port: port}
			_, _ = conn.WriteTo(payload, addr)
		}
	}
	deadline := time.Now().Add(timeout)
	_ = conn.SetReadDeadline(deadline)
	send()
	resend := time.AfterFunc(timeout/3, send)
	defer resend.Stop()

	var replies []Reply
	seen := map[string]bool{}
	buffer := make([]byte, 2048)
	for {
		n, from, err := conn.ReadFrom(buffer)
		if err != nil {
			break
		}
		host := from.String()
		if udp, ok := from.(*net.UDPAddr); ok {
			host = udp.IP.String()
		}
		reply, ok := parseReply(buffer[:n], host)
		if !ok {
			continue
		}
		key := reply.InstanceID
		if key == "" {
			key = reply.ServerURL()
		}
		if !seen[key] {
			seen[key] = true
			replies = append(replies, reply)
		}
	}
	return replies, nil
}

// choose: kayıtlı kurulum kimliği eşleşirse onu, yoksa hazır olan ilk sunucuyu seçer.
func choose(replies []Reply, preferredInstance string) (Reply, bool) {
	if len(replies) == 0 {
		return Reply{}, false
	}
	if preferredInstance != "" {
		for _, reply := range replies {
			if reply.InstanceID == preferredInstance {
				return reply, true
			}
		}
	}
	for _, reply := range replies {
		if strings.EqualFold(reply.State, "ready") || reply.State == "" {
			return reply, true
		}
	}
	return replies[0], true
}
