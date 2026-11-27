#!/bin/bash
# BT5: mutasyon kopyası (ders 23, 25) — taban 578c12d4 + bu ajanın değişen / yeni dosyaları (worktree'den). Yeniden çağrılırsa yalnız üstüne kopyalar.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a731f6dec73e0177c
M="$S/bt5-mut"
if [ ! -d "$M/server" ]; then
  mkdir -p "$M" || exit 1
  git -C "$W" archive 578c12d4 | tar -x -C "$M" || exit 1
  ln -s /home/user/ofis---y-netimi/node_modules "$M/node_modules" || exit 1
fi
for f in server/lib/accounts.mjs server/lib/company-backups.mjs server/lib/db.mjs server/lib/whatsapp/app-webhook.mjs server/routes/plans.mjs \
  test/birlesik-tur4-degisiklik-yok-250.test.mjs test/db-tx-kayip-250.test.mjs test/whatsapp-we-webhook-bilgisi-250.test.mjs \
  test/acilis-onarimi-savunma-250.test.mjs test/kapali-kart-ekstre-tarihi-250.test.mjs "$@"; do
  cp "$W/$f" "$M/$f" || exit 1
done
echo "kopya hazır: $M"
