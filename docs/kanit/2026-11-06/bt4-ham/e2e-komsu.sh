#!/bin/bash
# BİRLEŞİK TUR 4: e2e komşuları (görev metnindeki liste; değişen uçlara / formlara dokunan senaryolar) sırayla, kanıt aracıyla.
cd /home/user/ofis---y-netimi/.claude/worktrees/agent-a8e6f2114d96e812f || exit 1
export PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/pw-1194
export KANIT_DIR=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/bt4-kanit
export TZ=UTC HUKUK_LICENSE_URL=http://127.0.0.1:9
for f in senaryo-duzeltme-kilidi-250 run senaryo-iz1-kasa-acilis senaryo-224 senaryo-mobil-yazma-247 uiux-b-243 senaryo-form-izolasyon-243 uiux-a-243; do
  node tools/kanit.mjs kos "bt4-e2e-komsu-$f" -- node --disable-warning=ExperimentalWarning "test/e2e/$f.mjs" > "$KANIT_DIR/e2e-komsu-$f.out" 2>&1
  echo "$f çıkış $? $(tail -1 "$KANIT_DIR/e2e-komsu-$f.out" | cut -c1-220)"
done
echo BITTI
