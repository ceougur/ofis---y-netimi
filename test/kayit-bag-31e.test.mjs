// 2.4.4 31e B1–B3 + Devamı olarak ekle ezme (kâhin b3g/b3h): Excel/Sheets yeniden yüklenince ya da eşitlenince kayda bağlı veriler (kayıt tahsilatı,
// not, kayıt notu, telefon, haciz, görev, düzeltme, silme işareti, "Ödendi Say", "Sorun Yok", cari ve taksit kartı bağı) SESSİZCE kopmaz.
// Güvenli eşleşmede yeni anahtara taşınır; eşleşmeyen önizlemede adıyla söylenir ve onaysız uygulama 409'dur; eşitleme bekler. Devamı olarak ekle aynı
// konumdaki FARKLI kişiyi mevcut satırın yerine koymaz; mevcut kayıtla aynı görünen satırları söyler ve onay ister.
// "Nasıl bozulur?" (N1–N17) listesi: hücre değişir, kolon eklenir, sıra değişir, satır silinir (kayma), aynı adlı iki kişi, ad + tutar değişir, kimlik
// kolonu eklenir/silinir, Devamı'nda farklı kişi, Devamı'nda çift satır, Sheets eşitlemesi, iki kullanıcı aynı anda, yarıda kesilme, başka veri sayfası,
// onaysız API, hedefte çakışan düzeltme. Sahte saat (config.now; ders 13).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";

const TODAY = new Date(2026, 9, 23, 10, 0, 0);
const pad = value => String(value).padStart(2, "0");
const at = days => new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() + days, 12);
const tr = days => { const x = at(days); return `${pad(x.getDate())}.${pad(x.getMonth() + 1)}.${x.getFullYear()}`; };
const iso = days => { const x = at(days); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
const NAMES = ["Ali Veli", "Ayşe Kaya", "Can Er", "Deniz Ak", "Ece Su", "Fırat Er"];
const PEOPLE = NAMES.map((name, i) => ({ name, tutar: String(1000 * (i + 1)), vade: tr(-3 - i), aciklama: `Aidat ${i + 1}`, dosya: `2026/${101 + i}`, kod: `D-${101 + i}`, mno: `M-00${i + 1}`, tel: `0532 111 22 ${pad(i + 10)}` }));
const C = {
  ad: ["Ad Soyad", p => p.name], tutar: ["Tutar", p => p.tutar], vade: ["Son Ödeme", p => p.vade], acik: ["Açıklama", p => p.aciklama],
  dosya: ["Dosya No", p => p.dosya], kod: ["Dosya No", p => p.kod], mno: ["Müşteri No", p => p.mno], tel: ["Telefon", p => p.tel],
};
const T0 = [C.ad, C.tutar, C.vade, C.acik];
const table = (cols, people = PEOPLE, patch = {}) => [cols.map(c => c[0]), ...people.map(p => cols.map(c => String(c[1](patch[p.name] ? { ...p, ...patch[p.name] } : p))))];
const excel = matrix => ({ kind: "excel", fileName: "musteriler.xlsx", sheets: [{ name: "Müşteriler", matrix }] });
const RANGE = "from=2000-01-01&to=2099-12-31";

async function boot(options = {}) {
  const server = await startTestServer({ now: { time: TODAY, fixed: true }, ...options });
  const admin = await loginAdmin(server);
  await admin.post("/api/workspace/bank/setup/dismiss", {});
  return { server, admin, store: server.app.store };
}
async function stage(client, body) {
  const response = await client.post("/api/workspace/dataset/stage", body);
  assert.equal(response.status, 200, JSON.stringify(response.data).slice(0, 400));
  return response.data.data;
}
const commitRaw = (client, staged, mode, extra = {}) => client.post("/api/workspace/dataset/commit", { stageId: staged.stageId, mode, ...extra });
async function load(client, matrix, mode = "replace", extra = {}) {
  const staged = await stage(client, excel(matrix));
  const response = await commitRaw(client, staged, mode, extra);
  assert.equal(response.status, 200, `${mode}: ${JSON.stringify(response.data).slice(0, 500)}`);
  return { staged, result: response.data.data };
}
const rowsOf = store => store.all("SELECT row_id AS id, case_key AS k, values_json AS v FROM dataset_rows ORDER BY position").map(r => ({ id: r.id, k: r.k, name: JSON.parse(r.v)["Ad Soyad"], values: JSON.parse(r.v) }));
const keyOf = (store, name) => rowsOf(store).filter(r => r.name === name).map(r => r.k);
const ownerOf = (store, key) => rowsOf(store).filter(r => r.k === key).map(r => r.name).join("+") || "YOK";

// Bağlar: Ali'ye tahsilat + not + kayıt notu + telefon + haciz + görev + düzeltme; Ayşe'nin vadesine "Ödendi Say"; Can'a cari; Ece'ye "Sorun Yok".
async function bond(admin, store) {
  const [ali] = keyOf(store, "Ali Veli");
  const [can] = keyOf(store, "Can Er");
  const [ece] = keyOf(store, "Ece Su");
  const ok = async (label, promise) => {
    const r = await promise;
    assert.equal(r.status, 200, `${label}: ${JSON.stringify(r.data).slice(0, 300)}`);
    return r.data.data;
  };
  await ok("tahsilat", admin.post(`/api/workspace/cases/${encodeURIComponent(ali)}/payments`, { amount: 400, date: iso(-1), method: "cash", cashForce: true, note: "Ali tahsilat", caseTitle: "Ali Veli" }));
  await ok("not", admin.post(`/api/workspace/cases/${encodeURIComponent(ali)}/notes`, { note: "Ali ile görüşüldü" }));
  await ok("kayıt notu", admin.put(`/api/workspace/case-notes/${encodeURIComponent(ali)}`, { note: "Ali durumu" }));
  await ok("telefon", admin.post(`/api/workspace/cases/${encodeURIComponent(ali)}/phones`, { phone: "05321112233", label: "İş" }));
  await ok("haciz", admin.post(`/api/workspace/cases/${encodeURIComponent(ali)}/liens`, { title: "Araç", placedAt: iso(-2) }));
  await ok("görev", admin.post("/api/workspace/tasks", { title: "Ali'yi ara", caseKey: ali, dueDate: iso(2) }));
  await ok("düzeltme", admin.post("/api/workspace/overrides", { caseKey: ali, field: "Açıklama", value: "Düzeltildi" }));
  const dues = (await admin.get("/api/workspace/dues")).data.data.items;
  const ayse = dues.find(item => item.person === "Ayşe Kaya");
  assert.ok(ayse, "Ayşe'nin vade kalemi var");
  await ok("Ödendi Say", admin.post("/api/workspace/dues/settle", { id: ayse.id }));
  await ok("cari", admin.post("/api/workspace/accounts", { name: "Can Er", type: "customer", caseKey: can, caseTitle: "Can Er" }));
  await ok("Sorun Yok", admin.post(`/api/workspace/records/${encodeURIComponent(ece)}/unflag`, {}));
  return { ali, can, ece };
}
function bondKeys(store, datasetKey = "dataset://ofis") {
  const one = sql => store.get(sql)?.k ?? null;
  const settled = Object.keys(JSON.parse(store.setting("dues.settled", "{}") || "{}"));
  return {
    tahsilat: one("SELECT case_key AS k FROM payments WHERE note = 'Ali tahsilat'"),
    not: one("SELECT case_key AS k FROM notes WHERE note = 'Ali ile görüşüldü'"),
    kayitNotu: one("SELECT case_key AS k FROM case_notes WHERE note = 'Ali durumu'"),
    telefon: one("SELECT case_key AS k FROM phones WHERE label = 'İş'"),
    haciz: one("SELECT case_key AS k FROM liens WHERE title = 'Araç'"),
    gorev: one("SELECT case_key AS k FROM tasks WHERE title = 'Ali''yi ara'"),
    duzeltme: one(`SELECT case_key AS k FROM overrides WHERE field = 'Açıklama' AND value = 'Düzeltildi' AND source_name = '${datasetKey}'`),
    cari: one("SELECT case_key AS k FROM accounts WHERE name = 'Can Er' AND deleted_at IS NULL"),
    odendi: settled.length === 1 ? settled[0].split("|")[2] : `adet ${settled.length}`,
    sorunYok: Object.keys(JSON.parse(store.setting("dataset.unflagged", "{}") || "{}"))[0] || null,
  };
}
async function reports(admin) {
  const groups = (await admin.get(`/api/workspace/reports/cari-ekstre?${RANGE}`)).data.data.report.groups;
  const items = (await admin.get("/api/workspace/dues")).data.data.items;
  return {
    kisiler: name => groups.filter(g => g.cari === name).map(g => [g.debit, g.credit]),
    takvim: name => items.filter(i => i.person === name).map(i => i.amount),
  };
}
async function allOnNewRows(admin, store, label) {
  const keys = bondKeys(store);
  const ali = keyOf(store, "Ali Veli")[0];
  for (const kind of ["tahsilat", "not", "kayitNotu", "telefon", "haciz", "gorev", "duzeltme"]) assert.equal(keys[kind], ali, `${label}: Ali'nin ${kind} bağı yeni satırında (${ownerOf(store, keys[kind])})`);
  assert.equal(keys.cari, keyOf(store, "Can Er")[0], `${label}: Can'ın cari bağı yeni satırında`);
  assert.equal(keys.odendi, keyOf(store, "Ayşe Kaya")[0], `${label}: Ayşe'nin "Ödendi Say" işareti yeni satırında`);
  assert.equal(keys.sorunYok, keyOf(store, "Ece Su")[0], `${label}: Ece'nin "Sorun Yok" işareti yeni satırında`);
  const view = await reports(admin);
  assert.deepEqual(view.takvim("Ayşe Kaya"), [], `${label}: Ayşe'nin kalemi kapalı kalır`);
  return view;
}

describe("31e B1: Dosya No'suz tabloda içerik değişince bağlar yeni satıra taşınır (sessiz kopma yok)", () => {
  it("N1 Yerine koy: Ali'nin Tutar'ı 1.000 → 1.200 — bütün bağlar Ali'de, Kişiler 1.200 / 400, Takvim 800; taşıma işlem geçmişinde ve yedekten sonra", async () => {
    const { server, admin, store } = await boot();
    try {
      await load(admin, table(T0));
      await bond(admin, store);
      const { staged, result } = await load(admin, table(T0, PEOPLE, { "Ali Veli": { tutar: "1200" } }));
      const view = await allOnNewRows(admin, store, "Yerine koy");
      assert.deepEqual(view.kisiler("Ali Veli"), [[1200, 400]], "Kişiler: Ali borç 1.200, tahsilat 400");
      assert.deepEqual(view.takvim("Ali Veli"), [800], "Takvim: Ali 800 (tam tutar değil)");
      assert.equal(staged.bonds?.replace?.moved?.count, 1, "önizleme: 1 kaydın bağı taşınır");
      assert.equal(staged.bonds?.replace?.unmatched?.count, 0);
      assert.match(result.backupName, /veri-oncesi-degistirme/, "yedek alındı");
      const event = store.get("SELECT payload_json AS p FROM audit_events WHERE type = 'dataset.bonds.moved'");
      assert.ok(event && JSON.parse(event.p).moves[0].name === "Ali Veli", "işlem geçmişinde taşınan kayıt");
    } finally {
      await server.close();
    }
  });

  it("N1 Devamı olarak ekle: aynı değişiklik — bağlar taşınır, satır sayısı aynı (yeni kayıt açılmaz)", async () => {
    const { server, admin, store } = await boot();
    try {
      await load(admin, table(T0));
      await bond(admin, store);
      const { result } = await load(admin, table(T0, PEOPLE, { "Ali Veli": { tutar: "1200" } }), "merge");
      assert.equal(rowsOf(store).length, 6, "Ali'nin satırı güncellendi, çift kayıt yok");
      assert.deepEqual(result.counts, { added: 0, updated: 1, unchanged: 5, removed: 0, missing: 0 });
      const view = await allOnNewRows(admin, store, "Devamı");
      assert.deepEqual(view.takvim("Ali Veli"), [800]);
    } finally {
      await server.close();
    }
  });

  it("N2 Telefon kolonu eklenir (bütün parmak izleri değişir): Yerine koy ve Devamı'nda bütün bağlar (cari, Ödendi Say, Sorun Yok dahil) yerinde", async () => {
    for (const mode of ["replace", "merge"]) {
      const { server, admin, store } = await boot();
      try {
        await load(admin, table(T0));
        await bond(admin, store);
        const before = rowsOf(store).map(r => r.k);
        const { staged } = await load(admin, table([...T0, C.tel]), mode);
        assert.ok(rowsOf(store).every(r => !before.includes(r.k)), `${mode}: bütün anahtarlar değişti (sınamanın ön koşulu)`);
        const view = await allOnNewRows(admin, store, mode);
        assert.deepEqual(view.kisiler("Ali Veli"), [[1000, 400]]);
        assert.equal(staged.bonds[mode].moved.count, 4, `${mode}: 4 kaydın bağı taşınır (Ali, Ayşe, Can, Ece)`);
      } finally {
        await server.close();
      }
    }
  });

  it("N3 sıra değişir: anahtar aynı, taşıma gerekmez; bağlar yine doğru kişide", async () => {
    const { server, admin, store } = await boot();
    try {
      await load(admin, table(T0));
      await bond(admin, store);
      const shuffled = [PEOPLE[3], PEOPLE[0], PEOPLE[5], PEOPLE[1], PEOPLE[4], PEOPLE[2]];
      const { staged } = await load(admin, table(T0, shuffled));
      await allOnNewRows(admin, store, "sıra");
      assert.equal(staged.bonds?.replace?.moved?.count ?? 0, 0, "kontrol: taşınacak bağ yok (eski kodda da yeşil beklenir)");
    } finally {
      await server.close();
    }
  });

  it("N4 satır silinir + sonraki satır değişir: kayan konumda bağ başka kişiye gitmez; Can'ın cari bağı Can'da, silinen Ayşe'nin işareti eşleşmez (onay ister, silinmez)", async () => {
    const { server, admin, store } = await boot();
    try {
      await load(admin, table(T0));
      const { can } = await bond(admin, store);
      const next = table(T0, PEOPLE.filter(p => p.name !== "Ayşe Kaya"), { "Can Er": { tutar: "3500" } });
      const staged = await stage(admin, excel(next));
      assert.deepEqual(staged.bonds?.replace?.unmatched?.names, ["Ayşe Kaya"], "önizleme eşleşmeyeni adıyla söyler");
      assert.match(staged.bonds?.replace?.unmatched?.text, /^1 kaydın “Ödendi Say” işareti bu yüklemeyle eşleşmedi: Ayşe Kaya\.$/);
      const refused = await commitRaw(admin, staged, "replace");
      assert.equal(refused.status, 409, "onaysız uygulama reddedilir");
      assert.equal(refused.data.code, "bonds-unmatched");
      assert.match(refused.data.error, /Ayşe Kaya/);
      assert.equal(keyOf(store, "Can Er")[0], can, "reddedilen istek veriyi değiştirmedi");
      const done = await commitRaw(admin, staged, "replace", { confirm: true });
      assert.equal(done.status, 200, JSON.stringify(done.data));
      const keys = bondKeys(store);
      assert.equal(ownerOf(store, keys.cari), "Can Er", "Can'ın cari bağı Can'ın yeni satırında (konum kaydı)");
      assert.notEqual(keys.cari, can, "Can'ın anahtarı değişti (tutar)");
      assert.equal(ownerOf(store, keys.odendi), "YOK", "Ayşe'nin işareti eski anahtarda kalır");
      assert.equal(ownerOf(store, keys.tahsilat), "Ali Veli", "Ali'nin bağları yerinde");
      assert.ok(store.get("SELECT 1 AS x FROM audit_events WHERE type = 'dataset.bonds.unmatched'"), "eşleşmeyen işlem geçmişinde");
    } finally {
      await server.close();
    }
  });

  it("N5 aynı adlı iki kişi: aynı konumda aynı ad ve aynı sayı → doğru Ali'ye taşınır; ilk Ali silinip ikincisi değişirse taşınmaz (onay)", async () => {
    const twins = [PEOPLE[0], PEOPLE[1], PEOPLE[2], { ...PEOPLE[3], name: "Ali Veli", tutar: "7000", aciklama: "İkinci Ali" }];
    const { server, admin, store } = await boot();
    try {
      await load(admin, table(T0, twins));
      const second = rowsOf(store).find(r => r.values["Açıklama"] === "İkinci Ali").k;
      assert.equal((await admin.post(`/api/workspace/cases/${encodeURIComponent(second)}/notes`, { note: "İkinci Ali notu" })).status, 200);
      await load(admin, table(T0, twins.map(p => (p.aciklama === "İkinci Ali" ? { ...p, tutar: "7500" } : p))));
      const noteKey = store.get("SELECT case_key AS k FROM notes WHERE note = 'İkinci Ali notu'").k;
      assert.equal(rowsOf(store).find(r => r.k === noteKey)?.values["Açıklama"], "İkinci Ali", "not ikinci Ali'nin yeni satırında (birinci Ali'ye gitmedi)");
      // İlk Ali silinir, ikincisinin tutarı değişir: konum kayar, ad artık tek ama eskide iki → güvenli değil.
      const staged = await stage(admin, excel(table(T0, twins.slice(1).map(p => (p.aciklama === "İkinci Ali" ? { ...p, tutar: "8000" } : p)))));
      assert.equal(staged.bonds?.replace?.unmatched?.count, 1, "ikinci Ali'nin notu eşleşmez");
      assert.equal((await commitRaw(admin, staged, "replace")).status, 409);
    } finally {
      await server.close();
    }
  });

  it("N6 ad + tutar birlikte değişir: kişi değeri tutmaz → eşleşmeyen, onaysız 409; onayla uygulanır, tahsilat silinmez", async () => {
    const { server, admin, store } = await boot();
    try {
      await load(admin, table(T0));
      const { ali } = await bond(admin, store);
      const staged = await stage(admin, excel(table(T0, PEOPLE, { "Ali Veli": { name: "Ali Velioğlu", tutar: "1100" } })));
      assert.ok(staged.bonds?.replace?.unmatched?.names.includes("Ali Veli"));
      assert.match(staged.bonds?.replace?.unmatched?.text, /tahsilatı \/ notu \/ telefonu \/ haczi \/ görevi \/ düzeltmesi/);
      assert.equal((await commitRaw(admin, staged, "replace")).status, 409);
      assert.equal((await commitRaw(admin, staged, "replace", { confirm: true })).status, 200);
      assert.equal(bondKeys(store).tahsilat, ali, "tahsilat eski anahtarda durur (silinmez)");
      assert.equal(store.get("SELECT COUNT(*) AS n FROM payments").n, 1);
    } finally {
      await server.close();
    }
  });
});

describe("31e B2: kimlik kolonu eklenir / silinir — tek adlı kişide bağlar taşınır", () => {
  const cases = [
    ["Dosya No (2026/x) eklenir", table(T0), table([C.dosya, ...T0])],
    ["Dosya No (D-x) eklenir", table(T0), table([C.kod, ...T0])],
    ["Dosya No (2026/x) silinir", table([C.dosya, ...T0]), table(T0)],
    ["Dosya No (D-x) silinir", table([C.kod, ...T0]), table(T0)],
    ["Müşteri No silinir (kimlik kolonu kipi değişir)", table([C.mno, ...T0]), table(T0)],
  ];
  for (const [label, base, next] of cases) {
    it(`N8 ${label}: Yerine koy onaysız uygulanır (eşleşmeyen yok), bütün bağlar yeni satırlarda`, async () => {
      const { server, admin, store } = await boot();
      try {
        await load(admin, base);
        await bond(admin, store);
        const { staged } = await load(admin, next);
        assert.equal(staged.bonds?.replace?.unmatched?.count ?? 0, 0, "eşleşmeyen yok");
        const view = await allOnNewRows(admin, store, label);
        assert.deepEqual(view.kisiler("Ali Veli"), [[1000, 400]]);
      } finally {
        await server.close();
      }
    });
  }
});

describe("31e Devamı olarak ekle: farklı kişi mevcut satırın yerine geçmez (kâhin b3g/b3h); aynı görünen satır onay ister (B3)", () => {
  it("N9 2. satırda Lale Ak yerine Yeni Kişi: Lale ve 200 TL tahsilatı durur, Yeni Kişi yeni kayıt; önizleme 1 yeni / 1 silinmez", async () => {
    const head = ["Ad Soyad", "Tutar", "Son Ödeme"];
    const { server, admin, store } = await boot();
    try {
      await load(admin, [head, ["Kemal Er", "100", tr(-3)], ["Lale Ak", "200", tr(-3)], ["Mert Su", "300", tr(-3)]]);
      const [lale] = keyOf(store, "Lale Ak");
      assert.equal((await admin.post(`/api/workspace/cases/${encodeURIComponent(lale)}/payments`, { amount: 200, date: iso(-1), method: "cash", cashForce: true, caseTitle: "Lale Ak" })).status, 200);
      const { staged, result } = await load(admin, [head, ["Kemal Er", "100", tr(-3)], ["Yeni Kişi", "500", tr(-3)], ["Mert Su", "300", tr(-3)]], "merge");
      assert.deepEqual(rowsOf(store).map(r => r.name), ["Kemal Er", "Lale Ak", "Mert Su", "Yeni Kişi"], "Lale'nin satırı ezilmedi");
      assert.equal(keyOf(store, "Lale Ak")[0], lale);
      assert.deepEqual(staged.preview.merge, { added: 1, updated: 0, unchanged: 2, kept: 1 });
      assert.equal(staged.bonds?.merge?.differentPerson, 1, "önizleme farklı kişiyi söyler");
      assert.deepEqual(result.counts, { added: 1, updated: 0, unchanged: 2, removed: 0, missing: 0 });
      const view = await reports(admin);
      assert.deepEqual(view.kisiler("Lale Ak"), [[200, 200]], "Kişiler'de Lale 200 / 200");
      assert.deepEqual(view.kisiler("Yeni Kişi"), [[500, 0]]);
      // Aynı dosya ikinci kez Devamı olarak eklenirse değişiklik yok (yeni kayıt kimliğiyle eşlenir, çiftlenmez).
      const again = await load(admin, [head, ["Kemal Er", "100", tr(-3)], ["Yeni Kişi", "500", tr(-3)], ["Mert Su", "300", tr(-3)]], "merge");
      assert.deepEqual(again.result.counts, { added: 0, updated: 0, unchanged: 3, removed: 0, missing: 0 });
      assert.equal(rowsOf(store).length, 4);
    } finally {
      await server.close();
    }
  });

  it("N9b dosyanın başına satır eklenir (bütün konumlar kayar): Devamı olarak ekle mevcut satırları içerikleriyle eşler, kimseyi ezmez", async () => {
    const { server, admin, store } = await boot();
    try {
      await load(admin, table(T0));
      await bond(admin, store);
      const { result } = await load(admin, table(T0, [{ ...PEOPLE[0], name: "Zeki Öz", tutar: "50" }, ...PEOPLE]), "merge");
      assert.deepEqual(result.counts, { added: 1, updated: 0, unchanged: 6, removed: 0, missing: 0 });
      await allOnNewRows(admin, store, "baştan ekleme");
    } finally {
      await server.close();
    }
  });

  it("N7 başa satır eklenir + Ayşe'nin tutarı değişir (kayma + değişim): Devamı Ayşe'yi ezmez, 'mevcut bir kaydın kişisini taşıyor' der ve onay ister", async () => {
    const { server, admin, store } = await boot();
    try {
      await load(admin, table(T0));
      await bond(admin, store);
      const next = table(T0, [{ ...PEOPLE[0], name: "Zeki Öz", tutar: "50" }, ...PEOPLE], { "Ayşe Kaya": { tutar: "2500" } });
      const staged = await stage(admin, excel(next));
      assert.deepEqual(staged.bonds?.merge?.samePerson?.names, ["Ayşe Kaya"], "aynı kişi uyarısı adıyla");
      assert.equal(staged.bonds?.merge?.duplicates?.count, 0);
      const refused = await commitRaw(admin, staged, "merge");
      assert.equal(refused.status, 409);
      assert.match(refused.data.error, /1 yeni satır mevcut bir kaydın kişisini taşıyor \(Ayşe Kaya\)/);
      assert.equal((await commitRaw(admin, staged, "merge", { confirm: true })).status, 200);
      assert.deepEqual(rowsOf(store).filter(r => r.name === "Ayşe Kaya").map(r => r.values.Tutar), ["2000", "2500"], "onayla ayrı kayıt; eski Ayşe ve işareti durur");
      assert.equal(ownerOf(store, bondKeys(store).odendi), "Ayşe Kaya");
      // Aynı dosyanın önizlemesinde Yerine Koy Ayşe'yi tek kişi olarak eşliyordu (bağ yeni satırına taşınacaktı, eşleşmeyen yok).
      assert.equal(staged.bonds?.replace?.unmatched?.count, 0);
      assert.deepEqual(staged.bonds?.replace?.moved, { count: 1, kinds: ["settled"], labels: ["“Ödendi Say” işareti"] }, "Ayşe'nin işareti taşınır (adlar önizlemede yok, işlem geçmişinde)");
    } finally {
      await server.close();
    }
  });

  it("N10 Dosya No eklenmiş aynı dosya Devamı olarak eklenir: '6 satır mevcut kayıtlarla aynı görünüyor' + onaysız 409; onayla eklenir", async () => {
    const { server, admin, store } = await boot();
    try {
      await load(admin, table(T0));
      const staged = await stage(admin, excel(table([C.dosya, ...T0])));
      assert.equal(staged.bonds?.merge?.duplicates?.count, 6);
      assert.deepEqual(staged.bonds?.merge?.duplicates?.names, NAMES);
      const refused = await commitRaw(admin, staged, "merge");
      assert.equal(refused.status, 409, "çift kayıt sessizce eklenmez");
      assert.equal(refused.data.code, "merge-duplicates");
      assert.match(refused.data.error, /^6 satır mevcut kayıtlarla aynı görünüyor \(Ali Veli, /);
      assert.equal(rowsOf(store).length, 6);
      assert.equal((await commitRaw(admin, staged, "merge", { confirm: true })).status, 200);
      assert.equal(rowsOf(store).length, 12, "onaylanınca eklenir (kendiliğinden birleştirme yok)");
      // Yerine koy aynı dosyada uyarı vermez (aynı görünen yalnız Devamı'nda).
      assert.equal((await stage(admin, excel(table([C.dosya, ...T0])))).bonds?.replace?.duplicates?.count, 0);
    } finally {
      await server.close();
    }
  });
});

describe("31e Google Sheets eşitlemesi", () => {
  const URL = "https://docs.google.com/spreadsheets/d/BAG31E/edit";
  const csvOf = matrix => matrix.map(line => line.map(cell => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(",")).join("\n");
  const sheetServer = async () => {
    const state = { csv: "" };
    const fetchImpl = async target => (String(target).includes("/edit") ? new Response('<script>"gid":"0","name":"Müşteriler"</script>') : new Response(state.csv, { headers: { "content-type": "text/csv" } }));
    const booted = await boot({ fetchImpl });
    return { ...booted, state };
  };
  const link = async (admin, state, matrix) => {
    state.csv = csvOf(matrix);
    const staged = await stage(admin, { kind: "sheets", url: URL });
    assert.equal((await commitRaw(admin, staged, "replace", { link: true })).status, 200);
  };
  const sync = async (admin, state, matrix) => {
    state.csv = csvOf(matrix);
    const response = await admin.post("/api/workspace/dataset/sync", {});
    assert.equal(response.status, 200, JSON.stringify(response.data).slice(0, 300));
    return response.data.data;
  };

  it("N11 Sheet'te Ali'nin tutarı ve sonra Telefon kolonu değişir: eşitleme bağları taşıyarak uygular, önce yedek alır", async () => {
    const { server, admin, store, state } = await sheetServer();
    try {
      await link(admin, state, table(T0));
      await bond(admin, store);
      const first = await sync(admin, state, table(T0, PEOPLE, { "Ali Veli": { tutar: "1200" } }));
      assert.ok(first.ok && first.bonds?.moved === 1, `eşitleme Ali'nin bağlarını taşır: ${JSON.stringify(first).slice(0, 200)}`);
      const view = await allOnNewRows(admin, store, "eşitleme tutar");
      assert.deepEqual(view.takvim("Ali Veli"), [800]);
      const second = await sync(admin, state, table([...T0, C.tel], PEOPLE, { "Ali Veli": { tutar: "1200" } }));
      assert.ok(second.ok && second.bonds?.moved === 4, "eşitleme 4 kaydın bağını taşır");
      await allOnNewRows(admin, store, "eşitleme kolon");
      assert.ok(store.all("SELECT backup_name AS b FROM dataset_imports").length >= 1);
    } finally {
      await server.close();
    }
  });

  it("N11 kişi kolonu olmayan Sheet'te tutar değişir: eşleşmeyen bağ → eşitleme bekler (yönetici onayı), veri değişmez; İncele ve karar ver onayla uygular", async () => {
    const { server, admin, store, state } = await sheetServer();
    try {
      const head = ["Açıklama", "Tutar", "Son Ödeme"];
      const base = [head, ["Bahçe bakımı", "100", tr(-2)], ["Çatı onarımı", "200", tr(-2)], ["Asansör", "300", tr(-2)]];
      await link(admin, state, base);
      const key = rowsOf(store).find(r => r.values["Açıklama"] === "Çatı onarımı").k;
      assert.equal((await admin.post(`/api/workspace/cases/${encodeURIComponent(key)}/notes`, { note: "Usta arandı" })).status, 200);
      const next = [head, base[1], ["Çatı onarımı", "250", tr(-2)], base[3]];
      const held = await sync(admin, state, next);
      assert.equal(held.held, true, `eşitleme beklemeli: ${JSON.stringify(held).slice(0, 300)}`);
      assert.equal(held.hold?.reason, "bonds");
      assert.match(held.hold?.bonds?.text, /^1 kaydın notu bu eşitlemeyle eşleşmedi: Çatı onarımı\.$/);
      assert.equal(rowsOf(store).find(r => r.values["Açıklama"] === "Çatı onarımı").values.Tutar, "200", "veri değişmedi");
      assert.equal((await admin.get("/api/workspace/dataset")).data.data.syncHold.reason, "bonds");
      const staged = await stage(admin, { kind: "sheets", url: URL });
      assert.equal(staged.bonds?.merge?.unmatched?.count, 1);
      assert.equal((await commitRaw(admin, staged, "merge", { confirm: true })).status, 200);
      assert.equal((await admin.get("/api/workspace/dataset")).data.data.syncHold, null, "bekleme kalktı");
      assert.equal(store.get("SELECT case_key AS k FROM notes").k, key, "not silinmedi (eski anahtarda)");
    } finally {
      await server.close();
    }
  });

  it("N7/N11 Sheet'in başına satır eklenir + Ayşe'nin tutarı değişir: eşitleme Ayşe'yi kendi satırında günceller, işareti taşınır, 'Sheet'te yok' çıkmaz", async () => {
    const { server, admin, store, state } = await sheetServer();
    try {
      await link(admin, state, table(T0));
      await bond(admin, store);
      const result = await sync(admin, state, table(T0, [{ ...PEOPLE[0], name: "Zeki Öz", tutar: "50" }, ...PEOPLE], { "Ayşe Kaya": { tutar: "2500" } }));
      assert.deepEqual(result.counts, { added: 1, updated: 1, unchanged: 5, removed: 0, missing: 0 });
      assert.deepEqual(rowsOf(store).filter(r => r.name === "Ayşe Kaya").map(r => r.values.Tutar), ["2500"]);
      await allOnNewRows(admin, store, "eşitleme kayma");
    } finally {
      await server.close();
    }
  });

  it("N9/N11 Sheet'te 2. satır başka kişiyle değiştirilir: Lale yerinde kalır ('Sheet'te yok'), tahsilatı durur; Yeni Kişi yeni kayıt", async () => {
    const { server, admin, store, state } = await sheetServer();
    try {
      const head = ["Ad Soyad", "Tutar", "Son Ödeme"];
      await link(admin, state, [head, ["Kemal Er", "100", tr(-3)], ["Lale Ak", "200", tr(-3)], ["Mert Su", "300", tr(-3)]]);
      const [lale] = keyOf(store, "Lale Ak");
      assert.equal((await admin.post(`/api/workspace/cases/${encodeURIComponent(lale)}/payments`, { amount: 200, date: iso(-1), method: "cash", cashForce: true })).status, 200);
      const result = await sync(admin, state, [head, ["Kemal Er", "100", tr(-3)], ["Yeni Kişi", "500", tr(-3)], ["Mert Su", "300", tr(-3)]]);
      assert.deepEqual(result.counts, { added: 1, updated: 0, unchanged: 2, removed: 0, missing: 1 });
      assert.equal(keyOf(store, "Lale Ak")[0], lale, "Lale'nin satırı ezilmedi");
      assert.deepEqual((await admin.get("/api/workspace/dataset")).data.data.missingKeys, [lale], "Lale 'Sheet'te yok' olarak işaretli");
    } finally {
      await server.close();
    }
  });
});

describe("31e eşzamanlılık, yarıda kesilme, başka veri sayfası, bayat anahtar", () => {
  it("N12 önizlemeden sonra başka kullanıcı bağ ekler: onaysız uygulama 409; onaylanmış önizleme yeni eşleşmeyeni kapsamıyorsa 409 bonds-changed", async () => {
    const { server, admin, store } = await boot();
    try {
      await load(admin, table(T0));
      const personel = await createUser(server, admin, { username: "personel31e", role: "personel" });
      const next = table(T0, PEOPLE.filter(p => !["Deniz Ak", "Fırat Er"].includes(p.name)));
      const staged = await stage(admin, excel(next));
      assert.equal(staged.bonds?.replace?.unmatched?.count ?? 0, 0, "önizlemede eşleşmeyen yok");
      const [deniz] = keyOf(store, "Deniz Ak");
      assert.equal((await personel.post(`/api/workspace/cases/${encodeURIComponent(deniz)}/notes`, { note: "Deniz notu" })).status, 200);
      const refused = await commitRaw(admin, staged, "replace");
      assert.equal(refused.status, 409, "önizlemeden sonra eklenen bağ sessizce kopmaz");
      assert.equal(refused.data.code, "bonds-unmatched");
      const staged2 = await stage(admin, excel(next));
      assert.deepEqual(staged2.bonds?.replace?.unmatched?.names, ["Deniz Ak"]);
      const [firat] = keyOf(store, "Fırat Er");
      assert.equal((await personel.post(`/api/workspace/cases/${encodeURIComponent(firat)}/notes`, { note: "Fırat notu" })).status, 200);
      const changed = await commitRaw(admin, staged2, "replace", { confirm: true });
      assert.equal(changed.status, 409);
      assert.equal(changed.data.code, "bonds-changed");
      assert.equal(rowsOf(store).length, 6, "reddedilen istekler veriyi değiştirmedi");
    } finally {
      await server.close();
    }
  });

  it("N13 taşıma ortasında hata: satırlar ve bağlar birlikte geri alınır (tek işlem)", async () => {
    const { server, admin, store } = await boot();
    try {
      await load(admin, table(T0));
      const { ali } = await bond(admin, store);
      const before = JSON.stringify(rowsOf(store));
      const run = store.run;
      let injected = 0;
      store.run = (sql, ...args) => {
        if (/^UPDATE liens SET case_key/.test(sql)) {
          injected += 1;
          throw new Error("zorla kesinti");
        }
        return run.call(store, sql, ...args);
      };
      const staged = await stage(admin, excel(table(T0, PEOPLE, { "Ali Veli": { tutar: "1200" } })));
      const failed = await commitRaw(admin, staged, "replace");
      store.run = run;
      assert.equal(injected, 1, "kesinti taşımanın ortasında oldu (tahsilat ve not taşındıktan sonra)");
      assert.equal(failed.status, 500, "kesinti hatası");
      assert.equal(JSON.stringify(rowsOf(store)), before, "satırlar eski hâlinde");
      const keys = bondKeys(store);
      for (const kind of ["tahsilat", "not", "telefon", "haciz", "duzeltme"]) assert.equal(keys[kind], ali, `${kind} eski anahtarda (yarım taşıma yok)`);
    } finally {
      await server.close();
    }
  });

  it("N15 aynı satır başka veri sayfasında da var: genel tablolardaki bağ o sayfanın da olabilir → taşınmaz, onay ister", async () => {
    const { server, admin, store } = await boot();
    try {
      await load(admin, table(T0));
      const [ali] = keyOf(store, "Ali Veli");
      assert.equal((await admin.post(`/api/workspace/cases/${encodeURIComponent(ali)}/notes`, { note: "Ortak not" })).status, 200);
      const page = await stage(admin, { ...excel(table(T0)), fileName: "ikinci.xlsx" });
      const opened = await commitRaw(admin, page, "session", { name: "İkinci Sayfa" });
      assert.equal(opened.status, 200, JSON.stringify(opened.data).slice(0, 200));
      const second = opened.data.data.session.key;
      assert.equal(store.get("SELECT COUNT(*) AS n FROM dataset_rows WHERE dataset_key = ? AND case_key = ?", second, ali).n, 1, "ön koşul: aynı anahtar ikinci sayfada");
      assert.equal((await admin.post("/api/workspace/sessions/select", { key: "dataset://ofis" })).status, 200);
      const staged = await stage(admin, excel(table(T0, PEOPLE, { "Ali Veli": { tutar: "1200" } })));
      assert.equal((await commitRaw(admin, staged, "replace")).status, 409, "başka sayfada da olan anahtarın bağı sessizce taşınmaz ya da kopmaz (onay ister)");
      assert.equal(staged.bonds?.replace?.moved?.count, 0);
      assert.equal(staged.bonds?.replace?.unmatched?.count, 1);
    } finally {
      await server.close();
    }
  });

  it("İNCELE: tabloda olmayan Dosya No'suz anahtara (satir:…) not / tahsilat 409; dosya no ve serbest anahtar eskisi gibi kabul edilir", async () => {
    const { server, admin, store } = await boot();
    try {
      await load(admin, table(T0));
      const gone = "satir:0123456789abcdef";
      const pay = await admin.post(`/api/workspace/cases/${encodeURIComponent(gone)}/payments`, { amount: 10, date: iso(-1), method: "cash", cashForce: true });
      assert.equal(pay.status, 409);
      assert.equal(pay.data.code, "record-gone");
      assert.equal((await admin.post(`/api/workspace/cases/${encodeURIComponent(gone)}/notes`, { note: "x" })).status, 409);
      assert.equal(store.get("SELECT COUNT(*) AS n FROM payments").n, 0);
      assert.equal((await admin.post(`/api/workspace/cases/${encodeURIComponent("2026/999")}/notes`, { note: "dosya no" })).status, 200);
      const [ali] = keyOf(store, "Ali Veli");
      assert.equal((await admin.post(`/api/workspace/cases/${encodeURIComponent(ali)}/notes`, { note: "var olan" })).status, 200);
    } finally {
      await server.close();
    }
  });
});
