// 2.4.8 W1 — testin dişi (ders 7; KANIT KURALI 3): güvenlik ve izolasyon iddialarına bilerek hata enjekte edilir, ilgili test dosyası koşulur, testin
// KIRMIZI olması beklenir. Kaynak ağaç değişmez: kod AYRI kopyada (ders 23, 25) bozulur, her mutasyondan sonra geri yazılır. Önce bozulmamış kopyada
// aynı testlerin YEŞİL olduğu görülür (M0); yoksa "yakalandı" sayılmaz.
//   node docs/kanit/2026-10-30/248-w1-betikler/mutasyon.mjs <kaynak-kök> <boş-çalışma-klasörü>
// Çıktının son satırı "N geçti, M kaldı" (geçti = mutasyon yakalandı; M0 için geçti = yeşil). Kaldı > 0 → çıkış 1.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

const [SRC, WORK] = process.argv.slice(2).map(item => path.resolve(item));
if (!SRC || !WORK) throw new Error("kullanım: mutasyon.mjs <kaynak-kök> <çalışma-klasörü>");
mkdirSync(WORK, { recursive: true });
for (const item of ["server", "client", "test", "tools", "vendor", "package.json", ".github"]) cpSync(path.join(SRC, item), path.join(WORK, item), { recursive: true });
if (!existsSync(path.join(WORK, "node_modules"))) symlinkSync(path.join(SRC, "node_modules"), path.join(WORK, "node_modules"));

const API = "test/whatsapp-w1-baglanti.test.mjs";
const ISO = "test/whatsapp-meta-izolasyon.test.mjs";
const UNIT = "test/whatsapp-meta-graph.test.mjs";
const META = ["graph", "facebook", "com"].join(".");
const MUTATIONS = [
  { id: "M1 görünüm mühürlü belirteci istemciye verir", file: "server/lib/whatsapp/connection.mjs", from: "      hasToken,\n", to: "      hasToken,\n      tokenSealed: record.tokenSealed,\n", tests: [API] },
  { id: "M2 belirteç arındırma (redact) etkisiz", file: "server/lib/whatsapp/meta-graph.mjs", from: "  let text = String(value ?? \"\");\n  if (secret && secret.length >= 4) text = text.split(secret).join(\"***\");", to: "  let text = String(value ?? \"\");\n  return text;", tests: [API, UNIT] },
  { id: "M3 işlem geçmişine belirteç yazılır", file: "server/lib/whatsapp/connection.mjs", from: "{ mode: \"manual\", phoneNumberId, wabaId, appId, tokenChanged, first: !previous }", to: "{ mode: \"manual\", phoneNumberId, wabaId, appId, tokenChanged, first: !previous, token: input.token }", tests: [API] },
  { id: "M4 belirteç adres sorgusuna da konur", file: "server/lib/whatsapp/meta-graph.mjs", from: "    const headers = { authorization: `Bearer ${token}`, accept: \"application/json\" };", to: "    url.searchParams.set(\"access_token\", token);\n    const headers = { authorization: `Bearer ${token}`, accept: \"application/json\" };", tests: [API, UNIT] },
  { id: "M5 testlerde de varsayılan gerçek Meta adresi", file: "server/lib/config.mjs", from: "(overrides.whatsappGraph === true ? env.HUKUK_WHATSAPP_GRAPH_URL", to: "(true ? env.HUKUK_WHATSAPP_GRAPH_URL", tests: [ISO] },
  { id: "M6 deneme numarası '+' olmadan (işletme ülke kodu riski)", file: "server/routes/whatsapp.mjs", from: "connection.selfTest(user, `+${phone.wa}`)", to: "connection.selfTest(user, `${phone.wa}`)", tests: [API] },
  { id: "M7 deneme bekleme süresi yok (çift ileti)", file: "server/lib/whatsapp/connection.mjs", from: "export const SELF_TEST_COOLDOWN_MS = 15_000;", to: "export const SELF_TEST_COOLDOWN_MS = 0;", tests: [API] },
  { id: "M8 salt okunur genel kapı WhatsApp uçlarını serbest bırakır", file: "server/lib/license.mjs", from: "  /^\\/api\\/workspace\\/sessions\\/select$/,\n", to: "  /^\\/api\\/workspace\\/sessions\\/select$/,\n  /^\\/api\\/workspace\\/whatsapp\\//,\n", tests: [API] },
  { id: "M9 bağlantı görünümü yönetici dışı role (accounts.view) açılır", file: "server/routes/whatsapp.mjs", from: "  router.get(\"/api/workspace/whatsapp/connection\", async ({ req, res }) => {\n    auth.requirePermission(req, \"system.manage\");", to: "  router.get(\"/api/workspace/whatsapp/connection\", async ({ req, res }) => {\n    auth.requirePermission(req, \"accounts.view\");", tests: [API] },
  { id: "M10 test dosyası gerçek Meta adresine istek yazar (kaynak taraması)", add: { file: "test/zz-w1-ihlal-mutasyon.mjs", content: `export const yanlis = () => fetch("https://${META}/v26.0/me");\n` }, tests: [ISO] },
  { id: "M11 test sahte olmayan whatsappGraphUrl verir (kaynak taraması)", add: { file: "test/zz-w1-ihlal-mutasyon-2.mjs", content: `export const secenek = { whatsappGraphUrl: "https://ornek.example" };\n` }, tests: [ISO] },
  { id: "M12 gerçek Meta adresi ikinci bir sunucu dosyasına yazılır", add: { file: "server/lib/zz-w1-ihlal.mjs", content: `export const ADRES = "https://${META}";\n` }, tests: [ISO] },
];

const run = tests => spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "--test", "--test-concurrency=1", ...tests], { cwd: WORK, encoding: "utf8", timeout: 600_000 });
const counts = text => (text.match(/^# (?:tests|pass|fail) \d+$/gm) || []).join(" · ");
let passed = 0;
let failed = 0;
const allTests = [...new Set(MUTATIONS.flatMap(item => item.tests))];
const base = run(allTests);
const green = base.status === 0;
console.log(`M0 bozulmamış kopya: ${green ? "YEŞİL" : "KIRMIZI"} (${counts(base.stdout)})`);
if (green) passed += 1;
else {
  failed += 1;
  console.log(base.stdout.slice(-3000));
}
for (const mutation of MUTATIONS) {
  let restore = null;
  if (mutation.add) {
    const file = path.join(WORK, mutation.add.file);
    writeFileSync(file, mutation.add.content);
    restore = () => rmSync(file, { force: true });
  } else {
    const file = path.join(WORK, mutation.file);
    const original = readFileSync(file, "utf8");
    if (!original.includes(mutation.from)) {
      failed += 1;
      console.log(`${mutation.id}: UYGULANAMADI (kaynak metni bulunamadı) — sayılmaz`);
      continue;
    }
    writeFileSync(file, original.replace(mutation.from, mutation.to));
    restore = () => writeFileSync(file, original);
  }
  const result = run(mutation.tests);
  restore();
  const caught = result.status !== 0 && /^# fail [1-9]/m.test(result.stdout);
  if (caught) passed += 1;
  else failed += 1;
  const first = (result.stdout.match(/^\s*not ok \d+ - (.*)$/m) || [])[1] || "";
  console.log(`${mutation.id}: ${caught ? "YAKALANDI" : "YAKALANMADI"} (${counts(result.stdout)})${first ? ` — ilk kırmızı: ${first.slice(0, 160)}` : ""}`);
}
console.log(`\n${passed} geçti, ${failed} kaldı`);
process.exit(failed ? 1 : 0);
