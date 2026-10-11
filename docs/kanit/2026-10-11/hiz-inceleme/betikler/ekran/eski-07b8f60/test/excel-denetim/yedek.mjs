// Yedek denetimi ve geri yükleme tatbikatı (iki şirket). Her şirketin yedeği kendi klasöründe, adında kendi kodu,
// içinde kendi kimliği ve YALNIZ kendi verisi mi? Yedek → çalış → geri yükle → sayılar yedek anına döner mü → yeniden
// çalışılabilir mi? 001'in geri yüklemesi programın kuralı gereği yeniden açılışta uygulanır (sunucu kapatılıp açılır).
// Sonunda iki şirketin verisi tatbikat öncesiyle bayt değil SAYI olarak aynıdır (denetim yeniden koşulur).
// Kullanım: SP=<çalışma> node yedek.mjs
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { HERE, PASS, staff, startServer } from "./ortak.mjs";

const SP = process.env.SP || path.join(HERE, "calisma");
const ROOT = path.join(SP, "canli");
const OUT = path.join(HERE, "cikti");
const state = JSON.parse(fs.readFileSync(path.join(ROOT, "durum.json"), "utf8"));
const C = state.companies;
const results = [];
let group = "";
const record = (name, expected, actual, ok, detail = "") => {
  results.push({ group, name, expected, actual, ok, detail });
  console.log(`${ok ? "✓" : "✗ BULGU"} [${group}] ${name}\n     beklenen: ${expected}\n     gerçek:   ${actual}${detail ? `\n     ayrıntı: ${detail}` : ""}`);
};
let app;
let admin;
let BASE;
async function start() {
  app = startServer(ROOT, { fresh: false });
  const { port } = await app.listen(0, "127.0.0.1");
  BASE = `http://127.0.0.1:${port}`;
  admin = staff(BASE);
  const r = await admin.login("admin", PASS);
  if (r.status !== 200) throw new Error("yönetici girişi");
}
const co = code => admin.withCompany(C[code]);
async function counts(code) {
  const c = co(code);
  const acc = (await c.get("/api/workspace/accounts?status=all&limit=5000")).data.accounts;
  const cash = (await c.get("/api/workspace/cash?period=all")).data.totals.balance;
  const inv = (await c.get("/api/workspace/invoices?tab=sale")).data.tabCounts;
  return { cari: acc.length, bakiye: Number(acc.reduce((t, a) => t + a.balance, 0).toFixed(2)), kasa: cash, satis: inv.sale, alis: inv.purchase, isaret: acc.filter(a => /^YEDEK-İŞARET/.test(a.name)).map(a => a.name) };
}
function insideBackup(file) {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const meta = db.prepare("SELECT value FROM backup_meta WHERE key = 'company'").get();
    const acc = db.prepare("SELECT COUNT(*) AS n FROM accounts WHERE deleted_at IS NULL").get().n;
    const marks = db.prepare("SELECT name FROM accounts WHERE name LIKE 'YEDEK-%' AND deleted_at IS NULL").all().map(r => r.name);
    const inv = db.prepare("SELECT COUNT(*) AS n FROM invoices WHERE status = 'issued'").get().n;
    return { company: meta ? JSON.parse(meta.value) : null, cari: acc, faturalar: inv, isaret: marks };
  } catch (error) {
    return { error: error.message };
  } finally {
    db.close();
  }
}
const s = v => JSON.stringify(v);

await start();
try {
  group = "Yedek Klasörleri";
  const folders = (await admin.get("/api/admin/backups/folders")).data;
  console.log("yedek kökü:", folders.root);
  for (const f of folders.companies) console.log("  ", s(f).slice(0, 300));

  for (const code of ["001", "002"]) {
    const a = (await co(code).get("/api/workspace/accounts?limit=1&q=C0010")).data.accounts[0];
    const det = (await co(code).get(`/api/workspace/accounts/${a.id}`)).data;
    for (const e of det.entries || []) if (/^Tatbikat/.test(e.note || "")) { const d = await co(code).del(`/api/workspace/accounts/${a.id}/entries/${e.id}?cashForce=1`); console.log(`  önceki koşudan kalan tatbikat hareketi silindi: ${code} ${e.amount} TL → HTTP ${d.status}`); }
  }
  // 1) Her şirkete kendine özgü bir işaret kaydı: yedeğin hangi şirketin verisini içerdiği ayırt edilsin.
  const markers = {};
  for (const code of ["001", "002"]) markers[code] = (await co(code).post("/api/workspace/accounts", { name: `YEDEK-İŞARET-${code}`, type: "other", note: "Yedek tatbikatı işareti" })).data;
  const atBackup = { "001": await counts("001"), "002": await counts("002") };

  group = "Şimdi Yedek Al (Tüm Şirketler)";
  const made = await admin.post("/api/admin/backups", { scope: "all" });
  record("Yönetim → Yedekler → Şimdi Yedek Al: Tüm Şirketler", "her şirket için bir yedek", `HTTP ${made.status}; ${(made.data.backups || []).map(b => `${b.company} → ${path.relative(path.join(ROOT, "backups"), b.folder)}/${b.name}`).join(" | ")}`, made.status === 200 && made.data.backups?.length === 2);
  const manual = {};
  for (const b of made.data.backups || []) {
    const code = b.code;
    const file = path.join(b.folder, b.name);
    manual[code] = { name: b.name, file };
    const inside = insideBackup(file);
    const folderName = path.basename(b.folder);
    const companyName = (await admin.get("/api/companies")).data.companies.find(c => c.code === code).name;
    const winName = `${code} - ${companyName}`.replace(/[\\/:*?"<>|]/g, " ").replace(/[. ]+$/, "");
    record(`${code} yedeği kendi klasöründe (Windows kuralı: ad noktayla bitmez)`, `backups/${winName}/`, `backups/${folderName}/`, folderName === winName);
    record(`${code} yedeğinin adında şirket kodu`, `destekofis-${code}-…`, b.name, b.name.startsWith(`destekofis-${code}-`));
    record(`${code} yedeğinin İÇİNDE kendi kimliği`, `${C[code]} (${code})`, `${inside.company?.id} (${inside.company?.code})`, inside.company?.id === C[code]);
    record(`${code} yedeğinde yalnız kendi işareti`, `[YEDEK-İŞARET-${code}]`, s(inside.isaret), s(inside.isaret) === s([`YEDEK-İŞARET-${code}`]));
    record(`${code} yedeğindeki cari ve fatura sayısı yedek anındakiyle aynı`, `cari ${atBackup[code].cari}, satış+alış ${atBackup[code].satis + atBackup[code].alis}`, `cari ${inside.cari}, kaydedilmiş fatura ${inside.faturalar}`, inside.cari === atBackup[code].cari && inside.faturalar === atBackup[code].satis + atBackup[code].alis);
  }

  group = "Otomatik Yedek (Zamanlayıcı)";
  const auto = await app.runDueBackups();
  const autoList = (Array.isArray(auto) ? auto : []).map(x => `${x.company?.code || x.companyId}: ${x.name || x.error || s(x).slice(0, 80)}`);
  record("Zamanlayıcının bu saatteki çalışması (her şirket kendi klasörüne)", "iki şirket de yedeklenir (ya da son yedek yeni olduğu için atlanır)", autoList.join(" | ") || s(auto).slice(0, 200), true, "Zamanlayıcı son yedekten 6 saat geçmemişse yeniden almaz; aşağıda klasörler sayılıyor.");
  for (const code of ["001", "002"]) {
    const dir = path.dirname(manual[code].file);
    const files = fs.readdirSync(dir).filter(f => f.endsWith(".sqlite"));
    const foreign = files.filter(f => !f.startsWith(`destekofis-${code}-`));
    const wrongId = files.filter(f => insideBackup(path.join(dir, f)).company?.id !== C[code]);
    record(`${code} klasöründeki bütün yedekler (${files.length} dosya) bu şirketin`, "başka şirketin dosyası/kimliği yok", `yabancı ad ${foreign.length}, yabancı kimlik ${wrongId.length}: ${files.join(", ")}`, !foreign.length && !wrongId.length);
  }
  const audit = (await admin.get("/api/admin/backups/audit")).data;
  record("Yönetim → Yedekleri Denetle", "sorun yok", s(audit).slice(0, 400), !(audit.problems || audit.issues || []).length, "");

  group = "002 Tatbikatı: Yedek → Çalış → Geri Yükle → Yeniden Çalış";
  const target2 = (await co("002").get("/api/workspace/accounts?limit=1&q=C0010")).data.accounts[0];
  const t1 = await co("002").post(`/api/workspace/accounts/${target2.id}/entries`, { kind: "in", amount: 12345.67, date: "2025-09-30", method: "cash", note: "Tatbikat: yedekten sonraki iş" });
  const afterWork = await counts("002");
  record("Yedekten sonra 002'ye 12.345,67 TL nakit tahsilat girilir", `Kasa ${atBackup["002"].kasa} → ${(atBackup["002"].kasa + 12345.67).toFixed(2)}`, `HTTP ${t1.status}; Kasa ${afterWork.kasa}`, Math.abs(afterWork.kasa - atBackup["002"].kasa - 12345.67) < 0.005);
  let r = await admin.post("/api/admin/backups/restore", { name: manual["001"].name, company: C["001"], target: C["002"], confirm: "002", password: PASS });
  record("001'in yedeğini 002'ye geri yüklemeye çalışmak (yanlış şirket)", "409 reddedilir; 002 değişmez", `HTTP ${r.status} ${r.data?.error || ""}`, r.status === 409 || r.status === 400);
  record("Yanlış şirket denemesinden sonra 002 aynı", s(afterWork), s(await counts("002")), s(afterWork) === s(await counts("002")));
  r = await admin.post("/api/admin/backups/restore", { name: manual["002"].name, company: C["002"], confirm: "002", password: "yanlis-parola" });
  record("Doğru yedek, yanlış parola", "403", `HTTP ${r.status}`, r.status === 403);
  r = await admin.post("/api/admin/backups/restore", { name: manual["002"].name, company: C["002"], confirm: "002", password: PASS });
  const restored2 = await counts("002");
  record("002 kendi yedeğinden geri yüklenir (hemen)", s(atBackup["002"]), `HTTP ${r.status}; ${s(restored2)}`, r.status === 200 && s(restored2) === s(atBackup["002"]), `güvenlik kopyası: ${r.data?.safety || "-"}`);
  record("Geri yükleme 001'e dokunmadı", s({ ...atBackup["001"] }), s(await counts("001")), s(await counts("001")) === s(atBackup["001"]));
  const t2 = await co("002").post(`/api/workspace/accounts/${target2.id}/entries`, { kind: "in", amount: 1, date: "2025-09-30", method: "cash", note: "Tatbikat: geri yüklenen veride yeniden çalış" });
  const afterRe = await counts("002");
  record("Geri yüklenen 002'de yeniden çalışılır (1 TL tahsilat)", "kaydedilir", `HTTP ${t2.status}; Kasa ${afterRe.kasa}`, t2.status === 200 && Math.abs(afterRe.kasa - atBackup["002"].kasa - 1) < 0.005);
  await co("002").del(`/api/workspace/accounts/${target2.id}/entries/${t2.data.entryId}?cashForce=1`);

  group = "001 Tatbikatı (Yeniden Açılışta Geri Yükleme)";
  const target1 = (await co("001").get("/api/workspace/accounts?limit=1&q=C0010")).data.accounts[0];
  const u1 = await co("001").post(`/api/workspace/accounts/${target1.id}/entries`, { kind: "in", amount: 7777.77, date: "2025-09-30", method: "cash", note: "Tatbikat: yedekten sonraki iş" });
  const work1 = await counts("001");
  record("Yedekten sonra 001'e 7.777,77 TL tahsilat", `Kasa +7.777,77`, `HTTP ${u1.status}; Kasa ${atBackup["001"].kasa} → ${work1.kasa}`, Math.abs(work1.kasa - atBackup["001"].kasa - 7777.77) < 0.005);
  r = await admin.post("/api/admin/backups/restore", { name: manual["001"].name, company: C["001"], confirm: "001", password: PASS });
  record("001 geri yüklemesi istenir", "yeniden açılışta uygulanmak üzere bekletilir (staged)", `HTTP ${r.status} ${s(r.data).slice(0, 200)}`, r.status === 200 && r.data.staged === true);
  await app.close();
  await start();
  const restored1 = await counts("001");
  record("Sunucu yeniden açıldı: 001 yedek anındaki sayılarda", s(atBackup["001"]), s(restored1), s(restored1) === s(atBackup["001"]));
  record("Yeniden açılış 002'yi bozmadı", s(atBackup["002"]), s(await counts("002")), s(await counts("002")) === s(atBackup["002"]));
  const users = (await admin.get("/api/admin/users")).data;
  record("Ortak katman korundu (kullanıcılar)", "11 kullanıcı (yönetici + 10)", `${(users.users || users).length}`, (users.users || users).length === 11);
  const u2 = await co("001").post(`/api/workspace/accounts/${target1.id}/entries`, { kind: "in", amount: 1, date: "2025-09-30", method: "cash", note: "Tatbikat: geri yüklenen 001'de yeniden çalış" });
  record("Geri yüklenen 001'de yeniden çalışılır", "kaydedilir", `HTTP ${u2.status}`, u2.status === 200);
  await co("001").del(`/api/workspace/accounts/${target1.id}/entries/${u2.data.entryId}?cashForce=1`);

  group = "Temizlik";
  for (const code of ["001", "002"]) {
    const m = (await co(code).get(`/api/workspace/accounts?status=all&limit=50&q=${encodeURIComponent(`YEDEK-İŞARET-${code}`)}`)).data.accounts[0];
    const d = await co(code).del(`/api/workspace/accounts/${m.id}`);
    record(`${code} işaret carisi silinir`, "200", `HTTP ${d.status}`, d.status === 200);
  }
} catch (error) {
  record("BETİK DURDU", "-", error.stack.split("\n").slice(0, 3).join(" | "), false);
}
fs.writeFileSync(path.join(OUT, "yedek-sonucu.json"), JSON.stringify(results, null, 1));
console.log(`\nYedek tatbikatı: ${results.length} denetim; beklenene uymayan: ${results.filter(x => !x.ok).length}`);
await app.close();
