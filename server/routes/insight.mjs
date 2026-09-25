// Akıllı veri motoru ve ofis profili uçları (v1.6.0): analiz (göstergeler, veri sağlığı, kolon türleri), sektör listesi,
// sektör seçimi ve kalemle düzenlenen başlıklar. Sektör ve başlık değişikliği yalnızca yöneticidedir (profile.manage);
// sektör önerisi ve kanıtları da yalnızca yöneticiye gösterilir.
import { ok, readJson, text } from "../lib/http.mjs";
import { can } from "../lib/permissions.mjs";
import { sectorById, sectorCatalog } from "../lib/insight/sectors.mjs";

const CATALOG = sectorCatalog();

const sectorSummary = sector =>
  sector ? { id: sector.id, name: sector.name, group: sector.group, groupName: sector.groupName, vocab: sector.vocab, modules: sector.modules } : null;

export function shapeAnalysis(analysis, { manage }) {
  const { sector, ...rest } = analysis;
  if (!manage) return rest;
  return {
    ...rest,
    sector: { ...sector, suggestionSector: sectorSummary(sectorById(sector.suggestion)), topSector: sectorSummary(sectorById(sector.top?.id)) },
  };
}

export function registerInsightRoutes(router, { auth, profile }) {
  router.get("/api/workspace/profile", async ({ req, res }) => {
    auth.requireUser(req);
    ok(res, profile.profile());
  });

  router.get("/api/workspace/sectors", async ({ req, res }) => {
    auth.requireUser(req);
    ok(res, CATALOG);
  });

  router.get("/api/workspace/insight", async ({ req, res }) => {
    const user = auth.requireUser(req);
    const analysis = await profile.analysis();
    ok(res, { analysis: shapeAnalysis(analysis, { manage: can(user.role, "profile.manage") }), profile: profile.profile() });
  });

  // Kart penceresi: yaklaşan/tarihi geçen, en yüksek tutarlı ve bu ayın kayıtları (seçili sekme için, tamamı sayılarak).
  router.get("/api/workspace/insight/records", async ({ req, res, url }) => {
    auth.requireUser(req);
    ok(res, await profile.records(text(url.searchParams.get("list")), text(url.searchParams.get("tab"))));
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

  router.delete("/api/workspace/labels", async ({ req, res }) => {
    const user = auth.requirePermission(req, "profile.manage");
    ok(res, profile.resetLabels(user));
  });
}
