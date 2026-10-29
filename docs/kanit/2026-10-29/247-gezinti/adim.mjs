// 2.4.7 gezinti adımı: stdin'deki adım kodunu sunucu.mjs'in denetim ucuna (POST /adim) gönderir; kod o süreçte, AYNI Playwright sayfalarıyla (masaüstü `desk`,
// telefonlar `phones[ad]`) çalışır — gerçek tıklama, insan hızında yazım (typeSlow), Tab. Kodun erişebildikleri: g, desk, phones, newPhone, api (masaüstü oturumuyla
// fetch), napi (Node istemcisi), hub/sql/sqlFile (salt okunur sqlite), app(), kapi, world, clock (iş saati), remoteNow (bilgisayar saati), yaz, bekle, indir, vars.
// Ekran görüntüsü <kök>/ekran/<ad>.png (hedef sayfanın); çıktı: hata, url, görünen pencere başlıkları, bildirimler, notlar, konsol hataları.
// Kullanım: node adim.mjs <veri-klasörü> <ekran-adı|-> [--hedef desk|<telefon>] [--tam] < adim-kodu.js
import { readFileSync } from "node:fs";
import path from "node:path";

const [root, ad, ...rest] = process.argv.slice(2);
const durum = JSON.parse(readFileSync(path.join(root, "durum.json"), "utf8"));
const hi = rest.indexOf("--hedef");
const body = { ad: ad === "-" ? null : ad, hedef: hi >= 0 ? rest[hi + 1] : "desk", tam: rest.includes("--tam"), code: readFileSync(0, "utf8") };
const res = await fetch(`${durum.control}/adim`, { method: "POST", body: JSON.stringify(body) });
const out = await res.json();
console.log(JSON.stringify(out, null, 1));
process.exit(out.hata ? 1 : 0);
