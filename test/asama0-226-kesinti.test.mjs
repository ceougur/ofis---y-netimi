// 2.0.26 — B5: Silinenler'e (trash) yazım silmeyle aynı veri tabanı işleminde. Gerçek kesinti: silme isteği işlenirken, Silinenler
// satırı yazılacağı anda süreç SIGKILL ile öldürülür (elektrik kesintisi). Uygulama yeniden açılınca satır ya silinmiş VE
// Silinenler'de olmalı ya da hiç silinmemiş olmalı — "silinmiş ama Silinenler'de yok" (geri getirilemeyen kayıp) olamaz.
// 2.0.25'te kayıt tahsilatı ve Kasa hareketi silmede Silinenler yazımı işlem DIŞINDAYDI (workspace.mjs, cash.mjs): satır diske
// silinmiş olarak yazılıyor, Silinenler satırı yazılamadan kesinti olursa tahsilat iz bırakmadan kayboluyordu.
import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { after, describe, it } from "node:test";
import { ADMIN_PASSWORD, createClient, startTestServer } from "./helpers.mjs";

const CHILD = path.join(path.dirname(fileURLToPath(import.meta.url)), "asama0-226-kesinti-cocuk.mjs");
const OPEN_DAY = "2025-09-10";

async function crashDuringTrash(root, prepare, remove) {
  const dataDir = path.join(root, "data");
  const marker = path.join(root, `donduruldu-${Date.now()}`);
  const child = fork(CHILD, [dataDir, path.join(root, "backups"), marker, ADMIN_PASSWORD], { stdio: ["ignore", "ignore", "pipe", "ipc"], execArgv: ["--disable-warning=ExperimentalWarning"] });
  let stderr = "";
  child.stderr.on("data", chunk => (stderr += chunk));
  const exited = new Promise(resolve => child.once("exit", resolve));
  const { port } = await new Promise((resolve, reject) => {
    child.once("message", resolve);
    child.once("exit", code => reject(new Error(`çocuk süreç açılmadı (${code}): ${stderr.slice(0, 500)}`)));
  });
  const client = createClient(`http://127.0.0.1:${port}`);
  assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
  const id = await prepare(client);
  const pending = remove(client, id).catch(() => null);
  for (let i = 0; i < 200 && !existsSync(marker); i += 1) await sleep(25);
  assert.ok(existsSync(marker), "silme Silinenler yazımına ulaşmalı");
  child.kill("SIGKILL");
  await exited;
  await pending;
  return { dataDir, id };
}

describe("B5 — Silinenler yazımı ortasında SIGKILL: yarım kayıt yok", () => {
  const roots = [];
  after(() => roots.forEach(root => rmSync(root, { recursive: true, force: true })));

  for (const scenario of [
    {
      name: "kayıt tahsilatı",
      table: "payments",
      prepare: async client => (await client.post("/api/workspace/cases/KESINTI-1/payments", { amount: "1.250", date: OPEN_DAY, method: "bank", caseTitle: "Kesinti" })).data.data.id,
      remove: (client, id) => client.del(`/api/workspace/payments/${id}`),
    },
    {
      name: "Kasa hareketi",
      table: "cash_entries",
      prepare: async client => (await client.post("/api/workspace/cash", { kind: "in", amount: "640", date: OPEN_DAY, description: "Kesinti" })).data.data.id,
      remove: (client, id) => client.del(`/api/workspace/cash/${id}`),
    },
  ]) {
    it(`${scenario.name}: kesintiden sonra satır ya yerinde ya da Silinenler'de (ikisi birden yok olamaz)`, async () => {
      const root = mkdtempSync(path.join(tmpdir(), "destekofis-kesinti-"));
      roots.push(root);
      const { dataDir, id } = await crashDuringTrash(root, scenario.prepare, scenario.remove);
      const server = await startTestServer({ dataDir });
      try {
        const store = server.app.store;
        const kept = store.get(`SELECT COUNT(*) AS n FROM ${scenario.table} WHERE id = ?`, id).n;
        const trashed = store.get("SELECT COUNT(*) AS n FROM trash WHERE ref = ?", id).n;
        assert.equal(kept + trashed, 1, `${scenario.name}: yerinde ${kept}, Silinenler'de ${trashed} — kayıt kayboldu`);
        assert.equal(kept, 1, "işlem tamamlanmadan kesildi: silme geri alınmış olmalı");
        const integrity = server.app.integrity.run();
        assert.equal(integrity.ok, true, JSON.stringify(integrity.failures).slice(0, 400));
      } finally {
        await server.close();
      }
    });
  }
});
