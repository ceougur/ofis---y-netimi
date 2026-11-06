// Ç2 tur 1 — fiş korumasının türettiği alt defter hesapları (routes/ledger.mjs subledgerAccounts) boş kurulumda ve dolu (motor) veride aynı mı; tasarım notu K6 listesiyle.
// Kullanım: HUKUK_LICENSE_URL=http://127.0.0.1:9 node sahip-hesaplar.mjs <depo kökü>
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(process.argv[2]);
const { startTestServer } = await import(pathToFileURL(path.join(ROOT, "test/helpers.mjs")).href);
const K6 = ["100", "101", "102", "103", "108", "120", "121", "127", "128", "129", "190", "191", "193", "300", "309", "320", "321", "336", "360", "391"];
const server = await startTestServer({ now: { time: "2027-01-10T10:00:00+03:00", fixed: true } });
try {
  const V = server.app.ledger.vouchers;
  const { ACCOUNT_PLAN } = await import(pathToFileURL(path.join(ROOT, "server/lib/general-ledger.mjs")).href);
  const owned = [];
  for (const account of Object.keys(ACCOUNT_PLAN)) {
    try {
      V.post({ id: "x" }, { type: "opening-match", date: "2027-01-05", requestKey: `sahip-${account}-000001`, lines: account === "519" ? [{ account: "590", debit: 1 }, { account: "519", credit: 1 }] : [{ account, debit: 1 }, { account: "519", credit: 1 }] });
    } catch (error) {
      owned.push(`${account}:${error.status}:${error.extra?.code || ""}`);
    }
  }
  const codes = owned.map(item => item.split(":")[0]);
  console.log(`planda ${Object.keys(ACCOUNT_PLAN).length} hesap; fişle yazılamayan ${owned.length}: ${owned.join(" ")}`);
  console.log(`K6 listesiyle aynı mı: ${JSON.stringify(codes) === JSON.stringify(K6) ? "EVET" : `HAYIR (fazla ${codes.filter(c => !K6.includes(c))}, eksik ${K6.filter(c => !codes.includes(c))})`}`);
} finally {
  await server.close();
}
