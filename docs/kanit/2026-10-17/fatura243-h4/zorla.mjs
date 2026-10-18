// H4 zorla üretme (ders 20): "EDM'ye bağlanılamadı: UND_ERR_SOCKET".
// Sahte EDM AYRI SÜREÇTE (yükten bağımsız). Programın EDM istemcisi bir çağrıdan sonra olay döngüsünü EŞZAMANLI bloklar (yükteki sunucunun uzun
// eşzamanlı işi — ör. store.tx içinde fatura yazımı — gibi); bu sürede sahte EDM'nin keep-alive süresi (Node http 5 sn) dolar ve sahte EDM boşta
// bağlantıyı kapatır. İstemci aynı tikte yeni çağrı yapar: havuzdaki bağlantı (kapandığını henüz işlememiş) yeniden kullanılır.
// Kullanım: node zorla.mjs <kod kökü> [blokMs=5600] [tur=6] [islem=checkUser|status]
// Çıktı: JSON {ok, fail, codes} — fail > 0 ise ön koşul oluştu ve çağrı düştü.
import { fork } from "node:child_process";

const root = process.argv[2];
const blockMs = Number(process.argv[3] || 5600);
const rounds = Number(process.argv[4] || 6);
const op = process.argv[5] || "checkUser";
const { createEdmClient, resetEdmCaches } = await import(`${root}/server/lib/einvoice/edm.mjs`);
const child = fork(new URL("./mock-surec.mjs", import.meta.url), [root], { stdio: ["ignore", "ignore", "inherit", "ipc"] });
const url = await new Promise(resolve => child.once("message", message => resolve(message.url)));
resetEdmCaches();
const client = createEdmClient({ baseUrl: url, username: "edmkullanici", password: "Gizli-Parola-1", env: "test" });
const busy = ms => {
  const end = Date.now() + ms;
  while (Date.now() < end);
};
const invoice = { ettn: "11111111-2222-3333-4444-555555555555", number: "TEA2026000000001", profile: "EARSIVFATURA" };
const once = () => (op === "status" ? client.status({ invoice }).catch(error => (String(error?.extra?.integratorCode || error?.integratorCode) === "11017" ? null : Promise.reject(error))) : client.checkUser("1234567890"));
const out = { root, op, blockMs, rounds, ok: 0, fail: 0, codes: {} };
await once();
for (let i = 0; i < rounds; i += 1) {
  await once();
  busy(blockMs);
  try {
    await once();
    out.ok += 1;
  } catch (error) {
    out.fail += 1;
    out.codes[error.message] = (out.codes[error.message] || 0) + 1;
  }
}
console.log(JSON.stringify(out));
child.send("kapat");
