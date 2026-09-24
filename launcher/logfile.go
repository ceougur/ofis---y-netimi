package main

import (
	"fmt"
	"os"
	"path/filepath"
	"time"
)

// logf, tanılama için %APPDATA%\DestekOfis\istemci.log dosyasına yazar (256 KB'ı aşınca sıfırlanır).
func logf(format string, args ...any) {
	path := filepath.Join(configDir(), "istemci.log")
	_ = os.MkdirAll(configDir(), 0o755)
	if info, err := os.Stat(path); err == nil && info.Size() > 256*1024 {
		_ = os.Remove(path)
	}
	file, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return
	}
	defer file.Close()
	fmt.Fprintf(file, "%s %s\n", time.Now().Format("2006-01-02 15:04:05"), fmt.Sprintf(format, args...))
}
