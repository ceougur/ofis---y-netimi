# Dar kontrol betikleri (kopyaları scratchpad/watur3-dk) + T16 zorla 'urun' — yeni kodda (watur3-yeni = HEAD) ve tabanda (watur3-eski), iki TZ.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
K=/home/user/ofis---y-netimi/.claude/worktrees/agent-a548e3bfea9553e7c/tools/kanit.mjs
export KANIT_DIR=$S/watur3-kanit HUKUK_LICENSE_URL=http://127.0.0.1:9
for kod in yeni eski; do
  R=$S/watur3-$kod
  cd $R || exit 1
  for tz in UTC Europe/Istanbul; do
    t=${tz//\//-}
    for v in gec kontrol yeni; do
      ROOT=$R VARYANT=$v TZ=$tz node $K kos watur3-dk-f1-$kod-$v-$t -- node --disable-warning=ExperimentalWarning $S/watur3-dk/f1-s58-gec-bildirim.mjs
    done
    ESKI=$S/watur3-329d YENI=$R TZ=$tz node $K kos watur3-dk-f2-$kod-$t -- node --disable-warning=ExperimentalWarning $S/watur3-dk/f2-eski-veri-hata-metni.mjs
    TZ=$tz node $K kos watur3-t16-urun-$kod-$t -- node --disable-warning=ExperimentalWarning test/whatsapp-t16-zorla.mjs urun
  done
done
echo BITTI
