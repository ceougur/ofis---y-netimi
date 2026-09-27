// Akıllı veri motoru ve ofis profili uçları (v1.6.0): analiz (göstergeler, veri sağlığı, kolon türleri), sektör listesi,
// sektör seçimi ve kalemle düzenlenen başlıklar. Sektör ve başlık değişikliği yalnızca yöneticidedir (profile.manage);
// sektör önerisi ve kanıtları da yalnızca yöneticiye gösterilir.
import { ok, readJson, text } from "../lib/http.mjs";
import { columnOrder } from "../lib/sources.mjs";
import { can } from "../lib/permissions.mjs";
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

export function registerInsightRoutes(router, { auth, profile, dataset }) {
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
    const analysis = await profile.analysis();
    // Mantık denetiminin tam bulgu listesi sunucuda kalır; istemciye özet (kurallar, gruplar, işaretli kayıtlar) gider.
    const shaped = shapeAnalysis(analysis, { manage: can(user.role, "profile.manage"), find: profile.findSector });
    ok(res, { analysis: { ...shaped, reasoning: profile.reasoningSummary(analysis.reasoning) }, profile: profile.profile() });
  });

  // Kayda özel mantık denetimi (detay kartı): analizden gelen bulgular + canlı tahsilat denetimi.
  router.get("/api/workspace/cases/:key/checks", async ({ req, res, params, url }) => {
    auth.requireUser(req);
    const key = text(params.key).slice(0, 300);
    ok(res, await profile.checks(key, text(url.searchParams.get("tab")).slice(0, 300)));
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

  router.delete("/api/workspace/labels", async ({ req, res }) => {
    const user = auth.requirePermission(req, "profile.manage");
    ok(res, profile.resetLabels(user));
  });
}
