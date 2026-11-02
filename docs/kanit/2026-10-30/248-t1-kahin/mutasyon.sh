#!/usr/bin/env bash
# T1 sürücüsünün dişi (ders 7, 23): programa bilerek hata ayrı kopyada (git archive HEAD) enjekte edilir; sürücü hedef senaryoda DAVRANIŞ FARKI görmeli.
NOT="${NOT:-$(mktemp -d)}"
WT="${WT:-$(git rev-parse --show-toplevel)}"
mut() {
  ad="$1"; eski="$2"; yeni="$3"; senaryolar="$4"
  dir="$NOT/t1-248-mut-$ad"
  rm -rf "$dir" && mkdir -p "$dir" || return 1
  (cd "$WT" && git archive HEAD | tar -x -C "$dir") || return 1
  python3 - "$dir/server/lib/whatsapp/queue.mjs" "$eski" "$yeni" <<'PY' || { echo "MUTASYON UYGULANAMADI $ad"; return 1; }
import sys
p, a, b = sys.argv[1:4]
s = open(p, encoding="utf8").read()
assert s.count(a) == 1, f"desen {s.count(a)} kez"
open(p, "w", encoding="utf8").write(s.replace(a, b))
PY
  echo "== $ad ($senaryolar)"
  (cd "$dir" && timeout 900 node --no-warnings test/bagimsiz/whatsapp-248/surucu.mjs --senaryo "$senaryolar" --uc hizli 2>&1 | grep -E "^(ok|not ok)" | cut -c1-200)
  rm -rf "$dir"
}
mut istemiyor 'if (Number(account.waOptOut) === 1) return { skip: "WhatsApp Mesajı İstemiyor", phone };' '' 'KISI-08-istemiyor,KISI-09-istemiyor-sonradan'
mut r3-yok 'if (!person.skip && last && body.sendAgain !== true) person.skip = "Daha Önce Gönderildi";' '' 'CIFT-07-iki-sekme'
mut ileri-yalniz 'if (resolving || ["accepted", "sent", "expired"].includes(current)) Object.assign(fields, { state: "delivered"' 'if (resolving || ["accepted", "sent", "expired", "read"].includes(current)) Object.assign(fields, { state: "delivered"' 'TEMEL-04-sirasiz-kanca'
mut ttl 'const ttlLimit = iso(nowMs() - (ttlHours + 1) * HOUR);' 'const ttlLimit = iso(nowMs() - (ttlHours * 10 + 1) * HOUR);' 'TARIH-02-ttl-sonu,ICERIK-10-ttl-sonrasi-teslim'
mut belirsiz-yeniden 'updateJob(job.id, { state: "uncertain", error_code: null, error_text: error.message });' 'updateJob(job.id, { state: "pending", next_at: iso(nowMs() + 30_000), error_code: null, error_text: error.message });' 'CIFT-01-zaman-asimi-meta-aldi'
