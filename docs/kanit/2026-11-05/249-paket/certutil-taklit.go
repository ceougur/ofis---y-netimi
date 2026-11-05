// certutil -hashfile <dosya> SHA256 taklidi (yalnız BIRLESTIR.bat sınaması için).
package main

import (
	"crypto/sha256"
	"fmt"
	"io"
	"os"
)

func main() {
	if len(os.Args) < 3 || os.Args[1] != "-hashfile" {
		fmt.Println("kullanim: certutil -hashfile <dosya> SHA256")
		os.Exit(1)
	}
	f, err := os.Open(os.Args[2])
	if err != nil {
		fmt.Println("CertUtil: -hashfile command FAILED")
		os.Exit(1)
	}
	h := sha256.New()
	io.Copy(h, f)
	fmt.Printf("SHA256 hash of %s:\r\n%x\r\nCertUtil: -hashfile command completed successfully.\r\n", os.Args[2], h.Sum(nil))
}
