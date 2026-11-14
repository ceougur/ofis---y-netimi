// 2.5.0 Ç5-A tur 1 — KG-16 "Açılış Olabilir" listesi (docs/erp/C5-ACILIS-TASARIM.md §2.4; kural kitabı KG-16 = A; KULLANICI S47 = A, S51 = A; BAŞ MİMAR B6, B7, B8, K8-1, K8-2).
// Göçte (48) açıklaması "Açılış…" olan, açılış işaretsiz eski Borç / Alacak Yaz satırları listeye girer; onaya kadar defterde açılıştır (519), onaylanırsa açılış (M-02 / M-03),
// reddedilirse sıradan Borç / Alacak Yaz (602 / 770). Onay / ret satırın tutarını, tarihini, yönünü, açılış işaretini (is_opening) değiştirmez; kilit izine girmez → kilitli
// dönemdeki satırda da yapılabilir (K8-2; donmuş defter değişmez, fark "Kural Değişikliği Farkı" — Kural Farkı Düzeltme Fişi tur 2b). EKRAN tur 2c'de (Yönetim › Sistem › "Açılış
// Olabilir Kayıtlar" — client/assets/hof-acilis-olabilir.js — + zil; C5-ACILIS-TASARIM §17.10). Uçlar:
//   GET  /api/workspace/opening-review[?all=1][&limit=&offset=]  → { items, counts[, total] } (accounts.manage) — varsayılan yalnız onay bekleyenler; all=1 karar verilmişler de;
//                                                                   limit verilirse sayfa + toplam (tur 2c) ve dönem kilidi varsa satırda `locked`, sayılarda `lockedCandidate`
//                                                                   (limitsiz çağrı tur 1'in çıktısı AYNEN)
//   GET  /api/workspace/opening-review?counts=1                   → { counts } (accounts.manage) — zil (tur 2c)
//   POST /api/workspace/opening-review/:id                        → { item, changed } (accounts.manage) — gövde { decision: "confirm" | "reject" | "undo" } (undo: tur 2c, karar
//                                                                   geri alınır, satır yeniden onay bekler)
//   POST /api/workspace/opening-review                            → { items, changed } (accounts.manage) — toplu (tur 2c): { ids: [...], decision }; aynı işlemde, en çok 1.000;
//                                                                   listede olmayan kimlik varsa hiçbiri yazılmaz (404)
// YETKİ (2.5.0 Ç5-A tur 2e, dar kontrol c5a2 DÜŞÜK-4; BAŞ MİMAR KARARI 14.11 (c); C5-ACILIS-TASARIM §17.13): tarihi dönem kilidinin gününde ya da öncesinde olan (KİLİTLİ dönemdeki) satırın
// kararı ve geri alınması — tek ve toplu — yalnız dönem kilidini koyan yetkiyle (system.manage — yönetici); yoksa 403 opening-review-locked ve ileti yöneticiye kalan kayıtları sayar.
// Toplu kararda seçimde tek bir kilitli satır bile varsa İŞLEM BÜTÜN reddedilir (hiçbiri yazılmaz). Açık dönemdeki satır accounts.manage'da kalır; liste / sayı uçları değişmez. Karar
// anındaki kilide bakılır: kilit sonradan ilerleyip kararlı satırı kapsarsa geri alma da yöneticidedir.
import { HttpError, ok, readJson, text } from "../lib/http.mjs";
import { createOpeningReview } from "../lib/ledger-opening.mjs";
import { canUser } from "../lib/permissions.mjs";

const DECISIONS = ["confirm", "reject", "undo"];
const AUDIT = { confirm: "account.opening.confirmed", reject: "account.opening.rejected", undo: "account.opening.reopened" };
const MAX_BULK = 1000;
const MAX_PAGE = 500;
const LOCKED_PERMISSION = "system.manage";
const SHOWN_LOCKED = 5;
const dayText = iso => String(iso || "").split("-").reverse().join(".");
const moneyText = value => `${(Number(value) || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`;

export function registerOpeningReviewRoutes(router, { store, auth, audit = () => {}, events = null, period = null }) {
  const review = createOpeningReview({ store });
  const decisionOf = body => {
    const decision = text(body.decision);
    if (!DECISIONS.includes(decision)) throw new HttpError(400, "Kararı seçin: Açılış (onayla), Açılış Değil (reddet) ya da Karar Bekliyor'a Geri Al.", { code: "opening-review-decision" });
    return decision;
  };
  /** DÜŞÜK-4: kilitli dönemdeki satırın kararı yalnız yöneticide (yukarıdaki YETKİ). Listede olmayan kimlik burada sayılmaz (404 kararın kendisinde). */
  const assertLockedAllowed = (user, ids, { single = false } = {}) => {
    const locked = period?.lockedUntil?.() || "";
    if (!locked || canUser(user, LOCKED_PERMISSION)) return;
    const unique = [...new Set(ids)];
    let rows = [];
    try {
      rows = store.all(
        `SELECT e.id, e.date, e.amount, COALESCE(a.name, '') AS name FROM account_entries e LEFT JOIN accounts a ON a.id = e.account_id
         WHERE e.id IN (${unique.map(() => "?").join(", ")}) AND COALESCE(e.opening_review, '') <> '' AND e.date <= ? ORDER BY e.date, e.rowid`,
        ...unique, locked,
      );
    } catch {
      return; // liste hazır değil (sütun yok): karar ucu 503 döner
    }
    if (!rows.length) return;
    const span = `${dayText(locked)} ve öncesi`;
    const listed = rows.slice(0, SHOWN_LOCKED).map(row => `${dayText(row.date)} ${row.name} ${moneyText(row.amount)}`).join("; ");
    const more = rows.length > SHOWN_LOCKED ? ` ve ${rows.length - SHOWN_LOCKED} kayıt daha` : "";
    const message = single
      ? `Bu kayıt kilitli dönemde (${span}); kararı yalnız yönetici verebilir ya da geri alabilir.`
      : `Seçilen kayıtlardan ${rows.length} tanesi kilitli dönemde (${span}); kilitli dönemdeki kaydın kararını yalnız yönetici verebilir. Hiçbir karar kaydedilmedi. Yöneticiye kalan kayıtlar: ${listed}${more}.`;
    throw new HttpError(403, message, { code: "opening-review-locked", lockedUntil: locked, ids: rows.map(row => row.id) });
  };
  const changedRows = (user, decision, rows) => {
    const changed = rows.filter(row => row.changed);
    for (const row of changed) audit(user, AUDIT[decision], row.id, { accountId: row.accountId, previous: row.previous });
    if (changed.length) {
      events?.publish?.("workspace.changed", { kind: "accounts", actorId: user.id, actorName: user.display_name, accountId: changed.length === 1 ? changed[0].accountId : "", ledger: true }, { except: user.id });
    }
    return changed.length;
  };
  router.get("/api/workspace/opening-review", async ({ req, res, url }) => {
    auth.requirePermission(req, "accounts.manage");
    const locked = period?.lockedUntil?.() || "";
    if (text(url.searchParams.get("counts")) === "1") return ok(res, { counts: review.counts({ locked }) });
    const all = text(url.searchParams.get("all")) === "1";
    // Sayfasız çağrı tur 1'in çıktısını AYNEN verir (kilit bilgisi yalnız sayfalı listede ve sayılarda).
    if (!url.searchParams.has("limit")) return ok(res, review.list({ all }));
    const limit = Number(text(url.searchParams.get("limit")));
    const offset = Number(text(url.searchParams.get("offset")) || "0");
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE || !Number.isInteger(offset) || offset < 0) {
      throw new HttpError(400, `Sayfa büyüklüğü 1 ile ${MAX_PAGE} arasında, başlangıç sıfır ya da büyük bir tamsayı olmalı.`, { code: "opening-review-page" });
    }
    ok(res, review.list({ all, limit, offset, locked }));
  });
  router.post("/api/workspace/opening-review", async ({ req, res }) => {
    const user = auth.requirePermission(req, "accounts.manage");
    const body = (await readJson(req)) || {};
    const decision = decisionOf(body);
    const ids = Array.isArray(body.ids) ? body.ids.map(id => text(id).slice(0, 120)).filter(Boolean) : [];
    if (!ids.length) throw new HttpError(400, "Karar verilecek kayıtları seçin.", { code: "opening-review-ids" });
    if (ids.length > MAX_BULK) throw new HttpError(400, `Toplu kararda en çok ${MAX_BULK} kayıt seçilebilir.`, { code: "opening-review-ids" });
    assertLockedAllowed(user, ids);
    const result = store.tx(() => {
      const out = review.decideMany(ids, decision);
      // Listede olmayan kimlik: işlem geri alınır (yarım toplu karar yazılmaz).
      if (out.status === 404) throw new HttpError(404, "Seçilen kayıtlardan biri Açılış Olabilir listesinde değil; hiçbir karar kaydedilmedi. Listeyi yenileyin.", { code: "opening-review-missing", id: out.missing });
      return out;
    });
    if (result.status === 503) throw new HttpError(503, "Açılış Olabilir listesi hazır değil.");
    const changed = changedRows(user, decision, result.rows);
    ok(res, { items: result.rows.map(row => ({ id: row.id, accountId: row.accountId, review: row.review, previous: row.previous ?? row.review })), changed });
  });
  router.post("/api/workspace/opening-review/:id", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "accounts.manage");
    const body = (await readJson(req)) || {};
    const decision = decisionOf(body);
    const id = text(params.id).slice(0, 120);
    assertLockedAllowed(user, [id], { single: true });
    const result = store.tx(() => review.decide(id, decision));
    if (result.status === 503) throw new HttpError(503, "Açılış Olabilir listesi hazır değil.");
    if (result.status === 404) throw new HttpError(404, "Bu kayıt Açılış Olabilir listesinde değil.", { code: "opening-review-missing" });
    if (result.changed) changedRows(user, decision, [{ ...result.row, changed: true }]);
    ok(res, { item: { id: result.row.id, accountId: result.row.accountId, review: result.row.review, previous: result.row.previous ?? result.row.review }, changed: result.changed });
  });
  return review;
}
