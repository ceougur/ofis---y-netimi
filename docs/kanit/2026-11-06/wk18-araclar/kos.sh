#!/usr/bin/env bash
# WK 18 kanıt koşuları (depo kökünden: worktree). Her adım ayrı; düşen adımın adı yazılır, sonraki adımlar yine koşar (kanıt sayısı eksik kalmasın), çıkış = düşen adım sayısı.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
K=$S/wk18-kanit
A=$S/wk18-araclar
E=$S/wk18-eski-75f1aad9
KH=test/bagimsiz/whatsapp-248/kahin
dusen=0
kos() {   # kos <TZ> <ad> <komut…>
  local tz=$1 ad=$2; shift 2
  TZ=$tz KANIT_DIR=$K node tools/kanit.mjs kos "$ad" -- "$@" > "$A/son-$ad.txt" 2>&1 || { echo "DÜŞTÜ: $ad"; dusen=$((dusen + 1)); }
  tail -1 "$A/son-$ad.txt"
}
kos UTC wk18-senaryolar python3 -I $KH/senaryolar.py
sha256sum $KH/senaryolar.json
kos Europe/Istanbul wk18-senaryolar-tz-istanbul python3 -I $KH/senaryolar.py
sha256sum $KH/senaryolar.json
kos UTC wk18-kahin python3 -I $KH/kahin_test.py
kos Europe/Istanbul wk18-kahin-tz-istanbul python3 -I $KH/kahin_test.py
for tz in UTC Europe/Istanbul; do
  sfx=""; [ "$tz" = UTC ] || sfx="-tz-istanbul"
  kos $tz wk18-eski-kahinle-ham$sfx python3 -I $A/eski_kahinle.py $E $KH ham S42-,S43- --bekle "S42-=deger;S43-=ayni"
  kos $tz wk18-eski-kahinle-uyarlanmis$sfx python3 -I $A/eski_kahinle.py $E $KH uyarlanmis S42-,S43- --bekle "S42-=istisna:KULLANICIYA SORULMALI S35-a;S43-=ayni"
  kos $tz wk18-eski-kahinle-notr$sfx python3 -I $A/eski_kahinle.py $E $KH notr S42-,S43- --bekle "S42-01=ayni;S42-02=ayni;S42-03=deger;S42-04=ayni;S43-=ayni"
done
kos UTC wk18-eski-367-tam-sonuc-fark python3 -I $A/eski_sonuc_fark.py $E/senaryolar.json $KH/senaryolar.json
kos UTC wk18-mutant-matrisi python3 -I $A/mutant_matrisi.py $KH S42-,S43- yeni
kos Europe/Istanbul wk18-mutant-matrisi-tum-senaryolar-tz-istanbul python3 -I $A/mutant_matrisi.py $KH "" yeni
echo "DÜŞEN ADIM: $dusen"
exit $dusen
