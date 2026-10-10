// 2.1.0 — Aşama 3 (Banka Hesapları), dilim 1: Banka Ayarları API'si (docs/BANKA-MODULU-PLAN.md §8.11, §5.4, Ek A; kullanıcı kararı: "arayüz
// içinden çıkılmaz olmasın — Temel ve Gelişmiş bölümleri, standartlar seçili gelir, Varsayılanlara Dön").
//
// ÇALIŞIYOR MU:
//   - İlk açılışta bütün ayarlar varsayılan (standart) değerde: Eksi Bakiye Uyar, Benzer İşlem Uyarısı Açık, Valör İş Günü 1, Banka Masrafı
//     Vergisi BSMV Dahil, masraf türleri 770/653, hesap eşlemeleri 770 · 653 · 642 · 780 · 646 · 656 · 649 · 659, İşlem No Öneki BNK.
//   - Bölümler Temel (açık) ve Gelişmiş (kapalı); her ad başlık yazımıyla; değiştirilen ayar okunur, hesap kartının etkin politikasına yansır.
//   - Varsayılanlara Dön: bölüm bölüm ve tümü; işlem geçmişine önceki ve yeni değerle yazılır.
//   - İşlem No Öneki değişince yeni İşlem No o önekle başlar; varsayılana dönünce BNK.
// NASIL BOZARIM:
//   - Tanınmayan seçenek / anahtar / bölüm, aralık dışı sayı → 400 bank-setting.
//   - Beyaz liste dışı hesap kodu (masrafa 191, gelire 120; Kambiyo Kârı'na 656) → 400 bank-gl-forbidden; 102/108/300/309/500 eşlemesi
//     değiştirilemez → 400 bank-gl-forbidden.
//   - Varsayılan hesap olarak döviz/kart hesabı → 400; silinen hesabın kimliği varsayılan olarak okunmaz (boş sayılır).
//   - Ayarı görme bank.view, değiştirme bank.settings ister: avukat değiştiremez (403), personel göremez (403).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { titleCase } from "../server/lib/text-case.mjs";
import { apiOf } from "./banka-210-ortak.mjs";
import { createUser } from "./helpers.mjs";
import { BANK, bootBank, expectStatus, must, openAccount } from "./banka-210-hesap-ortak.mjs";

describe("Aşama 3 — Banka Ayarları", () => {
  let ctx;
  before(async () => {
    ctx = await bootBank({ fxEnabled: true, bankLater: true }); // bankLater: gizli (sonraki sürümün) ayarlarının doğrulaması da sınanır
  });
  after(() => ctx.server.close());

  it("varsayılanlar (standartlar seçili), Temel/Gelişmiş bölümleri, adlar başlık yazımıyla", async () => {
    const settings = await must("ayarlar", ctx.api.get(`${BANK}/settings`));
    assert.deepEqual(settings.values, settings.defaults, "ilk açılışta her ayar varsayılan");
    const v = settings.values;
    assert.equal(v.negative.policy, "warn");
    assert.equal(v.similar.enabled, true);
    assert.equal(v.pos.valorRule, "business");
    assert.equal(v.pos.valorDays, 1);
    assert.equal(v.pos.taxMode, "by_provider");
    assert.equal(v.pos.refundCommission, "none");
    assert.equal(v.fee.tax, "bsmv_incl");
    assert.deepEqual(new Set(v.fee.types.map(type => type.gl)), new Set(["770", "653"]));
    assert.ok(v.fee.types.some(type => type.name === "EFT" && type.gl === "770"));
    assert.ok(v.fee.types.some(type => type.name === "POS Komisyonu" && type.gl === "653"));
    assert.equal(v.fx.source, "tcmb");
    assert.equal(v.fx.invoiceSuggest, true);
    assert.equal(v.posAdvanced.settlement, "auto");
    assert.equal(v.posAdvanced.installmentPayout, "monthly");
    assert.equal(v.statement.toleranceDays, 3);
    assert.equal(v.statement.autoConfirmStrong, false);
    assert.deepEqual(v.gl, { fee: "770", commission: "653", interestIncome: "642", interestExpense: "780", fxGain: "646", fxLoss: "656", otherIncome: "649", otherExpense: "659" });
    assert.equal(v.other.eventPrefix, "BNK");
    assert.equal(v.other.manualVoucher, false);
    const levels = new Set(settings.sections.map(section => section.level));
    assert.deepEqual(levels, new Set(["basic", "advanced"]));
    assert.ok(settings.sections.filter(section => section.level === "basic").some(section => section.id === "negative"));
    assert.ok(settings.sections.filter(section => section.level === "advanced").some(section => section.id === "gl"));
    const labels = [];
    for (const section of settings.sections) {
      labels.push(section.label);
      for (const item of section.items) {
        labels.push(item.label);
        for (const [, label] of item.options || []) labels.push(label);
      }
    }
    const wrong = labels.filter(label => titleCase(label) !== label);
    assert.deepEqual(wrong, [], "ayar adları ve seçenekleri başlık yazımıyla");
    const fixed = settings.sections.find(section => section.id === "gl").items.filter(item => item.type === "fixed").map(item => item.value);
    assert.deepEqual(fixed.sort(), ["102", "108", "300", "309", "500"], "sabit eşlemeler görünür ama değiştirilemez");
  });

  it("değiştir → okunur ve hesap kartına yansır; Varsayılanlara Dön (bölüm ve tümü); işlem geçmişi önceki/yeni", async () => {
    const account = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "100", confirmed: true } });
    assert.equal(account.policy, "warn");
    const updated = await must("değiştir", ctx.api.put(`${BANK}/settings`, { values: { negative: { policy: "block" }, statement: { toleranceDays: 5 }, gl: { fee: "653" } } }));
    assert.equal(updated.values.negative.policy, "block");
    assert.equal(updated.values.statement.toleranceDays, 5);
    // GG2: Banka Masrafları eşlemesi yalnız 770 ya da 653 (faturalı masrafın gider kalemi; ayrıntı banka-210-gg2-fis).
    assert.equal(updated.values.gl.fee, "653");
    assert.equal(updated.values.similar.enabled, true, "değiştirilmeyen ayar korunur");
    assert.equal((await must("hesap", ctx.api.get(`${BANK}/accounts/${account.id}`))).policy, "block", "hesap politikası ayardan");
    const reset = await must("bölüm varsayılan", ctx.api.post(`${BANK}/settings/reset`, { section: "negative" }));
    assert.equal(reset.values.negative.policy, "warn");
    assert.equal(reset.values.statement.toleranceDays, 5, "başka bölüm etkilenmez");
    const all = await must("tümü varsayılan", ctx.api.post(`${BANK}/settings/reset`, {}));
    assert.deepEqual(all.values, all.defaults);
    const advanced = await must("gelişmiş varsayılan", ctx.api.post(`${BANK}/settings/reset`, { level: "advanced" }));
    assert.deepEqual(advanced.values, advanced.defaults);
    const audit = await must("işlem geçmişi", ctx.api.get("/api/admin/audit?type=bank.settings"));
    const updatedEvent = audit.find(event => event.type === "bank.settings.updated");
    assert.ok(updatedEvent, JSON.stringify(audit.map(event => event.type)));
    const payload = updatedEvent.details || updatedEvent.payload || updatedEvent.data || {};
    assert.equal(payload.previous?.negative?.policy, "warn", JSON.stringify(updatedEvent).slice(0, 400));
    assert.equal(payload.next?.negative?.policy, "block");
    assert.ok(audit.some(event => event.type === "bank.settings.reset"));
  });

  it("nasıl bozarım: tanınmayan değer/anahtar/bölüm, aralık dışı, beyaz liste dışı hesap, sabit eşleme → 400", async () => {
    const bad = [
      [{ negative: { policy: "maybe" } }, "bank-setting"],
      [{ negative: { colour: "red" } }, "bank-setting"],
      [{ nonsense: { a: 1 } }, "bank-setting"],
      [{ statement: { toleranceDays: 11 } }, "bank-setting"],
      [{ pos: { valorDays: -1 } }, "bank-setting"],
      [{ similar: { enabled: "evet" } }, "bank-setting"],
      [{ gl: { fee: "191" } }, "bank-gl-forbidden"],
      [{ gl: { otherIncome: "120" } }, "bank-gl-forbidden"],
      [{ gl: { fxGain: "656" } }, "bank-gl-forbidden"],
      [{ gl: { bank: "100" } }, "bank-gl-forbidden"],
      [{ gl: { opening: "501" } }, "bank-gl-forbidden"],
      [{ fee: { types: [{ key: "eft", name: "EFT", gl: "191" }] } }, "bank-gl-forbidden"],
      [{ other: { eventPrefix: "bn-1" } }, "bank-setting"],
    ];
    for (const [values, code] of bad) expectStatus(await ctx.api.put(`${BANK}/settings`, { values }), 400, code, JSON.stringify(values));
    expectStatus(await ctx.api.post(`${BANK}/settings/reset`, { section: "yok" }), 400, "bank-setting", "tanınmayan bölüm");
    const settings = await must("ayarlar", ctx.api.get(`${BANK}/settings`));
    assert.deepEqual(settings.values, settings.defaults, "reddedilen istek ayar değiştirmez");
  });

  it("varsayılan tahsilat hesabı: döviz/kart hesabı 400; silinen hesabın kimliği okunmaz", async () => {
    const usd = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "USD", currency: "USD", kind: "fx", opening: { date: "2026-10-01", amount: "0" } });
    expectStatus(await ctx.api.put(`${BANK}/settings`, { values: { account: { defaultAccountId: usd.id } } }), 400, "bank-account-invalid", "döviz hesabı varsayılan");
    expectStatus(await ctx.api.put(`${BANK}/settings`, { values: { account: { defaultAccountId: "bacc-yok" } } }), 400, "bank-account-invalid", "olmayan hesap");
    const spare = await openAccount(ctx.api, { bankName: "Garanti BBVA", name: "Yedek", kind: "demand", opening: { date: "2026-10-01", amount: "0" } });
    await must("varsayılan", ctx.api.put(`${BANK}/settings`, { values: { account: { defaultAccountId: spare.id } } }));
    assert.equal((await must("seçici", ctx.api.get(`${BANK}/choices`))).forms.bank.defaultId, spare.id);
    await must("sil", ctx.api.del(`${BANK}/accounts/${spare.id}`));
    const settings = await must("ayarlar", ctx.api.get(`${BANK}/settings`));
    assert.equal(settings.values.account.defaultAccountId, "", "silinen hesap varsayılan sayılmaz");
    assert.notEqual((await must("seçici", ctx.api.get(`${BANK}/choices`))).forms.bank.defaultId, spare.id);
  });

  it("İşlem No Öneki: değişince yeni İşlem No o önekle; varsayılana dönünce BNK", async () => {
    await must("önek", ctx.api.put(`${BANK}/settings`, { values: { other: { eventPrefix: "ZRT" } } }));
    const account = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "Önek Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "10" } });
    assert.match(account.opening.no, /^ZRT-2026-\d{6}$/);
    await must("varsayılan", ctx.api.post(`${BANK}/settings/reset`, { section: "other" }));
    const next = await must("düzelt", ctx.api.post(`${BANK}/accounts/${account.id}/opening`, { date: "2026-10-01", amount: "20" }));
    assert.match(next.account.opening.no, /^BNK-2026-\d{6}$/);
  });

  it("yetki: avukat görür ama değiştiremez (403); personel göremez (403)", async () => {
    const lawyer = apiOf(await createUser(ctx.server, ctx.api.client, { username: "avukat1", role: "avukat" }));
    await must("avukat görür", lawyer.get(`${BANK}/settings`));
    expectStatus(await lawyer.put(`${BANK}/settings`, { values: { negative: { policy: "off" } } }), 403, "FORBIDDEN", "avukat değiştiremez");
    expectStatus(await lawyer.post(`${BANK}/settings/reset`, {}), 403, "FORBIDDEN", "avukat varsayılana dönemez");
    const staff = apiOf(await createUser(ctx.server, ctx.api.client, { username: "personel2", role: "personel" }));
    expectStatus(await staff.get(`${BANK}/settings`), 403, "FORBIDDEN", "personel göremez");
  });
});
