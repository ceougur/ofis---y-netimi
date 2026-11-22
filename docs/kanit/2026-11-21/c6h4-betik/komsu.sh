#!/bin/bash
# G2 komşu listesi (ders 10): değişen dosyaları adıyla / API yoluyla anan testler + şema kapısı, geri yükleme, göç zinciri, donmuş defter, şirket sıfırlama / kopyalama.
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-adeefec4f86e1240e
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c6h4-ag
cd $W || exit 1
{
  grep -lE "financial-statements|stock-valuation|ledger-snapshots|lib/migrations|LATEST_VERSION|ledger_snapshot|clearSnapshots|period-lock|lockAndWait|runMigrations|rule-diff-correction|company-reset|sirket-sifirla|reset-company" test/*.test.mjs
  ls test/sema-kapisi-bs7*.test.mjs test/backup.test.mjs test/yedek-220*.test.mjs test/banka-210-gg-geri-yukle.test.mjs test/geri-yukleme-uyari-244.test.mjs test/goc-*.test.mjs test/banka-210-goc*.test.mjs test/donmus-defter-*.test.mjs 2>/dev/null
} | sort -u > $S/komsu.txt
wc -l < $S/komsu.txt
