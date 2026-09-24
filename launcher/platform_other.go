//go:build !windows

package main

import (
	"fmt"
	"os"
	"os/exec"
)

// Windows dışı derleme yalnızca geliştirme ve test içindir.
func askRetry(title, text string) bool {
	fmt.Fprintf(os.Stderr, "%s: %s\n", title, text)
	return false
}

func showInfo(title, text string) { fmt.Fprintf(os.Stderr, "%s: %s\n", title, text) }

func openURL(url, preference string) error {
	return exec.Command("xdg-open", url).Start()
}
