# Ölçüm: AYNI veri şablonu, önce (taban 1f136bb6) / sonra (tur 3 47dbc017); flock -x altında çağrılır.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
cd $S/watur3-olcum || exit 1
for k in eski yeni; do
  rm -rf $S/watur3-olcum/veri-$k
  echo "loadavg $(cat /proc/loadavg)"
  KIP=olc ROOT=$S/watur3-$k SABLON=$S/watur3-olcum/sablon VERI=$S/watur3-olcum/veri-$k TZ=UTC node --disable-warning=ExperimentalWarning $S/watur3-betik/olcum.mjs 2>&1 | tail -1
  rm -rf $S/watur3-olcum/veri-$k
done
echo "loadavg $(cat /proc/loadavg)"
echo BITTI
