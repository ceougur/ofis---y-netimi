#!/bin/bash
# Ç7b tur 2f (devam ajanı) — madde 7: A (defter kâhini), B (cari kâhini + yapım aşaması listesi kendi yolunda), C (muhasebe sürücüsü) tur sonunda, iki TZ.
# Çağrı: timeout -k 5 7000 flock -s -n <olcum.lock> bash abc.sh
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a207e4248e7dd70da
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c7b2f-dv/abc
mkdir -p $N; cd $W || exit 1
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$N
echo "başta $(cat /proc/loadavg) · $(git rev-parse --short HEAD)" > $N/ozet.txt
for tz in UTC Europe/Istanbul; do
  t=${tz//\//-}
  TZ=$tz node tools/kanit.mjs kos c7b2f-sonra-kahin-defter-$t -- npm run test:kahin-defter > $N/defter-$t.out 2>&1; echo "defter $tz çıkış $?" >> $N/ozet.txt
  TZ=$tz node tools/kanit.mjs kos c7b2f-sonra-kahin-cari-$t -- npm run test:kahin-cari > $N/cari-$t.out 2>&1; echo "cari $tz çıkış $?" >> $N/ozet.txt
done
# B: yapım aşaması listesi KENDİ kopyamda yeniden üretilir (depodaki liste boş — kopyası taban)
cp test/bagimsiz/cari/YAPIM-ASAMASI.json $N/YAPIM-ASAMASI.json || exit 1
TZ=Europe/Istanbul KAHIN_YAPIM_ASAMASI=$N/YAPIM-ASAMASI.json node --disable-warning=ExperimentalWarning test/bagimsiz/cari/kos.mjs --yapim-asamasi-yaz > $N/yapim-yaz.out 2>&1; echo "yapım listesi yazımı çıkış $?" >> $N/ozet.txt
python3 -I -c "import json,sys; j=json.load(open(sys.argv[1])); print('yapım listesi kayıt', len(j.get('kayitlar', [])))" $N/YAPIM-ASAMASI.json >> $N/ozet.txt
# C: muhasebe sürücüsü (iki TZ; varsayılan)
node tools/kanit.mjs kos c7b2f-sonra-surucu -- node --disable-warning=ExperimentalWarning test/bagimsiz/muhasebe-surucu/kos.mjs --cikti $N/surucu > $N/surucu.out 2>&1; echo "sürücü çıkış $?" >> $N/ozet.txt
echo "BİTTİ $(date -u +%H:%M:%S) · sonda $(cat /proc/loadavg)" >> $N/ozet.txt
