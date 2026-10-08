// 2.1.0 — Aşama 2, Dilim 3: bank.post yarıda kesilirse (SIGKILL = elektrik kesintisi) olay (fin_events), para satırı, istek kaydı
// (request_keys), işlem geçmişi (audit_events) ve İşlem No sayacı ya birlikte vardır ya hiçbiri (docs/BANKA-MODULU-PLAN.md §3.3
// "Kurallar"). Süreç COMMIT'ten önce, işlemin en son yazımında (Kasa'da işlem geçmişi, faturada istek kaydı) dondurulup öldürülür.
// Yeniden açılışta hiçbir parça kalmamalı; aynı istek kimliğiyle yeniden gönderim tek belge açmalı.
//
// NASIL BOZARIM: olay ya da sayaç işlemin DIŞINDA (ayrı işlemde) yazılırsa kesintiden sonra boşta olay / ileri sayaç kalır; istek
// kaydı belgeden ayrı yazılırsa yeniden gönderim "zaten kaydedildi" der ama belge yoktur.
import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { after, describe, it } from "node:test";
import { ADMIN_PASSWORD, createClient, startTestServer } from "./helpers.mjs";

const CHILD = path.join(path.dirname(fileURLToPath(import.meta.url)), "banka-210-post-kesinti-cocuk.mjs");
const pad = n => String(n).padStart(2, "0");
const d = new Date();
const TODAY = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const YEAR = Number(TODAY.slice(0, 4));

async function crashDuring(root, { table, when, prepare, act }) {
  const dataDir = path.join(root, "data");
  const marker = path.join(root, `donduruldu-${Date.now()}`);
  const child = fork(CHILD, [dataDir, path.join(root, "backups"), marker, ADMIN_PASSWORD, table, when], { stdio: ["ignore", "ignore", "pipe", "ipc"], execArgv: ["--disable-warning=ExperimentalWarning"] });
  let stderr = "";
  child.stderr.on("data", chunk => (stderr += chunk));
  const exited = new Promise(resolve => child.once("exit", resolve));
  const { port } = await new Promise((resolve, reject) => {
    child.once("message", resolve);
    child.once("exit", code => reject(new Error(`çocuk süreç açılmadı (${code}): ${stderr.slice(0, 500)}`)));
  });
  const client = createClient(`http://127.0.0.1:${port}`);
  assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
  const prepared = prepare ? await prepare(client) : null;
  const pending = act(client, prepared).catch(() => null);
  for (let i = 0; i < 200 && !existsSync(marker); i += 1) await sleep(25);
  assert.ok(existsSync(marker), "işlem dondurma noktasına ulaşmalı");
  child.kill("SIGKILL");
  await exited;
  await pending;
  return { dataDir, prepared };
}
const counterOf = store => store.get("SELECT value FROM settings WHERE key = ?", `meta.bank.seq.${YEAR}`)?.value || "";

describe("bank.post ortasında SIGKILL: olay, satır, istek kaydı, işlem geçmişi ve sayaç ya birlikte ya hiç", () => {
  const roots = [];
  after(() => roots.forEach(root => rmSync(root, { recursive: true, force: true })));

  it("Kasa girişi: işlem geçmişi yazılırken kesinti → satır, olay, sayaç yok; yeniden girilince numara 1'den", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "destekofis-210-kesinti-"));
    roots.push(root);
    const { dataDir } = await crashDuring(root, {
      table: "audit_events",
      when: "NEW.type = 'cash.entry.created'",
      act: client => client.post("/api/workspace/cash", { kind: "in", amount: "640", date: TODAY, description: "Kesinti 210" }),
    });
    const server = await startTestServer({ dataDir });
    try {
      const store = server.app.store;
      assert.equal(store.get("SELECT COUNT(*) AS n FROM cash_entries WHERE description = 'Kesinti 210'").n, 0, "satır yok");
      assert.equal(store.get("SELECT COUNT(*) AS n FROM fin_events").n, 0, "boşta olay yok");
      assert.equal(store.get("SELECT COUNT(*) AS n FROM audit_events WHERE type = 'cash.entry.created'").n, 0, "işlem geçmişi yok");
      assert.equal(counterOf(store), "", "İşlem No sayacı ilerlemedi");
      const client = server.client();
      await client.login("admin", ADMIN_PASSWORD);
      const again = await client.post("/api/workspace/cash", { kind: "in", amount: "640", date: TODAY, description: "Kesinti 210" });
      assert.equal(again.status, 200);
      const event = store.get("SELECT e.no FROM fin_events e JOIN cash_entries c ON c.event_id = e.id WHERE c.id = ?", again.data.data.id);
      assert.equal(event?.no, `BNK-${YEAR}-000001`, "kesintide numara harcanmadı");
      assert.equal(server.app.integrity.run().ok, true);
    } finally {
      await server.close();
    }
  });

  it("peşinli fatura (istek kimliğiyle): istek kaydı yazılırken kesinti → fatura, cari satırları, olay, istek kaydı yok; aynı kimlikle yeniden gönderim tek belge açar", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "destekofis-210-kesinti-"));
    roots.push(root);
    const requestId = "kesinti-210-fatura-0001";
    const bodyOf = prepared => ({ scenario: "service_sale", accountId: prepared.accountId, issueDate: TODAY, lines: [{ itemId: prepared.itemId, qty: 1, unitPrice: 900, vatRate: 0 }], payment: { cash: [{ amount: 300, method: "bank" }], rest: "open", dueDate: TODAY }, requestId });
    const { dataDir, prepared } = await crashDuring(root, {
      table: "request_keys",
      when: "1",
      prepare: async client => {
        const account = await client.post("/api/workspace/accounts", { name: "Kesinti Müşterisi", type: "customer", registeredOn: TODAY });
        const item = await client.post("/api/workspace/stock", { kind: "service", code: "KSN", name: "Kesinti Hizmeti", unit: "Adet", salePrice: "900" });
        return { accountId: account.data.data.id, itemId: item.data.data.id };
      },
      act: (client, prepared) => client.post("/api/workspace/invoices", bodyOf(prepared)),
    });
    const server = await startTestServer({ dataDir });
    try {
      const store = server.app.store;
      assert.equal(store.get("SELECT COUNT(*) AS n FROM invoices").n, 0, "fatura yok");
      assert.equal(store.get("SELECT COUNT(*) AS n FROM account_entries WHERE source = 'invoice'").n, 0, "cari satırı yok");
      assert.equal(store.get("SELECT COUNT(*) AS n FROM fin_events").n, 0, "olay yok");
      assert.equal(store.get("SELECT COUNT(*) AS n FROM request_keys").n, 0, "istek kaydı yok");
      assert.equal(store.get("SELECT COUNT(*) AS n FROM audit_events WHERE type LIKE 'invoice.%'").n, 0, "işlem geçmişi yok");
      assert.equal(counterOf(store), "", "sayaç ilerlemedi");
      const client = server.client();
      await client.login("admin", ADMIN_PASSWORD);
      const first = await client.post("/api/workspace/invoices", bodyOf(prepared));
      assert.equal(first.status, 200, JSON.stringify(first.data).slice(0, 300));
      const second = await client.post("/api/workspace/invoices", bodyOf(prepared));
      assert.equal(second.status, 200);
      assert.equal(second.data.data.replayed, true, "aynı kimlik ikinci belge açmaz");
      assert.equal(store.get("SELECT COUNT(*) AS n FROM invoices").n, 1);
      assert.equal(store.get("SELECT COUNT(*) AS n FROM fin_events WHERE type = 'invoice_cash' AND status = 'active'").n, 1, "peşinin tek olayı");
      assert.equal(server.app.integrity.run().ok, true);
    } finally {
      await server.close();
    }
  });
});
