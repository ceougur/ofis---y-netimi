// DİŞ KANITI (ders 7): dayanıklılık testinin denetimleri bilerek bozulmuş girdide KIRMIZI veriyor mu?
//  (a) plan.jsonl'de bir belgenin bir kaleminin birim fiyatı 1 kuruş artırılır → kahin.py o belgeyi FARKLI demeli (çıkış 1)
//  (b) o belgenin XML'inde PayableAmount 1,00 artırılır → kahin.py FARKLI (çıkış 1)
//  (c) betiğin karekod denetimi bir belgenin bilgisiyle BAŞKA belgenin PDF'iyle beslenir → ✗ (çıkış 1)
//  Her biri için önce bozulmamış KONTROL koşulur (yeşil olmalı); kontrol yeşil değilse kanıt sayılmaz.
//  Kullanım: node dis-kaniti.mjs <çıktı-klasörü> <çalışma-klasörü>   (çıktı klasörüne dokunulmaz; kopyalar çalışma klasöründe)
//  Çıkış: 0 = üç bozulma da kırmızı ve kontroller yeşil; 1 = değil.
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, copyFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const [OUT, WORK] = process.argv.slice(2);
if (!OUT || !WORK) { console.error("Kullanım: node dis-kaniti.mjs <çıktı-klasörü> <çalışma-klasörü>"); process.exit(2); }
rmSync(WORK, { recursive: true, force: true });
mkdirSync(WORK, { recursive: true });
let bad = 0;
const say = (ok, text) => { if (!ok) bad += 1; console.log(`  ${ok ? "✓" : "✗"} ${text}`); };
const lines = file => (existsSync(file) ? readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l)) : []);
const kahin = (dir, extra = []) => spawnSync("python3", ["-I", path.join(HERE, "kahin.py"), dir, ...extra], { encoding: "utf8" });
const karekod = (pdf, d, vkn) => spawnSync(process.execPath, [path.join(HERE, "dayaniklilik.mjs"), "--karekod", pdf, d.no, d.ettn, vkn, String(d.odenecek)], { encoding: "utf8" });

const plans = new Map(lines(path.join(OUT, "plan.jsonl")).map(p => [p.plan_id, p]));
const docs = lines(path.join(OUT, "belgeler.jsonl")).filter(d => d.no && existsSync(path.join(OUT, "xml", `${d.no}.xml`)));
const qrs = lines(path.join(OUT, "karekod.jsonl"));
// Hedef: kâhinin bozulmamış hâlde AYNI dediği, en az 1 birim miktarlı kalemi olan bir belge.
const full = kahin(OUT, ["--cikis", path.join(WORK, "kahin-tam.txt")]);
const sameNos = new Set((readFileSync(path.join(WORK, "kahin-tam.txt"), "utf8").match(/^(\S+)\s+AYNI\b/gm) || []).map(l => l.split(/\s+/)[0]));
const target = docs.find(d => sameNos.has(d.no) && plans.get(d.plan_id)?.kalemler.some(k => Number(k.miktar) >= 1));
console.log(`Diş kanıtı — tam kâhin çıkışı ${full.status}; AYNI ${sameNos.size}/${docs.length}; hedef belge ${target?.no || "YOK"}`);
if (!target) {
  say(false, "hedef belge yok (kâhinin AYNI dediği belge bulunamadı) — diş kanıtı yapılamadı");
  process.exit(1);
}
// Yalnız hedef belgenin kopyası (kontrol + bozulmalar aynı küçük kümede).
const mk = name => {
  const dir = path.join(WORK, name);
  mkdirSync(path.join(dir, "xml"), { recursive: true });
  writeFileSync(path.join(dir, "belgeler.jsonl"), `${JSON.stringify(target)}\n`);
  writeFileSync(path.join(dir, "plan.jsonl"), `${JSON.stringify(plans.get(target.plan_id))}\n`);
  writeFileSync(path.join(dir, "karekod.jsonl"), qrs.filter(q => q.no === target.no).map(q => JSON.stringify(q)).join("\n") + "\n");
  copyFileSync(path.join(OUT, "xml", `${target.no}.xml`), path.join(dir, "xml", `${target.no}.xml`));
  return dir;
};
const control = kahin(mk("kontrol"));
say(control.status === 0, `KONTROL (bozulmamış ${target.no}): kâhin çıkış ${control.status} — ${control.stdout.split("\n")[0]}`);

// (a) birim fiyat + 1 kuruş
{
  const dir = mk("a-fiyat");
  const plan = plans.get(target.plan_id);
  const copy = JSON.parse(JSON.stringify(plan));
  const k = copy.kalemler.find(x => Number(x.miktar) >= 1);
  const before = k.birim_fiyat;
  k.birim_fiyat = Math.round((Number(k.birim_fiyat) + 0.01) * 100) / 100;
  writeFileSync(path.join(dir, "plan.jsonl"), `${JSON.stringify(copy)}\n`);
  const r = kahin(dir);
  const red = r.status === 1 && new RegExp(`^${target.no}\\s+FARKLI`, "m").test(readFileSync(path.join(dir, "kahin-sonuc.txt"), "utf8"));
  say(red, `(a) plan: "${k.ad}" birim fiyatı ${before} → ${k.birim_fiyat}: kâhin çıkış ${r.status}, ${target.no} ${red ? "FARKLI (kırmızı)" : "FARKLI DEMEDİ"}`);
}
// (b) XML PayableAmount + 1,00
{
  const dir = mk("b-xml");
  const file = path.join(dir, "xml", `${target.no}.xml`);
  const xml = readFileSync(file, "utf8");
  let changed = "";
  const mutated = xml.replace(/(<cac:LegalMonetaryTotal>[\s\S]*?<cbc:PayableAmount\b[^>]*>)([^<]+)(<\/cbc:PayableAmount>)/, (all, a, v, b) => { changed = `${v} → ${(Number(v) + 1).toFixed(2)}`; return `${a}${(Number(v) + 1).toFixed(2)}${b}`; });
  writeFileSync(file, mutated);
  const r = kahin(dir);
  const red = Boolean(changed) && r.status === 1 && /PayableAmount/.test(readFileSync(path.join(dir, "kahin-sonuc.txt"), "utf8"));
  say(red, `(b) XML PayableAmount ${changed || "(bulunamadı)"}: kâhin çıkış ${r.status}, ${red ? "FARKLI (kırmızı)" : "FARKLI DEMEDİ"}`);
}
// (c) karekod: hedefin bilgisi + başka belgenin PDF'i
{
  const vkn = plans.get(target.plan_id)?.satici_vkn;
  // Karekodu okunmuş PDF: önce EDM resmî PDF'i (gerçek koşu), yoksa programın PDF'i (KURU koşu).
  const pdfOf = d => {
    const read = kaynak => qrs.some(q => q.no === d.no && q.kaynak === kaynak && q.json);
    if (read("resmi") && existsSync(path.join(OUT, "pdf", `${d.no}.pdf`))) return path.join(OUT, "pdf", `${d.no}.pdf`);
    if (read("program") && existsSync(path.join(OUT, "pdf-program", `${d.no}.pdf`))) return path.join(OUT, "pdf-program", `${d.no}.pdf`);
    return "";
  };
  const withQr = docs.filter(d => pdfOf(d));
  const a = withQr.find(d => d.no === target.no) || withQr[0];
  const b = withQr.find(d => d.no !== a?.no);
  if (!a || !b) say(false, `(c) karekodu okunan iki belge yok (${withQr.length}) — karekod dişi gösterilemedi`);
  else {
    const ok = karekod(pdfOf(a), a, vkn);
    say(ok.status === 0, `(c) KONTROL ${a.no} kendi PDF'iyle: çıkış ${ok.status} ${ok.stdout.trim()}`);
    const wrong = karekod(pdfOf(b), a, vkn);
    say(wrong.status === 1, `(c) ${a.no} bilgisi + ${b.no} PDF'i: çıkış ${wrong.status} ${wrong.stdout.trim()}`);
  }
}
console.log(`DİŞ KANITI: ${bad ? `${bad} beklenti tutmadı` : "üç bozulma da kırmızı, kontroller yeşil"}`);
process.exit(bad ? 1 : 0);
