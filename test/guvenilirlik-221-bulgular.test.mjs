// 2.0.21 güvenilirlik testlerinin (rastgele sıra, tatbikat, göç, arıza) BULDUĞU hataların kalıcı regresyon testleri.
// Her biri düzeltmeden önce kırmızıydı; bulan test ve tohum yanında yazılı.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ADMIN_PASSWORD, createUser, loginAdmin, startTestServer } from "./helpers.mjs";

const data = response => response.data?.data ?? response.data;

describe("001'in verisini 'Tümünü Sıfırla' ortak katmanı silmez", () => {
  // Bulan: rastgele sıra testi, tohum 1 (boş kurulum), işlem 149–151: 001 "all" ile sıfırlanınca işlemi yapan yöneticinin
  // seçili şirketi kayboldu; sonraki istekleri 002 yerine 001'e gitti ("Cari bulunamadı"). Kök neden: resetData "all"
  // kipinde KEEP_SETTINGS dışındaki bütün ayarları siliyordu; 001'in veri tabanı aynı zamanda ortak katman olduğundan
  // kullanıcıların şirket seçimi (company.user.*), ŞİRKET YETKİLERİ (company.access.*) ve yönetici parolası kurtarma
  // anahtarı (auth.recovery) da siliniyordu. Yetkisi yalnız 002 olan personel 001'i görmeye başlıyordu.
  test("seçili şirket, şirket yetkileri ve kurtarma anahtarı kalır; 001'in kendi verisi sıfırlanır", async () => {
    const server = await startTestServer();
    try {
      const admin = await loginAdmin(server);
      assert.equal((await admin.post("/api/workspace/accounts", { name: "Bir Numaralı Cari", type: "customer" })).status, 200);
      const second = data(await admin.post("/api/companies", { code: "002", name: "İkinci Şirket" })).company;
      const staff = await createUser(server, admin, { username: "personel2", role: "personel" });
      const staffId = data(await staff.get("/api/auth/me")).id;
      assert.equal((await admin.put(`/api/companies/access/${staffId}`, { companies: [second.id] })).status, 200);
      assert.equal((await staff.post("/api/companies/select", { id: "sirket-001" })).status, 403, "personel 001'i göremez");
      assert.equal((await admin.post("/api/admin/recovery", {})).status, 200);
      assert.equal((await admin.post("/api/companies/select", { id: second.id })).status, 200);
      const before = data(await admin.post("/api/workspace/accounts", { name: "İkinci Şirketin Carisi", type: "customer" }));

      const reset = await admin.post("/api/companies/sirket-001/reset", { mode: "all", confirm: "001", password: ADMIN_PASSWORD });
      assert.equal(reset.status, 200, JSON.stringify(reset.data));

      assert.equal(data(await admin.get("/api/companies")).current, second.id, "yöneticinin seçili şirketi 002 kaldı");
      const after = data(await admin.post(`/api/workspace/accounts/${before.id}/entries`, { kind: "debt", amount: 100 }));
      assert.equal(after.id, before.id, "yöneticinin isteği hâlâ 002'ye gidiyor");
      assert.deepEqual(data(await staff.get("/api/companies")).companies.map(item => item.code), ["002"], "personelin şirket yetkisi (yalnız 002) kaldı");
      assert.equal((await staff.post("/api/companies/select", { id: "sirket-001" })).status, 403, "personel 001'i yine göremez");
      assert.equal(data(await admin.get("/api/admin/recovery")).exists, true, "kurtarma anahtarı silinmedi");
      // 001'in kendi verisi gerçekten sıfırlandı.
      assert.equal((await admin.post("/api/companies/select", { id: "sirket-001" })).status, 200);
      assert.equal(data(await admin.get("/api/workspace/accounts?status=all")).accounts.length, 0);
    } finally {
      await server.close();
    }
  });
});
