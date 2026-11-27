// 2.5.0 birleşik tur 6 — KORUMA (BAŞ MİMAR KARARI 11.11 03:34 "HIZ İNCELEMESİ" (4) KORUMA; soru değil): 2.5.0 yeni mutabakat denetimleri ekliyor; eski sürümlerin GERÇEK
// koduyla üretilmiş zincir fikstürleri (test/fixtures/surum-*; ders 17) bugünkü kodla açılınca açılıştaki taban sapmalarının HİÇBİRİ bir yazım ailesini (cari / para /
// kart / stok / çek / fatura) tam denetime düşürmemeli: kapının süzgeci (lib/integrity-scope.mjs) taban sapması olan aileye dokunan HER yazımı tam kapıya verir (100 bin
// satırda ~6 sn, olay döngüsü kilitli — hız incelemesinin kök nedeni ölçüm aracının bıraktığı sapmaydı; bu test eski MÜŞTERİ verisinin aynı duruma düşmediğini korur).
// Ailesiz (null: ileri tarihli eski satır, tanınmayan yol, işlem başlığı) ve satır bazlı (rows:<tablo> — yalnız o bozuk satıra dokunan yazım) sapmalar zararsızdır.
// Davranış da ölçülür: her şirkette bir cari Borç Yaz (party) ve bir Kasa Giriş (money:100) yazımının kapı yolu "scoped" (süzgeçli) olmalı.
// Tetikleyen fikstür çıkarsa ürün DÜZELTİLMEZ (ders 6: yeni denetim mi eski veri mi) — iletide fikstür adı, şirket ve sapma kodu yazar.
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { familyOf } from "../server/lib/integrity-scope.mjs";
import { FIXTURES, unpackFixture } from "./guvenilirlik/fikstur.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const NOW = "2026-11-11T12:00:00";
const ZINCIR = readdirSync(FIXTURES).filter(name => name.startsWith("surum-") && name !== "surum-nesneler").sort();
const zararsiz = family => family === null || family.startsWith("rows:");

describe("Koruma — eski sürüm fikstürleri bugünkü kodla açılınca taban sapması hiçbir yazım ailesini tam kapıya düşürmez", () => {
  it(`fikstür listesi taramayla bulundu (${ZINCIR.length}): ${ZINCIR.join(", ")}`, () => {
    assert.ok(ZINCIR.length >= 15, `beklenen ≥ 15 sürüm fikstürü (test/fixtures/surum-*); bulunan ${ZINCIR.length}`);
  });
  for (const name of ZINCIR) {
    it(`${name}: her şirkette taban sapmalarının ailesi zararsız; Borç Yaz ve Kasa Giriş süzgeçli yolda`, { timeout: 600_000 }, async () => {
      const fixture = unpackFixture(name);
      let server;
      try {
        server = await startTestServer({ dataDir: fixture.dataDir, backupDir: fixture.backupDir, now: { time: NOW, fixed: true }, gateVerify: false, moneyStrict: false });
        const api = await loginAdmin(server);
        const companies = (await api.get("/api/companies")).data?.data?.companies || (await api.get("/api/companies")).data?.companies || [];
        assert.ok(companies.length >= 1, `${name}: şirket listesi`);
        const table = [];
        for (const company of companies) {
          const q = `?hofCompany=${encodeURIComponent(company.id)}`;
          // 2.5.0 Ç5-A tur 1d (İş D; ders 6, 20; C5-ACILIS-TASARIM §14): kilitli fikstürde açılışın bekleyen 2.4.9 dondurması arkada biter; bitince "Kural Değişikliği Farkı"
          // Mutabakat Testi'nde UYARI olarak görünür. Okumalar dondurmanın bitişinin iki yanına düşünce test ara sıra kırmızıydı (zorla: DONDURMA_YARIS=bitir
          // test/b7-dondurma-yaris-zorla.mjs — 'ledger:rule-diff→all'). Ön koşul ÜRÜNÜN DURUMUNDAN: şirket açılır, bekleyen dondurma (varsa) SINIRLI beklenir.
          assert.equal((await api.get(`/api/workspace/ledger/lock${q}`)).status, 200, `${name} ${company.code}: şirket açılmalı`);
          const child = company.code === "001" || !server.app.openCompany(company.id) ? server.app : server.app.openCompany(company.id);
          let timer = null;
          await Promise.race([child.ledger.snapshots.runPending(), new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`${name} ${company.code}: bekleyen dondurma 120 sn'de bitmedi ${JSON.stringify(child.ledger.snapshots.state())}`)), 120_000);
            timer.unref?.();
          })]).finally(() => clearTimeout(timer));
          assert.equal(child.ledger.snapshots.state().pending, null, `${name} ${company.code}: ön koşul — bekleyen dondurma kalmadı`);
          const integrity = await api.get(`/api/workspace/ledger/integrity${q}`);
          const result = integrity.data?.ok === true ? integrity.data.data : integrity.data;
          assert.equal(integrity.status, 200, `${name} ${company.code}: Mutabakat Testi ${integrity.status}`);
          // Taban = ürünün sapma kümesi (lib/integrity.mjs driftsOf): uyarı (notice) ve Ç5-A tur 1d'den kural farkı (uyarıdır, sapma değil — kapının tabanına / ailesine girmez).
          // Davranış yine aşağıda ölçülür: kural farkı olan şirkette de Borç Yaz ve Kasa Giriş süzgeçli yolda kalmalı.
          const drifts = (result.failures || []).filter(item => !item.notice && item.code !== "ledger:rule-diff").map(item => ({ code: item.code, family: familyOf(item.code) }));
          const paths = {};
          const account = child.store.get("SELECT id FROM accounts WHERE deleted_at IS NULL ORDER BY rowid LIMIT 1")?.id;
          if (account) {
            const debt = await api.post(`/api/workspace/accounts/${encodeURIComponent(account)}/entries${q}`, { kind: "debt", amount: "1", note: "koruma", date: NOW.slice(0, 10), similarOk: true, force: true });
            paths.borcYaz = debt.status === 200 ? `${child.integrity.stats().gate?.path}${child.integrity.stats().gate?.reason ? ` (${child.integrity.stats().gate.reason})` : ""}` : `yazılamadı ${debt.status} ${debt.data?.code || ""}`;
          }
          const cash = await api.post(`/api/workspace/cash${q}`, { kind: "in", amount: "1", method: "cash", description: "koruma", date: NOW.slice(0, 10), cashForce: true, similarOk: true, force: true });
          paths.kasaGiris = cash.status === 200 ? `${child.integrity.stats().gate?.path}${child.integrity.stats().gate?.reason ? ` (${child.integrity.stats().gate.reason})` : ""}` : `yazılamadı ${cash.status} ${cash.data?.code || ""}`;
          table.push({ sirket: company.code, kuralFarki: (result.failures || []).some(item => item.code === "ledger:rule-diff"), sapmalar: drifts.map(item => `${item.code}→${item.family ?? "ailesiz"}`), zararli: drifts.filter(item => !zararsiz(item.family)).map(item => `${item.code}→${item.family}`), yol: paths });
        }
        console.log(`# ${name}: ${JSON.stringify(table)}`);
        for (const row of table) {
          assert.deepEqual(row.zararli, [], `${name} ${row.sirket}: tam kapıyı tetikleyen taban sapması (DÜZELTME — raporla): ${row.zararli.join(", ")}`);
          for (const [kind, value] of Object.entries(row.yol)) assert.ok(value === "scoped" || value.startsWith("yazılamadı"), `${name} ${row.sirket} ${kind}: kapı yolu ${value}`);
        }
      } finally {
        await server?.close();
        fixture.cleanup();
      }
    });
  }
});
