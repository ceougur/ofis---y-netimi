// Keşif koşusu: ROOT=<kod kökü> node kos-sinif.mjs > çıktı.json — m2 sınıflarını o kodla koşar (sahte saat 15.10.2026).
import path from "node:path";
import { pathToFileURL } from "node:url";
const ROOT = process.env.ROOT;
const SCEN = process.env.SCEN || path.join(ROOT, "test/fixtures/m2-degersiz-senaryo.mjs");
const helpers = await import(pathToFileURL(path.join(ROOT, "test/helpers.mjs")).href);
const scen = await import(pathToFileURL(SCEN).href);
const server = await helpers.startTestServer({ now: process.env.FIXED ? { time: scen.M2_NOW, fixed: true } : scen.M2_NOW, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const client = await helpers.loginAdmin(server);
const out = await scen.runM2Classes(client);
const integ = await client.get("/api/workspace/ledger/integrity");
out.integrity = { ok: integ.data?.data?.ok ?? integ.data?.ok, failures: (integ.data?.data?.failures || []).map(f => ({ code: f.code, sample: f.sample })) };
console.log(JSON.stringify(out, null, 1));
await server.close();
