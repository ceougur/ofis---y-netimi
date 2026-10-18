// 2.4.3 fatura/e-Belge düzeltmeleri — MUTASYON (KANIT KURALI 3, ders 7): her kural bilerek bozulur, ilgili yeni test KIRMIZI olmalı; sonra dosya geri
// yüklenir. Ayrı kopyada koşar (ders 23): node mutasyon.mjs <kopya kökü> → stdout JSON (her mutasyon: yakalandı mı, test sayıları).
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2]);
const MUTANTS = [
  { id: "B1-sira", file: "server/routes/invoices.mjs", test: "test/ebelge-243-gonderim.test.mjs", what: "Tümünü Gönder istemcinin sırasıyla (sıralama yok)", from: "|| x.rn - y.rn;\n    });", to: "|| x.rn - y.rn;\n    }) && ids.filter(id => known.has(id));" },
  { id: "B1-kronoloji", file: "server/routes/invoices.mjs", test: "test/ebelge-243-gonderim.test.mjs", what: "eski numarasız belge düşünce yenisi bekletilmez", from: "if (blocker && blocker.issueDate < row.issueDate) {", to: "if (false && blocker && blocker.issueDate < row.issueDate) {" },
  { id: "B3-toplu", file: "server/routes/invoices.mjs", test: "test/ebelge-243-gonderim.test.mjs", what: "toplu kesimde otomatik gönderim kapalıyken bekletme yok", from: ': edocEnabled && !autoSend ? "later" : "" };', to: ': "" };' },
  { id: "H1-liste", file: "server/routes/invoices.mjs", test: "test/ebelge-243-gonderim.test.mjs", what: "Gönderilecekler yalnız 'waiting'", from: "IN ('', 'none', 'error') AND i.profile <> 'KAGIT'", to: "IN ('__yok__') AND i.profile <> 'KAGIT'" },
  { id: "H1-ileti", file: "server/routes/invoices.mjs", test: "test/ebelge-243-gonderim.test.mjs", what: "gönderim hatası belgeye yazılmaz", from: "    if (!row || row.status !== \"issued\" || row.eStatus === \"draft\" || !message || row.eMessage === message) return;", to: "    return;" },
  { id: "H4-yineleme-yok", file: "server/lib/einvoice/edm.mjs", test: "test/ebelge-243-gonderim.test.mjs", what: "kopan bağlantıda yan etkisiz çağrı yinelenmez", from: 'const SAFE_OPERATIONS = new Set(["Login", "CheckUser", "GetInvoiceStatus", "GetInvoice", "MarkInvoice"]);', to: "const SAFE_OPERATIONS = new Set([]);" },
  { id: "H4-gonderim-yinelenir", file: "server/lib/einvoice/edm.mjs", test: "test/ebelge-243-gonderim.test.mjs", what: "gönderim (yan etkili) de yinelenir", from: 'const SAFE_OPERATIONS = new Set(["Login", "CheckUser", "GetInvoiceStatus", "GetInvoice", "MarkInvoice"]);', to: 'const SAFE_OPERATIONS = new Set(["Login", "CheckUser", "GetInvoiceStatus", "GetInvoice", "MarkInvoice", "SendInvoice"]);' },
  { id: "H7-yoklama", file: "server/routes/invoices.mjs", test: "test/ebelge-243-gonderim.test.mjs", what: "iptalde durum yeniden sorulmaz", from: "      for (const wait of STATUS_POLL_MS) {", to: "      for (const wait of []) {" },
  { id: "H7-yazim", file: "server/routes/invoices.mjs", test: "test/ebelge-243-gonderim.test.mjs", what: "sorgulanan durum belgeye yazılmaz", from: "      if (current?.status && current.status !== existing.eStatus) setE(", to: "      if (false) setE(" },
  // İlk turda "H8-koru" (vatRateOf'un undefined dalı) yakalanmadı: eşdeğer mutanttı (PUT gövdeyi önceki kayıtla birleştirir, dal çalışmıyordu) —
  // dal kaldırıldı; koruma yazım yolunda sınanır.
  { id: "H8-koru", file: "server/routes/stock.mjs", test: "test/fatura-243-stok-kdv.test.mjs", what: "düzenleme oranı yazmaz (NULL'a çeker)", from: "sale_price = ?, vat_rate = ?, note = ?, updated_by = ?, updated_at = ? WHERE id = ?\", input.kind", to: "sale_price = ?, vat_rate = NULL, note = ?, updated_by = ?, updated_at = ? WHERE id = ?\", input.kind" },
  { id: "H8-arama", file: "server/routes/invoices.mjs", test: "test/fatura-243-stok-kdv.test.mjs", what: "fatura ürün araması oranı vermez", from: "sale_price AS salePrice, vat_rate AS vatRate FROM stock_items WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE", to: "sale_price AS salePrice, NULL AS vatRate FROM stock_items WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE" },
  { id: "H8-excel-guncelle", file: "server/routes/stock.mjs", test: "test/fatura-243-stok-kdv.test.mjs", what: "Excel güncellemede boş hücre oranı siler", from: "vat_rate = COALESCE(?, vat_rate)", to: "vat_rate = ?" },
  { id: "H8-yeni-kart", file: "server/routes/invoices.mjs", test: "test/fatura-243-stok-kdv.test.mjs", what: "faturadan açılan kart oranı almaz", from: "salePrice: input.create.salePrice, vatRate: input.vatRate, invoiceId", to: "salePrice: input.create.salePrice, invoiceId" },
  { id: "B9-tukenen", file: "server/routes/stock.mjs", test: "test/fatura-243-stok-kdv.test.mjs", what: "eksi ürün Tükenen'de de sayılır", from: "if (!service && level.qty === 0) totals.out += 1;", to: "if (!service && level.qty <= 0) totals.out += 1;" },
  { id: "B9-uyari", file: "server/routes/stock.mjs", test: "test/fatura-243-stok-kdv.test.mjs", what: "uyarı listesi yalnız kritik seviyedekiler", from: "return data.items.filter(item => item.low).map(", to: "return data.items.filter(item => item.state === \"low\").map(" },
  { id: "B8-gunde-bir", file: "server/routes/stock.mjs", test: "test/fatura-243-stok-kdv.test.mjs", what: "bildirim her istekte gösterilir", from: "    const show = store.setting(key, \"\") !== day;", to: "    const show = true;" },
];
const results = [];
for (const mutant of MUTANTS) {
  const file = path.join(root, mutant.file);
  const original = readFileSync(file, "utf8");
  const count = original.split(mutant.from).length - 1;
  if (count !== 1) {
    results.push({ id: mutant.id, what: mutant.what, error: `kalıp ${count} kez bulundu (1 olmalı)` });
    continue;
  }
  writeFileSync(file, original.replace(mutant.from, mutant.to));
  let out = "";
  let code = 0;
  try {
    out = execFileSync(process.execPath, ["--disable-warning=ExperimentalWarning", "--test", "--test-concurrency=1", path.join(root, mutant.test)], { cwd: root, encoding: "utf8", env: { ...process.env, HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, stdio: ["ignore", "pipe", "pipe"], timeout: 600_000 });
  } catch (error) {
    out = `${error.stdout || ""}${error.stderr || ""}`;
    code = error.status ?? 1;
  } finally {
    writeFileSync(file, original);
  }
  const num = key => Number((out.match(new RegExp(`^# ${key} (\\d+)`, "m")) || [])[1] ?? NaN);
  const failedTests = [...out.matchAll(/^ {4}not ok \d+ - (.*)$/gm)].map(match => match[1].slice(0, 90));
  results.push({ id: mutant.id, what: mutant.what, test: mutant.test, exit: code, tests: num("tests"), pass: num("pass"), fail: num("fail"), caught: code !== 0 && num("fail") > 0, failedTests });
  console.error(`${mutant.id}: ${code !== 0 && num("fail") > 0 ? "YAKALANDI" : "YAKALANMADI"} (${num("fail")}/${num("tests")})`);
}
console.log(JSON.stringify({ root, results, caught: results.filter(item => item.caught).length, total: results.length }, null, 1));
