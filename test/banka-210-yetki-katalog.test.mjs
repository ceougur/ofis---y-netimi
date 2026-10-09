// 2.1.0 — Aşama 3 (Banka Hesapları), dilim 1: "Banka ve POS" yetki grubu kataloğa girer (docs/BANKA-MODULU-PLAN.md §9.1, §9.2/5, K4;
// Aşama 2 gözden geçirmesi D5'in Aşama 3 kuralı).
//
// ÇALIŞIYOR MU:
//   - Yönetim → Kullanıcılar ve Roller'de "Banka ve POS" grubu Taksitler'in hemen ardından; 11 yetki, adlar başlık yazımıyla.
//   - Yerleşik roller: yönetici ve muhasebe hepsi; avukat hesap/POS/komisyon/ayar dışındakiler; personel hiçbiri.
//   - Salt okunur lisansta gizlenen yazma yetkileri: bütün banka yazma yetkileri ve (açık kapanır) invoices.manage / invoices.settings.
//   - Yöneticinin rol ve kişi ekranında bilinçli olarak kaldırdığı banka yetkisi yeniden başlatmada geri gelmez ("verildi" işareti kayıtta
//     korunur, ekranda görünmez); işaretsiz eski kayıtlar (eski sürümün kaydı) yine göçün kuralıyla tamamlanır.
// NASIL BOZARIM:
//   - Kişiden bank.cancel kaldırılır → muhasebe rolü matriste verse de banka bağlı satırı silme 403 (rol matrisine geri düşüş yok).
//   - Rol kaydına "bank.granted" göndermek → 400 (verilebilir yetki değil); işaret API yanıtında hiçbir yerde görünmez.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { WRITE_PERMISSIONS } from "../server/lib/license.mjs";
import { PERMISSIONS, PERMISSION_GROUPS, PERMISSION_ORDER, permissionsFor, resolvePermissions } from "../server/lib/permissions.mjs";
import { titleCase } from "../server/lib/text-case.mjs";
import { apiOf } from "./banka-210-ortak.mjs";
import { createUser } from "./helpers.mjs";
import { bootBank, expectStatus, must } from "./banka-210-hesap-ortak.mjs";

const BANK_KEYS = ["bank.view", "bank.reports", "bank.accounts", "bank.move", "bank.cancel", "bank.transfer", "bank.pos", "bank.commission", "bank.statement", "bank.reconcile", "bank.settings"];

describe("Aşama 3 — Banka ve POS yetki grubu", () => {
  it("katalog: grup Taksitler'in ardından, 11 yetki, başlık yazımı; yerleşik roller §9.1", () => {
    const index = PERMISSION_GROUPS.findIndex(group => group.id === "bank");
    assert.ok(index > 0, "banka grubu var");
    assert.equal(PERMISSION_GROUPS[index - 1].id, "plans", "Taksitler'in hemen ardından");
    const group = PERMISSION_GROUPS[index];
    assert.equal(group.label, "Banka ve POS");
    assert.deepEqual(group.items.map(([key]) => key), BANK_KEYS);
    for (const [, label] of group.items) assert.equal(titleCase(label), label, label);
    for (const key of BANK_KEYS) assert.ok(PERMISSION_ORDER.includes(key) && Object.hasOwn(PERMISSIONS, key), key);
    assert.deepEqual(permissionsFor("muhasebe").filter(key => key.startsWith("bank.")), BANK_KEYS);
    assert.deepEqual(permissionsFor("admin").filter(key => key.startsWith("bank.")), BANK_KEYS);
    assert.deepEqual(permissionsFor("avukat").filter(key => key.startsWith("bank.")), ["bank.view", "bank.reports", "bank.move", "bank.cancel", "bank.transfer", "bank.statement", "bank.reconcile"]);
    assert.deepEqual(permissionsFor("personel").filter(key => key.startsWith("bank.")), []);
  });

  it("salt okunurda gizlenen yazma yetkileri: banka yazma yetkileri ve invoices.manage / invoices.settings", () => {
    for (const key of ["bank.accounts", "bank.move", "bank.cancel", "bank.transfer", "bank.pos", "bank.commission", "bank.statement", "bank.reconcile", "bank.settings", "invoices.manage", "invoices.settings"]) assert.ok(WRITE_PERMISSIONS.includes(key), key);
    for (const key of ["bank.view", "bank.reports", "invoices.view"]) assert.ok(!WRITE_PERMISSIONS.includes(key), key);
  });

  it("kişiye özel kaldırma rol matrisine geri düşmez (resolvePermissions)", () => {
    const user = { role: "muhasebe", grants_json: JSON.stringify({ add: [], remove: ["bank.cancel"] }) };
    const perms = resolvePermissions(user);
    assert.ok(!perms.includes("bank.cancel"));
    assert.ok(perms.includes("bank.move"));
  });
});

describe("Aşama 3 — yöneticinin bilinçli kararı yeniden başlatmada korunur", () => {
  let ctx;
  before(async () => {
    ctx = await bootBank();
  });
  after(() => ctx.server.close());

  it("rol: banka yetkisi seçilmeden açılan rol ve bank.move'u kaldırılan rol yeniden başlatınca aynı kalır; işaret görünmez", async () => {
    const { api, app } = ctx;
    const created = await must("rol", api.post("/api/admin/roles", { name: "Satış Sorumlusu", description: "", permissions: ["stock.view", "stock.sell", "cash.view", "bank.view"] }));
    const roles = await must("roller", api.get("/api/admin/roles"));
    const role = roles.custom.find(item => item.key === created.id);
    assert.deepEqual(role.permissions.filter(key => key.startsWith("bank.")), ["bank.view"], "yönetici yalnız bank.view seçti; göç bank.move eklemez");
    assert.ok(!role.permissions.includes("bank.granted"));
    expectStatus(await api.client.patch(`/api/admin/roles/${created.id}`, { permissions: [...role.permissions, "bank.granted"] }).then(res => ({ status: res.status, code: res.data?.code, data: res.data })), 400, null, "işaret verilemez");
    // Ortak katmanın açılışındaki yeniden değerlendirme (göç kuralı) bilinçli kararı değiştirmez.
    app.store.tx(() => {});
    const { migrateBankGrants } = await import("../server/lib/bank/grants.mjs");
    app.store.tx(() => migrateBankGrants(app.store));
    const again = (await must("roller", api.get("/api/admin/roles"))).custom.find(item => item.key === created.id);
    assert.deepEqual(again.permissions.filter(key => key.startsWith("bank.")), ["bank.view"]);
    const raw = JSON.parse(app.store.get("SELECT permissions_json AS p FROM roles WHERE id = ?", created.id).p);
    assert.ok(raw.includes("bank.granted"), "kayıtta işaret var (ekranda yok)");
  });

  it("kişi: muhasebeden bank.cancel kaldırılır → göç geri eklemez; banka bağlı satırı silemez (403)", async () => {
    const { api, app } = ctx;
    await createUser(ctx.server, api.client, { username: "muhasebe9", role: "muhasebe" });
    const users = await must("kullanıcılar", api.get("/api/admin/users"));
    const target = users.find(user => user.username === "muhasebe9");
    const patched = await api.client.patch(`/api/admin/users/${target.id}`, { grants: { add: [], remove: ["bank.cancel"] } });
    assert.equal(patched.status, 200, JSON.stringify(patched.data));
    const { migrateBankGrants } = await import("../server/lib/bank/grants.mjs");
    app.store.tx(() => migrateBankGrants(app.store));
    const after = (await must("kullanıcılar", api.get("/api/admin/users"))).find(user => user.username === "muhasebe9");
    assert.ok(!after.permissions.includes("bank.cancel"), JSON.stringify(after.permissions));
    assert.ok(after.permissions.includes("bank.move"));
    assert.ok(!after.grants.add.includes("bank.granted") && !after.grants.remove.includes("bank.granted"), "işaret ekrana gönderilmez");
    const raw = JSON.parse(app.store.get("SELECT grants_json AS g FROM users WHERE id = ?", target.id).g);
    assert.ok(raw.add.includes("bank.granted"));
    // bank.post'un çapraz yetki denetimi: kişinin etkin yetkisi (rol matrisine geri düşüş yok).
    const user = app.store.get("SELECT * FROM users WHERE id = ?", target.id);
    let error = null;
    try {
      app.context.bank.post({ user, module: "test", op: "delete", prev: { fin_ref: "bacc-x", event_id: "" }, write: () => ({}) });
    } catch (caught) {
      error = caught;
    }
    assert.equal(error?.status, 403, error?.message);
  });
});
