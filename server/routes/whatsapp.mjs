// WhatsApp ile ekstre ve mesaj gönderimi (v2.0.13, müşteri talebi): tek cariye ya da toplu (tüm cariler, süzgeçteki
// cariler ya da seçilen N cari).
//
// Mimari karar: WhatsApp'ın resmi toplu gönderimi (Business Platform) ücretli hesap, onaylı şablon ve internetteki bir
// hizmet ister; yerel-öncelikli bu programda kullanıcının kendi WhatsApp'ı (masaüstü/web) kullanılır. Sunucu alıcıları
// hazırlar (telefon doğrulama, bakiye, taksit, kişiye özel ekstre metni), arayüz bir "gönderim sırası" ile her kişi için
// mesajı hazır açar; her gönderim cari kartına kaydedilir (kime, ne zaman, kim, ne gönderildi).
//   POST /api/workspace/whatsapp/targets  { ids | all + süzgeçler, kind: statement|message, preset }
//   POST /api/workspace/whatsapp/log      { batchId, accountId, kind, body, status: sent|skipped }
//   GET  /api/workspace/whatsapp/history?accountId=
import { HttpError, limited, ok, readJson, text } from "../lib/http.mjs";
import { roundMoney } from "../lib/money.mjs";

const MAX_TARGETS = 5000;
const pad = value => String(value).padStart(2, "0");
const dayText = iso => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "");
const tl = value => `${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0)} TL`;

// Telefon → wa.me biçimi (ülke kodlu, yalnız rakam). Türkiye cep: 05xx… / 5xx… / +90 5xx… → 905xxxxxxxxx.
export function waNumber(phone) {
  // Hücrede birden çok numara olabilir ("0537… / 0532…"): ilki kullanılır.
  let digits = (String(phone || "").split(/[,;/|\n]/).find(part => /\d/.test(part)) || "").replace(/\D/g, "");
  if (!digits) return { wa: "", valid: false, reason: "Telefon yok" };
  if (digits.startsWith("00")) digits = digits.slice(2);
  // Başında 0 ya da 5 olan numara yurt içidir (hane sayısı yanlış olsa bile: "eksik" diye söylenir).
  else if (digits.startsWith("0")) digits = `90${digits.slice(1)}`;
  else if (digits.startsWith("5") && digits.length <= 11) digits = `90${digits}`;
  if (digits.startsWith("90")) {
    if (digits.length !== 12) return { wa: digits, valid: false, reason: "Numara eksik ya da fazla haneli" };
    if (digits[2] !== "5") return { wa: digits, valid: false, reason: "Sabit hat (WhatsApp cep numarası değil)" };
    return { wa: digits, valid: true, reason: "" };
  }
  return digits.length >= 11 && digits.length <= 15 ? { wa: digits, valid: true, reason: "" } : { wa: digits, valid: false, reason: "Numara biçimi tanınmadı" };
}

function presetRange(preset, today) {
  const [y, m] = today.split("-").map(Number);
  if (preset === "all") return { from: "", to: "" };
  if (preset === "last3") {
    const start = new Date(Date.UTC(y, m - 3, 1));
    return { from: `${start.getUTCFullYear()}-${pad(start.getUTCMonth() + 1)}-01`, to: today };
  }
  if (preset === "lastMonth") {
    const start = new Date(Date.UTC(y, m - 2, 1));
    const end = new Date(Date.UTC(y, m - 1, 0));
    return { from: `${start.getUTCFullYear()}-${pad(start.getUTCMonth() + 1)}-01`, to: `${end.getUTCFullYear()}-${pad(end.getUTCMonth() + 1)}-${pad(end.getUTCDate())}` };
  }
  return { from: `${y}-${pad(m)}-01`, to: today };
}

// Kişiye özel ekstre metni (WhatsApp'ta düz metin; kalın için *…*). En çok 20 hareket; fazlası sayı olarak belirtilir.
export function statementText({ office, account, lines, range, next, overdue }) {
  const inRange = lines.filter(line => (!range.from || line.date >= range.from) && (!range.to || line.date <= range.to));
  const before = range.from ? lines.filter(line => line.date < range.from) : [];
  const opening = before.length ? before.at(-1).balance : 0;
  const closing = lines.length ? lines.filter(line => !range.to || line.date <= range.to).at(-1)?.balance ?? opening : 0;
  const side = value => (value > 0.005 ? "borcunuz" : value < -0.005 ? "alacağınız" : "");
  const shown = inRange.slice(-20);
  const out = [`Sayın ${account.name},`, `${office ? `${office} ` : ""}cari hesap ekstreniz${range.from ? ` (${dayText(range.from)} – ${dayText(range.to)})` : ""}:`, ""];
  if (before.length) out.push(`Devir: ${tl(Math.abs(opening))}${side(opening) ? ` (${side(opening)})` : ""}`);
  if (inRange.length > shown.length) out.push(`… önceki ${inRange.length - shown.length} hareket`);
  for (const line of shown) {
    const amount = line.debit ? `+${tl(line.debit)}` : line.credit ? `−${tl(line.credit)}` : "";
    if (!amount) continue;
    out.push(`${dayText(line.date)} ${line.label}${line.note ? ` · ${String(line.note).slice(0, 60)}` : ""}: ${amount}`);
  }
  if (!inRange.length) out.push("Bu dönemde hareket yok.");
  out.push("", `*Güncel bakiye: ${tl(Math.abs(closing))}${side(closing) ? ` (${side(closing)})` : ""}*`);
  if (overdue?.count) out.push(`Vadesi geçen: ${overdue.count} taksit, ${tl(overdue.amount)}`);
  if (next) out.push(`Sıradaki taksit: ${dayText(next.dueDate)} · ${tl(next.remaining ?? next.amount)}`);
  out.push("", "İyi günler dileriz.");
  return out.join("\n");
}

export function registerWhatsappRoutes(router, { store, auth, audit, accounts = () => null, now: clock = () => new Date() }) {
  const today = () => {
    const d = clock();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const newId = prefix => `${prefix}-${crypto.randomUUID()}`;
  const lastSends = ids => {
    const out = new Map();
    if (!ids.length) return out;
    for (const row of store.all(`SELECT account_id AS accountId, kind, status, created_at AS at FROM message_sends WHERE account_id IN (${ids.map(() => "?").join(",")}) AND status = 'sent' ORDER BY created_at`, ...ids)) out.set(row.accountId, row);
    return out;
  };

  router.post("/api/workspace/whatsapp/targets", async ({ req, res }) => {
    const user = auth.requirePermission(req, "accounts.view");
    const body = await readJson(req, { limit: 2_000_000 });
    const kind = body.kind === "statement" ? "statement" : "message";
    const service = accounts();
    if (!service?.list || !service?.detail) throw new HttpError(503, "Cari modülü hazır değil.");
    let ids;
    if (body.all === true) {
      ids = service.list(user, { q: text(body.q).slice(0, 120), group: text(body.group), subgroup: text(body.subgroup), type: text(body.type), status: ["active", "passive", "all"].includes(text(body.status)) ? text(body.status) : "active", balance: text(body.balance) || "all" }).accounts.map(item => item.id);
    } else ids = [...new Set((Array.isArray(body.ids) ? body.ids : []).map(value => String(value || "").slice(0, 120)).filter(Boolean))];
    if (!ids.length) throw new HttpError(400, "Gönderilecek carileri seçin.");
    if (ids.length > MAX_TARGETS) throw new HttpError(400, `Tek seferde en çok ${MAX_TARGETS} cariye gönderilebilir; süzgeçle daraltın.`);
    const range = presetRange(text(body.preset) || "thisMonth", today());
    const office = store.setting("office.name", "") || "";
    const sent = lastSends(ids);
    const recipients = [];
    for (const id of ids) {
      let account;
      try {
        account = service.detail(id, user);
      } catch {
        continue;
      }
      const phone = waNumber(account.phone);
      const plans = (account.plans || []).filter(plan => plan.status === "active");
      const next = plans.map(plan => plan.next).filter(Boolean).sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))[0] || null;
      const overdue = { count: account.totals.overdueCount || 0, amount: roundMoney(account.totals.overdue || 0) };
      const payments = (account.ledger || []).filter(line => line.kind === "in" || line.kind === "plan-in");
      const last = payments.at(-1) || null;
      recipients.push({
        id: account.id,
        refNo: account.refNo,
        name: account.name,
        type: account.type,
        phone: account.phone || "",
        wa: phone.wa,
        valid: phone.valid,
        reason: phone.reason,
        balance: account.totals.balance,
        next: next ? { dueDate: next.dueDate, amount: roundMoney(next.remaining ?? next.amount ?? 0) } : null,
        overdue,
        lastPayment: last ? { date: last.date, amount: last.credit } : null,
        lastSend: sent.get(account.id) || null,
        statement: kind === "statement" ? statementText({ office, account, lines: account.ledger || [], range, next, overdue }) : "",
      });
    }
    audit(user, "whatsapp.prepared", "batch", { kind, count: recipients.length, valid: recipients.filter(item => item.valid).length });
    ok(res, { kind, office, range, today: today(), recipients });
  });

  router.post("/api/workspace/whatsapp/log", async ({ req, res }) => {
    const user = auth.requirePermission(req, "accounts.view");
    const body = await readJson(req, { limit: 200_000 });
    const accountId = limited(body.accountId, 120, "Cari");
    if (!accounts()?.exists?.(accountId)) throw new HttpError(400, "Cari bulunamadı.");
    const kind = body.kind === "statement" ? "statement" : "message";
    const status = body.status === "skipped" ? "skipped" : "sent";
    const id = newId("wa");
    store.run(
      "INSERT INTO message_sends (id, batch_id, account_id, kind, phone, body, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      id, limited(body.batchId, 120, "Gönderim") || id, accountId, kind, limited(body.phone, 30, "Telefon"), limited(body.body, 8000, "Mesaj"), status, user.id, new Date().toISOString(),
    );
    ok(res, { id });
  });

  router.get("/api/workspace/whatsapp/history", async ({ req, res, url }) => {
    auth.requirePermission(req, "accounts.view");
    const accountId = limited(url.searchParams.get("accountId"), 120, "Cari");
    ok(
      res,
      store.all(
        `SELECT s.id, s.kind, s.status, s.body, s.created_at AS at, COALESCE(u.display_name, '') AS actorName FROM message_sends s LEFT JOIN users u ON u.id = s.created_by
         WHERE s.account_id = ? ORDER BY s.created_at DESC LIMIT 20`,
        accountId,
      ),
    );
  });
}
