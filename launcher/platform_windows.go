//go:build windows

package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"unsafe"
)

var (
	user32          = syscall.NewLazyDLL("user32.dll")
	procMessageBoxW = user32.NewProc("MessageBoxW")
)

const (
	mbOK            = 0x00000000
	mbRetryCancel   = 0x00000005
	mbIconWarning   = 0x00000030
	mbIconInfo      = 0x00000040
	mbSetForeground = 0x00010000
	mbTopMost       = 0x00040000
	idRetry         = 4
)

func messageBox(title, text string, flags uintptr) int {
	titlePtr, _ := syscall.UTF16PtrFromString(title)
	textPtr, _ := syscall.UTF16PtrFromString(text)
	result, _, _ := procMessageBoxW.Call(0, uintptr(unsafe.Pointer(textPtr)), uintptr(unsafe.Pointer(titlePtr)), flags)
	return int(result)
}

func askRetry(title, text string) bool {
	return messageBox(title, text, mbRetryCancel|mbIconWarning|mbSetForeground|mbTopMost) == idRetry
}

func showInfo(title, text string) {
	messageBox(title, text, mbOK|mbIconInfo|mbSetForeground)
}

func browserCandidates(preference string) []string {
	roots := []string{os.Getenv("ProgramFiles(x86)"), os.Getenv("ProgramFiles"), os.Getenv("LocalAppData")}
	edge := []string{}
	chrome := []string{}
	for _, root := range roots {
		if root == "" {
			continue
		}
		edge = append(edge, filepath.Join(root, "Microsoft", "Edge", "Application", "msedge.exe"))
		chrome = append(chrome, filepath.Join(root, "Google", "Chrome", "Application", "chrome.exe"))
	}
	switch preference {
	case "edge":
		return edge
	case "chrome":
		return chrome
	default:
		return append(edge, chrome...)
	}
}

// openURL, DestekOfis'i Edge/Chrome'da uygulama penceresi olarak açar; bulunamazsa varsayılan tarayıcıyı kullanır.
func openURL(url, preference string) error {
	if preference != "default" {
		for _, candidate := range browserCandidates(preference) {
			if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
				if err := exec.Command(candidate, "--app="+url, "--new-window").Start(); err == nil {
					return nil
				}
			}
		}
	}
	return exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
}
