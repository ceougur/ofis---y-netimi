// P-Ç5C küçük senaryo (programın API'siyle kurulur; boş veri, sahte saat 08.10.2026 durur). Her sınıf için: bugün gider mi / tutar ({{3}} {{4}}) — queue.mjs overdueOf +
// eligibility ile birebir — ve tek borç sırasına göre (TYK overdue, şüpheli kaydı, Ödeme Sözü, tür). Kod değiştirmez. Kullanım: node senaryo.mjs <kod kökü> <çıktı.json>
import { writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, out] = process.argv.slice(2);
const imp = rel => import(pathToFileURL(path.join(root, rel)).href);
const { boot, must } = await imp("test/banka-210-ortak.mjs");
const { e164Of } = await imp("server/lib/whatsapp/alici.mjs");
const TODAY = "2026-10-08";
const ctx = await boot({ now: { time: `${TODAY}T12:00:00+03:00`, fixed: true } });
const { api, app } = ctx;
const W = "/api/workspace";
let n = 0;
const cari = async (name, type = "customer") => (await must(`cari ${name}`, api.post(`${W}/accounts`, { name, type, registeredOn: "2026-08-01", phone: `0532 111 22 ${String(10 + (n += 1))}` }))).id;
const kart = async (accountId, total, firstDue) => {
  const made = await must("kart", api.post(`${W}/plans`, { accountId, name: `Kart ${(n += 1)}`, total: String(total), registeredOn: "2026-08-01", mode: "auto", count: 3, firstDue }));
  return made.id || made.plan?.id;
};
const bekleyen = [];
const fatura = async (accountId, date, amount, dueDate = "") => bekleyen.push({ accountId, date, amount, dueDate });
const faturaYaz = async ({ accountId, date, amount, dueDate }) => (await must("fatura", api.post(`${W}/invoices`, { scenario: "service_sale", accountId, issueDate: date, lines: [{ name: "Hizmet", qty: 1, unitPrice: String(amount), vatRate: 0 }], payment: { rest: "open", ...(dueDate ? { dueDate } : {}) } }))).id;
const satir = (accountId, body) => must(`satır ${body.kind}`, api.post(`${W}/accounts/${accountId}/entries`, { method: "cash", cashForce: true, similarOk: true, ...body }));
const kapat = async planId => {
  const left = (await must("kart", api.get(`${W}/plans/${planId}`))).totals.remaining;
  return must("Kartı Kapat", api.put(`${W}/plans/${planId}`, { status: "closed", closeRemaining: left }));
};
const S = {};
// K1 yalnız taksit (kart 900 = 3 × 300; 05.09 / 05.10 / 05.11)
S.K1 = await cari("K1 Yalnız Taksit"); await kart(S.K1, 900, "2026-09-05");
// K2 yalnız vadeli fatura (vade 20.09)
S.K2 = await cari("K2 Yalnız Fatura"); await fatura(S.K2, "2026-09-01", 900, "2026-09-20");
// K3 yalnız Borç Yaz (vade 15.09)
S.K3 = await cari("K3 Yalnız Borç Yaz"); await satir(S.K3, { kind: "debt", amount: "500", date: "2026-09-01", dueDate: "2026-09-15" });
// K4 kapatılmış kart, Borçta Kalsın (S220)
S.K4 = await cari("K4 Kapalı Kart"); await kapat(await kart(S.K4, 900, "2026-09-05"));
// K5 kart gecikmiş ama karta bağlanmadan cari tahsilatı 900 (bakiye 0)
S.K5 = await cari("K5 Bakiye Sıfır"); await kart(S.K5, 900, "2026-09-05"); await satir(S.K5, { kind: "in", amount: "900", date: "2026-10-01" });
// K6 tedarikçiye avans (biz ödedik, karşılığı yok)
S.K6 = await cari("K6 Tedarikçi Avans", "supplier"); await satir(S.K6, { kind: "out", amount: "1000", date: "2026-09-01" });
// K7 şüpheli: kart 900 (600 gecikmiş) + Şüpheli Alacağa Al 300
S.K7 = await cari("K7 Şüpheli"); await kart(S.K7, 900, "2026-09-05");
await must("şüpheliye al", api.post(`${W}/accounts/${S.K7}/doubtful`, { amount: "300", date: "2026-10-01", reason: "lawsuit" }));
// K8 Ödeme Sözü: kart 900 (600 gecikmiş) + Borç Yaz 400 vade 15.09, Beklenen Ödeme 20.10
S.K8 = await cari("K8 Söz"); await kart(S.K8, 900, "2026-09-05"); await satir(S.K8, { kind: "debt", amount: "400", date: "2026-09-01", dueDate: "2026-09-15", expectedDate: "2026-10-20" });
// K9 Diğer türü, Borç Yaz 300 vade 15.09
S.K9 = await cari("K9 Diğer", "other"); await satir(S.K9, { kind: "debt", amount: "300", date: "2026-09-01", dueDate: "2026-09-15" });
// K10 dünkü VADESİZ fatura (07.10)
S.K10 = await cari("K10 Vadesiz Dünkü"); await fatura(S.K10, "2026-10-07", 750);
// K11 bize alacaklı: kart 900 (600 gecikmiş) + Alacak Yaz 1.000
S.K11 = await cari("K11 Alacaklı"); await kart(S.K11, 900, "2026-09-05"); await satir(S.K11, { kind: "credit", amount: "1000", date: "2026-10-02" });
// K12 taksit + fatura birlikte
S.K12 = await cari("K12 Taksit ve Fatura"); await kart(S.K12, 900, "2026-09-05"); await fatura(S.K12, "2026-08-15", 500, "2026-08-30");
// K13 söz günü bugün
S.K13 = await cari("K13 Söz Bugün"); await satir(S.K13, { kind: "debt", amount: "400", date: "2026-09-01", dueDate: "2026-09-15", expectedDate: TODAY });
// K14 vadesi bugün olan fatura (vade günü gecikmiş değil — M1f)
S.K14 = await cari("K14 Vade Bugün"); await fatura(S.K14, "2026-09-01", 600, TODAY);

for (const f of bekleyen.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))) await faturaYaz(f);
const { context, store } = app;
const user = store.get("SELECT * FROM users WHERE username = 'admin'");
const all = context.invoices.allObligations();
const res = {};
for (const [k, id] of Object.entries(S)) {
  const a = context.accounts.waFacts(id, user);
  const ov0 = Math.round((Number(a.totals?.overdue) || 0) * 100) / 100;
  const dates = (a.plans || []).filter(p => p.status === "active" && p.next && Number(p.next.remaining) > 0.005 && p.next.dueDate < TODAY).map(p => p.next.dueDate).sort();
  const old = ov0 > 0.005 && dates.length ? { tutar: ov0, vade3: dates[0] } : null;
  const tyk = all.get(id);
  const ov = tyk ? tyk.overdue(TODAY) : { amount: 0, since: "" };
  const kart2 = await must("kart", api.get(`${W}/accounts/${id}`));
  res[k] = {
    tur: a.type, telefon: e164Of(a.phone).valid, bakiye: a.totals.balance,
    bugun: old, kartGecikmis: kart2.totals.overdueDebt, tyk: { tutar: ov.amount, vade3: ov.since, adet: ov.count },
    supheliKayit: (kart2.doubtful?.openMinor || 0) / 100, soz: kart2.totals.promiseActive ? kart2.totals.promiseUntil : "",
  };
}
writeFileSync(out, JSON.stringify(res, null, 1));
for (const [k, v] of Object.entries(res)) console.log(k, JSON.stringify(v));
await ctx.server.close();
