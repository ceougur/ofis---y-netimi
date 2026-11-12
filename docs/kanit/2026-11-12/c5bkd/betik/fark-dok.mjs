// Fark testinin okuduğu GERÇEK farkları JSON olarak döker (test/tyk-fark-v249-250.test.mjs ile aynı okuma). Kullanım: ROOT=<kod kökü> node fark-dok.mjs <fikstür klasörü> > farklar.json
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";

const ROOT = process.env.ROOT;
const DIR = process.argv[2];
const helpers = await import(pathToFileURL(path.join(ROOT, "test/helpers.mjs")).href);
const { diffFacts, readFacts } = await import(pathToFileURL(path.join(ROOT, "test/tyk-fark-oku.mjs")).href);
const unwrap = response => (response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data);
const old = JSON.parse(readFileSync(path.join(DIR, "v249.json"), "utf8"));
const root = mkdtempSync(path.join(tmpdir(), "c5bkd-fark-"));
const dataDir = path.join(root, "data");
mkdirSync(dataDir, { recursive: true });
writeFileSync(path.join(dataDir, "destekofis.sqlite"), gunzipSync(readFileSync(path.join(DIR, "destekofis.sqlite.gz"))));
copyFileSync(path.join(DIR, "sirketler.json"), path.join(dataDir, "sirketler.json"));
const server = await helpers.startTestServer({ dataDir, backupDir: path.join(root, "backups"), now: { time: old.now, fixed: true }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
let now;
try {
  const client = await helpers.loginAdmin(server);
  now = await readFacts(async url => {
    const res = await client.get(url);
    if (res.status !== 200) throw new Error(`${url}: ${res.status}`);
    return unwrap(res);
  }, { today: old.today, prefix: "TYKF " });
} finally {
  await server.close();
  helpers.removeTestDir(root);
}
console.log(JSON.stringify({ farklar: diffFacts(old, now), cariler: now.cariler }, null, 1));
