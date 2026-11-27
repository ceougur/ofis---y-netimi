#!/bin/bash
# motor-mutant.sh'in 3. ve 4. koşusu, ÖNERİLEN denetimin alan adı düzeltilmiş hâliyle (inv.tryPayable). Asıl dosyalar kanit/mm-*-asil.mjs'ten.
N=/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-c5bkap-x7
M=$N/mut2
ISLEM=${ISLEM:-500}; TOHUM=${TOHUM:-7}
kos() {
  ( cd "$M" && HUKUK_LICENSE_URL=http://127.0.0.1:9 timeout -k 5 1500 node --disable-warning=ExperimentalWarning test/mutabakat/kos.mjs --islem "$ISLEM" --tohum "$TOHUM" --tohumlar 1 --her 1 > "$N/kanit/mm-$1.out" 2>&1; echo "$1: çıkış $? · $(grep -c 'S99 alt sınır' "$N/kanit/mm-$1.out") 'S99 alt sınır' satırı · $(grep -c 'UYUŞMAZLIK' "$N/kanit/mm-$1.out") uyuşmazlık başlığı · $(grep -m1 -o 'Tohum [0-9]*: [0-9]* işlem, [0-9]* doğrulama' "$N/kanit/mm-$1.out")" )
}
geri() { cp "$N/kanit/mm-oq-asil.mjs" "$M/server/lib/obligation-queue.mjs"; cp "$N/kanit/mm-motor-asil.mjs" "$M/test/mutabakat/motor.mjs"; }
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
        if (pd && centsOf(inv.open) < Math.min(queueLeft, centsOf(inv.tryPayable)) - 1) problems.push(`Taksitli fatura ${inv.number}: açık ${inv.open} < kartın KUYRUK kalanı ${tl(queueLeft)} (S99 alt sınır)`);
      }
"""
open(p,'w',encoding='utf-8').write(s.replace(a,b+a))
EOF
}
geri
mutantA || { echo "MUTANT ENJEKTE EDİLEMEDİ"; exit 1; }
oneri || { echo "ÖNERİ ENJEKTE EDİLEMEDİ"; geri; exit 1; }
kos 3b-mutantA-onerilen-denetim
cp "$N/kanit/mm-oq-asil.mjs" "$M/server/lib/obligation-queue.mjs"
kos 4b-mutantsiz-onerilen-denetim
TOHUM=11 kos 4c-mutantsiz-onerilen-denetim-tohum11
geri
echo BITTI
