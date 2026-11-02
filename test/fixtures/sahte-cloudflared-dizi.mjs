// 2.4.8 M1/M2 test yardımcısı: SAHTE cloudflared — verilen satır DİZİSİNİ cloudflared'in kendi çıktı biçiminde (stderr, zerolog konsol biçimi) sırayla yazar.
// Gerçek ikili indirilmez, Cloudflare'e bağlanılmaz. Satırlar test/tunel-durum-248.test.mjs'te cloudflared 2026.10.5 kaynağındaki iletilerden kurulur.
// Kullanım (argsPrefix): node sahte-cloudflared-dizi.mjs --sahte-dizi <dizi.json> --sahte-klasor <klasör> [cloudflared argümanları …]
// dizi.json: [ "satır" | "@bekle:<ad>" | "@isaret:<ad>" | "@cikIlk:<ad>:<kod>" , … ]
//   "@bekle:<ad>"   <klasör>/<ad> dosyası oluşana dek bekler (testin adım adım ilerletmesi);
//   "@isaret:<ad>"  önceki satırlar yazıldıktan SONRA <klasör>/<ad> dosyasını oluşturur (test "buraya kadar yazıldı"yı görür);
//   "@cikIlk:<ad>:<kod>" <klasör>/<ad> yoksa oluşturur ve <kod> ile çıkar (yalnız İLK çalışmada); yeniden başlatılan süreç bu adımın SONRASINDAN başlar;
//   "@belirtec"     ortam değişkenindeki belirteci (TUNNEL_TOKEN) satırlara koyar — günlük dosyasına gizli bilgi yazılmıyor mu (M2) denetimi için;
//   "@cok:<n>"      n adet sıradan bilgi satırı (günlük döndürme denetimi).
// Dizi bitince açık kalır (SIGTERM ile kapanır).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const opt = name => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : "";
};
const steps = JSON.parse(readFileSync(opt("--sahte-dizi"), "utf8"));
const dir = opt("--sahte-klasor");
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const write = text => new Promise(resolve => process.stderr.write(text, resolve));

process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));

let start = 0;
steps.forEach((step, i) => {
  if (step.startsWith("@cikIlk:") && existsSync(path.join(dir, step.split(":")[1]))) start = i + 1;
});
let pending = "";
const flush = async () => {
  if (pending) await write(pending);
  pending = "";
};
for (const step of steps.slice(start)) {
  if (step.startsWith("@bekle:")) {
    await flush();
    const file = path.join(dir, step.slice(7));
    while (!existsSync(file)) await wait(20);
  } else if (step.startsWith("@isaret:")) {
    await flush();
    writeFileSync(path.join(dir, step.slice(8)), String(process.pid));
  } else if (step.startsWith("@cikIlk:")) {
    const [, name, code] = step.split(":");
    const file = path.join(dir, name);
    if (!existsSync(file)) {
      await flush();
      writeFileSync(file, String(process.pid));
      process.exit(Number(code) || 1);
    }
  } else if (step === "@belirtec") {
    const token = process.env.TUNNEL_TOKEN || "";
    pending += `2026-10-30T06:52:00Z INF Sahte tanı satırı token=${token} --token ${token}\n`;
    pending += `2026-10-30T06:52:00Z ERR Sahte hata ham belirteç ${token} sonu\n`;
    pending += `2026-10-30T06:52:00Z INF Sahte kimlik bilgisi eyJhIjoiYWNjb3VudCIsInQiOiJ0dW5uZWwiLCJzIjoic2VjcmV0In0= sonu\n`;
  } else if (step.startsWith("@cok:")) {
    const n = Number(step.slice(5));
    for (let i = 1; i <= n; i += 1) pending += `2026-10-30T06:52:00Z INF Sahte satır ${String(i).padStart(5, "0")} ${"x".repeat(40)}\n`;
  } else {
    pending += `${step}\n`;
  }
}
await flush();
setInterval(() => {}, 1000);
