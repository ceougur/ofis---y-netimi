// Sonda (10.10.2026, İş 3 — bulgu, DÜZELTİLMEDİ), ders "test verisi programın kendisinin ürettiği veridir". v2.0.24'e kadar çek/senet işlemi
// ileri tarihle girilebiliyordu (2.0.24 bulgu 2). v2.0.23'ün GERÇEK koduyla (git etiketi): alınan çek bankaya (Havale/EFT yolu) İLERİ TARİHLE tahsil
// edilir + geçmiş tarihli havale tahsilatı; aynı veri bu dalın koduyla açılır (v20 göçü), banka hesabı açılır; "Bu Hesaba Ata" ve Kurulum
// Sihirbazı (eski hareketleri aktar: tümü) denenir; Nakit Akış başlangıcı okunur.
// Çalıştırma (depo kökünden): node docs/kanit/2026-10-10/t4-nakit-akis/ileri-tarihli-eski-havale-v2023.mjs
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { CURRENT, bootVersion } from "../../../../test/guvenilirlik/surumler.mjs";

const root = mkdtempSync(path.join(tmpdir(), "ileri-havale-23-"));
const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
const pad = n => String(n).padStart(2, "0");
const day = offset => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const data = res => (res.data && typeof res.data === "object" && "ok" in res.data ? res.data.data : res.data);
try {
  const old = await bootVersion("v2.0.23", dirs);
  try {
    const api = await old.login();
    const party = data(await api.post("/api/workspace/accounts", { name: "Çekli Müşteri", type: "customer" }));
    const cheque = await api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: 1000, issueDate: day(-3), dueDate: day(10), serialNo: "IL-1", accountId: party.id });
    console.log("v2.0.23 çek alındı →", cheque.status);
    const collect = await api.post(`/api/workspace/cheques/${data(cheque).id}/actions`, { action: "collect", date: day(10), method: "bank", status: "portfolio" });
    console.log(`v2.0.23 çek bankaya İLERİ TARİHLE tahsil (${day(10)}) →`, collect.status, collect.data?.code || collect.error || "");
    const past = await api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: 250, date: day(-2), method: "bank" });
    console.log(`v2.0.23 geçmiş tarihli havale tahsilat (${day(-2)}) →`, past.status);
  } finally {
    await old.close();
  }
  // Gerçek kurulum koşulu (ders 14): üretimdeki gibi para yazımı denetimi ve kapı eşdeğerlik denetimi test kipinde DEĞİL.
  const now = await bootVersion(CURRENT, { ...dirs, moneyStrict: false, gateVerify: false });
  try {
    const api = await now.login();
    const account = await api.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: day(-5), amount: "10.000", confirmed: true } });
    console.log("güncel: hesap aç →", account.status);
    const legacy = await api.get("/api/workspace/bank/legacy");
    console.log("güncel: Hesabı Atanmamış →", legacy.data.rows.map(row => `${row.table} ${row.date} ${row.kind} ${row.amountMinor / 100} atanabilir=${row.assignable}`).join(" | "));
    const future = legacy.data.rows.find(row => row.date > day(0));
    if (future) {
      const one = await api.post("/api/workspace/bank/legacy/assign", { accountId: account.data.id, rows: [{ table: future.table, id: future.id }] });
      console.log("güncel: Bu Hesaba Ata (ileri tarihli) →", one.status, JSON.stringify(one.data).slice(0, 220));
    }
    const setup = await api.post("/api/workspace/bank/setup", { accountId: account.data.id, carryClose: true, assign: "all" });
    console.log("güncel: Kurulum Sihirbazı (tümü) →", setup.status, JSON.stringify(setup.data).slice(0, 220));
    const after = await api.get("/api/workspace/bank/legacy");
    console.log("güncel: sonra Hesabı Atanmamış satır:", after.data.rows.map(row => `${row.date} ${row.amountMinor / 100}`).join(" | ") || "yok");
    const flow = await api.get("/api/workspace/overview/nakit-akisi?preset=next30&table=0");
    const overview = await api.get("/api/workspace/overview");
    console.log("güncel: Nakit Akış başlangıç", flow.data.cashToday, "kırılım", JSON.stringify({ cash: flow.data.start.cash, realBank: flow.data.start.realBank, unassigned: flow.data.start.unassigned }), "ileri tarihli satır akışta:", flow.data.rows.filter(row => row.date > day(0) && row.source === "cash").map(row => `${row.date} ${row.direction} ${row.amount}`).join(", ") || "yok", "dönem sonu", flow.data.closing);
    console.log("güncel: ANLIK DURUM Nakit", overview.data.cash.balance, "Gerçek Banka", overview.data.cash.bank.balance, "Hesabı Atanmamış", overview.data.cash.bank.unassigned?.total);
  } finally {
    await now.close();
  }
} finally {
  rmSync(root, { recursive: true, force: true });
}
