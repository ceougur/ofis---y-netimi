// 2.4.8 grup 6 (W5 şablonlar + W6 aydınlatma metni) — testin dişi (ders 7; KANIT KURALI 3): iddialara bilerek hata enjekte edilir, ilgili test dosyası
// koşulur, KIRMIZI olması beklenir. Kod AYRI kopyada (ders 23, 25) bozulur, her mutasyondan sonra geri yazılır. Önce bozulmamış kopyada aynı testler YEŞİL (M0).
// Düzen 248-w1-betikler/mutasyon.mjs'ten.
//   node docs/kanit/2026-10-30/248-g6-betikler/mutasyon.mjs <kaynak-kök> <boş-çalışma-klasörü>
// Çıktının son satırı "N geçti, M kaldı" (geçti = mutasyon yakalandı; M0 için geçti = yeşil). Kaldı > 0 → çıkış 1.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

const [SRC, WORK] = process.argv.slice(2).map(item => path.resolve(item));
if (!SRC || !WORK) throw new Error("kullanım: mutasyon.mjs <kaynak-kök> <çalışma-klasörü>");
mkdirSync(WORK, { recursive: true });
for (const item of ["server", "client", "test", "tools", "vendor", "package.json", ".github"]) cpSync(path.join(SRC, item), path.join(WORK, item), { recursive: true });
if (!existsSync(path.join(WORK, "node_modules"))) symlinkSync(path.join(SRC, "node_modules"), path.join(WORK, "node_modules"));

const W5 = "test/whatsapp-w5-sablon.test.mjs";
const W6 = "test/whatsapp-w6-aydinlatma.test.mjs";
const MUTATIONS = [
  { id: "M1 ekstre şablonunun KVKK alt satırı düşer", file: "server/lib/whatsapp/templates.mjs", from: "    footer: KVKK_FOOTER,\n", to: "    footer: \"\",\n", tests: [W5] },
  { id: "M2 alt satır Meta'ya gönderilmez (bileşen kurulmaz)", file: "server/lib/whatsapp/templates.mjs", from: "  if (def.footer) components.push({ type: \"FOOTER\", text: def.footer });", to: "", tests: [W5] },
  { id: "M3 Pazarlama'ya alınma uyarısı kalkar", file: "server/lib/whatsapp/templates.mjs", from: "  if (category === \"MARKETING\") {", to: "  if (false) {", tests: [W5] },
  { id: "M4 MARKETING şablon da gönderime hazır sayılır", file: "server/lib/whatsapp/templates.mjs", from: "item.category === PROGRAM_TEMPLATE_CATEGORY && item.contentMatches", to: "item.contentMatches", tests: [W5] },
  { id: "M5 program şablonu MARKETING olarak açılmaya çalışılır", file: "server/lib/whatsapp/templates.mjs", from: "    name: \"destekofis_odeme_hatirlatma\",\n    label: \"Ödeme Hatırlatma\",\n    language: META_D0_W5.language,\n    category: PROGRAM_TEMPLATE_CATEGORY,", to: "    name: \"destekofis_odeme_hatirlatma\",\n    label: \"Ödeme Hatırlatma\",\n    language: META_D0_W5.language,\n    category: \"MARKETING\",", tests: [W5] },
  { id: "M6 istemcideki UTILITY kilidi kalkar (kampanya şablonu Meta'ya gider)", file: "server/lib/whatsapp/meta-graph.mjs", from: "    if (category !== PROGRAM_TEMPLATE_CATEGORY) throw refuse(", to: "    if (false) throw refuse(", tests: [W5] },
  { id: "M7 var olan şablon yeniden açılır (liste denetimi yok)", file: "server/lib/whatsapp/templates.mjs", from: "        if (stop || findExact(listing.items, def)) continue;", to: "        if (stop) continue;", tests: [W5] },
  { id: "M8 App ID yokken de yükleme denenir (nedenli ileti yok)", file: "server/lib/whatsapp/templates.mjs", from: "        if (def.header === \"DOCUMENT\" && !record.appId) {", to: "        if (false) {", tests: [W5] },
  { id: "M9 gövde metni plandan sapar", file: "server/lib/whatsapp/templates.mjs", from: "dönemine ait ekstresi ektedir.", to: "dönemine ait ekstresi ektedir, kampanyalarımızı kaçırmayın.", tests: [W5] },
  { id: "M16 ekstre gövdesi yine değişkenle biter (K3 öncesi metin)", file: "server/lib/whatsapp/templates.mjs", from: "Dönem sonu bakiyesi: {{4}}. İyi günler dileriz.", to: "Güncel bakiye: {{4}}.", tests: [W5] },
  { id: "M10 şablon kaydına belirteç yazılır", file: "server/lib/whatsapp/templates.mjs", from: "phoneNumberId: record.phoneNumberId, by:", to: "phoneNumberId: record.phoneNumberId, leak: connection.metaOptions(record).openToken(), by:", tests: [W5] },
  { id: "M11 şablon uçları yönetici dışına açılır (accounts.view)", file: "server/routes/whatsapp-sablon.mjs", from: "    auth.requirePermission(req, \"system.manage\");\n    ok(res, { ...templates.view()", to: "    auth.requirePermission(req, \"accounts.view\");\n    ok(res, { ...templates.view()", tests: [W5] },
  { id: "M12 aydınlatma metninden yurt dışı aktarım (md. 9) bölümü düşer", file: "server/lib/whatsapp/aydinlatma-metni.mjs", from: " Bu aktarım, KVKK'nın 9. maddesinde yurt dışına aktarım için öngörülen şartlar çerçevesinde gerçekleştirilir.", to: "", tests: [W6] },
  { id: "M13 md. 11'in ğ bendi düşer", file: "server/lib/whatsapp/aydinlatma-metni.mjs", from: "        \"ğ) Kişisel verilerinizin kanuna aykırı olarak işlenmesi sebebiyle zarara uğramanız hâlinde zararın giderilmesini talep etme\",\n", to: "", tests: [W6] },
  { id: "M14 eksik firma e-postası söylenmez", file: "server/lib/whatsapp/aydinlatma-metni.mjs", from: "  [\"email\", \"E-posta\", \"[Firma e-posta adresi]\"],\n", to: "", tests: [W6] },
  { id: "M15 aydınlatma metni yönetici dışına açılır", file: "server/routes/whatsapp-sablon.mjs", from: "    auth.requirePermission(req, \"system.manage\");\n    ok(res, buildPrivacyNotice", to: "    auth.requirePermission(req, \"accounts.view\");\n    ok(res, buildPrivacyNotice", tests: [W6] },
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
