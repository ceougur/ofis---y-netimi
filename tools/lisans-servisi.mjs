// Başvuru lisans servisi ve operatör komutları (Faz 4'teki Vercel servisine kadar ve yerel deneme için).
//
//   node tools/lisans-servisi.mjs baslat --anahtar gizli.pem [--veri lisans-veri.json] [--port 5130] [--deneme-gun 30]
//   node tools/lisans-servisi.mjs lisans-olustur --veri lisans-veri.json --musteri "Çetin Hukuk" [--bitis 2027-09-25]
//   node tools/lisans-servisi.mjs engelle <anahtar|lisans-no> --veri lisans-veri.json [--mesaj "Ödeme bekleniyor"]
//   node tools/lisans-servisi.mjs etkinlestir <anahtar|lisans-no> --veri lisans-veri.json   (engeli kaldırır)
//   node tools/lisans-servisi.mjs uzat <anahtar|lisans-no> --veri lisans-veri.json --bitis 2028-09-25 | --suresiz
//   node tools/lisans-servisi.mjs serbest-birak <anahtar|lisans-no> --veri lisans-veri.json   (başka bilgisayara taşımak için)
//   node tools/lisans-servisi.mjs listele --veri lisans-veri.json
//
// Program bu servise HUKUK_LICENSE_URL=http://<adres>:5130 ortam değişkeniyle yönlendirilir.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { TRUSTED_LICENSE_KEYS } from "../server/lib/license-keys.mjs";
import { DEFAULT_TRIAL_DAYS, createFileStore, createReferenceLicenseService, keyIdForLicense } from "./lib/license-service.mjs";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    anahtar: { type: "string" },
    veri: { type: "string", default: "lisans-veri.json" },
    port: { type: "string", default: "5130" },
    "deneme-gun": { type: "string", default: String(DEFAULT_TRIAL_DAYS) },
    musteri: { type: "string", default: "" },
    bitis: { type: "string" },
    suresiz: { type: "boolean", default: false },
    mesaj: { type: "string", default: "" },
  },
});
const [command, target] = positionals;
const fail = message => {
  console.error(`✗ ${message}`);
  process.exit(1);
};
const date = value => {
  if (!value) return null;
  const time = Date.parse(value.length === 10 ? `${value}T23:59:59+03:00` : value);
  if (!Number.isFinite(time)) fail(`Tarih anlaşılamadı: ${value} (örnek 2027-09-25)`);
  return new Date(time).toISOString();
};

const store = createFileStore(values.veri);
const pem = values.anahtar ? readFileSync(values.anahtar, "utf8") : process.env.DESTEKOFIS_LICENSE_KEY || "";
const keyId = pem ? keyIdForLicense(pem, TRUSTED_LICENSE_KEYS) || process.env.DESTEKOFIS_LICENSE_KEY_ID : null;
const service = createReferenceLicenseService({ privateKeyPem: pem || null, keyId, store, trialDays: Number(values["deneme-gun"]) || DEFAULT_TRIAL_DAYS });

try {
  if (command === "baslat") {
    if (!pem) fail("Gizli lisans anahtarı gerekli: --anahtar <dosya.pem> veya DESTEKOFIS_LICENSE_KEY.");
    if (!keyId) fail("Bu anahtar programın güvendiği lisans anahtarları arasında yok (server/lib/license-keys.mjs).");
    const server = createServer((req, res) => {
      const chunks = [];
      req.on("data", chunk => chunks.push(chunk));
      req.on("end", async () => {
        let body = {};
        try {
          body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
        } catch {
          body = {};
        }
        store.reload();
        const result = req.method === "POST" ? await service.handle(new URL(req.url, "http://x").pathname, body) : { status: 405, body: { ok: false, code: "METHOD", error: "POST kullanın." } };
        res.writeHead(result.status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
        res.end(JSON.stringify(result.body));
        console.log(`${new Date().toISOString()} ${req.method} ${req.url} → ${result.status} ${result.body.code || ""}`);
      });
    });
    server.listen(Number(values.port), () => console.log(`✓ Lisans servisi http://0.0.0.0:${values.port} (anahtar ${keyId}, deneme ${values["deneme-gun"]} gün, veri ${values.veri})`));
  } else if (command === "lisans-olustur") {
    if (values.bitis && values.suresiz) fail("--bitis ile --suresiz birlikte verilemez.");
    const created = service.admin.createLicense({ customer: values.musteri, expiresAt: values.suresiz ? null : date(values.bitis), message: values.mesaj });
    console.log(`✓ Lisans oluşturuldu\n  Anahtar : ${created.key}\n  No      : ${created.licenseId}\n  Müşteri : ${created.customer || "-"}\n  Bitiş   : ${created.expiresAt || "süresiz"}`);
  } else if (command === "engelle") {
    service.admin.setStatus(target, "blocked", values.mesaj);
    console.log(`✓ Engellendi: ${target}. Program bir sonraki doğrulamada salt okunur olur.`);
  } else if (command === "etkinlestir") {
    service.admin.setStatus(target, "active", "");
    console.log(`✓ Engel kaldırıldı: ${target}`);
  } else if (command === "uzat") {
    service.admin.extend(target, values.suresiz ? null : date(values.bitis));
    console.log(`✓ Bitiş güncellendi: ${target}`);
  } else if (command === "serbest-birak") {
    service.admin.release(target);
    console.log(`✓ ${target} bilgisayardan ayrıldı; başka bir bilgisayarda etkinleştirilebilir.`);
  } else if (command === "listele") {
    const { trials, licenses } = store.data;
    console.log("Lisanslar:");
    for (const [key, item] of Object.entries(licenses)) console.log(`  ${key}  ${item.licenseId}  ${item.status}  ${item.customer || "-"}  bitiş ${item.expiresAt || "süresiz"}  ${item.machine ? `bilgisayar ${item.machine.slice(0, 8)}…` : "etkinleştirilmedi"}`);
    console.log("Denemeler:");
    for (const [machine, item] of Object.entries(trials)) console.log(`  ${item.licenseId}  bilgisayar ${machine.slice(0, 8)}…  ${item.office?.name || "-"}  ${item.startsAt.slice(0, 10)} → ${item.expiresAt.slice(0, 10)}${item.status === "blocked" ? "  ENGELLİ" : ""}`);
  } else {
    fail("Komut: baslat | lisans-olustur | engelle | etkinlestir | uzat | serbest-birak | listele (ayrıntı dosyanın başında).");
  }
} catch (error) {
  fail(error.message);
}
