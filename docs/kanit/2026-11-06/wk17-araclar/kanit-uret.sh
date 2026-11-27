#!/bin/bash
# WK 17 kanıt dosyaları (yalnız bu ajanın not defteri klasörü). Depo kökünden: bash <bu dosya>
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-af5d3ff11385d060f
K=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/wk17-calisma/kanit/2026-11-06
A=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/wk17-calisma/araclar
O=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/wk17-eski-7d6c6369
cd "$W" || exit 1
kos() {   # kos <dosya adı> <TZ> <komut…>
  local ad=$1 tz=$2; shift 2
  { echo "komut: TZ=$tz $*"; echo "commit: $(git rev-parse --short HEAD) (+ çalışma ağacı)"; echo "zaman: $(date -u +%Y-%m-%dT%H:%M:%SZ)"; echo "---"; } > "$K/$ad"
  TZ=$tz "$@" >> "$K/$ad" 2>&1
  echo "--- çıkış $?" >> "$K/$ad"
}
kos wk17-eski-353-tam-sonuc-fark.txt UTC python3 -I "$A/eski_tam_sonuc_fark.py" "$O/kahin/senaryolar.json" test/bagimsiz/whatsapp-248/kahin/senaryolar.json
kos wk17-degisen-4-yaprak-fark.txt UTC python3 -I "$A/yaprak_fark.py" "$O/kahin/senaryolar.json" test/bagimsiz/whatsapp-248/kahin/senaryolar.json S16-02 S30-01 S30-02 S30-03
kos wk17-eski-kahinle-yeni-senaryolar.txt UTC python3 -I "$A/eski_kahinle.py" "$W/test/bagimsiz/whatsapp-248/kahin" "$O/kahin/kahin.py"
kos wk17-eski-kahinle-yeni-senaryolar-tz-istanbul.txt Europe/Istanbul python3 -I "$A/eski_kahinle.py" "$W/test/bagimsiz/whatsapp-248/kahin" "$O/kahin/kahin.py"
kos wk17-eski-kahinle-yeni-senaryolar-notr.txt UTC python3 -I "$A/eski_kahinle.py" "$W/test/bagimsiz/whatsapp-248/kahin" "$O/kahin/kahin.py" --notr "$O/kahin_notr.py"
kos wk17-mutant-matrisi.txt UTC python3 -I "$A/mutant_matrisi.py" "$W/test/bagimsiz/whatsapp-248/kahin"
for f in eski_tam_sonuc_fark.py yaprak_fark.py eski_kahinle.py mutant_matrisi.py kanit-uret.sh; do mkdir -p "$K/wk17-araclar"; cp "$A/$f" "$K/wk17-araclar/$f"; done
grep -H -E '^--- çıkış|özet|DEĞERLE YAKALANMAYAN|aynı [0-9]+ /' "$K"/wk17-*.txt
