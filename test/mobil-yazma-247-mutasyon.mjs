#!/usr/bin/env node
// 2.4.7 M5 — mobil yazma yolunun MUTASYON taraması (KANIT KURALI 3, ders 7: "para çekirdeğinde mutasyon; yakalanmayan mutasyon = eksik test").
// Programın ayrı bir kopyasında (ders 23: çalışma ağacında değil) her seferinde TEK bilerek hata açılır, iki bağımsız göz koşulur:
//   (1) birim/API testleri test/mobil-yazma-247.test.mjs (kopyanın kendi dosyası) — kırmızıysa YAKALANDI;
//   (2) bağımsız kâhin test/bagimsiz/mobil-yazma (program-surucu.mjs, KAHIN_PROGRAM_KOKU=kopya; el senaryoları) — karşılaştırma çıktısı mutasyonsuz kopyanın
//       çıktısından farklıysa YAKALANDI (kâhinin bilinen İNCELE farkları taban çıktıda vardır; mutasyon yeni fark üretmeli).
// Kullanım: node test/mobil-yazma-247-mutasyon.mjs --kopya <git archive kopyası> [--yalniz 3,7] [--kahinsiz]
// Kopya: git archive HEAD | tar -x -C <klasör> (+ node_modules bağı yalnız e2e gerekirse; burada gerekmez). Kopyanın dosyası her mutasyondan sonra geri yazılır.
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = name => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null);
const COPY = opt("--kopya") ? path.resolve(opt("--kopya")) : null;
if (!COPY) throw new Error("--kopya <programın ayrı kopyası> gerekli (ders 23)");
const ONLY = opt("--yalniz") ? new Set(opt("--yalniz").split(",").map(Number)) : null;
const KAHINSIZ = argv.includes("--kahinsiz");
// Kâhinin el senaryolarından mobil yazma yolunu kapsayanlar (rastgele R1–R3 uzun; mutasyon başına el senaryoları yeter).
const SENARYOLAR = [
  "E01-es-nakit-fifo-mobil", "E02-es-havale-pos-mobil", "E03-es-kapatilacak-mobil", "E04-es-odeme-mobil", "E05-es-taksit-mobil", "E06-kesinti-once", "E07-kesinti-sonra",
  "E08-ayni-kimlik-farkli-govde", "E09-reddedilen-kimlik", "E15-sirket-yetkisi", "E16-baska-sirket-kimligi", "E19-es-stok-mobil", "E21-gece-yarisi", "E22-gece-yarisi-yeniden",
  "E28-rol-yetkisi", "E29-benzer-islem", "E30-es-kasa-eksi-mobil", "E34-iki-sirket-ayni-kimlik", "E39-cift-dokunus-ayni-anda",
].join(",");

const W = "server/lib/mobile-write.mjs";
// [no, ad, dosya, eski metin, yeni metin] — eski metin dosyada TAM BİR KEZ geçmeli (yoksa mutasyon kurulamadı = hata).
const MUTASYONLAR = [
  [1, "yön: mobil tahsilat ödeme olarak yazılır", W, 'fields: ["amount", "method", "bankAccountId", "posId", "note", "similarOk"],\n    fixed: { kind: "in" },', 'fields: ["amount", "method", "bankAccountId", "posId", "note", "similarOk"],\n    fixed: { kind: "out" },'],
  [2, "yön: mobil ödeme tahsilat olarak yazılır", W, 'fixed: { kind: "out" },', 'fixed: { kind: "in" },'],
  [3, "yön: mobil stok girişi çıkış olarak yazılır", W, 'fixed: { kind: "in", pay: "none" },', 'fixed: { kind: "out", pay: "none", force: true },'],
  [4, "tutar: virgül düşer (1250,50 → 125050)", W, "if (typeof value === \"string\" && AMOUNT.test(value.trim())) return value.trim();", "if (typeof value === \"string\" && AMOUNT.test(value.trim())) return value.trim().replace(\",\", \"\");"],
  [5, "tutar: 3 ondalık kabul edilir (yuvarlanır)", W, "const AMOUNT = /^\\d{1,13}(,\\d{1,2})?$/;", "const AMOUNT = /^\\d{1,13}(,\\d{1,3})?$/;"],
  [6, "hesap: seçilen banka hesabı iletilmez", W, "if (value !== undefined && value !== null) out[key] = value;", "if (value !== undefined && value !== null && key !== \"bankAccountId\") out[key] = value;"],
  [7, "hesap: POS / Kredi Kartı yolu nakde (Kasa'ya) çevrilir", W, "    out.method = method;\n", "    out.method = method === \"card\" ? \"cash\" : method;\n"],
  [8, "S1/FIFO: mobilde Kapatılacak Fatura kabul edilir", W, 'fields: ["amount", "method", "bankAccountId", "posId", "note", "similarOk"],', 'fields: ["amount", "method", "bankAccountId", "posId", "note", "similarOk", "invoiceId"],'],
  [9, "S1: kapalı alan sessizce düşürülür (ret yok)", W, "if (!route.fields.includes(key)) throw fieldError(key, CLOSED[key]);", "if (!route.fields.includes(key)) continue;"],
  [10, "istek kimliği programın ucuna iletilmez", W, 'stream.headers = { ...req.headers, "content-type"', 'stream.headers = { ...req.headers, "x-hof-request": "", "content-type"'],
  [11, "istek kimliği her gönderimde değişir (yeniden gönderim ikinci kayıt)", W, 'stream.headers = { ...req.headers, "content-type"', 'stream.headers = { ...req.headers, "x-hof-request": `${req.headers["x-hof-request"]}-${Math.random().toString(36).slice(2, 8)}`, "content-type"'],
  [12, "istek kimliği zorunlu değil", W, "if (!REQUEST_ID.test(requestId)) throw", "if (false) throw"],
  [13, "şirket yok sayılır (kullanıcının seçili şirketine yazılır)", W, "`${route.target(id)}?hofCompany=${encodeURIComponent(company)}`", "route.target(id)"],
  [14, "S6: telefonun tarihi kabul edilir", W, 'fields: ["amount", "method", "bankAccountId", "posId", "note", "similarOk"],', 'fields: ["amount", "method", "bankAccountId", "posId", "note", "similarOk", "date"],'],
  [15, "S4: Kasa eksi sorusu sorulmadan geçilir (Yine de Kaydet hep açık)", W, 'fixed: { kind: "out" },', 'fixed: { kind: "out", cashForce: true },'],
  [16, "S4: Benzer İşlem sorulmadan geçilir", W, 'fields: ["amount", "method", "bankAccountId", "posId", "note", "similarOk"],\n    fixed: { kind: "in" },', 'fields: ["amount", "method", "bankAccountId", "posId", "note", "similarOk"],\n    fixed: { kind: "in", similarOk: true },'],
  [17, "S4/K8: Fazlasını Avans Yaz sorulmadan uygulanır", W, 'fields: ["amount", "method", "bankAccountId", "posId", "note", "similarOk", "overpay"],\n    fixed: { kind: "in" },', 'fields: ["amount", "method", "bankAccountId", "posId", "note", "similarOk", "overpay"],\n    fixed: { kind: "in", overpay: true },'],
  [18, "S8: mobilde stok çıkışı kabul edilir", W, 'fields: ["qty", "note"],', 'fields: ["qty", "note", "kind", "force"],'],
  [19, "yetki (ekran): ödeme hakkı herkese görünür", W, 'odeme: has.has("accounts.manage")', "odeme: true"],
  [20, "yetki (çekirdek): ödeme personelde de yazılır", "server/routes/accounts.mjs", 'if (kind !== "in" && !canUser(user, "accounts.manage")) throw', "if (false) throw"],
  [21, "FIFO (çekirdek): bağsız ödeme en YENİ borçtan dağılır", "server/lib/invoice-settle.mjs", "const sorted = [...lines].sort((a, b) => (a.date === b.date ? String(a.at || \"\").localeCompare(String(b.at || \"\")) : a.date < b.date ? -1 : 1));", "const sorted = [...lines].sort((a, b) => (a.date === b.date ? String(b.at || \"\").localeCompare(String(a.at || \"\")) : a.date < b.date ? 1 : -1));"],
  [22, "yanıt: yineleme 'yeni kayıt' gibi bildirilir", W, "replayed: data?.replayed === true,\n      receiptNo: entry?.receiptNo ?? null,\n      date: entry?.date || \"\",\n      account:", "replayed: false,\n      receiptNo: entry?.receiptNo ?? null,\n      date: entry?.date || \"\",\n      account:"],
];

const run = (cmd, args, env = {}) => spawnSync(cmd, args, { cwd: COPY, env: { ...process.env, ...env }, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, timeout: 30 * 60_000 });
const birim = () => {
  const r = run(process.execPath, ["--disable-warning=ExperimentalWarning", "--test", "--test-concurrency=1", "test/mobil-yazma-247.test.mjs"]);
  const fail = Number(/# fail (\d+)/.exec(r.stdout)?.[1] ?? -1);
  const pass = Number(/# pass (\d+)/.exec(r.stdout)?.[1] ?? -1);
  const names = [...r.stdout.matchAll(/^ {4}not ok \d+ - (.+)$/gm)].map(m => m[1]);
  return { status: r.status, fail, pass, names };
};
const kahin = () => {
  const r = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", path.join(HERE, "bagimsiz", "mobil-yazma", "program-surucu.mjs"), "--senaryo", SENARYOLAR], { cwd: path.resolve(HERE, ".."), env: { ...process.env, KAHIN_PROGRAM_KOKU: COPY }, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, timeout: 30 * 60_000 });
  // Karşılaştırmanın yalnız sonuç satırları (ok / not ok + fark iletileri); sürücü hatası da çıktıdır.
  return r.stdout.split(/\r?\n/).filter(line => /^(ok|not ok) \d+|^ {2}# |^# SÜRÜCÜ HATASI/.test(line)).join("\n");
};

const taban = { birim: birim(), kahin: KAHINSIZ ? "" : kahin() };
console.log(`taban: birim ${taban.birim.pass} geçti / ${taban.birim.fail} kaldı (çıkış ${taban.birim.status}); kâhin satırı ${taban.kahin.split("\n").length}`);
if (taban.birim.fail !== 0 || taban.birim.status !== 0) throw new Error("taban birim testleri yeşil değil — mutasyon taraması anlamsız");
let yakalanan = 0;
let toplam = 0;
const sonuc = [];
for (const [no, ad, file, eski, yeni] of MUTASYONLAR) {
  if (ONLY && !ONLY.has(no)) continue;
  const yol = path.join(COPY, file);
  const asil = readFileSync(yol, "utf8");
  const adet = asil.split(eski).length - 1;
  if (adet !== 1) throw new Error(`mutasyon ${no} kurulamadı: eski metin ${adet} kez geçiyor (${file})`);
  writeFileSync(yol, asil.replace(eski, yeni));
  let b;
  let k = "";
  try {
    b = birim();
    k = KAHINSIZ ? "" : kahin();
  } finally {
    writeFileSync(yol, asil);
  }
  const birimYakaladi = b.status !== 0 || b.fail > 0;
  const kahinYakaladi = !KAHINSIZ && k !== taban.kahin;
  toplam += 1;
  if (birimYakaladi || kahinYakaladi) yakalanan += 1;
  const satir = `${birimYakaladi || kahinYakaladi ? "ok" : "not ok"} ${no} - ${ad} · birim ${birimYakaladi ? `YAKALADI (${b.fail} kırmızı: ${b.names.slice(0, 2).join(" | ")})` : "kaçırdı"} · kâhin ${KAHINSIZ ? "koşulmadı" : kahinYakaladi ? "YAKALADI" : "kaçırdı"}`;
  sonuc.push(satir);
  console.log(satir);
}
console.log(`1..${toplam}\n# tests ${toplam}\n# pass ${yakalanan}\n# fail ${toplam - yakalanan}\n# cancelled 0\n# skipped 0\n# todo 0`);
console.log(`${yakalanan}/${toplam} mutasyon yakalandı`);
void execFileSync;
process.exit(yakalanan === toplam ? 0 : 1);
