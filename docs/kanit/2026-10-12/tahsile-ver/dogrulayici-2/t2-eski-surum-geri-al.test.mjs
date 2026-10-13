// Bağımsız doğrulayıcı (tur 2) — GERÇEK v2.1.0 koduna dönüp tahsildeki evrakın BANKA HESABINA dokunma (tur 1 D1/D2 yalnız evraka dokundu).
// v2.1.0 tahsil kaydını bilmez: hesabın açılış tarihini veriliş gününden sonraya alma, hesabı silme, pasife alma, türünü Vadeli yapma.
// Bu dal yeniden açılınca: açılış onarımı (h) sonrası Mutabakat Testi, kaydın durumu, Tahsil Edildi ve Bankadan Geri Al.
// Koşum (worktree kökünden): node --test --test-concurrency=1 docs/kanit/2026-10-12/tahsile-ver/dogrulayici-2/t2-eski-surum.test.mjs
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { apiOf, integrityOf } from "../../../../../test/banka-210-ortak.mjs";
import { BANK, must } from "../../../../../test/banka-210-hesap-ortak.mjs";
import { CURRENT, bootVersion, tagsAvailable } from "../../../../../test/guvenilirlik/surumler.mjs";

const CHEQUES = "/api/workspace/cheques";
const act = (api, id, body) => api.post(`${CHEQUES}/${id}/actions`, body);
const log = (label, value) => console.log(`[t2-eski] ${label}: ${JSON.stringify(value)}`);
const OLD = "v2.1.0";

async function scenario(name, oldStep, newStep = null) {
  const root = mkdtempSync(path.join(tmpdir(), `tahsile-tur2-${name}-`));
  const dataDir = path.join(root, "data");
  const backupDir = path.join(root, "backups");
  try {
    let ids;
    {
      const server = await bootVersion(CURRENT, { dataDir, backupDir, now: "2026-10-08T12:00:00+03:00" });
      try {
        const api = apiOf((await server.login()).client);
        const account = await must("hesap", api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Çek Tahsil", kind: "demand", currency: "TRY", opening: { date: "2026-10-01", amount: "0", confirmed: true } }));
        const buyer = await must("müşteri", api.post("/api/workspace/accounts", { name: "Eski Müşteri", type: "customer", registeredOn: "2026-09-01" }));
        const cheque = await must("çek", api.post(CHEQUES, { direction: "in", instrument: "cheque", amount: "800", issueDate: "2026-10-03", dueDate: "2026-11-05", accountId: buyer.id, serialNo: `ES-${name}` }));
        await must("tahsile", act(api, cheque.id, { action: "bank-deposit", date: "2026-10-06", bankAccountId: account.id }));
        ids = { cheque: cheque.id, account: account.id, buyer: buyer.id };
        if (newStep) log(`${name} yeni sürüm ön adım`, { status: (await newStep(api, ids)).status });
        log(`${name} ön adım sonrası kayıt`, server.app.store.get("SELECT status FROM cheque_collections WHERE cheque_id = ?", ids.cheque));
      } finally {
        await server.close();
      }
    }
    {
      const old = await bootVersion(OLD, { dataDir, backupDir, now: "2026-10-09T12:00:00+03:00" });
      try {
        const res = await oldStep(apiOf((await old.login()).client), ids);
        log(`${name} eski sürüm adımı`, { status: res.status, code: res.code, error: res.error });
      } finally {
        await old.close();
      }
    }
    const server = await bootVersion(CURRENT, { dataDir, backupDir, now: "2026-10-09T12:00:00+03:00" });
    try {
      const api = apiOf((await server.login()).client);
      const store = server.app.store;
      log(`${name} hesap`, store.get("SELECT status, kind, opening_date AS opening, deleted_at IS NOT NULL AS deleted FROM bank_accounts WHERE id = ?", ids.account));
      log(`${name} kayıt (onarım sonrası)`, store.get("SELECT status, given_date AS given, closed_date AS closed FROM cheque_collections WHERE cheque_id = ?", ids.cheque));
      const repair = store.setting ? store.setting("bank.repair", "") : "";
      log(`${name} onarım özeti`, String(repair || "").slice(0, 400));
      const result = await integrityOf(api);
      log(`${name} Mutabakat`, { ok: result.ok, bad: result.checks.filter(item => !item.ok).map(item => [item.code, item.sample]) });
      const detail = await api.get(`${CHEQUES}/${ids.cheque}`);
      log(`${name} çek kartı`, { statusLabel: detail.data?.statusLabel, bankActions: detail.data?.bankActions, actions: detail.data?.actions?.map(a => a.key) });
      log(`${name} çek durumu`, store.get("SELECT status FROM cheques WHERE id = ?", ids.cheque));
      const collect = await act(api, ids.cheque, { action: "collect", date: "2026-10-09" });
      log(`${name} Tahsil Edildi`, { status: collect.status, code: collect.code, error: collect.error });
      if (collect.status !== 200) {
        const withdraw = await act(api, ids.cheque, { action: "bank-withdraw", date: "2026-10-09" });
        log(`${name} Bankadan Geri Al`, { status: withdraw.status, code: withdraw.code, error: withdraw.error });
      }
      // Başka bir evrak: aynı şirkette sonraki yazım sürer mi?
      const other = await api.post(CHEQUES, { direction: "in", instrument: "cheque", amount: "300", issueDate: "2026-10-09", dueDate: "2026-11-09", accountId: ids.buyer, serialNo: `YENI-${name}` });
      log(`${name} sonra yeni çek`, { status: other.status, code: other.code, error: other.error });
      const after = await integrityOf(api);
      log(`${name} Mutabakat son`, { ok: after.ok, bad: after.checks.filter(item => !item.ok).map(item => [item.code, item.sample]) });
    } finally {
      await server.close();
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe(`${OLD}'a dönüp tahsildeki evrakın KAPANIŞINI geri alma`, { skip: tagsAvailable([OLD]) ? false : `${OLD} etiketi yok` }, () => {
  it("E5 yeni sürümde tahsil (07.10) → v2.1.0'da tahsili Geri Al", { timeout: 300_000 }, async () => {
    await scenario("tahsil-geri", (api, ids) => api.post(`${CHEQUES}/${ids.cheque}/undo`, {}), (api, ids) => act(api, ids.cheque, { action: "collect", date: "2026-10-07" }));
  });
  it("E6 yeni sürümde karşılıksız (07.10) → v2.1.0'da karşılıksızı Geri Al", { timeout: 300_000 }, async () => {
    await scenario("karsiliksiz-geri", (api, ids) => api.post(`${CHEQUES}/${ids.cheque}/undo`, {}), (api, ids) => act(api, ids.cheque, { action: "bounce", date: "2026-10-07" }));
  });
});
