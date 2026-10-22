// Başlarken (2.4.4, KÖ3) fikstürü: 2.4.3'ten güncellenen, verisi dolu kurulum. v2.4.3 etiketinin GERÇEK kodu açılır ve kullanıcı gibi
// API'sinden veri girilir (ders 17; "uydurma verilerle değil"): 001'de cariler + firma adı/VKN'si yazılmış ama vergi dairesi ve ili eksik Fatura
// Ayarları (adımlar bilerek eksik), 002'de cariler + banka hesabı. Test (test/baslarken-244.test.mjs) bu kurulumun güncellemeden sonra listeyle
// KARŞILAŞMADIĞINI denetler. Etiket gerekir (git fetch --tags); CI depodaki fikstürü kullanır.
//
//   node --disable-warning=ExperimentalWarning tools/baslarken-fikstur.mjs
//   → test/fixtures/surum-2.4.3-baslarken/fikstur.json + test/fixtures/surum-nesneler/<sha256>.br
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { packFixture } from "../test/guvenilirlik/fikstur.mjs";
import { bootVersion } from "../test/guvenilirlik/surumler.mjs";

const VERSION = "v2.4.3";
const NAME = "surum-2.4.3-baslarken";
const must = async (label, promise) => {
  const response = await promise;
  if (response.status !== 200) throw new Error(`${label}: ${response.status} ${JSON.stringify(response.data).slice(0, 300)}`);
  return response.data;
};
// Geçerli Türkiye IBAN'ı (ISO 13616 mod 97).
const iban = (bankCode, account) => {
  const bban = `${String(bankCode).padStart(5, "0")}0${String(account).padStart(16, "0")}`;
  let rest = 0;
  for (const digit of `${bban}292700`) rest = (rest * 10 + Number(digit)) % 97;
  return `TR${String(98 - rest).padStart(2, "0")}${bban}`;
};

const root = mkdtempSync(path.join(tmpdir(), "baslarken-fikstur-"));
const dataDir = path.join(root, "data");
const backupDir = path.join(root, "backups");
const app = await bootVersion(VERSION, { dataDir, backupDir, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
try {
  const api = await app.login();
  for (let index = 1; index <= 120; index += 1) await must(`001 cari ${index}`, api.post("/api/workspace/accounts", { name: `Eski Müşteri ${index}`, type: index % 4 ? "customer" : "supplier", phone: `0532${String(1000000 + index)}` }));
  await must("001 fatura ayarları", api.put("/api/workspace/invoices/settings", { seller: { name: "Eski Kurulum Ltd. Şti.", taxNo: "4840847211" } }));
  const second = (await must("002 aç", api.post("/api/companies", { name: "Eski İkinci Şirket A.Ş." }))).company;
  const q = `?hofCompany=${encodeURIComponent(second.id)}`;
  for (let index = 1; index <= 40; index += 1) await must(`002 cari ${index}`, api.post(`/api/workspace/accounts${q}`, { name: `İkinci Şirket Carisi ${index}`, type: "customer" }));
  await must("002 banka hesabı", api.post(`/api/workspace/bank/accounts${q}`, { bankName: "Garanti BBVA", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", iban: iban(62, 9900123) }));
} finally {
  await app.close();
}
const registry = JSON.parse(readFileSync(path.join(dataDir, "sirketler.json"), "utf8")).companies.map(({ id, code, name, dir }) => ({ id, code, name, dir }));
const packed = packFixture({ name: NAME, dataDir, backupDir, manifest: { cut: VERSION, version: VERSION, commit: app.commit, registry, generator: { command: "node --disable-warning=ExperimentalWarning tools/baslarken-fikstur.mjs" } } });
rmSync(root, { recursive: true, force: true });
console.log(`${NAME}: ${packed.files} dosya, ${packed.bytes} bayt (${VERSION} ${app.commit})`);
