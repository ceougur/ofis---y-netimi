// M2T2: liste hesabının parçaları (işlem dışı) — VERI kopyası, ROOT kodu.
import { pathToFileURL } from "node:url";
import path from "node:path";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
const ROOT = process.env.ROOT, VERI = process.env.VERI;
const imp = p => import(pathToFileURL(path.join(ROOT, p)).href);
const { startTestServer } = await imp("test/helpers.mjs");
const lib = await imp("server/lib/bank/doubtful.mjs");
const work = mkdtempSync(path.join(tmpdir(), "m2t2-prof-"));
cpSync(path.join(VERI, "data"), path.join(work, "data"), { recursive: true });
const { party } = JSON.parse(readFileSync(path.join(VERI, "ids.json"), "utf8"));
const server = await startTestServer({ now: "2026-10-15T12:00:00+03:00", dataDir: path.join(work, "data"), backupDir: path.join(work, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const store = server.app.store;
const t = (label, fn) => { const a = performance.now(); const out = fn(); console.log(label, (performance.now() - a).toFixed(1), "ms"); return out; };
for (let round = 0; round < 2; round += 1) {
  const ctx = t("bağlam", () => lib.writeOffContextOf(store, party));
  const bal = lib.ledgerBalanceMinor(store, party);
  for (const record of ctx.rows.records) {
    t(`  ilk gün ${record.id.slice(4, 10)}`, () => lib.writeOffLimitOf(ctx, record, record.date, { balanceMinor: bal }));
    t(`  bugün ${record.id.slice(4, 10)}`, () => lib.writeOffLimitOf(ctx, record, "2026-10-15", { balanceMinor: bal }));
    t(`  günler ${record.id.slice(4, 10)}`, () => lib.writeOffDays(ctx, record, { today: "2026-10-15", lockedUntil: "", balanceMinor: bal }));
  }
}
server.close();
rmSync(work, { recursive: true });
