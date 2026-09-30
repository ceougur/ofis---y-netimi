// Akıllı veri motoru ve ofis profili uçları (v1.6.0): analiz (göstergeler, veri sağlığı, kolon türleri), sektör listesi,
// sektör seçimi ve kalemle düzenlenen başlıklar. Sektör ve başlık değişikliği yalnızca yöneticidedir (profile.manage);
// sektör önerisi ve kanıtları da yalnızca yöneticiye gösterilir.
import { analyzeColumns } from "../lib/insight/columns.mjs";
import { proposeFixes, summarizeFix } from "../lib/insight/fixes.mjs";
import { HttpError, ok, readJson, text } from "../lib/http.mjs";
import { columnOrder } from "../lib/sources.mjs";
import { canUser } from "../lib/permissions.mjs";
import { sectorById, sectorCatalog } from "../lib/insight/sectors.mjs";

const CATALOG = sectorCatalog();

const sectorSummary = sector =>
  sector ? { id: sector.id, name: sector.name, group: sector.group, groupName: sector.groupName, vocab: sector.vocab, modules: sector.modules } : null;

export function shapeAnalysis(analysis, { manage, find = sectorById }) {
  const { sector, ...rest } = analysis;
  if (!manage) return rest;
  return {
    ...rest,
    sector: { ...sector, suggestionSector: sectorSummary(find(sector.suggestion)), topSector: sectorSummary(find(sector.top?.id)) },
  };
}

export function registerInsightRoutes(router, { auth, profile, dataset, store, audit, events }) {
  // ---------- Veri Sağlık Kontrolü: toplu düzeltmeler (v2.0.2) ----------
  // Öneriler analizden üretilir ve oturum + parmak izi anahtarıyla sunucuda tutulur; istemciye yalnız özet gider.
  // Uygulama tek işlemde (transaction) düzeltme (override) yazar, tek denetim kaydı bırakır ve 15 dakika geri alınabilir.
  const proposals = new Map(); // oturum → { key, fixes }
  const batches = new Map(); // batchId → { userId, at, previous: [{key, field, value|null}] }
  const BATCH_TTL = 15 * 60_000;
  async function currentFixes() {
    const key = profile.fingerprint();
    const session = dataset.currentKey();
    const hit = proposals.get(session);
    if (hit && hit.key === key) return hit.fixes;
    const analysis = await profile.analysis();
    const view = await dataset.view();
    const rows = (view.rows || []).filter(row => !String(row.__hofKey || "").startsWith("free:"));
    const analyses = analyzeColumns(rows, columnOrder(rows), { now: new Date() });
    const fixes = proposeFixes({ rows, analyses: analyses.map(item => ({ ...item, warning: analysis.columns?.find(column => column.column === item.column)?.warning ?? item.warning })) });
    proposals.set(session, { key, fixes });
    if (proposals.size > 20) proposals.delete(proposals.keys().next().value);
    return fixes;
  }
  const changed = (user, detail = {}) => events?.publish("workspace.changed", { kind: "records", actorId: user.id, actorName: user.display_name, datasetKey: dataset.currentKey(), ...detail }, { except: user.id });

  router.get("/api/workspace/insight/fixes", async ({ req, res }) => {
    auth.requireUser(req);
    const fixes = await currentFixes();
    ok(res, { fixes: fixes.map(summarizeFix), total: fixes.reduce((sum, fix) => sum + fix.count, 0) });
  });

  router.post("/api/workspace/insight/fixes/apply", async ({ req, res }) => {
    const user = auth.requirePermission(req, "records.edit");
    const body = await readJson(req);
    const id = text(body.id);
    const fix = (await currentFixes()).find(item => item.id === id);
    if (!fix) throw new HttpError(409, "Bu öneri artık geçerli değil (veri değişmiş olabilir). Pencereyi kapatıp yeniden açın.");
    const source = dataset.currentKey();
    const stamp = new Date().toISOString();
    const previous = [];
    store.tx(() => {
      for (const change of fix.changes) {
        const old = store.get("SELECT id, value, version FROM overrides WHERE source_name = ? AND case_key = ? AND field = ?", source, change.key, change.field);
        previous.push({ key: change.key, field: change.field, value: old ? old.value : null });
        store.run(
          "INSERT INTO overrides (id, source_name, case_key, field, value, version, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(source_name, case_key, field) DO UPDATE SET value = excluded.value, version = excluded.version, updated_by = excluded.updated_by, updated_at = excluded.updated_at",
          old?.id || auth.newId("override"), source, change.key, change.field, change.value, (old?.version || 0) + 1, user.id, stamp,
        );
      }
    });
    const batchId = auth.newId("fixbatch");
    batches.set(batchId, { userId: user.id, at: Date.now(), previous, source });
    for (const [key, item] of batches) if (Date.now() - item.at > BATCH_TTL) batches.delete(key);
    proposals.delete(source);
    profile.invalidate?.();
    audit(user, "source.cells.bulk_fixed", batchId, { sourceName: source, fix: fix.id, column: fix.column, kind: fix.kind, count: fix.changes.length, samples: fix.samples });
    changed(user, { bulk: fix.id });
    ok(res, { batchId, count: fix.changes.length, column: fix.column });
  });

  router.post("/api/workspace/insight/fixes/undo", async ({ req, res }) => {
    const user = auth.requirePermission(req, "records.edit");
    const body = await readJson(req);
    const batch = batches.get(text(body.batchId));
    if (!batch) throw new HttpError(410, "Geri alma süresi doldu ya da bu düzeltme bulunamadı.");
    const stamp = new Date().toISOString();
    store.tx(() => {
      for (const item of batch.previous) {
        if (item.value === null) store.run("DELETE FROM overrides WHERE source_name = ? AND case_key = ? AND field = ?", batch.source, item.key, item.field);
        else store.run("UPDATE overrides SET value = ?, version = version + 1, updated_by = ?, updated_at = ? WHERE source_name = ? AND case_key = ? AND field = ?", item.value, user.id, stamp, batch.source, item.key, item.field);
      }
    });
    batches.delete(text(body.batchId));
    proposals.delete(batch.source);
    profile.invalidate?.();
    audit(user, "source.cells.bulk_fix_undone", text(body.batchId), { sourceName: batch.source, count: batch.previous.length });
    changed(user, { bulkUndo: true });
    ok(res, { count: batch.previous.length });
  });

  router.get("/api/workspace/profile", async ({ req, res }) => {
    auth.requireUser(req);
    ok(res, profile.profile());
  });

  // Kendi sektörleriniz (v2.0.2) listenin başında.
  router.get("/api/workspace/sectors", async ({ req, res }) => {
    auth.requireUser(req);
    const own = profile.customSectors.catalogGroup();
    ok(res, own ? { groups: [own, ...CATALOG.groups] } : CATALOG);
  });

  router.post("/api/workspace/sectors/custom", async ({ req, res }) => {
    const user = auth.requirePermission(req, "profile.manage");
    const sector = profile.customSectors.create(user, await readJson(req));
    ok(res, { sector: sectorSummary(sector) });
  });
  router.put("/api/workspace/sectors/custom/:id", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "profile.manage");
    const sector = profile.customSectors.update(user, text(params.id), await readJson(req));
    ok(res, { sector: sectorSummary(sector), profile: profile.profile() });
  });
  router.delete("/api/workspace/sectors/custom/:id", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "profile.manage");
    profile.customSectors.remove(user, text(params.id));
    ok(res, { profile: profile.profile() });
  });

  router.get("/api/workspace/insight", async ({ req, res }) => {
    const user = auth.requireUser(req);
    // Veri Sağlığı yok saymaları (v2.0.11) puana ve bulgulara uygulanır; bulguların tam kayıt listesi sunucuda kalır.
    const analysis = profile.withQualityIgnores ? profile.withQualityIgnores(await profile.analysis()) : await profile.analysis();
    // Mantık denetiminin tam bulgu listesi sunucuda kalır; istemciye özet (kurallar, gruplar, işaretli kayıtlar) gider.
    const shaped = shapeAnalysis(analysis, { manage: canUser(user, "profile.manage"), find: profile.findSector });
    ok(res, { analysis: { ...shaped, reasoning: profile.reasoningSummary(analysis.reasoning) }, profile: profile.profile() });
  });

  // Kayda özel mantık denetimi (detay kartı): analizden gelen bulgular + canlı tahsilat denetimi.
  router.get("/api/workspace/cases/:key/checks", async ({ req, res, params, url }) => {
    auth.requireUser(req);
    const key = text(params.key).slice(0, 300);
    ok(res, await profile.checks(key, text(url.searchParams.get("tab")).slice(0, 300)));
  });

  // Veri Sağlığı "Yok say" (v2.0.11): veri yükleme yetkisi olan (yönetici) bulguyu ya da tek kaydı yok sayar; Geri Al.
  router.post("/api/workspace/insight/quality/ignore", async ({ req, res }) => {
    const user = auth.requirePermission(req, "sources.manage");
    const body = await readJson(req);
    ok(res, await profile.ignoreQuality(user, { tab: text(body.tab).slice(0, 300), id: text(body.id).slice(0, 400), key: text(body.key).slice(0, 400) }));
  });
  router.post("/api/workspace/insight/quality/restore", async ({ req, res }) => {
    const user = auth.requirePermission(req, "sources.manage");
    const body = await readJson(req);
    ok(res, profile.restoreQuality(user, text(body.signature).slice(0, 800)));
  });

  router.post("/api/workspace/insight/dismiss", async ({ req, res }) => {
    const user = auth.requirePermission(req, "records.edit");
    const body = await readJson(req);
    ok(res, profile.dismiss(user, text(body.signature)));
  });

  // Kart penceresi: yaklaşan/tarihi geçen, en yüksek tutarlı, bu ayın ve bir seçeneğin (durum, tür, sorumlu) kayıtları;
  // kartın sekmesi için, kartla aynı kuralla ve tamamı sayılarak.
  router.get("/api/workspace/insight/records", async ({ req, res, url }) => {
    auth.requireUser(req);
    const limit = Math.max(1, Math.min(500, Math.floor(Number(url.searchParams.get("limit")) || 500)));
    const param = name => text(url.searchParams.get(name));
    ok(res, await profile.records(param("list"), param("tab"), limit, { card: param("card"), value: param("value") }));
  });

  router.post("/api/workspace/insight/sector", async ({ req, res }) => {
    const user = auth.requirePermission(req, "profile.manage");
    const body = await readJson(req);
    ok(res, profile.setSector(user, text(body.sectorId), text(body.source)));
  });

  router.post("/api/workspace/insight/intro", async ({ req, res }) => {
    const user = auth.requirePermission(req, "profile.manage");
    ok(res, profile.dismissIntro(user));
  });

  router.put("/api/workspace/labels", async ({ req, res }) => {
    const user = auth.requirePermission(req, "profile.manage");
    const body = await readJson(req);
    ok(res, profile.setLabel(user, text(body.key), text(body.value)));
  });

  router.put("/api/workspace/labels/batch", async ({ req, res }) => {
    const user = auth.requirePermission(req, "profile.manage");
    const body = await readJson(req);
    ok(res, profile.setLabels(user, body.labels));
  });

  // Kolonların görünen adları (v2.0.1): veride olmayan kolon adı kabul edilmez.
  router.put("/api/workspace/columns", async ({ req, res }) => {
    const user = auth.requirePermission(req, "profile.manage");
    const body = await readJson(req);
    const view = await dataset.view();
    ok(res, profile.setColumns(user, body.columns, columnOrder(view.rows || [])));
  });

  // Güncellemede asıl adına döndürülen tarih adları bildirimi okundu (v2.0.6).
  router.delete("/api/workspace/columns/fixed", async ({ req, res }) => {
    const user = auth.requirePermission(req, "profile.manage");
    ok(res, profile.clearColumnsFixed(user));
  });

  router.delete("/api/workspace/labels", async ({ req, res }) => {
    const user = auth.requirePermission(req, "profile.manage");
    ok(res, profile.resetLabels(user));
  });
}
