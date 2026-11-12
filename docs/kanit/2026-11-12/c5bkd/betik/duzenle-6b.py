"""Madde 5 / 6 — mutasyon listesine yaşayan mutantların kalanı (K3, K8, K22, K28, K35) + hız düzeltmesinin mutantları (KD5-…) + motorun alt sınırı (KD6-a). K1: eşdeğerlik notu."""
import json

OQ = "server/lib/obligation-queue.mjs"
DIS = ["test/tyk-kapanis-dis-250.test.mjs"]
GOVDE = ["test/takvim-govde-250.test.mjs"]
M = [
    ["K3", "S101 — aynı para iki kartta 'avansla ödenmiş' sayılır (advClaimed düşülmez; kapanış dar kontrolünün yaşayan mutantı)", OQ, "const take = Math.min(money - (target.advClaimed || 0), claim);", "const take = Math.min(money, claim);", DIS],
    ["K8", "S110 tetiği — carinin açık borcuna öbür kartların / taksitli faturaların açık taksitleri sayılmaz (S135 = C sınırı; yaşayan mutant)", OQ, " + pool.filter(target => (target.kind === \"installment\" || target.kind === \"plan-rest\") && target.planId !== card.planId).reduce((sum, target) => sum + target.left, 0);", ";", DIS],
    ["K22", "tek cari yolu — Excel / Tablodan Aktar kartı tanınmaz (kart ekranı ↔ liste ayrışır; yaşayan mutant)", "server/routes/plans.mjs", "importId: imported.has(plan.id) ? \"import\" : \"\", saleMoveId:", "importId: \"\", saleMoveId:", DIS],
    ["K28", "S96 — bankadan (POS komisyon tahsili) verilen avans kalem değil (yaşayan mutant)", "server/routes/accounts.mjs", "new Set([\"account\", \"stock\", \"invoice\", \"cheque\", \"pos-fee\"]);", "new Set([\"account\", \"stock\", \"invoice\", \"cheque\"]);", DIS],
    ["K35", "S105 — faturalı Alış İadesi (belge) öncelik almaz (yalnız stoktan Alış İadesi; yaşayan mutant)", OQ, "((target.kind === \"note\" && kindOf(target.line) === \"purchase_return\") || (target.kind === \"stock\" && target.line?.stockReason === \"preturn\"))", "(target.kind === \"stock\" && target.line?.stockReason === \"preturn\")", DIS],
    ["KD5-a", "hız — takvim gövdesi belleği görünürlüğe bakmaz (yetkisi dar kişi başkasının gövdesini alır)", "server/routes/dues.mjs", "const key = `${Number(see.cheque)}${Number(see.invoice)}${Number(see.bank)}${Number(see.account)}`;", "const key = \"hepsi\";", GOVDE],
    ["KD5-b", "hız — takvim gövdesi belleği sonuç nesnesine bağlı değil (veri değişince BAYAT yanıt)", "server/routes/dues.mjs", "    let variants = bodies.get(data);\n    if (!variants) bodies.set(data, (variants = new Map()));", "    let variants = bodies.get(cache);\n    if (!variants) bodies.set(cache, (variants = new Map()));", GOVDE],
    ["KD5-c", "hız — tek cari evrak bağı anı sorgusu bağsız evrakı da alır (önceki sorguyla eşdeğer değil)", "server/routes/invoices.mjs", "WHERE +ev.kind IN ('receive', 'issue') AND ev.invoice_id <> '' AND (c.account_id = ?1 OR c.endorse_account_id = ?1 OR ev.account_id = ?1)`;", "WHERE +ev.kind IN ('receive', 'issue') AND (c.account_id = ?1 OR c.endorse_account_id = ?1 OR ev.account_id = ?1)`;", GOVDE],
]
p = "test/tyk-mutasyon-250.mjs"
s = open(p, encoding="utf-8").read()
a = """];
rmSync(base, { recursive: true, force: true });
let killed = 0;"""
assert s.count(a) == 1
note = """  // K1 (S101 — "kırpılan tahsilatsız kart önceki geçişte ön ödemeliyse sonraki geçişte düşer"; kapanış dar kontrolünün yaşayan mutantı) LİSTEDE DEĞİL: gözlenebilir farkı
  // bulunamadı — Ç5-B kapanış düzeltmesi turunda asıl ↔ mutant motor aynı girdilerle karşılaştırıldı (çok kartlı geriye tarihli üretici + 100 bin satırlık verinin 1.484
  // carisi; sayılar ve betik teslim raporunda / docs/kanit/2026-11-12/c5bkd-mutant-fark). Koşul yalnız ön ödeme döngüsünün KARARLILIĞINI korur (tasarım §12.5).
"""
import sys
which = sys.argv[1]
M = [m for m in M if m[0].startswith("KD5") == (which == "5")]
s = s.replace(a, "".join("  " + json.dumps(m, ensure_ascii=False) + ",\n" for m in M) + (note if which == "6" else "") + a)
open(p, "w", encoding="utf-8").write(s)
print("tamam")
