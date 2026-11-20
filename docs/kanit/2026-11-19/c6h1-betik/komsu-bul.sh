#!/bin/bash
# G2 komşu taraması (ders 10; tahmin değil): değişen dosyaları (server/app.mjs — rota kaydı; yeni server/lib ve server/routes dosyaları) adıyla ya da kaynak taramasıyla anan testler +
# overview.view (yetki) testleri. Çıktı: komsu.txt (her satır bir test dosyası).
cd /home/user/ofis---y-netimi/.claude/worktrees/agent-a91ebf10c57360da7 || exit 1
OUT=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c6h1-ns/komsu.txt
TMP=$OUT.tmp
: > "$TMP"
grep -l 'readdirSync' test/*.test.mjs | xargs grep -l 'server/routes\|server/lib\|"routes"\|"lib"' >> "$TMP"
grep -l 'app\.mjs' test/*.test.mjs >> "$TMP"
grep -l 'overview\.view' test/*.test.mjs >> "$TMP"
grep -l 'registerReportCenter\|report-worker\|rapor-is-parcacigi' test/*.test.mjs >> "$TMP"
sort -u "$TMP" | grep -v 'test/c6h-' > "$OUT"
rm -f "$TMP"
wc -l < "$OUT"
tr '\n' ' ' < "$OUT"
echo
