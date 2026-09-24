package main

import "testing"

func TestParseReply(t *testing.T) {
	reply, ok := parseReply([]byte(`{"magic":"HukukOfisiServerBurada","port":5123,"url":"http://10.0.0.5:5123","instanceId":"abc","state":"ready"}`), "192.168.1.50")
	if !ok {
		t.Fatal("geçerli yanıt reddedildi")
	}
	if got := reply.ServerURL(); got != "http://192.168.1.50:5123" {
		t.Fatalf("ServerURL = %s", got)
	}
	if _, ok := parseReply([]byte(`{"magic":"baska","port":5123}`), "x"); ok {
		t.Fatal("yanlış sihirli değer kabul edildi")
	}
	if _, ok := parseReply([]byte(`bozuk`), "x"); ok {
		t.Fatal("bozuk JSON kabul edildi")
	}
}

func TestChoosePrefersKnownInstance(t *testing.T) {
	replies := []Reply{{InstanceID: "a", State: "ready"}, {InstanceID: "b", State: "ready"}}
	if reply, _ := choose(replies, "b"); reply.InstanceID != "b" {
		t.Fatalf("kayıtlı kurulum seçilmedi: %s", reply.InstanceID)
	}
	if reply, _ := choose(replies, ""); reply.InstanceID != "a" {
		t.Fatalf("ilk sunucu seçilmedi: %s", reply.InstanceID)
	}
	if _, ok := choose(nil, ""); ok {
		t.Fatal("boş listede sunucu seçildi")
	}
}

func TestNormalizeURL(t *testing.T) {
	cases := map[string]string{
		"192.168.1.50":            "http://192.168.1.50:5123",
		"http://sunucu:5123/":     "http://sunucu:5123",
		"https://ofis.local:8443": "https://ofis.local:8443",
		"  SUNUCU-PC  ":           "http://SUNUCU-PC:5123",
	}
	for input, want := range cases {
		if got := normalizeURL(input); got != want {
			t.Errorf("normalizeURL(%q) = %q, beklenen %q", input, got, want)
		}
	}
}

func TestBroadcastTargetsIncludesLimitedBroadcast(t *testing.T) {
	targets := broadcastTargets()
	if len(targets) == 0 || targets[0] != "255.255.255.255" {
		t.Fatalf("hedefler: %v", targets)
	}
}
