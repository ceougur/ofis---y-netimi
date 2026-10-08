// Kasa (v2.0.1): ofisin tahsilat ve ödeme hareketleri ile güncel kasa durumu.
// Detay kartından girilen tahsilatlar (payments) kasaya kendiliğinden tahsilat olarak düşer; kasaya ayrıca kayda
// bağlı olmayan tahsilat (ör. danışmanlık ücreti) ve ödeme (kira, fatura, masraf) elle girilir (cash_entries).
// Hareketler eskiden yeniye sıralanır; her satırda o ana kadarki kasa bakiyesi yazar.
// v2.0.17 (müşteri): Kasa penceresi YALNIZ NAKİT akışını gösterir; elle girişte yol seçilmez (nakit). Havale/EFT, POS ve
// kredi kartı hareketleri cari, fatura, taksit, stok ve çek ekranlarından gelir ve Raporlar → Banka ve POS Hareketleri'nde
// görünür. Kasa ile banka arasındaki para geçişi "transfer"dir: tek işlemde iki bağlı hareket (nakit tarafı + banka tarafı).
import { cashPdf, cashPdfName, rangeLabel } from "../lib/cash-report.mjs";
import { HttpError, limited, ok, readJson, sendBuffer, text } from "../lib/http.mjs";
import { parseAmount, roundMoney } from "../lib/money.mjs";
import { canUser } from "../lib/permissions.mjs";
import { METHODS, NEGATIVE_GUARDED, NEGATIVE_KEY, NEGATIVE_POLICIES, methodFilter, methodOf, readNegativePolicy, methodInput } from "../lib/pay-method.mjs";
import { systemClock } from "../lib/clock.mjs";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
// Kasa'nın kendi kaynakları (kayıt tahsilatları ve elle girilen hareketler); diğerleri modüllerin cashSource'u.
const PAYMENTS = { table: "payments p", where: "1 = 1", kind: "'in'", amount: "p.amount", date: "p.date", method: "p.method" };
const MANUAL = { table: "cash_entries c", where: "1 = 1", kind: "c.kind", amount: "c.amount", date: "c.date", method: "c.method" };
const validDate = value => DATE.test(value) && !Number.isNaN(new Date(value).getTime());

export function registerCashRoutes(router, context) {
  const { store, auth, audit, events, trash, bank } = context;
  // İş saati (v2.1.0): context.now (config.now).
  const clock = context.now || systemClock;
  const now = () => clock().toISOString();
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
    // Fatura (v2.0.15): kesilirken peşin alınan/ödenen tutar (nakit, banka, kredi kartı). Düzeltme faturadan (iptal/iade).
    const invoices = context.invoices?.cashEntries ? context.invoices.cashEntries(after) : [];
    const payments = store.all(
      `SELECT p.id, 'in' AS kind, 'payment' AS source, p.method, p.amount, p.date, p.note AS description, p.case_key AS caseKey, p.case_title AS caseTitle,
              p.created_by AS actorId, COALESCE(u.display_name, '') AS actorName, p.created_at AS createdAt, p.updated_at AS updatedAt
       FROM ${PAYMENTS.table} LEFT JOIN users u ON u.id = p.created_by${after ? ` WHERE ${PAYMENTS.date} > ?` : ""}`,
      ...(after ? [after] : []),
    );
    const manual = store.all(
      `SELECT c.id, c.kind, 'manual' AS source, c.method, c.amount, c.date, c.description, '' AS caseKey, '' AS caseTitle, c.transfer_id AS transferId,
              c.created_by AS actorId, COALESCE(u.display_name, '') AS actorName, c.created_at AS createdAt, c.updated_at AS updatedAt
       FROM ${MANUAL.table} LEFT JOIN users u ON u.id = c.created_by${after ? ` WHERE ${MANUAL.date} > ?` : ""}`,
      ...(after ? [after] : []),
    );
    // Tarih sırası; aynı gün içinde giriş sırası (yeni eklenen en altta).
    return [...payments, ...manual, ...plans, ...accounts, ...stock, ...cheques, ...invoices].sort((a, b) => (a.date === b.date ? (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0) : a.date < b.date ? -1 : 1));
  }

  // Kasa toplamları SQL'de, Kasa satırlarıyla aynı kaynak tanımlarından (tablo + koşul) hesaplanır; satırlar belleğe
  // alınmaz. Kuruş tamsayısıyla toplanır (kayan nokta birikimi yok). ANLIK DURUM ve nakit akışı başlangıcı buradan okur.
  function sources() {
    return [PAYMENTS, MANUAL, context.plans?.cashSource, context.accounts?.cashSource, context.stock?.cashSource, context.cheques?.cashSource, context.invoices?.cashSource].filter(Boolean);
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
              COALESCE(SUM(CASE WHEN method = 'card' AND date <= ? THEN (CASE WHEN kind = 'in' THEN cents ELSE -cents END) END), 0) AS cardToday,
              COALESCE(SUM(CASE WHEN method = 'cash' AND date = ? AND kind = 'in' THEN cents END), 0) AS cashTodayIn,
              COALESCE(SUM(CASE WHEN method = 'cash' AND date = ? AND kind = 'out' THEN cents END), 0) AS cashTodayOut,
              COALESCE(SUM(CASE WHEN method = 'cash' AND date >= ? AND date <= ? AND kind = 'in' THEN cents END), 0) AS cashMonthIn,
              COALESCE(SUM(CASE WHEN method = 'cash' AND date >= ? AND date <= ? AND kind = 'out' THEN cents END), 0) AS cashMonthOut,
              COUNT(CASE WHEN method = 'cash' AND date > ? THEN 1 END) AS cashFuture,
              COALESCE(SUM(CASE WHEN method <> 'cash' AND date = ? AND kind = 'in' THEN cents END), 0) AS otherTodayIn,
              COALESCE(SUM(CASE WHEN method <> 'cash' AND date = ? AND kind = 'out' THEN cents END), 0) AS otherTodayOut
       FROM (${union})`,
      day, day, day, monthStart, day, monthStart, day, day, day, day, day, day, day, monthStart, day, monthStart, day, day, day, day,
    );
    const tl = cents => roundMoney(Number(cents || 0) / 100);
    // v2.0.13: yola göre bakiyeler (Nakit Kasa, Banka, Kredi Kartı); toplam = üçünün toplamı.
    // v2.0.17: ANLIK DURUM için nakit kasa (cashOnly) ile banka tarafı (noncash: havale/EFT + POS/kredi kartı) ayrı.
    const cashOnly = { balance: tl(row.cashAll), balanceToday: tl(row.cashToday), today: { in: tl(row.cashTodayIn), out: tl(row.cashTodayOut) }, month: { in: tl(row.cashMonthIn), out: tl(row.cashMonthOut) }, futureEntries: row.cashFuture };
    const noncash = { balance: roundMoney(tl(row.bankAll) + tl(row.cardAll)), balanceToday: roundMoney(tl(row.bankToday) + tl(row.cardToday)), today: { in: tl(row.otherTodayIn), out: tl(row.otherTodayOut) } };
    return { byMethod: { cash: tl(row.cashAll), bank: tl(row.bankAll), card: tl(row.cardAll) }, byMethodAt: { cash: tl(row.cashToday), bank: tl(row.bankToday), card: tl(row.cardToday) }, cashToday: tl(row.cashToday), balance: tl(row.balance), balanceToday: tl(row.balanceToday), today: { in: tl(row.todayIn), out: tl(row.todayOut) }, month: { in: tl(row.monthIn), out: tl(row.monthOut) }, futureEntries: row.future, count: row.count, cashOnly, noncash };
  }
  // Tarihe kadarki kasa (dahil): nakit akış projeksiyonunun başlangıcı. Kasa ekranıyla aynı hareketlerden.
  const balanceAt = day => (day ? summary(day).balanceToday : summary("9999-12-31").balance);
  // v2.0.13: eksi bakiye denetimi — Logo/Netsis'teki gibi yol başına ayar (Nakit Kasa, Banka, Kredi Kartı):
  // Kontrol Yok / Uyar / Engelle. Uyar: kullanıcı onaylarsa (force = cashForce) yazılır; Engelle: onayla da yazılmaz.
  // Bakiye: hareketin tarihindeki ve bugünden ileri tarihli hareketler dahil son bakiye; hangisi azsa o (ileri tarihli bir
  // ödeme zaten ayrılmışsa bugünkü çıkış onu açığa düşürmesin).
  const PLACE = { cash: "Nakit kasada", bank: "Banka hesabında (Havale / EFT)", card: "POS / Kredi Kartı hesabında" };
  const negativePolicy = () => readNegativePolicy(store.setting(NEGATIVE_KEY, ""));
  function setNegativePolicy(input) {
    const next = { ...negativePolicy() };
    // v2.0.17: yalnız Nakit Kasa ayarlanır; bank/card gönderilse de okunmaz (Banka modülü gelene kadar kapalı).
    for (const method of NEGATIVE_GUARDED) {
      if (input?.[method] === undefined) continue;
      if (!NEGATIVE_POLICIES.includes(input[method])) throw new HttpError(400, "Eksi bakiye denetimi Kontrol Yok, Uyar ya da Engelle olmalı.");
      next[method] = input[method];
    }
    store.setSetting(NEGATIVE_KEY, JSON.stringify(next));
    return next;
  }
  // v2.0.26 (gözden geçirme G7): silmede soru nedenini söyler. subject verilirse ("Bu tahsilat silinince", "Bu cari silinince
  // tahsilat ve ödemeleriyle birlikte") metin "çıkış" değil:
  // "Bu tahsilat silinince Nakit Kasa'dan 1.000,00 TL düşer; Nakit Kasa 200,00 TL iken −800,00 TL olur."
  // 2. gözden geçirme İ5: düzeltmede de (guardChange) özne kurulur ("Bu tahsilat 1.000,00 TL'den 500,00 TL'ye düzeltilince",
  // "Bu tahsilatın yolu Havale / EFT olarak değiştirilince"); yanıtta explained: true — istemci "ödeme bankadan yapıldıysa yolu
  // değiştirin" önerisini eklemez (düzeltmeye uymuyordu).
  const FROM = { cash: "Nakit Kasa'dan", bank: "banka hesabından (Havale / EFT)", card: "POS / Kredi Kartı hesabından" };
  const NAME = { cash: "Nakit Kasa", bank: "Banka hesabı (Havale / EFT)", card: "POS / Kredi Kartı hesabı" };
  const money = value => `${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} TL`;
  function guardOut(amount, day, force = false, method = "cash", subject = "") {
    const key = methodOf(method);
    if (!NEGATIVE_GUARDED.includes(key)) return;
    const policy = negativePolicy()[key];
    if (!(amount > 0) || policy === "off" || (policy === "warn" && force)) return;
    // Hareketin günündeki bakiye ile (ileri tarihliler dahil) son bakiyeden azı. Tek özet: summary(gün) son bakiyeyi de (byMethod,
    // bütün tarihler) verir — 2. gözden geçirme İ10: önceden aynı özet iki kez hesaplanıyordu (10.000 caride ~70 ms/işlem).
    const totals = summary(day || "9999-12-31");
    const balance = Math.min(totals.byMethodAt[key], totals.byMethod[key] || 0);
    const after = roundMoney(balance - amount);
    if (after < -0.005) {
      const base = subject
        ? `${subject} ${FROM[key]} ${money(amount)} düşer; ${NAME[key]} ${money(balance)} iken ${money(after)} olur.`
        : `${PLACE[key]} ${money(balance)} var; ${money(amount)} çıkış bakiyeyi ${money(after)} eksiye düşürür.`;
      const extra = subject ? { explained: true } : {};
      if (policy === "block") throw new HttpError(409, `${base} Bu hesapta eksi bakiyeye izin verilmiyor (Yönetim → Sistem → Eksi Bakiye Denetimi).`, { code: "cash-blocked", method: key, balance, after, ...extra });
      throw new HttpError(409, base, { code: "cash-negative", method: key, balance, after, ...extra });
    }
  }
  // Düzeltmede sorunun öznesi (İ5): aynı yolda tutar/yön düzeltmesi ya da yol değişikliği.
  const NOUN = { in: ["Bu tahsilat", "Bu tahsilatın"], out: ["Bu ödeme", "Bu ödemenin"] };
  function changeSubject(before, after, key) {
    const [noun, owner] = NOUN[(before || after)?.kind === "out" ? "out" : "in"];
    const wasHere = before && methodOf(before.method) === key;
    const isHere = after && methodOf(after.method) === key;
    if (wasHere && isHere) {
      if (before.kind !== after.kind) return `${noun} ${after.kind === "out" ? "ödemeye" : "tahsilata"} çevrilince`;
      return `${noun} ${money(Number(before.amount) || 0)}'den ${money(Number(after.amount) || 0)}'ye düzeltilince`;
    }
    if (wasHere) return `${owner} yolu ${METHODS[methodOf(after.method)]} olarak değiştirilince`;
    if (before) return `${owner} yolu ${METHODS[key]} olarak değiştirilince`;
    return "";
  }
  // Düzeltme ve silmede de: before/after { kind: "in"|"out" (Kasa'ya giriş/çıkış yönü), amount, method, date } ya da null
  // (yeni/silinen). Her yol ayrı: nakitten bankaya taşınan bir tahsilat nakit hesabını azaltır, o denetlenir.
  // subject (G7): silmede (after null) sorunun öznesi, ör. "Bu tahsilat silinince"; düzeltmede özne kendiliğinden kurulur (İ5).
  function guardChange(before, after, force = false, subject = "") {
    for (const key of Object.keys(METHODS)) {
      const effect = entry => (entry && methodOf(entry.method) === key ? (entry.kind === "in" ? 1 : -1) * (Number(entry.amount) || 0) : 0);
      const delta = roundMoney(effect(after) - effect(before));
      if (delta < -0.005) guardOut(-delta, after?.date || before?.date || "", force, key, after ? changeSubject(before, after, key) : subject);
    }
  }
  // v2.0.26 (A3, A4): birden çok hareket birlikte düşerken (cari ya da taksit kartı silme) her yolun NET etkisi denetlenir
  // (tek tek değil: ikisi ayrı ayrı geçip toplamı eksiye düşürmesin). Gün: düşen hareketlerin en sonuncusu (o güne kadarki
  // bakiye hepsini içerir; tek hareket silmedeki kuralla aynı).
  function guardRemove(list, force = false, subject = "") {
    const by = new Map();
    for (const entry of list || []) {
      if (!entry || (entry.kind !== "in" && entry.kind !== "out")) continue;
      const key = methodOf(entry.method);
      const current = by.get(key) || { delta: 0, date: "" };
      current.delta = roundMoney(current.delta - (entry.kind === "in" ? 1 : -1) * (Number(entry.amount) || 0));
      if (entry.date > current.date) current.date = entry.date;
      by.set(key, current);
    }
    for (const [key, { delta, date }] of by) if (delta < -0.005) guardOut(-delta, date, force, key, subject);
  }
  // method: "cash" (Kasa penceresi), "bank" | "card" | "noncash" (banka tarafı), "" (hepsi — Ana Defter, eski raporlar).
  function report(user, from, to, method = "") {
    const filter = methodFilter(method);
    method = filter ? String(method) : "";
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
      if (filter && !filter.has(entry.method)) continue;
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
        : entry.source === "cheque" || entry.source === "invoice" ? false
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

  // Kasa penceresi: yol verilmezse NAKİT (v2.0.17). "all" ile hepsi (raporlar), "noncash" ile banka tarafı.
  const methodParam = url => {
    const value = text(url.searchParams.get("method"));
    return value === "all" ? "" : value || "cash";
  };
  router.get("/api/workspace/cash", async ({ req, res, url }) => {
    const user = auth.requirePermission(req, "cash.view");
    ok(res, report(user, text(url.searchParams.get("from")), text(url.searchParams.get("to")), methodParam(url)));
  });

  // Kasa dökümü PDF olarak (ör. 01.09.2026 – 25.09.2026 arası hareketler).
  router.get("/api/workspace/cash.pdf", async ({ req, res, url }) => {
    const user = auth.requirePermission(req, "cash.view");
    const from = text(url.searchParams.get("from"));
    const to = text(url.searchParams.get("to"));
    const data = report(user, from, to, methodParam(url));
    const pdf = cashPdf(data, { from, to, officeName: store.setting("office.name", ""), userName: user.display_name || user.username || "", now: clock() });
    audit(user, "cash.exported", rangeLabel(from, to), { from, to, count: data.entries.length });
    sendBuffer(res, pdf, { type: "application/pdf", name: cashPdfName(from, to), inline: url.searchParams.get("download") !== "1" });
  });

  const input = body => {
    const kind = text(body.kind);
    if (!["in", "out"].includes(kind)) throw new HttpError(400, "Hareket türü tahsilat ya da ödeme olmalı.");
    const amount = parseAmount(body.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1e12) throw new HttpError(400, "Geçerli bir tutar girin.");
    // v2.0.13: tarih boş/geçersiz olamaz, ileri tarihli ve kilitli döneme hareket girilemez (lib/period.mjs).
    const date = context.period ? context.period.movementDate(body) : text(body.date) || clock.today();
    if (!validDate(date)) throw new HttpError(400, "Geçerli bir tarih girin.");
    const description = limited(body.description, 300, "Açıklama");
    if (!description) throw new HttpError(400, kind === "in" ? "Tahsilatın kimden/ne için alındığını yazın." : "Ödemenin kime/ne için yapıldığını yazın.");
    // v2.0.17: Kasa'ya yalnız nakit girilir. Yol gönderilmişse nakit olmalı (eski istemci / API).
    if (methodInput(body.method) !== "cash") {
      throw new HttpError(400, "Kasa'ya yalnız nakit tahsilat ve ödeme girilir. Havale/EFT, POS ve kredi kartı hareketleri cari, fatura, taksit, stok ve çek/senet ekranlarından girilir; banka ile para geçişi için Kasa'daki Aktar / Yatır düğmelerini kullanın.", { code: "cash-method", method: methodOf(body.method) });
    }
    return { kind, amount: roundMoney(amount), date, description, method: "cash" };
  };

  router.post("/api/workspace/cash", async ({ req, res }) => {
    const user = auth.requirePermission(req, "cash.manage");
    const body = await readJson(req);
    const entry = input(body);
    if (entry.kind === "out") guardOut(entry.amount, entry.date, body.cashForce === true, entry.method);
    const id = auth.newId("cash");
    // v2.1.0 (bank.post, plan §3.3): satır, İşlem No'lu işlem başlığı ve işlem geçmişi tek işlemde.
    bank.post({
      user,
      module: "cash",
      op: "create",
      write: () => {
        store.run("INSERT INTO cash_entries (id, kind, amount, date, description, method, event_id, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", id, entry.kind, entry.amount, entry.date, entry.description, entry.method, bank.eventFor("cash_entries", entry), user.id, now());
        audit(user, "cash.entry.created", id, entry);
      },
    });
    changed(user);
    ok(res, { id });
  });

  const existing = id => {
    const entry = store.get("SELECT id, kind, amount, date, description, method, transfer_id AS transferId, event_id AS eventId FROM cash_entries WHERE id = ?", limited(id, 120, "Hareket"));
    if (!entry) throw new HttpError(404, "Kasa hareketi bulunamadı. Başka biri silmiş olabilir.");
    return entry;
  };
  // Transferin öbür yarısı (nakit tarafının bankası, banka tarafının nakdi).
  const twinOf = entry => (entry.transferId ? store.get("SELECT id, kind, amount, date, description, method, transfer_id AS transferId, event_id AS eventId FROM cash_entries WHERE transfer_id = ? AND id <> ?", entry.transferId, entry.id) : null);

  // ---------- Kasa ↔ Banka transferi (v2.0.17) ----------
  // direction: "to-cash" (bankadan kasaya nakit çekildi) | "to-bank" (kasadaki nakit bankaya yatırıldı).
  // Nakit tarafı Kasa'da nakit giriş/çıkış olarak görünür; banka tarafı Banka ve POS raporunda karşı hareket. Tek işlem;
  // kasadan bankaya yatırmada nakit eksi bakiye denetimi çalışır.
  const TRANSFER_TEXT = { "to-cash": "Bankadan Kasaya Aktarım", "to-bank": "Kasadan Bankaya Yatırma" };
  router.post("/api/workspace/cash/transfer", async ({ req, res }) => {
    const user = auth.requirePermission(req, "cash.manage");
    const body = await readJson(req);
    const direction = text(body.direction);
    if (!TRANSFER_TEXT[direction]) throw new HttpError(400, "Transfer yönü seçin: Bankadan Kasaya ya da Kasadan Bankaya.", { field: "direction" });
    const amount = parseAmount(body.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1e12) throw new HttpError(400, "Geçerli bir tutar girin.");
    const date = context.period ? context.period.movementDate(body) : text(body.date) || clock.today();
    if (!validDate(date)) throw new HttpError(400, "Geçerli bir tarih girin.");
    const description = limited(body.description, 300, "Açıklama") || TRANSFER_TEXT[direction];
    const cashKind = direction === "to-cash" ? "in" : "out";
    if (cashKind === "out") guardOut(roundMoney(amount), date, body.cashForce === true, "cash");
    const transferId = auth.newId("trf");
    const cashId = auth.newId("cash");
    const bankId = auth.newId("cash");
    const stamp = now();
    // İki bacak tek işlem başlığında (cash_transfer; plan §3.7 #10).
    bank.post({
      user,
      module: "cash",
      op: "create",
      write: () => {
        const eventId = bank.eventFor("cash_entries", { kind: cashKind, date, method: "cash", transfer_id: transferId });
        store.run("INSERT INTO cash_entries (id, kind, amount, date, description, method, transfer_id, event_id, created_by, created_at) VALUES (?, ?, ?, ?, ?, 'cash', ?, ?, ?, ?)", cashId, cashKind, roundMoney(amount), date, description, transferId, eventId, user.id, stamp);
        store.run("INSERT INTO cash_entries (id, kind, amount, date, description, method, transfer_id, event_id, created_by, created_at) VALUES (?, ?, ?, ?, ?, 'bank', ?, ?, ?, ?)", bankId, cashKind === "in" ? "out" : "in", roundMoney(amount), date, description, transferId, eventId, user.id, stamp);
        audit(user, "cash.transfer.created", transferId, { direction, amount: roundMoney(amount), date, description, cashId, bankId });
      },
    });
    changed(user);
    ok(res, { id: cashId, bankId, transferId, direction, amount: roundMoney(amount), date });
  });

  router.put("/api/workspace/cash/:id", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "cash.manage");
    const previous = existing(params.id);
    context.period?.assertOpen(previous.date, "Bu kasa hareketi");
    const body = await readJson(req);
    // Eski (2.0.16 öncesi) nakit dışı Kasa kaydının yolu değiştirilmez; transferde yön (kind) de sabittir.
    const entry = { ...input({ ...body, method: undefined }), method: previous.method };
    if (previous.transferId && entry.kind !== previous.kind) throw new HttpError(400, "Transferin yönü değiştirilemez; silip yeniden girin.", { code: "transfer-kind" });
    guardChange(previous, entry, body.cashForce === true);
    const twin = twinOf(previous);
    if (twin) guardChange(twin, { ...twin, amount: entry.amount, date: entry.date }, body.cashForce === true);
    bank.post({
      user,
      module: "cash",
      op: "update",
      prev: [previous, twin].filter(Boolean),
      write: () => {
        // Eski (olaysız) satır düzeltilince olay alır; transferin iki bacağı aynı olayda kalır.
        const eventId = bank.eventFor("cash_entries", { ...entry, transfer_id: previous.transferId, event_id: previous.eventId || twin?.eventId || "" });
        store.run("UPDATE cash_entries SET kind = ?, amount = ?, date = ?, description = ?, method = ?, event_id = ?, updated_by = ?, updated_at = ? WHERE id = ?", entry.kind, entry.amount, entry.date, entry.description, entry.method, eventId, user.id, now(), previous.id);
        if (twin) store.run("UPDATE cash_entries SET amount = ?, date = ?, description = ?, event_id = ?, updated_by = ?, updated_at = ? WHERE id = ?", entry.amount, entry.date, entry.description, eventId, user.id, now(), twin.id);
        audit(user, previous.transferId ? "cash.transfer.updated" : "cash.entry.updated", previous.transferId || previous.id, { previous, ...entry });
      },
    });
    changed(user);
    ok(res, { id: previous.id });
  });

  router.delete("/api/workspace/cash/:id", async ({ req, res, params, url }) => {
    const user = auth.requirePermission(req, "cash.manage");
    const previous = existing(params.id);
    context.period?.assertOpen(previous.date, "Bu kasa hareketi");
    guardChange(previous, null, url.searchParams.get("cashForce") === "1", "Bu Kasa hareketi silinince");
    const twin = twinOf(previous);
    if (twin) guardChange(twin, null, url.searchParams.get("cashForce") === "1", "Bu transferin öbür tarafı silinince");
    const full = store.get("SELECT id, kind, amount, date, description, method, transfer_id AS transferId, event_id AS eventId, created_by AS createdBy, created_at AS createdAt FROM cash_entries WHERE id = ?", previous.id);
    const twinFull = twin ? store.get("SELECT id, kind, amount, date, description, method, transfer_id AS transferId, event_id AS eventId, created_by AS createdBy, created_at AS createdAt FROM cash_entries WHERE id = ?", twin.id) : null;
    // Silme, Silinenler kaydı ve işlem geçmişi tek işlemde (v2.0.26, B5): yarıda kesilirse hiçbiri yazılmaz (önceden hareket
    // silinip Silinenler'e yazılamadan kesinti olursa geri getirilemiyordu). v2.1.0: işlem başlığı "iptal" olur (kopyası kalır);
    // Silinenler'den geri yüklenince aynı olay yeniden etkinleşir.
    bank.post({
      user,
      module: "cash",
      op: "delete",
      prev: [full, twinFull].filter(Boolean),
      write: () => {
        store.run("DELETE FROM cash_entries WHERE id = ?", previous.id);
        if (twin) store.run("DELETE FROM cash_entries WHERE id = ?", twin.id);
        // Silinenler (v2.0.2): yönetim panelinden geri yüklenebilir. Transferde iki taraf birlikte (payload.twin).
        trash?.add({ kind: "cash", ref: previous.id, title: full.description || (previous.transferId ? "Kasa ↔ Banka Transferi" : "Kasa Hareketi"), payload: { ...full, twin: twinFull }, user });
        audit(user, previous.transferId ? "cash.transfer.deleted" : "cash.entry.deleted", previous.transferId || previous.id, previous);
      },
    });
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
  return { entries, report, balanceAt, summary, guardOut, guardChange, guardRemove, negativePolicy };
}
