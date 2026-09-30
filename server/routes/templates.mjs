// Sektöre uygun taslak Excel (v2.0.9): açılış ekranındaki "Excel'iniz yoksa sektörünüze uygun taslağı indirin".
// Liste: sektör grupları (ofisin kendi sektörleri dahil) ve ofisin şu anki sektörü; dosya: seçilen sektörün taslağı.
import { HttpError, limited, ok, sendBuffer } from "../lib/http.mjs";
import { sectorCatalog } from "../lib/insight/sectors.mjs";
import { sectorTemplate, templateSheet } from "../lib/insight/templates.mjs";
import { buildXlsx } from "../lib/xlsx-write.mjs";


export function registerTemplateRoutes(router, { auth, audit, profile, now: clock = () => new Date() }) {
  const custom = id => (profile?.customSectors?.get ? profile.customSectors.get(id) : null);
  router.get("/api/workspace/templates", async ({ req, res }) => {
    auth.requireUser(req);
    const catalog = sectorCatalog();
    const own = profile?.customSectors?.all ? profile.customSectors.all() : [];
    const groups = own.length ? [...catalog.groups, { id: "ozel", name: "Kendi sektörleriniz", sectors: own.map(sector => ({ id: sector.id, name: sector.name, record: sector.vocab.records, expert: sector.vocab.expert, keys: sector.keys })) }] : catalog.groups;
    const current = profile?.profile ? profile.profile().sector : null;
    ok(res, { groups, current: current ? { id: current.id, name: current.name, source: current.source } : null });
  });
  router.get("/api/workspace/templates/:id/xlsx", async ({ req, res, params }) => {
    const user = auth.requireUser(req);
    const id = limited(params.id, 120, "Sektör");
    const own = custom(id);
    const template = sectorTemplate(id, { now: clock(), custom: own || null });
    if (!template) throw new HttpError(404, "Sektör bulunamadı.");
    const buffer = buildXlsx([templateSheet(template)], { title: `DestekOfis Taslak · ${template.sector.name}`, now: clock() });
    audit?.(user, "template.downloaded", template.sector.id, { name: template.sector.name, columns: template.columns.length });
    sendBuffer(res, buffer, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", name: template.fileName });
  });
}
