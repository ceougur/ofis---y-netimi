// 2.4.3 H9 (kullanıcı kararı 18.10.2026: "a) evet görsün"): Muhasebe rolü Finans Raporları'nı (mizan, ekstre, Rapor Merkezi,
// Vade Takip) varsayılan olarak görür. Yönetici kişiden kaldırabilir (kişiye özel ayar "remove"); personel görmez; özel rol
// kendi listesiyle kalır; ANLIK DURUM kartı (overview.card) yine yalnız yöneticide.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { can, resolvePermissions } from "../server/lib/permissions.mjs";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";

describe("2.4.3 H9: Muhasebe Finans Raporları'nı varsayılan olarak görür", () => {
  let server;
  let admin;
  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
  });
  after(async () => {
    await server?.close();
  });

  it("rol matrisi: muhasebe overview.view taşır; ANLIK DURUM kartı yalnız yöneticide; personel ve avukat değişmez", () => {
    assert.equal(can("muhasebe", "overview.view"), true);
    assert.equal(can("muhasebe", "overview.card"), false);
    assert.equal(can("personel", "overview.view"), false);
    assert.equal(can("avukat", "overview.view"), false);
    assert.ok(resolvePermissions({ role: "muhasebe", grants_json: "[]" }).includes("overview.view"));
    assert.ok(!resolvePermissions({ role: "muhasebe", grants_json: JSON.stringify({ add: [], remove: ["overview.view"] }) }).includes("overview.view"), "kişiden kaldırılan yetki kalkar");
    assert.ok(!resolvePermissions({ role: "muhasebe" }, { permissions: ["invoices.view"] }).includes("overview.view"), "özel rol kendi listesiyle kalır");
  });

  it("ekrandan: muhasebe mizan, Vade Takip ve Rapor Merkezi'ni açar; yönetici kaldırınca 403; personel 403", async () => {
    const muhasebe = await createUser(server, admin, { username: "muh243", role: "muhasebe" });
    const personel = await createUser(server, admin, { username: "per243" });
    assert.equal((await muhasebe.get("/api/workspace/overview/mizan?preset=thisMonth")).status, 200, "mizan");
    assert.equal((await muhasebe.get("/api/workspace/overview/vade-takip?preset=open")).status, 200, "vade takip");
    const catalog = await muhasebe.get("/api/workspace/report-center");
    assert.equal(catalog.status, 200, "Rapor Merkezi kataloğu");
    const groups = new Set((catalog.data.data.reports || catalog.data.data.items || catalog.data.data).map(report => report.group));
    assert.ok(groups.has("Cari") && groups.has("Kasa"), `muhasebe Cari ve Kasa raporlarını görür: ${[...groups].join(", ")}`);
    assert.equal((await personel.get("/api/workspace/overview/mizan?preset=thisMonth")).status, 403, "personel mizanı görmez");

    const users = (await admin.get("/api/admin/users")).data.data;
    const target = (Array.isArray(users) ? users : users.users).find(user => user.username === "muh243");
    assert.equal((await admin.patch(`/api/admin/users/${target.id}`, { grants: { add: [], remove: ["overview.view"] } })).status, 200);
    assert.equal((await muhasebe.get("/api/workspace/overview/mizan?preset=thisMonth")).status, 403, "yönetici kaldırınca mizan kapanır");
  });
});
