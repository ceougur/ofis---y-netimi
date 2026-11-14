// KULLANICIYA SORULMALI örneği (saf plan): 2027 fişi (B 500 700 / A 671 700) 2026'nın 602 farkını (700) düzeltti; kilit 30.11.2026'ya geri alındıktan sonra 2025'in 602 farkı (50) da doğdu.
// Eşleme yılı 2026: fişin 671 kovası iki farkı (2026 / 602 −700, 2025 / 602 −50 → ikisi de fişin yılında 671) kısmen karşılıyor. Kullanım: KOD=<kod> node soru-ornek.mjs
import path from "node:path";
const o = await import(path.join(process.env.KOD, "server/lib/ledger-opening.mjs"));
const d = (account, minor, year) => ({ year, account, sub: "", party: "", minor });
const diff = { entries: [{ id: "r1", date: "2026-10-02", deltas: [d("500", 70000, 2026), d("602", -70000, 2026)] }, { id: "r0", date: "2025-11-10", deltas: [d("500", 5000, 2025), d("602", -5000, 2025)] }] };
const f27 = new Map([[2027, new Map([["500|", 70000], ["671|", -70000]])]]);
const lt = lines => lines.map(l => `${l.debit ? "B" : "A"} ${l.account} ${(l.debit || l.credit) / 100}`).sort().join(" / ") || "(yok)";
const p = o.ruleDiffCorrectionPlan({ diff, year: 2026, postedByYear: f27 });
console.log(`bugünkü (tur 2e kuralı, bölünemeyen kova): ${lt(p.lines)} · fazla ${JSON.stringify(p.ownYearOver)}`);
console.log(`fişsiz 2026 eşlemesi: ${lt(o.ruleDiffCorrectionPlan({ diff, year: 2026, postedByYear: new Map() }).lines)}`);
