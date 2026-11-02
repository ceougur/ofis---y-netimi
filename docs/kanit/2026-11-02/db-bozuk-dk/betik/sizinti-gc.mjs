// Dar kontrol: bozuk / kilitli / sayfası bozuk şirket dosyasında açık tutamak sayısı (Linux /proc/self/fd). Kullanım: node sizinti.mjs <depo kökü> <senaryo>
import { readdirSync, readlinkSync, renameSync, existsSync, writeFileSync, openSync, writeSync, closeSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";

const [root, scenario] = process.argv.slice(2);
const imp = rel => import(pathToFileURL(path.join(root, rel)).href);
const { startTestServer, loginAdmin, ADMIN_PASSWORD } = await imp("test/helpers.mjs");
const { resolveDbPath } = await imp("server/lib/db-path.mjs");

const fds = file => {
  let open = 0;
  let deleted = 0;
  for (const fd of readdirSync("/proc/self/fd")) {
    try {
      const link = readlinkSync(`/proc/self/fd/${fd}`);
      if (link === file) open += 1;
      else if (link === `${file} (deleted)`) deleted += 1;
    } catch {}
  }
  return { open, deleted };
};

const logs = [];
const rec = level => (msg, err) => logs.push(`${level}: ${msg} ${err?.stack ? err.stack.split("\n").slice(0, 12).join(" | ") : ""}`);
const server = await startTestServer({ maxCompanies: 2, log: { info() {}, debug() {}, warn: rec("warn"), error: rec("error") } });
const out = { scenario };
try {
  const api = await loginAdmin(server);
  const created = await api.post("/api/companies", { name: "Deneme Şirketi", select: false });
  const company = created.data.data?.company || created.data.data || created.data.company;
  const q = `?hofCompany=${encodeURIComponent(company.id)}`;
  const first = await api.post(`/api/workspace/accounts${q}`, { name: "Burak Kaya", phone: "0533 444 55 66", openingBalance: "800" });
  out.ilkCari = first.status;
  const dir = path.join(server.dataDir, "sirketler");
  const file = resolveDbPath(path.join(dir, readdirSync(dir)[0]));
  let backupName = null;
  if (scenario === "geri-yukleme" || scenario === "geri-yukleme-wal") {
    const b = await api.post("/api/admin/backups", { scope: "one", companyId: company.id });
    backupName = (b.data.data || b.data).backups?.[0]?.name;
    out.yedek = b.status;
  }
  await server.app.context.closeCompany(company.id);
  out.kapanistanSonra = fds(file);
  const hide = () => {
    for (const suffix of ["", "-wal", "-shm"]) if (existsSync(file + suffix)) renameSync(file + suffix, `${file + suffix}.yok`);
  };
  const junk = () => writeFileSync(file, "bu bir veri tabanı değil — bozuk dosya ".repeat(200));
  const get = async () => (await api.get(`/api/workspace/accounts${q}`)).status;
  if (scenario === "metin") {
    hide();
    junk();
    out.durumlar = [await get(), await get(), await get()];
    out.uc_istekten_sonra = fds(file);
  } else if (scenario === "kilit") {
    const lock = new DatabaseSync(file);
    lock.exec("PRAGMA busy_timeout = 1000; BEGIN EXCLUSIVE");
    const t0 = Date.now();
    try {
      out.durumlar = [await get()];
    } finally {
      lock.exec("ROLLBACK");
      lock.close();
    }
    out.sure_ms = Date.now() - t0;
    out.kilit_kalkinca = fds(file);
    for (let i = 0; i < 5; i += 1) { globalThis.gc?.(); await new Promise(r => setTimeout(r, 50)); }
    out.gc_sonrasi = fds(file);
    out.sonraki = await get();
    await server.app.context.closeCompany(company.id);
    out.sonraki_kapaninca = fds(file);
  } else if (scenario === "sayfa-bozuk") {
    // Geçerli başlık (ilk 100 bayt) kalır; 1. sayfanın geri kalanı ve sonraki sayfalar bozulur ("database disk image is malformed").
    const size = statSync(file).size;
    const fd = openSync(file, "r+");
    const page = 4096;
    writeSync(fd, Buffer.alloc(page - 100, 0x5a), 0, page - 100, 100);
    for (let at = page; at < size; at += page * 2) writeSync(fd, Buffer.alloc(page, 0xa5), 0, page, at);
    closeSync(fd);
    for (const suffix of ["-wal", "-shm"]) if (existsSync(file + suffix)) renameSync(file + suffix, `${file + suffix}.yok`);
    out.durumlar = [await get(), await get(), await get()];
    out.uc_istekten_sonra = fds(file);
    try {
      const probe = new DatabaseSync(file, { readOnly: true });
      try {
        probe.prepare("SELECT COUNT(*) FROM sqlite_master").get();
        out.dogrudan = "açıldı";
      } catch (e) {
        out.dogrudan = e.message;
      } finally {
        probe.close();
      }
    } catch (e) {
      out.dogrudan = `açılış: ${e.message}`;
    }
  } else if (scenario === "geri-yukleme" || scenario === "geri-yukleme-wal") {
    hide();
    junk();
    if (scenario === "geri-yukleme-wal") writeFileSync(`${file}-wal`, Buffer.alloc(8192, 0x11));
    out.durumlar = [await get(), await get()];
    out.geri_yuklemeden_once = fds(file);
    const r = await api.post("/api/admin/backups/restore", { name: backupName, company: company.id, confirm: company.code, password: ADMIN_PASSWORD });
    out.geri_yukleme = { status: r.status, error: r.data?.error || null };
    out.geri_yuklemeden_sonra = fds(file);
    out.sonra_istek = await get();
  }
} catch (error) {
  out.hata = error.stack;
} finally {
  await server.close().catch(e => (out.kapanisHatasi = e.message));
}
out.logs = logs.filter(l => /açılamadı/.test(l));
console.log(JSON.stringify(out, null, 1));
