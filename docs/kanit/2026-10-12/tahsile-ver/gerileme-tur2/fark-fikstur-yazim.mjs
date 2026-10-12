// Tur 2 gerileme — eski sürüm verisinde YAZIM (bağımsız doğrulayıcı; KOD DEĞİŞTİRMEZ). Fikstür (eski sürümün gerçek koduyla üretilmiş) iki ayrı
// klasöre açılır: v2.1.0'ın gerçek etiket koduyla ve bu dalın koduyla. Her şirketin eski çek/senetlerinde mevcut akışlar aynı sırayla koşulur:
// işlem görmüşü Geri Al, portföydekini nakit Tahsil → Geri Al → Ciro → Geri Al → Karşılıksız → Geri Al, verilende Ödendi → Geri Al, açıklama
// düzeltme; yeni çek al + havale tahsil + sil denemesi. Her yanıt (durum + gövde) ve sonda Mutabakat Testi, Ana Defter, Alt Hesap Mizanı,
// çek listesi, Yevmiye yazılır; kimlik ve zaman damgaları normalleştirilir. Karşılaştırma fark-karsilastir.mjs ile.
//   node fark-fikstur-yazim.mjs <fikstur-adi> <v2.1.0|guncel> <cikti.json>
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CURRENT, bootVersion } from "../../../../../test/guvenilirlik/surumler.mjs";
import { readFixture, unpackFixture } from "../../../../../test/guvenilirlik/fikstur.mjs";

const [name, version = CURRENT, out = "yazim.json"] = process.argv.slice(2);
const fixture = unpackFixture(name);
const today = readFixture(name).oncesi?.today || "2026-10-08";
const app = await bootVersion(version, { dataDir: fixture.dataDir, backupDir: fixture.backupDir, maxCompanies: 10, now: { time: `${today}T12:00:00+03:00`, fixed: true }, reportWorker: false });
const api = await app.login();
let registry = [{ id: "sirket-001" }];
try {
  registry = JSON.parse(readFileSync(path.join(fixture.dataDir, "sirketler.json"), "utf8")).companies || registry;
} catch {}
const result = {};
const CH = "/api/workspace/cheques";
for (const company of registry) {
  const select = await api.post("/api/companies/select", { id: company.id });
  const steps = [];
  const reads = {};
  result[company.id] = { select: select.status, steps, reads };
  if (select.status !== 200) continue;
  const call = async (label, method, url, body) => {
    const res = method === "GET" ? await api.get(url) : method === "PUT" ? await api.put(url, body) : method === "DELETE" ? await api.del(url, body) : await api.post(url, body);
    steps.push({ label, status: res.status, data: res.data });
    return res;
  };
  const accounts = (await api.get("/api/workspace/accounts")).data?.accounts || [];
  const cheques = ((await api.get(CH)).data?.cheques || []).slice().sort((a, b) => String(a.serialNo).localeCompare(String(b.serialNo)));
  for (const c of cheques) {
    const tag = c.serialNo || c.id;
    if (["collected", "endorsed", "bounced", "paid"].includes(c.status)) await call(`${tag} geri al`, "POST", `${CH}/${c.id}/undo`, {});
    const now = (await api.get(`${CH}/${c.id}`)).data;
    if (now?.status === "portfolio") {
      await call(`${tag} tahsil nakit`, "POST", `${CH}/${c.id}/actions`, { action: "collect", date: today, method: "cash" });
      await call(`${tag} geri al 1`, "POST", `${CH}/${c.id}/undo`, {});
      const other = accounts.find(a => a.id !== now.accountId && !a.deletedAt);
      if (other) {
        await call(`${tag} ciro`, "POST", `${CH}/${c.id}/actions`, { action: "endorse", date: today, accountId: other.id });
        await call(`${tag} geri al 2`, "POST", `${CH}/${c.id}/undo`, {});
      }
      await call(`${tag} karşılıksız`, "POST", `${CH}/${c.id}/actions`, { action: "bounce", date: today });
      await call(`${tag} geri al 3`, "POST", `${CH}/${c.id}/undo`, {});
    } else if (now?.status === "pending") {
      await call(`${tag} ödendi nakit`, "POST", `${CH}/${c.id}/actions`, { action: "pay", date: today, method: "cash", cashForce: true });
      await call(`${tag} geri al 1`, "POST", `${CH}/${c.id}/undo`, {});
    }
    const fresh = (await api.get(`${CH}/${c.id}`)).data;
    await call(`${tag} açıklama`, "PUT", `${CH}/${c.id}`, { note: `tur2 ${tag}`, updatedAt: fresh?.updatedAt });
  }
  const party = accounts[0];
  const created = await call("yeni çek al", "POST", CH, { direction: "in", instrument: "cheque", amount: "1.234,56", ...(party ? { accountId: party.id } : { drawer: "Elden" }), serialNo: "TUR2-1", issueDate: today, dueDate: today });
  if (created.status === 200) {
    await call("yeni çek havale tahsil", "POST", `${CH}/${created.data.id}/actions`, { action: "collect", date: today, method: "bank" });
    await call("yeni çek sil (409)", "DELETE", `${CH}/${created.data.id}`);
    await call("yeni çek geri al", "POST", `${CH}/${created.data.id}/undo`, {});
    await call("yeni çek sil", "DELETE", `${CH}/${created.data.id}`);
  }
  for (const [key, url] of [["cekListe", CH], ["anaDefter", "/api/workspace/ledger"], ["mutabakat", "/api/workspace/ledger/integrity"], ["cariler", "/api/workspace/accounts"], ["nakitAkis", "/api/workspace/overview/nakit-akisi"], ["vadeTakip", "/api/workspace/overview/vade-takip"], ["rapor:cek-hareketleri", "/api/workspace/report-center/cek-hareketleri?preset=all"], ["rapor:hesap-mizani", "/api/workspace/report-center/hesap-mizani?preset=all"], ["rapor:defter-mutabakati", "/api/workspace/report-center/defter-mutabakati?preset=all"]]) {
    const res = await api.get(url);
    reads[key] = { status: res.status, data: res.data };
  }
}
await api.post("/api/companies/select", { id: "sirket-001" });
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const SKIP = new Set(["createdAt", "updatedAt", "created_at", "updated_at", "generatedAt", "durationMs", "ms", "took", "elapsedMs", "statusDate"]);
const UID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
const norm = value => {
  if (Array.isArray(value)) return value.map(norm);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => !SKIP.has(key)).map(([key, item]) => [key, norm(item)]));
  if (typeof value === "string" && ISO.test(value)) return "<zaman>";
  if (typeof value === "string") return value.replace(UID, "<uuid>");
  return value;
};
writeFileSync(out, JSON.stringify({ version, commit: app.commit, fixture: name, today, steps: [], reads: norm(result) }, null, 1));
console.log(`${name} ${version}: ${registry.length} şirket → ${out}`);
await app.close();
fixture.cleanup();
