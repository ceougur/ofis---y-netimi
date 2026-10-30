/* DestekOfis — ortak istemci çekirdeği.
 * Tüm eklenti betikleri (hof-*.js) bu çekirdeği kullanır: API çağrısı, bildirim, pencere,
 * tek bir toplu DOM izleyici, dosya kimliği çözümleme ve biçimlendirme yardımcıları.
 * Derlenmiş React paketine dokunmadan onun etrafında çalışır. */
(() => {
  "use strict";
  if (window.HOF) return;
  const HOF = (window.HOF = {});
  const nativeFetch = window.fetch.bind(window);
  HOF.nativeFetch = nativeFetch;
  // Sayfanın şirketi (v2.0.21): açılışta /api/auth/me'den gelir; bu sayfadan giden her API isteğine eklenir (?hofCompany=).
  // Sunucu isteği bu şirkete yönlendirir: aynı hesap başka pencerede/bilgisayarda şirket değiştirse de bu pencerede
  // görünen şirkete yazılır. Ortak katman yolları (giriş, şirket listesi/seçimi, lisans) ve başka adresler değişmez.
  HOF.companyId = "";
  // Pencerenin sayfası (2.2.0 İz 1.2): açılışta istemci durumundan gelir (HOF.datasetKey, hof-boot.js applyClientState) ve aynı yollarla her
  // isteğe eklenir (?hofPage=). Sayfa seçimi kullanıcı başınadır; aynı hesabın öbür penceresinde yeni sayfa açılınca bu pencerenin istekleri
  // de yeni sayfaya gidiyor, sayfa listesi "current" başka geldiği için bu pencere "sayfanız silindi" deyip yeniden yükleniyordu.
  HOF.datasetKey = HOF.datasetKey || "";
  const COMPANY_FREE = /^\/api\/(auth|public|health|license|companies)(\/|$)/;
  HOF.apiUrl = value => {
    if ((!HOF.companyId && !HOF.datasetKey) || typeof value !== "string") return value;
    let url;
    try {
      url = new URL(value, window.location.href);
    } catch {
      return value;
    }
    if (url.origin !== window.location.origin || !url.pathname.startsWith("/api/") || COMPANY_FREE.test(url.pathname)) return value;
    let changed = false;
    if (HOF.companyId && !url.searchParams.has("hofCompany")) {
      url.searchParams.set("hofCompany", HOF.companyId);
      changed = true;
    }
    if (HOF.datasetKey && !url.searchParams.has("hofPage")) {
      url.searchParams.set("hofPage", HOF.datasetKey);
      changed = true;
    }
    return changed ? `${url.pathname}${url.search}${url.hash}` : value;
  };

  // ---------- Metin yardımcıları ----------
  const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  HOF.esc = value => String(value ?? "").replace(/[&<>"']/g, char => ESCAPES[char]);
  HOF.normalize = value => String(value ?? "").toLocaleLowerCase("tr-TR").replace(/[İI]/g, "i").replace(/ı/g, "i").replace(/\s+/g, " ").trim();
  HOF.initials = name => String(name || "?").trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toLocaleUpperCase("tr-TR") || "?";
  // 2.4.4 (UI11): dışa aktarım düğmelerinin TEK görünümü. PDF / Excel / Yazdır her pencerede aynı aile (.hof-rep-out is-pdf | is-xlsx | is-print),
  // aynı simge, yazı ve boy (hof-ui.css "Dışa aktarım düğmeleri"). Liste ve rapor düğmesi tek ad ("PDF", "Excel"); ne indirdiği erişilebilir adda
  // ("Fatura Listesi - PDF") ve ipucunda (title). Kart/belge çıktıları adlı kalır (2.0.16 müşteri kararı: "Cari Ekstre - PDF"; label ile verilir).
  // Davranış öznitelikleri (href, target, download, data-pdf / data-print / data-xlsx …) çağıranda kalır; yardımcı yalnız görünümü kurar.
  const OUT_ICONS = {
    pdf: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>',
    xlsx: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M3.5 9h17M3.5 14.5h17M9 3.5v17"/></svg>',
    print: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9V3h12v6"/><rect x="6" y="14" width="12" height="7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/></svg>',
  };
  const OUT_NAME = { pdf: "PDF", xlsx: "Excel", print: "Yazdır" };
  const OUT_TIP = { pdf: "PDF olarak açılır; oradan kaydedebilir ya da yazdırabilirsiniz", xlsx: "Excel dosyası olarak iner", print: "Yazıcıya gönderilir" };
  HOF.outIcon = kind => OUT_ICONS[kind] || "";
  // kind: "pdf" | "xlsx" | "print"; what: neyin çıktısı ("Cari Listesi"); label: kart/belge çıktısında adlı yazı; tip: ipucu cümlesi;
  // attrs: davranış öznitelikleri (ham, çağıran kaçışlar); href varsa <a>, yoksa <button>.
  HOF.outputButton = ({ kind = "pdf", href = "", what = "", label = "", tip = "", attrs = "" } = {}) => {
    const name = label || OUT_NAME[kind] || "PDF";
    const aria = what && !label ? `${what} - ${name}` : name;
    const title = tip || `${what ? `${what}: ` : ""}${OUT_TIP[kind] || OUT_TIP.pdf}`;
    const common = `class="hof-rep-out is-${kind}" data-out="${kind}" aria-label="${HOF.esc(aria)}" title="${HOF.esc(title)}"${attrs ? ` ${attrs}` : ""}`;
    const inner = `${OUT_ICONS[kind] || ""}${HOF.esc(name)}`;
    return href ? `<a href="${HOF.esc(href)}" ${common}>${inner}</a>` : `<button type="button" ${common}>${inner}</button>`;
  };
  // Rol adları ve kayıtlara verilen ad seçili sektöre göre değişir (hof-insight.js); bunlar sektör seçilmemiş hâlidir.
  HOF.roleLabels = { admin: "Yönetici", avukat: "Uzman", personel: "Personel", muhasebe: "Muhasebe" };
  HOF.vocab = { record: "kayıt", records: "kayıtlar", Record: "Kayıt", Records: "Kayıtlar", expert: "Uzman", subtitle: "Ofis Yönetimi" };
  HOF.modules = { tahsilat: true, haciz: false };

  const dateFormat = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const dateTimeFormat = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const moneyFormat = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 });
  // Yalnız gün ("YYYY-AA-GG") YEREL gün olarak okunur. new Date("2026-10-08") UTC gece yarısıdır; UTC'nin batısındaki saat diliminde
  // (ör. America/Los_Angeles) bir önceki gün görünüyordu (CI 534 incelemesi, TZ denemesi: Nakit Akış "07.10.2026 – 06.11.2026").
  const DAY_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
  const safeDate = value => {
    const day = typeof value === "string" ? DAY_ONLY.exec(value) : null;
    const date = value instanceof Date ? value : day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  HOF.formatDate = value => (safeDate(value) ? dateFormat.format(safeDate(value)) : "—");
  HOF.formatDateTime = value => (safeDate(value) ? dateTimeFormat.format(safeDate(value)) : "—");
  HOF.formatMoney = value => moneyFormat.format(Number(value) || 0);
  HOF.relativeTime = value => {
    const date = safeDate(value);
    if (!date) return "";
    const minutes = Math.round((Date.now() - date.getTime()) / 60000);
    if (minutes < 1) return "az önce";
    if (minutes < 60) return `${minutes} dk önce`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} sa önce`;
    const days = Math.round(hours / 24);
    return days < 30 ? `${days} gün önce` : HOF.formatDate(date);
  };

  // ---------- Olay yolu ----------
  const bus = new EventTarget();
  // Aboneliği bırakan bir işlev döner.
  HOF.on = (name, handler) => {
    const listener = event => handler(event.detail);
    bus.addEventListener(name, listener);
    return () => bus.removeEventListener(name, listener);
  };
  HOF.emit = (name, detail) => bus.dispatchEvent(new CustomEvent(name, { detail }));
  // Açılış tamamlandığında (veya tamamlanmışsa hemen) çalışır.
  HOF.isReady = false;
  HOF.whenReady = handler => (HOF.isReady ? handler(HOF.user) : HOF.on("ready", handler));

  // ---------- Odak koruma (v2.0.14) ----------
  // Bir kapsayıcı yeniden kurulurken (liste yenilenmesi, canlı yenileme) içindeki odaklı girdi kaybolmasın: yazılan
  // değer, odak, imleç ve kaydırma konumu yeniden kurulan kutuya geri verilir. Kutu, süzgeç adıyla (data-filter, data-q,
  // data-pick…), name/id ya da aria-label ile yeniden bulunur. Kullanım: HOF.swap(root, html) ya da HOF.keepFocus(root, fn).
  const FOCUS_KEYS = ["data-filter", "data-q", "data-pick", "data-rc-search", "data-field", "data-range", "data-open-account", "data-open-plan", "data-case-action", "data-case-collect", "data-action", "data-act", "data-pulse", "data-pulse-go", "data-composer", "data-body", "data-current", "data-opt", "name", "id", "aria-label"];
  const TEXT_INPUT = /^(text|search|tel|email|url|number|password|date|datetime-local|month)?$/;
  // Birincil anahtar (eski davranış): ilk bulunan FOCUS_KEYS niteliği.
  const primaryFocusKey = node => {
    if (!node || !node.getAttribute) return "";
    for (const key of FOCUS_KEYS) {
      const value = node.getAttribute(key);
      if (value !== null) return `${node.tagName.toLowerCase()}[${key}="${CSS.escape(value)}"]`;
    }
    return "";
  };
  // Gözden geçirme 2.4.3 (gg243 #4, A10 yan etkisi): anahtar yalnız data-act olduğunda satır düğmelerinde odak BAŞKA satırın aynı düğmesine geçiyordu
  // (fatura 3 kalem: 3. kalemin ×'ine Enter → odak 1. kalemin ×'i, ikinci Enter 1. kalemi siliyordu). Anahtar artık satırı ayırt eden bütün data-*
  // nitelikleriyle (data-l, data-plan, data-id …) eşleşir.
  HOF.focusKey = node => {
    const primary = primaryFocusKey(node);
    if (!primary) return "";
    const extras = [...node.attributes].filter(attr => attr.name.startsWith("data-") && !primary.includes(`[${attr.name}=`)).map(attr => `[${attr.name}="${CSS.escape(attr.value)}"]`);
    return `${primary}${extras.join("")}`;
  };
  // Yeniden çizimde öğe tam anahtarla bulunamazsa (ör. değişken bir data-* değeri) birincil anahtara ancak öğe hem önceki hem yeni çizimde TEK ise
  // dönülür; değilse odak hiçbir öğeye verilmez (başka satırın düğmesine asla).
  const refind = (root, snap) => {
    const exact = root.querySelector(snap.key);
    if (exact || !snap.primary || snap.primary === snap.key || !snap.unique) return exact;
    const loose = root.querySelectorAll(snap.primary);
    return loose.length === 1 ? loose[0] : null;
  };
  // Satır silen düğmeler (fatura kalemi ×, ödeme satırı, mahsup, masraf, tablo satırı/kolonu).
  const REMOVAL_BUTTON = '[data-act$="-remove"], [data-act="remove"], [data-act="delete-row"], [data-act="delete-col"]';
  const SAFE_FIELD = "input:not([readonly]):not([disabled]):not([type=hidden]):not([type=checkbox]):not([type=radio]), select:not([disabled]), textarea:not([readonly]):not([disabled])";
  HOF.keepFocus = (root, render) => {
    const active = document.activeElement;
    const field = root && active && active !== document.body && root.contains(active) && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName);
    // 2.4.3 (A10): odaktaki düğme de (ör. formu açan "+ Tahsilat") yeniden çizimde aynı anahtarlı düğmeye geçer; odak boşa düşmez.
    const button = !field && root && active && active !== document.body && root.contains(active) && active.tagName === "BUTTON";
    const inside = field || button;
    const text = field && active.tagName !== "SELECT" && (active.tagName === "TEXTAREA" || TEXT_INPUT.test(active.type || ""));
    const primary = inside ? primaryFocusKey(active) : "";
    const snap = inside ? { key: HOF.focusKey(active), primary, unique: Boolean(primary) && root.querySelectorAll(primary).length === 1, text, value: active.value, start: text ? active.selectionStart : null, end: text ? active.selectionEnd : null, scroll: root.scrollTop, removal: button && active.matches(REMOVAL_BUTTON) } : null;
    // 2.4.3 (kullanıcı kararı, form durumu izole): yeniden çizim kullanıcının yazdığı (kaydedilmemiş) değerleri ezmez.
    const drafts = root ? draftSnapshot(root) : [];
    const out = render();
    if (drafts.length) draftRestore(root, drafts);
    if (!snap?.key) {
      // Pencere "Yükleniyor…" ile açıldıysa odak kapatma düğmesinde kalmıştır; içerik gelince ilk arama kutusuna geçer.
      const now = document.activeElement;
      if (now && now.matches?.(".hof-modal-close") && now.closest(".hof-modal")?.contains(root)) root.querySelector("[autofocus], input[type=search]")?.focus({ preventScroll: true });
      return out;
    }
    const next = refind(root, snap);
    if (!next || next.disabled) return out;
    if (button) {
      // Dar kontrol 2.4.3 (D1): satır SİLEN düğme (×) yeniden çizimden sonra hiçbir zaman başka bir silme düğmesine odak vermez — aynı anahtarlı
      // düğme artık bir sonraki satırındır (ikinci Enter onu da silerdi). Odak aynı konumdaki satırın ilk yazılabilir alanına gider; yoksa verilmez
      // (çağıran kendi güvenli hedefini seçebilir).
      if (snap.removal) {
        const row = next.closest("tr, li, [data-line], [role=row]");
        row?.querySelector(SAFE_FIELD)?.focus({ preventScroll: true });
        return out;
      }
      next.focus({ preventScroll: true });
      if (snap.scroll) root.scrollTop = snap.scroll;
      return out;
    }
    // Yazarken gelen (eski) yanıt kutudaki metni geri almasın.
    if (snap.text && next.value !== snap.value) next.value = snap.value;
    next.focus({ preventScroll: true });
    if (snap.start !== null) {
      try { next.setSelectionRange(snap.start, snap.end); } catch { /* type=search/number bazı tarayıcılarda seçim desteklemez */ }
    }
    if (snap.scroll) root.scrollTop = snap.scroll;
    return out;
  };
  HOF.swap = (root, html) => HOF.keepFocus(root, () => { root.innerHTML = html; });

  // ---------- Form taslağı (2.4.3, kullanıcı kararı 17.10.2026: "Form state yönetimini izole hale getir; dosya/resim yükleme formun
  // genel state'ini re-render etmesin ve kaydedilmemiş verileri ezmesin") ----------
  // Kullanıcının kendi eliyle (klavye, fare; isTrusted) değiştirdiği alanlar "dokunulmuş" sayılır. Kurallar:
  //  - HOF.swap / HOF.keepFocus ile yeniden çizilen bir kapsayıcıda dokunulmuş ve kayıtlı değerinden farklı alanlar yeni çizimde AYNI
  //    anahtarlı alana geri yazılır — yeter ki program o alanın kayıtlı (çizilen) değerini değiştirmemiş olsun (ör. "Net'ten Brüt" fiyatı
  //    kendisi yazar; o alan geri alınmaz). Kayıtlı veri ekrana yalnız Kaydet'ten sonra (HOF.markClean) ya da kullanıcı açıkça
  //    yenileyince basılır;
  //  - süzgeç, arama ve seçim kutuları taslak sayılmaz (pencereyi kapatırken "kaydedilmemiş" diye sorulmaz).
  const touched = new WeakSet();
  const NOT_DRAFT = "input[type=search], input[type=file], input[type=button], input[type=submit], input[type=reset], input[type=hidden], input[type=image], [data-filter], [data-q], [data-rc-search], [data-range], [data-param], [data-preset], [data-pos-filter], [data-mv], [data-inbox-from], [data-inbox-to], [data-pick], [data-pick-all], [data-sel], [data-sel-all], [data-select], [data-select-all], [data-nodirty], .hof-autofill-trap";
  const NOT_DRAFT_SCOPE = ".hof-plans-filters, .hof-bank-filters, .hof-bank-filter, .hof-bank-toolbar, .hof-rep-filters, .hof-report-filters, .hof-report-toolbar, .hof-picker-search, .hof-chat-search, [data-nodirty]";
  HOF.isDraftField = node => Boolean(node && node.nodeType === 1 && /^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName) && !node.matches(NOT_DRAFT) && !node.closest(NOT_DRAFT_SCOPE));
  const isToggle = node => node.type === "checkbox" || node.type === "radio";
  const savedValueOf = node => {
    if (isToggle(node)) return node.defaultChecked;
    if (node.tagName === "SELECT") return ([...node.options].find(option => option.defaultSelected) || node.options[0])?.value ?? "";
    return node.defaultValue;
  };
  const valueOf = node => (isToggle(node) ? node.checked : node.value);
  const changedField = node => valueOf(node) !== savedValueOf(node);
  // Alanın yeniden çizimde de aynı kalan anahtarı: name, aria-label ve data-* nitelikleri (rastgele kimlik değil).
  const draftKey = node => {
    const parts = [];
    for (const attr of node.attributes) {
      if (attr.name === "name" || attr.name === "aria-label" || attr.name === "type" || (attr.name.startsWith("data-") && !attr.name.startsWith("data-hof"))) parts.push(`[${attr.name}="${CSS.escape(attr.value)}"]`);
    }
    if (isToggle(node) && !parts.some(part => part.startsWith("[value=")) && node.hasAttribute("value")) parts.push(`[value="${CSS.escape(node.getAttribute("value"))}"]`);
    return parts.length > (parts.some(part => part.startsWith("[type=")) ? 1 : 0) ? `${node.tagName.toLowerCase()}${parts.join("")}` : "";
  };
  function draftSnapshot(root) {
    const out = [];
    for (const node of root.querySelectorAll("input, textarea, select")) {
      if (!touched.has(node) || !HOF.isDraftField(node) || !changedField(node)) continue;
      const key = draftKey(node);
      if (!key) continue;
      const all = [...root.querySelectorAll(key)];
      out.push({ key, index: all.indexOf(node), count: all.length, value: valueOf(node), saved: savedValueOf(node) });
    }
    return out;
  }
  function draftRestore(root, drafts) {
    for (const draft of drafts) {
      const all = root.querySelectorAll(draft.key);
      // Satır eklendi/silindiyse (sayı değişti) hangi alanın hangisi olduğu bilinemez: o anahtara dokunulmaz (formun kendi durumu çizer).
      if (all.length !== draft.count) continue;
      const node = all[draft.index];
      if (!node || !HOF.isDraftField(node) || node.disabled || savedValueOf(node) !== draft.saved) continue;
      if (isToggle(node)) node.checked = draft.value;
      else if (node.tagName === "SELECT" && ![...node.options].some(option => option.value === draft.value)) continue;
      else node.value = draft.value;
      touched.add(node);
    }
  }
  // Kaydedilen formun dokunulmuş işaretleri kalkar: sonraki yeniden çizim kayıtlı (sunucudan dönen) değeri gösterir, pencere kapanırken sorulmaz.
  HOF.markClean = root => {
    if (!root) return;
    for (const node of root.querySelectorAll("input, textarea, select")) touched.delete(node);
    const dialog = root.closest?.(".hof-modal") || root.querySelector?.(".hof-modal");
    openModals.find(item => item.dialog === dialog)?.clean();
  };
  HOF.isTouched = node => touched.has(node);
  // Başarılı yazma (Kaydet, "Kaydet ve Yeni", Taslak Olarak Kaydet…) taslağı kapatır: o pencerede dokunulmuş işaretleri kalkar — sonraki yeniden
  // çizim (ör. Kurulum Sihirbazı'nda "Kaydet ve Yeni Hesap" boş formu) kayıtlı / boş değeri gösterir, eski yazılanı geri getirmez (senaryo-banka-210
  // adım 2 ilk denemede yakaladı). Sorgu niteliğindeki yazmalar (hesapla, mükellef sorgula, önizle, bağlantıyı dene) kaydedilmemiş sayılmayı
  // kaldırmaz; yalnız geri yazım işaretlerini kaldırır (yeniden çizimde programın yazdığı değer görünür).
  const QUERY_WRITE = /\/(calc|check-user|preview|view-preview|test|aliases|search|check)(\?|$)/;
  // Gözden geçirme 2.4.3 (gg243 #3): arka planda giden yazma (ör. kritik stok "bildirildi" POST'u) odaktaki formun kirli taslağını "kaydedildi"
  // sayıyordu (odak formdaydı); Esc formu sorusuz kapatıyor, yazılanlar kayboluyordu. Artık taslağı yalnız KULLANICININ başlattığı yazma kapatır:
  // background işaretli istek hiçbir pencereye yazılmaz; işaretsiz istek de ancak yakın zamanda bir "işlem hareketi" (düğme / bağlantı / seçim kutusu
  // tıklaması, Enter, Boşluk, form gönderimi) olduysa sayılır — metin alanına tıklamak ya da yazmak işlem hareketi değildir (zamanlayıcıyla ya da
  // başka pencereden gelen olayla giden yazma forma dokunmaz).
  const COMMIT_WINDOW_MS = 15000;
  let lastCommitAt = -Infinity;
  const COMMIT_TARGET = 'button, a, [role="button"], [role="tab"], [role="menuitem"], select, input[type="checkbox"], input[type="radio"], input[type="submit"], input[type="button"], input[type="file"]';
  const noteCommit = () => {
    lastCommitAt = performance.now();
  };
  document.addEventListener("pointerdown", event => event.target?.closest?.(COMMIT_TARGET) && noteCommit(), true);
  document.addEventListener("click", event => event.target?.closest?.(COMMIT_TARGET) && noteCommit(), true);
  document.addEventListener("submit", noteCommit, true);
  document.addEventListener("change", event => event.target?.matches?.('select, input[type="checkbox"], input[type="radio"], input[type="file"]') && noteCommit(), true);
  // Enter (metin kutusunda formu gönderir; çok satırlı alanda yeni satırdır) ve Boşluk (yalnız düğme / seçim kutusu üstünde; yazıda boşluktur).
  const TYPING = 'textarea, [contenteditable=""], [contenteditable="true"]';
  const TEXT_FIELD = 'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="file"])';
  document.addEventListener("keydown", event => ((event.key === "Enter" && !event.target?.matches?.(TYPING)) || (event.key === " " && !event.target?.matches?.(`${TYPING}, ${TEXT_FIELD}`))) && noteCommit(), true);
  HOF.__commitWindow = { ms: COMMIT_WINDOW_MS, since: () => performance.now() - lastCommitAt };
  // Sorgu niteliğindeki yazma (hesapla / önizle: yazarken de gider) taslağı kapatmaz, yalnız geri yazım işaretlerini kaldırır — eski kural sürer
  // (işlem hareketi aranmaz); arka plan isteği yine hiçbir pencereye yazılmaz.
  function writeOrigin(background = false, path = "") {
    if (background) return null;
    if (!QUERY_WRITE.test(String(path || "").split("?")[0]) && performance.now() - lastCommitAt > COMMIT_WINDOW_MS) return null;
    const active = document.activeElement;
    return active?.closest?.(".hof-modal") || (lastPressed?.isConnected ? lastPressed.closest?.(".hof-modal") : null) || null;
  }
  // Formla ilgisiz arka plan yazmaları (ekran durumu, sohbet okundu bilgisi) taslağa dokunmaz.
  const UNRELATED_WRITE = /^\/api\/(workspace\/client-state|chat\/|auth\/)/;
  function noteWrite(dialog, path) {
    const clean = String(path || "").split("?")[0];
    const modal = openModals.find(item => item.dialog === dialog);
    if (!modal || UNRELATED_WRITE.test(clean)) return;
    modal.wrote(QUERY_WRITE.test(clean));
  }

  // ---------- Oturum ve yetki ----------
  HOF.user = null;
  HOF.settings = { sheetUrl: "", syncMinutes: "5", aiMapping: "", activeSourceLabel: "" };
  // v2.0.13: ödeme / tahsilat yolu. Nakit Kasa'ya, Havale/EFT ve Kredi Kartı bankaya düşer; Kasa ve Banka ekranı ayrı
  // gösterir. Çek/senet (portföy) ve açık hesap (veresiye, cari) para hareketi değildir; kendi ekranlarından yürür.
  HOF.PAY_METHODS = [
    { value: "cash", label: "Nakit" },
    { value: "bank", label: "Havale / EFT" },
    { value: "card", label: "POS / Kredi Kartı" },
  ];
  // v2.0.16 (müşteri): kart yolunun adı yöne göre — tahsilatta (para girişi) "POS", bizim ödememizde "Kredi Kartı";
  // yönsüz yerde "POS / Kredi Kartı". direction: "in" | "out" | "" (kayıtlı değer `card` değişmez).
  HOF.methodName = (value, direction = "") => (value === "card" ? (direction === "in" ? "POS" : direction === "out" ? "Kredi Kartı" : "POS / Kredi Kartı") : (HOF.PAY_METHODS.find(item => item.value === value) || HOF.PAY_METHODS[0]).label);
  HOF.payMethods = (direction = "") => HOF.PAY_METHODS.map(item => ({ ...item, label: HOF.methodName(item.value, direction) }));
  HOF.methodLabel = (value, direction = "") => HOF.methodName(value, direction);
  HOF.methodField = (value = "cash", { incoming = true, name = "method" } = {}) => ({ name, label: incoming ? "Tahsilat Yolu" : "Ödeme Yolu", type: "select", value: value || "cash", options: HOF.payMethods(incoming ? "in" : "out") });
  HOF.can = permission => Boolean(HOF.user && HOF.user.permissions && HOF.user.permissions.includes(permission));
  // 2.4.3 (uzman UX7): silinen kaydın geri yükleme yolu yetkiye göre söylenir. Silinenler yalnız Yönetim panelindedir ve panel yalnız yöneticiye
  // açılır (admin.js, users.manage); muhasebe / personel / ikinci role "Yönetim → Silinenler'den geri yüklenebilir" denince gidemedikleri bir yere
  // yönlendiriliyorlardı.
  HOF.trashHint = () => (HOF.can("users.manage") ? "Yönetim → Silinenler’den geri yüklenebilir." : "Yöneticiniz Yönetim → Silinenler’den geri yükleyebilir.");
  HOF.sourceName = () => HOF.settings.sheetUrl || window.localStorage.getItem("hukuk-ofisi-sheet-url") || "Çalışma Tablosu";

  // ---------- API ----------
  class ApiError extends Error {
    constructor(message, status, data) {
      super(message);
      this.status = status;
      this.data = data || {};
    }
  }
  HOF.ApiError = ApiError;
  // v2.0.13: Kasa'yı eksiye düşürecek çıkışta sunucu "cash-negative" döner; burada sorulur, onaylanırsa aynı istek
  // "cashForce" ile yeniden gönderilir (her form ayrı ayrı ele almasın). Vazgeçilirse form açık kalır.
  HOF.api = async (path, options = {}) => {
    try {
      return await rawApi(path, options);
    } catch (error) {
      const body = options.body;
      const removing = String(options.method || "").toUpperCase() === "DELETE";
      if (error?.status !== 409 || error.data?.code !== "cash-negative" || (!removing && (!body || typeof body !== "object"))) throw error;
      // Hakem K5 (plan §7): banka hesabının eksi bakiye reddi de cash-negative'dir ama accountId taşır; onu formun kendi sorusu sorar
      // (HOF.bank.withConfirms: hesabın adı ve bakiyesiyle, işlemin adıyla "Yine de İptal Et / Sil / Geri Yükle"). Burada yalnız Kasa sorulur.
      if (error.data?.accountId) throw error;
      // Yola göre başlık ve öneri (Nakit Kasa, Banka, Kredi Kartı). "Engelle" ayarında sunucu cash-blocked döner, sorulmaz.
      const where = { cash: ["Kasa Eksiye Düşecek", "Ödeme bankadan ya da başka bir kasadan yapıldıysa yolu değiştirin."], bank: ["Banka Bakiyesi Eksiye Düşecek", "Hesapta kredili mevduat varsa ya da tahsilat henüz girilmediyse kaydedebilirsiniz."], card: ["Kredi Kartı Bakiyesi Eksiye Düşecek", "İade tutarını ve ödeme yolunu kontrol edin."] }[error.data?.method] || ["Bakiye Eksiye Düşecek", ""];
      // v2.0.26 (G7): silmede sunucu nedeni söyler ("… silinince Nakit Kasa'dan … düşer"); yol değiştirme önerisi silmeye uymaz.
      // 2. gözden geçirme İ5: düzeltmede de sunucu nedeni söyler (explained: "… düzeltilince …"); öneri eklenmez.
      const explained = removing || error.data?.explained === true;
      const question = removing ? `${error.message} Yine de silinsin mi?` : `${error.message} ${explained ? "" : where[1]} Yine de kaydedilsin mi?`;
      const go = await HOF.confirm({ title: where[0], message: question.replace(/\s+/g, " "), confirmLabel: removing ? "Yine de Sil" : "Yine de Kaydet", danger: true });
      // İ6: silmede "Silinmedi"; kullanıcı bilerek vazgeçtiği için bildirim hata değil bilgi (HOF.toastError, aşağıda).
      if (!go) throw new ApiError(removing ? "Silinmedi: bakiye eksiye düşecekti." : "Kaydedilmedi: bakiye eksiye düşecekti.", 409, { code: "cash-negative-cancelled" });
      // Silmede gövde yok: onay adrese eklenir. Hakem K5: cashForce banka hesabının uyarısını da geçer (plan §3.9); bu onay yalnız Kasa'nın
      // sorusuna verildiği için banka hesabı henüz sorulmadıysa negativeOk:false (?negativeOk=0) eklenir — banka hesabı ayrıca sorulur.
      if (removing) return rawApi(`${path}${path.includes("?") ? "&" : "?"}cashForce=1${/[?&]negativeOk=1\b/.test(path) ? "" : "&negativeOk=0"}`, options);
      return rawApi(path, { ...options, body: { ...body, cashForce: true, negativeOk: body.negativeOk === true } });
    }
  };
  // v2.0.22 (Excel denetimi, yük ölçümü): arka plan istekleri (rozetler, vade takvimi, ANLIK DURUM, başka bilgisayardaki
  // değişiklikten sonra pencere yenilemesi) aynı anda en çok 2 bağlantı kullanır. Tarayıcı sunucuya 6 bağlantı açar
  // (biri canlı olay akışında); yenilemeler hepsini doldurunca kullanıcının araması ve açtığı kart sıraya giriyordu.
  const BACKGROUND_SLOTS = 2;
  let backgroundBusy = 0;
  const backgroundQueue = [];
  const backgroundSlot = async () => {
    if (backgroundBusy >= BACKGROUND_SLOTS) await new Promise(resolve => backgroundQueue.push(resolve));
    backgroundBusy += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      backgroundBusy -= 1;
      backgroundQueue.shift()?.();
    };
  };
  const rawApi = async (path, { background = false, ...options } = {}) => {
    if (!background) return sendApi(path, options);
    const release = await backgroundSlot();
    try {
      return await sendApi(path, { ...options, background: true });
    } finally {
      release();
    }
  };
  // İstek kimliği (v2.0.22): formun açıldığı anda üretilir, her gönderimde aynı gider; sunucu ikinci gönderimde yeni belge
  // açmaz (server/lib/idempotency.mjs). LAN'da (http://192.168…) crypto.randomUUID yoktur; getRandomValues her yerde var.
  HOF.requestId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, "0")).join("");
  // 2.4.8 I1 (dar kontrol ORTA-1): Excel / Sheets içe aktarma pencerelerinin gönderimi. Yanıt gelmediyse (ağ kopması, zaman aşımı, yarıda kesilen yanıt;
  // durum 0) yükleme sunucuda kaydedilmiş olabilir: kullanıcı pencereyi kapatmadan aynı kimlikle yeniden basmalı (sunucu ikinci kez yazmaz). Dosyayı yeni
  // pencerede yeniden yüklemek yeni kimlik demektir; Cari No'suz / telefonsuz cari ve numarasız evrak ikinci kez açılır.
  HOF.importApi = async (path, options) => {
    try {
      return await HOF.api(path, options);
    } catch (error) {
      if (error && error.status === 0) error.message = `${error.message} Yükleme sunucuda kaydedilmiş olabilir; pencereyi kapatmadan yeniden basın, ikinci kez yazılmaz.`;
      throw error;
    }
  };
  const sendApi = async (path, { method = "GET", body, signal, timeoutMs = 30000, requestId = "", background = false } = {}) => {
    // 2.4.3: yazma isteğini başlatan pencere (odaktaki ya da son basılan öğenin penceresi); başarılı yazmadan sonra o pencerenin taslağı
    // "kaydedildi" sayılır (noteWrite). Arka plan isteği ve kullanıcı hareketi olmadan giden yazma hiçbir pencereye yazılmaz (writeOrigin).
    const origin = method !== "GET" ? writeOrigin(background, path) : null;
    const init = { method, credentials: "same-origin", headers: { accept: "application/json" }, cache: "no-store" };
    if (requestId) init.headers["x-hof-request"] = requestId;
    if (body !== undefined) {
      init.headers["content-type"] = "application/json";
      init.body = typeof body === "string" ? body : JSON.stringify(body);
    }
    const controller = new AbortController();
    // Dar kontrol 2.4.3 (Y1): zaman aşımı ayrı kodla işaretlenir (client-timeout) — uzun sunucu işinde ekran "hata" yerine "sunucuda sürüyor
    // olabilir" diyebilsin.
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    if (signal) signal.addEventListener("abort", () => controller.abort(), { once: true });
    init.signal = controller.signal;
    let response;
    try {
      response = await nativeFetch(HOF.apiUrl(path), init);
    } catch (error) {
      throw new ApiError(error && error.name === "AbortError" ? "Sunucu zamanında yanıt vermedi." : "Sunucuya ulaşılamadı. Ağ bağlantısını kontrol edin.", 0, timedOut ? { code: "client-timeout" } : undefined);
    } finally {
      clearTimeout(timer);
    }
    // 10.10.2026 (senaryo-banka-210 adım 41, test/e2e/acilis-yanit-yaris.mjs): başlık gelip gövde okunurken bağlantı kesilirse (sayfa
    // yeniden yüklendi/gezindi, ağ koptu) okuma TypeError/AbortError ile düşer. Önceden bu da `{}` sayılıyor ve 200 yanıt "başarılı ama boş"
    // dönüyordu; çağıran beklediği alanı bulamayıp ilgisiz bir TypeError atıyordu ("notes.notes is not iterable"). Artık ağ hatası gibi
    // ApiError (durum 0). JSON olmayan gövde (SyntaxError) eskisi gibi `{}`.
    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      if (error?.name !== "SyntaxError") throw new ApiError("Sunucunun yanıtı yarıda kesildi. Ağ bağlantısını kontrol edip yeniden deneyin.", 0, { code: "response-cut" });
      payload = {};
    }
    if (!response.ok || payload.ok === false) {
      const error = new ApiError(payload.error || "İşlem tamamlanamadı.", response.status, payload);
      if (response.status === 401) HOF.emit("unauthorized", error);
      else if (payload.code === "PASSWORD_CHANGE_REQUIRED") HOF.emit("password-required", error);
      else if (response.status === 503 && payload.code === "MAINTENANCE") HOF.emit("maintenance", payload);
      else if (response.status === 403 && payload.code === "LICENSE_READ_ONLY") HOF.emit("license-read-only", payload);
      // Banka m1 (10.10.2026): sunucu "hesap/kart seçin" dediyse ekranın hesap listesi eskidir (başka oturum hesap açtı, olay henüz gelmedi);
      // açık formların seçicileri taze listeyle yeniden kurulur (hof-bank.js refreshPickers, hof-invoices.js peşin satır hücreleri).
      else if (payload.code === "bank-account-required") HOF.emit("bank-choices-stale", payload);
      throw error;
    }
    if (method !== "GET") {
      noteLedgerChange(path);
      if (origin) noteWrite(origin, path);
    }
    return payload.data === undefined ? payload : payload.data;
  };

  // ---------- Arama katlaması (31f; hof-chips.js zaten HOF.fold'u arar) ----------
  // Türkçe harf duyarsız: "Ayşe" ↔ "ayse" ↔ "AYŞE", "İsmail" ↔ "ismail", "Irmak" ↔ "ırmak"; harf ve rakam dışı karakterler boşluk. hof-chips.js'in
  // kendi yedek katlamasıyla aynı sonuç (yalnız â/î/û da a/i/u olur).
  const FOLD_MAP = { ı: "i", İ: "i", I: "i", ş: "s", Ş: "s", ğ: "g", Ğ: "g", ü: "u", Ü: "u", ö: "o", Ö: "o", ç: "c", Ç: "c", â: "a", Â: "a", î: "i", Î: "i", û: "u", Û: "u" };
  HOF.fold = value =>
    String(value ?? "")
      .replace(/[ıİIşŞğĞüÜöÖçÇâÂîÎûÛ]/g, char => FOLD_MAP[char])
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  // ---------- Başlık yazımı (v2.0.11) ----------
  // Sunucudaki server/lib/text-case.mjs ile aynı kural: her sözcüğün ilk harfi büyük (Türkçe i → İ), bağlaçlar küçük,
  // parantez içi olduğu gibi. Yalnız programın ürettiği başlıklara uygulanır; kullanıcının yazdığı ada değil.
  const SMALL_WORDS = new Set(["ve", "ile", "veya", "ya", "da", "de", "ki"]);
  HOF.titleCase = text => {
    let depth = 0;
    let seenWord = false;
    return String(text ?? "")
      .split(/(\s+)/)
      .map(word => {
        if (!word || /^\s+$/.test(word)) return word;
        const inside = depth > 0 || word.startsWith("(");
        for (const ch of word) {
          if (ch === "(") depth += 1;
          else if (ch === ")") depth = Math.max(0, depth - 1);
        }
        if (inside) return word;
        const bare = word.replace(/[^\p{L}]/gu, "");
        const first = !seenWord;
        if (bare) seenWord = true;
        if (!first && SMALL_WORDS.has(bare) && word === word.toLocaleLowerCase("tr-TR")) return word;
        // GİB'in resmî adları küçük "e-" ile kalır: e-Fatura, e-Arşiv, e-Belge (sunucudaki text-case.mjs ile aynı).
        if (/^[^\p{L}]*e-[A-ZÇĞİÖŞÜ]/u.test(word)) return word;
        const at = word.search(/\p{L}/u);
        if (at < 0 || (at > 0 && /[\p{L}\p{N}]/u.test(word.slice(0, at)))) return word;
        const head = word.slice(0, at) + word[at].toLocaleUpperCase("tr-TR") + word.slice(at + 1);
        // Tireli sözcükte her parça büyük harfle başlar: "Alım-satım" → "Alım-Satım".
        return head.split("-").map((part, index) => (index && /^\p{L}/u.test(part) ? part[0].toLocaleUpperCase("tr-TR") + part.slice(1) : part)).join("-");
      })
      .join("");
  };

  // ---------- Para/stok defteri değişti (v2.0.11) ----------
  // Açık pencereler (Kasa, Cari, Taksitler, Stok, Çek/Senet, Raporlar) kendini tek bir kurala göre yeniler:
  //  - bu ekranda yapılan her yazma isteği (HOF.api) hemen, adresinden çıkarılan türle bildirilir;
  //  - başka bilgisayardaki değişiklik sunucunun herkese (işlemi yapan dahil) yayımladığı "overview.changed" ile gelir.
  // Önceden her pencere yalnız kendi türünü dinliyordu ve sunucu "workspace.changed" olayını işlemi yapana göndermiyordu:
  // Kasa'dan açılan çek kartında ödeme silinince Kasa eski rakamlarla kalıyordu.
  // v2.0.15: fatura stok, cari, Kasa, çek/senet ve taksiti birlikte yazar; tahsilat/ödeme faturanın ödeme durumunu değiştirir.
  const LEDGER_PATHS = [
    [/^\/api\/workspace\/cash\b/, ["cash", "invoices"]],
    [/^\/api\/workspace\/cheques\b/, ["cheques", "cash", "accounts", "invoices"]],
    [/^\/api\/workspace\/accounts\b/, ["accounts", "cash", "plans", "invoices"]],
    [/^\/api\/workspace\/(plans|plan-transfer)\b/, ["plans", "cash", "accounts", "invoices"]],
    [/^\/api\/workspace\/stock\b/, ["stock", "cash", "accounts"]],
    [/^\/api\/workspace\/invoices\b/, ["invoices", "stock", "cash", "accounts", "cheques", "plans"]],
    [/^\/api\/workspace\/(payments\b|cases\/[^/]+\/(payments|plans|account)\b)/, ["cash", "plans", "accounts", "invoices"]],
    [/^\/api\/(admin\/)?trash\b/, ["cash", "plans", "accounts", "stock", "cheques", "invoices"]],
    // v2.1.0: banka yazımları (hesap, açılış, sihirbaz; sonraki aşamalarda hareket, transfer) Banka penceresini ve para gösteren her
    // pencereyi yeniler.
    [/^\/api\/workspace\/bank\b/, ["bank", "cash", "accounts", "invoices", "plans", "cheques"]],
  ];
  // 2.4.3 H2 (fatura yükte hız testi): yalnız hesaplayan / ön izleyen POST istekleri (fatura toplamı, e-Belge görünüm ön izlemesi, Excel
  // ön izlemeleri) hiçbir şey yazmaz. Önceden faturada her Tab / miktar değişikliğinde (POST /invoices/calc) "bu ekranda para/stok değişti"
  // sayılıyor; kritik stok rozeti ve açık para pencereleri beklemeden yeniden isteniyordu (5 pencerede 10 dk'da 1.402 hesap → 1.619 rozet isteği).
  const READ_ONLY_POSTS = [/^\/api\/workspace\/invoices\/(calc|view-preview|gross-from-net)$/, /^\/api\/workspace\/[a-z-]+\/import\/preview$/];
  function noteLedgerChange(path) {
    const clean = String(path || "").split("?")[0];
    if (READ_ONLY_POSTS.some(pattern => pattern.test(clean))) return;
    const hit = LEDGER_PATHS.find(([pattern]) => pattern.test(clean));
    if (hit) HOF.emit("ledger:changed", { kinds: hit[1], local: true, path: clean });
  }
  // ---------- Yükleme hatası (v2.0.22) ----------
  // v2.0.21'de liste yüklenemeyince (yük altında tarayıcı kuyruğunda 30 sn'yi aşan istek) pencere gövdesi — arama kutusu ve
  // süzgeçler dahil — tek satırlık hata yazısıyla değiştiriliyordu: Cari aramasında kutu "kayboluyordu"; açık karttaki
  // arka plan yenilemesi hata alınca kullanıcı karttan listeye atılıyordu. Kural:
  //  - arka plan yenilemesi (quiet) başarısızsa ekran olduğu gibi kalır; HOF.refresher yeniden dener;
  //  - kullanıcının kendi yüklemesi (yeni arama, süzgeç, sekme) başarısızsa eski satırlar GÖSTERİLMEZ — yeni süzgecin altında
  //    eski liste kalırsa "Tümünü Seç" gibi toplu işlemler görünmeyen kayıtlara uygulanır; liste alanında neden ve "Yeniden
  //    Dene" görünür, arama kutusu ve süzgeçler yerinde kalır (HOF.listPending);
  //  - "Daha Fazla Göster" başarısızsa görünen satırlar aynı süzgece aittir; kalır, bildirim çıkar.
  // Silinmiş kayıt (404) ya da yetkinin kalkması (403) arka planda da bildirilir: eski hâlin gösterilmesi yanıltır.
  HOF.lostRecord = error => error?.status === 404 || error?.status === 403;
  // Liste yüklemelerinin sırası (v2.0.22; Cari, Fatura, Stok, Taksit, Çek/Senet aynı kural):
  //  - kullanıcının yüklemesi (yeni arama, süzgeç, sekme) sıra numarasını artırır: daha eski yanıtlar yok sayılır;
  //  - arka plan yenilemesi (quiet) artırmaz: kullanıcının sürmekte olan araması geçersiz sayılmaz;
  //  - aynı sıradaki iki yanıttan, sonra başlamış olan ekrana yazıldıysa önce başlamış olanınki yazılmaz (eski okuma
  //    yeni veriyi ezmesin);
  //  - süzgeç yüklemesi sürerken "Daha Fazla" yok sayılır (eski listenin uzunluğu yeni süzgece uygulanmasın).
  // 2.1.0 (bağımsız inceleme H4, 11.10.2026): "Daha Fazla"nın yanıtı yalnız isteğin gittiği listeye eklenir. Önceden Daha Fazla sürerken
  // arka plan yenilemesi listeyi taze ilk sayfayla değiştirirse Daha Fazla'nın yanıtı (eski listenin devamı) yeni listeye ekleniyordu: sayfa
  // sınırındaki kayıt ekranda hiç görünmüyordu (Banka → Hareketler'de üretildi; Cari, Fatura, Stok, Çek/Senet aynı kapıyı kullanır). Kural:
  //  - her yazılan yanıt listenin sürümünü artırır; Daha Fazla başladığı sürüm değiştiyse yazılmaz, retry() → çağıran Daha Fazla'yı YENİ
  //    listenin sonundan yeniden ister;
  //  - arka plan yenilemesi (quiet) başladıktan sonra Daha Fazla yazıldıysa (liste uzadı) yazılmaz, retry() → yeni uzunlukla yeniden ister
  //    (Daha Fazla ile açılan satırlar geri alınmasın); daha yeni bir yenileme yazıldıysa yalnız düşer;
  //  - Daha Fazla artık arka plan yenilemesini geçersiz saymaz (ikisi de yazılır, sırası ne olursa olsun sonuç: taze + uzamış liste).
  HOF.listGate = () => {
    let ticket = 0;
    let seq = 0;
    let applied = 0;
    let pending = 0;
    let more = 0;
    let version = 0;
    let grown = 0;
    return {
      start({ quiet = false, more: isMore = false } = {}) {
        if (isMore && pending) return null;
        // Kullanıcının yüklemesi (yeni arama, süzgeç, sekme) bütün eski yanıtları geçersiz sayar; Daha Fazla yalnız önceki Daha Fazla'yı.
        const own = quiet || isMore ? ticket : ++ticket;
        const ownMore = isMore ? ++more : more;
        const order = ++seq;
        const base = version;
        if (!quiet && !isMore) pending = own;
        const alive = () => own === ticket && (!isMore || ownMore === more);
        // Daha Fazla: başladığından beri herhangi bir yanıt yazıldıysa eski. Arka plan yenilemesi: başladığından beri Daha Fazla yazıldıysa eski.
        const stale = () => (isMore ? version !== base : quiet && grown > base);
        const ordered = () => isMore || order >= applied;
        return {
          current: () => alive() && ordered() && !stale(),
          // Yanıt yazılmadı ama istek hâlâ geçerli (yalnız liste arada değişti): aynı türden istek yeni listeyle yinelenir.
          retry: () => alive() && ordered() && stale(),
          applied: () => {
            version += 1;
            if (isMore) grown = version;
            else applied = order;
          },
          done: () => {
            if (!quiet && !isMore && pending === own) pending = 0;
          },
        };
      },
    };
  };
  // Liste yüklemesini kapının retry() kararıyla en çok 3 kez yineler (load: tek deneme; true dönerse liste arada değişmiştir).
  HOF.listRetry = async load => {
    for (let attempt = 0; attempt < 3; attempt += 1) if (!(await load())) return;
  };
  HOF.listPending = message =>
    message
      ? `<p class="hof-empty hof-list-error" role="alert">Liste alınamadı: ${HOF.esc(message)} <button type="button" class="hof-link-button" data-act="retryList">Yeniden Dene</button></p>`
      : '<p class="hof-empty">Yükleniyor…</p>';

  // ---------- Arka plan yenilemesi (v2.0.22) ----------
  // Excel denetimi ölçümü: başka personel saniyede bir kayıt girerken açık her pencere her olayda 3–7 isteği yeniden
  // gönderiyordu (bir fatura 5–7 olay yayımlar: fatura, cari, her stok kalemi, Kasa, taksit; ardından ANLIK DURUM).
  // Kurallar (bütün pencerelerde aynı):
  //  - bir yenileme sürerken gelen istekler bitince TEK yenileme yaptırır — değişiklik kaçmaz, istek yığılmaz;
  //  - başka bilgisayardan gelen değişiklikte ilk yenileme `delay` ms sonra (aynı işlemin olayları birlikte gelsin),
  //    iki yenileme arası en az `gap` ms;
  //  - bu ekranda yapılan işlem (yerel) beklemeden yeniler: refresh.now();
  //  - sekme gizliyken yenilenmez; görünür olunca bir kez yenilenir;
  //  - yenileme başarısızsa (ağ, zaman aşımı; yükleyici hatayı fırlatır) ekran son hâlinde kalır ve artan beklemeyle en çok
  //    3 kez yeniden denenir — başka bir değişiklik gelmese de eski veri ekranda kalmaz.
  HOF.refresher = (load, { delay = 450, gap = 1500 } = {}) => {
    let timer = 0;
    let running = false;
    let again = false;
    let urgent = false;
    let hidden = false;
    let last = 0;
    let failures = 0;
    const run = async () => {
      timer = 0;
      if (document.hidden) {
        hidden = true;
        return;
      }
      running = true;
      again = false;
      urgent = false;
      last = Date.now();
      let failed = false;
      try {
        await load();
        failures = 0;
      } catch {
        failed = true;
      } finally {
        running = false;
        if (urgent) run();
        else if (again) schedule(0);
        else if (failed && failures < 3) {
          failures += 1;
          schedule(gap * 2 ** failures);
        }
      }
    };
    const schedule = wait => {
      if (running) {
        again = true;
        return;
      }
      if (timer) return;
      timer = setTimeout(run, Math.max(wait, last + gap - Date.now()));
    };
    document.addEventListener("visibilitychange", () => {
      if (document.hidden || !hidden) return;
      hidden = false;
      schedule(0);
    });
    const refresh = () => schedule(delay);
    refresh.now = () => {
      if (running) {
        again = true;
        urgent = true;
        return;
      }
      clearTimeout(timer);
      timer = 0;
      run();
    };
    return refresh;
  };

  // onLedger(["cash"], yenile): türlerden biri değişince (yerel ya da canlı) kısa gecikmeyle bir kez çağrılır.
  HOF.onLedger = (kinds, handler, delay = 250) => {
    const wanted = new Set(kinds);
    let timer = null;
    // v2.0.22 (gözden geçirme bulgusu 9): bu ekrandaki işlemin olayı (local) ile aynı işlemin ANLIK DURUM olayı bekleme
    // içinde birleşir; "yerel" bilgisi kaybolmaz (pencere beklemeden yenilenir, en sık aralığa takılmaz). Bekleme içinde
    // başka bir olay da geldiyse (başka personelin değişikliği olabilir) yol bilgisi taşınmaz: kendi modülünün yolunu yok
    // sayan pencere o değişikliği kaçırmasın.
    let local = null;
    let foreign = false;
    const fire = detail => {
      const list = detail?.kinds || [];
      if (list.length && !list.some(kind => wanted.has(kind))) return;
      if (detail?.local) local = local || detail;
      else foreign = true;
      clearTimeout(timer);
      timer = setTimeout(() => {
        const merged = local ? { ...(detail || {}), local: true, path: foreign ? "" : local.path } : detail || {};
        local = null;
        foreign = false;
        handler(merged);
      }, delay);
    };
    HOF.on("ledger:changed", fire);
    HOF.on("live:overview.changed", fire);
    HOF.on("live:resync", () => fire({}));
  };

  // ---------- Kendi arayüz düğümlerimiz ----------
  // data-hof-ui taşıyan düğümlerdeki değişiklikler DOM izleyiciyi tetiklemez (sonsuz döngü koruması).
  HOF.el = (tag, attrs = {}, html = "") => {
    const node = document.createElement(tag);
    node.setAttribute("data-hof-ui", "");
    for (const [key, value] of Object.entries(attrs)) {
      if (value === false || value == null) continue;
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key === "href" || key === "src") node.setAttribute(key, HOF.apiUrl(String(value)));
      else node.setAttribute(key, value === true ? "" : value);
    }
    if (html) node.innerHTML = html;
    return node;
  };

  // ---------- Bildirimler ----------
  const toastHost = () => {
    let host = document.getElementById("hof-toasts");
    if (!host) {
      host = HOF.el("div", { id: "hof-toasts", class: "hof-toasts", role: "status", "aria-live": "polite" });
      document.body.appendChild(host);
    }
    return host;
  };
  // 2.4.3 (keşif A11 / B5 / C8): süre metnin uzunluğuna göre (okuma hızı ~15 harf/sn); hata bildirimi en az 7 sn; en çok 30 sn.
  // Fare üstündeyken ya da odaktayken kapanmaz, ayrılınca kalan süre (en az 2 sn) sürer.
  // A6: aynı tür ve metindeki bildirim ekranda zaten varsa yenisi eklenmez; var olanın süresi baştan başlar ve sayacı artar (×2, ×3…).
  const READ_CHARS_PER_SECOND = 15;
  // Fare bildirimin üstünde mi: bildirim tıklamayı engellemediği için (altındaki sekme / düğme tıklanabilir) mouseenter gelmez; konum izlenir.
  // 2.4.3 (CI #837 B4, test/e2e/form-izolasyon-b4-yaris.mjs): bildirim fare DURURKEN de kayar (sağ alttaki açılır bildirim açılınca / kapanınca
  // kutu ~150 px oynar, pencere açılınca üst ortaya geçer); mousemove gelmez. Bu yüzden (1) kapanma anında fare bildirimin üstündeyse kapanmaz,
  // (2) fare üstündeyken konum yarım saniyede bir yeniden ölçülür: bildirim fareden uzaklaştıysa bekleme biter.
  let hoverFrame = 0;
  let hoverRecheck = 0;
  let pointer = null;
  const pointerOver = item => {
    if (!pointer) return false;
    const box = item.getBoundingClientRect();
    return pointer.x >= box.left && pointer.x <= box.right && pointer.y >= box.top && pointer.y <= box.bottom;
  };
  const checkToastHover = () => {
    hoverFrame = 0;
    clearTimeout(hoverRecheck);
    hoverRecheck = 0;
    const host = document.getElementById("hof-toasts");
    if (!host || !pointer) return;
    let anyOver = false;
    for (const item of host.children) {
      if (!item.hofHover) continue;
      const over = pointerOver(item);
      if (over) anyOver = true;
      if (over !== Boolean(item.hofOver)) {
        item.hofOver = over;
        item.hofHover(over);
      }
    }
    if (anyOver) hoverRecheck = setTimeout(checkToastHover, 500);
  };
  document.addEventListener(
    "mousemove",
    event => {
      pointer = { x: event.clientX, y: event.clientY };
      if (!hoverFrame) hoverFrame = requestAnimationFrame(checkToastHover);
    },
    { passive: true, capture: true },
  );
  document.addEventListener("mouseleave", () => {
    pointer = { x: -1, y: -1 };
    checkToastHover();
  });
  HOF.toastDuration = (message, { type = "info", timeout = 3600, action = false } = {}) => {
    const reading = 1500 + Math.ceil((String(message ?? "").length / READ_CHARS_PER_SECOND) * 1000);
    return Math.min(30000, Math.max(Number(timeout) || 0, type === "error" ? 7000 : 0, action ? 7000 : 0, reading));
  };
  // Panoya yazma: güvenli bağlamda (https / localhost) Pano API'si; personel bilgisayarı sunucuya http://<ip>:5123 ile bağlanır — orada
  // navigator.clipboard yoktur → gizli metin kutusu + document.execCommand("copy"). İkisi de olmazsa false (çağıran metni seçili gösterir).
  HOF.copyText = async text => {
    try {
      if (window.isSecureContext && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      /* izin yok: yedek yola geçilir */
    }
    const active = document.activeElement;
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none";
    document.body.appendChild(area);
    let done = false;
    try {
      area.focus({ preventScroll: true });
      area.select();
      done = document.execCommand("copy") === true;
    } catch {
      done = false;
    } finally {
      area.remove();
      if (active?.focus && active.isConnected) active.focus({ preventScroll: true });
    }
    return done;
  };
  // 23.10.2026 (ekran gezintisi): "e-Belge", "e-Fatura", "e-Arşiv", "e-SMM", "e-Posta" gibi adlar uzun bildirimde kısa çizgiden satıra bölünüyordu
  // ("belgenin e-" / "Belge durumu"). Ad, satır kırılmayan (white-space: nowrap) bir span'e alınır; metin yalnız metin düğümü olarak yazılır (innerHTML yok),
  // karakter eklenmez (U+2011 gibi bölünmez tire Kopyala'nın ve aramanın metnini değiştirirdi) → textContent ve Kopyala aynı metin.
  const NO_BREAK_NAME = /(^|[^\p{L}\p{N}])([eE]-\p{L}+)/gu;
  const fillToastText = (target, message) => {
    let last = 0;
    for (const match of message.matchAll(NO_BREAK_NAME)) {
      const start = match.index + match[1].length;
      if (start > last) target.append(message.slice(last, start));
      target.append(HOF.el("span", { class: "hof-nobreak", text: match[2] }));
      last = start + match[2].length;
    }
    if (last < message.length) target.append(message.slice(last));
  };
  HOF.toast = (message, { type = "info", action, timeout = 3600 } = {}) => {
    const host = toastHost();
    const sameKey = `${type}\u0001${String(message)}`;
    const duration = HOF.toastDuration(message, { type, timeout, action: Boolean(action) });
    const twin = !action && [...host.children].find(item => item.hofKey === sameKey && !item.hofLeaving);
    if (twin) {
      twin.hofRepeat(duration);
      return twin;
    }
    const node = HOF.el("div", { class: `hof-toast hof-toast-${type}` });
    node.hofKey = sameKey;
    const text = HOF.el("span", { class: "hof-toast-text" });
    fillToastText(text, String(message));
    node.appendChild(text);
    if (action) {
      const button = HOF.el("button", { type: "button", class: "hof-toast-action", text: action.label });
      button.onclick = () => {
        node.remove();
        action.onClick();
      };
      node.appendChild(button);
    }
    // Kullanıcı kararı 18.10.2026 ("evet kopyala düğmesi ekle"): bildirim tıklamayı geçirdiği için metni fareyle seçilemiyor; hata ve uyarı
    // bildiriminde "Kopyala" düğmesi TAM metni (EDM kodu dahil, ×N sayacı hariç) panoya yazar.
    if (["error", "warn", "warning"].includes(type)) {
      const copy = HOF.el("button", { type: "button", class: "hof-toast-copy", "aria-label": "Bildirimi Kopyala", text: "Kopyala" });
      copy.onclick = async () => {
        const done = await HOF.copyText(String(message));
        if (done) {
          copy.textContent = "Kopyalandı";
          setTimeout(() => {
            if (copy.isConnected) copy.textContent = "Kopyala";
          }, 1800);
          return;
        }
        // Pano kapalı (güvenli olmayan bağlam, izin yok): metin seçili bir kutuda gösterilir; Ctrl+C ile kopyalanır.
        let box = node.querySelector(".hof-toast-copybox");
        if (!box) {
          box = HOF.el("textarea", { class: "hof-toast-copybox", readonly: "readonly", rows: "3", "aria-label": "Bildirim Metni" });
          box.value = String(message);
          node.appendChild(box);
        }
        box.focus();
        box.select();
      };
      node.appendChild(copy);
    }
    const close = HOF.el("button", { type: "button", class: "hof-toast-close", "aria-label": "Bildirimi kapat", text: "×" });
    close.onclick = () => node.remove();
    node.appendChild(close);
    host.appendChild(node);
    // En fazla 4 bildirim görünür; eskisi kapanır.
    while (host.children.length > 4) host.firstElementChild.remove();
    requestAnimationFrame(() => node.classList.add("is-visible"));
    let remaining = duration;
    let startedAt = 0;
    let timer = 0;
    let held = false;
    let repeats = 1;
    const leave = () => {
      timer = 0;
      // Fare dururken bildirim altına kaymış olabilir (mousemove gelmedi): kapanma anında konum yeniden ölçülür.
      if (pointerOver(node)) {
        node.hofOver = true;
        remaining = 0;
        hold();
        checkToastHover();
        return;
      }
      node.hofLeaving = true;
      node.classList.remove("is-visible");
      setTimeout(() => node.remove(), 250);
    };
    const run = () => {
      clearTimeout(timer);
      startedAt = Date.now();
      timer = setTimeout(leave, remaining);
    };
    const hold = () => {
      if (held) return;
      held = true;
      if (timer) remaining = Math.max(2000, remaining - (Date.now() - startedAt));
      clearTimeout(timer);
      timer = 0;
    };
    const release = () => {
      if (!held || node.hofLeaving) return;
      held = false;
      remaining = Math.max(2000, remaining);
      run();
    };
    // Bildirim tıklamayı geçirir (CSS pointer-events: none); fare üstünde mi, konumdan izlenir (checkToastHover).
    node.hofHover = over => (over ? hold() : release());
    node.addEventListener("focusin", hold);
    node.addEventListener("focusout", event => {
      if (!node.contains(event.relatedTarget)) release();
    });
    node.hofRepeat = next => {
      repeats += 1;
      let count = node.querySelector(".hof-toast-count");
      if (!count) {
        count = HOF.el("span", { class: "hof-toast-count", "aria-label": "Tekrar sayısı" });
        node.insertBefore(count, text.nextSibling);
      }
      count.textContent = `×${repeats}`;
      remaining = Math.max(next, remaining);
      if (!held) {
        remaining = next;
        run();
      }
      // Tekrar eden bildirim en alta (en yeni yerine) taşınmaz; yerinde kısa bir vurgu alır.
      node.classList.remove("is-repeat");
      void node.offsetWidth;
      node.classList.add("is-repeat");
    };
    run();
    return node;
  };
  // v2.0.26 (2. gözden geçirme İ6): eksi bakiye sorusunda "Vazgeç" bir hata değil, kullanıcının kararı: bilgi bildirimi.
  // Yargıç (2.1.0): banka sorularındaki "Vazgeç" de (bank-negative-cancelled, bank-similar-cancelled) kullanıcının kararıdır: bilgi bildirimi.
  HOF.userCancelled = error => /-cancelled$/.test(String(error?.data?.code || ""));
  HOF.toastError = error => (HOF.userCancelled(error) ? HOF.toast(error.message, { type: "info" }) : HOF.toast((error && error.message) || String(error), { type: "error", timeout: 7000 }));

  // ---------- Pencereler ----------
  const openModals = [];
  let lastPressed = null;
  document.addEventListener("pointerdown", event => { lastPressed = event.target?.closest?.("button, a, [tabindex]") || null; }, true);
  // 2.4.3 (form durumu izole): kullanıcının kendi değiştirdiği alan "dokunulmuş" sayılır ve penceresini "kaydedilmemiş" yapar.
  // Kapsam: alanın en yakın [data-hof-form] öğesi (pencere içi formlar: fatura formu, Fatura Ayarları — kapsam öğesi ekrandan kalkınca,
  // ör. kaydedip karta geçince, kirlilik de kalkar), yoksa <form> (form pencereleri; kapanana kadar), yoksa alanın kendisi (ekranda ve
  // değeri kayıtlı değerinden farklı oldukça).
  const noteTouched = event => {
    if (!event.isTrusted) return;
    const node = event.target;
    if (!HOF.isDraftField(node)) return;
    touched.add(node);
    const dialog = node.closest(".hof-modal");
    if (dialog) openModals.find(item => item.dialog === dialog)?.touch(node);
  };
  document.addEventListener("input", noteTouched, true);
  document.addEventListener("change", noteTouched, true);
  // Pencere içindeki açık öneri listesi (cari, stok, tablodaki kayıt): Esc önce yalnız listeyi kapatır (keşif B4).
  const POPUP_LISTS = ".hof-case-picker-list:not([hidden]), .hof-inv-item-hits:not([hidden]), .hof-free-suggest:not([hidden])";
  const closePopups = dialog => {
    const open = [...dialog.querySelectorAll(POPUP_LISTS)].filter(list => list.getClientRects().length && list.children.length);
    for (const list of open) list.hidden = true;
    return open.length > 0;
  };
  HOF.closeQuestion = () => HOF.confirm({ title: "Kaydedilmemiş Değişiklik", message: "Kaydedilmemiş değişiklikler kaybolacak. Kapatılsın mı?", confirmLabel: "Kaydetmeden Kapat", cancelLabel: "Forma Dön", danger: true });
  // beforeClose (v2.1.0 GG2): kullanıcı kapatırken (Kapat, Esc, dışına tıklama, tarayıcının Geri tuşu) çağrılır; false ya da false'a çözülen
  // söz kapanmayı durdurur. Verilmezse (2.4.3) pencerede kaydedilmemiş değişiklik varsa ortak soru sorulur. Programın kendi close() çağrısı
  // (Kaydet'ten sonra, Vazgeç düğmesi) sorusuz kapatır.
  HOF.modal = ({ title, eyebrow = "DESTEKOFİS", body = "", size = "", dismissible = true, onOpen, onClose, beforeClose = null } = {}) => {
    // v2.0.14: açan öğe. Tıklama odak vermemişse (ör. panel mousedown'ı yutuyor) son basılan düğme alınır; pencere
    // açıkken o düğme yeniden kurulmuş olabilir (canlı yenileme) — kapanınca odak aynı anahtarlı yeni düğmeye döner, boşa
    // (body) düşmez.
    const previousFocus = document.activeElement && document.activeElement !== document.body ? document.activeElement : lastPressed && lastPressed.isConnected ? lastPressed : null;
    const previousKey = HOF.focusKey?.(previousFocus) || "";
    const titleId = `hof-modal-title-${Math.random().toString(36).slice(2, 8)}`;
    const node = HOF.el(
      "div",
      { class: "hof-modal-backdrop" },
      `<section class="hof-modal ${size ? `hof-modal-${size}` : ""}" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
        ${dismissible ? '<button type="button" class="hof-modal-close" aria-label="Kapat">×</button>' : ""}
        <p class="hof-eyebrow">${HOF.esc(eyebrow)}</p>
        <h2 id="${titleId}" class="hof-modal-title">${HOF.esc(title)}</h2>
        <div class="hof-modal-body">${body}</div>
      </section>`,
    );
    const dialog = node.querySelector(".hof-modal");
    let closed = false;
    let asking = false;
    const scopes = new Set();
    const focusBack = () => {
      const back = previousFocus && previousFocus.isConnected ? previousFocus : previousKey ? document.querySelector(previousKey) : null;
      if (!back || !back.focus || back === document.body) return false;
      back.focus({ preventScroll: true });
      return document.activeElement === back;
    };
    const finish = result => {
      if (closed) return;
      closed = true;
      node.classList.remove("is-visible");
      document.removeEventListener("keydown", onKey, true);
      openModals.splice(openModals.indexOf(api), 1);
      setTimeout(() => node.remove(), 160);
      focusBack();
      // A10: Kaydet'ten sonra açan pencere kendini yeniden çizer (açan düğme yenisiyle değişir); odak boşa (body) düştüyse aynı anahtarlı
      // düğmeye, o da yoksa açık kalan üst pencereye döner. Bu arada başka bir pencere açıldıysa ya da odak başka yerdeyse dokunulmaz.
      const guard = () => {
        const now = document.activeElement;
        if (now && now !== document.body && now.isConnected) return;
        if (focusBack()) return;
        const top = openModals[openModals.length - 1];
        // 2.4.3 (uzman UX4/UX10): üst pencerede odak × (Kapat) düğmesine değil ilk yazılabilir alana döner; × üstünde Enter pencereyi kapatıp
        // (kaydedilmemiş formda) soruya, ikinci Enter veriyi silmeye götürüyordu.
        if (top) focusStart(top.dialog)?.focus({ preventScroll: true });
      };
      for (const wait of [60, 250, 700, 1500]) setTimeout(guard, wait);
      if (onClose) onClose(result);
    };
    // Kullanıcının kapatması (Kapat düğmesi, Esc, dışına tıklama, Geri tuşu): beforeClose ya da ortak "kaydedilmemiş" sorusu.
    const userClose = () => {
      if (closed || asking) return;
      const guard = beforeClose || (() => (api.isDirty() ? HOF.closeQuestion() : true));
      const answer = guard();
      if (answer === false) return;
      if (answer && typeof answer.then === "function") {
        asking = true;
        answer.then(ok => {
          asking = false;
          if (ok !== false) finish();
        }, () => {
          asking = false;
        });
        return;
      }
      finish();
    };
    const close = result => finish(result);
    const focusables = () => focusablesOf(dialog);
    const onKey = event => {
      if (openModals[openModals.length - 1] !== api) return;
      if (event.key === "Escape" && dismissible) {
        event.preventDefault();
        // Açık öneri listesi varsa Esc yalnız onu kapatır; pencere açık kalır.
        if (closePopups(dialog)) {
          event.stopPropagation();
          return;
        }
        // 2.4.3 (uzman UX26): pencere içinde "Esc'te geri" işaretli görünür bir adım varsa (data-esc-back; ör. Fatura Ayarları → "← Liste") Esc
        // önce o adıma döner, pencere kapanmaz. Kaydedilmemiş değişiklik varsa ortak soru sorulur ("Forma Dön" ile kalınır).
        const step = [...dialog.querySelectorAll("[data-esc-back]")].find(button => !button.disabled && button.getClientRects().length);
        if (step) {
          event.stopPropagation();
          if (closed || asking) return;
          if (!api.isDirty()) return void step.click();
          asking = true;
          HOF.closeQuestion().then(ok => {
            asking = false;
            if (ok !== false && step.isConnected) step.click();
          }, () => {
            asking = false;
          });
          return;
        }
        userClose();
      } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !event.altKey) {
        // A16: Ctrl+Enter formu kaydeder (Not Ekle ve çok satırlı not alanları dahil; Enter metin alanında yeni satırdır).
        const form = event.target?.closest?.("form");
        if (!form || !dialog.contains(form)) return;
        event.preventDefault();
        event.stopPropagation();
        const submit = form.querySelector('button[type="submit"]:not([disabled])');
        if (submit) form.requestSubmit(submit);
        else if (!form.querySelector('button[type="submit"]')) form.requestSubmit();
      } else if (event.key === "Tab") {
        const items = focusables();
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const api = {
      node,
      dialog,
      close,
      // Kullanıcının kapatması gibi (sorabilir): Esc / × / dışına tıklama / Geri tuşu.
      dismiss: userClose,
      touch(field) {
        const scoped = field.closest("[data-hof-form]");
        if (scoped && dialog.contains(scoped)) scopes.add(`attr:${scoped.getAttribute("data-hof-form")}`);
        else if (field.closest("form") && dialog.contains(field.closest("form"))) scopes.add("form");
      },
      isDirty() {
        for (const scope of [...scopes]) {
          const alive = scope === "form" ? dialog.querySelector("form") : dialog.querySelector(`[data-hof-form="${CSS.escape(scope.slice(5))}"]`);
          if (alive) return true;
          scopes.delete(scope);
        }
        return [...dialog.querySelectorAll("input, textarea, select")].some(field => touched.has(field) && HOF.isDraftField(field) && changedField(field));
      },
      clean() {
        scopes.clear();
        for (const field of dialog.querySelectorAll("input, textarea, select")) touched.delete(field);
      },
      wrote(query) {
        for (const field of dialog.querySelectorAll("input, textarea, select")) touched.delete(field);
        if (!query) scopes.clear();
      },
      // Tarayıcının Geri tuşu: pencere içinde "← Liste" gibi bir geri düğmesi görünürse önce o (kart → liste), yoksa pencere kapanır.
      back() {
        if (!dismissible) return;
        const step = [...dialog.querySelectorAll(".hof-plan-back")].find(button => !button.disabled && button.getClientRects().length);
        if (step) step.click();
        else userClose();
      },
    };
    openModals.push(api);
    document.addEventListener("keydown", onKey, true);
    if (dismissible) {
      node.querySelector(".hof-modal-close").onclick = () => userClose();
      node.addEventListener("mousedown", event => {
        if (event.target === node) userClose();
      });
    }
    document.body.appendChild(node);
    requestAnimationFrame(() => node.classList.add("is-visible"));
    if (dismissible) armHistoryGuard();
    if (onOpen) onOpen(api);
    // Odak hemen (eşzamanlı) verilir; gecikmeli odak, hızlı yazan kullanıcının metnini başka alana kaydırabiliyordu.
    const target = dialog.querySelector("[autofocus]") || dialog.querySelector("input, textarea, select") || focusables()[0];
    if (target) target.focus({ preventScroll: true });
    return api;
  };
  const focusablesOf = dialog => [...dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(item => !item.disabled && item.offsetParent !== null);
  // Pencerenin başlangıç odağı (2.4.3, uzman UX4/UX10): görünür [autofocus], yoksa ilk yazılabilir alan, yoksa × dışındaki ilk odaklanabilir öğe,
  // en son ×. Gizli alan (type=hidden, gizli bölüm) seçilmez — odak verilemeyip boşa (body) düşüyordu.
  const visibleNode = node => Boolean(node) && !node.disabled && node.offsetParent !== null;
  const focusStart = dialog => {
    const auto = [...dialog.querySelectorAll("[autofocus]")].find(visibleNode);
    if (auto) return auto;
    const field = [...dialog.querySelectorAll(SAFE_FIELD)].find(visibleNode);
    if (field) return field;
    const items = focusablesOf(dialog);
    return items.find(item => !item.matches(".hof-modal-close")) || items[0] || null;
  };
  HOF.focusStart = focusStart;
  HOF.hasOpenModal = () => openModals.length > 0;
  // Açık pencerelerden biri kaydedilmemiş değişiklik taşıyor mu (F5 / sekmeyi kapatma sorusu, testler).
  HOF.hasDirtyModal = () => openModals.some(item => item.isDirty());

  // ---------- Tarayıcının Geri tuşu ve sayfayı yenileme (2.4.3, keşif C10) ----------
  // İlk pencere açılınca geçmişe tek bir "pencere" kaydı eklenir (adres değişmez; React yönlendiricisi aynı adresi görür). Geri tuşu bu kaydı
  // tüketir: pencere açıksa kayıt yeniden kurulur ve en üstteki pencere geri gider (içinde "← Liste" varsa önce karttan listeye, yoksa pencere
  // kapanır — kaydedilmemiş değişiklik varsa sorar). Pencere açık değilken Geri'ye basılırsa geri gitme olduğu gibi sürdürülür.
  // Program kendisi hiç history.back() demez: pencere kapanınca kayıt yerinde kalır, sonraki pencere aynı kaydı kullanır. (İlk sürümde son
  // pencere kapanınca history.back() deniyordu; Chromium kullanıcı etkileşimsiz eklenen kayıtları atlayabildiği ve yenilemeden kalan kayıtlar
  // karıştığı için bu geri gitme bazen önceki belgeye kadar uzanıp programı yeniden yüklüyordu — run.mjs "Excel'e aktarılır" adımı.)
  // Kayıt bu belgeye özgü işaret taşır: sayfa yenilenince eski belgenin işareti geçmişte kalır, ona güvenilmez.
  const HISTORY_MARK = `hof-${Math.random().toString(36).slice(2, 10)}`;
  const guardActive = () => history.state?.hofModal === HISTORY_MARK;
  let guardOnTop = false;
  let forwarding = false;
  function armHistoryGuard() {
    if (guardActive()) {
      guardOnTop = true;
      return;
    }
    try {
      history.pushState({ ...(history.state && typeof history.state === "object" ? history.state : {}), hofModal: HISTORY_MARK }, "");
      guardOnTop = true;
    } catch {
      /* geçmiş yazılamıyorsa (ör. sandbox) Geri tuşu eskisi gibi çalışır */
    }
  }
  window.addEventListener("popstate", () => {
    const wasGuard = guardOnTop;
    guardOnTop = guardActive();
    if (forwarding) {
      forwarding = false;
      return;
    }
    if (openModals.length) {
      if (guardOnTop) return;
      // Kayıt tüketildi: yeniden kur (pencere kapanmazsa sonraki Geri de yakalanır), sonra en üstteki pencereyi geri götür.
      armHistoryGuard();
      openModals[openModals.length - 1].back();
      return;
    }
    // Pencere yokken Geri: yalnız bizim kaydımız tüketildiyse kullanıcının istediği geri gitme bir adım daha sürdürülür.
    if (wasGuard && !guardOnTop) {
      forwarding = true;
      try {
        history.back();
      } catch {
        forwarding = false;
      }
    }
  });
  // ---------- Öneri listelerinde klavye (2.4.3, keşif B10) ----------
  // Cari seçici, tablodaki kayıt seçici ve fatura kalemi (stok) önerilerinde Aşağı / Yukarı ok satırı işaretler, Enter işaretli satırı
  // seçer (işaret yoksa her seçicinin kendi Enter kuralı: tam eşleşen ya da ilk satır), Esc listeyi kapatır (pencereyi değil).
  const SUGGEST_ITEMS = "li[data-id], li[data-key], li[data-item], li[data-new-item]";
  const suggestListOf = input => {
    if (!input || input.tagName !== "INPUT") return null;
    let list = input.closest(".hof-case-picker")?.querySelector(".hof-case-picker-list") || null;
    if (!list && input.dataset.l !== undefined && (input.dataset.f === "name" || input.dataset.f === "code")) list = input.closest(".hof-modal")?.querySelector(`.hof-inv-item-hits[data-hits="${CSS.escape(input.dataset.l)}"]`) || null;
    return list && !list.hidden && list.querySelector(SUGGEST_ITEMS) ? list : null;
  };
  HOF.pickSuggestion = item => {
    const list = item.parentElement;
    item.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    // Cari / kayıt seçici mousedown'da seçer ve listeyi boşaltır; stok önerisi tıklamayla seçilir.
    if (item.isConnected && list && !list.hidden) item.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  };
  document.addEventListener(
    "keydown",
    event => {
      if (!["ArrowDown", "ArrowUp", "Enter"].includes(event.key) || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
      const list = suggestListOf(event.target);
      if (!list) return;
      const items = [...list.querySelectorAll(SUGGEST_ITEMS)];
      const current = items.findIndex(item => item.classList.contains("is-active"));
      if (event.key === "Enter") {
        if (current < 0) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        HOF.pickSuggestion(items[current]);
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      const next = current < 0 ? (event.key === "ArrowDown" ? 0 : items.length - 1) : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items.forEach((item, index) => {
        item.classList.toggle("is-active", index === next);
        item.setAttribute("aria-selected", String(index === next));
      });
      items[next].scrollIntoView({ block: "nearest" });
    },
    true,
  );

  // F5 / sekmeyi kapatma: açık bir formda kaydedilmemiş değişiklik varsa tarayıcının "Siteden ayrılınsın mı?" sorusu.
  // Programın kendi yenilemesi / yönlendirmesi (şirket değişti, yeni şirket açıldı, oturum düştü, güncelleme…) sorulmaz: Chromium'un Navigation
  // API'si betikten başlayan belge değişikliğini (userInitiated false) beforeunload'dan ÖNCE bildirir. F5, sekmeyi kapatma ve adres çubuğu
  // bu olayı üretmez; onlar sorulur. (Navigation API olmayan tarayıcıda programın yenilemesi de sorar — bilinen sınır.)
  let scriptLeaving = 0;
  window.navigation?.addEventListener?.("navigate", event => {
    if (event.userInitiated || event.destination?.sameDocument) return;
    clearTimeout(scriptLeaving);
    scriptLeaving = setTimeout(() => {
      scriptLeaving = 0;
    }, 3000);
  });
  window.addEventListener("beforeunload", event => {
    if (scriptLeaving || !HOF.hasDirtyModal()) return;
    event.preventDefault();
    event.returnValue = "";
  });

  /** Yerel takvimle bugün (YYYY-AA-GG); toISOString gece yarısından sonra dünü verir. */
  HOF.localToday = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  // 2.4.3 (uzman UX4): yıkıcı onaylarda (danger ya da silen / kapatan / iptal eden düğme adı) varsayılan odak GÜVENLİ düğmededir (Vazgeç,
  // Forma Dön): yanlışlıkla Esc + Enter doldurulmuş formu kaydetmeden kapatmaz, Enter hareketi / belgeyi silmez (yaygın programların davranışı).
  // Yıkıcı işlem bilerek seçilir: fareyle ya da Tab ile düğmeye geçip Enter. Yıkıcı olmayan onaylarda (Kaydet, Aktar, Başla) odak onay düğmesindedir.
  const DESTRUCTIVE_LABEL = /(^|\s)(Sil|Kaldır|Kapat|Çık|Atla|İptal|Üzerine)(\s|$)/u;
  HOF.confirm = ({ title, message, confirmLabel = "Onayla", cancelLabel = "Vazgeç", danger = false, safeFocus }) =>
    new Promise(resolve => {
      let answered = false;
      const safe = safeFocus ?? (danger || DESTRUCTIVE_LABEL.test(String(confirmLabel)));
      const modal = HOF.modal({
        title,
        eyebrow: "ONAY",
        size: "small",
        body: `<p class="hof-modal-text">${HOF.esc(message)}</p><div class="hof-actions"><button type="button" class="hof-button hof-button-ghost" data-answer="no"${safe ? " autofocus" : ""}>${HOF.esc(cancelLabel)}</button><button type="button" class="hof-button ${danger ? "hof-button-danger" : ""}" data-answer="yes"${safe ? "" : " autofocus"}>${HOF.esc(confirmLabel)}</button></div>`,
        onClose: () => {
          if (!answered) resolve(false);
        },
      });
      modal.dialog.addEventListener("click", event => {
        const answer = event.target.closest("[data-answer]")?.dataset.answer;
        if (!answer) return;
        answered = true;
        resolve(answer === "yes");
        modal.close();
      });
    });

  // ---------- Tarayıcının "kaydet" önerileri (2.4.2, kullanıcı 17.10.2026: "adres, numara, şifre doldururken Google 'kaydet' diyor, kafa
  // karıştırıyor") ----------
  // Giriş ve kendi parolanı değiştirme formları ([data-autofill-keep]) dışında: alanlarda otomatik doldurma kapalı (autocomplete="off");
  // parola alanları type="text" + gizli yazı (.hof-secret) olur — Chromium'un (Edge/Chrome) parola yöneticisi yalnız type="password"
  // alanları parola sayar ve kaydetmeyi önerir (EDM parolası, vekil sunucu parolası, onay parolası programın işidir, tarayıcının değil).
  const quietField = input => {
    if (input.closest("[data-autofill-keep]") || input.classList.contains("hof-autofill-trap")) return;
    if (input.tagName === "INPUT" && input.type === "password") {
      input.type = "text";
      input.classList.add("hof-secret");
      input.dataset.secret = "1";
      input.spellcheck = false;
      input.autocapitalize = "none";
    }
    // Alanın kendi açık işareti korunur (ör. onay parolasında "one-time-code"); yalnız boş / "on" ve tarayıcıya "parola" diyen işaretler kapanır.
    const mark = input.getAttribute("autocomplete") || "";
    if (!mark || mark === "on" || (input.dataset.secret && /(^|\s)(new|current)-password$/.test(mark))) input.setAttribute("autocomplete", "off");
  };
  const QUIET = "input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]):not([type=button]):not([type=submit]), textarea";
  HOF.quietAutofill = root => {
    if (!root || root.nodeType !== 1) return;
    if (root.matches(QUIET)) quietField(root);
    root.querySelectorAll(QUIET).forEach(quietField);
    if (root.tagName === "FORM" && !root.closest("[data-autofill-keep]")) root.setAttribute("autocomplete", "off");
    root.querySelectorAll("form").forEach(form => !form.closest("[data-autofill-keep]") && form.setAttribute("autocomplete", "off"));
  };
  // Gizli yazılı alanda Göster / Gizle (type değil sınıf değişir; type="password"a dönerse tarayıcı yine kaydetmeyi önerir).
  HOF.toggleSecret = input => {
    if (input.type === "password") {
      input.type = "text";
      return true;
    }
    if (input.dataset.secret !== "1") {
      input.type = "password";
      return false;
    }
    const show = input.classList.contains("hof-secret");
    input.classList.toggle("hof-secret", !show);
    return show;
  };
  const startQuiet = () => {
    HOF.quietAutofill(document.body);
    new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes") quietField(mutation.target);
        else for (const node of mutation.addedNodes) HOF.quietAutofill(node);
      }
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["type"] });
  };
  if (document.body) startQuiet();
  else document.addEventListener("DOMContentLoaded", startQuiet, { once: true });

  // Alan tanımlarından erişilebilir form penceresi üretir.
  HOF.fieldHtml = field => {
    // Parola yöneticisine ayrılmış görünmeyen kullanıcı adı alanı (onay pencereleri, 2.0.25): tarayıcı kayıtlı kullanıcı
    // adını buraya yazar; ekranda ve klavye sırasında yoktur, gönderilen değer kullanılmaz.
    if (field.type === "username-hidden") return `<input type="text" class="hof-autofill-trap" name="${HOF.esc(field.name)}" value="${HOF.esc(field.value ?? "")}" autocomplete="username" tabindex="-1" aria-hidden="true">`;
    const id = `hof-f-${field.name}-${Math.random().toString(36).slice(2, 7)}`;
    const common = `id="${id}" name="${HOF.esc(field.name)}" ${field.required ? "required" : ""} ${field.autofocus ? "autofocus" : ""} ${field.readonly ? 'readonly aria-readonly="true"' : ""} ${field.maxlength ? `maxlength="${field.maxlength}"` : ""}`;
    let control;
    if (field.type === "textarea") control = `<textarea ${common} rows="${field.rows || 4}" placeholder="${HOF.esc(field.placeholder || "")}">${HOF.esc(field.value || "")}</textarea>`;
    else if (field.type === "select")
      control = `<select ${common}>${(field.options || []).map(option => `<option value="${HOF.esc(option.value)}" ${String(option.value) === String(field.value ?? "") ? "selected" : ""}>${HOF.esc(option.label)}</option>`).join("")}</select>`;
    // Açılır liste (Excel/Sheets veri doğrulaması, v2.0.2): listede olmayan eski değer "(listede yok)" diye korunur;
    // Excel'de listeye bağlı olmayan (uyarı/bilgi türü) listelerde başka bir değer de yazılabilir.
    else if (field.type === "choice") {
      const value = String(field.value ?? "");
      const options = field.options || [];
      const known = !value || options.includes(value);
      control = `<select ${common} data-choice>${`<option value="">${HOF.esc(field.blankLabel || "— Seçin —")}</option>`}${options.map(option => `<option value="${HOF.esc(option)}" ${option === value ? "selected" : ""}>${HOF.esc(option)}</option>`).join("")}${known ? "" : `<option value="${HOF.esc(value)}" selected>${HOF.esc(value)} (listede yok)</option>`}${field.strict ? "" : `<option value="${OTHER_CHOICE}">Başka Bir Değer Yaz…</option>`}</select>`;
    } else if (field.type === "checkbox") {
      // 31f (G6): açıklaması olan kutu — açıklama kutunun hemen altında, etiketin dışında (etiket metni değişmez), aria-describedby ile bağlı.
      const box = help => `<label class="hof-check"><input type="checkbox" ${common} ${field.value ? "checked" : ""}${help ? ` aria-describedby="${id}-help"` : ""}><span>${HOF.esc(field.label)}</span></label>`;
      return field.help ? `<div class="hof-check-field">${box(true)}<small id="${id}-help">${HOF.esc(field.help)}</small></div>` : box(false);
    }
    else {
      const list = field.list && field.list.length ? `${id}-list` : "";
      control = `<input ${common} type="${field.type || "text"}" value="${HOF.esc(field.value ?? "")}" placeholder="${HOF.esc(field.placeholder || "")}" ${field.inputmode ? `inputmode="${field.inputmode}"` : ""} ${field.step ? `step="${field.step}"` : ""} ${field.min != null ? `min="${field.min}"` : ""} ${field.max != null ? `max="${field.max === "today" ? HOF.localToday() : field.max}"` : ""} ${list ? `list="${list}"` : ""} autocomplete="${field.autocomplete || "off"}">${list ? `<datalist id="${list}">${field.list.map(item => `<option value="${HOF.esc(item)}"></option>`).join("")}</datalist>` : ""}`;
    }
    return `<label class="hof-field${field.readonly ? " is-readonly" : ""}" for="${id}"><span>${HOF.esc(field.label)}${field.required ? ' <i aria-hidden="true">*</i>' : ""}${field.badge ? ` <em class="hof-field-badge">${HOF.esc(field.badge)}</em>` : ""}</span>${control}${field.help ? `<small>${HOF.esc(field.help)}</small>` : ""}</label>`;
  };

  const OTHER_CHOICE = "\u0001başka";
  HOF.OTHER_CHOICE = OTHER_CHOICE;
  // "Başka bir değer yaz…" seçilince liste, aynı adla bir metin kutusuna dönüşür.
  HOF.freeChoice = select => {
    const input = HOF.el("input", { type: "text", id: select.id, name: select.name, maxlength: 20000, autocomplete: "off", placeholder: "Değeri yazın" });
    select.replaceWith(input);
    input.focus();
    return input;
  };

  HOF.formModal = ({ title, eyebrow, intro = "", introHtml = "", fields = [], submitLabel = "Kaydet", size = "", onSubmit, extraHtml = "", onClose, onOpen: afterOpen = null }) =>
    HOF.modal({
      title,
      eyebrow,
      size,
      onClose,
      body: `${introHtml}${intro ? `<p class="hof-modal-text">${intro}</p>` : ""}<form class="hof-form" novalidate>${fields.map(HOF.fieldHtml).join("")}${extraHtml}<p class="hof-form-error" role="alert"></p><div class="hof-actions"><button type="button" class="hof-button hof-button-ghost" data-cancel>Vazgeç</button><button type="submit" class="hof-button">${HOF.esc(submitLabel)}</button></div></form>`,
      onOpen: modal => {
        const form = modal.dialog.querySelector("form");
        const error = form.querySelector(".hof-form-error");
        form.querySelector("[data-cancel]").onclick = () => modal.close();
        if (afterOpen) afterOpen(modal.dialog, modal);
        form.addEventListener("change", event => {
          const select = event.target.closest?.("select[data-choice]");
          if (select && select.value === OTHER_CHOICE) HOF.freeChoice(select);
        });
        form.addEventListener("submit", async event => {
          event.preventDefault();
          error.textContent = "";
          const missing = [...form.querySelectorAll("[required]")].find(input => !String(input.value || "").trim());
          if (missing) {
            const label = missing.closest(".hof-field")?.querySelector("span")?.textContent.replace(/\s*\*\s*$/, "").trim();
            error.textContent = label ? `"${label}" alanı boş bırakılamaz.` : "Lütfen zorunlu alanları doldurun.";
            missing.closest(".hof-field")?.scrollIntoView({ block: "center" });
            missing.focus();
            return;
          }
          const data = {};
          for (const input of form.querySelectorAll("[name]")) data[input.name] = input.type === "checkbox" ? input.checked : input.value;
          const button = form.querySelector('button[type="submit"]');
          button.disabled = true;
          button.classList.add("is-busy");
          try {
            const keepOpen = await onSubmit(data, modal);
            if (keepOpen !== true) modal.close(true);
          } catch (failure) {
            error.textContent = failure.message || "İşlem tamamlanamadı.";
            // 2.4.3 (uzman UX10): sunucu hatalı alanı söylüyorsa (data.field: taxNo, iban, mersisNo…) odak o alana gider; düğmede kalmaz.
            const wrong = failure?.data?.field ? form.querySelector(`[name="${CSS.escape(String(failure.data.field))}"]`) : null;
            if (wrong && wrong.offsetParent !== null && !wrong.disabled) {
              wrong.closest(".hof-field")?.scrollIntoView({ block: "center" });
              wrong.focus({ preventScroll: true });
            }
          } finally {
            button.disabled = false;
            button.classList.remove("is-busy");
          }
        });
      },
    });

  // ---------- Tek, toplu DOM izleyici ----------
  // v1.0.0'da her betik belgenin tamamını ayrı ayrı izliyordu; artık tek izleyici kare başına bir kez çalışır.
  const domListeners = new Set();
  let scheduled = false;
  let observer = null;
  const flush = () => {
    scheduled = false;
    for (const listener of domListeners) {
      try {
        listener();
      } catch (error) {
        console.error("[DestekOfis]", error);
      }
    }
  };
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(flush);
  };
  const isOwnNode = node => {
    const element = node && (node.nodeType === 1 ? node : node.parentElement);
    return Boolean(element && element.closest && element.closest("[data-hof-ui]"));
  };
  HOF.onDom = listener => {
    domListeners.add(listener);
    if (!observer) {
      observer = new MutationObserver(mutations => {
        if (mutations.every(mutation => isOwnNode(mutation.target))) return;
        schedule();
      });
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
    schedule();
  };

  // ---------- React verisini yeniden çekme ----------
  // Paket, sekme görünür olduğunda verisini yeniler; aynı olayı tetikleyerek düzenleme sonrası tablo güncellenir.
  // Tablo isteği sürerken tetiklenirse (paket aynı isteği tekrar kullanır) istek bitince bir kez daha tetiklenir;
  // böylece değişiklikten SONRA başlayan taze bir istek garanti edilir.
  let rowsInFlight = 0;
  let refreshPending = false;
  const triggerRefetch = () => window.dispatchEvent(new Event("visibilitychange"));
  HOF.trackRowsRequest = promise => {
    rowsInFlight += 1;
    const done = () => {
      rowsInFlight = Math.max(0, rowsInFlight - 1);
      if (!rowsInFlight && refreshPending) {
        refreshPending = false;
        setTimeout(triggerRefetch, 200);
      }
    };
    promise.then(done, done);
    // Tablonun gösterdiği satırların bir kopyası: bir kayda gidilirken (arama, sohbet, kart listeleri) kaydın hangi
    // sekmede olduğunu bilmek için. Paket her istekte yanıtı ayrıca okur; burada klonu okunur.
    promise
      .then(response => (response.ok ? response.clone().json() : null))
      .then(payload => {
        const result = (Array.isArray(payload) ? payload[0] : payload)?.result?.data;
        const data = result?.json ?? result;
        if (!data || !Array.isArray(data.rows)) return;
        // freeTabs: serbest sayfaların sekme adı → sayfa kimliği (v2.0.1, hof-free.js).
        const freeTabs = new Map((data.tabs || []).filter(tab => tab && tab.free && tab.title).map(tab => [tab.title, tab.free]));
        // choices: Excel/Sheets açılır listeleri, sekme → kolon → {options, strict} (v2.0.2, hof-choices.js).
        HOF.data = { rows: data.rows, tabs: (data.tabs || []).map(tab => tab.title).filter(Boolean), freeTabs, choices: data.choices && typeof data.choices === "object" ? data.choices : {}, at: Date.now() };
        HOF.emit("rows", HOF.data);
      })
      .catch(() => {});
    return promise;
  };
  HOF.data = { rows: [], tabs: [], freeTabs: new Map(), choices: {}, at: 0 };
  // Kaydın sekmesi (tabloda birden çok satırı olan kayıtta ilk satırınki); bilinmiyorsa null.
  HOF.tabOfKey = key => {
    const row = HOF.data.rows.find(item => item.__hofKey === key);
    return row ? String(row.__sheet || "").trim() : null;
  };

  // ---------- Satırı belirginleştirme ----------
  // Başka bir yerden (arama, kart listesi, sohbet, veri sağlığı) gidilen satır görünür alana kaydırılır, seçilir ve
  // kısa bir süre vurgulanır. Seçili satırın kalıcı görünümü CSS'tedir (hof-ui.css: "Seçili satır").
  HOF.flashRow = row => {
    if (!row || !row.isConnected) return;
    const key = row.dataset.hofKey || "";
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    row.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    // React seçimi işledikten sonra (satırın sınıfını yeniden yazar) vurgu eklenir.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const target = row.isConnected ? row : key ? [...document.querySelectorAll(".dynamic-table tbody tr")].find(item => item.dataset.hofKey === key) : null;
        if (!target) return;
        target.classList.remove("hof-row-flash");
        void target.offsetWidth; // aynı satıra tekrar gidilince animasyon yeniden başlasın
        target.classList.add("hof-row-flash");
        clearTimeout(target.hofFlashTimer);
        target.hofFlashTimer = setTimeout(() => target.classList.remove("hof-row-flash"), 2200);
      }),
    );
  };
  HOF.refreshData = () => {
    if (rowsInFlight) refreshPending = true;
    else triggerRefetch();
    HOF.emit("data-refresh");
  };

  // ---------- Dosya kimliği ----------
  const CASE_PATTERN = /\b(?:19|20)\d{2}\/\d+\b/;
  HOF.casePattern = CASE_PATTERN;
  HOF.rowKey = row => {
    if (!row) return "";
    if (row.dataset && row.dataset.hofKey) return row.dataset.hofKey;
    const match = (row.innerText || "").match(CASE_PATTERN);
    return match ? match[0] : "";
  };
  HOF.detailPanel = () => document.querySelector(".detail-panel");
  HOF.selectedCase = () => {
    const panel = HOF.detailPanel();
    if (!panel || !panel.querySelector(".detail-header")) return null;
    const key = panel.dataset.hofKey || (panel.innerText.match(CASE_PATTERN) || [])[0] || panel.dataset.hofCase || "";
    if (!key) return null;
    const title = panel.querySelector(".detail-title")?.textContent?.trim() || key;
    return { key, title, panel };
  };
  // Kolonun asıl (Excel/Sheets'teki) adı: başlık ekranda ofisin verdiği adla görünse bile (v2.0.1, hof-columns.js)
  // düzeltmeler, formüller ve eşleştirmeler asıl adla çalışır.
  HOF.columnOf = element => (element ? (HOF.labels?.original ? HOF.labels.original(element) : element.textContent.trim()) : "");
  HOF.columnLabel = HOF.columnLabel || (name => name);
  HOF.tableHeaders = table => [...(table?.querySelectorAll("thead th") || [])].map(th => HOF.columnOf(th));
})();
