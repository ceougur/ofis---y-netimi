//go:build windows

package main

import "syscall"

func enableBroadcast(network, address string, conn syscall.RawConn) error {
	var inner error
	err := conn.Control(func(fd uintptr) {
		inner = syscall.SetsockoptInt(syscall.Handle(fd), syscall.SOL_SOCKET, syscall.SO_BROADCAST, 1)
	})
	if err != nil {
		return err
	}
	return inner
}
