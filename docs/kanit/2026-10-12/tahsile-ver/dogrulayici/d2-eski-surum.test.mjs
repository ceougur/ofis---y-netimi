// Bağımsız doğrulayıcı (tur 1) — eski sürüme dönüş (GERÇEK v2.1.0 kodu, git etiketi) ile tahsildeki evraka dokunma; sonra bu dal açılır.
// Uygulayıcının testi yalnız "v2.1.0'da ciro (tahsile verme gününden SONRA)" yolunu deniyor; burada öbür yollar:
//   O1 v2.1.0'da tahsile verme gününden ÖNCEKİ tarihle ciro       O2 v2.1.0'da tahsildeki evrakın TUTARI değişir
//   O3 v2.1.0'da tahsile verme gününden önceki tarihle tahsil       O4 v2.1.0'da tahsildeki evrak silinir
//   O5 v2.1.0'da alış tarihi tahsile verme gününden sonraya alınır  O6 v2.1.0'da tahsil hesabı pasife alınır
// Her senaryoda: onarım (h) sonrası kayıt durumu, 101.01/101.02, Mutabakat Testi, ve kullanıcı bir yazım yapabiliyor mu.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { subBalances as journalSubs } from "../../../../../server/lib/general-ledger.mjs";
import { apiOf, integrityOf } from "../../../../../test/banka-210-ortak.mjs";
import { CURRENT, bootVersion, tagsAvailable } from "../../../../../test/guvenilirlik/surumler.mjs";

const CHEQUES = "/api/workspace/cheques";
const BANK = "/api/workspace/bank";
const OLD = "v2.1.0";
const log = (label, value) => console.log(`[d2] ${label}: ${JSON.stringify(value)}`);
const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 400)}`);
  return res.data;
};
const short = res => ({ status: res.status, code: res.code ?? res.data?.code, error: res.error ?? res.data?.error });

async function scenario(name, oldStep, { check } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), `dogrulayici-d2-${name}-`));
  const dataDir = path.join(root, "data");
  const backupDir = path.join(root, "backups");
  const out = { name };
  try {
    let ids;
    {
      const server = await bootVersion(CURRENT, { dataDir, backupDir, now: "2026-10-08T12:00:00+03:00" });
      try {
        const api = apiOf((await server.login()).client);
        const account = await must("hesap", api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", opening: { date: "2026-10-01", amount: "1.000", confirmed: true } }));
        const buyer = await must("müşteri", api.post("/api/workspace/accounts", { name: "Eski Müşteri", type: "customer", registeredOn: "2026-09-01" }));
        const seller = await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Eski Tedarikçi", type: "supplier", registeredOn: "2026-09-01" }));
        const cheque = await must("çek", api.post(CHEQUES, { direction: "in", instrument: "cheque", amount: "800", issueDate: "2026-10-03", dueDate: "2026-11-05", accountId: buyer.id, serialNo: `ES-${name}` }));
        await must("tahsile", api.post(`${CHEQUES}/${cheque.id}/actions`, { action: "bank-deposit", date: "2026-10-06", bankAccountId: account.id }));
        ids = { cheque: cheque.id, seller: seller.id, account: account.id };
      } finally {
        await server.close();
      }
    }
    {
      const old = await bootVersion(OLD, { dataDir, backupDir, now: "2026-10-09T12:00:00+03:00" });
      try {
        const api = apiOf((await old.login()).client);
        out.old = await oldStep(api, ids);
      } finally {
        await old.close();
      }
    }
    const server = await bootVersion(CURRENT, { dataDir, backupDir, now: "2026-10-09T12:00:00+03:00" });
    try {
      const api = apiOf((await server.login()).client);
      out.record = server.app.store.all("SELECT status, given_date AS given, closed_date AS closed FROM cheque_collections WHERE cheque_id = ?", ids.cheque).map(row => ({ ...row }));
      const subs = journalSubs(server.app.ledger.build());
      out.subs = { "101.01": (subs.get("101.01") || 0) / 100, "101.02": (subs.get("101.02") || 0) / 100 };
      const result = await integrityOf(api);
      out.integrity = { ok: result.ok, bad: (result.checks || []).filter(item => item.ok === false).map(item => ({ code: item.code, sample: (item.sample || []).slice(0, 3) })) };
      // Kullanıcı yeni sürümde çalışmaya devam edebiliyor mu: yeni bir çek alıp tahsile ver.
      const buyer2 = await api.post("/api/workspace/accounts", { name: `Yeni Müşteri ${name}`, type: "customer", registeredOn: "2026-09-01" });
      out.writeAfter = short(buyer2);
      if (check) out.extra = await check(api, ids, server);
      out.integrityAfterWrite = (await integrityOf(api)).ok;
    } finally {
      await server.close();
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  log(name, out);
  return out;
}

const skip = tagsAvailable([OLD]) ? false : `${OLD} etiketi yok`;
describe(`D2 — ${OLD}'a dönüp tahsildeki evraka dokunma, sonra bu dal`, { skip }, () => {
  it("O1 v2.1.0'da tahsile verme gününden (06.10) ÖNCEKİ tarihle (05.10) ciro", { timeout: 300_000 }, async () => {
    const out = await scenario("o1", async (api, ids) => short(await api.post(`${CHEQUES}/${ids.cheque}/actions`, { action: "endorse", date: "2026-10-05", accountId: ids.seller })));
    assert.equal(out.old.status, 200, "eski sürüm ciroyu kabul etmeli (senaryo kuruldu)");
    assert.equal(out.integrity.ok, true, `onarım sonrası Mutabakat Testi bozuk: ${JSON.stringify(out.integrity.bad)}`);
  });

  it("O2 v2.1.0'da tahsildeki evrakın tutarı 800 → 950", { timeout: 300_000 }, async () => {
    const out = await scenario("o2", async (api, ids) => short(await api.put(`${CHEQUES}/${ids.cheque}`, { amount: "950" })), {
      check: async (api, ids) => {
        const withdraw = await api.post(`${CHEQUES}/${ids.cheque}/actions`, { action: "bank-withdraw", date: "2026-10-09" });
        return { withdraw: short(withdraw), integrityAfterWithdraw: (await integrityOf(api)).ok };
      },
    });
    assert.equal(out.old.status, 200, "eski sürüm tutar değişikliğini kabul etmeli (senaryo kuruldu)");
    assert.equal(out.integrity.ok, true, `açılışta Mutabakat Testi bozuk: ${JSON.stringify(out.integrity.bad)}`);
  });

  it("O3 v2.1.0'da tahsile verme gününden ÖNCEKİ tarihle (05.10) bankaya tahsil", { timeout: 300_000 }, async () => {
    const out = await scenario("o3", async (api, ids) => short(await api.post(`${CHEQUES}/${ids.cheque}/actions`, { action: "collect", date: "2026-10-05", method: "bank", bankAccountId: ids.account })));
    assert.equal(out.old.status, 200, "eski sürüm tahsili kabul etmeli (senaryo kuruldu)");
    assert.equal(out.integrity.ok, true, `onarım sonrası Mutabakat Testi bozuk: ${JSON.stringify(out.integrity.bad)}`);
  });

  it("O4 v2.1.0'da tahsildeki evrak silinir", { timeout: 300_000 }, async () => {
    const out = await scenario("o4", async (api, ids) => short(await api.del(`${CHEQUES}/${ids.cheque}`)), {
      check: async (api, ids) => {
        // Kullanıcı yeni sürümde çalışmayı sürdürür: yeni çek al → tahsile ver → tahsil; sapma kalıcı mı, yazımı engelliyor mu?
        const buyer = await api.post("/api/workspace/accounts", { name: "O4 Müşteri", type: "customer", registeredOn: "2026-09-01" });
        const cheque = await api.post(CHEQUES, { direction: "in", instrument: "cheque", amount: "300", issueDate: "2026-10-09", dueDate: "2026-11-09", accountId: buyer.data.id, serialNo: "O4-YENI" });
        const deposit = await api.post(`${CHEQUES}/${cheque.data.id}/actions`, { action: "bank-deposit", date: "2026-10-09", bankAccountId: ids.account });
        const collect = await api.post(`${CHEQUES}/${cheque.data.id}/actions`, { action: "collect", date: "2026-10-09" });
        const result = await integrityOf(api);
        return { cheque: short(cheque), deposit: short(deposit), collect: short(collect), integrityStill: result.ok, bad: (result.checks || []).filter(item => item.ok === false).map(item => item.code) };
      },
    });
    assert.equal(out.old.status, 200);
    assert.equal(out.integrity.ok, true, `onarım sonrası Mutabakat Testi bozuk: ${JSON.stringify(out.integrity.bad)}`);
  });

  it("O5 v2.1.0'da alış tarihi 03.10 → 08.10 (tahsile verme gününden sonraya)", { timeout: 300_000 }, async () => {
    const out = await scenario("o5", async (api, ids) => short(await api.put(`${CHEQUES}/${ids.cheque}`, { issueDate: "2026-10-08" })));
    assert.equal(out.old.status, 200);
    assert.equal(out.integrity.ok, true, `açılışta Mutabakat Testi bozuk: ${JSON.stringify(out.integrity.bad)}`);
  });

  it("O6 v2.1.0'da tahsil hesabı pasife alınır; bu dalda tahsil ve geri alma", { timeout: 300_000 }, async () => {
    const out = await scenario("o6", async (api, ids) => short(await api.post(`${BANK}/accounts/${ids.account}/status`, { status: "passive" })), {
      check: async (api, ids) => {
        const collect = await api.post(`${CHEQUES}/${ids.cheque}/actions`, { action: "collect", date: "2026-10-09" });
        const withdraw = collect.status === 200 ? null : await api.post(`${CHEQUES}/${ids.cheque}/actions`, { action: "bank-withdraw", date: "2026-10-09" });
        return { collect: short(collect), withdraw: withdraw && short(withdraw) };
      },
    });
    log("o6 sonuç", out.extra);
    assert.equal(out.integrity.ok, true, `açılışta Mutabakat Testi bozuk: ${JSON.stringify(out.integrity.bad)}`);
  });
});
