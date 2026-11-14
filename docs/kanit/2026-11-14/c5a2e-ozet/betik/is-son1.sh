#!/bin/bash
# Tur 2e son doğrulama 1: kâhinler (A, B) + eşdeğerlik (C) — yeni = git archive 7c05fad4, taban = git archive c5a2e-taban
NB=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a2e-k3
YENI=$NB/yeni
ESKI=$NB/taban
P=$NB/dk/p
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$NB/kanit
date -u +"başla %H:%M"; df -h / | tail -1; cat /proc/loadavg
cd $YENI || exit 1
# A — defter kâhini iki TZ
for tz in UTC Europe/Istanbul; do
  z=${tz//\//_}
  TZ=$tz timeout -k 5 2400 node tools/kanit.mjs kos c5a2e-yeni-kahin-defter-$z -- npm run test:kahin-defter > $NB/yeni-kahin-defter-$z.out 2>&1
  echo "A defter $tz çıkış $? $(grep '^\[kanit\] c5a2e' $NB/yeni-kahin-defter-$z.out | cut -c1-160)"
done
# B — cari kâhini (liste kendi kopyamda) + listenin yeniden üretimi kendi yolunda
cp test/bagimsiz/cari/YAPIM-ASAMASI.json $NB/yapim-yeni.json
TZ=UTC KAHIN_YAPIM_ASAMASI=$NB/yapim-yeni.json timeout -k 5 3000 node tools/kanit.mjs kos c5a2e-yeni-kahin-cari-UTC -- npm run test:kahin-cari > $NB/yeni-kahin-cari-UTC.out 2>&1
echo "B cari UTC çıkış $? $(grep '^\[kanit\] c5a2e' $NB/yeni-kahin-cari-UTC.out | cut -c1-160)"
cp test/bagimsiz/cari/YAPIM-ASAMASI.json $NB/yapim-uretim.json
TZ=UTC KAHIN_YAPIM_ASAMASI=$NB/yapim-uretim.json timeout -k 5 3000 node --disable-warning=ExperimentalWarning test/bagimsiz/cari/kos.mjs --yapim-asamasi-yaz > $NB/yeni-yapim-yaz.out 2>&1
echo "B liste üretimi çıkış $? · depodaki liste ↔ üretilen: $(python3 -I -c "
import json,sys
a=json.load(open('$YENI/test/bagimsiz/cari/YAPIM-ASAMASI.json')); b=json.load(open('$NB/yapim-uretim.json'))
def n(x):
    for k in ('kayitlar','kayıtlar','items','entries'):
        if k in x: return len(x[k])
    return [k for k,v in x.items() if isinstance(v,list) and k!='aciklama']
print('depo', n(a), 'üretilen', n(b))
")"
cmp -s $YENI/test/bagimsiz/cari/YAPIM-ASAMASI.json $NB/yapim-uretim.json && echo "B liste: depodaki ile BAYT BAYT AYNI" || echo "B liste: FARKLI (diff $NB/yapim-uretim.json)"
# C — eşdeğerlik: fişsiz / adaysız fikstürler iki TZ
for tz in UTC Europe/Istanbul; do
  for fx in surum-2.4.9-s127 surum-2.0.26-zincir surum-2.4.9-s127-kilitsiz; do
    T=$NB/esd-$fx-${tz//\//_}; rm -rf $T
    today=$(node --disable-warning=ExperimentalWarning $P/esd-fikstur.mjs $fx $T | tail -1) || exit 1
    echo "== C $fx · TZ $tz · bugün $today"
    TZ=$tz timeout -k 5 900 node --disable-warning=ExperimentalWarning $P/esd.mjs $ESKI $T/eski $today $T/eski.json > $T/eski.log 2>&1; echo "  taban çıkış $? $(tail -1 $T/eski.log | cut -c1-220)"
    TZ=$tz timeout -k 5 900 node --disable-warning=ExperimentalWarning $P/esd.mjs $YENI $T/yeni $today $T/yeni.json > $T/yeni.log 2>&1; echo "  yeni çıkış $? $(tail -1 $T/yeni.log | cut -c1-220)"
    python3 -I $P/karsilastir.py $T/eski.json $T/yeni.json
    rm -rf $T/eski/data $T/yeni/data $T/eski/backups $T/yeni/backups
  done
done
# C — temiz 100 bin satır kilitsiz + kilitli 30.06.2026 (Europe/Istanbul)
SRC=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/ana-kabul/temiz-100k
df -h / | tail -1
for lock in - 2026-06-30; do
  for side in taban yeni; do
    rm -rf $NB/b100k && cp -a $SRC $NB/b100k || exit 1
    R=$ESKI; [ $side = yeni ] && R=$YENI
    ESD_PASS=Kapi-Olcum-2026! TZ=Europe/Istanbul timeout -k 5 1800 node --disable-warning=ExperimentalWarning $P/esd.mjs $R $NB/b100k 2026-10-08 $NB/b100k-$side-$lock.json $lock > $NB/b100k-$side-$lock.log 2>&1
    echo "C 100k $side kilit $lock çıkış $? $(tail -1 $NB/b100k-$side-$lock.log | cut -c1-260)"
  done
  python3 -I $P/karsilastir.py $NB/b100k-taban-$lock.json $NB/b100k-yeni-$lock.json
done
rm -rf $NB/b100k
date -u +"bitti %H:%M"; df -h / | tail -1
