#!/bin/bash
# Tur 2e son doğrulama 2: kabul D + G2 komşular (iki TZ) + üç ekran senaryosu (iki TZ) + yeni testler B7 zorlama kiplerinde — yeni = git archive 7c05fad4
NB=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a2e-k3
YENI=/home/user/ofis---y-netimi/.claude/worktrees/agent-a43a9593927943672
export HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR=$NB/kanit PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/pw-1194
date -u +"başla %H:%M"; cat /proc/loadavg
cd $YENI || exit 1
LIST=$(cat $NB/komsu.txt; echo test/acilis-eslestirme-250.test.mjs test/s160-iptal-yollari-250.test.mjs test/s160-kilitli-tahsilat-bagi-250.test.mjs test/acilis-olabilir-yetki-250.test.mjs test/mutabakat-213.test.mjs test/mutabakat-araci-uyari-250.test.mjs test/yazim-duzeni.test.mjs)
LIST=$(echo $LIST | tr ' ' '\n' | sort -u)
echo "dosya sayısı $(echo "$LIST" | wc -l)"
bash $NB/kos.sh son2 $YENI $LIST
grep -c "^0 " $NB/son2.ozet | sed 's/^/yeşil satır: /'; grep -v "^0 \|^BITTI" $NB/son2.ozet | sed 's/^/KIRMIZI: /'
for s in senaryo-acilis-duzeni-250 senaryo-acilis-olabilir-250 senaryo-acilis-eslestirme-250; do
  for tz in UTC Europe/Istanbul; do
    z=${tz//\//_}
    TZ=$tz timeout -k 5 1500 node tools/kanit.mjs kos c5a2e-e2e-$s-$z -- node test/e2e/$s.mjs > $NB/e2e-$s-$z.out 2>&1
    echo "e2e $s $tz çıkış $? $(grep '^\[kanit\] c5a2e' $NB/e2e-$s-$z.out | cut -c1-150)"
  done
done
for kip in bitir gozlem; do
  for t in test/kural-farki-yil-250.test.mjs test/acilis-olabilir-yetki-250.test.mjs; do
    DONDURMA_YARIS=$kip ZORLA_SURE_SN=600 timeout -k 5 900 node test/b7-dondurma-yaris-zorla.mjs $t 1 --ad '' > $NB/b7-$kip-$(basename $t .test.mjs).out 2>&1
    echo "B7 $kip $t çıkış $? $(tail -2 $NB/b7-$kip-$(basename $t .test.mjs).out | tr '\n' ' ' | cut -c1-200)"
  done
done
date -u +"bitti %H:%M"
