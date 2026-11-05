// 2.5.0 Ç4 — Defter Türü şirket ayarı (docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md §5; BAŞ MİMAR KARARI S2, docs/2.5.0-IS-LISTESI.md D).
// Beklenen (kâhin): plan §5 metni ve görev metni — dört değer (Bilanço Esası / İşletme Hesabı Esası / Serbest Meslek Kazanç Defteri / Seçilmedi), şirket başına,
// varsayılan "Seçilmedi", sessiz çıkarım yok, Sıfırla korur ("accounting." KEEP_SETTINGS; "ledger." YOK → dönem kilidi kalkar), yetki invoices.settings
// (yönetici + muhasebe), yedekle gider / gelir, iki şirket karışmaz, BS-7 kapılı şirkette yazım 409.
// Nasıl bozulur (testler buradan): (1) yetkisiz rol (avukat / personel) değiştirir; (2) geçersiz değer (ekran adı, boş, sayı, bilinmeyen kod) kaydedilir
// ya da yarım kayıt bırakır; (3) Şirket Verisini Sıfırla (Tüm Hareketleri Sil / Tümünü Sıfırla) ayarı siler — ya da "ledger." da korunup kilit kalır;
// (4) yedek → değiştir → geri yükle ayarı geri getirmez (002 hemen, 001 yeniden açılışta); (5) 002'nin ayarı 001'e sızar; (6) kapılı (yeni şemalı)
// şirkete yazılır; (7) eski sürüm verisinde ya da ayar satırı olmadan Kişi Türü / VKN uzunluğundan tür uydurulur (eski sürümün gerçek koduyla:
// test/defter-turu-c4-eski-surum.mjs); (8) kısmi kayıt (bookType'sız gövde) ayarı siler; (9) bozuk kayıtlı değer okuyucuyu bozar.
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, describe, test } from "node:test";
import { ROOT_COMPANY_ID } from "../server/lib/companies.mjs";
import { resolveDbPath } from "../server/lib/db-path.mjs";
import { LATEST_VERSION } from "../server/lib/migrations.mjs";
import { ADMIN_PASSWORD, createUser, loginAdmin, removeTestDir, startTestServer } from "./helpers.mjs";

const URL_SETTINGS = "/api/workspace/invoices/settings";
const LABELS = { unset: "Seçilmedi", balance: "Bilanço Esası", operating: "İşletme Hesabı Esası", professional: "Serbest Meslek Kazanç Defteri" };
const roots = [];
after(() => {
  for (const dir of roots) removeTestDir(dir);
});
const workDir = () => {
  const dir = mkdtempSync(path.join(tmpdir(), "destekofis-c4-"));
  roots.push(dir);
  return dir;
};
const unwrap = response => (response.data && typeof response.data === "object" && "ok" in response.data && response.data.ok ? response.data.data : response.data);
const ok200 = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return unwrap(res);
};
const bookType = async (client, q = "") => (await ok200("ayar oku", client.get(`${URL_SETTINGS}${q}`))).bookType;
const settingRow = (file, key = "accounting.bookType") => {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    return db.prepare("SELECT value FROM settings WHERE key = ?").get(key)?.value ?? null;
  } finally {
    db.close();
  }
};

describe("2.5.0 Ç4 Defter Türü", () => {
  test("varsayılan Seçilmedi; seçenekler yazım düzeninde; Kişi Türü / VKN uzunluğundan tür uydurulmaz; kaydedilir ve yeniden okunur", async () => {
    const server = await startTestServer();
    try {
      const admin = await loginAdmin(server);
      const first = await ok200("ilk okuma", admin.get(URL_SETTINGS));
      assert.equal(first.bookType, "unset");
      assert.deepEqual(first.bookTypes, Object.entries(LABELS).map(([code, label]) => ({ code, label })));
      // Gerçek kişi + 11 haneli TCKN (serbest meslek / işletme "gibi") ve tüzel kişi + 10 haneli VKN (bilanço "gibi"): ikisinde de Seçilmedi kalır.
      await ok200("gerçek kişi", admin.put(URL_SETTINGS, { seller: { name: "Ayşe Demir", partyKind: "person", firstName: "Ayşe", familyName: "Demir", taxNo: "12345678950" } }));
      assert.equal(await bookType(admin), "unset", "gerçek kişiden tür uydurulmamalı");
      await ok200("tüzel kişi", admin.put(URL_SETTINGS, { seller: { name: "Demir Ltd. Şti.", partyKind: "company", taxNo: "4840847211" } }));
      assert.equal(await bookType(admin), "unset", "tüzel kişiden tür uydurulmamalı");
      assert.equal(settingRow(resolveDbPath(server.dataDir)), null, "ayar satırı seçilmeden yazılmaz");
      for (const code of ["balance", "operating", "professional", "unset", "balance"]) {
        const saved = await ok200(`kaydet ${code}`, admin.put(URL_SETTINGS, { bookType: code }));
        assert.equal(saved.bookType, code);
        assert.equal(await bookType(admin), code, `yeniden okununca ${code}`);
      }
      // Kısmi kayıt (Entegratör Ayarları / Firma Bilgisi gibi bookType'sız gövde) ayarı silmez.
      await ok200("kısmi kayıt", admin.put(URL_SETTINGS, { defaults: { dueDays: 15 } }));
      assert.equal(await bookType(admin), "balance");
      // Değişiklik Geçmişi'nde iz.
      const db = new DatabaseSync(resolveDbPath(server.dataDir), { readOnly: true });
      try {
        const rows = db.prepare("SELECT payload_json FROM audit_events WHERE type = 'accounting.book_type.updated' ORDER BY rowid").all().map(row => JSON.parse(row.payload_json));
        assert.deepEqual(rows.map(row => `${row.from}>${row.to}`), ["unset>balance", "balance>operating", "operating>professional", "professional>unset", "unset>balance"]);
      } finally {
        db.close();
      }
    } finally {
      await server.close();
    }
  });

  test("geçersiz değer 400 ve hiçbir ayar yazılmaz (aynı gövdedeki firma bilgisi de)", async () => {
    const server = await startTestServer();
    try {
      const admin = await loginAdmin(server);
      await ok200("kaydet", admin.put(URL_SETTINGS, { bookType: "operating", seller: { name: "Önceki Unvan" } }));
      for (const bad of ["Bilanço Esası", "", "BALANCE", "ledger", 1, null, true, ["balance"], { code: "balance" }]) {
        const res = await admin.put(URL_SETTINGS, { bookType: bad, seller: { name: "Olmamalı" } });
        assert.equal(res.status, 400, `${JSON.stringify(bad)}: ${res.status} ${JSON.stringify(res.data)}`);
        assert.equal(res.data.code, "book-type-invalid");
        assert.equal(res.data.error, "Defter Türü seçimi tanınmadı.");
      }
      const after = await ok200("oku", admin.get(URL_SETTINGS));
      assert.equal(after.bookType, "operating");
      assert.equal(after.seller.name, "Önceki Unvan", "reddedilen gövdenin firma bilgisi yazılmadı");
    } finally {
      await server.close();
    }
  });

  test("yetki: yönetici ve muhasebe değiştirir; avukat ve personel 403 (ayar değişmez)", async () => {
    const server = await startTestServer();
    try {
      const admin = await loginAdmin(server);
      const muhasebe = await createUser(server, admin, { username: "c4-muhasebe", role: "muhasebe" });
      const avukat = await createUser(server, admin, { username: "c4-avukat", role: "avukat" });
      const personel = await createUser(server, admin, { username: "c4-personel", role: "personel" });
      assert.equal((await ok200("muhasebe kaydeder", muhasebe.put(URL_SETTINGS, { bookType: "professional" }))).bookType, "professional");
      for (const [name, client] of [["avukat", avukat], ["personel", personel]]) {
        const denied = await client.put(URL_SETTINGS, { bookType: "balance" });
        assert.equal(denied.status, 403, `${name}: ${denied.status} ${JSON.stringify(denied.data)}`);
      }
      assert.equal(await bookType(admin), "professional", "reddedilen istekler ayarı değiştirmedi");
    } finally {
      await server.close();
    }
  });

  test("Şirket Verisini Sıfırla: Tüm Hareketleri Sil ve Tümünü Sıfırla ayarı KORUR; dönem kilidi (ledger.) kalkar", async () => {
    const server = await startTestServer();
    try {
      const admin = await loginAdmin(server);
      const file = resolveDbPath(server.dataDir);
      for (const mode of ["movements", "all"]) {
        await ok200("kaydet", admin.put(URL_SETTINGS, { bookType: "operating" }));
        await ok200("dönem kilidi", admin.put("/api/admin/period-lock", { lockedUntil: "2025-12-31" }));
        assert.equal(settingRow(file, "ledger.lockedUntil"), "2025-12-31", "ön koşul: kilit yazıldı");
        await ok200(`sıfırla ${mode}`, admin.post(`/api/companies/${ROOT_COMPANY_ID}/reset`, { mode, confirm: "001", password: ADMIN_PASSWORD }));
        assert.equal(await bookType(admin), "operating", `${mode}: Defter Türü korunmalı`);
        assert.equal(settingRow(file), "operating");
        assert.equal(settingRow(file, "ledger.lockedUntil"), null, `${mode}: dönem kilidi bilerek silinir ("ledger." korunmaz)`);
        assert.equal((await ok200("kilit oku", admin.get("/api/workspace/ledger/lock"))).lockedUntil, "");
        // Dar kontrol DÜŞÜK (koruma): KEEP_SETTINGS'in "accounting." öneki bugün YALNIZ Defter Türü'nü korur. İleride eklenen accounting.* anahtarı (sayaç,
        // dondurma işareti) sıfırlamada sessizce kalırsa burada kırmızı olur → korunup korunmayacağı bilinçli karara bağlanır (app.mjs KEEP_SETTINGS).
        const db = new DatabaseSync(file, { readOnly: true });
        try {
          const kept = db.prepare("SELECT key FROM settings WHERE key LIKE 'accounting.%' ORDER BY key").all().map(row => row.key);
          assert.deepEqual(kept, ["accounting.bookType"], `${mode}: sıfırlamadan sonra korunan accounting.* anahtarları`);
        } finally {
          db.close();
        }
      }
    } finally {
      await server.close();
    }
  });

  test("iki şirket ayrı ayar; yedek → değiştir → geri yükle: 002 hemen, 001 yeniden açılışta geri gelir; öbür şirket etkilenmez", async () => {
    const dir = workDir();
    const dataDir = path.join(dir, "data");
    const backupDir = path.join(dir, "backups");
    let server = await startTestServer({ dataDir, backupDir });
    let second;
    let rootBackup;
    try {
      const admin = await loginAdmin(server);
      second = await ok200("002", admin.post("/api/companies", { name: "İkinci Şirket", select: false }));
      second = second.company || second;
      const q = `?hofCompany=${encodeURIComponent(second.id)}`;
      assert.equal(await bookType(admin, q), "unset", "yeni şirket Seçilmedi başlar");
      await ok200("001 kaydet", admin.put(URL_SETTINGS, { bookType: "balance" }));
      await ok200("002 kaydet", admin.put(`${URL_SETTINGS}${q}`, { bookType: "professional" }));
      assert.equal(await bookType(admin), "balance", "002'nin ayarı 001'e sızmadı");
      assert.equal(await bookType(admin, q), "professional");
      const secondFile = resolveDbPath(server.app.companies.dirsOf(server.app.companies.get(second.id)).dataDir);
      assert.equal(settingRow(secondFile), "professional", "ayar 002'nin kendi veri dosyasında");
      assert.equal(settingRow(resolveDbPath(dataDir)), "balance");
      // Yedekler, sonra iki şirkette değişiklik.
      const backup002 = unwrap(await admin.post("/api/admin/backups", { scope: "one", companyId: second.id })).name;
      rootBackup = unwrap(await admin.post("/api/admin/backups", { scope: "one", companyId: ROOT_COMPANY_ID })).name;
      assert.ok(backup002 && rootBackup, "yedekler alındı");
      await ok200("002 değiştir", admin.put(`${URL_SETTINGS}${q}`, { bookType: "operating" }));
      await ok200("001 değiştir", admin.put(URL_SETTINGS, { bookType: "unset" }));
      // 002 geri yüklenir: hemen döner, 001 değişmez.
      await ok200("002 geri yükle", admin.post("/api/admin/backups/restore", { name: backup002, company: second.id, confirm: "002", password: ADMIN_PASSWORD }));
      assert.equal(await bookType(admin, q), "professional", "002 yedekteki ayara döndü");
      assert.equal(await bookType(admin), "unset", "002'nin geri yüklenmesi 001'e dokunmadı");
      // 001 geri yüklemesi hazırlanır (yeniden açılışta uygulanır).
      const staged = await ok200("001 geri yükle", admin.post("/api/admin/backups/restore", { name: rootBackup, company: ROOT_COMPANY_ID, confirm: "001", password: ADMIN_PASSWORD }));
      assert.equal(staged.staged, true);
    } finally {
      await server.close();
    }
    server = await startTestServer({ dataDir, backupDir });
    try {
      assert.equal(server.app.stagedRestore?.ok, true, JSON.stringify(server.app.stagedRestore));
      const admin = await loginAdmin(server);
      assert.equal(await bookType(admin), "balance", "001 yedekteki ayara döndü");
      assert.equal(await bookType(admin, `?hofCompany=${encodeURIComponent(second.id)}`), "professional", "001'in geri yüklenmesi 002'ye dokunmadı");
    } finally {
      await server.close();
    }
  });

  test("BS-7 kapılı (yeni şemalı) şirkette Defter Türü yazımı 409 SCHEMA_AHEAD; okuma çalışır, dosya değişmez", async () => {
    const dir = workDir();
    const dataDir = path.join(dir, "data");
    const backupDir = path.join(dir, "backups");
    let server = await startTestServer({ dataDir, backupDir });
    let second;
    let secondFile;
    try {
      const admin = await loginAdmin(server);
      second = await ok200("002", admin.post("/api/companies", { name: "İkinci Şirket", select: false }));
      second = second.company || second;
      await ok200("002 kaydet", admin.put(`${URL_SETTINGS}?hofCompany=${encodeURIComponent(second.id)}`, { bookType: "balance" }));
      secondFile = resolveDbPath(server.app.companies.dirsOf(server.app.companies.get(second.id)).dataDir);
    } finally {
      await server.close();
    }
    const db = new DatabaseSync(secondFile);
    try {
      db.exec(`PRAGMA user_version = ${LATEST_VERSION + 1}`);
    } finally {
      db.close();
    }
    server = await startTestServer({ dataDir, backupDir });
    try {
      const admin = await loginAdmin(server);
      const q = `?hofCompany=${encodeURIComponent(second.id)}`;
      assert.equal(await bookType(admin, q), "balance", "kapılı şirkette okuma çalışır");
      const refused = await admin.put(`${URL_SETTINGS}${q}`, { bookType: "operating" });
      assert.equal(refused.status, 409, JSON.stringify(refused.data));
      assert.equal(refused.data.code, "SCHEMA_AHEAD");
      assert.equal(await bookType(admin, q), "balance");
      // 001 (normal şema) yazılabilir.
      assert.equal((await ok200("001 kaydet", admin.put(URL_SETTINGS, { bookType: "operating" }))).bookType, "operating");
    } finally {
      await server.close();
    }
    assert.equal(settingRow(secondFile), "balance", "kapılı şirketin dosyası değişmedi");
  });

  test("Değişiklik Geçmişi: üç ayar türü 'Ayarlar' süzgecinde; Defter Türü satırı eski → yeni ekran adlarını taşır; istemcide Türkçe adları var", async () => {
    const server = await startTestServer();
    try {
      const admin = await loginAdmin(server);
      await ok200("kaydet", admin.put(URL_SETTINGS, { bookType: "balance", reportHeader: { signName: "Defter Market", mode: "sign" } }));
      await ok200("değiştir", admin.put(URL_SETTINGS, { bookType: "professional" }));
      await ok200("ofis adı", admin.put("/api/admin/office", { name: "Ofis" }));
      const filtered = await ok200("Ayarlar süzgeci", admin.get("/api/admin/audit?limit=300&type=settings."));
      const types = new Set(filtered.map(row => row.type));
      for (const type of ["invoice.settings.updated", "office.report_header.updated", "accounting.book_type.updated", "settings.office.updated"]) assert.ok(types.has(type), `Ayarlar süzgecinde ${type} yok: ${[...types].join(", ")}`);
      assert.ok([...types].every(type => type.startsWith("settings.") || ["invoice.settings.updated", "office.report_header.updated", "accounting.book_type.updated"].includes(type)), `süzgece başka tür girmez: ${[...types].join(", ")}`);
      const book = filtered.filter(row => row.type === "accounting.book_type.updated").map(row => `${row.payload.fromLabel} > ${row.payload.toLabel}`);
      assert.deepEqual(book, ["Bilanço Esası > Serbest Meslek Kazanç Defteri", "Seçilmedi > Bilanço Esası"]);
      // Öbür süzgeçler önek olarak çalışmayı sürdürür; "Tümü" de Defter Türü satırına ad ekler.
      const all = await ok200("Tümü", admin.get("/api/admin/audit?limit=300"));
      assert.ok(all.filter(row => row.type === "accounting.book_type.updated").every(row => row.payload.toLabel), "Tümü: ekran adı var");
      const auth = await ok200("Girişler", admin.get("/api/admin/audit?limit=300&type=auth."));
      assert.ok(auth.length > 0 && auth.every(row => row.type.startsWith("auth.")), "Girişler süzgeci yalnız auth.*");
    } finally {
      await server.close();
    }
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(new URL("../client/assets/admin.js", import.meta.url), "utf8");
    for (const [type, label] of [["invoice.settings.updated", "Fatura Ayarları'nı değiştirdi"], ["office.report_header.updated", "Tabela Adı / Rapor ve Ekstre Başlığı'nı değiştirdi"], ["accounting.book_type.updated", "Defter Türü'nü değiştirdi"]]) {
      assert.ok(source.includes(`"${type}": "${label}",`), `admin.js EVENT_LABELS: ${type} → ${label}`);
    }
  });

  test("okuyucu bookTypeOf: store, ham değer, bozuk / bilinmeyen değer → unset; okunamayan store → unset", async () => {
    const { bookTypeOf, bookTypeLabel, BOOK_TYPE_KEY } = await import("../server/lib/book-type.mjs");
    assert.equal(BOOK_TYPE_KEY, "accounting.bookType");
    const storeWith = value => ({ setting: (key, fallback) => (key === BOOK_TYPE_KEY && value !== undefined ? value : fallback) });
    assert.equal(bookTypeOf(storeWith(undefined)), "unset");
    for (const code of ["balance", "operating", "professional", "unset"]) {
      assert.equal(bookTypeOf(storeWith(code)), code);
      assert.equal(bookTypeOf(code), code);
      assert.equal(bookTypeLabel(code), LABELS[code]);
    }
    for (const bad of ["", "Bilanço Esası", "{\"x\":1}", "__proto__", "toString", null, undefined, 7]) assert.equal(bookTypeOf(bad), "unset", JSON.stringify(bad));
    assert.equal(bookTypeOf({ setting: () => { throw new Error("kilitli"); } }), "unset");
  });
});
