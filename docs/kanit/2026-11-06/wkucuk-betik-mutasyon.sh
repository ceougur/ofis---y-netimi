#!/usr/bin/env bash
# Mutasyon koşusu (ders 7, 23, 25): bash mutasyon.sh <ad> <dosya> <sed ifadesi> <test dosyası>...
# 92b694c8'in ayrı kopyasında (benzersiz klasör wkucuk-mut-<ad>) dosyaya bilinçli hata enjekte edilir; enjeksiyonun gerçekten uygulandığı denetlenir (diff boşsa durur);
# yalnız verilen test dosyaları kanıt aracıyla koşulur (KANIT_DIR not defteri). Kopya iş bitince yalnız kendi tam yoluyla silinir (ders 36).
set -u
P=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
AD="$1"; DOSYA="$2"; IFADE="$3"; shift 3
K="$P/wkucuk-mut-$AD"
[ -e "$K" ] && { echo "kopya zaten var: $K"; exit 2; }
mkdir -p "$K" || exit 1
tar -xf "$P/wkucuk-mut-92b694c8.tar" -C "$K" || exit 1
ln -s /home/user/ofis---y-netimi/node_modules "$K/node_modules" || exit 1
cp "$K/$DOSYA" "$K/$DOSYA.orijinal" || exit 1
sed -i -e "$IFADE" "$K/$DOSYA" || exit 1
if cmp -s "$K/$DOSYA" "$K/$DOSYA.orijinal"; then echo "MUTASYON UYGULANMADI: $AD"; exit 3; fi
diff "$K/$DOSYA.orijinal" "$K/$DOSYA" | head -8
rm "$K/$DOSYA.orijinal"
cd "$K" || exit 1
for TZV in UTC Europe/Istanbul; do
  TZ="$TZV" HUKUK_LICENSE_URL=http://127.0.0.1:9 KANIT_DIR="$P/wkucuk-kanit" node tools/kanit.mjs kos "wkucuk-mut-$AD-${TZV//\//-}" -- node --disable-warning=ExperimentalWarning --test --test-concurrency=1 "$@" > /dev/null 2>&1
  echo "$AD $TZV çıkış $?"
done
cd "$P" || exit 1
rm -rf "${K:?}"
