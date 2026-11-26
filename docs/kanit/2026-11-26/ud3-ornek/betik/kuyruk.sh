#!/bin/bash
# UD turu 3 son koşuları — bir şerit (iki şerit paralel başlatılır; şerit içinde sırayla). Kullanım: kuyruk.sh <1|2>
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-acb2a64a5f6cdf8f2
D=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/ud3-m8x4
L=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock
export HUKUK_LICENSE_URL=http://127.0.0.1:9
cd $W || exit 1
kos() { # ad, süre, komut...
  local ad=$1 sure=$2; shift 2
  flock -s -w 3600 $L timeout $sure node tools/kanit.mjs kos "$ad" -- "$@" > $D/son-$ad.log 2>&1
  echo "$ad çıkış $? $(date -u +%H:%M)" >> $D/son-durum.txt
}
if [ "$1" = 1 ]; then
  kos ud3-mutabakat-tohum8-islem5000 3000 npm run test:mutabakat -- --islem 5000 --tohum 8 --tohumlar 1
  kos ud3-mutabakat-tohum2-islem5000 3000 npm run test:mutabakat -- --islem 5000 --tohum 2 --tohumlar 1
  kos ud3-mutabakat-tohum6-islem5000 3000 npm run test:mutabakat -- --islem 5000 --tohum 6 --tohumlar 1
  kos ud3-mutabakat-tohum10-islem5000 3000 npm run test:mutabakat -- --islem 5000 --tohum 10 --tohumlar 1
  for tz in UTC Europe/Istanbul; do n=$(echo $tz | tr / -); TZ=$tz kos ud3-kahin-cari-ci-$n 2400 npm run test:kahin-cari; TZ=$tz kos ud3-kahin-defter-$n 2400 npm run test:kahin-defter; done
else
  # eski motor (ud3-taban motoru) + yeni program: S263 sınıfının eski motorda kırmızısı (tohum 8)
  (cd $D/eskimotor && flock -s -w 3600 $L timeout 3000 node --disable-warning=ExperimentalWarning test/mutabakat/kos.mjs --islem 5000 --tohum 8 --tohumlar 1 > $D/son-eski-motor-tohum8.log 2>&1; echo "eski-motor-tohum8 çıkış $? $(date -u +%H:%M)" >> $D/son-durum.txt)
  kos ud3-mutabakat-tohum3-islem5000 3000 npm run test:mutabakat -- --islem 5000 --tohum 3 --tohumlar 1
  kos ud3-mutabakat-tohum7-islem5000 3000 npm run test:mutabakat -- --islem 5000 --tohum 7 --tohumlar 1
  kos ud3-kahin-cari-tohum1-30-islem120 5400 npm run test:kahin-cari -- --tohum 1-30 --islem 120 --cikti $D/kc-son
fi
echo "ŞERİT $1 BİTTİ $(date -u +%H:%M)" >> $D/son-durum.txt
