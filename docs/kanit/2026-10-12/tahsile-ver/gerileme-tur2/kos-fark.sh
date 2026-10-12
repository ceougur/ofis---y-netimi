#!/bin/bash
# Tur 2 gerileme fark koşusu (bağımsız doğrulayıcı; kod değiştirmez). Worktree kökünden değil bu klasörden çalışır.
set -u
D=$(cd "$(dirname "$0")" && pwd)
cd "$D"
for v in v2.1.0 guncel; do
  node fark-cek-akislari.mjs $v cek-$v.json > cek-$v.log 2>&1; echo "cek $v cikis=$?" >> kos-fark.durum
done
node fark-karsilastir.mjs cek-v2.1.0.json cek-guncel.json > karsilastirma-cek.txt 2>&1; echo "karsilastir cek cikis=$?" >> kos-fark.durum
for f in surum-2.0.26-turler surum-2.0.26-zincir surum-2.0.26-iade surum-2.0.25-zincir surum-2.0.21-zincir; do
  for v in v2.1.0 guncel; do
    node fark-fikstur.mjs $f $v fik-$f-$v.json > fik-$f-$v.log 2>&1; echo "fik $f $v cikis=$?" >> kos-fark.durum
  done
  node fark-karsilastir.mjs fik-$f-v2.1.0.json fik-$f-guncel.json > karsilastirma-$f.txt 2>&1; echo "karsilastir $f cikis=$?" >> kos-fark.durum
done
echo BITTI >> kos-fark.durum
