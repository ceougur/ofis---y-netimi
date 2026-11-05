// 2.4.9 B2 (tasarım notu §5 E2 "Mutasyonlar"; ders 7, 38): test/whatsapp-elle-alici-249.test.mjs'in dişi. Yeni kodun AYRI kopyasında (git archive — ders 23) her mutasyon
// tek başına uygulanır, test koşulur, kopya özgün dosyalara döner. Beklenen: her mutasyonda test KIRMIZI ve kırmızı hücre(ler) beklenen nedenle (ileti ekrana yazılır).
// Kullanım: node test/b2-249/mutasyon.mjs <yeni kod kopyası> <özgün dosyaların klasörü (whatsapp.mjs, accounts.mjs)>
import { spawnSync } from "node:child_process";
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [KOPYA, ASIL] = process.argv.slice(2);
if (!KOPYA || !ASIL) throw new Error("kullanım: mutasyon.mjs <kopya> <özgün>");
const WA = "server/routes/whatsapp.mjs";
const AC = "server/routes/accounts.mjs";
const MUTASYONLAR = [
  ["M1 waFacts'ta plans: [] (taksit kartları alıcıya gelmez)", AC, "return { ...account, plans: planList.map(planSummaryOf), ledger: ledger.lines, totals: ledger.totals };", "return { ...account, plans: [], ledger: ledger.lines, totals: ledger.totals };", ["KÂHİN", "ÇEKİRDEK"]],
  ["M2 son tahsilat süzgecinden plan-in çıkar", WA, 'filter(line => line.kind === "in" || line.kind === "plan-in")', 'filter(line => line.kind === "in")', ["KÂHİN"]],
  ["M3 waOptOut denetimi === \"1\"", WA, 'if (Number(account.waOptOut) === 1) Object.assign(phone, { valid: false, reason: "WhatsApp Mesajı İstemiyor" });', 'if (account.waOptOut === "1") Object.assign(phone, { valid: false, reason: "WhatsApp Mesajı İstemiyor" });', ["KÂHİN"]],
  ["M4 TL_FORMAT minimumFractionDigits 0", WA, 'const TL_FORMAT = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });', 'const TL_FORMAT = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });', ["KÂHİN"]],
  ["M5 detail'e geri dönüş", WA, "account = service.waFacts(id, user);", "account = service.detail(id, user);", ["YAPI: alıcı listesi kişi başı tam cari kartı", "BİLİNÇLİ TEK FARK"]],
  ["M6 tl yine çağrı başına biçimleyici", WA, "const tl = value => `${TL_FORMAT.format(Number(value) || 0)} TL`;", 'const tl = value => `${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0)} TL`;', ["YAPI: ekstre metni"]],
];
const geriAl = () => {
  copyFileSync(path.join(ASIL, "whatsapp.mjs"), path.join(KOPYA, WA));
  copyFileSync(path.join(ASIL, "accounts.mjs"), path.join(KOPYA, AC));
};
let n = 0;
let fail = 0;
try {
  for (const [ad, dosya, eski, yeni, beklenen] of MUTASYONLAR) {
    geriAl();
    const yol = path.join(KOPYA, dosya);
    const metin = readFileSync(yol, "utf8");
    n += 1;
    if (metin.split(eski).length !== 2) {
      fail += 1;
      console.log(`not ok ${n} - ${ad}: değiştirilecek metin bulunamadı (tek değil)`);
      continue;
    }
    writeFileSync(yol, metin.replace(eski, yeni));
    const r = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "--test", "test/whatsapp-elle-alici-249.test.mjs"], { cwd: KOPYA, encoding: "utf8", env: { ...process.env, HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, maxBuffer: 64 * 1024 * 1024 });
    const cikti = `${r.stdout}${r.stderr}`;
    const kirmizi = [...cikti.matchAll(/^ {4}not ok \d+ - (.*)$/gm)].map(m => m[1]);
    const iletiler = [...cikti.matchAll(/^ {6}error: (?:\|-\n {8})?'?(.*?)'?$/gm)].map(m => m[1].slice(0, 220));
    const tutan = beklenen.every(b => kirmizi.some(k => k.startsWith(b)));
    const kirmiziMi = r.status !== 0 && kirmizi.length > 0;
    if (!(kirmiziMi && tutan)) fail += 1;
    console.log(`${kirmiziMi && tutan ? "ok" : "not ok"} ${n} - ${ad}: çıkış ${r.status}; kırmızı ${kirmizi.length} hücre [${kirmizi.map(k => k.slice(0, 40)).join(" | ")}]; beklenen [${beklenen.join(" | ")}] ${tutan ? "tuttu" : "TUTMADI"}`);
    for (const ileti of iletiler) console.log(`#   ileti: ${ileti}`);
  }
} finally {
  geriAl();
}
console.log(`1..${n}\n# tests ${n}\n# pass ${n - fail}\n# fail ${fail}`);
process.exitCode = fail ? 1 : 0;
