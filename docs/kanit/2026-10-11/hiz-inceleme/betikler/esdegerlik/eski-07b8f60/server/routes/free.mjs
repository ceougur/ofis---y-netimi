// Serbest sayfa uçları (v2.0.1). Hücre düzenleme herkes (records.edit); satır/kolon/sayfa ekleme records.create;
// dolu satır/kolon ve sayfa silme records.delete (yönetici, ikinci rol) — yanlışlıkla eklenen BOŞ satırı/kolonu ekleme
// yetkisi olan da siler. Her değişiklik diğer ekranlara canlı yansır.
import { matrixToFree } from "../lib/free-import.mjs";
import { HttpError, ok, readJson, text } from "../lib/http.mjs";

export function registerFreeRoutes(router, { auth, events, profile, dataset, free, readGoogleSheet = null }) {
  const changed = (user, sheetId, detail = {}) => {
    profile?.invalidate();
    events?.publish("workspace.changed", { kind: "records", actorId: user.id, actorName: user.display_name, datasetKey: dataset.currentKey(), free: sheetId, ...detail }, { except: user.id });
  };
  const idOf = params => text(params.id).slice(0, 80);
  const done = (res, user, result, detail) => {
    changed(user, result.id, detail);
    ok(res, result);
  };

  router.get("/api/workspace/free", async ({ req, res }) => {
    auth.requireUser(req);
    ok(res, { sheets: free.list() });
  });
  router.get("/api/workspace/free/:id", async ({ req, res, params }) => {
    auth.requireUser(req);
    ok(res, free.detail(idOf(params)));
  });
  router.post("/api/workspace/free", async ({ req, res }) => {
    const user = auth.requirePermission(req, "records.create");
    const body = await readJson(req);
    done(res, user, free.create(user, { name: body.name, columns: body.columns, rows: body.rows, names: Array.isArray(body.names) ? body.names : [] }), { created: true });
  });
  // Excel / Google Sheets'ten aktarma (v2.0.10): sayfa bir kopyadır; kaynakta sonradan yapılan değişiklik gelmez.
  // Excel dosyası tarayıcıda okunur (hof-excel-worker.js), seçilen sayfanın ham matrisi ve formülleri gönderilir.
  router.post("/api/workspace/free/import", async ({ req, res }) => {
    const user = auth.requirePermission(req, "records.create");
    const body = await readJson(req, { limit: 12_000_000 });
    const sheet = body.sheet || {};
    const parsed = matrixToFree({ matrix: sheet.matrix, start: sheet.start, formulas: sheet.formulas });
    done(res, user, free.importSheet(user, { name: body.name || sheet.name, ...parsed, source: `excel:${text(body.fileName).slice(0, 200)}` }), { created: true });
  });
  // Google Sheets: bağlantıdaki sekme (gid) okunur; bağlantıda sekme yoksa ilk sekme.
  router.post("/api/workspace/free/import-sheets", async ({ req, res }) => {
    const user = auth.requirePermission(req, "records.create");
    const body = await readJson(req);
    const url = text(body.url).slice(0, 2000);
    if (!/^https:\/\/docs\.google\.com\/spreadsheets\/d\//.test(url)) throw new HttpError(400, "Google Sheets bağlantısı tanınmadı. Tablonun adres çubuğundaki bağlantıyı (https://docs.google.com/spreadsheets/d/…) yapıştırın.");
    if (!readGoogleSheet?.readTab) throw new HttpError(503, "Google Sheets okuyucusu kullanılamıyor.");
    const tab = await readGoogleSheet.readTab(url);
    const parsed = matrixToFree({ matrix: tab.matrix, start: { r: 0, c: 0 }, formulas: tab.formulas });
    done(res, user, free.importSheet(user, { name: text(body.name) || tab.tab || tab.title, ...parsed, source: `sheets:${url}` }), { created: true });
  });
  router.patch("/api/workspace/free/:id", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "records.create");
    const body = await readJson(req);
    done(res, user, free.rename(user, idOf(params), body.name));
  });
  router.delete("/api/workspace/free/:id", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "records.delete");
    done(res, user, free.remove(user, idOf(params)), { removed: true });
  });
  router.post("/api/workspace/free/:id/restore", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "records.delete");
    done(res, user, free.restore(user, idOf(params)));
  });
  router.put("/api/workspace/free/:id/cells", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "records.edit");
    const body = await readJson(req, { limit: 4_000_000 });
    // Yapıştırmada satır/kolon eklemek ekleme yetkisi de ister.
    if (body.grow) auth.requirePermission(req, "records.create");
    done(res, user, free.setCells(user, idOf(params), body.cells, { grow: Boolean(body.grow) }));
  });
  router.put("/api/workspace/free/:id/columns/:col", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "records.edit");
    const body = await readJson(req);
    done(res, user, free.renameColumn(user, idOf(params), text(params.col), body.name));
  });
  router.post("/api/workspace/free/:id/columns", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "records.create");
    const body = await readJson(req);
    done(res, user, free.addColumns(user, idOf(params), { index: Number.isInteger(body.index) ? body.index : undefined, count: body.count, names: Array.isArray(body.names) ? body.names : [] }));
  });
  router.delete("/api/workspace/free/:id/columns/:col", async ({ req, res, params }) => {
    auth.requireUser(req);
    const user = auth.requirePermission(req, free.columnIsEmpty(idOf(params), text(params.col)) ? "records.create" : "records.delete");
    done(res, user, free.deleteColumn(user, idOf(params), text(params.col)));
  });
  router.post("/api/workspace/free/:id/rows", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "records.create");
    const body = await readJson(req);
    done(res, user, free.addRows(user, idOf(params), { index: Number.isInteger(body.index) ? body.index : undefined, count: body.count }));
  });
  router.delete("/api/workspace/free/:id/rows/:row", async ({ req, res, params }) => {
    auth.requireUser(req);
    const user = auth.requirePermission(req, free.rowIsEmpty(idOf(params), text(params.row)) ? "records.create" : "records.delete");
    done(res, user, free.deleteRow(user, idOf(params), text(params.row)));
  });
  router.post("/api/workspace/free/:id/fill", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "records.edit");
    const body = await readJson(req);
    done(res, user, free.fill(user, idOf(params), { row: text(body.row), col: text(body.col), axis: body.axis === "right" ? "right" : "down" }));
  });
  router.post("/api/workspace/free/:id/totals", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "records.create");
    const body = await readJson(req);
    const kind = text(body.kind);
    if (kind !== "row" && kind !== "column") throw new HttpError(400, "Toplam türü: row ya da column.");
    const span = Number.isInteger(body.from) && Number.isInteger(body.to) ? { from: body.from, to: body.to } : {};
    done(res, user, free.totals(user, idOf(params), kind, span));
  });
  router.post("/api/workspace/free/:id/undo", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "records.edit");
    const body = await readJson(req);
    done(res, user, free.undo(user, idOf(params), { snapshot: text(body.snapshot).slice(0, 40) }));
  });
}
