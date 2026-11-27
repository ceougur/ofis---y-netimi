#!/bin/bash
# Kanıt dosyalarını depoya kopyalar (docs/kanit/2026-11-21/c6h4-*). Çağrı: bash kanit-kopyala.sh
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-adeefec4f86e1240e
A=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c6h4-ag
K=$W/docs/kanit/2026-11-21
mkdir -p $K/c6h4-ham $K/c6h4-betik || exit 1
cp -a $A/kanit/2026-11-21/. $K/c6h4-ham/ 2>/dev/null
for f in komsu-UTC.out komsu-Europe-Istanbul.out kirmizi-UTC.out kirmizi-Europe-Istanbul.out hiz-zincir.out hiz-kilitsiz-eski.log hiz-kilitsiz-yeni.log hiz-kilitli-eski.log hiz-kilitli-yeni.log \
         hiz-fis.out fis-eski.log fis-yeni.log s2-yeni-utc.out s3-yeni-utc.out s5-yeni-UTC.out s5-yeni-Europe-Istanbul.out zincir2.out k-muhasebe-model.out parca.out fark-100k.out hiz-tablo.out; do
  [ -f $A/$f ] && cp $A/$f $K/c6h4-ham/$f
done
for f in $A/mut-*.out $A/k-*.out; do cp $f $K/c6h4-ham/; done
for f in komsu.sh komsu-kos.sh komsu.txt eski-kur.sh kirmizi.sh mutantlar.py mutasyon.sh kahin.sh hiz.sh hiz-fis.sh olc.mjs olc-fis.mjs tablo.py kilit.py zincir2.sh s2.mjs s3.mjs s5.mjs fark-100k.py fark-kos.sh parca-fis.mjs parca.sh kanit-kopyala.sh; do
  [ -f $A/$f ] && cp $A/$f $K/c6h4-betik/$f
done
du -sh $K/c6h4-ham $K/c6h4-betik
