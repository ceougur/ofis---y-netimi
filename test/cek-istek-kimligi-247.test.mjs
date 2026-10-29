// 2.4.7 — çek / senet girişinde kalıcı istek kimliği (M5 bağımsız kâhininin yan bulgusu; ORTA, para yolu).
// BULGU: POST /api/workspace/cheques istek kimliği almıyordu; aynı istek (bağlantı kopunca istemcinin yeniden denemesi, yanıt gecikince yeniden
// "Portföye Al") iki kez gelince İKİ evrak açılıyor, carinin borcu iki kez düşüyor, 101/121 iki kez artıyor, taksite sayılan evrak taksiti iki kez
// ödüyordu. Seri numaralı evrakta ikinci istek "zaten kayıtlı" (cheque-duplicate) sorusuna düşüyor, "Yine de Kaydet" ikinci evrakı açıyordu.
// KURAL (öbür para uçlarıyla AYNI düzen — routes/accounts.mjs entries, plans, stock, bank: bank.post requestId + scope; lib/idempotency.mjs, plan §3.10/1):
//  - kimlik x-hof-request başlığında (ya da gövdede requestId); anahtar kullanıcı | "cheque.create" | kimlik, şirketin veri tabanında (request_keys),
//    yazımla AYNI işlemde; 30 gün;
//  - aynı kimlik + aynı içerik → ikinci evrak yok, ilk evrakın kartı döner (replayed: true); aynı kimlik + farklı içerik → 409 request-id-reused;
//  - yalnız başarılı sonuç saklanır (reddedilen istek ve cheque-duplicate sorusu kimlik bırakmaz); kimliksiz istek eskisi gibi serbest;
//  - başka kullanıcının ve başka şirketin aynı kimliği ayrıdır; sunucu yeniden başlasa da hatırlanır; yedekten geri yükleme request_keys'i de geri getirir.
// NASIL BOZULUR (testler buradan): yanıt kaybolur + yeniden gönderilir (sıralı ve aynı anda), gönderim arasında form değişir, seri no'lu evrakta
// "zaten kayıtlı" sorusu, taksite sayılan evrak, ileri tarih reddi sonrası düzeltip yeniden gönderme, evrak silinip aynı kimlikle yeniden gönderme,
// sunucu yeniden başlatma, iki kullanıcı, iki şirket, yedek → yaz → geri yükle → yeniden gönder.
// Kırmızı kanıt: eski kod (ayrı kopya) docs/kanit/2026-10-29/cek-istek-kimligi-247-eski-*.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { ADMIN_PASSWORD, createUser, loginAdmin, startTestServer } from "./helpers.mjs";
import { apiOf, integrityOk, must, unwrap } from "./banka-210-ortak.mjs";
import { expectStatus, trialBalances } from "./banka-210-hesap-ortak.mjs";

const NOW = "2026-10-08T12:00:00+03:00";
const CHEQUES = "/api/workspace/cheques";
const ACC = "/api/workspace/accounts";
const PLANS = "/api/workspace/plans";
const RID = suffix => `cek-istek-247-${suffix}-0123456789`;
const send = (client, body, requestId) => client.post(CHEQUES, body, requestId ? { "x-hof-request": requestId } : undefined).then(unwrap);
const evrak = extra => ({ direction: "in", instrument: "cheque", amount: "1.000", issueDate: "2026-10-05", dueDate: "2026-12-31", bank: "Ziraat", ...extra });

/** Bir carinin evrak sayısı, evraktan doğan cari satırı sayısı ve bakiyesi; mizanda 101 / 121 / 100. */
async function snapshot(ctx, accountId) {
  const card = await must("cari kartı", ctx.api.get(`${ACC}/${accountId}`));
  const tb = await trialBalances(ctx.api);
  return {
    cheques: ctx.store().get("SELECT COUNT(*) AS n FROM cheques WHERE account_id = ? AND deleted_at IS NULL", accountId).n,
    entries: ctx.store().get("SELECT COUNT(*) AS n FROM account_entries WHERE account_id = ? AND source = 'cheque'", accountId).n,
    balance: card.totals.balance,
    g101: tb["101"] ?? 0,
    g121: tb["121"] ?? 0,
    g100: tb["100"] ?? 0,
  };
}

describe("2.4.7 çek / senet girişinde istek kimliği (tek sunucu)", () => {
  const ctx = {};
  let n = 0;
  const customer = async name => must(`müşteri ${name}`, ctx.api.post(ACC, { name: `${name} ${++n}`, type: "customer", registeredOn: "2026-09-01" }));
  before(async () => {
    ctx.server = await startTestServer({ now: NOW });
    ctx.client = await loginAdmin(ctx.server);
    ctx.api = apiOf(ctx.client);
    ctx.store = () => ctx.server.app.store;
  });
  after(() => ctx.server?.close());

  it("aynı kimlik + aynı gövde (yanıt kayboldu, yeniden gönderildi) → tek evrak, tek cari etkisi, 101 bir kez; ikinci yanıt ilk evrak (replayed)", async () => {
    const acc = await customer("Kimlik Müşterisi");
    const before_ = await snapshot(ctx, acc.id);
    const body = evrak({ accountId: acc.id }); // seri no yok: senette ve no'suz çekte cheque-duplicate koruması da yok
    const first = await send(ctx.client, body, RID("a"));
    expectStatus(first, 200, "", "ilk gönderim");
    assert.notEqual(first.data.replayed, true, "ilk gönderim yeni evrak");
    const second = await send(ctx.client, body, RID("a"));
    expectStatus(second, 200, "", "yeniden gönderim");
    const after_ = await snapshot(ctx, acc.id);
    assert.equal(after_.cheques - before_.cheques, 1, `aynı istek ikinci evrak açtı: ${after_.cheques - before_.cheques} evrak`);
    assert.equal(after_.entries - before_.entries, 1, `cari etkisi ${after_.entries - before_.entries} kez yazıldı`);
    assert.equal(after_.balance - before_.balance, -1000, `cari bakiyesi bir kez düşmeli (fark ${after_.balance - before_.balance})`);
    assert.equal(after_.g101 - before_.g101, 1000, `101 Alınan Çekler bir kez artmalı (fark ${after_.g101 - before_.g101})`);
    assert.equal(after_.g100, before_.g100, "Kasa değişmez");
    assert.equal(second.data.replayed, true, "ikinci yanıt replayed işaretli");
    assert.equal(second.data.id, first.data.id, "ikinci yanıt ilk evrakın kartı");
    assert.equal(second.data.amount, 1000);
    const key = ctx.store().get("SELECT key, scope, ref_id AS refId FROM request_keys WHERE ref_id = ?", first.data.id);
    assert.ok(key, "istek kimliği kaydı yok (request_keys)");
    assert.equal(key.scope, "cheque.create");
    assert.match(key.key, new RegExp(`\\|cheque\\.create\\|${RID("a")}$`), "anahtar kullanıcı | cheque.create | kimlik");
    // Gövdedeki requestId de aynı kimliktir (öbür uçlar gibi: x-hof-request ya da body.requestId).
    const viaBody = await send(ctx.client, { ...body, requestId: RID("a") });
    expectStatus(viaBody, 200, "", "gövdede kimlik");
    assert.equal(viaBody.data.id, first.data.id, "gövdedeki kimlik de aynı evrakı döndürür");
    assert.equal((await snapshot(ctx, acc.id)).cheques - before_.cheques, 1);
    await integrityOk(ctx.api, "tek evrak");
  });

  it("aynı kimlik + farklı gövde → 409 request-id-reused; yeni evrak yok (öbür uçlarla aynı)", async () => {
    const acc = await customer("Farklı Gövde");
    const first = await send(ctx.client, evrak({ accountId: acc.id }), RID("b"));
    expectStatus(first, 200, "", "ilk");
    const changed = await send(ctx.client, evrak({ accountId: acc.id, amount: "1.500" }), RID("b"));
    expectStatus(changed, 409, "request-id-reused", "farklı tutarla aynı kimlik");
    assert.equal(changed.data.refId, first.data.id, "409 ilk evrakı gösterir");
    const s = await snapshot(ctx, acc.id);
    assert.equal(s.cheques, 1, `tek evrak (${s.cheques})`);
    assert.equal(s.balance, -1000, "cari bir kez");
  });

  it("aynı anda iki istek (aynı kimlik, Promise.all) → tek evrak; ikisi de aynı evrakı döndürür", async () => {
    const acc = await customer("Yarış");
    const before_ = await snapshot(ctx, acc.id);
    const body = evrak({ accountId: acc.id, amount: "700" });
    const [x, y] = await Promise.all([send(ctx.client, body, RID("c")), send(ctx.client, body, RID("c"))]);
    expectStatus(x, 200, "", "x");
    expectStatus(y, 200, "", "y");
    const after_ = await snapshot(ctx, acc.id);
    assert.equal(after_.cheques - before_.cheques, 1, `aynı anda iki istek ${after_.cheques - before_.cheques} evrak açtı`);
    assert.equal(after_.g101 - before_.g101, 700, "101 bir kez");
    assert.equal(x.data.id, y.data.id, "ikisi aynı evrak");
    assert.equal([x.data.replayed, y.data.replayed].filter(Boolean).length, 1, "biri yeni, öbürü replayed");
  });

  it("kimliksiz istek eskisi gibi serbest (geriye uyum): aynı gövdeyle iki istek iki evrak (no'suz evrakta gerçekten iki evrak olabilir)", async () => {
    const acc = await customer("Kimliksiz");
    const body = evrak({ accountId: acc.id, amount: "300", instrument: "note" });
    expectStatus(await send(ctx.client, body), 200, "", "kimliksiz 1");
    expectStatus(await send(ctx.client, body), 200, "", "kimliksiz 2");
    const s = await snapshot(ctx, acc.id);
    assert.equal(s.cheques, 2, "kimliksiz iki istek iki evrak");
    assert.equal(s.g121 >= 600, true, "121 Alacak Senetleri iki senet");
    // Kimliği farklı iki aynı içerikli evrak da serbest (iki gerçek evrak).
    expectStatus(await send(ctx.client, body, RID("d1")), 200, "", "kimlik d1");
    expectStatus(await send(ctx.client, body, RID("d2")), 200, "", "kimlik d2");
    assert.equal((await snapshot(ctx, acc.id)).cheques, 4);
  });

  it("biçimsiz kimlik → 400 (öbür uçlarla aynı); evrak yazılmaz", async () => {
    const acc = await customer("Biçimsiz");
    expectStatus(await send(ctx.client, evrak({ accountId: acc.id }), "kisa"), 400, "request-id-invalid", "16 karakterden kısa");
    expectStatus(await send(ctx.client, evrak({ accountId: acc.id, requestId: "kötü kimlik; DROP TABLE request_keys" })), 400, "request-id-invalid", "izinsiz karakter (gövdede)");
    assert.equal((await snapshot(ctx, acc.id)).cheques, 0);
  });

  it("taksite sayılan evrak: aynı kimlikle ikinci gönderim taksiti ikinci kez ödemez (tek plan satırı, kalan bir kez düşer)", async () => {
    const acc = await customer("Taksitli");
    const plan = await must("kart", ctx.api.post(PLANS, { name: "Kimlik Kartı", accountId: acc.id, total: 3000, count: 3, firstDue: "2026-10-01", registeredOn: "2026-10-01" }));
    const body = evrak({ accountId: acc.id, planId: plan.id, amount: "1.000", serialNo: "" });
    const first = await send(ctx.client, body, RID("e"));
    expectStatus(first, 200, "", "ilk");
    const second = await send(ctx.client, body, RID("e"));
    expectStatus(second, 200, "", "yeniden");
    const card = await must("kart", ctx.api.get(`${PLANS}/${plan.id}`));
    assert.equal(card.totals.paid, 1000, `taksit bir kez ödenmeli (ödenen ${card.totals.paid})`);
    assert.equal(card.totals.remaining, 2000);
    assert.equal(ctx.store().get("SELECT COUNT(*) AS n FROM plan_entries WHERE plan_id = ? AND cheque_id <> ''", plan.id).n, 1, "tek plan satırı");
    assert.equal(second.data.id, first.data.id);
    assert.equal(second.data.replayed, true);
    await integrityOk(ctx.api, "taksitli evrak");
  });

  it("seri no'lu evrak: yanıt kaybolunca yeniden gönderim 'zaten kayıtlı' sorusuna düşmez, ilk evrak döner; allowDuplicate yolu da tek evrak", async () => {
    const acc = await customer("Seri No");
    const body = evrak({ accountId: acc.id, serialNo: "SN-247-1" });
    const first = await send(ctx.client, body, RID("f"));
    expectStatus(first, 200, "", "ilk");
    const retry = await send(ctx.client, body, RID("f"));
    expectStatus(retry, 200, "", "yeniden gönderim (önceden 409 cheque-duplicate → 'Yine de Kaydet' ikinci evrakı açıyordu)");
    assert.equal(retry.data.id, first.data.id);
    // Gerçekten aynı numaralı ikinci evrak (yeni form = yeni kimlik): soru gelir, kimlik kaydı bırakmaz; onaydan sonra (allowDuplicate) aynı kimlikle kaydedilir,
    // onun da yeniden gönderimi tek evraktır.
    const keys = () => ctx.store().get("SELECT COUNT(*) AS n FROM request_keys WHERE key LIKE ?", `%${RID("g")}`).n;
    expectStatus(await send(ctx.client, body, RID("g")), 409, "cheque-duplicate", "aynı numara sorusu");
    assert.equal(keys(), 0, "reddedilen istek kimlik bırakmaz");
    const twin = await send(ctx.client, { ...body, allowDuplicate: true }, RID("g"));
    expectStatus(twin, 200, "", "Yine de Kaydet");
    assert.notEqual(twin.data.id, first.data.id, "bilerek ikinci evrak");
    const twinRetry = await send(ctx.client, { ...body, allowDuplicate: true }, RID("g"));
    expectStatus(twinRetry, 200, "", "Yine de Kaydet'in yeniden gönderimi");
    assert.equal(twinRetry.data.id, twin.data.id);
    assert.equal((await snapshot(ctx, acc.id)).cheques, 2, "iki evrak (biri bilerek); üçüncüsü açılmadı");
  });

  it("reddedilen istek (ileri tarih) kimlik bırakmaz; düzeltilip aynı kimlikle gönderilince kaydedilir", async () => {
    const acc = await customer("Reddedilen");
    const rejected = await send(ctx.client, evrak({ accountId: acc.id, issueDate: "2026-12-01" }), RID("h"));
    assert.ok(rejected.status >= 400 && rejected.status < 500, `ileri tarih reddedilmeli (${rejected.status})`);
    const fixed = await send(ctx.client, evrak({ accountId: acc.id }), RID("h"));
    expectStatus(fixed, 200, "", "düzeltilmiş");
    assert.notEqual(fixed.data.replayed, true);
    assert.equal((await snapshot(ctx, acc.id)).cheques, 1);
  });

  it("evrak silindikten sonra aynı kimlikle yeniden gönderim yeni evrak açmaz (silinen evrak geri gelmez, ikinci evrak doğmaz)", async () => {
    const acc = await customer("Silinen");
    const first = await send(ctx.client, evrak({ accountId: acc.id }), RID("i"));
    expectStatus(first, 200, "", "ilk");
    await must("sil", ctx.api.del(`${CHEQUES}/${first.data.id}`));
    const again = await send(ctx.client, evrak({ accountId: acc.id }), RID("i"));
    assert.notEqual(again.status, 200, `silinmiş evrakın kimliği yeni evrak açmamalı (${again.status} ${again.error || ""})`);
    assert.equal(again.status, 404, `silinmiş evrak bulunamadı (${again.status} ${again.error || ""})`);
    const s = await snapshot(ctx, acc.id);
    assert.equal(s.cheques, 0, "etkin evrak yok");
    assert.equal(s.balance, 0, "cari etkisi geri alındı ve yeniden yazılmadı");
  });

  it("başka kullanıcının aynı kimliği ayrı anahtardır (sonuç sızmaz); aynı kullanıcının yeniden gönderimi tek evrak", async () => {
    const acc = await customer("İki Kullanıcı");
    const other = await createUser(ctx.server, ctx.client, { username: "cek247muhasebe", role: "muhasebe" });
    const body = evrak({ accountId: acc.id, amount: "250" });
    const mine = await send(ctx.client, body, RID("j"));
    expectStatus(mine, 200, "", "benim");
    expectStatus(await send(ctx.client, body, RID("j")), 200, "", "benim yeniden");
    const theirs = await send(other, body, RID("j"));
    expectStatus(theirs, 200, "", "öbür kullanıcı");
    assert.notEqual(theirs.data.id, mine.data.id, "öbür kullanıcının evrakı ayrı");
    assert.notEqual(theirs.data.replayed, true);
    assert.equal((await snapshot(ctx, acc.id)).cheques, 2, "iki kullanıcı → iki evrak; aynı kullanıcının yinelemesi evrak açmadı");
  });
});

describe("2.4.7 çek / senet istek kimliği: yeniden başlatma, şirketler, yedekten geri yükleme", () => {
  const dataDir = mkdtempSync(path.join(tmpdir(), "cek-istek-247-"));
  const ctx = {};
  const boot = async () => {
    ctx.server = await startTestServer({ dataDir, now: NOW });
    ctx.client = await loginAdmin(ctx.server);
    ctx.api = apiOf(ctx.client);
  };
  before(boot);
  after(async () => {
    await ctx.server?.close();
    rmSync(dataDir, { recursive: true, force: true });
  });
  const countIn = async drawer => (await must("liste", ctx.api.get(`${CHEQUES}?q=${encodeURIComponent(drawer)}&limit=5000`))).total;

  it("sunucu yeniden başlasa da aynı kimlik + aynı gövde → ilk evrak; farklı gövde → 409", async () => {
    const body = evrak({ drawer: "Yeniden Başlatma Keşidecisi", amount: "410" });
    const first = await send(ctx.client, body, RID("k"));
    expectStatus(first, 200, "", "ilk");
    await ctx.server.close();
    await boot();
    const again = await send(ctx.client, body, RID("k"));
    expectStatus(again, 200, "", "yeniden başlatmadan sonra");
    assert.equal(again.data.id, first.data.id, "aynı evrak");
    assert.equal(again.data.replayed, true);
    expectStatus(await send(ctx.client, { ...body, amount: "411" }, RID("k")), 409, "request-id-reused", "farklı gövde");
    assert.equal(await countIn("Yeniden Başlatma Keşidecisi"), 1, "tek evrak");
  });

  it("şirketler ayrı: 001'deki kimlik 002'de yeni evrak; her şirkette yeniden gönderim tek evrak; yedekten geri yükleme request_keys'i de geri getirir", async () => {
    const created = await must("002", ctx.api.post("/api/companies", { code: "002", name: "Çek İkinci Şirket" }));
    const companyB = created.company?.id || created.id;
    const body = evrak({ drawer: "Şirket Keşidecisi", amount: "520" });
    const inA = await send(ctx.client, body, RID("l"));
    expectStatus(inA, 200, "", "001");
    expectStatus(await send(ctx.client, body, RID("l")), 200, "", "001 yeniden");
    assert.equal(await countIn("Şirket Keşidecisi"), 1, "001'de tek evrak");
    await must("002 seç", ctx.api.post("/api/companies/select", { id: companyB }));
    try {
      await ctx.api.post("/api/workspace/bank/setup/dismiss", {});
      const inB = await send(ctx.client, body, RID("l"));
      expectStatus(inB, 200, "", "002");
      assert.notEqual(inB.data.replayed, true, "002'de yeni evrak (001'in sonucu sızmaz)");
      expectStatus(await send(ctx.client, body, RID("l")), 200, "", "002 yeniden");
      assert.equal(await countIn("Şirket Keşidecisi"), 1, "002'de tek evrak");
      // Yedek tatbikatı (002 hemen geri yüklenir): yedekten ÖNCE kaydedilen evrakın kimliği yedektedir; yedekten SONRA kaydedilen evrak ve kimliği
      // geri yüklemeyle birlikte gider. İki durumda da yeniden gönderim sonunda tek evrak (öbür para uçlarıyla aynı: request_keys şirketin veri dosyasında).
      const backup = (await must("002 yedek", ctx.api.post("/api/admin/backups", { scope: "one", companyId: companyB }))).backups[0].name;
      const late = evrak({ drawer: "Yedek Sonrası Keşideci", amount: "330" });
      const lateFirst = await send(ctx.client, late, RID("m"));
      expectStatus(lateFirst, 200, "", "yedekten sonra");
      await must("geri yükle", ctx.api.post("/api/admin/backups/restore", { name: backup, company: companyB, confirm: "002", password: ADMIN_PASSWORD }));
      assert.equal(await countIn("Yedek Sonrası Keşideci"), 0, "yedekten sonraki evrak geri yüklemeyle gitti");
      const lateAgain = await send(ctx.client, late, RID("m"));
      expectStatus(lateAgain, 200, "", "geri yüklemeden sonra yeniden gönderim");
      assert.notEqual(lateAgain.data.replayed, true, "geri yüklenen veride evrak da kimlik de yok: yeniden kaydedilir");
      expectStatus(await send(ctx.client, late, RID("m")), 200, "", "bir kez daha");
      assert.equal(await countIn("Yedek Sonrası Keşideci"), 1, "geri yüklemeden sonra tek evrak");
      const early = await send(ctx.client, body, RID("l"));
      expectStatus(early, 200, "", "yedekten önceki kimlik");
      assert.equal(early.data.replayed, true, "yedekten önce kaydedilen evrakın kimliği geri yüklenen veride");
      assert.equal(early.data.id, inB.data.id);
      assert.equal(await countIn("Şirket Keşidecisi"), 1, "002'de hâlâ tek evrak");
      await integrityOk(ctx.api, "002");
    } finally {
      await must("001 seç", ctx.api.post("/api/companies/select", { id: "sirket-001" }));
    }
    assert.equal(await countIn("Şirket Keşidecisi"), 1, "001'de tek evrak");
    await integrityOk(ctx.api, "001");
  });
});
