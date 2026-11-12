// 2.5.0 Ç5-A tur 1 — KG-16 "Açılış Olabilir" listesi (docs/erp/C5-ACILIS-TASARIM.md §2.4; kural kitabı KG-16 = A; KULLANICI S47 = A, S51 = A; BAŞ MİMAR B6, B7, B8, K8-1, K8-2).
// Göçte (48) açıklaması "Açılış…" olan, açılış işaretsiz eski Borç / Alacak Yaz satırları listeye girer; onaya kadar defterde açılıştır (519), onaylanırsa açılış (M-02 / M-03),
// reddedilirse sıradan Borç / Alacak Yaz (602 / 770). Onay / ret satırın tutarını, tarihini, yönünü, açılış işaretini (is_opening) değiştirmez; kilit izine girmez → kilitli
// dönemdeki satırda da yapılabilir (K8-2; donmuş defter değişmez, fark "Kural Değişikliği Farkı" — Kural Farkı Düzeltme Fişi tur 2). EKRAN tur 2'de (Cariler → "Açılış Olabilir
// Kayıtlar" + zil); bu turda uçlar:
//   GET  /api/workspace/opening-review[?all=1]      → { items, counts }   (accounts.manage) — varsayılan yalnız onay bekleyenler; all=1 karar verilmişler de
//   POST /api/workspace/opening-review/:id           → { item, changed }   (accounts.manage) — gövde { decision: "confirm" | "reject" }
import { HttpError, ok, readJson, text } from "../lib/http.mjs";
import { createOpeningReview } from "../lib/ledger-opening.mjs";

export function registerOpeningReviewRoutes(router, { store, auth, audit = () => {}, events = null }) {
  const review = createOpeningReview({ store });
  router.get("/api/workspace/opening-review", async ({ req, res, url }) => {
    auth.requirePermission(req, "accounts.manage");
    ok(res, review.list({ all: text(url.searchParams.get("all")) === "1" }));
  });
  router.post("/api/workspace/opening-review/:id", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "accounts.manage");
    const body = (await readJson(req)) || {};
    const decision = text(body.decision);
    if (!["confirm", "reject"].includes(decision)) throw new HttpError(400, "Kararı seçin: Açılış (onayla) ya da Açılış Değil (reddet).", { code: "opening-review-decision" });
    const result = store.tx(() => review.decide(text(params.id).slice(0, 120), decision));
    if (result.status === 503) throw new HttpError(503, "Açılış Olabilir listesi hazır değil.");
    if (result.status === 404) throw new HttpError(404, "Bu kayıt Açılış Olabilir listesinde değil.", { code: "opening-review-missing" });
    if (result.changed) {
      audit(user, decision === "confirm" ? "account.opening.confirmed" : "account.opening.rejected", result.row.id, { accountId: result.row.accountId, previous: result.row.previous });
      events?.publish?.("workspace.changed", { kind: "accounts", actorId: user.id, actorName: user.display_name, accountId: result.row.accountId, ledger: true }, { except: user.id });
    }
    ok(res, { item: { id: result.row.id, accountId: result.row.accountId, review: result.row.review }, changed: result.changed });
  });
  return review;
}
