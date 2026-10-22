// 2.4.4 iş listesi 16 (KÖ3): "Başlarken" — yeni kurulumda yöneticiye ilk adımlar listesi (Şirket Adı, Firma Bilgileri, Fatura Ayarları,
// İlk Banka Hesabı, İlk Cari). Durum VERİDEN hesaplanır (elle işaretlenmez); hepsi tamamlanınca ya da kişi "Gizle" deyince liste kendiliğinden
// çıkmaz; kişi + şirket başına saklanır; yetkisiz kullanıcı adımları görmez; 2.4.3'ten gelen, verisi dolu şirket listeyle KARŞILAŞMAZ.
// Eski kodda (163dd5d) kırmızı: /api/workspace/getting-started yok (404).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";
import { fixtureExists, unpackFixture } from "./guvenilirlik/fikstur.mjs";
import { trIban } from "./banka-210-hesap-ortak.mjs";
import { allowedWhenReadOnly } from "../server/lib/license.mjs";

const data = response => response.data?.data ?? response.data;
const URL_ = "/api/workspace/getting-started";
const doneOf = state => Object.fromEntries(state.steps.map(step => [step.id, step.done]));
const ALL_OPEN = { company: false, seller: false, invoiceSettings: false, bank: false, account: false };
// Geçerli VKN (denetim hanesi tutar; test/einvoice testlerinde de kullanılan).
const VKN = "4840847211";
const FIXTURE = "surum-2.4.3-baslarken";

async function state(client, company = "") {
  const response = await client.get(`${URL_}${company ? `?hofCompany=${encodeURIComponent(company)}` : ""}`);
  assert.equal(response.status, 200, JSON.stringify(response.data));
  return data(response);
}

describe("Başlarken: boş kurulum → adımlar ekrandaki yollarla tamamlanır → liste kendiliğinden kapanır", () => {
  let server;
  let admin;
  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
  });
  after(async () => server?.close());

  it("boş kurulumda yönetici listeyi görür: bütün adımlar eksik, kurulu sayılmaz", async () => {
    const s = await state(admin);
    assert.equal(s.allowed, true);
    assert.equal(s.established, false);
    assert.equal(s.show, true);
    assert.equal(s.total, 5);
    assert.equal(s.done, 0);
    assert.deepEqual(doneOf(s), ALL_OPEN);
    assert.deepEqual(s.steps.map(step => step.id), ["company", "seller", "invoiceSettings", "bank", "account"]);
    // Yanıtta firma, banka ya da entegratör bilgisi yok (yalnız boole).
    assert.doesNotMatch(JSON.stringify(s), /password|username|taxNo|iban/i);
  });

  it("her adım kendi verisiyle tamamlanır (yanıt + sayı her adımda okunur); yarım firma bilgisi tamam sayılmaz", async () => {
    // 1. Şirket adı (Yönetim → Şirketler).
    assert.equal((await admin.put("/api/companies/sirket-001", { name: "Mavi Muhasebe Ltd. Şti." })).status, 200);
    let s = await state(admin);
    assert.equal(s.done, 1);
    assert.equal(doneOf(s).company, true);
    // 2. Yarım firma bilgisi (vergi dairesi ve il yok): Fatura Ayarları kaydedildi ama Firma Bilgileri eksik.
    const half = await admin.put("/api/workspace/invoices/settings", { seller: { name: "Mavi Muhasebe Ltd. Şti.", taxNo: VKN } });
    assert.equal(half.status, 200, JSON.stringify(half.data));
    s = await state(admin);
    assert.equal(doneOf(s).seller, false, "vergi dairesi ve il yokken firma bilgisi eksik");
    assert.equal(doneOf(s).invoiceSettings, true, "Fatura Ayarları bir kez kaydedildi");
    assert.equal(s.done, 2);
    // Geçersiz VKN (denetim hanesi tutmuyor) kaydedilmez; adım eksik kalır.
    assert.equal((await admin.put("/api/workspace/invoices/settings", { seller: { name: "Mavi Muhasebe Ltd. Şti.", taxNo: "4840847212", taxOffice: "Kadıköy", city: "İstanbul" } })).status, 400);
    assert.equal(doneOf(await state(admin)).seller, false, "geçersiz VKN");
    assert.equal((await admin.put("/api/workspace/invoices/settings", { seller: { name: "Mavi Muhasebe Ltd. Şti.", taxNo: VKN, taxOffice: "Kadıköy", city: "İstanbul" } })).status, 200);
    s = await state(admin);
    assert.equal(doneOf(s).seller, true);
    assert.equal(s.done, 3);
    assert.equal(s.show, true);
    // 3. Kredi kartı banka hesabı sayılmaz; vadesiz hesap sayılır.
    const bank = await admin.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", iban: trIban(10, 7700112) });
    assert.equal(bank.status, 200, JSON.stringify(bank.data));
    s = await state(admin);
    assert.equal(doneOf(s).bank, true);
    assert.equal(s.done, 4);
    // 4. İlk cari.
    const account = await admin.post("/api/workspace/accounts", { name: "İlk Müşteri A.Ş.", type: "customer" });
    assert.equal(account.status, 200, JSON.stringify(account.data));
    s = await state(admin);
    assert.deepEqual(doneOf(s), { company: true, seller: true, invoiceSettings: true, bank: true, account: true });
    assert.equal(s.complete, true);
    assert.equal(s.show, false, "hepsi tamamlanınca liste kendiliğinden çıkmaz");
  });
});

describe("Başlarken: yetki, Gizle kalıcılığı (kişi + şirket), 002 bağımsızlığı", () => {
  let server;
  let admin;
  let admin2;
  let staff;
  let accountant;
  let second;
  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    staff = await createUser(server, admin, { username: "bpersonel", role: "personel" });
    accountant = await createUser(server, admin, { username: "bmuhasebe", role: "muhasebe" });
    admin2 = await createUser(server, admin, { username: "byonetici", role: "admin" });
    const created = await admin.post("/api/companies", { name: "İkinci Şirket A.Ş." });
    assert.equal(created.status, 200, JSON.stringify(created.data));
    second = data(created).company;
  });
  after(async () => server?.close());

  it("personel ve muhasebe listeyi ve adımlarını görmez; Gizle ucu 403", async () => {
    for (const client of [staff, accountant]) {
      const s = await state(client);
      assert.equal(s.allowed, false);
      assert.equal(s.show, false);
      assert.deepEqual(s.steps, []);
      const hide = await client.post(URL_, { hidden: true });
      assert.equal(hide.status, 403, JSON.stringify(hide.data));
    }
  });

  it("Gizle kişiye ve şirkete özgüdür; yeniden açılır; sunucu yeniden okununca da kalır", async () => {
    const hidden = await admin.post(URL_, { hidden: true });
    assert.equal(hidden.status, 200, JSON.stringify(hidden.data));
    assert.equal(data(hidden).show, false);
    assert.equal(data(hidden).hidden, true);
    assert.equal((await state(admin)).show, false, "gizlenen liste kendiliğinden çıkmaz");
    assert.equal((await state(admin2)).show, true, "öbür yöneticinin listesi etkilenmez");
    assert.equal((await state(admin, second.id)).show, true, "002'deki liste etkilenmez");
    const shown = await admin.post(URL_, { hidden: false });
    assert.equal(data(shown).show, true);
    assert.equal((await admin.post(URL_, { hidden: true })).status, 200);
  });

  it("002 kendi verisiyle hesaplanır: adı verilmiş şirkette Şirket Adı tamam, 001'in cari/banka verisi 002'ye geçmez", async () => {
    assert.equal((await admin.post("/api/workspace/accounts", { name: "001 Carisi", type: "customer" })).status, 200);
    const s1 = await state(admin);
    assert.equal(doneOf(s1).account, true);
    assert.equal(doneOf(s1).company, false, "001 adı varsayılan (Şirket 1)");
    const s2 = await state(admin, second.id);
    assert.equal(s2.established, false);
    assert.deepEqual(doneOf(s2), { ...ALL_OPEN, company: true });
    assert.equal(s2.hidden, false);
  });
});

describe("Başlarken: salt okunur lisans", () => {
  it("Gizle / Göster görünüm tercihidir: salt okunur lisansta da yapılabilir (tanıtım kartını kapatmak gibi)", () => {
    assert.equal(allowedWhenReadOnly("/api/workspace/getting-started"), true);
    assert.equal(allowedWhenReadOnly("/api/workspace/getting-started/x"), false);
  });
});

describe("Başlarken: 2.4.3'ten güncellenen (verisi dolu) kurulum listeyle karşılaşmaz", { skip: !fixtureExists(FIXTURE) && "fikstür yok" }, () => {
  let unpacked;
  let server;
  let admin;
  let registry;
  before(async () => {
    unpacked = unpackFixture(FIXTURE);
    registry = unpacked.fixture.registry;
    server = await startTestServer({ dataDir: unpacked.dataDir });
    admin = await loginAdmin(server);
  });
  after(async () => {
    await server?.close();
    unpacked?.cleanup();
  });

  it("v2.4.3'ün gerçek koduyla üretilen 001 ve 002: ikisi de 'zaten kurulu', liste görünmez (adımlar eksik olsa da)", async () => {
    assert.ok(registry?.length === 2, JSON.stringify(registry));
    for (const company of registry) {
      const s = await state(admin, company.id);
      assert.equal(s.allowed, true);
      assert.equal(s.established, true, `${company.code} kurulu sayılmalı`);
      assert.equal(s.show, false, `${company.code} listeyle karşılaşmaz`);
      assert.ok(s.done < s.total, `${company.code}: fikstürde bilerek eksik adım var (${JSON.stringify(doneOf(s))})`);
    }
  });
});
