// Kalıcı çalışma verisi uçları: durum, içeri alma (önizleme + uygulama), eşitleme, bağlantı ve veri kaldırma.
// Veriyi yükleme, değiştirme ve kaldırma yalnızca yönetici yetkisindedir (sources.manage).
import { HttpError, ok, readJson, text } from "../lib/http.mjs";
import { can } from "../lib/permissions.mjs";

export function registerDatasetRoutes(router, { auth, dataset, clientState }) {
  router.get("/api/workspace/dataset", async ({ req, res }) => {
    const user = auth.requireUser(req);
    ok(res, dataset.summary({ detailed: can(user.role, "sources.manage") }));
  });

  // 1. adım: dosya/bağlantı okunur ve mevcut veriyle karşılaştırılır; hiçbir şey değişmez.
  router.post("/api/workspace/dataset/stage", async ({ req, res }) => {
    const user = auth.requirePermission(req, "sources.manage");
    const body = await readJson(req, { limit: 80_000_000 });
    ok(res, await dataset.stage(user, body));
  });

  // 2. adım: yöneticinin seçimiyle uygulanır ("merge" = devamı olarak ekle, "replace" = yerine koy).
  router.post("/api/workspace/dataset/commit", async ({ req, res }) => {
    const user = auth.requirePermission(req, "sources.manage");
    const body = await readJson(req);
    const result = dataset.commit(user, text(body.stageId), { mode: text(body.mode), link: body.link !== false });
    ok(res, { ...result, state: clientState.read() });
  });

  router.post("/api/workspace/dataset/sync", async ({ req, res }) => {
    const user = auth.requirePermission(req, "sources.manage");
    const result = await dataset.sync({ actor: user, manual: true });
    if (result.reason === "not-linked") throw new HttpError(400, "Bağlı bir Google Sheets yok.");
    ok(res, { ...result, summary: dataset.summary({ detailed: true }) });
  });

  router.post("/api/workspace/dataset/unlink", async ({ req, res }) => {
    const user = auth.requirePermission(req, "sources.manage");
    ok(res, dataset.unlink(user));
  });

  router.delete("/api/workspace/dataset", async ({ req, res }) => {
    const user = auth.requirePermission(req, "sources.manage");
    const result = dataset.remove(user);
    ok(res, { ...result, state: clientState.read() });
  });

  router.get("/api/workspace/dataset/missing", async ({ req, res }) => {
    auth.requirePermission(req, "sources.manage");
    ok(res, dataset.missingRows());
  });

  router.post("/api/workspace/dataset/missing", async ({ req, res }) => {
    const user = auth.requirePermission(req, "sources.manage");
    const body = await readJson(req, { limit: 20_000_000 });
    ok(res, dataset.resolveMissing(user, text(body.action), body.rowIds));
  });
}
