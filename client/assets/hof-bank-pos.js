/* DestekOfis — POS (v2.2.0; docs/2.2.0-IS-LISTESI.md İz 3; docs/BANKA-MODULU-PLAN.md §4, §8.7, §8.9). Banka penceresine (hof-bank.js)
 * bağlanır; kurallar sunucuda (server/lib/bank/pos.mjs), ekran yalnız gösterir ve pasif düğmenin nedenini görünür yazar.
 *  - POS bankanın İÇİNDEN tanımlanır (müşteri madde 6, 12.10.2026): "POS Kullan" işaretli banka hesabının ayrıntısında "POS'lar" bölümü — liste,
 *    "+ POS Ekle" (ad, Üye İşyeri No, Terminal No, tür, sağlayıcı türü ve komisyon vergisi, KDV'li kipte sağlayıcı carisi, valör kuralı ve günü,
 *    bloke, provizyon süresi, taksitli ödeme biçimi, iadede komisyon, bankaya geçiş, sabit ücret) ve tarihli oran ızgarası (taksit × oran; yeni
 *    oran yeni tarihten), Düzenle, Oranlar, Pasife Al / Etkinleştir, Sil (kullanılmışsa nedeni yazılı), Bekleyenleri Yeni Hesaba Taşı.
 *  - "POS Tanımla" (İz 2.4 kuralı, registerDefine("pos")): tahsilat formu kapanmadan; hiç "POS Kullan" işaretli hesap yoksa önce hesap
 *    işaretlenir (ya da yeni hesap açılır). Yetkisi olmayana "POS tanımlı değil, yöneticinize başvurun."
 *  - POS sekmesi (§8.7): POS İşlemleri (süzgeç, İptal Et, İade), POS Ödeme Takvimi (net; Blokeli POS ve Komisyon Tahsili ayrı), Şimdi Aktar,
 *    Onay Bekleyen (Elle Onay kipi), Komisyon Faturaları (KDV'li kip: Faturası Beklenen, Taslak, Şimdi Oluştur, İade Alacağı), POS'lar.
 *  - Tahsilat formlarının POS alanı (HOF.bank.registerPosField; §8.9): POS (tekse bilgi satırı, çoksa seçim), POS Taksit Sayısı (yalnız tanımlı
 *    oranlar), Provizyon No, Kartın Son 4 Hanesi ve önizleme ("Komisyon %3,50 · Bankaya Geçecek 3.860,00 TL × 3 · İlk Valör 09.11.2026");
 *    POS İadesinde Asıl POS İşlemi önerisi ve "Kaynaksız (Eski Satış)". Fatura peşin satırı aynı kurucuları kullanır (HOF.bank.posCell*). */
(() => {
  "use strict";
  const HOF = window.HOF;
  if (!HOF?.bank) return;
  const { esc } = HOF;
  const BASE = "/api/workspace/bank";
  const api = (path, options) => HOF.api(`${BASE}${path}`, options);
  const bank = HOF.bank;

  const POS_KINDS = [
    ["physical", "Fiziki POS"],
    ["virtual", "Sanal POS"],
    ["mobile", "Mobil POS"],
  ];
  const PROVIDERS = [
    ["bank", "Banka"],
    ["payment_institution", "Ödeme Kuruluşu"],
  ];
  const TAXES = [
    ["bsmv_incl", "BSMV Dahil"],
    ["bsmv_excl", "BSMV Hariç"],
    ["vat_incl", "KDV Dahil (Faturalı)"],
    ["vat_excl", "KDV Hariç (Faturalı)"],
    ["none", "Yok"],
  ];
  const VALOR_RULES = [
    ["business", "İş Günü"],
    ["calendar", "Takvim Günü"],
    ["same_day", "Aynı Gün"],
  ];
  const PAYOUTS = [
    ["monthly", "Taksit Taksit (Her Ay, İlki 1 Ay Sonra)"],
    ["single", "Tek Seferde"],
    ["first_valor", "İlki Valör Gününde"],
  ];
  const REFUND_RULES = [
    ["none", "İade Edilmez"],
    ["proportional", "Oransal"],
    ["full", "Tam"],
  ];
  // "Ekstre ile" bankaya geçiş Ekstre ve Mutabakat ile gelir (2.3.0); bu sürümde seçenek yok (sunucu da 400 pos-settle-later).
  const SETTLE_MODES = [
    ["inherit", "Banka Ayarlarındaki Gibi"],
    ["auto", "Otomatik (Valör Gününde)"],
    ["manual", "Elle Onay"],
  ];
  const SALE_STATUSES = [
    ["active", "Etkin"],
    ["void", "İptal Edildi (Void)"],
    ["cancelled", "İptal İadesi Yapıldı"],
    ["", "Tümü"],
  ];
  const SALE_KINDS = [
    ["", "Satış ve İade"],
    ["sale", "POS Satışı"],
    ["refund", "POS İadesi"],
  ];
  const SUBS = [
    ["sales", "POS İşlemleri"],
    ["calendar", "POS Ödeme Takvimi"],
    ["awaiting", "Onay Bekleyen"],
    ["commission", "Komisyon Faturaları"],
    ["terminals", "POS'lar"],
  ];
  const SOURCELESS = "__sourceless";
  const labelOf = (list, value) => list.find(([id]) => id === value)?.[1] || value || "";
  const defaultTax = provider => (provider === "payment_institution" ? "vat_excl" : "bsmv_incl");
  const isVat = tax => tax === "vat_incl" || tax === "vat_excl";
  const installmentText = n => (Number(n) > 1 ? `${n} Taksit` : "Tek Çekim");
  const fmt = minor => HOF.formatMoney(Number(minor || 0) / 100);
  const dateText = iso => (iso ? HOF.formatDate(`${iso}T12:00:00`) : "—");
  const td = (label, html, cls = "") => `<td data-label="${esc(label)}"${cls ? ` class="${cls}"` : ""}>${html}</td>`;
  const writable = () => HOF.license?.writable !== false;
  const canPos = () => HOF.can("bank.pos") && writable();
  const canRates = () => HOF.can("bank.commission") && writable();
  const READ_ONLY_TEXT = "Program salt okunur çalışıyor (lisans); kayıt değiştirilemez.";
  const option = (value, label, current) => `<option value="${esc(value)}" ${String(value) === String(current ?? "") ? "selected" : ""}>${esc(label)}</option>`;
  const parseTl = value => {
    const text = String(value ?? "").trim().replace(/\s|₺|TL/gi, "");
    if (!text) return 0;
    const normal = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(\.\d{3})+$/.test(text) ? text.replace(/\./g, "") : text;
    const number = Number(normal);
    return Number.isFinite(number) ? number : 0;
  };
  const amountQuery = value => Number(value).toFixed(2).replace(".", ",");
  const valorText = pos => (pos.valorRule === "same_day" ? "Aynı Gün" : `${pos.valorDays} ${pos.valorRule === "calendar" ? "Takvim Günü" : "İş Günü"}`);
  const pct = rate => bank.pctText(rate);
  const ratesText = rates => (rates || []).map(rate => `${rate.label} %${pct(rate.rate)}`).join(" · ") || "Oran yok";

  // ---------- Durum ----------
  const state = {
    list: null,
    stats: null,
    sub: "sales",
    sales: null,
    salesFilter: { pos: "", kind: "", status: "active", from: "", to: "" },
    calendar: null,
    commission: null,
    month: "",
    error: "",
  };
  const posOf = id => (state.list || []).find(item => item.id === id) || null;
  async function loadList(options = {}) {
    const data = await api("/pos", options);
    state.list = data.pos || [];
    state.stats = data.stats || null;
  }
  const changed = () => {
    bank.choices?.(true).catch(() => null);
    HOF.emit("bank-changed");
  };

  // ---------- Hesap ayrıntısındaki "POS'lar" bölümü (İz 3.1) ----------
  bank.addReloadHook(async ({ mode, tab, options }) => {
    if (mode === "account" || (mode === "tab" && tab === "pos")) await loadList(options);
  });
  bank.addAccountSection("pos", account => sectionHtml(account));
  function terminalActions(pos) {
    const out = [];
    const blocks = [];
    if (!writable()) {
      blocks.push(READ_ONLY_TEXT);
      return { html: "", blocks };
    }
    if (canPos()) out.push(`<button type="button" class="hof-link-button" data-pos-act="edit" data-pos="${esc(pos.id)}">Düzenle</button>`);
    out.push(`<button type="button" class="hof-link-button" data-pos-act="rates" data-pos="${esc(pos.id)}">Oranlar</button>`);
    if (canPos()) {
      const activate = pos.status !== "active";
      const accountPassive = activate && pos.bankAccount && pos.bankAccount.status !== "active";
      out.push(`<button type="button" class="hof-link-button" data-pos-act="status" data-pos="${esc(pos.id)}" ${accountPassive ? 'disabled aria-disabled="true"' : ""}>${activate ? "Etkinleştir" : "Pasife Al"}</button>`);
      if (accountPassive) blocks.push(`${pos.name} · Etkinleştir kapalı: bağlı hesap pasif; önce Düzenle'den etkin bir hesap seçin.`);
      out.push(`<button type="button" class="hof-link-button hof-link-danger" data-pos-act="delete" data-pos="${esc(pos.id)}" ${pos.used ? 'disabled aria-disabled="true"' : ""}>Sil</button>`);
      if (pos.used) blocks.push(`${pos.name} · Sil kapalı: POS kullanılmış (satışı ya da hareketi var); kullanmayacaksanız Pasife Al.`);
      if (pos.pendingElsewhere?.count) out.push(`<button type="button" class="hof-link-button" data-pos-act="move" data-pos="${esc(pos.id)}">Bekleyenleri Yeni Hesaba Taşı</button>`);
    }
    return { html: out.join(" · "), blocks };
  }
  function terminalRows(list, { withAccount = false } = {}) {
    const blocks = [];
    const rows = list
      .map(pos => {
        const actions = terminalActions(pos);
        blocks.push(...actions.blocks);
        const elsewhere = pos.pendingElsewhere?.count ? `<small class="is-warn">${pos.pendingElsewhere.count} bekleyen satış önceki hesaba geçecek (${esc(fmt(pos.pendingElsewhere.netMinor))})</small>` : "";
        return `<tr data-pos-row="${esc(pos.id)}" class="${pos.status === "active" ? "" : "is-passive"}">
          ${td("POS", `<b>${esc(pos.name)}</b> <span class="hof-plan-refno">${esc(pos.code)}</span><small>${esc([pos.kindLabel, pos.merchantNo ? `Üye İşyeri ${pos.merchantNo}` : "", pos.terminalNo ? `Terminal ${pos.terminalNo}` : ""].filter(Boolean).join(" · "))}</small>`)}
          ${withAccount ? td("Bağlı Hesap", pos.bankAccount ? `<button type="button" class="hof-link-button" data-open-account="${esc(pos.bankAccount.id)}">${esc(pos.bankAccount.label)}</button>` : "—") : ""}
          ${td("Sağlayıcı ve Vergi", `${esc(pos.providerKindLabel)} · ${esc(pos.taxLabel)}${pos.providerAccount ? `<small>${esc(pos.providerAccount.name)}</small>` : ""}`)}
          ${td("Valör", `${esc(valorText(pos))}${pos.blockDays ? `<small>Bloke ${pos.blockDays} gün</small>` : ""}`)}
          ${td("Oranlar", `${esc(ratesText(pos.rates))}`)}
          ${td("Bekleyen (Net)", `${esc(fmt(pos.pending?.netMinor))}${elsewhere}`, "num")}
          ${td("Durum", pos.status === "active" ? '<span class="hof-plan-badge is-done">Etkin</span>' : '<span class="hof-plan-badge is-muted">Pasif</span>')}
          ${td("İşlemler", actions.html || "—")}
        </tr>`;
      })
      .join("");
    return { rows, blocks };
  }
  function sectionHtml(account) {
    const list = (state.list || []).filter(item => item.bankAccountId === account.id);
    const add = canPos() && account.status === "active" ? `<button type="button" class="hof-button hof-button-small" data-pos-act="add" data-account="${esc(account.id)}">+ POS Ekle</button>` : "";
    const why = !canPos() ? (writable() ? "POS eklemek için POS Tanımlama yetkisi gerekir." : READ_ONLY_TEXT) : account.status !== "active" ? "Hesap pasif; POS eklemek için önce hesabı Etkinleştir." : "";
    if (!state.list) return `<section class="hof-bank-linked" data-bank-pos="${esc(account.id)}"><div class="hof-bank-subhead"><h4 class="hof-bank-subtitle">POS'lar</h4>${add}</div><p class="hof-muted">Yükleniyor…</p></section>`;
    const { rows, blocks } = terminalRows(list);
    return `<section class="hof-bank-linked" data-bank-pos="${esc(account.id)}">
      <div class="hof-bank-subhead"><h4 class="hof-bank-subtitle">POS'lar</h4>${add}</div>
      ${why ? `<p class="hof-bank-define-missing">${esc(why)}</p>` : ""}
      ${rows ? `<div class="hof-bank-table-wrap"><table class="hof-table hof-bank-table hof-pos-table"><thead><tr><th>POS</th><th>Sağlayıcı ve Vergi</th><th>Valör</th><th>Oranlar</th><th class="num">Bekleyen (Net)</th><th>Durum</th><th>İşlemler</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="hof-muted">Bu hesaba bağlı POS yok.</p>'}
      ${blocks.length ? `<ul class="hof-inv-blocks" data-pos-blocks>${blocks.map(text => `<li>${esc(text)}</li>`).join("")}</ul>` : ""}
      <p class="hof-rep-note">POS tahsilatı satış anında bankaya geçmez; valör gününde komisyonu düşülmüş net tutar bu hesaba yazılır (POS Ödeme Takvimi). Yeni oran yeni tarihten geçerlidir; geçmiş satışların oranı değişmez.</p>
    </section>`;
  }

  // ---------- POS formu (aç / düzelt) ve oran ızgarası ----------
  const rateRowHtml = (rate = {}) => `<tr data-rate-row>
      <td data-label="Taksit"><select data-rate="installments" aria-label="Taksit Sayısı">${Array.from({ length: 12 }, (_, i) => i + 1).map(n => option(n, installmentText(n), rate.installments || 1)).join("")}</select></td>
      <td data-label="Oran (%)"><input type="text" inputmode="decimal" data-rate="rate" value="${esc(rate.rate || "")}" placeholder="ör. 2,5" aria-label="Komisyon Oranı (%)"></td>
      <td data-label="Valör Günü"><input type="text" inputmode="numeric" data-rate="valorDays" value="${esc(rate.valorDays ?? "")}" placeholder="POS'unki" aria-label="Valör Günü (isteğe bağlı)"></td>
      <td><button type="button" class="hof-mini hof-mini-danger" data-rate-remove aria-label="Satırı kaldır" title="Satırı kaldır">×</button></td>
    </tr>`;
  const ratesGridHtml = (rates, { title = "Komisyon Oranları", from = HOF.localToday() } = {}) => `<fieldset class="hof-bank-set hof-pos-rates" data-pos-rates>
      <legend>${esc(title)}</legend>
      <label class="hof-field"><span>Oranların Geçerlilik Başlangıcı</span><input type="date" data-rate-from value="${esc(from)}"></label>
      <div class="hof-bank-table-wrap"><table class="hof-table hof-bank-table"><thead><tr><th>Taksit</th><th>Oran (%)</th><th>Valör Günü (İsteğe Bağlı)</th><th></th></tr></thead><tbody data-rate-rows>${(rates.length ? rates : [{ installments: 1 }]).map(rateRowHtml).join("")}</tbody></table></div>
      <button type="button" class="hof-link-button" data-rate-add>+ Oran Satırı</button>
      <small>Her taksit sayısının bir oranı olur; satışta yalnız oranı tanımlı taksitler seçilir. Yeni oran yeni tarihten geçerlidir, geçmiş satışların oranı değişmez.</small>
    </fieldset>`;
  function wireRates(dialog) {
    dialog.addEventListener("click", event => {
      if (event.target.closest("[data-rate-add]")) {
        event.preventDefault();
        const body = dialog.querySelector("[data-rate-rows]");
        const used = new Set([...body.querySelectorAll('[data-rate="installments"]')].map(node => Number(node.value)));
        const next = Array.from({ length: 12 }, (_, i) => i + 1).find(n => !used.has(n)) || 1;
        body.insertAdjacentHTML("beforeend", rateRowHtml({ installments: next }));
        body.querySelector("[data-rate-row]:last-child [data-rate='rate']")?.focus();
      }
      const remove = event.target.closest("[data-rate-remove]");
      if (remove) {
        event.preventDefault();
        remove.closest("[data-rate-row]")?.remove();
      }
    });
  }
  // Boş satır yok sayılır; valör günü yazılmış ama oranı boş satır sessizce düşmez (hata: hangi taksitin oranı eksik).
  const readRates = dialog => {
    const rows = [...dialog.querySelectorAll("[data-rate-row]")].map(row => ({ installments: Number(row.querySelector('[data-rate="installments"]').value), rate: row.querySelector('[data-rate="rate"]').value.trim(), valorDays: row.querySelector('[data-rate="valorDays"]').value.trim() }));
    const missing = rows.find(rate => !rate.rate && rate.valorDays);
    if (missing) {
      const node = [...dialog.querySelectorAll("[data-rate-row]")][rows.indexOf(missing)]?.querySelector('[data-rate="rate"]');
      node?.classList.add("is-invalid");
      node?.focus();
      throw new Error(`${installmentText(missing.installments)} satırının oranını girin (valör günü yazılı, oran boş).`);
    }
    return rows.filter(rate => rate.rate).map(rate => ({ installments: rate.installments, rate: rate.rate, ...(rate.valorDays ? { valorDays: rate.valorDays } : {}) }));
  };
  async function flaggedAccounts() {
    const data = await bank.choices(true);
    const ids = new Set(data?.forms?.bank?.ids || []);
    return (data?.accounts || []).filter(account => ids.has(account.id) && account.usePos);
  }
  /** Banka Ayarları'ndaki POS varsayılanları (yeni POS formunun ön değerleri; sunucu da aynı varsayılanı uygular). */
  async function posDefaults() {
    try {
      const values = (await api("/settings")).values || {};
      return { valorRule: values.pos?.valorRule || "business", valorDays: values.pos?.valorDays ?? 1, taxMode: values.pos?.taxMode || "by_provider", refundCommission: values.pos?.refundCommission || "none", installmentPayout: values.posAdvanced?.installmentPayout || "monthly", blockDays: values.posAdvanced?.blockDays ?? 0, provisionDays: values.posAdvanced?.provisionDays ?? 0 };
    } catch {
      return { valorRule: "business", valorDays: 1, taxMode: "by_provider", refundCommission: "none", installmentPayout: "monthly", blockDays: 0, provisionDays: 0 };
    }
  }
  const FIELD_OF = { name: "name", bankAccountId: "bankAccountId", kind: "kind", providerKind: "providerKind", tax: "tax", providerAccountId: "providerAccountId", valorRule: "valorRule", valorDays: "valorDays", provisionDays: "provisionDays", blockDays: "blockDays", installmentPayout: "installmentPayout", refundCommission: "refundCommission", settleMode: "settleMode", code: "code" };
  function markField(form, error) {
    const field = FIELD_OF[error?.data?.field];
    const node = field ? form?.querySelector(`[name="${field}"]`) : null;
    if (node) {
      node.classList.add("is-invalid");
      node.focus?.();
    }
  }
  /**
   * POS formu: pos (düzelt) ya da yeni (accountId: ön seçili "POS Kullan" işaretli hesap). inline: tahsilat formundan "POS Tanımla" (sayfa
   * değişmez). Dönüş: söz (kaydedilen POS ya da null).
   */
  async function posForm({ pos = null, accountId = "", inline = false } = {}) {
    if (!canPos()) {
      HOF.toast(writable() ? "POS tanımlama POS Tanımlama yetkisi ister." : READ_ONLY_TEXT, { type: "error" });
      return null;
    }
    const edit = Boolean(pos);
    let accounts = [];
    try {
      accounts = await flaggedAccounts();
    } catch (error) {
      HOF.toastError(error);
      return null;
    }
    if (edit && pos.bankAccount && !accounts.some(account => account.id === pos.bankAccountId)) accounts = [{ id: pos.bankAccountId, label: pos.bankAccount.label, code: pos.bankAccount.code || "" }, ...accounts];
    if (!accounts.length) {
      HOF.toast("“POS Kullan” işaretli banka hesabı yok. Hesaplar → hesap → Düzenle'de “POS Kullan”ı işaretleyin.", { type: "error" });
      return null;
    }
    const d = edit ? null : await posDefaults();
    const provider = edit ? pos.providerKind : "bank";
    const tax = edit ? pos.tax : d.taxMode && d.taxMode !== "by_provider" ? d.taxMode : defaultTax(provider);
    const requestId = HOF.requestId();
    const ratesOk = !edit && canRates();
    let formNode = null;
    let saved = null;
    let taxTouched = edit;
    const fields = [
      { name: "name", label: "POS Adı", required: true, autofocus: true, value: pos?.name || "", maxlength: 80, placeholder: "ör. Ziraat Fiziki POS" },
      { name: "bankAccountId", label: "Bağlı Banka Hesabı", type: "select", required: true, value: pos?.bankAccountId || accountId || (accounts.length === 1 ? accounts[0].id : ""), options: [...(accounts.length > 1 ? [{ value: "", label: "Hesap Seçin" }] : []), ...accounts.map(account => ({ value: account.id, label: `${account.label}${account.code ? ` (${account.code})` : ""}` }))], help: "POS'un parası bu hesaba geçer. Yalnız “POS Kullan” işaretli hesaplar listelenir." },
      { name: "kind", label: "POS Türü", type: "select", value: pos?.kind || "physical", options: POS_KINDS.map(([value, label]) => ({ value, label })) },
      { name: "merchantNo", label: "Üye İşyeri No", value: pos?.merchantNo || "", maxlength: 40 },
      { name: "terminalNo", label: "Terminal No", value: pos?.terminalNo || "", maxlength: 40 },
      { name: "providerKind", label: "Sağlayıcı Türü", type: "select", value: provider, options: PROVIDERS.map(([value, label]) => ({ value, label })) },
      { name: "tax", label: "Komisyon Vergisi", type: "select", value: tax, options: TAXES.map(([value, label]) => ({ value, label })), help: "Banka POS'unda BSMV oranın içindedir; ödeme kuruluşu komisyonu KDV'li faturayla keser (Sağlayıcı Carisi gerekir)." },
      { name: "valorRule", label: "Valör Kuralı", type: "select", value: pos?.valorRule || d.valorRule, options: VALOR_RULES.map(([value, label]) => ({ value, label })) },
      { name: "valorDays", label: "Valör Günü", type: "number", min: 0, max: 60, value: pos?.valorDays ?? d.valorDays, help: "Satıştan kaç gün sonra bankaya geçer (oran satırında ayrıca verilebilir)." },
      { name: "installmentPayout", label: "Taksitli Satışta Ödeme", type: "select", value: pos?.installmentPayout || d.installmentPayout, options: PAYOUTS.map(([value, label]) => ({ value, label })) },
      { name: "blockDays", label: "Bloke Süresi (Gün)", type: "number", min: 0, max: 365, value: pos?.blockDays ?? d.blockDays, help: "Blokeli POS'ta para en erken bu kadar gün sonra geçer; raporda Blokeli POS ayrı görünür." },
      { name: "provisionDays", label: "Provizyon Süresi (Gün)", type: "number", min: 0, max: 30, value: pos?.provisionDays ?? d.provisionDays, help: "Bu süre içinde ve bankaya geçmeden yapılan iptal komisyonsuzdur; 0: aynı gün." },
      { name: "refundCommission", label: "İadede Komisyon", type: "select", value: pos?.refundCommission || d.refundCommission, options: REFUND_RULES.map(([value, label]) => ({ value, label })) },
      { name: "settleMode", label: "Bankaya Geçiş", type: "select", value: pos?.settleMode && pos.settleMode !== "statement" ? pos.settleMode : "inherit", options: SETTLE_MODES.map(([value, label]) => ({ value, label })), help: "Elle Onay'da valörü gelen tutar Banka → POS → Onay Bekleyen'de onaylanınca bankaya yazılır." },
      { name: "fixedFee", label: "Sabit İşlem Ücreti", value: pos?.fixedFeeMinor ? HOF.formatMoney(pos.fixedFeeMinor / 100).replace(/\s*₺|\s*TL/g, "") : "", inputmode: "decimal", placeholder: "0,00" },
      ...(edit ? [] : [{ name: "code", label: "POS Kodu", value: "", maxlength: 30, placeholder: "Boş bırakılırsa önerilir (ör. POS-01)" }]),
      { name: "description", label: "Açıklama", value: pos?.description || "", maxlength: 300 },
    ];
    return new Promise(resolve => {
      HOF.formModal({
        title: edit ? "POS'u Düzenle" : inline ? "POS Tanımla" : "POS Ekle",
        eyebrow: (HOF.uiLabel?.("side.bank", "Banka") || "Banka").toLocaleUpperCase("tr-TR"),
        size: "wide",
        intro: edit
          ? "POS'un bilgileri ve kuralları bundan sonraki tahsilatlara uygulanır; geçmiş satışlar kendi kopyalarıyla kalır. Oranlar “Oranlar”dan, yeni tarihten girilir."
          : `POS, parasının geçtiği banka hesabının altında tanımlanır. Oranları taksit sayısıyla girin (Tek Çekim, 3 Taksit…).${inline ? " Kaydedince POS, açık formunuzda seçili gelir; girdiğiniz bilgiler kaybolmaz." : ""}`,
        fields,
        extraHtml: ratesOk ? ratesGridHtml([{ installments: 1 }]) : edit ? "" : '<p class="hof-rep-note">Komisyon oranlarını Komisyon Oranlarını Değiştirme yetkisi olan kişi “Oranlar”dan girer; oranı girilmeyen taksitle tahsilat yapılamaz.</p>',
        submitLabel: edit ? "Kaydet" : "POS'u Ekle",
        onClose: () => resolve(saved),
        onOpen: dialog => {
          formNode = dialog.querySelector("form");
          formNode.classList.add("hof-bank-form");
          if (ratesOk) wireRates(dialog);
          const providerNode = formNode.querySelector('[name="providerKind"]');
          const taxNode = formNode.querySelector('[name="tax"]');
          // Sağlayıcı Carisi (KDV'li kipte zorunlu): cari seçici (tedarikçiler üstte; + Yeni Cari).
          const picker = HOF.accounts?.picker?.({ value: pos?.providerAccount ? { id: pos.providerAccount.id, name: pos.providerAccount.name } : {}, label: "Sağlayıcı Carisi", prefer: "supplier", allowNew: true, name: "providerAccountId", help: "Komisyon faturasını kesen ödeme kuruluşu (KDV'li kipte zorunlu)." });
          if (picker) taxNode.closest(".hof-field").after(picker);
          const sync = () => {
            if (!taxTouched) taxNode.value = defaultTax(providerNode.value);
            if (picker) picker.hidden = !isVat(taxNode.value);
          };
          providerNode.addEventListener("change", sync);
          taxNode.addEventListener("change", () => {
            taxTouched = true;
            sync();
          });
          sync();
        },
        onSubmit: async data => {
          formNode.querySelectorAll(".is-invalid").forEach(node => node.classList.remove("is-invalid"));
          const body = {
            name: data.name, bankAccountId: data.bankAccountId, kind: data.kind, merchantNo: data.merchantNo, terminalNo: data.terminalNo, providerKind: data.providerKind, tax: data.tax,
            providerAccountId: isVat(data.tax) ? data.providerAccountId || "" : "", valorRule: data.valorRule, valorDays: data.valorDays, installmentPayout: data.installmentPayout, blockDays: data.blockDays,
            provisionDays: data.provisionDays, refundCommission: data.refundCommission, settleMode: data.settleMode, fixedFee: data.fixedFee, description: data.description,
          };
          try {
            if (edit) {
              saved = await api(`/pos/${encodeURIComponent(pos.id)}`, { method: "PUT", body });
              HOF.toast("POS güncellendi.", { type: "success" });
            } else {
              const rates = ratesOk ? readRates(formNode.closest(".hof-modal") || formNode) : [];
              const from = (formNode.closest(".hof-modal") || formNode).querySelector("[data-rate-from]")?.value || "";
              const result = await api("/pos", { method: "POST", body: { ...body, code: data.code, ...(rates.length ? { rates, validFrom: from } : {}) }, requestId });
              saved = result.pos;
              HOF.toast(result.replayed ? "Bu POS zaten eklenmişti." : `${saved?.name || "POS"} eklendi (${saved?.code} · ${saved?.glSub}).`, { type: "success" });
            }
            changed();
            await bank.reloadView();
          } catch (error) {
            markField(formNode, error);
            throw error;
          }
        },
      });
    });
  }
  /** Oranlar: bugün geçerli oranlar, geçmiş ve yeni tarihten oran ızgarası (Komisyon Oranlarını Değiştirme yetkisi). */
  async function ratesForm(id) {
    let detail;
    try {
      detail = await api(`/pos/${encodeURIComponent(id)}`);
    } catch (error) {
      return HOF.toastError(error);
    }
    const history = (detail.rateHistory || []).map(rate => `<tr>${td("Geçerlilik", esc(dateText(rate.validFrom)))}${td("Taksit", esc(rate.label))}${td("Oran", `%${esc(pct(rate.rate))}`, "num")}${td("Valör Günü", rate.valorDays === null || rate.valorDays === undefined ? "POS'unki" : esc(String(rate.valorDays)))}</tr>`).join("");
    const intro = `${detail.name}: bugün geçerli oranlar ${ratesText(detail.rates)}. Yeni oran seçtiğiniz tarihten geçerli olur; o tarihten önceki satışlar eski oranla kalır.`;
    const historyHtml = `<h4 class="hof-bank-subtitle">Oran Geçmişi</h4>${history ? `<div class="hof-bank-table-wrap"><table class="hof-table hof-bank-table"><thead><tr><th>Geçerlilik</th><th>Taksit</th><th class="num">Oran</th><th>Valör Günü</th></tr></thead><tbody>${history}</tbody></table></div>` : '<p class="hof-muted">Oran girilmemiş.</p>'}`;
    if (!canRates()) {
      HOF.modal({ title: "Komisyon Oranları", eyebrow: detail.name.toLocaleUpperCase("tr-TR"), size: "wide", body: `<p class="hof-modal-text">${esc(intro)}</p>${historyHtml}<p class="hof-bank-define-missing">${esc(writable() ? "Oranları Komisyon Oranlarını Değiştirme yetkisi olan kişi değiştirir." : READ_ONLY_TEXT)}</p>` });
      return;
    }
    let formNode = null;
    HOF.formModal({
      title: "Komisyon Oranları",
      eyebrow: detail.name.toLocaleUpperCase("tr-TR"),
      size: "wide",
      intro,
      fields: [],
      extraHtml: `${ratesGridHtml((detail.rates || []).map(rate => ({ installments: rate.installments, rate: rate.rate, valorDays: rate.valorDays })), { title: "Yeni Oranlar" })}${historyHtml}`,
      submitLabel: "Oranları Kaydet",
      onOpen: dialog => {
        formNode = dialog.querySelector("form");
        wireRates(dialog);
      },
      onSubmit: async () => {
        const scope = formNode.closest(".hof-modal") || formNode;
        const rates = readRates(scope);
        if (!rates.length) throw new Error("En az bir oran satırı girin.");
        await api(`/pos/${encodeURIComponent(id)}/rates`, { method: "POST", body: { validFrom: scope.querySelector("[data-rate-from]")?.value || "", rates } });
        HOF.toast("Yeni oranlar kaydedildi.", { type: "success" });
        changed();
        await bank.reloadView();
      },
    });
  }
  async function toggleStatus(pos) {
    const next = pos.status === "active" ? "passive" : "active";
    if (next === "passive") {
      const go = await HOF.confirm({ title: "POS'u Pasife Al", message: `${pos.name} pasife alınsın mı? Pasif POS'a yeni tahsilat girilmez; bekleyen tutarlar valör gününde bankaya geçmeye devam eder.`, confirmLabel: "Pasife Al" });
      if (!go) return;
    }
    try {
      await api(`/pos/${encodeURIComponent(pos.id)}/status`, { method: "POST", body: { status: next } });
      HOF.toast(next === "active" ? `${pos.name} etkinleştirildi.` : `${pos.name} pasife alındı.`, { type: "success" });
      changed();
      await bank.reloadView();
    } catch (error) {
      HOF.toastError(error);
    }
  }
  async function removePos(pos) {
    const go = await HOF.confirm({ title: "POS'u Sil", message: `${pos.name} silinsin mi? Yalnız hiç kullanılmamış POS silinir.`, confirmLabel: "Sil", danger: true });
    if (!go) return;
    try {
      await api(`/pos/${encodeURIComponent(pos.id)}`, { method: "DELETE" });
      HOF.toast(`${pos.name} silindi.`, { type: "success" });
      changed();
      await bank.reloadView();
    } catch (error) {
      HOF.toastError(error);
    }
  }
  async function movePending(pos) {
    let accounts = [];
    try {
      accounts = await flaggedAccounts();
    } catch (error) {
      return HOF.toastError(error);
    }
    HOF.formModal({
      title: "Bekleyenleri Yeni Hesaba Taşı",
      eyebrow: pos.name.toLocaleUpperCase("tr-TR"),
      intro: `${pos.pendingElsewhere?.count || 0} bekleyen POS satışı önceki bağlı hesaba geçecek (${fmt(pos.pendingElsewhere?.netMinor)}). Taşınınca valör gününde seçtiğiniz hesaba geçer; bankaya geçmiş tutarlar değişmez.`,
      fields: [{ name: "bankAccountId", label: "Taşınacak Hesap", type: "select", required: true, value: pos.bankAccountId, options: accounts.map(account => ({ value: account.id, label: `${account.label}${account.code ? ` (${account.code})` : ""}` })) }],
      submitLabel: "Taşı",
      onSubmit: async data => {
        const result = await api(`/pos/${encodeURIComponent(pos.id)}/move-pending`, { method: "POST", body: { bankAccountId: data.bankAccountId } });
        HOF.toast(`${result.moved} bekleyen satış taşındı.`, { type: "success" });
        changed();
        await bank.reloadView();
      },
    });
  }

  // ---------- "POS Tanımla" (İz 2.4 kuralı; tahsilat formu kapanmadan) ----------
  async function definePos() {
    let flagged;
    try {
      flagged = await flaggedAccounts();
    } catch (error) {
      HOF.toastError(error);
      return null;
    }
    let accountId = flagged.length === 1 ? flagged[0].id : "";
    if (!flagged.length) {
      const account = await bank.flagDefine("usePos", { title: "POS Tanımla", intro: "POS'un parasının geçtiği banka hesabını seçin; hesapta “POS Kullan” işaretlenir ve POS o hesabın altında tanımlanır. Hesap tanımlı değilse “+ Yeni Banka Hesabı”.", submit: "POS Kullan'ı İşaretle" });
      if (!account?.id) return null;
      accountId = account.id;
    }
    return posForm({ accountId, inline: true });
  }
  bank.registerDefine("pos", { button: "POS Tanımla", missing: "POS tanımlı değil, yöneticinize başvurun.", permission: "bank.pos", hint: "Tanımlamadan kaydederseniz kartla tahsilat Hesabı Atanmamış Eski Hareketler'de (POS / Kart) kalır.", open: definePos });

  // ---------- POS sekmesi (§8.7) ----------
  bank.addTab("pos", { label: "POS", visible: () => HOF.can("bank.view"), html: tabHtml, load: loadTab });
  // POS listesi yenileme kancasında (yukarıda) yüklenir; sekme yalnız açık alt bölümün verisini yükler.
  async function loadTab({ options = {} } = {}) {
    if (state.sub === "sales") {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(state.salesFilter)) if (value) query.set(key, value);
      state.sales = (await api(`/pos/sales?${query}`, options)).sales || [];
    } else if (state.sub === "calendar" || state.sub === "awaiting") {
      state.calendar = await api("/pos/calendar", options);
    } else if (state.sub === "commission") {
      state.month ||= HOF.localToday().slice(0, 7);
      state.commission = await api(`/pos/commission-invoices?month=${encodeURIComponent(state.month)}`, options);
    }
  }
  const reloadTab = () => bank.reloadView();
  function statsLine() {
    const s = state.stats;
    if (!s) return "";
    const parts = [`POS Bekleyen (Net) <b>${esc(fmt(s.netMinor))}</b>`];
    if (s.blockedMinor) parts.push(`Blokeli POS <b>${esc(fmt(s.blockedMinor))}</b>`);
    if (s.feeMinor) parts.push(`Komisyon Tahsili Bekleyen <b>${esc(fmt(s.feeMinor))}</b>`);
    if (s.due?.count) parts.push(`<span class="is-warn" data-pos-due>Valörü Gelmiş, Aktarılmadı: ${s.due.count} kalem, ${esc(fmt(s.due.netMinor))}</span>`);
    if (s.awaiting?.count) parts.push(`Onay Bekleyen: ${s.awaiting.count} kalem`);
    if (s.errors) parts.push(`<span class="is-warn">Aktarılamayan: ${s.errors} kalem</span>`);
    return `<p class="hof-rep-note hof-pos-stats" data-pos-stats>${parts.join(" · ")}</p>`;
  }
  function tabHtml() {
    if (!state.list) return HOF.listPending(state.error);
    const add = canPos() ? '<button type="button" class="hof-button hof-button-small" data-pos-act="add">+ POS Ekle</button>' : "";
    if (!state.list.length) {
      return `<div class="hof-bank-toolbar">${add}</div>
        <p class="hof-empty">POS tanımlı değil.</p>
        <p class="hof-rep-note">POS, parasının geçtiği banka hesabının içinden tanımlanır: Hesaplar → hesap → Düzenle'de “POS Kullan”ı işaretleyin, sonra hesabın ayrıntısında “+ POS Ekle”. ${canPos() ? "" : esc(writable() ? "POS tanımlama POS Tanımlama yetkisi ister." : READ_ONLY_TEXT)}</p>`;
    }
    const settle = HOF.can("bank.move") && writable() ? `<button type="button" class="hof-button hof-button-small hof-button-ghost" data-pos-act="settle" ${state.stats?.due?.count ? "" : 'disabled aria-disabled="true"'}>Şimdi Aktar</button>` : "";
    const chips = `<div class="hof-rep-presets" role="group" aria-label="POS bölümleri">${SUBS.map(([id, label]) => `<button type="button" class="hof-rep-chip ${state.sub === id ? "is-on" : ""}" aria-pressed="${state.sub === id}" data-pos-sub="${id}">${esc(label)}${id === "awaiting" && state.stats?.awaiting?.count ? ` (${state.stats.awaiting.count})` : ""}</button>`).join("")}</div>`;
    const body = state.sub === "calendar" ? calendarHtml() : state.sub === "awaiting" ? awaitingHtml() : state.sub === "commission" ? commissionHtml() : state.sub === "terminals" ? terminalsHtml() : salesHtml();
    const settleWhy = settle && !state.stats?.due?.count ? '<small class="hof-bank-pick-note" data-pos-settle-why>Şimdi Aktar: valörü gelmiş, aktarılmamış kalem yok.</small>' : "";
    return `<div class="hof-bank-toolbar">${add}${settle}${chips}</div>${settleWhy}${statsLine()}<div class="hof-pos-body" data-pos-body>${body}</div>`;
  }
  // POS İşlemleri: İptal Et'in ve İade'nin pasif nedeni (düğmenin yanında görünür).
  function voidWhy(sale) {
    if (!writable()) return READ_ONLY_TEXT;
    if (!HOF.can("bank.cancel")) return "İptal için Banka Hareketi Silme, İptal ve Ters Kayıt yetkisi gerekir.";
    if (!sale.voidable) return sale.voidReason || "İptal edilemez.";
    if (sale.invoice) return "Faturadan iptal edilir: faturayı İptal Et → “Müşteriye İade Edildi”.";
    if (sale.source && sale.source !== "account_entries") return "Kendi bölümünden (kayıt, taksit ya da stok) silinerek iptal edilir.";
    return "";
  }
  function refundWhy(sale) {
    if (!writable()) return READ_ONLY_TEXT;
    if (!HOF.can("accounts.manage")) return "POS İadesi için cari yönetimi yetkisi gerekir.";
    if (!sale.party) return "Carisi olmayan (kayıt) tahsilatın iadesi kendi bölümünden girilir.";
    if (sale.grossMinor - sale.refundedMinor <= 0) return "Satışın tamamı iade edildi.";
    return "";
  }
  function salesHtml() {
    const f = state.salesFilter;
    const filter = (label, control) => `<label class="hof-bank-filter"><span>${esc(label)}</span>${control}</label>`;
    const filters = `<div class="hof-bank-filters" data-pos-filters>
      ${filter("POS", `<select data-pos-filter="pos">${option("", "Tüm POS'lar", f.pos)}${(state.list || []).map(item => option(item.id, `${item.name} (${item.code})`, f.pos)).join("")}</select>`)}
      ${filter("Tür", `<select data-pos-filter="kind">${SALE_KINDS.map(([value, label]) => option(value, label, f.kind)).join("")}</select>`)}
      ${filter("Durum", `<select data-pos-filter="status">${SALE_STATUSES.map(([value, label]) => option(value, label, f.status)).join("")}</select>`)}
      ${filter("Başlangıç", `<input type="date" data-pos-filter="from" value="${esc(f.from)}">`)}
      ${filter("Bitiş", `<input type="date" data-pos-filter="to" value="${esc(f.to)}">`)}
    </div>`;
    if (!state.sales) return `${filters}${HOF.listPending("")}`;
    const rows = state.sales
      .map(sale => {
        const actions = [];
        if (sale.kind === "sale" && sale.status === "active") {
          const vWhy = voidWhy(sale);
          const rWhy = refundWhy(sale);
          actions.push(`<button type="button" class="hof-link-button hof-link-danger" data-pos-act="void" data-sale="${esc(sale.id)}" ${vWhy ? 'disabled aria-disabled="true"' : ""}>İptal Et</button>${vWhy ? `<small class="hof-pos-why" data-pos-why="void">${esc(vWhy)}</small>` : ""}`);
          actions.push(`<button type="button" class="hof-link-button" data-pos-act="refund" data-sale="${esc(sale.id)}" ${rWhy ? 'disabled aria-disabled="true"' : ""}>İade</button>${rWhy ? `<small class="hof-pos-why" data-pos-why="refund">${esc(rWhy)}</small>` : ""}`);
        }
        return `<tr data-pos-sale="${esc(sale.id)}" class="${sale.status === "active" ? "" : "is-passive"}">
          ${td("Tarih", esc(dateText(sale.date)))}
          ${td("İşlem No", sale.eventNo ? `<button type="button" class="hof-link-button" data-event-link="${esc(sale.eventNo)}">${esc(sale.eventNo)}</button>` : "—")}
          ${td("POS", esc(sale.posName))}
          ${td("Cari ve Belge", `${sale.party ? `<button type="button" class="hof-link-button" data-open-party="${esc(sale.party.id)}">${esc(sale.party.name)}</button>` : "—"}${sale.invoice ? `<small><button type="button" class="hof-link-button" data-open-invoice="${esc(sale.invoice.id)}">${esc(sale.invoice.number || "Fatura")}</button></small>` : ""}${sale.origin ? `<small>Asıl: ${esc(sale.origin.eventNo || dateText(sale.origin.date))}</small>` : ""}`)}
          ${td("Tür", `${esc(sale.kindLabel)}${sale.kind === "sale" ? `<small>${esc(sale.installmentLabel)}${sale.authCode ? ` · Prov. ${esc(sale.authCode)}` : ""}${sale.cardLast4 ? ` · •••• ${esc(sale.cardLast4)}` : ""}</small>` : ""}`)}
          ${td("Brüt", esc(fmt(sale.grossMinor)), "num")}
          ${td("Komisyon", esc(fmt(sale.kind === "sale" ? sale.commissionMinor : -sale.commissionRefundMinor)), "num")}
          ${td("Net", esc(fmt(sale.netMinor)), "num")}
          ${td("İade Edilen", sale.kind === "sale" && sale.refundedMinor ? esc(fmt(sale.refundedMinor)) : "—", "num")}
          ${td("Durum", `${esc(sale.statusLabel)}${sale.explain ? `<small>Valör ${esc(sale.explain)}</small>` : ""}`)}
          ${td("İşlemler", actions.join(" ") || "—", "hof-pos-actions")}
        </tr>`;
      })
      .join("");
    return `${filters}<div class="hof-bank-table-wrap"><table class="hof-table hof-bank-table hof-pos-sales"><thead><tr><th>Tarih</th><th>İşlem No</th><th>POS</th><th>Cari ve Belge</th><th>Tür</th><th class="num">Brüt</th><th class="num">Komisyon</th><th class="num">Net</th><th class="num">İade Edilen</th><th>Durum</th><th>İşlemler</th></tr></thead><tbody>${rows || '<tr><td colspan="11" class="hof-empty">Bu süzgeçte POS işlemi yok.</td></tr>'}</tbody></table></div>
      <p class="hof-rep-note">İptal Et (void) yalnız provizyon süresi içinde ve bankaya geçmeden yapılır; komisyon doğmaz. Sonrasında müşteriye geri ödeme “İade” (POS İadesi) ile girilir.</p>`;
  }
  const calendarTiles = totals => `<div class="hof-rep-stats hof-bank-stats" data-pos-totals>
      <div class="hof-rep-stat"><span>POS Bekleyen (Net)</span><strong>${esc(fmt(totals.netMinor))}</strong></div>
      <div class="hof-rep-stat"><span>Blokeli POS</span><strong>${esc(fmt(totals.blockedMinor))}</strong></div>
      <div class="hof-rep-stat"><span>Komisyon Tahsili</span><strong>${esc(fmt(totals.feeMinor))}</strong></div>
      <div class="hof-rep-stat"><span>Toplam (Net)</span><strong>${esc(fmt(totals.totalMinor))}</strong></div>
    </div>`;
  const calendarState = row => (row.error ? `Aktarılamadı: ${row.error}` : row.awaiting ? "Onay Bekliyor" : row.due ? "Valörü Geldi" : "Bekliyor");
  function calendarHtml() {
    const data = state.calendar;
    if (!data) return HOF.listPending("");
    const rows = data.rows
      .map(
        row => `<tr data-pos-day="${esc(row.valueDate)}">
          ${td("Valör Günü", esc(dateText(row.valueDate)))}
          ${td("POS", esc(row.posName))}
          ${td("Tür", esc(row.kindLabel))}
          ${td("Kalem", esc(String(row.count)), "num")}
          ${td("Brüt", esc(fmt(row.grossMinor)), "num")}
          ${td("Net (Bankaya Geçecek)", `<b class="${row.netMinor < 0 ? "hof-cash-out" : ""}">${esc(fmt(row.netMinor))}</b>`, "num")}
          ${td("Durum", esc(calendarState(row)))}
        </tr>`,
      )
      .join("");
    return `${calendarTiles(data.totals)}<div class="hof-bank-table-wrap"><table class="hof-table hof-bank-table hof-pos-calendar"><thead><tr><th>Valör Günü</th><th>POS</th><th>Tür</th><th class="num">Kalem</th><th class="num">Brüt</th><th class="num">Net (Bankaya Geçecek)</th><th>Durum</th></tr></thead><tbody>${rows || '<tr><td colspan="7" class="hof-empty">Bankaya geçmeyi bekleyen POS tahsilatı yok.</td></tr>'}</tbody></table></div>
      <p class="hof-rep-note">Net, komisyon ve vergi düşülmüş tutardır. Blokeli POS ve Komisyon Tahsili (iade sonrası bankadan çekilecek komisyon) ayrı satırdır. Valör günü gelince otomatik aktarılır; “Şimdi Aktar” beklemeden yazar.</p>`;
  }
  function awaitingHtml() {
    const data = state.calendar;
    if (!data) return HOF.listPending("");
    const canConfirm = HOF.can("bank.reconcile") && writable();
    const rows = data.rows
      .filter(row => row.awaiting)
      .map(
        row => `<tr>
          ${td("Valör Günü", esc(dateText(row.valueDate)))}
          ${td("POS", esc(row.posName))}
          ${td("Kalem", esc(String(row.count)), "num")}
          ${td("Planlanan Net", esc(fmt(row.netMinor)), "num")}
          ${td("İşlem", canConfirm ? `<button type="button" class="hof-button hof-button-small" data-pos-act="confirm" data-pos="${esc(row.posId)}" data-day="${esc(row.valueDate)}" data-net="${esc(String(row.netMinor))}">Onayla</button>` : `<small class="hof-pos-why">${esc(writable() ? "Onay için Mutabakat Yapma yetkisi gerekir." : READ_ONLY_TEXT)}</small>`)}
        </tr>`,
      )
      .join("");
    return `<div class="hof-bank-table-wrap"><table class="hof-table hof-bank-table"><thead><tr><th>Valör Günü</th><th>POS</th><th class="num">Kalem</th><th class="num">Planlanan Net</th><th>İşlem</th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="hof-empty">Onay bekleyen geçiş yok.</td></tr>'}</tbody></table></div>
      <p class="hof-rep-note">Bankaya Geçiş “Elle Onay” olan POS'ta valörü gelen tutar burada bekler. Onayda bankaya gerçekten geçen tarih ve net tutar girilir; planlanandan fark BSMV'li ve vergisiz kipte komisyona (653), KDV'li kipte sağlayıcı carisine “Komisyon Farkı” olarak yazılır.</p>`;
  }
  function commissionHtml() {
    const data = state.commission;
    const canCreate = HOF.can("bank.commission") && HOF.can("invoices.manage") && writable();
    const vatPos = (state.list || []).filter(item => isVat(item.tax));
    const head = `<div class="hof-bank-filters"><label class="hof-bank-filter"><span>Ay</span><input type="month" data-pos-month value="${esc(state.month || HOF.localToday().slice(0, 7))}"></label>
      ${canCreate ? '<button type="button" class="hof-button hof-button-small" data-pos-act="drafts">Şimdi Oluştur</button>' : `<small class="hof-pos-why">${esc(writable() ? "Taslak oluşturmak için Komisyon Oranlarını Değiştirme ve Fatura Yönetimi yetkisi gerekir." : READ_ONLY_TEXT)}</small>`}</div>`;
    if (!vatPos.length) return `${head}<p class="hof-rep-note">KDV'li (faturalı) komisyon kipinde POS yok. Banka POS'unda komisyon BSMV'lidir ve valör gününde 653 Komisyon Giderleri'ne yazılır; komisyon faturası beklenmez.</p>`;
    if (!data) return `${head}${HOF.listPending("")}`;
    const rows = (data.rows || [])
      .map(
        row => `<tr>
          ${td("POS", esc(row.posName))}
          ${td("Sağlayıcı", esc(row.providerName))}
          ${td("Kesinti", esc(fmt(row.outMinor)), "num")}
          ${td("Komisyon İadesi", esc(fmt(row.inMinor)), "num")}
          ${td("Net", esc(fmt(row.netMinor)), "num")}
          ${td("Durum", `<span class="hof-plan-badge ${row.state === "refund-credit" ? "is-soon" : row.state === "draft" ? "is-info" : "is-muted"}">${esc(row.stateLabel)}</span>`)}
          ${td("Fatura", row.invoice ? `<button type="button" class="hof-link-button" data-open-invoice="${esc(row.invoice.id)}">${esc(row.invoice.number || "Taslak")}</button>` : "—")}
        </tr>`,
      )
      .join("");
    const linked = (data.linked || [])
      .map(
        row => `<tr>
          ${td("Fatura", row.invoice ? `<button type="button" class="hof-link-button" data-open-invoice="${esc(row.invoice.id)}">${esc(row.invoice.number)}</button>` : "—")}
          ${td("POS", esc(row.posName))}
          ${td("Bağlı Kesinti", esc(fmt(row.linkedMinor)), "num")}
          ${td("Fatura Tutarı", esc(fmt(row.payableMinor)), "num")}
          ${td("Fark", `<b class="${row.differenceMinor ? "hof-cash-out" : ""}">${esc(fmt(row.differenceMinor))}</b>`, "num")}
        </tr>`,
      )
      .join("");
    return `${head}<div class="hof-bank-table-wrap"><table class="hof-table hof-bank-table hof-pos-commission"><thead><tr><th>POS</th><th>Sağlayıcı</th><th class="num">Kesinti</th><th class="num">Komisyon İadesi</th><th class="num">Net</th><th>Durum</th><th>Fatura</th></tr></thead><tbody>${rows || '<tr><td colspan="7" class="hof-empty">Bu ay faturası beklenen komisyon yok.</td></tr>'}</tbody></table></div>
      ${linked ? `<h4 class="hof-bank-subtitle">Faturası Kaydedilenler</h4><div class="hof-bank-table-wrap"><table class="hof-table hof-bank-table"><thead><tr><th>Fatura</th><th>POS</th><th class="num">Bağlı Kesinti</th><th class="num">Fatura Tutarı</th><th class="num">Fark</th></tr></thead><tbody>${linked}</tbody></table></div>` : ""}
      <p class="hof-rep-note">Ödeme kuruluşunun her valörde kestiği komisyon sağlayıcı carisine yazılır; ay sonunda komisyon faturası taslağı (Hizmet ve Gider Alışı, 653, KDV dahil) açılır. Taslağı gelen e-faturayla karşılaştırıp kaydedin; fark varsa sağlayıcıda açık kalır. Net eksiyse (iade fazla) taslak açılmaz: İade Alacağı.</p>`;
  }
  function terminalsHtml() {
    const { rows, blocks } = terminalRows(state.list || [], { withAccount: true });
    return `<div class="hof-bank-table-wrap"><table class="hof-table hof-bank-table hof-pos-table"><thead><tr><th>POS</th><th>Bağlı Hesap</th><th>Sağlayıcı ve Vergi</th><th>Valör</th><th>Oranlar</th><th class="num">Bekleyen (Net)</th><th>Durum</th><th>İşlemler</th></tr></thead><tbody>${rows}</tbody></table></div>
      ${blocks.length ? `<ul class="hof-inv-blocks" data-pos-blocks>${blocks.map(text => `<li>${esc(text)}</li>`).join("")}</ul>` : ""}
      <p class="hof-rep-note">POS'lar bağlı banka hesabının ayrıntısında da listelenir. Hareketler'de bir POS'un gün sonu fişlerini görmek için Hareketler → POS süzgecini kullanın.</p>`;
  }

  // ---------- Eylemler ----------
  async function settleNow(button) {
    if (button) button.disabled = true;
    try {
      const result = await api("/settle", { method: "POST", body: {} });
      HOF.toast(result.settled ? `${result.settled} POS gün sonu fişi bankaya yazıldı.` : "Aktarılacak (valörü gelmiş) POS kalemi yok.", { type: result.failed ? "error" : "success" });
      changed();
      await reloadTab();
    } catch (error) {
      HOF.toastError(error);
    } finally {
      if (button?.isConnected) button.disabled = false;
    }
  }
  async function voidSale(id) {
    const sale = (state.sales || []).find(item => item.id === id);
    if (!sale) return;
    const go = await HOF.confirm({ title: "POS İşlemini İptal Et", message: `${sale.eventNo || ""} ${fmt(sale.grossMinor)} POS tahsilatı iptal edilsin mi? Provizyon süresi içinde ve bankaya geçmeden iptalde komisyon doğmaz; carinin tahsilatı silinir.`, confirmLabel: "İptal Et", danger: true });
    if (!go) return;
    try {
      await api(`/pos/sales/${encodeURIComponent(id)}/void`, { method: "POST", body: {} });
      HOF.toast("POS işlemi iptal edildi (void).", { type: "success" });
      changed();
      HOF.emit("cash-changed");
      await reloadTab();
    } catch (error) {
      HOF.toastError(error);
    }
  }
  function refundSale(id) {
    const sale = (state.sales || []).find(item => item.id === id);
    if (!sale) return;
    const left = sale.grossMinor - sale.refundedMinor;
    const requestId = HOF.requestId();
    HOF.formModal({
      title: "POS İadesi",
      eyebrow: (sale.party?.name || "").toLocaleUpperCase("tr-TR"),
      intro: `${sale.eventNo} · ${dateText(sale.date)} · ${fmt(sale.grossMinor)} satıştan en çok ${fmt(left)} iade edilebilir. İade, satışın bekleyen tutarından düşülür; bankaya geçmişse iade valöründe bankadan çıkar. Carinin bakiyesine iade olarak yazılır.`,
      fields: [
        { name: "amount", label: "İade Tutarı", required: true, autofocus: true, inputmode: "decimal", value: HOF.formatMoney(left / 100).replace(/\s*₺|\s*TL/g, "") },
        { name: "date", label: "Tarih", type: "date", required: true, value: HOF.localToday(), max: "today" },
        { name: "note", label: "Açıklama", maxlength: 300, value: "" },
      ],
      submitLabel: "İadeyi Kaydet",
      onSubmit: async data => {
        await api(`/pos/sales/${encodeURIComponent(id)}/refund`, { method: "POST", body: { amount: data.amount, date: data.date, note: data.note }, requestId });
        HOF.toast("POS İadesi kaydedildi.", { type: "success" });
        changed();
        await reloadTab();
      },
    });
  }
  function confirmDay(button) {
    const posId = button.dataset.pos;
    const day = button.dataset.day;
    const net = Number(button.dataset.net) || 0;
    const requestId = HOF.requestId();
    HOF.formModal({
      title: "Bankaya Geçişi Onayla",
      eyebrow: (posOf(posId)?.name || "POS").toLocaleUpperCase("tr-TR"),
      intro: `Valör ${dateText(day)} · planlanan net ${fmt(net)}. Bankaya gerçekten geçen tarihi ve net tutarı girin.`,
      fields: [
        { name: "date", label: "Bankaya Geçiş Tarihi", type: "date", required: true, value: day > HOF.localToday() ? HOF.localToday() : day, max: "today" },
        { name: "netAmount", label: "Bankaya Geçen Net Tutar", required: true, inputmode: "decimal", value: HOF.formatMoney(net / 100).replace(/\s*₺|\s*TL/g, "") },
      ],
      submitLabel: "Onayla",
      onSubmit: async data => {
        await api("/pos/items/confirm", { method: "POST", body: { posId, valueDate: day, date: data.date, netAmount: data.netAmount, requestId } });
        HOF.toast("Bankaya geçiş onaylandı; gün sonu fişi yazıldı.", { type: "success" });
        changed();
        await reloadTab();
      },
    });
  }
  async function createDrafts(button) {
    if (button) button.disabled = true;
    try {
      const result = await api("/pos/commission-invoices", { method: "POST", body: { month: state.month } });
      HOF.toast(result.created?.length ? `${result.created.length} komisyon faturası taslağı açıldı.` : "Bu ay için açılacak taslak yok (faturası beklenen komisyon yok ya da taslak zaten var).", { type: "success" });
      changed();
      await reloadTab();
    } catch (error) {
      HOF.toastError(error);
    } finally {
      if (button?.isConnected) button.disabled = false;
    }
  }
  document.addEventListener("click", event => {
    const scope = event.target.closest?.(".hof-bank-modal");
    if (!scope) return;
    const sub = event.target.closest("[data-pos-sub]");
    if (sub) {
      state.sub = sub.dataset.posSub;
      bank.rerender();
      return reloadTab();
    }
    const act = event.target.closest("[data-pos-act]");
    if (!act || act.disabled) return;
    event.preventDefault();
    const pos = act.dataset.pos ? posOf(act.dataset.pos) : null;
    switch (act.dataset.posAct) {
      case "add":
        return act.dataset.account ? posForm({ accountId: act.dataset.account }) : definePosFromTab();
      case "edit":
        return pos && posForm({ pos });
      case "rates":
        return pos && ratesForm(pos.id);
      case "status":
        return pos && toggleStatus(pos);
      case "delete":
        return pos && removePos(pos);
      case "move":
        return pos && movePending(pos);
      case "settle":
        return settleNow(act);
      case "void":
        return voidSale(act.dataset.sale);
      case "refund":
        return refundSale(act.dataset.sale);
      case "confirm":
        return confirmDay(act);
      case "drafts":
        return createDrafts(act);
      default:
        return;
    }
  });
  /** POS sekmesinden "+ POS Ekle": tek işaretli hesapta doğrudan, yoksa hesabı işaretleme önerisi (Tanımla akışı). */
  async function definePosFromTab() {
    const saved = await definePos();
    if (saved) await bank.reloadView();
  }
  document.addEventListener("change", event => {
    if (!event.target.closest?.(".hof-bank-modal")) return;
    const filter = event.target.closest("[data-pos-filter]");
    if (filter) {
      state.salesFilter[filter.dataset.posFilter] = filter.value;
      state.sales = null;
      bank.rerender();
      return reloadTab();
    }
    if (event.target.matches("[data-pos-month]")) {
      state.month = event.target.value || HOF.localToday().slice(0, 7);
      state.commission = null;
      bank.rerender();
      return reloadTab();
    }
  });

  // ---------- Tahsilat formlarının POS alanı (İz 3.2; §8.9) ----------
  /**
   * attr(field): alanın öznitelikleri — modül formlarında name="…", fatura peşin satırında data-pay="cash" data-i data-f="…". Dönüş: POS alanının
   * iç HTML'i (POS seçici ya da bilgi satırı, taksit, provizyon, son 4 hane, önizleme yeri; iadede asıl işlem). mode: none (POS yok → "POS
   * Tanımla"), single, many.
   */
  function posChoicesOf(data) {
    return { list: data?.pos || [], defaultId: data?.forms?.pos?.defaultId || "" };
  }
  function selectedPos(data, value) {
    const { list, defaultId } = posChoicesOf(data);
    if (value && list.some(item => item.id === value)) return value;
    if (list.length === 1) return list[0].id;
    return value || defaultId || "";
  }
  function fieldsHtml(data, { attr, value = "", installments = 1, authCode = "", cardLast4 = "", refund = false, refundOf = "", sourceless = false, origins = null, legacyPos = null }) {
    const { list } = posChoicesOf(data);
    const current = legacyPos && !list.some(item => item.id === legacyPos.id) ? legacyPos : null;
    if (!list.length && !current) return { mode: "none", html: bank.defineHtml("pos") };
    const all = current ? [current, ...list] : list;
    const id = selectedPos(data, value);
    const chosen = all.find(item => item.id === id) || null;
    let posHtml;
    let mode;
    if (all.length === 1 && (!value || value === all[0].id)) {
      mode = "single";
      posHtml = `<p class="hof-bank-pick-note" data-pos-single="${esc(all[0].id)}">${esc(all[0].name)} POS'una yazılır${refund ? " (POS İadesi)" : ""}.</p>`;
    } else {
      mode = "many";
      posHtml = `<label class="hof-field"><span>POS <i aria-hidden="true">*</i></span><select ${attr("posId")} data-pos-select required>${option("", "POS Seçin", id)}${all.map(item => option(item.id, `${item.name}${item.bankName ? ` · ${item.bankName}` : ""}`, id)).join("")}</select></label>`;
    }
    if (refund) {
      const list_ = origins || [];
      const value_ = sourceless ? SOURCELESS : refundOf;
      const originSelect = `<label class="hof-field"><span>Asıl POS İşlemi</span><select ${attr("posRefundOf")} data-pos-origin>${option("", origins === null ? "Otomatik (aynı cari / faturadan)" : list_.length ? "Otomatik (aynı cari / faturadan)" : "Otomatik — öneri yok", value_)}${list_.map(item => option(item.id, `${item.eventNo || dateText(item.date)} · ${dateText(item.date)} · ${fmt(item.grossMinor)}${item.remainingMinor !== item.grossMinor ? ` (iade edilebilir ${fmt(item.remainingMinor)})` : ""}${item.posName ? ` · ${item.posName}` : ""}`, value_)).join("")}${option(SOURCELESS, "Kaynaksız (Eski Satış)", value_)}</select><small>İade asıl satışın bekleyen tutarından düşülür; bankaya geçmişse iade valöründe bankadan çıkar.</small></label>`;
      return { mode, html: `${posHtml}${originSelect}` };
    }
    const rates = chosen?.rates?.length ? chosen.rates : [{ installments: 1, label: "Tek Çekim", rate: "" }];
    const inst = rates.some(rate => Number(rate.installments) === Number(installments)) ? Number(installments) : Number(rates[0].installments);
    const installmentSelect = `<label class="hof-field"><span>POS Taksit Sayısı</span><select ${attr("posInstallments")} data-pos-installments>${rates.map(rate => option(rate.installments, rate.label || installmentText(rate.installments), inst)).join("")}</select></label>`;
    const auth = `<label class="hof-field"><span>Provizyon No</span><input type="text" ${attr("authCode")} value="${esc(authCode)}" maxlength="20" autocomplete="off" placeholder="İsteğe bağlı"></label>`;
    const last4 = `<label class="hof-field"><span>Kartın Son 4 Hanesi</span><input type="text" ${attr("cardLast4")} value="${esc(cardLast4)}" maxlength="4" inputmode="numeric" autocomplete="off" placeholder="İsteğe bağlı"></label>`;
    return { mode, html: `${posHtml}${installmentSelect}${auth}${last4}<p class="hof-pos-preview" data-pos-preview aria-live="polite"></p>` };
  }
  /** Önizleme metni (§8.9): "Komisyon %3,50 (420,00 TL) · Bankaya Geçecek 3.860,00 TL × 3 · İlk Valör 12.11.2026". */
  function previewText(p) {
    const nets = p.items.map(item => item.netMinor);
    const same = nets.every(net => net === nets[0]);
    const pay = p.items.length > 1 && same ? `${fmt(nets[0])} × ${p.items.length}` : fmt(p.netMinor);
    return `Komisyon %${pct(p.rate)} (${fmt(p.commissionMinor)}${p.taxMinor && /Hariç/.test(p.taxLabel) ? ` + vergi ${fmt(p.taxMinor)}` : ""}) · Bankaya Geçecek ${pay} · ${p.items.length > 1 ? "İlk Valör" : "Valör"} ${dateText(p.items[0]?.valueDate)}${p.blocked ? " (Blokeli POS)" : ""}`;
  }
  /** Önizlemeyi yerine yazar (son istek kazanır; hata metni kırmızı). */
  function previewInto(node, { posId, amount, installments, date }) {
    if (!node) return;
    const seq = (node.posSeq = (node.posSeq || 0) + 1);
    if (!posId || !(amount > 0)) {
      node.textContent = "";
      node.classList.remove("is-error");
      return;
    }
    clearTimeout(node.posTimer);
    node.posTimer = setTimeout(async () => {
      try {
        const p = await api(`/pos/preview?pos=${encodeURIComponent(posId)}&amount=${encodeURIComponent(amountQuery(amount))}&installments=${encodeURIComponent(installments || 1)}&date=${encodeURIComponent(date || "")}`, { background: true });
        if (seq !== node.posSeq || !node.isConnected) return;
        node.textContent = previewText(p);
        node.classList.remove("is-error");
      } catch (error) {
        if (seq !== node.posSeq || !node.isConnected) return;
        node.textContent = error.message || "";
        node.classList.add("is-error");
      }
    }, 200);
  }
  /**
   * Modül formu (formModal; attachPicker'dan): yol alanı "card" iken görünür. value: düzeltmede satırın POS'u; row: "tablo:kimlik" (düzeltmede
   * taksit/provizyon/son 4 hane sunucudan okunur; okunamazsa bu alanlar gönderilmez — satış kaydı değişmesin). refund: POS İadesi (asıl işlem
   * önerisi origin.partyId / planId'den). Dönüş: { refresh(data, forceId) }.
   */
  function attach(form, { methodNode, data, dateNode, amountOf = () => 0, value = "", row = "", refund = false, origin = {} }) {
    const box = document.createElement("div");
    box.className = "hof-bank-pick hof-pos-pick";
    box.dataset.posPick = refund ? "refund" : "sale";
    let at = methodNode.closest(".hof-field");
    while (at?.nextElementSibling?.matches?.("[data-bank-pick]")) at = at.nextElementSibling;
    at.after(box);
    const ctl = { data, value, installments: 1, authCode: "", cardLast4: "", refundOf: "", sourceless: false, origins: null, metaOk: !row, forced: "" };
    const attr = field => `name="${field}"`;
    const read = () => {
      const pick = box.querySelector("[data-pos-select]");
      if (pick) ctl.value = pick.value;
      const inst = box.querySelector("[data-pos-installments]");
      if (inst) ctl.installments = Number(inst.value) || 1;
      for (const field of ["authCode", "cardLast4"]) {
        const node = box.querySelector(`[name="${field}"]`);
        if (node) ctl[field] = node.value;
      }
      const originNode = box.querySelector("[data-pos-origin]");
      if (originNode) {
        ctl.sourceless = originNode.value === SOURCELESS;
        ctl.refundOf = ctl.sourceless ? "" : originNode.value;
      }
    };
    const currentId = () => box.querySelector("[data-pos-select]")?.value || box.querySelector("[data-pos-single]")?.dataset.posSingle || "";
    const preview = () => previewInto(box.querySelector("[data-pos-preview]"), { posId: !box.hidden ? currentId() : "", amount: amountOf(), installments: box.querySelector("[data-pos-installments]")?.value || 1, date: dateNode?.value || "" });
    const render = () => {
      const result = fieldsHtml(ctl.data, { attr, value: ctl.forced || ctl.value, installments: ctl.installments, authCode: ctl.authCode, cardLast4: ctl.cardLast4, refund, refundOf: ctl.refundOf, sourceless: ctl.sourceless, origins: ctl.origins });
      box.innerHTML = result.html;
      box.dataset.posMode = result.mode;
      // Sourceless seçimi formun gövdesinde "posSourceless" olarak gider; seçicinin değeri posRefundOf alanına yazılmaz.
      const originNode = box.querySelector("[data-pos-origin]");
      if (originNode) originNode.addEventListener("change", sync);
      if (!ctl.metaOk) for (const field of ["posInstallments", "authCode", "cardLast4"]) box.querySelector(`[name="${field}"]`)?.removeAttribute("name");
      sync();
    };
    const sync = () => {
      const on = methodNode.value === "card";
      box.hidden = !on;
      box.querySelectorAll("select, input").forEach(node => {
        node.disabled = !on;
      });
      const pick = box.querySelector("[data-pos-select]");
      if (pick) pick.required = on;
      // "Kaynaksız (Eski Satış)": gövdeye posSourceless (posRefundOf boş).
      let hidden = box.querySelector('input[name="posSourceless"]');
      const originNode = box.querySelector("[data-pos-origin]");
      const sourceless = on && originNode?.value === SOURCELESS;
      if (sourceless && !hidden) box.insertAdjacentHTML("beforeend", '<input type="hidden" name="posSourceless" value="1">');
      if (!sourceless && hidden) hidden.remove();
      if (originNode) originNode.name = sourceless ? "" : "posRefundOf";
      hidden = null;
      preview();
    };
    methodNode.addEventListener("change", sync);
    box.addEventListener("change", event => {
      if (event.target.matches("[data-pos-select]")) {
        read();
        ctl.forced = "";
        return render();
      }
      read();
      preview();
    });
    form.addEventListener("input", event => {
      if (!box.contains(event.target)) preview();
    });
    form.addEventListener("change", event => {
      if (!box.contains(event.target) && event.target !== methodNode) preview();
    });
    render();
    // Düzeltme: satırın POS kaydındaki taksit, provizyon, son 4 hane (ve iadede asıl işlem). Okunamazsa bu alanlar gönderilmez.
    if (row) {
      api(`/pos/row?row=${encodeURIComponent(row)}`)
        .then(result => {
          const sale = result.sale;
          if (sale) Object.assign(ctl, { value: ctl.value || sale.posId, installments: sale.installments || 1, authCode: sale.authCode || "", cardLast4: sale.cardLast4 || "", refundOf: sale.originId || "", sourceless: Boolean(sale.sourceless) });
          ctl.metaOk = true;
          if (form.isConnected) render();
        })
        .catch(() => {
          if (!form.isConnected) return;
          box.insertAdjacentHTML("beforeend", '<small class="hof-bank-pick-note">POS kaydının taksit ve provizyon bilgisi okunamadı; bu alanlar değiştirilmez.</small>');
        });
    }
    // POS İadesi: aynı cari / taksit kartından asıl işlem önerisi.
    if (refund && (origin.partyId || origin.planId)) {
      api(`/pos/origins?${origin.planId ? `plan=${encodeURIComponent(origin.planId)}` : `party=${encodeURIComponent(origin.partyId)}`}`)
        .then(result => {
          ctl.origins = result.sales || [];
          if (form.isConnected) {
            read();
            render();
          }
        })
        .catch(() => null);
    }
    return {
      box,
      refresh(fresh, forceId = "") {
        if (!form.isConnected) return;
        read();
        ctl.data = fresh;
        if (forceId) ctl.forced = forceId;
        render();
        if (forceId) (box.querySelector("[data-pos-select]") || box.querySelector("[data-pos-installments]"))?.focus();
      },
    };
  }
  bank.registerPosField({ attach });

  // Fatura peşin satırı (hof-invoices.js): aynı kurucular — öznitelikler data-pay/data-i/data-f (satırın modeline yazılır).
  bank.posCellHtml = (data, item, index, { refund = false, origins = null } = {}) =>
    fieldsHtml(data, {
      attr: field => `data-pay="cash" data-i="${index}" data-f="${field}"`,
      value: item.posId || "",
      installments: item.posInstallments || 1,
      authCode: item.authCode || "",
      cardLast4: item.cardLast4 || "",
      refund,
      refundOf: item.posRefundOf && item.posRefundOf !== SOURCELESS ? item.posRefundOf : "",
      sourceless: item.posRefundOf === SOURCELESS,
      origins,
    });
  bank.posPreviewInto = previewInto;
  bank.posSelected = (data, value) => selectedPos(data, value);
  bank.POS_SOURCELESS = SOURCELESS;
  bank.posOrigins = query => api(`/pos/origins?${query}`).then(result => result.sales || []);
})();
