// DestekOfis Mobil — kayıt girişi (2.4.7 M5): cari kartından Tahsilat Gir / Ödeme Gir (taksit kartına tahsilat dahil), stok kartından Stok Girişi.
// Kayıt programın masaüstüyle AYNI ucundan yazılır (server/lib/mobile-write.mjs): para kuralları (FIFO, Kasa / banka eksi bakiye, Benzer İşlem, taksit kartı
// K8, dönem kilidi) sunucuda; telefon yalnız formu, soruları ve sonucu belirsiz isteği gösterir. Kullanıcı kararları (S1–S8, docs/2.4.7-IS-LISTESI.md):
//   - Kapatılacak Fatura seçilmez (en eski açık borç kapanır; bilgi notu); çek / senet yok; taksit kartına tahsilat var; stokta yalnız giriş.
//   - "Yine de Kaydet", Benzer İşlem onayı ve "Fazlasını Avans Yaz" masaüstündeki soruyla ve yetkiyle (sunucu sorar; telefon aynı istek kimliğiyle onaylayıp gönderir).
//   - Tarih gönderilmez: kayıt ofis sunucusunun bugününe yazılır.
//   - İstek kimliği form açılınca üretilir; bağlantı koparsa AYNI kimlikle yeniden gönderilir (ikinci kayıt açılmaz); 24 saati geçen belirsiz istek yeniden
//     gönderilmez (yazma-bekleyen.js). Sunucu kapalıyken kayıt kuyruğa alınmaz.
import { RESEND_HOURS, createBekleyenler, yenidenGonderilebilir } from "./yazma-bekleyen.js";

const API = "/api/mobil";
// Masaüstü formlarının soruları (hof-cari / hof-plans): Kasa / banka eksi bakiye Uyar → "Yine de Kaydet"; Benzer İşlem → "Yine de Kaydet"; taksit kartının
// kalanını aşan ya da ödenmiş karta tahsilat → "Fazlasını Avans Yaz" (yalnız plans.manage; masaüstünde de yalnız yetkiliye sorulur).
const QUESTIONS = { "cash-negative": "cashForce", "bank-similar": "similarOk", "plan-overpay": "overpay", "plan-paid": "overpay" };
const CONFIRM_TEXT = { cashForce: "Yine de Kaydet", similarOk: "Yine de Kaydet", overpay: "Fazlasını Avans Yaz" };
let ctx = null;
let storage = null;
try {
  storage = window.localStorage;
} catch {
  storage = null;
}
const bekleyenler = createBekleyenler(storage);

/** app.js bağlar: { state, path, safe, money, toast, detail, loggedOut, serverState }. */
export function initYazma(context) {
  ctx = context;
  renderPending();
}

// Telefonun girdiği tutar tek biçime çevrilir ("1.250,50" / "1250.50" / "1250,5" → "1250,50"): sunucu yalnız "1234,56" biçimini kabul eder (biçim dışı yuvarlanmaz).
export function tutarMetni(input) {
  let raw = String(input ?? "").replace(/[\s₺]/g, "").replace(/tl$/i, "");
  if (!raw) return "";
  if (raw.includes(",")) raw = raw.replace(/\./g, "");
  else if (/^\d+\.\d{1,2}$/.test(raw)) raw = raw.replace(".", ",");
  else raw = raw.replace(/\./g, "");
  return /^\d{1,13}(,\d{1,2})?$/.test(raw) ? raw : null;
}

const rights = () => ctx?.state?.writes || {};
const companyPath = path => ctx.path(path);
function makeRequestId() {
  if (window.crypto?.randomUUID) return crypto.randomUUID();
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`;
}

// ---------- Cari ve stok kartına düğmeler ----------
/** detail() sonrası app.js çağırır: kind accounts | stock, data kartın yanıtı. */
export function decorateDetail(kind, id, data) {
  if (!ctx || !ctx.state.writesEnabled) return;
  const card = document.querySelector("#content .split-detail .card");
  if (!card) return;
  let bar = card.querySelector(".detail-actions");
  if (!bar) {
    bar = document.createElement("div");
    bar.className = "detail-actions";
    card.append(bar);
  }
  const obj = data?.account || data?.item || data || {};
  const name = obj.name || "";
  const buttons = [];
  if (kind === "accounts") {
    const plans = (Array.isArray(data?.plans) ? data.plans : []).filter(plan => plan.status === "active" && Number(plan.totals?.remaining) > 0);
    if (rights().tahsilat || (rights().taksit && plans.length)) buttons.push(["tahsilat", "Tahsilat Gir", "primary"]);
    if (rights().odeme) buttons.push(["odeme", "Ödeme Gir", ""]);
    bar.prepend(...buttons.map(([action, label, cls]) => button(label, cls, () => openForm(action, { id, name, plans }))));
  } else if (kind === "stock" && rights().stok && obj.kind !== "service") {
    bar.prepend(button("Stok Girişi", "primary", () => openForm("stok", { id, name, unit: obj.unit || "" })));
  }
}
function button(label, cls, onClick) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = `btn ${cls}`.trim();
  el.dataset.yazma = label;
  el.textContent = label;
  el.addEventListener("click", onClick);
  return el;
}

// ---------- Form ----------
async function choices() {
  try {
    const res = await fetch(API + companyPath("/bank/choices"), { credentials: "same-origin", cache: "no-store", headers: { "x-requested-with": "DestekOfisMobile" } });
    const data = await res.json();
    return res.ok && data.ok ? data.data : null;
  } catch {
    return null;
  }
}
const optionsOf = (list, ids) => (ids || []).map(id => list.find(item => item.id === id)).filter(Boolean);

async function openForm(action, target) {
  const { safe, money } = ctx;
  const requestId = makeRequestId();
  const formAt = Date.now();
  const company = ctx.state.company;
  const stock = action === "stok";
  const pay = action === "odeme";
  const title = stock ? "Stok Girişi" : pay ? "Ödeme Gir" : "Tahsilat Gir";
  const plans = !stock && !pay && rights().taksit ? target.plans || [] : [];
  const sheet = document.createElement("div");
  sheet.className = "yz-backdrop";
  sheet.innerHTML = `<form class="yz-sheet" novalidate aria-label="${safe(title)}">
    <div class="yz-head"><div><span class="eyebrow">${safe(target.name)}</span><h2>${safe(title)}</h2></div><button type="button" class="icon-button" data-yz="close" aria-label="Kapat">×</button></div>
    ${!stock && !pay && (plans.length || !rights().tahsilat) ? `<label class="yz-field">Tahsilat Yeri<select name="target">${rights().tahsilat ? `<option value="">Cari Hesabına (En Eski Borç)</option>` : ""}${plans.map(plan => `<option value="${safe(plan.id)}">Taksit Kartı · ${safe(plan.name)} · Kalan ${safe(money(Number(plan.totals?.remaining)))}</option>`).join("")}</select></label>` : ""}
    <label class="yz-field">${stock ? `Miktar${target.unit ? ` (${safe(target.unit)})` : ""}` : "Tutar (TL)"}<input name="${stock ? "qty" : "amount"}" inputmode="decimal" autocomplete="off" required placeholder="${stock ? "Ör. 5" : "Ör. 1250,50"}"></label>
    ${stock ? "" : `<label class="yz-field">Ödeme Yolu<select name="method"><option value="cash">Nakit</option><option value="bank">Havale / EFT</option><option value="card">${pay ? "Kredi Kartı" : "POS"}</option></select></label>
    <label class="yz-field hidden" data-yz-pick="bank">Banka Hesabı<select name="bankAccountId"></select></label>
    <label class="yz-field hidden" data-yz-pick="card">Kredi Kartı<select name="cardAccountId"></select></label>
    <label class="yz-field hidden" data-yz-pick="pos">POS<select name="posId"></select></label>`}
    <label class="yz-field">Açıklama<input name="note" maxlength="300" autocomplete="off"></label>
    <div class="notice" data-yz-note>${stock ? "Mobilde yalnız stok girişi yapılır; çıkış ve satış masaüstünden girilir." : pay ? "Ödeme carinin en eski açık borcunu kapatır; fatura seçilmez." : "Tahsilat carinin en eski açık borcunu kapatır; fatura seçilmez."} Kayıt bugünün tarihiyle (ofis sunucusunun günü) yazılır.</div>
    <div class="yz-message hidden" role="alert" data-yz-message></div>
    <div class="yz-foot"><button type="button" class="btn" data-yz="close">Vazgeç</button><button type="submit" class="btn primary" data-yz="submit">Kaydet</button></div>
  </form>`;
  document.body.append(sheet);
  const form = sheet.querySelector("form");
  const close = () => sheet.remove();
  sheet.querySelectorAll('[data-yz="close"]').forEach(el => el.addEventListener("click", close));
  form.querySelector("input")?.focus();
  // Hesap / POS seçicileri: masaüstü formlarının seçicisi (tek hesapta sunucu kendisi seçer; seçiciyi göremeyen kullanıcıda da sunucu seçer ya da sorar).
  if (!stock) {
    const ch = await choices();
    const fill = (kind, list) => {
      const box = form.querySelector(`[data-yz-pick="${kind}"]`);
      box.dataset.count = String(list.length);
      box.querySelector("select").innerHTML = list.map(item => `<option value="${safe(item.id)}">${safe(item.label || item.name || item.id)}</option>`).join("");
    };
    if (ch) {
      fill("bank", optionsOf(ch.accounts || [], ch.forms?.bank?.ids));
      fill("card", optionsOf(ch.accounts || [], ch.forms?.card?.ids));
      fill("pos", optionsOf(ch.pos || [], ch.forms?.pos?.ids));
    }
    const sync = () => {
      const method = form.elements.method.value;
      const want = method === "bank" ? "bank" : method === "card" ? (pay ? "card" : "pos") : "";
      for (const box of form.querySelectorAll("[data-yz-pick]")) box.classList.toggle("hidden", box.dataset.yzPick !== want || Number(box.dataset.count || 0) < 2);
    };
    form.elements.method.addEventListener("change", sync);
    sync();
  }
  const show = (text, kind = "error") => {
    const box = form.querySelector("[data-yz-message]");
    box.className = `yz-message ${kind}`;
    box.innerHTML = text;
  };
  const submitButton = form.querySelector('[data-yz="submit"]');
  let flags = {};
  const send = async () => {
    const amountField = form.elements[stock ? "qty" : "amount"];
    const value = stock ? String(amountField.value || "").trim().replace(",", ".") : tutarMetni(amountField.value);
    if (!value || (stock && !(Number(value) > 0))) return show(stock ? "Miktarı yazın (ör. 5)." : "Tutarı en çok iki ondalıkla yazın (ör. 1250,50).");
    const body = stock ? { qty: value } : { amount: value, method: form.elements.method.value };
    if (!stock) {
      const method = form.elements.method.value;
      const pick = method === "bank" ? "bank" : method === "card" ? (pay ? "card" : "pos") : "";
      const box = pick ? form.querySelector(`[data-yz-pick="${pick}"]`) : null;
      if (box && Number(box.dataset.count || 0) >= 2) {
        const selected = box.querySelector("select").value;
        if (pick === "pos") body.posId = selected;
        else body.bankAccountId = selected;
      }
    }
    const note = String(form.elements.note.value || "").trim();
    if (note) body.note = note;
    const planId = form.elements.target?.value || "";
    const url = stock ? `/stock/${encodeURIComponent(target.id)}/giris` : planId ? `/plans/${encodeURIComponent(planId)}/tahsilat` : `/accounts/${encodeURIComponent(target.id)}/${pay ? "odeme" : "tahsilat"}`;
    const record = { requestId, formAt, company, url, body: { ...body, ...flags }, label: `${title} · ${target.name} · ${stock ? value : value + " TL"}`, noun: stock ? "Stok girişi" : pay ? "Ödeme" : "Tahsilat", accountId: target.id, kind: stock ? "stock" : "accounts" };
    submitButton.disabled = true;
    const result = await transmit(record);
    submitButton.disabled = false;
    handle(result, record, { close, show, setFlag: flag => (flags = { ...flags, [flag]: true }), resend: send });
  };
  form.addEventListener("submit", event => {
    event.preventDefault();
    send();
  });
}

// ---------- Gönderim, sonuç, sorular ----------
/** İsteği gönderir. Dönüş: { kind: ok | question | error | uncertain | session, … }. Belirsiz istek gönderimden ÖNCE bekleyenlere yazılır. */
async function transmit(record) {
  bekleyenler.add(record);
  let res;
  try {
    res = await fetch(`${API}${record.url}${record.url.includes("?") ? "&" : "?"}company=${encodeURIComponent(record.company)}`, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "content-type": "application/json", "x-requested-with": "DestekOfisMobile", "x-hof-request": record.requestId },
      body: JSON.stringify(record.body),
    });
  } catch {
    ctx.serverState?.(false);
    renderPending();
    return { kind: "uncertain" };
  }
  ctx.serverState?.(true);
  let data = null;
  try {
    data = await res.json();
  } catch {
    renderPending();
    return { kind: "uncertain" };
  }
  if (res.ok && data?.ok) {
    bekleyenler.remove(record.requestId);
    renderPending();
    return { kind: "ok", data: data.data };
  }
  // Kesin ret: kayıt yazılmadı (reddedilen isteğin kimliği sunucuda hatırlanmaz) → bekleyenlerden çıkar.
  if (res.status === 401) {
    renderPending();
    return { kind: "session", message: data?.error || "Oturum sona erdi." };
  }
  bekleyenler.remove(record.requestId);
  renderPending();
  const flag = QUESTIONS[data?.code];
  if (res.status === 409 && flag && !(flag === "overpay" && !rights().avans)) return { kind: "question", flag, message: data?.error || "" };
  return { kind: "error", message: data?.error || "Kayıt yapılamadı.", code: data?.code || "" };
}
function handle(result, record, ui) {
  const { safe, toast } = ctx;
  if (result.kind === "ok") {
    const d = result.data || {};
    ui.close?.();
    toast(d.replayed ? "Bu işlem zaten kaydedilmişti; yeni kayıt açılmadı." : `${record.noun || "Kayıt"} kaydedildi${d.receiptNo ? ` (Makbuz No ${d.receiptNo})` : ""}.`);
    if (ctx.state.selected?.id === record.accountId) ctx.detail(record.kind, record.accountId);
    return;
  }
  if (result.kind === "session") {
    ui.close?.();
    toast(`${result.message} İşlem bekleyenlere alındı; girişten sonra yeniden gönderebilirsiniz.`, true);
    ctx.loggedOut?.();
    return;
  }
  if (result.kind === "uncertain") {
    if (!ui.show) return toast("Bağlantı koptu; işlem sonucu belirsiz. Sonucu Belirsiz İşlemler'den yeniden gönderin.", true);
    ui.show(`Bağlantı koptu; işlem kaydedilmiş olabilir. <strong>Yeniden Gönder</strong> aynı işlemi aynı kimlikle gönderir — ikinci kayıt açılmaz.`, "warn");
    return;
  }
  if (result.kind === "question") {
    if (!ui.show) return toast(result.message, true);
    ui.show(`${safe(result.message)}<div class="yz-question"><button type="button" class="btn primary" data-yz-confirm>${safe(CONFIRM_TEXT[result.flag])}</button></div>`, "warn");
    document.querySelector("[data-yz-confirm]")?.addEventListener("click", () => {
      ui.setFlag(result.flag);
      ui.resend();
    });
    return;
  }
  if (ui.show) ui.show(safe(result.message));
  else toast(result.message, true);
}

// ---------- Bekleyen (sonucu belirsiz) işlemler ----------
export function renderPending() {
  if (!ctx) return;
  let bar = document.getElementById("yz-pending");
  const list = bekleyenler.list();
  if (!list.length) return bar?.remove();
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "yz-pending";
    bar.className = "yz-pending";
    bar.setAttribute("role", "status");
    document.body.append(bar);
  }
  const { safe } = ctx;
  const now = Date.now();
  bar.innerHTML = `<strong>Sonucu Belirsiz İşlemler (${list.length})</strong>${list
    .map(item => {
      const fresh = yenidenGonderilebilir(item, now);
      return `<div class="yz-pending-row" data-request="${safe(item.requestId)}"><span>${safe(item.label)}</span>${fresh ? `<button type="button" class="btn primary" data-yz-resend="${safe(item.requestId)}">Yeniden Gönder</button>` : `<small>${RESEND_HOURS} saati geçti; yeniden gönderilmez. Cari hareketlerinden denetleyin, gerekirse yeni kayıt girin.</small>`}<button type="button" class="btn" data-yz-drop="${safe(item.requestId)}">Listeden Kaldır</button></div>`;
    })
    .join("")}`;
  bar.querySelectorAll("[data-yz-resend]").forEach(el =>
    el.addEventListener("click", async () => {
      const item = bekleyenler.get(el.dataset.yzResend);
      if (!item || !yenidenGonderilebilir(item, Date.now())) return renderPending();
      el.disabled = true;
      const result = await transmit(item);
      handle(result, item, {});
    }),
  );
  bar.querySelectorAll("[data-yz-drop]").forEach(el =>
    el.addEventListener("click", () => {
      bekleyenler.remove(el.dataset.yzDrop);
      renderPending();
    }),
  );
}
