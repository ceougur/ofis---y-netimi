#!/bin/bash
# BT5: dar kontrollerin betiklerini (okunur, kopyalanmadan) GÜNCEL kodda ve TABANDA (578c12d4 kopyası) koşar; çıktı bt5-kanit/dk-betikler-<kök>.txt
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a731f6dec73e0177c
for ROOTNAME in yeni taban; do
  if [ "$ROOTNAME" = yeni ]; then R="$W"; else R="$S/bt5-eski-578c"; fi
  OUT="$S/bt5-kanit/dk-betikler-$ROOTNAME.txt"
  : > "$OUT"
  echo "=== kök: $R ($ROOTNAME) $(date -u +%FT%TZ)" >> "$OUT"
  export HUKUK_LICENSE_URL=http://127.0.0.1:9
  echo "--- dk-ah/betik/bs6-exec-gercek.mjs" >> "$OUT"
  node --disable-warning=ExperimentalWarning "$S/dk-ah/betik/bs6-exec-gercek.mjs" "$R" "$S/bt5-tmp-exec-$ROOTNAME" >> "$OUT" 2>&1; echo "çıkış $?" >> "$OUT"
  echo "--- dk-ah/betik/bs6-mesru.mjs" >> "$OUT"
  node --disable-warning=ExperimentalWarning "$S/dk-ah/betik/bs6-mesru.mjs" "$R" "$S/bt5-tmp-mesru-$ROOTNAME" >> "$OUT" 2>&1; echo "çıkış $?" >> "$OUT"
  echo "--- bt5-betik/okuma-hatasi-dene.mjs (ilk hata okuma hatasında)" >> "$OUT"
  node --disable-warning=ExperimentalWarning "$S/bt5-betik/okuma-hatasi-dene.mjs" "$R" "$S/bt5-tmp-okuma-$ROOTNAME" >> "$OUT" 2>&1; echo "çıkış $?" >> "$OUT"
  for SC in dosya-kayip tasima-anahtarli kapili-001-geri-don; do
    echo "--- dk-webs7-is/senaryo.mjs $SC" >> "$OUT"
    ROOT="$R" node --disable-warning=ExperimentalWarning "$S/dk-webs7-is/senaryo.mjs" "$SC" >> "$OUT" 2>&1; echo "çıkış $?" >> "$OUT"
  done
  echo "--- dk-bt4-betik/p4-kapali-kart-tarih.mjs" >> "$OUT"
  (cd "$R" && node --disable-warning=ExperimentalWarning "$S/dk-bt4-betik/p4-kapali-kart-tarih.mjs") >> "$OUT" 2>&1; echo "çıkış $?" >> "$OUT"
  echo "--- dk-bt4-betik/p1-alanlar.mjs (özet)" >> "$OUT"
  (cd "$R" && node --disable-warning=ExperimentalWarning "$S/dk-bt4-betik/p1-alanlar.mjs") > "$S/bt5-kanit/p1-$ROOTNAME.txt" 2>&1; echo "çıkış $?" >> "$OUT"
  grep -E "=== P1" "$S/bt5-kanit/p1-$ROOTNAME.txt" >> "$OUT"
done
echo bitti
