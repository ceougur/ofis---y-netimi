#!/bin/bash
# Madde 6 — DÜŞÜK-3 kanıtı: mutabakat motoru (rastgele sıra, her işlemde doğrulama) yeni denetimlerle (ALT SINIR + Σ açık kalem = bakiye).
#   1-2) mutantsız kod, tohum 7 ve 11            → yeşil beklenir (yanlış alarm yok)
#   3)   MUTANT A (fatura durumunda taksitli faturanın 1. taksiti hep kapalı — dar kontrolün mutantı) → kırmızı: "S99 alt sınır"
#   4)   MUTANT S (kartın tüketemediği kısım taksitlerden düşülmez — kalemler bakiyeyi aşar)          → kırmızı: "kalemler toplamı"
#   5)   MUTANT A + ESKİ motor (HEAD'deki)        → yeşil kalır (denetim yeni; dişsizlik kanıtı)
# Yük kilidi paylaşımlı, beklemeden; her koşu süre sınırlı. Kendi kopyam: c5bkd-motor.
S=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad
W=/home/user/ofis---y-netimi/.claude/worktrees/agent-a511c161b54069067
M=$S/c5bkd-motor
K=$S/c5bkd-kanit/motor
ISLEM=${ISLEM:-500}
mkdir -p "$K"
rm -rf "$S/c5bkd-motor"
mkdir -p "$M" && (cd "$W" && git archive HEAD server test package.json | tar -x -C "$M") || exit 1
cp "$M/test/mutabakat/motor.mjs" "$K/motor-eski.mjs" && cp "$M/test/mutabakat/kos.mjs" "$K/kos-eski.mjs" || exit 1
cp "$W/test/mutabakat/motor.mjs" "$W/test/mutabakat/kos.mjs" "$W/test/mutabakat/sigma.mjs" "$M/test/mutabakat/" || exit 1
ln -s /home/user/ofis---y-netimi/node_modules "$M/node_modules"
cp "$M/server/lib/obligation-queue.mjs" "$K/oq-asil.mjs"
kos() { # ad tohum
  ( cd "$M" && HUKUK_LICENSE_URL=http://127.0.0.1:9 TZ=UTC flock -s -n $S/olcum.lock timeout -k 5 1500 node --disable-warning=ExperimentalWarning test/mutabakat/kos.mjs --islem "$ISLEM" --tohum "$2" --tohumlar 1 --her 1 > "$K/$1.out" 2>&1
    echo "$1: çıkış $? · 'alt sınır' $(grep -c 'alt sınır: kapanan' "$K/$1.out") · 'kalemler toplamı' $(grep -c 'kalemler toplamı = cari bakiyesi' "$K/$1.out") · $(grep -m1 -o 'Tohum [0-9]*: [0-9]* işlem, [0-9]* doğrulama' "$K/$1.out") · $(date -u +%H:%M:%S)" )
}
yama() { python3 -I - "$M/server/lib/obligation-queue.mjs" "$1" <<'EOF'
import sys
p, which = sys.argv[1], sys.argv[2]
s = open(p, encoding="utf-8").read()
pairs = {
    "A": ("      const instLeft = card ? card.installments.reduce((sum, inst) => sum + inst.left, 0) : 0;", "      const instLeft = card ? card.installments.slice(1).reduce((sum, inst) => sum + inst.left, 0) : 0;"),
    "S": ("    let excess = capacity - (card.trimmed || 0) - preA - card.consumed;", "    let excess = 0;"),
}
a, b = pairs[which]
assert s.count(a) == 1, (which, s.count(a))
open(p, "w", encoding="utf-8").write(s.replace(a, b))
EOF
}
geri() { cp "$K/oq-asil.mjs" "$M/server/lib/obligation-queue.mjs"; }
kos 1-mutantsiz-tohum7 7
kos 2-mutantsiz-tohum11 11
yama A || { echo "MUTANT A ENJEKTE EDİLEMEDİ"; exit 1; }
kos 3-mutantA-yeni-motor 7
cp "$K/motor-eski.mjs" "$M/test/mutabakat/motor.mjs"; cp "$K/kos-eski.mjs" "$M/test/mutabakat/kos.mjs"
kos 5-mutantA-eski-motor 7
cp "$W/test/mutabakat/motor.mjs" "$W/test/mutabakat/kos.mjs" "$M/test/mutabakat/"
geri
yama S || { echo "MUTANT S ENJEKTE EDİLEMEDİ"; exit 1; }
kos 4-mutantS-yeni-motor 7
geri
rm -rf "$S/c5bkd-motor"
echo BITTI
