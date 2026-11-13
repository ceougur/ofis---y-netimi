"""Madde 6 — DÜŞÜK-3: mutabakat motorunda taksitli fatura açığına ALT SINIR + isteğe bağlı 'Σ açık kalem = bakiye' (sigmaOf); kos.mjs ve çekirdek test bağlar."""


def edit(path, pairs):
    s = open(path, encoding="utf-8").read()
    for old, new in pairs:
        assert s.count(old) == 1, (path, old[:90], s.count(old))
        s = s.replace(old, new)
    open(path, "w", encoding="utf-8").write(s)


edit("test/mutabakat/motor.mjs", [
    ("tahsileVer = true, k8 = true, supheli = true, log = () => {} }) {", "tahsileVer = true, k8 = true, supheli = true, sigmaOf = null, log = () => {} }) {"),
    ("""    for (const a of list) if (M.cari.has(a.id) && centsOf(a.balance) !== M.cari.get(a.id)) problems.push(`Cari ${a.name} (${a.refNo}): program ${a.balance} · model ${tl(M.cari.get(a.id))}`);
""",
     """    for (const a of list) if (M.cari.has(a.id) && centsOf(a.balance) !== M.cari.get(a.id)) problems.push(`Cari ${a.name} (${a.refNo}): program ${a.balance} · model ${tl(M.cari.get(a.id))}`);
    // 2.5.0 Ç5-B kapanış düzeltmesi (dar kontrol DÜŞÜK-3 + ORTA-2; kullanıcının koşulu "kalemler toplamı = cari bakiyesi HER durumda tutar"): tek yükümlülük kuyruğunun
    // açık kalemlerinin toplamı (alacak − borç yönü) bu modelin BAĞIMSIZ cari bakiyesine eşit. Model kuyruğu kurmaz; bakiyeyi kendi satırlarından toplar — iki görünümü
    // birden bozan hata (ör. yakınsamayan ön ödeme ölçümü: kalemler bakiyeden 20 fazla) burada görünür. sigmaOf: koşucunun verdiği okuma (test/mutabakat/sigma.mjs —
    // programın kuyruğundan cari → kuruş); verilmediyse denetim yapılmaz (HTTP'den okunamaz: karşı yönlü avans kalemleri ekranlarda kalem değildir).
    if (sigmaOf) {
      const sigma = await sigmaOf();
      for (const a of list) {
        if (!M.cari.has(a.id) || !sigma.has(a.id)) continue;
        if (sigma.get(a.id) !== M.cari.get(a.id)) problems.push(`Cari ${a.name} (${a.refNo}): açık kalemlerin toplamı ${tl(sigma.get(a.id))} ≠ bakiye (model) ${tl(M.cari.get(a.id))} — kalemler toplamı = cari bakiyesi`);
      }
    }
"""),
    ("""      if (Math.abs(want - left) > 1) problems.push(`Taksitli fatura ${inv.number}: açık ${inv.open} (geri ödenen ${tl(refunds)}) ≠ kartın kalanı""",
     """      // 2.5.0 Ç5-B kapanış düzeltmesi (dar kontrol DÜŞÜK-3): üst sınır tek başına dişsizdi — fatura durumunda taksiti hep kapalı sayan hata (açık olması gerekenden KÜÇÜK)
      // yakalanmıyordu (mutant: kanıt docs/kanit/2026-11-12/c5bkd-motor-mutant). ALT SINIR: S99 = A "taksitli faturanın açığı = kartının KUYRUK kalanı" — açık, kartın
      // taksitlerinin kuyruk kalanından (kart penceresi items[].remaining) küçük olamaz (faturanın ödeneceğini aşmadan). Program içi tutarlılık (fatura durumu ↔ net görünüm).
      {
        const card = (await api("GET", `/api/workspace/plans/${p.id}`)).data;
        const queueLeft = (card?.items || []).reduce((sum, item) => sum + centsOf(item.remaining), 0);
        if (card && centsOf(inv.open) < Math.min(queueLeft, centsOf(inv.payable)) - 1) problems.push(`Taksitli fatura ${inv.number}: açık ${inv.open} < kartın KUYRUK kalanı ${tl(queueLeft)} (S99 alt sınır) · kapatanlar ${(inv.closers || []).map(c => `${c.date}:${c.amount}:${c.label}`).join(" | ")}`);
      }
      if (Math.abs(want - left) > 1) problems.push(`Taksitli fatura ${inv.number}: açık ${inv.open} (geri ödenen ${tl(refunds)}) ≠ kartın kalanı"""),
])

open("test/mutabakat/sigma.mjs", "w", encoding="utf-8").write('''// Mutabakat motorunun "Σ açık kalem = bakiye" denetimi için okuma (2.5.0 Ç5-B kapanış düzeltmesi, DÜŞÜK-3): programın TEK YÜKÜMLÜLÜK KUYRUĞUNDAN her carinin açık
// kalemlerinin imzalı toplamı (alacak yönü +, borç yönü −; kuruş). Sunucu koşucuyla aynı süreçte çalışır (startTestServer) — kuyruk programın kendi servisinden okunur;
// HTTP ekranları karşı yönlü avansı kalem saymadığı için toplam oradan kurulamaz. Dönüş: () => Map(cari kimliği → kuruş).
export const sigmaReader = server => () => {
  const out = new Map();
  const all = server.app.context?.invoices?.allObligations?.();
  if (!all) return out;
  for (const [accountId, queue] of all) {
    let minor = 0;
    for (const item of queue?.items || []) minor += (item.side === "receivable" ? 1 : -1) * Math.round(item.remaining * 100);
    out.set(accountId, minor);
  }
  return out;
};
''')

edit("test/mutabakat/kos.mjs", [
    ('import { loginAdmin, startTestServer } from "../helpers.mjs";\n', 'import { loginAdmin, startTestServer } from "../helpers.mjs";\nimport { sigmaReader } from "./sigma.mjs";\n'),
    ("verifyEvery: every, burst, pos: !process.argv.includes(\"--pos-yok\"), log: line => console.log(line) });", "verifyEvery: every, burst, pos: !process.argv.includes(\"--pos-yok\"), sigmaOf: sigmaReader(server), log: line => console.log(line) });"),
])
print("tamam")
