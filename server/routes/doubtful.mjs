// Şüpheli Ticari Alacaklar rotaları (2.3.0 İz 1; docs/BANKA-MODULU-PLAN.md §3.11b; çekirdek lib/bank/doubtful.mjs).
//   POST   /api/workspace/accounts/:id/doubtful                          Şüpheli Alacağa Al { amount, date, reason, note, chequeId?, requestId? }
//   POST   /api/workspace/accounts/:id/doubtful/:did/release             Şüpheliden Çıkar { date, note }
//   POST   /api/workspace/accounts/:id/doubtful/:did/provision           Karşılık Ayır { amount, date, note }
//   POST   /api/workspace/accounts/:id/doubtful/:did/write-off           Değersiz Alacak Yaz { amount, date, note }
//   DELETE /api/workspace/accounts/:id/doubtful/:did                     Sil (kayıt hatası; Silinenler'e)
//   DELETE /api/workspace/accounts/:id/doubtful/:did/provisions/:pid      Karşılığı sil
//   DELETE /api/workspace/accounts/:id/doubtful/:did/write-offs/:entryId  Değersiz Alacak satırını sil
//   GET    /api/workspace/accounts/:id/doubtful                          carinin kayıtları + özet (Carileri Görme)
//   GET    /api/workspace/doubtful?from=&to=&status=open|closed|all      rapor verisi (Finans raporları)
// Yetki (plan §3.11b/4 "cari yönetimi + muhasebe"): yazımlar Cari Yönetimi (accounts.manage) + Şüpheli Alacak İşlemleri (accounts.doubtful).
// Bütün yazımlar bank.post içinde (istek kimliği, işlem geçmişi, dokunulan olaylar; para satırı yok). Değersiz Alacak satırı cari kartına yazılır.
import { createDoubtful } from "../lib/bank/doubtful.mjs";
import { bankForm } from "../lib/bank/module-ref.mjs";
import { HttpError, ok, readJson, text } from "../lib/http.mjs";
import { canUser } from "../lib/permissions.mjs";
import { isIsoDate } from "../lib/period.mjs";

export function registerDoubtfulRoutes(router, { store, bank, auth, audit, events, period, now, trash, accounts = () => null, bankModule = () => null }) {
  const doubtful = createDoubtful({ store, bank, period, now, accounts, trash });
  const banking = bankForm(bankModule);
  const ACC = "/api/workspace/accounts/:id/doubtful";
  const requireWriter = req => {
    const user = auth.requirePermission(req, "accounts.manage");
    if (!canUser(user, "accounts.doubtful")) throw new HttpError(403, "Şüpheli alacak işlemleri için “Şüpheli Alacak İşlemleri” yetkisi gerekir (yönetici ve muhasebe).", { code: "doubtful-permission", permission: "accounts.doubtful" });
    return user;
  };
  const changed = (user, accountId) => events?.publish?.("workspace.changed", { kind: "accounts", actorId: user.id, actorName: user.display_name, accountId, doubtful: true }, { except: user.id });
  const reply = (res, user, accountId, result, replayedId = "") => {
    if (result?.replayed) {
      const list = doubtful.listFor(accountId);
      return ok(res, { record: list.records.find(item => item.id === replayedId) || null, summary: list.summary, replayed: true });
    }
    changed(user, accountId);
    return ok(res, { ...result, summary: doubtful.summary(accountId) });
  };

  router.get(ACC, async ({ req, res, params }) => {
    auth.requirePermission(req, "accounts.view");
    if (!store.get("SELECT 1 AS found FROM accounts WHERE id = ? AND deleted_at IS NULL", text(params.id).slice(0, 120))) throw new HttpError(404, "Cari bulunamadı. Silinmiş olabilir.");
    ok(res, doubtful.listFor(params.id));
  });
  router.get("/api/workspace/doubtful", async ({ req, res, url }) => {
    auth.requirePermission(req, "overview.view");
    const from = text(url.searchParams.get("from"));
    const to = text(url.searchParams.get("to"));
    if ((from && !isIsoDate(from)) || (to && !isIsoDate(to))) throw new HttpError(400, "Geçerli bir tarih aralığı seçin.", { code: "date-invalid" });
    const status = ["open", "closed", "all"].includes(text(url.searchParams.get("status"))) ? text(url.searchParams.get("status")) : "open";
    ok(res, doubtful.report({ from, to, status }));
  });

  router.post(ACC, async ({ req, res, params }) => {
    const user = requireWriter(req);
    const body = await readJson(req);
    let result = null;
    const posted = bank.post({ user, module: "doubtful", op: "create", requestId: banking.requestId(req, body), scope: "doubtful.take", body: { ...body, accountId: params.id }, write: ctx => {
      const done = doubtful.take(ctx, { user, accountId: params.id, body });
      audit(user, "doubtful.take", done.record.id, { accountId: done.account.id, accountName: done.account.name, amountMinor: done.minor, date: done.date, reason: done.reason, note: done.note, chequeId: done.record.chequeId, eventNo: done.event.no });
      result = { record: done.record };
      return { id: done.record.id };
    } });
    reply(res, user, params.id, posted?.replayed ? posted : result, posted?.refId);
  });
  const action = (path, name, run) =>
    router.post(`${ACC}/:did/${path}`, async ({ req, res, params }) => {
      const user = requireWriter(req);
      const body = await readJson(req);
      let result = null;
      const posted = bank.post({ user, module: "doubtful", op: "create", requestId: banking.requestId(req, body), scope: `doubtful.${name}`, body: { ...body, accountId: params.id, recordId: params.did }, write: ctx => {
        const done = run(ctx, { user, accountId: params.id, did: params.did, body });
        audit(user, `doubtful.${name}`, params.did, { accountId: params.id, amountMinor: done.minor ?? done.releasedMinor ?? 0, date: done.date, note: done.note, eventNo: done.event?.no, provisionId: done.provisionId, entryId: done.entryId });
        result = { record: done.record };
        return { id: params.did };
      } });
      reply(res, user, params.id, posted?.replayed ? posted : result, params.did);
    });
  action("release", "release", (ctx, args) => doubtful.release(ctx, args));
  action("provision", "provision", (ctx, args) => doubtful.provision(ctx, args));
  action("write-off", "writeoff", (ctx, args) => doubtful.writeOff(ctx, args));

  router.delete(`${ACC}/:did`, async ({ req, res, params }) => {
    const user = requireWriter(req);
    const previous = doubtful.recordRow(params.did, { accountId: params.id });
    bank.post({ user, module: "doubtful", op: "delete", prev: { recordId: previous.id, amountMinor: previous.amountMinor, date: previous.date, status: previous.status }, write: ctx => {
      const done = doubtful.remove(ctx, { user, accountId: params.id, did: params.did });
      audit(user, "doubtful.deleted", params.did, { accountId: params.id, ...done.record });
      return { id: params.did };
    } });
    changed(user, params.id);
    ok(res, { id: params.did, ...doubtful.listFor(params.id) });
  });
  router.delete(`${ACC}/:did/provisions/:pid`, async ({ req, res, params }) => {
    const user = requireWriter(req);
    bank.post({ user, module: "doubtful", op: "delete", prev: { recordId: params.did, provisionId: params.pid }, write: ctx => {
      const done = doubtful.removeProvision(ctx, { user, accountId: params.id, did: params.did, pid: params.pid });
      audit(user, "doubtful.provision.deleted", params.pid, { accountId: params.id, ...done.provision });
      return { id: params.pid };
    } });
    changed(user, params.id);
    ok(res, { id: params.pid, ...doubtful.listFor(params.id) });
  });
  router.delete(`${ACC}/:did/write-offs/:entryId`, async ({ req, res, params }) => {
    const user = requireWriter(req);
    bank.post({ user, module: "doubtful", op: "delete", prev: { recordId: params.did, entryId: params.entryId }, write: ctx => {
      const done = doubtful.removeWriteOff(ctx, { user, accountId: params.id, did: params.did, entryId: params.entryId });
      audit(user, "doubtful.writeoff.deleted", params.entryId, { accountId: params.id, ...done.writeOff, entry: undefined });
      return { id: params.entryId };
    } });
    changed(user, params.id);
    ok(res, { id: params.entryId, ...doubtful.listFor(params.id) });
  });

  /** Silinenler'den geri yükleme (routes/trash.mjs): öğe (trash satırı) ve yükü; bank.post op 'restore' içinde. */
  function restoreDeleted(user, item, payload) {
    if (!canUser(user, "accounts.manage") || !canUser(user, "accounts.doubtful")) throw new HttpError(403, "Şüpheli alacak kaydını geri yüklemek için Cari Yönetimi ve Şüpheli Alacak İşlemleri yetkisi gerekir.", { code: "doubtful-permission", permission: "accounts.doubtful" });
    let done = null;
    bank.post({ user, module: "doubtful", op: "restore", prev: { trashId: item.id, ref: item.ref }, write: ctx => {
      done = doubtful.restore(ctx, { user, payload });
      trash.markRestored(item.id, user);
      audit(user, payload?.kind === "record" ? "doubtful.restored" : payload?.kind === "provision" ? "doubtful.provision.restored" : "doubtful.writeoff.restored", payload?.id || item.ref, { accountId: done.accountId, from: "trash" });
      return { id: done.id };
    } });
    changed(user, done.accountId);
    return done.message;
  }
  return { ...doubtful, restoreDeleted };
}
