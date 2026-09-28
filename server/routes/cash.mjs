// Kasa (v2.0.1): ofisin tahsilat ve ödeme hareketleri ile güncel kasa durumu.
// Detay kartından girilen tahsilatlar (payments) kasaya kendiliğinden tahsilat olarak düşer; kasaya ayrıca kayda
// bağlı olmayan tahsilat (ör. danışmanlık ücreti) ve ödeme (kira, fatura, masraf) elle girilir (cash_entries).
// Hareketler eskiden yeniye sıralanır; her satırda o ana kadarki kasa bakiyesi yazar.
import { cashPdf, cashPdfName, rangeLabel } from "../lib/cash-report.mjs";
import { HttpError, limited, ok, readJson, sendBuffer, text } from "../lib/http.mjs";
import { parseAmount, roundMoney } from "../lib/money.mjs";
import { can } from "../lib/permissions.mjs";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
// Kasa'nın kendi kaynakları (kayıt tahsilatları ve elle girilen hareketler); diğerleri modüllerin cashSource'u.
const PAYMENTS = { table: "payments p", where: "1 = 1", kind: "'in'", amount: "p.amount", date: "p.date" };
const MANUAL = { table: "cash_entries c", where: "1 = 1", kind: "c.kind", amount: "c.amount", date: "c.date" };
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
      `SELECT p.id, 'in' AS kind, 'payment' AS source, p.amount, p.date, p.note AS description, p.case_key AS caseKey, p.case_title AS caseTitle,
              p.created_by AS actorId, COALESCE(u.display_name, '') AS actorName, p.created_at AS createdAt, p.updated_at AS updatedAt
       FROM ${PAYMENTS.table} LEFT JOIN users u ON u.id = p.created_by${after ? ` WHERE ${PAYMENTS.date} > ?` : ""}`,
      ...(after ? [after] : []),
    );
    const manual = store.all(
      `SELECT c.id, c.kind, 'manual' AS source, c.amount, c.date, c.description, '' AS caseKey, '' AS caseTitle,
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
      .map(source => `SELECT ${source.kind} AS kind, CAST(ROUND(${source.amount} * 100) AS INTEGER) AS cents, ${source.date} AS date FROM ${source.table} WHERE ${source.where}`)
      .join(" UNION ALL ");
    const row = store.get(
      `SELECT COALESCE(SUM(CASE WHEN kind = 'in' THEN cents ELSE -cents END), 0) AS balance,
              COALESCE(SUM(CASE WHEN date <= ? THEN (CASE WHEN kind = 'in' THEN cents ELSE -cents END) END), 0) AS balanceToday,
              COALESCE(SUM(CASE WHEN date = ? AND kind = 'in' THEN cents END), 0) AS todayIn,
              COALESCE(SUM(CASE WHEN date = ? AND kind = 'out' THEN cents END), 0) AS todayOut,
              COALESCE(SUM(CASE WHEN date >= ? AND date <= ? AND kind = 'in' THEN cents END), 0) AS monthIn,
              COALESCE(SUM(CASE WHEN date >= ? AND date <= ? AND kind = 'out' THEN cents END), 0) AS monthOut,
              COUNT(CASE WHEN date > ? THEN 1 END) AS future,
              COUNT(*) AS count
       FROM (${union})`,
      day, day, day, monthStart, day, monthStart, day, day,
    );
    const tl = cents => roundMoney(Number(cents || 0) / 100);
    return { balance: tl(row.balance), balanceToday: tl(row.balanceToday), today: { in: tl(row.todayIn), out: tl(row.todayOut) }, month: { in: tl(row.monthIn), out: tl(row.monthOut) }, futureEntries: row.future, count: row.count };
  }
  // Tarihe kadarki kasa (dahil): nakit akış projeksiyonunun başlangıcı. Kasa ekranıyla aynı hareketlerden.
  const balanceAt = day => (day ? summary(day).balanceToday : summary("9999-12-31").balance);
  function report(user, from, to) {
    if ((from && !validDate(from)) || (to && !validDate(to))) throw new HttpError(400, "Geçerli bir tarih aralığı seçin.");
    if (from && to && from > to) throw new HttpError(400, "Başlangıç tarihi bitiş tarihinden sonra olamaz.");
    let balance = 0;
    let opening = 0;
    const period = { in: 0, out: 0 };
    const totals = { in: 0, out: 0 };
    const list = [];
    for (const entry of entries()) {
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
        entry.source === "plan" ? can(user.role, "plans.manage") || (own && can(user.role, "plans.collect"))
        : entry.source === "account" ? can(user.role, "accounts.manage") || (own && can(user.role, "accounts.collect"))
        : entry.source === "stock" ? can(user.role, "stock.manage")
        : entry.source === "cheque" ? false
        : can(user.role, "cash.manage") || (entry.source === "payment" && own && can(user.role, "payments.create"));
      list.push({ ...entry, balance, editable });
    }
    return {
      entries: list,
      opening: from ? opening : 0,
      period: { ...period, net: roundMoney(period.in - period.out) },
      totals: { ...totals, balance: roundMoney(totals.in - totals.out) },
      canManage: can(user.role, "cash.manage"),
    };
  }

  router.get("/api/workspace/cash", async ({ req, res, url }) => {
    const user = auth.requirePermission(req, "cash.view");
    ok(res, report(user, text(url.searchParams.get("from")), text(url.searchParams.get("to"))));
  });

  // Kasa dökümü PDF olarak (ör. 01.09.2026 – 25.09.2026 arası hareketler).
  router.get("/api/workspace/cash.pdf", async ({ req, res, url }) => {
    const user = auth.requirePermission(req, "cash.view");
    const from = text(url.searchParams.get("from"));
    const to = text(url.searchParams.get("to"));
    const data = report(user, from, to);
    const pdf = cashPdf(data, { from, to, officeName: store.setting("office.name", ""), userName: user.display_name || user.username || "" });
    audit(user, "cash.exported", rangeLabel(from, to), { from, to, count: data.entries.length });
    sendBuffer(res, pdf, { type: "application/pdf", name: cashPdfName(from, to), inline: url.searchParams.get("download") !== "1" });
  });

  const input = body => {
    const kind = text(body.kind);
    if (!["in", "out"].includes(kind)) throw new HttpError(400, "Hareket türü tahsilat ya da ödeme olmalı.");
    const amount = parseAmount(body.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1e12) throw new HttpError(400, "Geçerli bir tutar girin.");
    const date = text(body.date) || now().slice(0, 10);
    if (!validDate(date)) throw new HttpError(400, "Geçerli bir tarih girin.");
    const description = limited(body.description, 300, "Açıklama");
    if (!description) throw new HttpError(400, kind === "in" ? "Tahsilatın kimden/ne için alındığını yazın." : "Ödemenin kime/ne için yapıldığını yazın.");
    return { kind, amount: roundMoney(amount), date, description };
  };

  router.post("/api/workspace/cash", async ({ req, res }) => {
    const user = auth.requirePermission(req, "cash.manage");
    const entry = input(await readJson(req));
    const id = auth.newId("cash");
    store.run("INSERT INTO cash_entries (id, kind, amount, date, description, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", id, entry.kind, entry.amount, entry.date, entry.description, user.id, now());
    audit(user, "cash.entry.created", id, entry);
    changed(user);
    ok(res, { id });
  });

  const existing = id => {
    const entry = store.get("SELECT id, kind, amount, date, description FROM cash_entries WHERE id = ?", limited(id, 120, "Hareket"));
    if (!entry) throw new HttpError(404, "Kasa hareketi bulunamadı. Başka biri silmiş olabilir.");
    return entry;
  };

  router.put("/api/workspace/cash/:id", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "cash.manage");
    const previous = existing(params.id);
    const entry = input(await readJson(req));
    store.run("UPDATE cash_entries SET kind = ?, amount = ?, date = ?, description = ?, updated_by = ?, updated_at = ? WHERE id = ?", entry.kind, entry.amount, entry.date, entry.description, user.id, now(), previous.id);
    audit(user, "cash.entry.updated", previous.id, { previous, ...entry });
    changed(user);
    ok(res, { id: previous.id });
  });

  router.delete("/api/workspace/cash/:id", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "cash.manage");
    const previous = existing(params.id);
    const full = store.get("SELECT id, kind, amount, date, description, created_by AS createdBy, created_at AS createdAt FROM cash_entries WHERE id = ?", previous.id);
    store.run("DELETE FROM cash_entries WHERE id = ?", previous.id);
    // Silinenler (v2.0.2): yönetim panelinden geri yüklenebilir.
    trash?.add({ kind: "cash", ref: previous.id, title: full.description || "Kasa hareketi", payload: full, user });
    audit(user, "cash.entry.deleted", previous.id, previous);
    changed(user);
    ok(res, { id: previous.id });
  });

  // ANLIK DURUM (v2.0.7): Kasa ekranıyla aynı hesap (tek kaynak).
  return { entries, report, balanceAt, summary };
}
