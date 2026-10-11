// Eleştirmen e3: yargıcın bakmadığı alanlar — dönem kilidi × banka yazımları (Açılışı Düzelt, hesap sil/pasif, Kart Borcuna Aktar,
// sihirbaz ve Geri Al, planlı işlem gerçekleştir/atla, transfer Ters Kaydet) ve Şirket Verisini Sıfırla × banka tabloları (bank_jobs, planlar).
import { ADMIN_PASSWORD } from "../../../../test/helpers.mjs";
import { BANK, bootBank, lockPeriod } from "../../../../test/banka-210-hesap-ortak.mjs";
import { integrityOf } from "../../../../test/banka-210-ortak.mjs";
const log = (...a) => console.log(...a);
const r = res => `${res.status} ${res.code || ""} ${String(res.error || "").slice(0, 120)}`;
const ctx = await bootBank({ bankPickLegacy: true });
const { api, store } = ctx;
const lines = () => JSON.stringify(store.all("SELECT COUNT(*) n, COALESCE(SUM(try_minor),0) s FROM bank_lines")[0]);
try {
  const cus = (await api.post("/api/workspace/accounts", { name: "Müşteri", type: "customer", registeredOn: "2026-09-01" })).data;
  const sup = (await api.post("/api/workspace/accounts", { name: "Tedarikçi", type: "supplier", registeredOn: "2026-09-01" })).data;
  // Eski (hesapsız) satırlar: havale 10.05 (sihirbazla bağlanacak), kartla ödeme 10.04 (Kart Borcuna Aktar).
  await api.post(`/api/workspace/accounts/${cus.id}/entries`, { kind: "in", method: "bank", date: "2026-10-05", amount: "1.000" });
  await api.post(`/api/workspace/accounts/${sup.id}/entries`, { kind: "out", method: "card", date: "2026-10-04", amount: "300" });
  const A = (await api.post(`${BANK}/accounts`, { bankName: "Ziraat", name: "A", kind: "demand", opening: { date: "2026-10-01", amount: "5.000", confirmed: true } })).data;
  const B = (await api.post(`${BANK}/accounts`, { bankName: "Garanti", name: "B", kind: "demand", opening: { date: "2026-10-01", amount: "1.000", confirmed: true } })).data;
  const KK = (await api.post(`${BANK}/accounts`, { bankName: "Garanti", name: "KK", kind: "card", creditLimit: "10.000", opening: { date: "2026-10-01", amount: "0", confirmed: true } })).data;
  const setup = await api.post(`${BANK}/setup`, { accountId: A.id, carryClose: true, assign: "all" });
  log("sihirbaz", r(setup));
  const tr = await api.post(`${BANK}/transfers`, { fromAccountId: A.id, toAccountId: B.id, amount: "100", date: "2026-10-02", channel: "eft" });
  log("transfer 02.10", r(tr), tr.data?.no || tr.data?.event?.no || "");
  const plan = await api.post(`${BANK}/plans`, { type: "fee", accountId: A.id, amount: "25", feeType: "eft", tax: "none", plannedDate: "2026-10-03", repeat: "monthly" });
  log("planlı masraf 03.10", r(plan));
  const before = lines();
  await lockPeriod(api, "2026-10-04");
  log("=== KİLİT 04.10'a kadar");
  log("Açılışı Düzelt (01.10, tutar)", r(await api.post(`${BANK}/accounts/${B.id}/opening`, { date: "2026-10-01", amount: "2.000", confirmed: true })));
  log("Açılışı Düzelt (tarih 05.10'a)", r(await api.post(`${BANK}/accounts/${B.id}/opening`, { date: "2026-10-05", amount: "1.000", confirmed: true })));
  log("Kart Borcuna Aktar tarih 03.10", r(await api.post(`${BANK}/legacy/reclass`, { mode: "card", accountId: KK.id, amount: "300", date: "2026-10-03" })));
  log("Kart Borcuna Aktar tarih 08.10 (satır 04.10, kilitli)", r(await api.post(`${BANK}/legacy/reclass`, { mode: "card", accountId: KK.id, amount: "300", date: "2026-10-08" })));
  log("Sihirbaz Geri Al (Devir 01.10 kilitli)", r(await api.post(`${BANK}/setup/${setup.data?.id}/undo`, {})));
  const evRef = tr.data?.id || tr.data?.eventId || tr.data?.event?.id;
  log("transfer (02.10) Ters Kaydet", r(await api.post(`${BANK}/events/${evRef}/reverse`, {})));
  log("transfer (02.10) Düzelt", r(await api.post(`${BANK}/events/${evRef}/correct`, { amount: "150", date: "2026-10-02" })));
  log("planlı işlem (03.10) gerçekleştir", r(await api.post(`${BANK}/plans/${plan.data?.id}/execute`, { expectedDate: "2026-10-03" })));
  log("planlı işlem (03.10) gerçekleştir tarih 08.10", r(await api.post(`${BANK}/plans/${plan.data?.id}/execute`, { expectedDate: "2026-10-03", date: "2026-10-08" })));
  log("hesap B pasife al", r(await api.post(`${BANK}/accounts/${B.id}/status`, { status: "passive" })));
  log("hesap B etkinleştir", r(await api.post(`${BANK}/accounts/${B.id}/status`, { status: "active" })));
  log("hesap KK sil (yalnız açılış 01.10 kilitli)", r(await api.del(`${BANK}/accounts/${KK.id}`)));
  log("hesap A türü Vadesiz→Ticari", r(await api.put(`${BANK}/accounts/${A.id}`, { kind: "commercial" })));
  const after = lines();
  log("banka satırları kilit öncesi/sonrası (kilitli dönem dahil toplam):", before, after);
  log("kilitli dönemde (≤04.10) satır özeti", JSON.stringify(store.all("SELECT e.date, e.type, e.status, COUNT(l.event_id) n FROM fin_events e LEFT JOIN bank_lines l ON l.event_id = e.id WHERE e.date <= '2026-10-04' GROUP BY e.id ORDER BY e.date")));
  log("mutabakat", (await integrityOf(api)).ok);
  await lockPeriod(api, "");
  log("=== ŞİRKET VERİSİNİ SIFIRLA (Tüm Hareketleri Sil)");
  const jobsBefore = store.all("SELECT kind, status FROM bank_jobs");
  const reset = await api.post("/api/companies/sirket-001/reset", { mode: "movements", confirm: "001", password: ADMIN_PASSWORD });
  log("sıfırla", r(reset));
  log("bank_jobs önce", JSON.stringify(jobsBefore), "sonra", JSON.stringify(store.all("SELECT kind, status, ref FROM bank_jobs")));
  log("kurulum geçmişi", JSON.stringify((await api.get(`${BANK}/setup`)).data).slice(0, 300));
  log("planlı işlemler", JSON.stringify((await api.get(`${BANK}/plans`)).data).slice(0, 300));
  log("hesaplar", JSON.stringify((await api.get(`${BANK}/accounts?status=all`)).data?.accounts?.map(a => [a.name, a.balanceMinor, a.opening?.amountMinor ?? null, a.policy])));
  log("fin_events / bank_lines / request_keys", store.get("SELECT COUNT(*) n FROM fin_events").n, store.get("SELECT COUNT(*) n FROM bank_lines").n, store.get("SELECT COUNT(*) n FROM request_keys").n);
  const runs = (await api.get(`${BANK}/setup`)).data?.runs || [];
  if (runs[0]) log("sıfırlamadan kalan kurulumu Geri Al", r(await api.post(`${BANK}/setup/${runs[0].id}/undo`, {})));
  const plans = (await api.get(`${BANK}/plans`)).data?.plans || [];
  if (plans[0]) log("sıfırlamadan kalan planı gerçekleştir", r(await api.post(`${BANK}/plans/${plans[0].id}/execute`, { expectedDate: plans[0].nextDate || plans[0].plannedDate })));
  log("mutabakat", (await integrityOf(api)).ok);
} finally {
  await ctx.server.close();
}
