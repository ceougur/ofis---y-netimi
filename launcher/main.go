// DestekOfis istemci başlatıcısı.
// Personel bilgisayarındaki masaüstü kısayolu bunu çalıştırır: sunucuyu (kayıtlı adres → bu bilgisayar →
// UDP keşif → bilgisayar adı sırasıyla) bulur ve DestekOfis'i Edge/Chrome uygulama penceresinde açar.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"strings"
	"time"
)

var version = "dev"

const appTitle = "DestekOfis"

func normalizeURL(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	if !strings.HasPrefix(value, "http://") && !strings.HasPrefix(value, "https://") {
		value = "http://" + value
	}
	value = strings.TrimRight(value, "/")
	if !strings.Contains(strings.TrimPrefix(strings.TrimPrefix(value, "http://"), "https://"), ":") {
		value += ":5123"
	}
	return value
}

type located struct {
	URL   string
	Reply *Reply
}

func locate(cfg Config, port int, targets []string) (located, bool) {
	if cfg.Server != "" && healthy(cfg.Server, 1200*time.Millisecond) {
		return located{URL: cfg.Server}, true
	}
	local := fmt.Sprintf("http://127.0.0.1:%d", port)
	if healthy(local, 600*time.Millisecond) {
		return located{URL: local}, true
	}
	replies, err := discover(port, 1500*time.Millisecond, targets)
	if err != nil {
		logf("Keşif hatası: %v", err)
	}
	if reply, ok := choose(replies, cfg.InstanceID); ok {
		for _, candidate := range []string{reply.ServerURL(), reply.URL} {
			if candidate != "" && healthy(candidate, 2*time.Second) {
				copy := reply
				return located{URL: candidate, Reply: &copy}, true
			}
		}
		logf("Keşif yanıtı alındı ama sunucuya HTTP ile ulaşılamadı: %s", reply.ServerURL())
	}
	if cfg.Host != "" {
		byName := fmt.Sprintf("http://%s:%d", cfg.Host, port)
		if healthy(byName, 2*time.Second) {
			return located{URL: byName}, true
		}
	}
	return located{}, false
}

func main() {
	discoverOnly := flag.Bool("kesfet", false, "Ağdaki DestekOfis sunucularını bulup JSON olarak yazdırır")
	server := flag.String("sunucu", "", "Sunucu adresini elle ayarlar (ör. 192.168.1.50 veya http://192.168.1.50:5123)")
	reset := flag.Bool("sifirla", false, "Kayıtlı sunucu bilgisini siler")
	port := flag.Int("port", 5123, "Sunucu portu (HTTP ve UDP keşif)")
	targetList := flag.String("hedef", "", "Keşif hedefleri (virgülle ayrılmış IP; boşsa tüm yayın adresleri)")
	noOpen := flag.Bool("acma", false, "Tarayıcıyı açmadan bulunan adresi yazdırır")
	showVersion := flag.Bool("surum", false, "Sürümü yazdırır")
	flag.Parse()

	if *showVersion {
		fmt.Println(version)
		return
	}
	var targets []string
	for _, item := range strings.Split(*targetList, ",") {
		if item = strings.TrimSpace(item); item != "" {
			targets = append(targets, item)
		}
	}
	if *reset {
		_ = os.Remove(configPath())
	}
	if *discoverOnly {
		replies, err := discover(*port, 1500*time.Millisecond, targets)
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		if replies == nil {
			replies = []Reply{}
		}
		output, _ := json.MarshalIndent(replies, "", "  ")
		fmt.Println(string(output))
		return
	}

	cfg := loadConfig()
	if *server != "" {
		cfg.Server = normalizeURL(*server)
		if err := saveConfig(cfg); err != nil {
			logf("Ayar kaydedilemedi: %v", err)
		}
	}
	for {
		found, ok := locate(cfg, *port, targets)
		if ok {
			cfg.Server = found.URL
			if found.Reply != nil {
				cfg.InstanceID = found.Reply.InstanceID
				cfg.Host = found.Reply.Host
				cfg.Name = found.Reply.Name
			}
			if err := saveConfig(cfg); err != nil {
				logf("Ayar kaydedilemedi: %v", err)
			}
			logf("Sunucu bulundu: %s", found.URL)
			if *noOpen {
				output, _ := json.Marshal(map[string]string{"url": found.URL, "instanceId": cfg.InstanceID})
				fmt.Println(string(output))
				return
			}
			if err := openURL(found.URL, cfg.Browser); err != nil {
				showInfo(appTitle, "Tarayıcı açılamadı. Adres: "+found.URL)
			}
			return
		}
		logf("Sunucu bulunamadı")
		if *noOpen {
			fmt.Fprintln(os.Stderr, "Sunucu bulunamadı")
			os.Exit(2)
		}
		if !askRetry(appTitle, "DestekOfis sunucusu bulunamadı.\n\n• Sunucu bilgisayarın açık olduğundan emin olun.\n• Bu bilgisayarın sunucuyla aynı ağa bağlı olduğunu kontrol edin.\n\nTekrar aramak için \"Yeniden Dene\"ye basın.") {
			return
		}
	}
}
