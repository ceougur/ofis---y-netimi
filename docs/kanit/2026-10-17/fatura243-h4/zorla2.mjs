// H4 zorla üretme — kesin ön koşul (ders 20). Hipotez: yük altındaki SUNUCU (sahte EDM, hız testinde yük üreticisiyle aynı süreçte) olay döngüsü
// bloklanınca, istemcinin keep-alive ile yeniden kullandığı bağlantıdaki isteği okumadan önce kendi boşta zamanlayıcısını (Node http keepAliveTimeout
// 5 sn) çalıştırır ve bağlantıyı kapatır → istemcide "other side closed" (UND_ERR_SOCKET). İstemci tarafında kural ihlali yok (bağlantı istemciye göre
// 3,5 sn boştaydı; sunucunun "Keep-Alive: timeout=5" ipucunun altında).
// Akış (her tur): çağrı → sahte EDM'ye "SONRA ms sonra BLOK ms blokla" → BOS ms bekle → aynı istemciyle çağrı (havuzdaki bağlantı yeniden kullanılır).
// Kullanım: node zorla2.mjs <kod kökü> [tur=5] [islem=checkUser|status] [BOS,SONRA,BLOK=2500,2000,4000]
import { fork } from "node:child_process";

const root = process.argv[2];
const rounds = Number(process.argv[3] || 5);
const op = process.argv[4] || "checkUser";
// Zamanlama (ms): istemci bağlantıyı BOS ms boşta bırakır; sahte EDM SONRA ms sonra BLOK ms bloklanır. Undici sunucunun "timeout=5" ipucundan eşik
// düşer (bağlantıyı ~3 sn'den uzun boşta tutmaz) → BOS < 3000.
const [BOS, SONRA, BLOK] = (process.argv[5] || "2500,2000,4000").split(",").map(Number);
const { createEdmClient, resetEdmCaches } = await import(`${root}/server/lib/einvoice/edm.mjs`);
const child = fork(new URL("./mock-surec.mjs", import.meta.url), [root], { stdio: ["ignore", "ignore", "inherit", "ipc"] });
const url = await new Promise(resolve => child.once("message", message => resolve(message.url)));
resetEdmCaches();
const client = createEdmClient({ baseUrl: url, username: "edmkullanici", password: "Gizli-Parola-1", env: "test" });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const invoice = { ettn: "11111111-2222-3333-4444-555555555555", number: "TEA2026000000001", profile: "EARSIVFATURA" };
const once = () => (op === "status" ? client.status({ invoice }).catch(error => (String(error?.extra?.integratorCode || error?.integratorCode) === "11017" ? null : Promise.reject(error))) : client.checkUser("1234567890"));
const out = { root, op, rounds, bos: BOS, sonra: SONRA, blok: BLOK, ok: 0, fail: 0, codes: {} };
await once();
for (let i = 0; i < rounds; i += 1) {
  await once();
  child.send({ blok: BLOK, sonra: SONRA });
  await sleep(BOS);
  try {
    await once();
    out.ok += 1;
  } catch (error) {
    out.fail += 1;
    out.codes[error.message] = (out.codes[error.message] || 0) + 1;
  }
  await sleep(2500);
}
console.log(JSON.stringify(out));
child.send("kapat");
