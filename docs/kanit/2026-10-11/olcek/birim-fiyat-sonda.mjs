// Ölçek testinde bulunan ürün hatasının en küçük yeniden üretimi (kod değiştirilmedi; yalnız gözlem).
// server/lib/invoice-math.mjs:179 — "birim fiyat en çok dört ondalık" denetimi kayan noktalı: |x·10000 − round(x·10000)| > 1e-6.
// Yaklaşık 4,2 milyon TL'nin üstündeki iki ondalıklı (kuruşlu) birim fiyatların bir kısmı GEÇERLİ olduğu hâlde 400 ile reddedilir
// (aynı kalıp miktarda: satır 176, "en çok üç ondalık"). Mutabakat motoru büyük Kasa bakiyesinde (motor "fatura-acid/kasa", tohum 2101,
// 8.000 işlem) bu yolla dört kez "yanlış ret" verdi.
// Koşu: node --disable-warning=ExperimentalWarning docs/kanit/2026-10-11/olcek/birim-fiyat-sonda.mjs
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const { startTestServer, loginAdmin } = await import(pathToFileURL(path.join(ROOT, "test", "helpers.mjs")).href);
const server = await startTestServer();
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
let bad = 0;
try {
  const api = await loginAdmin(server);
  const today = unwrap(await api.get("/api/workspace/ledger/lock")).today;
  const cari = unwrap(await api.post("/api/workspace/accounts", { name: "Sonda Gayrimenkul A.Ş.", type: "customer", registeredOn: today }));
  const sale = unitPrice => api.post("/api/workspace/invoices", { kind: "sale", accountId: cari.id, issueDate: today, lines: [{ name: "Daire satışı", qty: 1, unitPrice, discountRate: 0, vatRate: 20 }], payment: { cash: [], cheques: [], endorse: [], rest: "open" } });
  for (const [unitPrice, valid] of [[4_000_000.02, true], [5_000_000.02, true], [12_345_678.91, true], [5_000_000.12345, false]]) {
    const r = await sale(unitPrice);
    const verdict = valid ? (r.status === 200 ? "doğru (kabul)" : "YANLIŞ RET") : r.status === 400 ? "doğru (ret)" : "YANLIŞ KABUL";
    if (verdict.startsWith("YANLIŞ")) bad += 1;
    console.log(`birim fiyat ${unitPrice} (${valid ? "geçerli, 2 ondalık" : "geçersiz, 5 ondalık"}) → ${r.status} ${r.status === 200 ? "" : JSON.stringify(r.data).slice(0, 140)} · ${verdict}`);
  }
} finally {
  await server.close();
}
console.log(bad ? `${bad} yanlış sonuç (hata yeniden üretildi)` : "hata üretilemedi");
