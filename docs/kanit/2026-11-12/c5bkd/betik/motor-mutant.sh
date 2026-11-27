#!/bin/bash
# Gevşetme (a) kanıtı: mutabakat motoru (rastgele sıra) şu dört durumda koşulur (kendi kopyam mut2):
#   1) mutantsız kod + depodaki motor                      → yeşil beklenir
#   2) MUTANT A (fatura durumunda taksitli faturanın 1. taksiti hep kapalı sayılır: açık olması gerekenden KÜÇÜK) + depodaki motor → yeşil kalırsa denetim dişini kaybetmiş
#   3) MUTANT A + ÖNERİLEN ek denetim (açık ≥ kartın kuyruk kalanı; kart GET items[].remaining) → kırmızı beklenir
#   4) mutantsız kod + önerilen ek denetim                 → yeşil beklenir (öneri yanlış alarm vermiyor)
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-c5bkap-x7
M=$N/mut2
ISLEM=${ISLEM:-500}; TOHUM=${TOHUM:-7}
[ -e "$M/node_modules" ] || ln -s /home/user/ofis---y-netimi/node_modules "$M/node_modules"
cp "$M/server/lib/obligation-queue.mjs" "$N/kanit/mm-oq-asil.mjs"
cp "$M/test/mutabakat/motor.mjs" "$N/kanit/mm-motor-asil.mjs"
kos() { # ad
  ( cd "$M" && HUKUK_LICENSE_URL=http://127.0.0.1:9 timeout -k 5 1500 node --disable-warning=ExperimentalWarning test/mutabakat/kos.mjs --islem "$ISLEM" --tohum "$TOHUM" --tohumlar 1 --her 1 > "$N/kanit/mm-$1.out" 2>&1; echo "$1: çıkış $? · $(grep -c 'Taksitli fatura' "$N/kanit/mm-$1.out") 'Taksitli fatura' satırı · $(grep -m1 -o 'Tohum [0-9]*: [0-9]* işlem, [0-9]* doğrulama' "$N/kanit/mm-$1.out")" )
}
mutantA() { python3 -I - "$M/server/lib/obligation-queue.mjs" <<'EOF'
import sys
p=sys.argv[1]; s=open(p,encoding='utf-8').read()
a="      const instLeft = card ? card.installments.reduce((sum, inst) => sum + inst.left, 0) : 0;"
b="      const instLeft = card ? card.installments.slice(1).reduce((sum, inst) => sum + inst.left, 0) : 0;"
assert s.count(a)==1, s.count(a)
open(p,'w',encoding='utf-8').write(s.replace(a,b))
EOF
}
oneri() { python3 -I - "$M/test/mutabakat/motor.mjs" <<'EOF'
import sys
p=sys.argv[1]; s=open(p,encoding='utf-8').read()
a="      if (Math.abs(want - left) > 1) problems.push(`Taksitli fatura ${inv.number}: açık ${inv.open} (geri ödenen"
assert s.count(a)==1, s.count(a)
b="""      { // ÖNERİ (dar kontrol): S99 = A "taksitli faturanın açığı = kartının KUYRUK kalanı" — alt sınır: açık, kartın kuyruk kalanından (kart GET items[].remaining) küçük olamaz.
        const pd = (await api("GET", `/api/workspace/plans/${p.id}`)).data;
        const queueLeft = (pd?.items || []).reduce((s, it) => s + centsOf(it.remaining), 0);
        if (pd && centsOf(inv.open) < Math.min(queueLeft, centsOf(inv.payable)) - 1) problems.push(`Taksitli fatura ${inv.number}: açık ${inv.open} < kartın KUYRUK kalanı ${tl(queueLeft)} (S99 alt sınır)`);
      }
"""
open(p,'w',encoding='utf-8').write(s.replace(a,b+a))
EOF
}
geri() { cp "$N/kanit/mm-oq-asil.mjs" "$M/server/lib/obligation-queue.mjs"; cp "$N/kanit/mm-motor-asil.mjs" "$M/test/mutabakat/motor.mjs"; }
geri; kos 1-mutantsiz-depo-motoru
mutantA || { echo "MUTANT ENJEKTE EDİLEMEDİ"; exit 1; }
kos 2-mutantA-depo-motoru
oneri || { echo "ÖNERİ ENJEKTE EDİLEMEDİ"; geri; exit 1; }
kos 3-mutantA-onerilen-denetim
cp "$N/kanit/mm-oq-asil.mjs" "$M/server/lib/obligation-queue.mjs"
kos 4-mutantsiz-onerilen-denetim
geri
echo BITTI
