#!/bin/bash
# UD tur 2: yeni kalıcı test(ler)i eski kodun (aday e7934c5e) AYRI kopyasında iki saat diliminde koşar (ders 23, 38); ham çıktı kanıt klasörüne.
# Kullanım: eski-kos.sh <test dosyası (depo köküne göre)> <kanıt adı>
K=/home/user/ofis---y-netimi/.claude/worktrees/agent-a3efe37d598ece90c/docs/kanit/2026-11-26
E=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/ud2-r4k9/eski
mkdir -p $K
cd $E || exit 1
for tz in UTC Europe/Istanbul; do
  n=$(echo $tz | tr '/' '-')
  out=$K/ud2-eski-kirmizi-$2-$n.txt
  {
    echo "# eski kod: aday e7934c5e — git archive (server, client, test, package.json) ayrı kopyaya açıldı: $E (ders 23); yeni test + fikstür kopyalandı (yeni test — ders 51 gereği eski test yok); TZ=$tz"
    echo "# obligation-queue.mjs sha256: $(sha256sum server/lib/obligation-queue.mjs | cut -c1-16)"
    echo "# komut: node --test $1"
    TZ=$tz timeout 600 node --test $1 2>&1
    echo "# çıkış $?"
  } > $out
  echo "$n: $(grep -E '^# (tests|pass|fail)|^# çıkış' $out | tr '\n' ' ')"
done
