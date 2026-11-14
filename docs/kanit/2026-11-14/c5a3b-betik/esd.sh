#!/bin/bash
# Ç5-A tur 3b kabul A: taban (c5a3b-taban) ↔ yeni dökümü AYNI veri kaynağının iki taze kopyasında (dışa açık yüz + carinin defter satırları + kart listesi / haritası).
# Yeni kodda ayrıca modülün kendi kurduğu yol ↔ servis (KENDI dosyası). Kullanım: bash esd.sh <ad> <veri kaynağı klasörü (data/, backups/)> [şimdi]
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
N=$S/c5a3b-z4
AD=$1; KAYNAK=$2; SIMDI=${3:-2026-10-08T12:00:00+03:00}
[ -n "$AD" ] && [ -d "$KAYNAK/data" ] || { echo "kullanım: esd.sh <ad> <kaynak> [şimdi]"; exit 2; }
export HUKUK_LICENSE_URL=http://127.0.0.1:9
YENI=/home/user/ofis---y-netimi/.claude/worktrees/agent-a076afd863444806e
OUT=/dev/shm/c5a3b-esd
mkdir -p $N/esd $OUT || exit 1
rm -f $N/esd/$AD-kendi.jsonl
echo "esd $AD · kaynak $KAYNAK · şimdi $SIMDI · yeni $(git -C $YENI rev-parse --short HEAD) · başta $(cat /proc/loadavg) · $(date -u +%H:%M:%S)"
for KOD in taban yeni; do
  ROOT=$N/taban; [ $KOD = yeni ] && ROOT=$YENI
  KOPYA=/dev/shm/c5a3b-esd-$AD-$KOD
  rm -rf "$KOPYA" && cp -a "$KAYNAK" "$KOPYA" || exit 1
  s=$(date +%s)
  if [ $KOD = yeni ]; then E="KENDI=$N/esd/$AD-kendi.jsonl"; else E=""; fi
  env $E timeout -k 5 3000 node --max-old-space-size=8192 --disable-warning=ExperimentalWarning $N/betik/dok.mjs "$ROOT" "$KOPYA" $OUT/$AD-$KOD.jsonl "$SIMDI" > $N/esd/$AD-$KOD.ozet 2>&1
  echo "$KOD çıkış $? · $(( $(date +%s) - s )) sn · $(tail -1 $N/esd/$AD-$KOD.ozet)"
  rm -rf "$KOPYA"
done
sha256sum $OUT/$AD-taban.jsonl $OUT/$AD-yeni.jsonl | sed "s#$OUT/##" > $N/esd/$AD.sha256
wc -l $OUT/$AD-yeni.jsonl | sed "s#$OUT/##" >> $N/esd/$AD.sha256
if cmp -s $OUT/$AD-taban.jsonl $OUT/$AD-yeni.jsonl; then echo "SONUÇ $AD: BAYT BAYT AYNI ($(wc -l < $OUT/$AD-yeni.jsonl) satır; $(wc -c < $OUT/$AD-yeni.jsonl) bayt; sha256 $(sha256sum < $OUT/$AD-yeni.jsonl | cut -c1-16))"; else echo "SONUÇ $AD: FARK VAR"; cmp $OUT/$AD-taban.jsonl $OUT/$AD-yeni.jsonl | head -3; fi
echo "KENDİ KENDİNE KURAN YOL ($AD): $(cat $N/esd/$AD-kendi.jsonl 2>/dev/null | tr '\n' ' ')"
rm -f $OUT/$AD-taban.jsonl $OUT/$AD-yeni.jsonl
echo "sonda $(cat /proc/loadavg) · $(date -u +%H:%M:%S)"
