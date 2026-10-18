// 2.4.3 keşif bulguları C14 / C15 (docs/kanit/2026-10-17/ux-kesif/RAPOR-C.md; iş listesi 55, 56) — sunucu kataloğu:
//  C14 "Banka ve POS Hareketleri" Banka grubunda (önceden Kasa), "… ve Banka Hareketleri" raporlarının yanında; yetkisi değişmez (Finans Raporları
//      yeter, Banka Raporları istenmez); hesap seçenekleri (choices) yine yalnız Banka Raporları yetkisine.
//  C15 Banka Nakit Akış Raporu ileriye dönüktür: katalogda presets "future" (ekran ileriye dönük dönem düğmeleri gösterir); öbür raporlarda yok.
// Ekran tarafı test/e2e/senaryo-banka-rapor-243.mjs. Eski kodda (4d546e9) kırmızı.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createUser } from "./helpers.mjs";
import { apiOf } from "./banka-210-ortak.mjs";
import { BANK, TODAY, bootBank, must, openAccount } from "./banka-210-hesap-ortak.mjs";

const RC = "/api/workspace/report-center";
const GROUP_ORDER = ["Cari", "Kasa", "Stok", "Fatura", "Çek / Senet", "Taksit", "Banka", "Ana Defter", "Kayıtlar", "Ofis"];

describe("2.4.3 C14 / C15 — Rapor Merkezi kataloğu", () => {
  let ctx;
  let api;
  let ziraat;
  before(async () => {
    ctx = await bootBank();
    api = ctx.api;
    await must("sihirbazı kapat", api.post(`${BANK}/setup/dismiss`, {}));
    ziraat = await openAccount(api, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "10.000", confirmed: true } });
    await openAccount(api, { bankName: "Garanti BBVA", name: "Ana TL Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "5.000", confirmed: true } });
    const abc = await must("cari", api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer" }));
    await must("havale tahsilatı", api.post(`/api/workspace/accounts/${abc.id}/entries`, { kind: "in", method: "bank", bankAccountId: ziraat.id, date: TODAY, amount: "1.250" }));
  });
  after(() => ctx?.server.close());

  it("C14: Banka ve POS Hareketleri Banka grubunda, Taksit ve Banka Hareketleri'nden sonra, Banka Nakit Akış'tan önce; grup sırası bozulmaz", async () => {
    const catalog = await must("katalog", api.get(RC));
    const report = catalog.reports.find(item => item.id === "banka-pos-hareketleri");
    assert.equal(report?.group, "Banka");
    assert.equal(report.title, "Banka ve POS Hareketleri");
    assert.deepEqual(report.params, ["range", "payMethod", "anyAccount"], "süzgeçleri değişmez");
    const bank = catalog.reports.filter(item => item.group === "Banka").map(item => item.id);
    assert.equal(bank[0], "banka-bakiye", "Banka grubunun ilk raporu yine Banka Bakiye Raporu");
    assert.equal(bank.indexOf("banka-pos-hareketleri"), bank.indexOf("taksit-banka-hareketleri") + 1, bank.join(", "));
    assert.equal(bank.indexOf("banka-nakit-akis"), bank.indexOf("banka-pos-hareketleri") + 1, bank.join(", "));
    assert.ok(!catalog.reports.some(item => item.group === "Kasa" && /Banka|POS/.test(item.title)), "Kasa grubunda banka/POS raporu kalmadı");
    const groups = [...new Set(catalog.reports.map(item => item.group))];
    assert.deepEqual(groups, GROUP_ORDER.filter(name => groups.includes(name)));
    assert.ok(Array.isArray(catalog.choices?.anyAccount) && catalog.choices.anyAccount.some(([id]) => id === ziraat.id), "yönetici: Hesap seçenekleri");
  });

  it("C14 yetki: Finans Raporları rolü raporu Banka grubunda görür ve açar; hesap seçenekleri dönmez; Banka Raporları raporları kapalı kalır; personel 403", async () => {
    const role = await must("rol", api.post("/api/admin/roles", { name: "Finans Okuyucu 243", permissions: ["overview.view", "accounts.view"] }));
    const reader = apiOf(await createUser(ctx.server, api.client, { username: "f243-finans", role: role.id }));
    const list = await must("finans katalog", reader.get(RC));
    assert.deepEqual(list.reports.filter(item => item.group === "Banka").map(item => item.id), ["banka-pos-hareketleri"]);
    assert.ok(!list.choices, "hesap seçenekleri yalnız Banka Raporları yetkisine");
    const data = await must("rapor", reader.get(`${RC}/banka-pos-hareketleri?preset=all`));
    assert.equal(data.group, "Banka");
    assert.ok(data.rows.some(row => row.some(cell => /1\.250,00 TL/.test(cell))), "havale satırı (rapor içeriği değişmedi; dosya biçimi TL)");
    for (const id of ["banka-bakiye", "banka-hareket", "banka-nakit-akis"]) assert.equal((await reader.get(`${RC}/${id}`)).status, 403, `finans ${id}`);
    const staff = apiOf(await createUser(ctx.server, api.client, { username: "f243-personel", role: "personel" }));
    assert.equal((await staff.get(`${RC}/banka-pos-hareketleri?preset=all`)).status, 403, "personel");
  });

  it("C15: Banka Nakit Akış Raporu katalogda ileriye dönük (presets future); öbür raporlarda presets yok; ileriye dönük aralık kapsamda", async () => {
    const catalog = await must("katalog", api.get(RC));
    const flow = catalog.reports.find(item => item.id === "banka-nakit-akis");
    assert.equal(flow?.presets, "future");
    assert.deepEqual(catalog.reports.filter(item => item.presets).map(item => item.id), ["banka-nakit-akis"]);
    const next = await must("önümüzdeki 30 gün", api.get(`${RC}/banka-nakit-akis?from=${TODAY}&to=2026-11-07`));
    assert.match(next.subtitle, /08\.10\.2026 itibarıyla · 08\.10\.2026 – 07\.11\.2026/);
    const all = await must("tüm beklenenler", api.get(`${RC}/banka-nakit-akis?preset=all`));
    assert.match(all.subtitle, /Bütün beklenenler/);
  });
});
