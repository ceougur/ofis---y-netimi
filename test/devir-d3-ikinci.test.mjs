// 2.5.1 D3 TUR 4 — AYNI YIL İKİNCİ KEZ DEVREDİLEMEZ (BAŞ MİMAR KARARI 27.11, kullanıcının "devir yarıda kalırsa veya tekrar çalıştırılırsa çift kayıt oluşmasın" sorusu üzerine; kullanıcıya
// gösterildi): o yılın devri yapılmışsa (çalışma dosyasının devir yılları ya da şirketin arşiv kaydı o yılı gösteriyorsa) ön denetim DURDURUR — neden "bu yıl zaten devredildi", çare
// Devri Yenile ya da Devri Geri Al; devredilmiş yıldan ÖNCEKİ bir yılın devri de DURDURUR; ayarda olup kayıtta olmayan yıl yarıda kalmış devirdir (tasarım §4.2) — DURDURUR, Devir Yedekleri /
// destek. Dördü de DEVİR NEDEN DURDU düzeninde (dört alan). Arşivler D4'ün işinin BENZETİMİYLE (test/devir-d2-yardimci.mjs makeArchive — şirket dosyasının kopyası + işaretler + kayıt).
// Veri programın KENDİ API'sinden. K = 31.12.2026, bugün 10.02.2027. Dosya silen adım (arşiv dosyası yok) Windows'ta da koşar (ders 48; kendi geçici klasörü).
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { DEVIR_YEARS_KEY, makeArchive } from "./devir-d2-yardimci.mjs";
import { apiOf, must } from "./banka-210-ortak.mjs";
import { loginAdmin, removeTestDir, startTestServer } from "./helpers.mjs";
import { katalogaYaz } from "./fixtures/devir-d3-ileti-katalog.mjs";

const iletiModule = await import("../server/lib/devir/iletiler.mjs").catch(() => null);
const K = "2026-12-31";
const ROOT = "sirket-001";
const NEW = ["devir-yil-devredilmis", "devir-sonraki-yil-devredilmis", "devir-yarim-kalmis"];

async function waitPreview(api, body) {
  const started = await must("ön izleme", api.post("/api/admin/devir/preview", body));
  for (let i = 0; i < 600; i += 1) {
    const job = await must("ön izleme durumu", api.get(`/api/admin/devir/preview/${started.id}`));
    if (job.state !== "running") return job;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error("ön izleme bitmedi");
}

describe("D3 tur 4 — aynı yıl ikinci kez devredilemez (bu yıl / sonraki yıl / yarıda kalmış devir; iki şirket)", () => {
  let dir;
  let server;
  let api;
  let second;
  const app = () => server.app;
  const liveStore = id => (id === ROOT ? app().store : app().openCompany(id).store);
  const setYears = (id, years) => liveStore(id).setSetting(DEVIR_YEARS_KEY, typeof years === "string" ? years : JSON.stringify(years));
  const clearYears = id => liveStore(id).run("DELETE FROM settings WHERE key = ?", DEVIR_YEARS_KEY);
  const archiveDirOf = (id, year) => path.join(app().companies.dirsOf(app().companies.get(id)).dataDir, "arsiv", String(year));
  // D3 tur 5 (iş 6, ders 48): arşiv klasörünü silmeden ÖNCE bu süreçte (sunucu + ön izleme iş parçacığı aynı tutamaç tablosunu paylaşır) o klasörün içine açık tutamaç var mı — Linux'ta
  // /proc/self/fd ile ölçülür (Windows'ta açık tutamaçlı dosya silinemez: EBUSY / EPERM). Ölçüm her silmede 0 olmalı; sayılar çıktıya "# tutamaç" satırı olarak yazılır (rapor).
  const handlesUnder = dir => {
    if (process.platform !== "linux") return null;
    const out = [];
    for (const fd of readdirSync("/proc/self/fd")) {
      try {
        const target = readlinkSync(`/proc/self/fd/${fd}`);
        if (target === dir || target.startsWith(`${dir}${path.sep}`)) out.push(target);
      } catch {
        // tutamaç okunurken kapandı
      }
    }
    return out;
  };
  const removeArchiveDir = (id, year, label) => {
    const target = archiveDirOf(id, year);
    const open = handlesUnder(target);
    console.log(`tutamaç ${label}: ${open === null ? "ölçülmedi (Linux değil)" : open.length} — ${path.basename(path.dirname(target))}/${year}`);
    if (open) assert.deepEqual(open, [], `${label}: arşiv klasörünü silmeden önce açık tutamaç`);
    rmSync(target, { recursive: true, force: true });
  };
  // makeArchive VACUUM INTO ile yazar (hedef dosya varsa yazmaz): her benzetimden önce kendi geçici klasörümüzdeki o yılın arşiv klasörü TAM yoluyla silinir. D3 tur 5 (t-3): benzetimin yazdığı
  // devir anı gerçek saatten (makeArchive: new Date()) değil sunucunun SAHTE saatinden — iletideki gün (katalog dahil) koşu gününe bağlı kalmasın.
  const freshArchive = async (id, options) => {
    removeArchiveDir(id, options.year, `benzetimden önce ${options.year}`);
    const made = await makeArchive(app(), id, options);
    if (options.liveYears !== false) {
      const at = new Date(server.clock.ms()).toISOString();
      const years = JSON.parse(liveStore(id).setting(DEVIR_YEARS_KEY, "[]") || "[]").map(item => (item.year === options.year ? { ...item, at } : item));
      setYears(id, years);
    }
    return made;
  };
  const clearArchives = id => {
    for (const entry of app().companies.archivesOf(id)) app().companies.removeArchive(id, entry.year);
    clearYears(id);
  };
  const stops = async (company = ROOT) => {
    const job = await waitPreview(api, { company, cutoff: K, option: "borc-alacak" });
    assert.equal(job.state, "done", JSON.stringify(job.error));
    return job.result.onDenetim.durdurur.filter(row => NEW.includes(row.kod));
  };
  const clean = (ileti, label) => {
    assert.ok(iletiModule, "ileti düzeni yok (eski kod)");
    assert.deepEqual(iletiModule.iletiDenetimi(ileti), [], `${label}: dört alan / yasak kalıp`);
    assert.ok(ileti.neOldu && ileti.neden && ileti.neYapmali.length && ileti.nereye?.ekran, `${label}: dört alan`);
  };
  before(async () => {
    dir = mkdtempSync(path.join(tmpdir(), "destekofis-d3t4-ikinci-"));
    server = await startTestServer({ dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), now: { time: "2027-02-10T12:00:00+03:00", fixed: true } });
    api = apiOf(await loginAdmin(server));
    const account = await must("cari", api.post("/api/workspace/accounts", { name: "Devir Carisi", type: "customer" }));
    await must("satış", api.post("/api/workspace/invoices", { kind: "sale", accountId: account.id, issueDate: "2026-12-10", lines: [{ name: "Hizmet", qty: 1, unitPrice: 500, discountRate: 0, vatRate: 0 }], payment: { cash: [], cheques: [], endorse: [], rest: "open", dueDate: "2026-12-20" }, force: true }));
    const made = await must("002", api.post("/api/companies", { name: "İkinci Şirket", select: false }));
    second = made.company || made;
  });
  after(async () => {
    await server?.close();
    if (dir) removeTestDir(dir);
  });

  it("devir yokken: üç neden de YOK (yanlış durdurma yok)", async () => {
    assert.ok(iletiModule, "ileti düzeni yok (eski kod)");
    assert.deepEqual(await stops(), []);
  });

  it("y-1: aynı yıl (dosya ayarı + arşiv kaydı) → DURDURUR 'Bu Yıl Zaten Devredildi'; çare Devri Yenile / Devri Geri Al; dört alan", async () => {
    await freshArchive(ROOT, { year: "2026", cutoff: K, runId: "devir-2026-ilk" });
    const got = await stops();
    assert.deepEqual(got.map(row => row.kod), ["devir-yil-devredilmis"]);
    const [ileti] = got;
    clean(ileti, "bu yıl devredildi");
    assert.equal(ileti.neOldu, "2026 yılı 10.02.2027 tarihinde zaten devredilmiş; şirketin 2026 arşivi kayıtlı.", "gün sunucunun sahte saatinden (10.02.2027)");
    assert.match(ileti.neden, /yalnız bir kez devredilir/);
    assert.ok(ileti.neYapmali.some(step => /Devri Yenile/.test(step)) && ileti.neYapmali.some(step => /Devri Geri Al/.test(step)), ileti.neYapmali.join(" | "));
    assert.equal(ileti.nereye.ekran, "Ayarlar › Yıl Sonu Devri");
    katalogaYaz("devir-d3-ikinci", "API + D4 benzetimi (makeArchive): 2026 devredilmiş, K 31.12.2026", ileti);
  });

  it("y-4: ayarda 2026 var, arşiv kaydı yok (yarıda kalmış devir) → DURDURUR 'Önceki Devir Yarıda Kalmış' (Devir Yedekleri); 'bu yıl devredildi' DEĞİL", async () => {
    app().companies.removeArchive(ROOT, "2026");
    const got = await stops();
    assert.deepEqual(got.map(row => row.kod), ["devir-yarim-kalmis"]);
    clean(got[0], "yarıda kalmış");
    assert.match(got[0].neOldu, /2026 yılının devredildiğini gösteriyor, ancak şirketin arşiv kaydında bu yılın arşivi yok/);
    assert.equal(got[0].nereye.ekran, "Yönetim › Yedekler › Devir Yedekleri");
    katalogaYaz("devir-d3-ikinci", "D4 benzetimi: devir yılı ayarı var, arşiv kaydı yok", got[0]);
  });

  it("y-2: arşiv kaydı var, dosya ayarı yok → DURDURUR 'Bu Yıl Zaten Devredildi'", async () => {
    clearYears(ROOT);
    await freshArchive(ROOT, { year: "2026", cutoff: K, runId: "devir-2026-iki", liveYears: false });
    assert.deepEqual((await stops()).map(row => row.kod), ["devir-yil-devredilmis"]);
  });

  it("y-3: arşiv kaydı var ama arşiv dosyası yok → DURDURUR; ilette 'arşiv dosyası bulunamadı' + Devir Yedekleri", async () => {
    // w-2 ("açmayı denedi → sonra dosya değişti"): bir önceki ön izleme dosyanın VARLIĞINA baktı (açmadı) — silmeden önce açık tutamaç 0 (removeArchiveDir ölçer).
    assert.deepEqual((await stops()).map(row => row.kod), ["devir-yil-devredilmis"], "dosya varken");
    // Ölçümün dişi (ders 7): arşiv dosyasına bilerek bir bağlantı açılınca ölçüm onu görür, kapanınca 0.
    if (process.platform === "linux") {
      const probe = new DatabaseSync(path.join(archiveDirOf(ROOT, "2026"), "destekofis.sqlite"), { readOnly: true });
      probe.prepare("SELECT 1").get();
      assert.ok(handlesUnder(archiveDirOf(ROOT, "2026")).length >= 1, "açık bağlantı ölçümde görünmeli");
      probe.close();
    }
    removeArchiveDir(ROOT, "2026", "y-3 (dosya silinir)");
    const got = await stops();
    assert.deepEqual(got.map(row => row.kod), ["devir-yil-devredilmis"]);
    clean(got[0], "dosya yok");
    assert.match(got[0].neOldu, /ancak arşiv dosyası bulunamadı/);
    assert.match(got[0].neYapmali[0], /Devir Yedekleri/);
    assert.equal(got[0].nereye.ekran, "Yönetim › Yedekler › Devir Yedekleri");
    katalogaYaz("devir-d3-ikinci", "D4 benzetimi: arşiv kaydı var, arşiv dosyası silinmiş", got[0]);
  });

  it("y-7: Devri Geri Al'dan sonra (kayıt ve ayar kalktı) → GEÇER", async () => {
    clearArchives(ROOT);
    assert.deepEqual(await stops(), []);
  });

  it("y-5: sonraki yıl (2027) devredilmiş, 2026 seçildi → DURDURUR 'Sonraki Yıl Devredilmiş'", async () => {
    await freshArchive(ROOT, { year: "2027", cutoff: "2027-12-31", runId: "devir-2027-test" });
    const got = await stops();
    assert.deepEqual(got.map(row => row.kod), ["devir-sonraki-yil-devredilmis"]);
    clean(got[0], "sonraki yıl");
    assert.match(got[0].neOldu, /^2027 yılı zaten devredilmiş; seçilen 2026 yılı ondan önce\.$/);
    katalogaYaz("devir-d3-ikinci", "D4 benzetimi: 2027 devredilmiş, K 31.12.2026", got[0]);
    clearArchives(ROOT);
  });

  it("y-6: önceki yıl (2025) devredilmiş, 2026 seçildi → GEÇER", async () => {
    await freshArchive(ROOT, { year: "2025", cutoff: "2025-12-31", runId: "devir-2025-test" });
    assert.deepEqual(await stops(), []);
    clearArchives(ROOT);
  });

  it("y-9: devir yılları ayarı bozuk (JSON değil) → ayar yok sayılır, arşiv kaydı yok → GEÇER", async () => {
    setYears(ROOT, "{bozuk");
    assert.deepEqual(await stops(), []);
    clearYears(ROOT);
  });

  it("y-8: iki şirket — 002'nin 2026 devri 001'i durdurmaz; 002'nin kendi ön izlemesi durur", async () => {
    await freshArchive(second.id, { year: "2026", cutoff: K, runId: "devir-2026-002" });
    assert.deepEqual(await stops(ROOT), [], "öbür şirketin arşivi sayılmaz");
    assert.deepEqual((await stops(second.id)).map(row => row.kod), ["devir-yil-devredilmis"]);
  });
});
