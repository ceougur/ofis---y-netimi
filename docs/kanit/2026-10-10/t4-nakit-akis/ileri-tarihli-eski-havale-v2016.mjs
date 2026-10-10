// Sonda (10.10.2026, İş 3 — bulgu, DÜZELTİLMEDİ), ders "test verisi programın kendisinin ürettiği veridir": v2.0.16'nın GERÇEK koduyla (git
// etiketi) Kasa'ya ileri tarihli Havale/EFT ödemesi ve geçmiş tarihli havale girilir; aynı veri bu dalın koduyla açılır (v20 göçü), banka hesabı
// açılır, "Bu Hesaba Ata" ve Kurulum Sihirbazı (eski hareketleri aktar: tümü) denenir.
// Çalıştırma (depo kökünden): node docs/kanit/2026-10-10/t4-nakit-akis/ileri-tarihli-eski-havale-v2016.mjs
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { CURRENT, bootVersion } from "../../../../test/guvenilirlik/surumler.mjs";

const root = mkdtempSync(path.join(tmpdir(), "ileri-havale-"));
const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
const pad = n => String(n).padStart(2, "0");
const day = offset => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
try {
  const old = await bootVersion("v2.0.16", dirs);
  try {
    const api = await old.login();
    const ahead = await api.post("/api/workspace/cash", { kind: "out", amount: 1000, date: day(10), method: "bank", description: "Kira (havale, ileri tarihli)" });
    console.log(`v2.0.16 Kasa ileri tarihli Havale/EFT ödeme (${day(10)}) →`, ahead.status, ahead.data?.code || ahead.error || "");
    const past = await api.post("/api/workspace/cash", { kind: "in", amount: 250, date: day(-2), method: "bank", description: "Havale tahsilat" });
    console.log(`v2.0.16 Kasa geçmiş tarihli Havale/EFT tahsilat (${day(-2)}) →`, past.status, past.data?.code || past.error || "");
  } finally {
    await old.close();
  }
  const now = await bootVersion(CURRENT, dirs);
  try {
    const api = await now.login();
    const account = await api.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: day(-5), amount: "10.000", confirmed: true } });
    console.log("güncel: hesap aç →", account.status);
    const legacy = await api.get("/api/workspace/bank/legacy");
    console.log("güncel: Hesabı Atanmamış →", legacy.data.rows.map(row => `${row.date} ${row.kind} ${row.amountMinor / 100} atanabilir=${row.assignable}`).join(" | "));
    const future = legacy.data.rows.find(row => row.date > day(0));
    if (future) {
      const one = await api.post("/api/workspace/bank/legacy/assign", { accountId: account.data.id, rows: [{ table: future.table, id: future.id }] });
      console.log("güncel: Bu Hesaba Ata (ileri tarihli) →", one.status, one.code || "", String(one.error || "").slice(0, 170));
    }
    const setup = await api.post("/api/workspace/bank/setup", { accountId: account.data.id, carryClose: true, assign: "all" });
    console.log("güncel: Kurulum Sihirbazı (tümü) →", setup.status, setup.code || "", String(setup.error || "").slice(0, 170));
    const after = await api.get("/api/workspace/bank/legacy");
    console.log("güncel: sonra Hesabı Atanmamış satır:", after.data.rows.length);
    const flow = await api.get("/api/workspace/overview/nakit-akisi?preset=next30&table=0");
    console.log("güncel: Nakit Akış başlangıç", flow.data.cashToday, "kırılım", JSON.stringify({ cash: flow.data.start.cash, realBank: flow.data.start.realBank, unassigned: flow.data.start.unassigned }), "dönem sonu", flow.data.closing);
  } finally {
    await now.close();
  }
} finally {
  rmSync(root, { recursive: true, force: true });
}
