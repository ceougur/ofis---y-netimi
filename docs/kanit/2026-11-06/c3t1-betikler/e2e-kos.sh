#!/usr/bin/env bash
# Ç3 tur 1: dönem kilidine / donmuş deftere dokunan e2e senaryoları (Ç3'ün 9'u + taramada dönem kilidini anan 4), sırayla, tools/kanit.mjs kos ile.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
cd /home/user/ofis---y-netimi/.claude/worktrees/agent-a247c14721558ab77 || exit 1
df -h / | tail -1
export PLAYWRIGHT_BROWSERS_PATH="$S/pw-1194"
export HUKUK_LICENSE_URL=http://127.0.0.1:9
for name in sema-kapisi-bs7 senaryo-defter-243 senaryo-224 senaryo-226 senaryo-213 gg244-numara-tarih-onay gg243-banka-kart-aciklama senaryo-220-yedek senaryo-banka-210 gg244-secilenleri-gonder gg243-tumunu-gonder senaryo-fatura-243 gg243-dar2-ekran; do
  KANIT_DIR="$S/c3t1-kanit/kanit" node tools/kanit.mjs kos "c3t1-e2e-$name" -- node --disable-warning=ExperimentalWarning "test/e2e/$name.mjs" > "$S/c3t1-kanit/e2e-$name.txt" 2>&1
  echo "$name çıkış $?: $(grep '^\[kanit\] c3t1' "$S/c3t1-kanit/e2e-$name.txt" | cut -c1-200)"
done
