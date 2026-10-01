// Kasa (v2.0.1): ofisin tahsilat ve ödeme hareketleri ile güncel kasa durumu.
// Detay kartından girilen tahsilatlar (payments) kasaya kendiliğinden tahsilat olarak düşer; kasaya ayrıca kayda
// bağlı olmayan tahsilat (ör. danışmanlık ücreti) ve ödeme (kira, fatura, masraf) elle girilir (cash_entries).
// Hareketler eskiden yeniye sıralanır; her satırda o ana kadarki kasa bakiyesi yazar.
import { cashPdf, cashPdfName, rangeLabel } from "../lib/cash-report.mjs";
import { HttpError, limited, ok, readJson, sendBuffer, text } from "../lib/http.mjs";
import { parseAmount, roundMoney } from "../lib/money.mjs";
import { canUser } from "../lib/permissions.mjs";
import { METHODS, NEGATIVE_KEY, NEGATIVE_POLICIES, methodOf, readNegativePolicy } from "../lib/pay-method.mjs";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
// Kasa'nın kendi kaynakları (kayıt tahsilatları ve elle girilen hareketler); diğerleri modüllerin cashSource'u.
const PAYMENTS = { table: "payments p", where: "1 = 1", kind: "'in'", amount: "p.amount", date: "p.date", method: "p.method" };
const MANUAL = { table: "cash_entries c", where: "1 = 1", kind: "c.kind", amount: "c.amount", date: "c.date", method: "c.method" };
const validDate = value => DATE.test(value) && !Number.isNaN(new Date(value).getTime());

export function registerCashRoutes(router, context) {
  const { store, auth, audit, events, trash } = context;
  const now = () => new Date().toISOString();
  const changed = user => events?.publish("workspace.changed", { kind: "cash", actorId: user.id, actorName: user.display_name }, { except: user.id });

  // after: yalnız bu tarihten SONRAKİ hareketler (nakit akışı için ileri tarihli Kasa kayıtları).
  function entries({ after = "" } = {}) {
    // Taksit kartlarının hareketleri (v2.0.4): kasaya tahsilat/ödeme olarak düşer; düzeltme kartın kendisinden yapılır.
    const plans = context.plans?.cashEntries ? context.plans.cashEntries(after) : [];
    // Cari tahsilat/ödemeleri ve Kasa'dan ödenen/Kasa'ya tahsil edilen stok hareketleri (v2.0.6).
    const accounts = context.accounts?.cashEntries ? context.accounts.cashEntries(after) : [];
    const stock = context.stock?.cashEntries ? context.stock.cashEntries(after) : [];
    // Çek/senet (v2.0.7): alınan evrak tahsil edilince giriş, verilen evrak ödenince çıkış. Alınca/verilince Kasa değişmez.
    const cheques = context.cheques?.cashEntries ? context.cheques.cashEntries(after) : [];
    const payments = store.all(
      `SELECT p.id, 'in' AS kind, 'payment' AS source, p.method, p.amount, p.date, p.note AS description, p.case_key AS caseKey, p.case_title AS caseTitle,
              p.created_by AS actorId, COALESCE(u.display_name, '') AS actorName, p.created_at AS createdAt, p.updated_at AS updatedAt
       FROM ${PAYMENTS.table} LEFT JOIN users u ON u.id = p.created_by${after ? ` WHERE ${PAYMENTS.date} > ?` : ""}`,
      ...(after ? [after] : []),
    );
    const manual = store.all(
      `SELECT c.id, c.kind, 'manual' AS source, c.method, c.amount, c.date, c.description, '' AS caseKey, '' AS caseTitle,
              c.created_by AS actorId, COALESCE(u.display_name, '') AS actorName, c.created_at AS createdAt, c.updated_at AS updatedAt
       FROM ${MANUAL.table} LEFT JOIN users u ON u.id = c.created_by${after ? ` WHERE ${MANUAL.date} > ?` : ""}`,
      ...(after ? [after] : []),
    );
    // Tarih sırası; aynı gün içinde giriş sırası (yeni eklenen en altta).
    return [...payments, ...manual, ...plans, ...accounts, ...stock, ...cheques].sort((a, b) => (a.date === b.date ? (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0) : a.date < b.date ? -1 : 1));
  }

  // Kasa toplamları SQL'de, Kasa satırlarıyla aynı kaynak tanımlarından (tablo + koşul) hesaplanır; satırlar belleğe
  // alınmaz. Kuruş tamsayısıyla toplanır (kayan nokta birikimi yok). ANLIK DURUM ve nakit akışı başlangıcı buradan okur.
  function sources() {
    return [PAYMENTS, MANUAL, context.plans?.cashSource, context.accounts?.cashSource, context.stock?.cashSource, context.cheques?.cashSource].filter(Boolean);
  }
  function summary(day, monthStart = `${day.slice(0, 7)}-01`) {
    const union = sources()
      .map(source => `SELECT ${source.kind} AS kind, CAST(ROUND(${source.amount} * 100) AS INTEGER) AS cents, ${source.date} AS date, COALESCE(${source.method || "'cash'"}, 'cash') AS method FROM ${source.table} WHERE ${source.where}`)
      .join(" UNION ALL ");
    const row = store.get(
      `SELECT COALESCE(SUM(CASE WHEN kind = 'in' THEN cents ELSE -cents END), 0) AS balance,
              COALESCE(SUM(CASE WHEN date <= ? THEN (CASE WHEN kind = 'in' THEN cents ELSE -cents END) END), 0) AS balanceToday,
              COALESCE(SUM(CASE WHEN date = ? AND kind = 'in' THEN cents END), 0) AS todayIn,
              COALESCE(SUM(CASE WHEN date = ? AND kind = 'out' THEN cents END), 0) AS todayOut,
              COALESCE(SUM(CASE WHEN date >= ? AND date <= ? AND kind = 'in' THEN cents END), 0) AS monthIn,
              COALESCE(SUM(CASE WHEN date >= ? AND date <= ? AND kind = 'out' THEN cents END), 0) AS monthOut,
              COUNT(CASE WHEN date > ? THEN 1 END) AS future,
              COUNT(*) AS count,
              COALESCE(SUM(CASE WHEN method = 'cash' THEN (CASE WHEN kind = 'in' THEN cents ELSE -cents END) END), 0) AS cashAll,
              COALESCE(SUM(CASE WHEN method = 'bank' THEN (CASE WHEN kind = 'in' THEN cents ELSE -cents END) END), 0) AS bankAll,
              COALESCE(SUM(CASE WHEN method = 'card' THEN (CASE WHEN kind = 'in' THEN cents ELSE -cents END) END), 0) AS cardAll,
              COALESCE(SUM(CASE WHEN method = 'cash' AND date <= ? THEN (CASE WHEN kind = 'in' THEN cents ELSE -cents END) END), 0) AS cashToday,
              COALESCE(SUM(CASE WHEN method = 'bank' AND date <= ? THEN (CASE WHEN kind = 'in' THEN cents ELSE -cents END) END), 0) AS bankToday,
              COALESCE(SUM(CASE WHEN method = 'card' AND date <= ? THEN (CASE WHEN kind = 'in' THEN cents ELSE -cents END) END), 0) AS cardToday
       FROM (${union})`,
      day, day, day, monthStart, day, monthStart, day, day, day, day, day,
    );
    const tl = cents => roundMoney(Number(cents || 0) / 100);
    // v2.0.13: yola göre bakiyeler (Nakit Kasa, Banka, Kredi Kartı); toplam = üçünün toplamı.
    return { byMethod: { cash: tl(row.cashAll), bank: tl(row.bankAll), card: tl(row.cardAll) }, byMethodAt: { cash: tl(row.cashToday), bank: tl(row.bankToday), card: tl(row.cardToday) }, cashToday: tl(row.cashToday), balance: tl(row.balance), balanceToday: tl(row.balanceToday), today: { in: tl(row.todayIn), out: tl(row.todayOut) }, month: { in: tl(row.monthIn), out: tl(row.monthOut) }, futureEntries: row.future, count: row.count };
  }
  // Tarihe kadarki kasa (dahil): nakit akış projeksiyonunun başlangıcı. Kasa ekranıyla aynı hareketlerden.
  const balanceAt = day => (day ? summary(day).balanceToday : summary("9999-12-31").balance);
  // v2.0.13: eksi bakiye denetimi — Logo/Netsis'teki gibi yol başına ayar (Nakit Kasa, Banka, Kredi Kartı):
  // Kontrol Yok / Uyar / Engelle. Uyar: kullanıcı onaylarsa (force = cashForce) yazılır; Engelle: onayla da yazılmaz.
  // Bakiye: hareketin tarihindeki ve bugünden ileri tarihli hareketler dahil son bakiye; hangisi azsa o (ileri tarihli bir
  // ödeme zaten ayrılmışsa bugünkü çıkış onu açığa düşürmesin).
  const PLACE = { cash: "Nakit kasada", bank: "Banka hesabında (Havale / EFT)", card: "Kredi kartı (POS) hesabında" };
  const negativePolicy = () => readNegativePolicy(store.setting(NEGATIVE_KEY, ""));
  function setNegativePolicy(input) {
    const next = { ...negativePolicy() };
    for (const method of Object.keys(METHODS)) {
      if (input?.[method] === undefined) continue;
      if (!NEGATIVE_POLICIES.includes(input[method])) throw new HttpError(400, "Eksi bakiye denetimi Kontrol Yok, Uyar ya da Engelle olmalı.");
      next[method] = input[method];
    }
    store.setSetting(NEGATIVE_KEY, JSON.stringify(next));
    return next;
  }
  function guardOut(amount, day, force = false, method = "cash") {
    const key = methodOf(method);
    const policy = negativePolicy()[key];
    if (!(amount > 0) || policy === "off" || (policy === "warn" && force)) return;
    const balance = Math.min(summary(day || "9999-12-31").byMethodAt[key], summary("9999-12-31").byMethod[key] || 0);
    const after = roundMoney(balance - amount);
    if (after < -0.005) {
      const money = value => `${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} TL`;
      const base = `${PLACE[key]} ${money(balance)} var; ${money(amount)} çıkış bakiyeyi ${money(after)} eksiye düşürür.`;
      if (policy === "block") throw new HttpError(409, `${base} Bu hesapta eksi bakiyeye izin verilmiyor (Yönetim → Sistem → Eksi Bakiye Denetimi).`, { code: "cash-blocked", method: key, balance, after });
      throw new HttpError(409, base, { code: "cash-negative", method: key, balance, after });
    }
  }
  // Düzeltme ve silmede de: before/after { kind: "in"|"out" (Kasa'ya giriş/çıkış yönü), amount, method, date } ya da null
  // (yeni/silinen). Her yol ayrı: nakitten bankaya taşınan bir tahsilat nakit hesabını azaltır, o denetlenir.
  function guardChange(before, after, force = false) {
    for (const key of Object.keys(METHODS)) {
      const effect = entry => (entry && methodOf(entry.method) === key ? (entry.kind === "in" ? 1 : -1) * (Number(entry.amount) || 0) : 0);
      const delta = roundMoney(effect(after) - effect(before));
      if (delta < -0.005) guardOut(-delta, after?.date || before?.date || "", force, key);
    }
  }
  function report(user, from, to, method = "") {
    method = method && Object.hasOwn(METHODS, method) ? method : "";
    if ((from && !validDate(from)) || (to && !validDate(to))) throw new HttpError(400, "Geçerli bir tarih aralığı seçin.");
    if (from && to && from > to) throw new HttpError(400, "Başlangıç tarihi bitiş tarihinden sonra olamaz.");
    let balance = 0;
    let opening = 0;
    const period = { in: 0, out: 0 };
    const totals = { in: 0, out: 0 };
    const list = [];
    const byMethod = { cash: 0, bank: 0, card: 0 };
    for (const raw of entries()) {
      const entry = { ...raw, method: methodOf(raw.method) };
      byMethod[entry.method] = roundMoney(byMethod[entry.method] + (entry.kind === "in" ? entry.amount : -entry.amount));
      if (method && entry.method !== method) continue;
      const signed = entry.kind === "in" ? entry.amount : -entry.amount;
      balance = roundMoney(balance + signed);
      totals[entry.kind] = roundMoney(totals[entry.kind] + entry.amount);
      if (from && entry.date < from) {
        opening = balance;
        continue;
      }
      if (to && entry.date > to) continue;
      period[entry.kind] = roundMoney(period[entry.kind] + entry.amount);
      const own = entry.actorId === user.id;
      // Taksit, cari ve stok hareketleri kendi kartlarından düzeltilir (Kasa'da yalnız kart açılır).
      const editable =
        entry.source === "plan" ? canUser(user, "plans.manage") || (own && canUser(user, "plans.collect"))
        : entry.source === "account" ? canUser(user, "accounts.manage") || (own && canUser(user, "accounts.collect"))
        : entry.source === "stock" ? canUser(user, "stock.manage")
        : entry.source === "cheque" ? false
        : canUser(user, "cash.manage") || (entry.source === "payment" && own && canUser(user, "payments.create"));
      list.push({ ...entry, balance, editable });
    }
    return {
      entries: list,
      opening: from ? opening : 0,
      period: { ...period, net: roundMoney(period.in - period.out) },
      totals: { ...totals, balance: roundMoney(totals.in - totals.out) },
      byMethod,
      method,
      methods: METHODS,
      canManage: canUser(user, "cash.manage"),
    };
  }

  router.get("/api/workspace/cash", async ({ req, res, url }) => {
    const user = auth.requirePermission(req, "cash.view");
    ok(res, report(user, text(url.searchParams.get("from")), text(url.searchParams.get("to")), text(url.searchParams.get("method"))));
  });

  // Kasa dökümü PDF olarak (ör. 01.09.2026 – 25.09.2026 arası hareketler).
  router.get("/api/workspace/cash.pdf", async ({ req, res, url }) => {
    const user = auth.requirePermission(req, "cash.view");
    const from = text(url.searchParams.get("from"));
    const to = text(url.searchParams.get("to"));
    const data = report(user, from, to, text(url.searchParams.get("method")));
    const pdf = cashPdf(data, { from, to, officeName: store.setting("office.name", ""), userName: user.display_name || user.username || "" });
    audit(user, "cash.exported", rangeLabel(from, to), { from, to, count: data.entries.length });
    sendBuffer(res, pdf, { type: "application/pdf", name: cashPdfName(from, to), inline: url.searchParams.get("download") !== "1" });
  });

  const input = body => {
    const kind = text(body.kind);
    if (!["in", "out"].includes(kind)) throw new HttpError(400, "Hareket türü tahsilat ya da ödeme olmalı.");
    const amount = parseAmount(body.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1e12) throw new HttpError(400, "Geçerli bir tutar girin.");
    // v2.0.13: tarih boş/geçersiz olamaz, ileri tarihli ve kilitli döneme hareket girilemez (lib/period.mjs).
    const date = context.period ? context.period.movementDate(body) : text(body.date) || now().slice(0, 10);
    if (!validDate(date)) throw new HttpError(400, "Geçerli bir tarih girin.");
    const description = limited(body.description, 300, "Açıklama");
    if (!description) throw new HttpError(400, kind === "in" ? "Tahsilatın kimden/ne için alındığını yazın." : "Ödemenin kime/ne için yapıldığını yazın.");
    return { kind, amount: roundMoney(amount), date, description, method: methodOf(body.method) };
  };

  router.post("/api/workspace/cash", async ({ req, res }) => {
    const user = auth.requirePermission(req, "cash.manage");
    const body = await readJson(req);
    const entry = input(body);
    if (entry.kind === "out") guardOut(entry.amount, entry.date, body.cashForce === true, entry.method);
    const id = auth.newId("cash");
    store.run("INSERT INTO cash_entries (id, kind, amount, date, description, method, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", id, entry.kind, entry.amount, entry.date, entry.description, entry.method, user.id, now());
    audit(user, "cash.entry.created", id, entry);
    changed(user);
    ok(res, { id });
  });

  const existing = id => {
    const entry = store.get("SELECT id, kind, amount, date, description, method FROM cash_entries WHERE id = ?", limited(id, 120, "Hareket"));
    if (!entry) throw new HttpError(404, "Kasa hareketi bulunamadı. Başka biri silmiş olabilir.");
    return entry;
  };

  router.put("/api/workspace/cash/:id", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "cash.manage");
    const previous = existing(params.id);
    context.period?.assertOpen(previous.date, "Bu kasa hareketi");
    const body = await readJson(req);
    const entry = input(body);
    guardChange(previous, entry, body.cashForce === true);
    store.run("UPDATE cash_entries SET kind = ?, amount = ?, date = ?, description = ?, method = ?, updated_by = ?, updated_at = ? WHERE id = ?", entry.kind, entry.amount, entry.date, entry.description, entry.method, user.id, now(), previous.id);
    audit(user, "cash.entry.updated", previous.id, { previous, ...entry });
    changed(user);
    ok(res, { id: previous.id });
  });

  router.delete("/api/workspace/cash/:id", async ({ req, res, params, url }) => {
    const user = auth.requirePermission(req, "cash.manage");
    const previous = existing(params.id);
    context.period?.assertOpen(previous.date, "Bu kasa hareketi");
    guardChange(previous, null, url.searchParams.get("cashForce") === "1");
    const full = store.get("SELECT id, kind, amount, date, description, method, created_by AS createdBy, created_at AS createdAt FROM cash_entries WHERE id = ?", previous.id);
    store.run("DELETE FROM cash_entries WHERE id = ?", previous.id);
    // Silinenler (v2.0.2): yönetim panelinden geri yüklenebilir.
    trash?.add({ kind: "cash", ref: previous.id, title: full.description || "Kasa hareketi", payload: full, user });
    audit(user, "cash.entry.deleted", previous.id, previous);
    changed(user);
    ok(res, { id: previous.id });
  });

  // Eksi bakiye denetimi ayarı (yalnız yönetici: Yönetim → Sistem).
  router.get("/api/admin/negative-policy", async ({ req, res }) => {
    auth.requirePermission(req, "system.manage");
    ok(res, negativePolicy());
  });
  router.put("/api/admin/negative-policy", async ({ req, res }) => {
    const user = auth.requirePermission(req, "system.manage");
    const body = await readJson(req);
    const previous = negativePolicy();
    const next = setNegativePolicy(body);
    audit(user, "cash.negative-policy", "cash", { previous, next });
    ok(res, next);
  });

  // ANLIK DURUM (v2.0.7): Kasa ekranıyla aynı hesap (tek kaynak).
  return { entries, report, balanceAt, summary, guardOut, guardChange, negativePolicy };
}
