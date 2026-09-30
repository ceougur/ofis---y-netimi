/* DestekOfis — serbest sayfalar (v2.0.1).
 * Sekme şeridinin sonundaki "+ Sayfa" düğmesi, verinin sekmelerinin yanına kullanıcının adlandırdığı boş bir sayfa ekler.
 * Serbest sayfa açıkken tablo yerine Excel gibi bir ızgara görünür:
 *  - Kolon harfleri (A, B, C…) ve başlık satırı; veri satırları 1, 2, 3… diye numaralıdır. "B1" ilk veri satırının B
 *    kolonudur (başlık satırı numaralanmaz).
 *  - Yazmaya başlamak hücreyi doldurur; Enter, Tab, yön tuşları ya da fareyle başka hücreye geçince değer kaydedilir.
 *    F2, çift tık ya da kalem (✎) hücreyi düzeltmeye açar; × hücreyi temizler, kolonu ya da satırı siler.
 *  - "=" ile formül: Türkçe (=TOPLA(B1:B9), =EĞER(C2>1000;"Yüksek";"Normal")) ya da İngilizce yazım. Formül yazarken
 *    bir hücreye tıklamak başvurusunu ekler. Σ Alt toplam / Σ Yan toplam ve formülü aşağı/sağa doldurma vardır.
 *  - Excel'den kopyalanan tablo yapıştırılabilir (gerekirse satır/kolon eklenir). Ctrl+Z bu ekranda yapılanı geri alır.
 *  - Değer yazılmış her satır bir kayıttır: seçilince detay kartı açılır; not, tahsilat, görev, belge, arama, özet
 *    kartları, akıllı denetim ve Excel'e aktarma diğer sekmelerdeki gibi çalışır.
 * Sunucu tarafı: server/lib/free-sheets.mjs, server/routes/free.mjs, server/lib/formula/sheet.mjs. */
(() => {
  "use strict";
  const HOF = window.HOF;
  const { esc } = HOF;
  const API = "/api/workspace/free";
  const PAGE_STEP = 15;

  const ICON_PENCIL = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>';

  // Formül önerileri (Türkçe Excel adları; sunucu hepsini tanır).
  const FUNCTIONS = [
    ["TOPLA", "sayı1; [sayı2]; …", "Sayıları ya da aralığı toplar", "=TOPLA(B1:B9)"],
    ["ORTALAMA", "sayı1; [sayı2]; …", "Ortalamasını alır", "=ORTALAMA(C1:C9)"],
    ["EĞER", "koşul; doğruysa; yanlışsa", "Koşula göre iki değerden birini verir", '=EĞER(D2>1000;"Yüksek";"Normal")'],
    ["MİN", "sayı1; [sayı2]; …", "En küçük değer", "=MİN(B1:B9)"],
    ["MAK", "sayı1; [sayı2]; …", "En büyük değer", "=MAK(B1:B9)"],
    ["BAĞ_DEĞ_SAY", "değer1; …", "Sayı içeren hücreleri sayar", "=BAĞ_DEĞ_SAY(B1:B9)"],
    ["BAĞ_DEĞ_DOLU_SAY", "değer1; …", "Dolu hücreleri sayar", "=BAĞ_DEĞ_DOLU_SAY(A1:A9)"],
    ["EĞERSAY", "aralık; ölçüt", "Ölçüte uyan hücreleri sayar", '=EĞERSAY(E1:E9;"Ödendi")'],
    ["ETOPLA", "aralık; ölçüt; [toplam_aralığı]", "Ölçüte uyan satırları toplar", '=ETOPLA(E1:E9;"Ödendi";D1:D9)'],
    ["ÇOKETOPLA", "toplam_aralığı; aralık1; ölçüt1; …", "Birden çok ölçüte göre toplar", '=ÇOKETOPLA(D1:D9;E1:E9;"Açık";F1:F9;">0")'],
    ["YUVARLA", "sayı; basamak", "Belirtilen basamağa yuvarlar", "=YUVARLA(B2*1,2;2)"],
    ["YUKARIYUVARLA", "sayı; basamak", "Yukarı yuvarlar", "=YUKARIYUVARLA(B2;0)"],
    ["AŞAĞIYUVARLA", "sayı; basamak", "Aşağı yuvarlar", "=AŞAĞIYUVARLA(B2;0)"],
    ["MUTLAK", "sayı", "Mutlak değer", "=MUTLAK(B2-C2)"],
    ["ÇARPIM", "sayı1; [sayı2]; …", "Sayıları çarpar", "=ÇARPIM(B2;C2)"],
    ["BUGÜN", "", "Bugünün tarihi", "=BUGÜN()"],
    ["ŞİMDİ", "", "Şu anki tarih ve saat", "=ŞİMDİ()"],
    ["TARİH", "yıl; ay; gün", "Tarih oluşturur", "=TARİH(2026;12;31)"],
    ["YIL", "tarih", "Tarihin yılı", "=YIL(B2)"],
    ["AY", "tarih", "Tarihin ayı", "=AY(B2)"],
    ["GÜN", "tarih", "Tarihin günü", "=GÜN(B2)"],
    ["GÜNSAY", "bitiş; başlangıç", "İki tarih arasındaki gün", "=GÜNSAY(C2;B2)"],
    ["SERİTARİH", "başlangıç; ay_sayısı", "Tarihe ay ekler", "=SERİTARİH(B2;1)"],
    ["TAMİŞGÜNÜ", "başlangıç; bitiş", "İki tarih arasındaki iş günü", "=TAMİŞGÜNÜ(B2;C2)"],
    ["BİRLEŞTİR", "metin1; [metin2]; …", "Metinleri birleştirir", '=BİRLEŞTİR(A2;" - ";B2)'],
    ["SOLDAN", "metin; karakter_sayısı", "Baştan karakter alır", "=SOLDAN(A2;3)"],
    ["SAĞDAN", "metin; karakter_sayısı", "Sondan karakter alır", "=SAĞDAN(A2;4)"],
    ["UZUNLUK", "metin", "Karakter sayısı", "=UZUNLUK(A2)"],
    ["BÜYÜKHARF", "metin", "Büyük harfe çevirir", "=BÜYÜKHARF(A2)"],
    ["KÜÇÜKHARF", "metin", "Küçük harfe çevirir", "=KÜÇÜKHARF(A2)"],
    ["KIRP", "metin", "Fazla boşlukları siler", "=KIRP(A2)"],
    ["METNEÇEVİR", "değer; biçim", "Sayıyı biçimli metne çevirir", '=METNEÇEVİR(B2;"#.##0,00")'],
    ["DÜŞEYARA", "aranan; tablo; kolon_no; [yaklaşık]", "Tabloda arar, aynı satırdan değer getirir", "=DÜŞEYARA(A2;A1:D9;4;YANLIŞ)"],
    ["ÇAPRAZARA", "aranan; arama_aralığı; sonuç_aralığı", "Arar ve karşılığını getirir", "=ÇAPRAZARA(A2;A1:A9;D1:D9)"],
    ["EĞERHATA", "değer; hatalıysa", "Hata yerine başka değer gösterir", '=EĞERHATA(B2/C2;"-")'],
    ["VE", "koşul1; koşul2; …", "Tüm koşullar doğruysa DOĞRU", "=VE(B2>0;C2>0)"],
    ["YADA", "koşul1; koşul2; …", "Koşullardan biri doğruysa DOĞRU", '=YADA(E2="Açık";E2="Beklemede")'],
    ["DEĞİL", "koşul", "Koşulu tersine çevirir", "=DEĞİL(B2>0)"],
    ["ÇOKEĞER", "koşul1; değer1; koşul2; değer2; …", "İlk doğru koşulun değerini verir", '=ÇOKEĞER(B2>1000;"Yüksek";B2>0;"Normal";DOĞRU;"-")'],
    ["ORTANCA", "sayı1; …", "Ortanca değer", "=ORTANCA(B1:B9)"],
    ["MOD", "sayı; bölen", "Bölümden kalan", "=MOD(B2;2)"],
    ["KUVVET", "sayı; üs", "Üs alır", "=KUVVET(B2;2)"],
    ["KAREKÖK", "sayı", "Karekök", "=KAREKÖK(B2)"],
    ["TAMSAYI", "sayı", "Tam sayıya indirir", "=TAMSAYI(B2)"],
  ];
  const foldText = text => String(text || "").toLocaleUpperCase("tr-TR").replace(/[İI]/g, "I").replace(/Ş/g, "S").replace(/Ğ/g, "G").replace(/Ü/g, "U").replace(/Ö/g, "O").replace(/Ç/g, "C").replace(/[._]/g, "");

  // ---------- Durum ----------
  const state = {
    id: "",
    sheet: null,
    active: { r: 0, c: 0 }, // r = -1: başlık satırı
    anchor: null, // aralık seçimi başlangıcı
    editing: null, // { r, c, rowId, colId, original, mode: "enter" | "edit", target: input|bar }
    point: null, // formül yazarken tıklanarak eklenen başvuru { start, end, from: {r,c} }
    busy: 0,
    failed: false,
    lastApply: 0,
    wide: false,
  };
  const pending = new Map(); // "satır|kolon" → sunucuya henüz ulaşmamış ham değer
  const undoStacks = new Map(); // sayfa → [{ label, run }]
  let saveChain = Promise.resolve();
  let clip = null; // son kopyalanan aralık: { text, raws, origin }
  let wantedKey = "";
  let dom = null; // { root, wrap, table, input, bar, name, status, suggest, meta, menu }
  let lastPointer = "mouse";
  let dragging = null;
  let suggestState = null;

  try {
    state.wide = localStorage.getItem("hof-free-wide") === "1";
  } catch {
    state.wide = false;
  }

  const canEdit = () => HOF.can("records.edit");
  const canCreate = () => HOF.can("records.create");
  const canDelete = () => HOF.can("records.delete");
  const freeTabs = () => HOF.data?.freeTabs || new Map();
  const activeFreeId = () => {
    const tab = (HOF.activeTab && HOF.activeTab()) || "";
    return tab ? freeTabs().get(tab) || "" : "";
  };
  const stack = () => {
    if (!undoStacks.has(state.id)) undoStacks.set(state.id, []);
    return undoStacks.get(state.id);
  };
  const key = (rowId, colId) => `${rowId}|${colId}`;
  const cols = () => state.sheet?.columns || [];
  const rows = () => state.sheet?.rows || [];
  const colLetter = c => cols()[c]?.letter || "";
  const cellAt = (r, c) => rows()[r]?.cells?.[c] || { raw: "", display: "", formula: false, error: null };
  const rawAt = (r, c) => {
    const row = rows()[r];
    const col = cols()[c];
    if (!row || !col) return "";
    const k = key(row.id, col.id);
    return pending.has(k) ? pending.get(k) : cellAt(r, c).raw || "";
  };
  const address = (r, c) => (r < 0 ? `${colLetter(c)} başlığı` : `${colLetter(c)}${r + 1}`);
  const isFormula = text => String(text || "").startsWith("=") && String(text).length > 1;
  const NUMERIC = /^[-+−]?(?:[₺$€£%]\s?)?\d[\d.\s]*(?:,\d+)?(?:\s?(?:₺|tl|try|%|\$|€|£|usd|eur))?$/i;
  const DATE_TEXT = /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/;
  const ERROR_TEXT = /^#(SAYI\/0!|DEĞER!|BAŞV!|AD\?|SAYI!|YOK|BOŞ!|DÖNGÜ!)$/;
  const clampValue = (value, min, max) => Math.max(min, Math.min(max, value));
  const range = () => {
    const a = state.anchor || state.active;
    const b = state.active;
    return { r1: Math.min(a.r, b.r), r2: Math.max(a.r, b.r), c1: Math.min(a.c, b.c), c2: Math.max(a.c, b.c) };
  };
  // Boş satır/kolon: elle yazılmış değeri yok (yalnızca kolondan gelen formül taşıyabilir); ekleme yetkisi olan siler.
  const valueless = raw => !raw || isFormula(raw);
  const columnEmpty = c => {
    const col = cols()[c];
    if (!col || col.name) return false;
    return rows().every((_, r) => valueless(rawAt(r, c)));
  };
  const rowEmpty = r => cols().every((_, c) => valueless(rawAt(r, c)));
  // Hücrenin metnini, içindeki kalem/× düğmelerine dokunmadan yazar.
  function setCellText(td, text) {
    const node = td.firstChild && td.firstChild.nodeType === 3 ? td.firstChild : null;
    if (node) {
      if (node.nodeValue !== text) node.nodeValue = text;
    } else if (text) td.insertBefore(document.createTextNode(text), td.firstChild);
  }

  // ---------- Sekme şeridi: "+ Sayfa" ve serbest sayfa işareti ----------
  function stripOf() {
    const bar = document.querySelector(".category-bar");
    return bar?.querySelector(":scope > .hof-category-tabs") || bar?.querySelector(":scope > .category-tabs") || null;
  }
  function ensureAddButton() {
    const strip = stripOf();
    let button = document.getElementById("hof-free-add");
    if (!strip || !canCreate()) {
      button?.remove();
      return;
    }
    if (!button) {
      button = HOF.el("button", { id: "hof-free-add", type: "button", class: "hof-free-add", title: "Yeni sayfa ekle: Excel gibi serbestçe doldurduğunuz, formül kullanabildiğiniz bir sayfa", "aria-label": "Yeni sayfa ekle" }, '<span aria-hidden="true">+</span> Sayfa');
      button.addEventListener("click", openCreate);
    }
    if (button.parentElement !== strip || button.nextElementSibling) strip.appendChild(button);
  }
  function markFreeTabs() {
    const names = freeTabs();
    for (const button of document.querySelectorAll(".category-bar .category-tab")) {
      const label = (button.getAttribute("title") || button.dataset.label || "").trim();
      const free = Boolean(label) && names.has(label);
      if (free !== button.hasAttribute("data-hof-free")) {
        if (free) button.setAttribute("data-hof-free", "");
        else button.removeAttribute("data-hof-free");
      }
    }
  }
  // Sayfa ekleyebilen kullanıcıda sekme şeridi tek sekmeli veride de görünür ("+ Sayfa" için; bkz. patch-bundle).
  function updateAlwaysTabs() {
    const want = canCreate();
    if (window.hofAlwaysTabs === want) return;
    window.hofAlwaysTabs = want;
    if (want && !document.querySelector(".category-bar") && (HOF.data?.tabs?.length || 0) === 1) HOF.refreshData();
  }

  async function waitFor(check, attempts = 80) {
    for (let index = 0; index < attempts; index += 1) {
      const value = check();
      if (value) return value;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return check();
  }
  // Veri yenilendikten sonra sekmeye geçer (yeni, yeniden adlandırılan ya da geri alınan sayfa). Beklerken kullanıcı
  // başka bir sekmeye tıklarsa onun seçimi geçerlidir.
  let tabClickAt = 0;
  document.addEventListener("click", event => {
    if (event.target.closest?.(".category-bar .category-tab")) tabClickAt = Date.now();
  }, true);
  async function openTab(name) {
    const started = Date.now();
    HOF.refreshData();
    const ok = await waitFor(() => (HOF.tabLabels ? HOF.tabLabels() : []).includes(name));
    if (!ok) return false;
    if (tabClickAt > started) return true;
    if (HOF.activeTab() !== name) HOF.selectTab(name);
    return true;
  }

  // "+ Sayfa" penceresi (v2.0.10): boş sayfa, Excel dosyasından ya da Google Sheets'ten. Aktarılan sayfa bir kopyadır:
  // başlıklar, değerler ve formüller gelir; kaynakta sonradan yapılan değişiklik buraya gelmez.
  const LIMITS = { columns: 500, rows: 2000, cells: 250_000 }; // sunucudaki FREE_LIMITS ile aynı
  const parseExcel = file =>
    new Promise((resolve, reject) => {
      let worker;
      try {
        worker = new Worker("/assets/hof-excel-worker.js", { type: "module" });
      } catch {
        reject(new Error("Tarayıcınız Excel okumayı desteklemiyor. Chrome ya da Edge'in güncel sürümünü kullanın."));
        return;
      }
      const timer = setTimeout(() => {
        worker.terminate();
        reject(new Error("Excel dosyası 90 saniyede okunamadı. Dosyayı sadeleştirip yeniden deneyin."));
      }, 90_000);
      worker.onmessage = event => {
        clearTimeout(timer);
        worker.terminate();
        if (event.data.ok) resolve(event.data);
        else reject(new Error(`Excel dosyası okunamadı: ${event.data.error}`));
      };
      worker.onerror = event => {
        clearTimeout(timer);
        worker.terminate();
        reject(new Error(event.message || "Excel dosyası okunamadı. .xlsx, .xls ya da .csv dosyası seçin."));
      };
      file.arrayBuffer().then(buffer => worker.postMessage({ buffer, name: file.name }, [buffer]), reject);
    });
  // Ön izleme için sunucudaki kuralın özeti: ilk dolu satır başlık, altındakiler veri (boş sondakiler hariç).
  function shapeOf(sheet) {
    const rows = sheet.matrix || [];
    const filled = row => (row || []).some(cell => String(cell ?? "").trim());
    const countOf = row => (row || []).filter(cell => String(cell ?? "").trim()).length;
    // Sunucudaki kural (free-import.mjs headerRowOf): başlık yazısı gibi tek hücreli üst satırlar atlanır.
    const counts = [];
    for (let i = 0; i < rows.length && counts.length < 15; i += 1) if (countOf(rows[i])) counts.push([i, countOf(rows[i])]);
    if (!counts.length) return { empty: true, rows: 0, columns: 0, formulas: 0, head: -1 };
    const most = Math.max(...counts.map(item => item[1]));
    const head = most < 2 ? counts[0][0] : counts.find(item => item[1] >= Math.max(2, Math.ceil(most / 2)))[0];
    const skipped = counts.filter(item => item[0] < head).length;
    let last = rows.length - 1;
    while (last > head && !filled(rows[last])) last -= 1;
    let first = Infinity;
    let end = -1;
    for (let i = head; i <= last; i += 1) (rows[i] || []).forEach((cell, c) => {
      if (String(cell ?? "").trim()) {
        first = Math.min(first, c);
        end = Math.max(end, c);
      }
    });
    return { empty: false, head, last, first, end, skipped, rows: last - head, columns: end - first + 1, formulas: (sheet.formulas || []).length };
  }
  function previewHtml(sheet) {
    const shape = shapeOf(sheet);
    if (shape.empty) return '<p class="hof-free-import-note is-warn">Bu sayfa boş; aktarılacak hücre yok.</p>';
    const rows = sheet.matrix.slice(shape.head, Math.min(shape.last, shape.head + 5) + 1);
    const cols = Array.from({ length: Math.min(shape.columns, 8) }, (_, n) => shape.first + n);
    const table = `<div class="hof-free-import-table"><table><thead><tr>${cols.map(c => `<th>${esc(String(rows[0][c] ?? ""))}</th>`).join("")}${shape.columns > 8 ? "<th>…</th>" : ""}</tr></thead><tbody>${rows
      .slice(1)
      .map(row => `<tr>${cols.map(c => `<td>${esc(String(row[c] ?? ""))}</td>`).join("")}${shape.columns > 8 ? "<td>…</td>" : ""}</tr>`)
      .join("")}</tbody></table></div>`;
    const tooBig = shape.rows > LIMITS.rows || shape.columns > LIMITS.columns || shape.rows * shape.columns > LIMITS.cells;
    const facts = `<p class="hof-free-import-note${tooBig ? " is-warn" : ""}"><b>${shape.rows.toLocaleString("tr-TR")} satır × ${shape.columns.toLocaleString("tr-TR")} kolon</b>${shape.formulas ? ` · ${shape.formulas.toLocaleString("tr-TR")} formül` : ""}. Kolon başlıkları: <b>${esc(cols.map(c => String(rows[0][c] ?? "")).filter(Boolean).slice(0, 4).join(", ") || "—")}</b>${shape.columns > 4 ? "…" : ""}.${shape.skipped ? ` Başlığın üstündeki ${shape.skipped} satır (sayfa başlığı gibi) alınmaz.` : ""}${tooBig ? ` Serbest sayfa en fazla ${LIMITS.rows.toLocaleString("tr-TR")} satır ve ${LIMITS.columns} kolon alır; büyük tablolar için ana veri yüklemesini (açılış ekranı ya da Ayarlar → Veri) kullanın.` : ""}</p>`;
    return facts + table;
  }
  const importedText = result => {
    const info = result.imported || {};
    return `“${result.name}” sayfası aktarıldı: ${Number(info.rows || 0).toLocaleString("tr-TR")} satır, ${info.columns || 0} kolon${info.formulas ? `, ${info.formulas} formül programda çalışıyor` : ""}${info.asValues ? `; ${info.asValues} formül değeriyle aktarıldı (başka sayfaya başvuru ya da programın tanımadığı işlev)` : ""}${info.skippedAbove ? `; başlığın üstündeki ${info.skippedAbove} satır alınmadı` : ""}.`;
  };

  function openCreate() {
    if (!canCreate()) return HOF.toast("Sayfa ekleme yetkiniz yok.", { type: "error" });
    const modal = HOF.modal({
      title: "Yeni Sayfa",
      eyebrow: "SERBEST SAYFA",
      size: "wide",
      body: `<div class="hof-free-source" role="tablist" aria-label="Sayfanın kaynağı">
          <button type="button" role="tab" data-source="blank" aria-selected="true"><b>Boş Sayfa</b><small>Excel gibi kendiniz doldurun</small></button>
          <button type="button" role="tab" data-source="excel" aria-selected="false"><b>Excel Dosyasından Aktar</b><small>.xlsx, .xls, .csv</small></button>
          <button type="button" role="tab" data-source="sheets" aria-selected="false"><b>Google Sheets'ten Aktar</b><small>Paylaşılan tablo bağlantısı</small></button>
        </div>
        <form class="hof-form" data-pane="blank" novalidate>
          <p class="hof-modal-text">Sayfa, verinizin sekmelerinin yanına eklenir ve Excel gibi doldurulur: başlıkları ve hücreleri yazın, siz başka hücreye geçince kaydedilir. Satır, kolon ve formül (Alt toplam, Yan toplam…) sonradan da eklenir.</p>
          ${[
            { name: "name", label: "Sayfa Adı", required: true, maxlength: 60, placeholder: "ör. Masraflar" },
            { name: "columns", label: "Kolon Sayısı", type: "number", value: "5", min: 1, step: 1, inputmode: "numeric", help: "İstediğiniz kadar kolon (500'e kadar); sonradan da ekleyebilirsiniz." },
            { name: "rows", label: "Satır Sayısı", type: "number", value: "20", min: 1, step: 1, inputmode: "numeric" },
            { name: "names", label: "Kolon Başlıkları (isteğe bağlı)", type: "textarea", rows: 3, maxlength: 4000, placeholder: "Virgülle ayırın ya da her satıra bir başlık yazın: Tarih, Açıklama, Tutar", help: "Boş bırakırsanız başlıkları sayfada yazarsınız." },
          ].map(HOF.fieldHtml).join("")}
          <p class="hof-form-error" role="alert"></p>
          <div class="hof-actions"><button type="button" class="hof-button hof-button-ghost" data-cancel>Vazgeç</button><button type="submit" class="hof-button">Sayfayı Oluştur</button></div>
        </form>
        <form class="hof-form" data-pane="excel" novalidate hidden>
          <p class="hof-modal-text">Excel'deki bir sayfa <b>başlıkları, değerleri ve formülleriyle</b> yeni sayfa olarak kopyalanır; formüller programda çalışır. Kolon başlıklarının olduğu satır kendiliğinden bulunur (üstündeki sayfa başlığı gibi satırlar alınmaz). Excel dosyanız değişmez ve sonradan Excel'de yapılan değişiklikler buraya gelmez.</p>
          <label class="hof-free-drop" data-drop><input type="file" accept=".xlsx,.xls,.xlsm,.csv" data-file hidden><span class="hof-free-drop-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M12 12v6"/><path d="m9.5 14.5 2.5-2.5 2.5 2.5"/></svg></span><b data-file-label>Excel Dosyası Seçin</b><small>ya da dosyayı buraya sürükleyin · .xlsx, .xls, .csv</small></label>
          <div data-excel-result hidden>
            <label class="hof-field"><span>Aktarılacak Sayfa</span><select data-excel-sheet></select></label>
            <label class="hof-field"><span>Programdaki Sayfa Adı</span><input data-excel-name maxlength="60" autocomplete="off"></label>
            <div data-preview></div>
          </div>
          <p class="hof-form-error" role="alert"></p>
          <div class="hof-actions"><button type="button" class="hof-button hof-button-ghost" data-cancel>Vazgeç</button><button type="submit" class="hof-button" data-import disabled>Sayfayı Aktar</button></div>
        </form>
        <form class="hof-form" data-pane="sheets" novalidate hidden>
          <p class="hof-modal-text">Google Sheets'teki bir sekme <b>başlıkları, değerleri ve formülleriyle</b> kopyalanır. Tabloyu <b>“Bağlantıya sahip olan herkes görüntüleyebilir”</b> olarak paylaşın; aktarmak istediğiniz sekmeyi açıp adres çubuğundaki bağlantıyı yapıştırın (sekme, bağlantıdaki <code>#gid=</code> ile seçilir). Sonradan Sheets'te yapılan değişiklikler buraya gelmez.</p>
          <label class="hof-field"><span>Google Sheets Bağlantısı <i aria-hidden="true">*</i></span><input data-sheets-url required autocomplete="off" spellcheck="false" placeholder="https://docs.google.com/spreadsheets/d/…/edit#gid=0"></label>
          <label class="hof-field"><span>Programdaki Sayfa Adı</span><input data-sheets-name maxlength="60" autocomplete="off" placeholder="Boş bırakılırsa sekmenin adı"></label>
          <p class="hof-form-error" role="alert"></p>
          <div class="hof-actions"><button type="button" class="hof-button hof-button-ghost" data-cancel>Vazgeç</button><button type="submit" class="hof-button">Sayfayı Aktar</button></div>
        </form>`,
    });
    const dialog = modal.dialog;
    const pane = name => dialog.querySelector(`[data-pane="${name}"]`);
    const select = source => {
      dialog.querySelectorAll("[data-source]").forEach(tab => tab.setAttribute("aria-selected", String(tab.dataset.source === source)));
      dialog.querySelectorAll("[data-pane]").forEach(form => {
        form.hidden = form.dataset.pane !== source;
      });
      (source === "blank" ? pane("blank").elements.name : source === "sheets" ? pane("sheets").querySelector("[data-sheets-url]") : pane("excel").querySelector("[data-drop]"))?.focus();
    };
    dialog.querySelector(".hof-free-source").addEventListener("click", event => {
      const tab = event.target.closest("[data-source]");
      if (tab) select(tab.dataset.source);
    });
    dialog.querySelectorAll("[data-cancel]").forEach(button => {
      button.onclick = () => modal.close();
    });
    pane("blank").elements.name.focus();
    const after = sheet => {
      startAt = { r: 0, c: 0 };
      openTab(sheet.name).then(ok => {
        if (!ok) HOF.toast("Sayfa eklendi; sekmesi birazdan görünecek.", { type: "info" });
      });
    };
    const busy = async (form, work) => {
      const error = form.querySelector(".hof-form-error");
      const button = form.querySelector('button[type="submit"]');
      error.textContent = "";
      button.disabled = true;
      button.classList.add("is-busy");
      try {
        await work();
        modal.close(true);
      } catch (failure) {
        error.textContent = failure.message || "İşlem tamamlanamadı.";
      } finally {
        button.disabled = false;
        button.classList.remove("is-busy");
      }
    };

    // Boş sayfa
    pane("blank").addEventListener("submit", event => {
      event.preventDefault();
      const form = event.currentTarget;
      busy(form, async () => {
        const data = Object.fromEntries(["name", "columns", "rows", "names"].map(key => [key, form.elements[key].value]));
        if (!data.name.trim()) throw new Error('"Sayfa adı" alanı boş bırakılamaz.');
        const names = String(data.names || "")
          .split(/[\n,;\t]+/)
          .map(item => item.trim())
          .filter(Boolean);
        const columns = Math.floor(Number(data.columns));
        const rowCount = Math.floor(Number(data.rows));
        if (!Number.isFinite(columns) || columns < 1 || columns > LIMITS.columns) throw new Error(`Kolon sayısı 1 ile ${LIMITS.columns} arasında olmalı.`);
        if (!Number.isFinite(rowCount) || rowCount < 1 || rowCount > LIMITS.rows) throw new Error(`Satır sayısı 1 ile ${LIMITS.rows} arasında olmalı.`);
        if (names.length > LIMITS.columns) throw new Error(`En fazla ${LIMITS.columns} kolon başlığı yazılabilir.`);
        if (Math.max(columns, names.length) * rowCount > LIMITS.cells) throw new Error(`Sayfa çok büyük olur: kolon × satır en fazla ${LIMITS.cells.toLocaleString("tr-TR")} olabilir (ör. 500 kolon × 500 satır). Satır sayısını azaltın; satırlar sonradan da eklenir.`);
        const sheet = await HOF.api(API, { method: "POST", body: { name: data.name, columns: Math.max(columns, names.length), rows: rowCount, names } });
        HOF.toast(`“${sheet.name}” sayfası eklendi. Başlıkları ve hücreleri yazmaya başlayın.`, { type: "success" });
        startAt = names.length ? { r: 0, c: 0 } : { r: -1, c: 0 };
        openTab(sheet.name).then(ok => {
          if (!ok) HOF.toast("Sayfa eklendi; sekmesi birazdan görünecek.", { type: "info" });
        });
      });
    });

    // Excel dosyasından
    const excel = pane("excel");
    let book = null;
    let fileName = "";
    const current = () => book?.sheets.find(item => item.name === excel.querySelector("[data-excel-sheet]").value) || null;
    const refresh = () => {
      const sheet = current();
      const shape = sheet ? shapeOf(sheet) : { empty: true };
      excel.querySelector("[data-preview]").innerHTML = sheet ? previewHtml(sheet) : "";
      excel.querySelector("[data-excel-name]").value = sheet ? sheet.name.slice(0, 60) : "";
      excel.querySelector("[data-import]").disabled = !sheet || shape.empty || shape.rows > LIMITS.rows || shape.columns > LIMITS.columns || shape.rows * shape.columns > LIMITS.cells;
    };
    const readFile = async file => {
      if (!file) return;
      const error = excel.querySelector(".hof-form-error");
      error.textContent = "";
      excel.querySelector("[data-file-label]").textContent = `${file.name} okunuyor…`;
      try {
        book = await parseExcel(file);
        fileName = file.name;
        const usable = book.sheets.filter(sheet => !shapeOf(sheet).empty);
        excel.querySelector("[data-excel-sheet]").innerHTML = book.sheets
          .map(sheet => {
            const shape = shapeOf(sheet);
            return `<option value="${esc(sheet.name)}" ${shape.empty ? "disabled" : ""}>${esc(sheet.name)}${shape.empty ? " (boş)" : ` · ${shape.rows.toLocaleString("tr-TR")} satır × ${shape.columns} kolon`}${sheet.hidden ? " · gizli" : ""}</option>`;
          })
          .join("");
        if (usable[0]) excel.querySelector("[data-excel-sheet]").value = usable[0].name;
        excel.querySelector("[data-excel-result]").hidden = false;
        excel.querySelector("[data-file-label]").textContent = file.name;
        if (!usable.length) error.textContent = "Dosyadaki sayfaların hepsi boş.";
        refresh();
      } catch (failure) {
        book = null;
        excel.querySelector("[data-excel-result]").hidden = true;
        excel.querySelector("[data-file-label]").textContent = "Excel Dosyası Seçin";
        error.textContent = failure.message;
      }
    };
    excel.querySelector("[data-file]").addEventListener("change", event => readFile(event.target.files[0]));
    excel.querySelector("[data-excel-sheet]").addEventListener("change", refresh);
    const drop = excel.querySelector("[data-drop]");
    drop.addEventListener("dragover", event => {
      event.preventDefault();
      drop.classList.add("is-over");
    });
    drop.addEventListener("dragleave", () => drop.classList.remove("is-over"));
    drop.addEventListener("drop", event => {
      event.preventDefault();
      drop.classList.remove("is-over");
      readFile(event.dataTransfer.files[0]);
    });
    drop.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        excel.querySelector("[data-file]").click();
      }
    });
    drop.tabIndex = 0;
    excel.addEventListener("submit", event => {
      event.preventDefault();
      const sheet = current();
      if (!sheet) return;
      busy(excel, async () => {
        const result = await HOF.api(`${API}/import`, { method: "POST", body: { name: excel.querySelector("[data-excel-name]").value.trim() || sheet.name, fileName, sheet: { name: sheet.name, matrix: sheet.matrix, start: sheet.start, formulas: sheet.formulas } }, timeoutMs: 120_000 });
        HOF.toast(importedText(result), { type: "success", timeout: 9000 });
        after(result);
      });
    });

    // Google Sheets'ten
    const sheets = pane("sheets");
    sheets.addEventListener("submit", event => {
      event.preventDefault();
      const url = sheets.querySelector("[data-sheets-url]").value.trim();
      if (!/^https:\/\/docs\.google\.com\/spreadsheets\/d\/[^/]+/.test(url)) {
        sheets.querySelector(".hof-form-error").textContent = url ? "Google Sheets bağlantısı tanınmadı. Tablonun adres çubuğundaki bağlantıyı (https://docs.google.com/spreadsheets/d/…) yapıştırın." : "Google Sheets bağlantısını yapıştırın.";
        return;
      }
      busy(sheets, async () => {
        const result = await HOF.api(`${API}/import-sheets`, { method: "POST", body: { url, name: sheets.querySelector("[data-sheets-name]").value.trim() }, timeoutMs: 90_000 });
        HOF.toast(importedText(result), { type: "success", timeout: 9000 });
        after(result);
      });
    });
  }
  let startAt = null;

  // ---------- Sayfaya giriş/çıkış ----------
  function switchTo(id) {
    if (state.editing) commit(null);
    closeMenu();
    closeSuggest();
    state.id = id;
    state.sheet = null;
    state.anchor = null;
    state.point = null;
    state.failed = false;
    wantedKey = "";
    document.body.classList.toggle("hof-free-mode", Boolean(id));
    document.body.classList.toggle("hof-free-wide", Boolean(id) && state.wide);
    if (!id) {
      dom?.root.remove();
      dom = null;
      return;
    }
    // Arama kutusu bu sekmede gizlidir; kalmış bir arama kayıtları gizleyip detay kartını boş bırakmasın.
    const search = document.querySelector(".cases-panel .search-field input");
    if (search && search.value) {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(search, "");
      search.dispatchEvent(new Event("input", { bubbles: true }));
    }
    build();
    state.active = startAt || { r: 0, c: 0 };
    startAt = null;
    load();
  }

  function place() {
    if (!dom) return;
    const panel = document.querySelector(".cases-panel");
    if (!panel) return;
    const heading = panel.querySelector(":scope > .panel-heading");
    if (heading ? heading.nextElementSibling !== dom.root : dom.root.parentElement !== panel) {
      if (heading) heading.after(dom.root);
      else panel.prepend(dom.root);
      position();
    }
  }

  async function load(fresh = true) {
    const id = state.id;
    try {
      const detail = await HOF.api(`${API}/${encodeURIComponent(id)}`);
      if (id !== state.id) return;
      apply(detail, { fresh: fresh || !state.sheet });
    } catch (error) {
      if (id !== state.id || !dom) return;
      if (state.sheet) {
        // Izgara yerinde kalır; bağlantı dönünce yeniden okunur.
        setStatus(`Sayfa yenilenemedi: ${error.message}`);
        dom.status.dataset.tone = "error";
        if (!error.status) reloadSoon(4000);
      } else dom.table.innerHTML = `<tbody><tr><td class="hof-free-error">${esc(error.message)} <button type="button" class="hof-free-tool" data-act="reload">Yeniden Dene</button></td></tr></tbody>`;
    }
  }
  const reloadSoon = (() => {
    let timer = 0;
    return (delay = 250) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!state.id) return;
        if (state.busy) return reloadSoon(400);
        load(false);
      }, delay);
    };
  })();
  const refreshSoon = (() => {
    let timer = 0;
    return () => {
      clearTimeout(timer);
      timer = setTimeout(() => HOF.refreshData(), 900);
    };
  })();

  // ---------- Çizim ----------
  function build() {
    const root = HOF.el(
      "section",
      { id: "hof-free", class: "hof-free", "aria-label": "Serbest sayfa" },
      `<div class="hof-free-top">
        <div class="hof-free-title">
          <span class="hof-free-badge">Serbest Sayfa</span>
          <h2 class="hof-free-name"></h2>
          <button type="button" class="hof-free-mini" data-act="rename-sheet" title="Sayfanın adını değiştir" aria-label="Sayfanın adını değiştir">${ICON_PENCIL}</button>
          <small class="hof-free-meta"></small>
        </div>
        <div class="hof-free-corner-tools">
          <button type="button" class="hof-free-tool" data-act="help" title="Formüller ve kısayollar">ƒx Formüller</button>
          <button type="button" class="hof-free-tool hof-free-icon" data-act="wide" title="Tabloyu genişlet / detay kartını yana al" aria-pressed="false">⤢</button>
          <button type="button" class="hof-free-tool hof-free-icon" data-act="more" title="Diğer işlemler" aria-haspopup="menu" aria-label="Diğer işlemler">⋯</button>
        </div>
      </div>
      <div class="hof-free-actions" role="toolbar" aria-label="Sayfa işlemleri">
          <button type="button" class="hof-free-tool" data-act="add-row" data-need="create" title="Seçili satırın altına satır ekler">+ Satır</button>
          <button type="button" class="hof-free-tool" data-act="add-col" data-need="create" title="Seçili kolonun sağına kolon ekler">+ Kolon</button>
          <span class="hof-free-sep" aria-hidden="true"></span>
          <button type="button" class="hof-free-tool" data-act="total-row" data-need="create" title="Sayısal kolonların altına toplam satırı ekler">Σ Alt toplam</button>
          <button type="button" class="hof-free-tool" data-act="total-col" data-need="create" title="Her satırın sayısal değerlerini toplayan “Toplam” kolonu ekler">Σ Yan toplam</button>
          <button type="button" class="hof-free-tool" data-act="fill-down" data-need="edit" title="Seçili hücredeki formülü alttaki satırlara uygular (değer yazılmış satırlara)">↓ Doldur</button>
          <button type="button" class="hof-free-tool" data-act="fill-right" data-need="edit" title="Seçili hücredeki formülü sağdaki kolonlara uygular">→ Doldur</button>
          <span class="hof-free-sep" aria-hidden="true"></span>
          <button type="button" class="hof-free-tool" data-act="undo" data-need="edit" title="Bu ekranda yaptığınız son işlemi geri alır (Ctrl+Z)">↶ Geri Al</button>
      </div>
      <div class="hof-free-intro" hidden>Başlık satırına kolon adlarını, altına değerleri yazın. <b>Enter</b>, <b>Tab</b>, yön tuşları ya da fareyle başka hücreye geçtiğinizde kaydedilir. Hesap için <b>=</b> ile başlayın: <code>=B1*C1</code>, <code>=TOPLA(D1:D9)</code>.</div>
      <div class="hof-free-barrow">
        <span class="hof-free-namebox" aria-live="polite"></span>
        <span class="hof-free-fx" aria-hidden="true">ƒx</span>
        <input class="hof-free-bar" type="text" autocomplete="off" spellcheck="false" aria-label="Seçili hücrenin değeri ya da formülü" placeholder="Değer ya da =TOPLA(B1:B9) gibi formül">
        <span class="hof-free-status" role="status"></span>
      </div>
      <div class="hof-free-wrap">
        <table class="hof-free-grid" role="grid" aria-label="Serbest sayfa hücreleri"></table>
        <input class="hof-free-editor is-ready" type="text" autocomplete="off" spellcheck="false" aria-label="Hücre düzenleyici">
        <div class="hof-free-suggest" role="listbox" hidden></div>
      </div>
      <div class="hof-free-foot">
        <button type="button" class="hof-free-tool" data-act="append-row" data-need="create">+ Satır Ekle</button>
        <button type="button" class="hof-free-tool" data-act="append-rows" data-need="create" title="Sona 10 satır ekler">+ 10 Satır</button>
        <p class="hof-free-hint"><b>Yazın</b> ve geçin: kaydedilir · <b>F2</b> / çift tık: düzelt · <b>Delete</b>: temizle · <b>=</b> formül · <b>Ctrl+C / V</b>: Excel'den kopyala-yapıştır · <b>Ctrl+Z</b>: geri al · Sağ tık: satır/kolon işlemleri</p>
      </div>`,
    );
    dom = {
      root,
      wrap: root.querySelector(".hof-free-wrap"),
      table: root.querySelector(".hof-free-grid"),
      input: root.querySelector(".hof-free-editor"),
      bar: root.querySelector(".hof-free-bar"),
      name: root.querySelector(".hof-free-namebox"),
      status: root.querySelector(".hof-free-status"),
      suggest: root.querySelector(".hof-free-suggest"),
      meta: root.querySelector(".hof-free-meta"),
      title: root.querySelector(".hof-free-name"),
      intro: root.querySelector(".hof-free-intro"),
      menu: null,
    };
    dom.wrap.innerHTML = "";
    dom.wrap.append(dom.table, dom.input, dom.suggest);
    dom.table.innerHTML = '<tbody><tr><td class="hof-free-loading">Sayfa yükleniyor…</td></tr></tbody>';
    root.addEventListener("click", onClick);
    dom.wrap.addEventListener("pointerdown", onPointerDown);
    // Hücreye basınca odak düzenleyicide kalsın (formül yazarken tıklanan hücre adres olarak eklenir) ve metin seçilmesin.
    dom.wrap.addEventListener("mousedown", event => {
      if (event.button !== 0 || event.target.closest("button, .hof-free-editor, .hof-free-suggest")) return;
      if (cellFromEvent(event)) event.preventDefault();
    });
    dom.wrap.addEventListener("dblclick", onDoubleClick);
    dom.wrap.addEventListener("contextmenu", onContextMenu);
    dom.wrap.addEventListener("scroll", () => {
      position();
      closeSuggest();
    });
    dom.input.addEventListener("keydown", onKeyDown);
    dom.input.addEventListener("input", onInput);
    dom.input.addEventListener("compositionstart", () => {
      if (!state.editing) startEdit("enter", { keep: true });
    });
    dom.input.addEventListener("blur", onEditorBlur);
    dom.input.addEventListener("copy", onCopy);
    dom.input.addEventListener("cut", onCut);
    dom.input.addEventListener("paste", onPaste);
    dom.bar.addEventListener("focus", onBarFocus);
    dom.bar.addEventListener("keydown", onKeyDown);
    dom.bar.addEventListener("input", onInput);
    dom.bar.addEventListener("blur", onEditorBlur);
    dom.suggest.addEventListener("pointerdown", event => {
      const item = event.target.closest("[data-fn]");
      if (!item) return;
      event.preventDefault();
      acceptSuggest(item.dataset.fn);
    });
    place();
  }

  function apply(detail, { fresh = false } = {}) {
    if (!dom || !detail || detail.id !== state.id) return;
    const previous = state.sheet;
    const activeRow = previous && state.active.r >= 0 ? previous.rows[state.active.r]?.id : null;
    const activeCol = previous ? previous.columns[state.active.c]?.id : null;
    const anchorRow = previous && state.anchor && state.anchor.r >= 0 ? previous.rows[state.anchor.r]?.id : null;
    const anchorCol = previous && state.anchor ? previous.columns[state.anchor.c]?.id : null;
    const sameShape =
      previous &&
      previous.rows.length === detail.rows.length &&
      previous.columns.length === detail.columns.length &&
      previous.rows.every((row, index) => row.id === detail.rows[index].id) &&
      previous.columns.every((column, index) => column.id === detail.columns[index].id && column.header === detail.columns[index].header && column.name === detail.columns[index].name);
    state.sheet = detail;
    state.lastApply = Date.now();
    // Seçim, satır/kolon kimliğiyle korunur (başka biri üstte satır eklese de aynı hücrede kalınır).
    if (!fresh && previous) {
      const remap = (rowId, colId, fallback) => {
        const r = rowId ? detail.rows.findIndex(row => row.id === rowId) : fallback.r;
        const c = colId ? detail.columns.findIndex(column => column.id === colId) : fallback.c;
        return { r: r < 0 && rowId ? fallback.r : r, c: c < 0 ? fallback.c : c };
      };
      state.active = remap(activeRow, activeCol, state.active);
      if (state.anchor) state.anchor = remap(anchorRow, anchorCol, state.anchor);
    }
    clampActive();
    if (sameShape && !fresh) patchCells();
    else renderGrid();
    renderChrome();
    paintSelection();
    if (state.editing) {
      // Düzenlenen hücrenin satırı/kolonu silindiyse düzenleme bırakılır.
      const r = state.editing.r < 0 ? -1 : detail.rows.findIndex(row => row.id === state.editing.rowId);
      const c = detail.columns.findIndex(column => column.id === state.editing.colId);
      if ((state.editing.r >= 0 && r < 0) || c < 0) cancelEdit();
      else {
        Object.assign(state.editing, { r, c });
        tdAt(r, c)?.classList.add("is-editing");
        highlightRefs();
      }
    }
    position();
    if (fresh) {
      syncCard();
      if (lastPointer !== "touch" && !HOF.hasOpenModal()) focusGrid();
    }
  }

  function clampActive() {
    const R = rows().length;
    const C = cols().length;
    const fix = point => ({ r: clampValue(point.r, -1, Math.max(-1, R - 1)), c: clampValue(point.c, 0, Math.max(0, C - 1)) });
    state.active = fix(state.active);
    if (state.anchor) state.anchor = fix(state.anchor);
  }

  function cellClass(r, c) {
    const row = rows()[r];
    const col = cols()[c];
    const k = key(row.id, col.id);
    const cell = cellAt(r, c);
    const classes = [];
    if (pending.has(k)) {
      classes.push("is-pending");
      const raw = pending.get(k);
      if (!isFormula(raw) && (NUMERIC.test(raw.trim()) || DATE_TEXT.test(raw.trim()))) classes.push("is-num");
      return classes.join(" ");
    }
    const text = String(cell.display ?? "");
    if (cell.error || ERROR_TEXT.test(text)) classes.push("is-err");
    else if (NUMERIC.test(text.trim()) || DATE_TEXT.test(text.trim())) classes.push("is-num");
    if (cell.formula) classes.push("is-fx");
    if (cell.formula && !row.record) classes.push("is-idle");
    return classes.join(" ");
  }
  function cellText(r, c) {
    const row = rows()[r];
    const k = key(row.id, cols()[c].id);
    if (pending.has(k)) {
      const raw = pending.get(k);
      return isFormula(raw) ? "…" : raw;
    }
    return String(cellAt(r, c).display ?? "");
  }

  // Kolon genişliği içeriğe göre (Excel'deki "sığdır" gibi): başlık ve ilk 300 satırın en uzun metni; 84–280 piksel.
  let measure = null;
  function columnWidths() {
    if (!measure) measure = document.createElement("canvas").getContext("2d");
    const family = getComputedStyle(document.body).fontFamily || "sans-serif";
    const width = (text, font) => {
      measure.font = font;
      return measure.measureText(text).width;
    };
    return cols().map((column, c) => {
      let widest = width(column.header, `800 11.5px ${family}`) + 26;
      const limit = Math.min(rows().length, 300);
      for (let r = 0; r < limit; r += 1) {
        const text = cellText(r, c);
        if (text) widest = Math.max(widest, width(text.length > 60 ? text.slice(0, 60) : text, `12.5px ${family}`) + 24);
      }
      return Math.round(clampValue(widest, 84, 280));
    });
  }

  function renderGrid() {
    if (!dom || !state.sheet) return;
    const create = canCreate();
    const edit = canEdit();
    const columns = cols();
    const head = columns
      .map((column, c) => {
        const removable = canDelete() || (create && columnEmpty(c));
        const named = Boolean(column.name);
        return `<th class="hof-free-head${named ? "" : " is-default"}" scope="col" title="${esc(column.header)}"><span class="hof-free-headtext">${esc(column.header)}</span>${
          edit
            ? `<span class="hof-free-headtools"><button type="button" class="hof-free-mini" data-act="rename-col" data-c="${c}" title="Başlığı düzenle" aria-label="${esc(column.header)} başlığını düzenle">${ICON_PENCIL}</button>${removable ? `<button type="button" class="hof-free-mini hof-free-danger" data-act="delete-col" data-c="${c}" title="Kolonu sil" aria-label="${esc(column.header)} kolonunu sil">×</button>` : ""}</span>`
            : ""
        }</th>`;
      })
      .join("");
    const body = rows()
      .map((row, r) => {
        const removable = canDelete() || (create && rowEmpty(r));
        const cells = columns.map((_, c) => `<td class="${cellClass(r, c)}">${esc(cellText(r, c))}</td>`).join("");
        return `<tr class="${row.record ? "" : "is-blank"}"><th class="hof-free-rowhead" scope="row"><span>${row.number}</span>${removable ? `<button type="button" class="hof-free-mini hof-free-danger" data-act="delete-row" data-r="${r}" title="${row.number}. satırı sil" aria-label="${row.number}. satırı sil">×</button>` : ""}</th>${cells}${create ? '<td class="hof-free-pad" aria-hidden="true"></td>' : ""}</tr>`;
      })
      .join("");
    const widths = columnWidths();
    dom.table.innerHTML = `<colgroup><col class="hof-free-numcol">${columns.map((_, c) => `<col class="hof-free-col" style="width:${widths[c]}px">`).join("")}${create ? '<col class="hof-free-addcol">' : ""}</colgroup>
      <thead>
        <tr class="hof-free-letters"><th class="hof-free-corner" aria-hidden="true"></th>${columns.map((column, c) => `<th class="hof-free-letter" data-c="${c}" scope="col">${esc(column.letter)}</th>`).join("")}${create ? '<th class="hof-free-letter hof-free-plus"><button type="button" data-act="append-col" title="Sona kolon ekle" aria-label="Sona kolon ekle">+</button></th>' : ""}</tr>
        <tr class="hof-free-heads"><th class="hof-free-rowhead hof-free-headlabel" scope="row" title="Kolon başlıkları">Başlık</th>${head}${create ? '<th class="hof-free-pad" aria-hidden="true"></th>' : ""}</tr>
      </thead>
      <tbody>${body}</tbody>`;
    selection.clear();
  }

  // Yapı aynıysa yalnızca değişen hücreler güncellenir (büyük sayfada her kayıtta tüm tabloyu yeniden çizmemek için).
  function patchCells() {
    const body = dom.table.tBodies[0];
    if (!body) return renderGrid();
    rows().forEach((row, r) => {
      const tr = body.rows[r];
      if (!tr) return;
      tr.className = row.record ? "" : "is-blank";
      cols().forEach((_, c) => {
        const td = tr.cells[c + 1];
        if (!td) return;
        setCellText(td, cellText(r, c));
        const wanted = cellClass(r, c);
        const keep = [...td.classList].filter(name => name === "is-active" || name === "in-range" || name === "is-ref" || name === "is-editing");
        const next = [wanted, ...keep].filter(Boolean).join(" ");
        if (td.className !== next) td.className = next;
      });
    });
    // Satır/kolon silme düğmeleri boşluğa göre değişebilir: başlık ve satır başlıkları yeniden çizilmez, düğmeler güncellenir.
    refreshRemovers();
  }
  function refreshRemovers() {
    const create = canCreate();
    const body = dom.table.tBodies[0];
    rows().forEach((row, r) => {
      const th = body?.rows[r]?.cells[0];
      if (!th) return;
      const want = canDelete() || (create && rowEmpty(r));
      const has = th.querySelector('[data-act="delete-row"]');
      if (want && !has) th.insertAdjacentHTML("beforeend", `<button type="button" class="hof-free-mini hof-free-danger" data-act="delete-row" data-r="${r}" title="${row.number}. satırı sil" aria-label="${row.number}. satırı sil">×</button>`);
      else if (!want && has) has.remove();
    });
    const heads = dom.table.tHead?.rows[1];
    cols().forEach((column, c) => {
      const tools = heads?.cells[c + 1]?.querySelector(".hof-free-headtools");
      if (!tools) return;
      const want = canDelete() || (create && columnEmpty(c));
      const has = tools.querySelector('[data-act="delete-col"]');
      if (want && !has) tools.insertAdjacentHTML("beforeend", `<button type="button" class="hof-free-mini hof-free-danger" data-act="delete-col" data-c="${c}" title="Kolonu sil" aria-label="${esc(column.header)} kolonunu sil">×</button>`);
      else if (!want && has) has.remove();
    });
  }

  function renderChrome() {
    if (!dom || !state.sheet) return;
    const sheet = state.sheet;
    dom.title.textContent = sheet.name;
    const records = sheet.rows.filter(row => row.record).length;
    const when = sheet.updatedAt ? HOF.relativeTime(sheet.updatedAt) : "";
    dom.meta.textContent = `${sheet.columns.length} kolon · ${sheet.rows.length} satır · ${records} kayıt${sheet.updatedByName ? ` · son değişiklik ${sheet.updatedByName}${when ? `, ${when}` : ""}` : ""}`;
    dom.intro.hidden = records > 0 || sheet.columns.some(column => column.name);
    const edit = canEdit();
    const create = canCreate();
    for (const button of dom.root.querySelectorAll("[data-need]")) {
      const need = button.dataset.need;
      button.hidden = need === "create" ? !create : need === "edit" ? !edit : false;
    }
    dom.root.querySelector('[data-act="rename-sheet"]').hidden = !create;
    const undo = dom.root.querySelector('[data-act="undo"]');
    undo.disabled = !stack().length;
    undo.title = stack().length ? `Geri al: ${stack().at(-1).label} (Ctrl+Z)` : "Geri alınacak işlem yok";
    const wide = dom.root.querySelector('[data-act="wide"]');
    wide.setAttribute("aria-pressed", String(state.wide));
    wide.title = state.wide ? "Detay kartını yana al" : "Tabloyu genişlet (detay kartı alta geçer)";
    dom.bar.readOnly = !edit;
    dom.input.readOnly = !edit;
    setStatus();
  }

  function setStatus(text) {
    if (!dom) return;
    let message = text;
    let tone = "";
    if (message === undefined) {
      if (state.busy) {
        message = "Kaydediliyor…";
        tone = "busy";
      } else if (state.failed) {
        message = "Kaydedilemedi";
        tone = "error";
      } else if (state.sheet) {
        message = canEdit() ? "Tüm değişiklikler kaydedildi" : "Yalnızca görüntüleme";
        tone = "ok";
      } else message = "";
    }
    dom.status.textContent = message;
    dom.status.dataset.tone = tone;
  }

  // ---------- Seçim ----------
  const selection = new Set();
  function tdAt(r, c) {
    if (!dom) return null;
    if (r < 0) return dom.table.tHead?.rows[1]?.cells[c + 1] || null;
    return dom.table.tBodies[0]?.rows[r]?.cells[c + 1] || null;
  }
  function paintSelection() {
    if (!dom || !state.sheet) return;
    for (const node of selection) node.classList.remove("is-active", "in-range", "is-on");
    selection.clear();
    dom.table.querySelectorAll(".hof-free-celltools").forEach(node => node.remove());
    const { r1, r2, c1, c2 } = range();
    const multi = r1 !== r2 || c1 !== c2;
    if (multi) {
      for (let r = r1; r <= r2; r += 1)
        for (let c = c1; c <= c2; c += 1) {
          const td = tdAt(r, c);
          if (td) {
            td.classList.add("in-range");
            selection.add(td);
          }
        }
    }
    const { r, c } = state.active;
    const td = tdAt(r, c);
    if (td) {
      td.classList.add("is-active");
      selection.add(td);
      if (r >= 0 && canEdit() && !state.editing && !multi) {
        const filled = Boolean(rawAt(r, c));
        td.insertAdjacentHTML("beforeend", `<span class="hof-free-celltools" data-hof-ui><button type="button" class="hof-free-mini" data-act="edit-cell" title="Düzelt (F2)" aria-label="Hücreyi düzelt">${ICON_PENCIL}</button>${filled ? '<button type="button" class="hof-free-mini hof-free-danger" data-act="clear-cell" title="Hücreyi temizle (Delete)" aria-label="Hücreyi temizle">×</button>' : ""}</span>`);
      }
    }
    for (let cc = c1; cc <= c2; cc += 1) {
      const letter = dom.table.tHead?.rows[0]?.cells[cc + 1];
      if (letter) {
        letter.classList.add("is-on");
        selection.add(letter);
      }
    }
    for (let rr = Math.max(0, r1); rr <= r2; rr += 1) {
      const head = dom.table.tBodies[0]?.rows[rr]?.cells[0];
      if (head) {
        head.classList.add("is-on");
        selection.add(head);
      }
    }
    dom.name.textContent = multi ? `${address(r1, c1)}:${address(r2, c2)}` : address(r, c);
    if (!state.editing) dom.bar.value = r < 0 ? cols()[c]?.name || "" : rawAt(r, c);
    dom.bar.placeholder = r < 0 ? `Kolon başlığı (boşsa “${cols()[c]?.header || ""}”)` : "Değer ya da =TOPLA(B1:B9) gibi formül";
    markCardRow();
    position();
  }

  function scrollIntoView(r, c) {
    const td = tdAt(r, c);
    if (!td || !dom) return;
    const wrap = dom.wrap;
    const head = dom.table.tHead?.getBoundingClientRect().height || 0;
    const rowHead = dom.table.tHead?.rows[0]?.cells[0]?.getBoundingClientRect().width || 0;
    const box = wrap.getBoundingClientRect();
    const cell = td.getBoundingClientRect();
    if (r >= 0) {
      if (cell.top < box.top + head) wrap.scrollTop -= box.top + head - cell.top;
      else if (cell.bottom > box.bottom) wrap.scrollTop += cell.bottom - box.bottom + 2;
    }
    if (cell.left < box.left + rowHead) wrap.scrollLeft -= box.left + rowHead - cell.left;
    else if (cell.right > box.right) wrap.scrollLeft += cell.right - box.right + 2;
  }

  function select(r, c, { extend = false, keepAnchor = false } = {}) {
    const R = rows().length;
    const C = cols().length;
    const next = { r: clampValue(r, -1, R - 1), c: clampValue(c, 0, C - 1) };
    if (extend) {
      if (!state.anchor) state.anchor = { ...state.active };
      // Aralık başlık satırına uzanmaz.
      next.r = Math.max(0, next.r);
      if (state.anchor.r < 0) state.anchor.r = 0;
    } else if (!keepAnchor) state.anchor = null;
    const rowChanged = next.r !== state.active.r;
    state.active = next;
    paintSelection();
    scrollIntoView(next.r, next.c);
    if (rowChanged) syncCard();
  }

  function move(dr, dc, { extend = false, jump = false } = {}) {
    const R = rows().length;
    const C = cols().length;
    let { r, c } = state.active;
    if (jump) {
      if (dr) r = dr > 0 ? R - 1 : -1;
      if (dc) c = dc > 0 ? C - 1 : 0;
    } else {
      r += dr;
      c += dc;
    }
    select(r, c, { extend });
  }

  // Tab: sağa; son kolondan sonra alt satırın ilk kolonu (Shift+Tab tersi).
  function tab(back) {
    const C = cols().length;
    let { r, c } = state.active;
    if (back) {
      if (c > 0) c -= 1;
      else if (r > -1) {
        r -= 1;
        c = C - 1;
      }
    } else if (c < C - 1) c += 1;
    else if (r < rows().length - 1) {
      r += 1;
      c = 0;
    }
    select(r, c);
  }

  // ---------- Detay kartı ----------
  const syncCard = (() => {
    let timer = 0;
    return () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const row = rows()[state.active.r];
        if (row && row.record) selectRecord(row.key);
      }, 160);
    };
  })();
  function selectRecord(target) {
    const tr = [...document.querySelectorAll(".dynamic-table tbody tr")].find(item => item.dataset.hofKey === target);
    if (!tr) {
      wantedKey = target;
      return;
    }
    wantedKey = "";
    if (tr.classList.contains("selected")) return;
    HOF.quietSelect = true;
    try {
      tr.click();
    } finally {
      HOF.quietSelect = false;
    }
  }
  // Detay kartında gösterilen kaydın satır numarası vurgulanır.
  function markCardRow() {
    if (!dom || !state.sheet) return;
    const shown = HOF.detailPanel()?.dataset.hofKey || "";
    const body = dom.table.tBodies[0];
    if (!body) return;
    const previous = body.querySelector(":scope > tr > th.is-card");
    const index = shown ? rows().findIndex(row => row.key === shown) : -1;
    const next = index >= 0 ? body.rows[index]?.cells[0] : null;
    if (previous === next) return;
    previous?.classList.remove("is-card");
    previous?.removeAttribute("title");
    if (next) {
      next.classList.add("is-card");
      next.title = "Detay kartında bu satır gösteriliyor";
    }
  }

  // ---------- Düzenleyici ----------
  function focusGrid() {
    if (!dom || state.editing) return;
    if (document.activeElement !== dom.input) dom.input.focus({ preventScroll: true });
  }

  // Düzenleyici, etkin hücrenin üstünde durur; hazırda görünmez (yazılan ilk harfi yakalamak ve IME penceresinin hücrenin
  // yanında açılması için).
  function position() {
    if (!dom || !state.sheet) return;
    const target = state.editing ? tdAt(state.editing.r, state.editing.c) : tdAt(state.active.r, state.active.c);
    if (!target) return;
    const wrap = dom.wrap.getBoundingClientRect();
    const cell = target.getBoundingClientRect();
    const left = cell.left - wrap.left + dom.wrap.scrollLeft;
    const top = cell.top - wrap.top + dom.wrap.scrollTop;
    const style = dom.input.style;
    style.left = `${left}px`;
    style.top = `${top}px`;
    style.height = `${cell.height}px`;
    style.minWidth = `${cell.width}px`;
    if (!state.editing) style.width = `${cell.width}px`;
  }

  function startEdit(mode, { keep = false, value, target } = {}) {
    if (!dom || !state.sheet || !canEdit()) {
      if (dom) dom.input.value = "";
      return false;
    }
    const { r, c } = state.active;
    const column = cols()[c];
    const row = rows()[r];
    if (!column || (r >= 0 && !row)) return false;
    const original = r < 0 ? column.name || "" : rawAt(r, c);
    const field = target || dom.input;
    state.anchor = null;
    state.point = null;
    state.editing = { r, c, rowId: row?.id || "", colId: column.id, original, mode, target: field };
    if (field === dom.input) {
      if (!keep) dom.input.value = value ?? original;
      dom.input.classList.remove("is-ready");
      dom.input.classList.toggle("is-head", r < 0);
      dom.input.style.width = "";
      position();
      if (document.activeElement !== dom.input) dom.input.focus({ preventScroll: true });
      const end = dom.input.value.length;
      dom.input.setSelectionRange(end, end);
    }
    tdAt(r, c)?.classList.add("is-editing");
    dom.root.classList.add("is-editing");
    paintSelection();
    if (field === dom.input) dom.bar.value = dom.input.value;
    highlightRefs();
    updateSuggest();
    return true;
  }

  function stopEdit() {
    if (!dom || !state.editing) return;
    const { r, c, target } = state.editing;
    tdAt(r, c)?.classList.remove("is-editing");
    state.editing = null;
    state.point = null;
    dom.root.classList.remove("is-editing");
    dom.input.value = "";
    dom.input.classList.add("is-ready");
    dom.input.classList.remove("is-head");
    closeSuggest();
    highlightRefs();
    if (target === dom.bar && document.activeElement === dom.bar) dom.bar.blur();
  }

  function cancelEdit() {
    if (!state.editing) return;
    stopEdit();
    paintSelection();
    focusGrid();
  }

  // Düzenlemeyi kaydeder; move: { dr, dc } ya da "tab"/"backtab"; null yalnızca kaydeder.
  function commit(moveTo) {
    const editing = state.editing;
    if (!editing || !dom) return;
    const value = editing.target.value;
    const clean = value.trim() ? value : "";
    stopEdit();
    if (clean !== editing.original) {
      if (editing.r < 0) renameColumn(editing.colId, clean, editing.original);
      else saveCells([{ rowId: editing.rowId, colId: editing.colId, raw: clean, before: editing.original }], "hücre");
    }
    if (moveTo === "tab" || moveTo === "backtab") tab(moveTo === "backtab");
    else if (moveTo) {
      // Son satırda Enter: ekleme yetkisi varsa alta yeni satır açılır (Excel'deki gibi aşağı devam edilir).
      if (moveTo.dr > 0 && state.active.r === rows().length - 1 && canCreate() && clean) {
        const at = state.active;
        addRows(rows().length, 1, { quiet: true }).then(detail => {
          if (detail && state.active.r === at.r && state.active.c === at.c) select(at.r + 1, at.c);
        });
      } else move(moveTo.dr || 0, moveTo.dc || 0);
    } else paintSelection();
    if (lastPointer !== "touch" || moveTo) focusGrid();
  }

  function onEditorBlur() {
    // Odak ızgaradan çıkınca (başka alana tıklama) düzenleme kaydedilir. Formül çubuğu ↔ hücre arası geçiş sayılmaz.
    setTimeout(() => {
      if (!state.editing || !dom) return;
      const now = document.activeElement;
      if (now === dom.input || now === dom.bar) return;
      commit(null);
    }, 0);
  }

  function onBarFocus() {
    if (!dom || !state.sheet) return;
    if (!canEdit()) return;
    if (state.editing && state.editing.target === dom.bar) return;
    if (state.editing) {
      // Hücrede başlanan düzenleme formül çubuğunda sürer.
      const value = dom.input.value;
      const { r, c } = state.editing;
      state.editing.target = dom.bar;
      dom.bar.value = value;
      dom.input.value = "";
      dom.input.classList.add("is-ready");
      state.editing.mode = "edit";
      state.active = { r, c };
      return;
    }
    const { r, c } = state.active;
    state.active = { r, c };
    startEdit("edit", { target: dom.bar });
  }

  function onInput(event) {
    if (!dom) return;
    const field = event.target;
    if (!state.editing) {
      if (field === dom.input && dom.input.value) {
        // Hazırdayken yazılan ilk harf: hücre yazılan değerle düzenlemeye açılır (Excel'deki gibi eskisinin yerine).
        if (!startEdit("enter", { keep: true })) dom.input.value = "";
      }
      return;
    }
    state.point = null;
    if (field === dom.input) dom.bar.value = dom.input.value;
    highlightRefs();
    updateSuggest();
  }

  // ---------- Klavye ----------
  function onKeyDown(event) {
    if (!dom || !state.sheet || event.isComposing || event.keyCode === 229) return;
    const ctrl = event.ctrlKey || event.metaKey;
    const keyName = event.key;
    if (suggestState && !dom.suggest.hidden) {
      if (keyName === "ArrowDown" || keyName === "ArrowUp") {
        event.preventDefault();
        moveSuggest(keyName === "ArrowDown" ? 1 : -1);
        return;
      }
      if (keyName === "Tab" || (keyName === "Enter" && suggestState.touched)) {
        event.preventDefault();
        acceptSuggest(suggestState.items[suggestState.index][0]);
        return;
      }
      if (keyName === "Escape") {
        event.preventDefault();
        closeSuggest();
        return;
      }
    }
    if (state.editing) {
      if (keyName === "Enter") {
        event.preventDefault();
        commit({ dr: event.shiftKey ? -1 : 1, dc: 0 });
      } else if (keyName === "Tab") {
        event.preventDefault();
        commit(event.shiftKey ? "backtab" : "tab");
      } else if (keyName === "Escape") {
        event.preventDefault();
        if (state.editing.target === dom.bar) dom.bar.value = state.editing.original;
        cancelEdit();
      } else if (keyName === "F2") {
        event.preventDefault();
        state.editing.mode = state.editing.mode === "enter" ? "edit" : "enter";
      } else if (state.editing.mode === "enter" && state.editing.target === dom.input && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(keyName) && !event.shiftKey) {
        event.preventDefault();
        const step = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[keyName];
        commit({ dr: step[0], dc: step[1] });
      }
      return;
    }
    if (event.target === dom.bar) return;
    const arrows = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (arrows[keyName]) {
      event.preventDefault();
      move(arrows[keyName][0], arrows[keyName][1], { extend: event.shiftKey, jump: ctrl });
    } else if (keyName === "Enter") {
      event.preventDefault();
      move(event.shiftKey ? -1 : 1, 0);
    } else if (keyName === "Tab") {
      event.preventDefault();
      tab(event.shiftKey);
    } else if (keyName === "F2") {
      event.preventDefault();
      startEdit("edit");
    } else if (keyName === "Delete" || keyName === "Backspace") {
      event.preventDefault();
      clearSelection();
    } else if (keyName === "Escape") {
      if (state.anchor) {
        event.preventDefault();
        state.anchor = null;
        paintSelection();
      }
    } else if (keyName === "Home") {
      event.preventDefault();
      select(ctrl ? -1 : state.active.r, 0);
    } else if (keyName === "End") {
      event.preventDefault();
      select(ctrl ? rows().length - 1 : state.active.r, cols().length - 1);
    } else if (keyName === "PageDown" || keyName === "PageUp") {
      event.preventDefault();
      move(keyName === "PageDown" ? PAGE_STEP : -PAGE_STEP, 0, { extend: event.shiftKey });
    } else if (ctrl && (keyName === "z" || keyName === "Z") && !event.shiftKey) {
      event.preventDefault();
      undo();
    } else if (ctrl && (keyName === "a" || keyName === "A")) {
      event.preventDefault();
      state.anchor = { r: 0, c: 0 };
      state.active = { r: rows().length - 1, c: cols().length - 1 };
      paintSelection();
    }
  }

  // ---------- Fare ----------
  function cellFromEvent(event) {
    const th = event.target.closest("th");
    const td = event.target.closest("td");
    if (td && dom.table.contains(td) && td.parentElement.parentElement === dom.table.tBodies[0]) {
      const c = td.cellIndex - 1;
      const r = td.parentElement.sectionRowIndex;
      if (c < 0 || c >= cols().length) return null;
      return { kind: "cell", r, c };
    }
    if (th && dom.table.contains(th)) {
      if (th.classList.contains("hof-free-head")) return { kind: "cell", r: -1, c: th.cellIndex - 1 };
      if (th.classList.contains("hof-free-letter") && th.dataset.c !== undefined) return { kind: "column", c: Number(th.dataset.c) };
      if (th.classList.contains("hof-free-rowhead") && !th.classList.contains("hof-free-headlabel")) return { kind: "row", r: th.parentElement.sectionRowIndex };
    }
    return null;
  }

  function pointable() {
    const editing = state.editing;
    if (!editing || editing.r < 0) return false;
    const field = editing.target;
    const text = field.value;
    if (!text.startsWith("=")) return false;
    if (state.point) return true;
    const before = text.slice(0, field.selectionStart ?? text.length).trimEnd();
    return /[=(;,+\-*/^&<>:]$/.test(before);
  }
  const refText = (a, b) => {
    const one = point => `${colLetter(point.c)}${point.r + 1}`;
    if (!b || (a.r === b.r && a.c === b.c)) return one(a);
    return `${one({ r: Math.min(a.r, b.r), c: Math.min(a.c, b.c) })}:${one({ r: Math.max(a.r, b.r), c: Math.max(a.c, b.c) })}`;
  };
  function insertReference(text) {
    const field = state.editing.target;
    const value = field.value;
    const replacing = state.point && Number.isInteger(state.point.start) && Number.isInteger(state.point.end) && state.point.end <= value.length;
    const start = replacing ? state.point.start : field.selectionStart ?? value.length;
    const end = replacing ? state.point.end : field.selectionEnd ?? value.length;
    field.value = value.slice(0, start) + text + value.slice(end);
    state.point = { start, end: start + text.length };
    field.setSelectionRange(start + text.length, start + text.length);
    if (field === dom.input) dom.bar.value = field.value;
    highlightRefs();
    closeSuggest();
  }

  function onPointerDown(event) {
    if (!dom || !state.sheet || event.button > 0) return;
    lastPointer = event.pointerType || "mouse";
    if (event.target.closest("button, .hof-free-editor, .hof-free-suggest")) return;
    const hit = cellFromEvent(event);
    if (!hit) return;
    // Formül yazarken hücreye tıklamak başvurusunu ekler (sürükleyince aralık).
    if (state.editing && hit.kind === "cell" && hit.r >= 0 && pointable()) {
      event.preventDefault();
      const from = { r: hit.r, c: hit.c };
      insertReference(refText(from));
      dragging = { kind: "point", from };
      return;
    }
    if (state.editing && hit.kind === "column" && pointable()) {
      event.preventDefault();
      insertReference(`${colLetter(hit.c)}:${colLetter(hit.c)}`);
      return;
    }
    if (state.editing) commit(null);
    if (hit.kind === "column") {
      if (!rows().length) return select(-1, hit.c);
      state.anchor = { r: 0, c: hit.c };
      state.active = { r: rows().length - 1, c: hit.c };
      paintSelection();
      if (lastPointer !== "touch") focusGrid();
      event.preventDefault();
      return;
    }
    if (hit.kind === "row") {
      state.anchor = { r: hit.r, c: 0 };
      state.active = { r: hit.r, c: cols().length - 1 };
      paintSelection();
      syncCard();
      if (lastPointer !== "touch") focusGrid();
      event.preventDefault();
      return;
    }
    const again = hit.r === state.active.r && hit.c === state.active.c && !state.anchor;
    if (lastPointer === "touch") {
      // Dokunmatikte ilk dokunuş seçer; seçili hücreye yeniden dokunmak düzenlemeye açar (klavye o zaman açılır).
      if (again) startEdit("edit");
      else select(hit.r, hit.c);
      return;
    }
    event.preventDefault();
    select(hit.r, hit.c, { extend: event.shiftKey && hit.r >= 0 });
    focusGrid();
    if (hit.r >= 0) dragging = { kind: "select" };
  }
  document.addEventListener("pointermove", event => {
    if (!dragging || !dom || !(event.buttons & 1)) return;
    const hit = cellFromEvent(event);
    if (!hit || hit.kind !== "cell" || hit.r < 0) return;
    if (dragging.kind === "point" && state.editing) insertReference(refText(dragging.from, hit));
    else if (dragging.kind === "select") {
      if (!state.anchor) state.anchor = { ...state.active };
      if (state.active.r !== hit.r || state.active.c !== hit.c) {
        state.active = { r: hit.r, c: hit.c };
        paintSelection();
      }
    }
  });
  document.addEventListener("pointerup", () => {
    if (dragging?.kind === "select" && state.anchor && state.anchor.r === state.active.r && state.anchor.c === state.active.c) {
      state.anchor = null;
      paintSelection();
    }
    dragging = null;
  });

  function onDoubleClick(event) {
    if (!dom || !state.sheet) return;
    if (event.target.closest("button")) return;
    const hit = cellFromEvent(event);
    if (!hit || hit.kind !== "cell") return;
    event.preventDefault();
    if (state.editing) return;
    select(hit.r, hit.c);
    startEdit("edit");
  }

  // ---------- Düğmeler ----------
  function onClick(event) {
    const button = event.target.closest("[data-act]");
    if (!button || !dom || !dom.root.contains(button) || button.disabled) return;
    event.preventDefault();
    const result = runAction(button);
    // Düğmeden sonra klavye yine ızgarada (ör. × ile temizleyip Ctrl+Z); pencere ya da menü açıldıysa ona dokunulmaz.
    if (!state.editing && !HOF.hasOpenModal() && !dom.menu && lastPointer !== "touch") focusGrid();
    return result;
  }
  function runAction(button) {
    const act = button.dataset.act;
    const c = button.dataset.c !== undefined ? Number(button.dataset.c) : state.active.c;
    const r = button.dataset.r !== undefined ? Number(button.dataset.r) : state.active.r;
    if (state.editing && act !== "edit-cell") commit(null);
    switch (act) {
      case "add-row":
        return addRows(Math.max(0, state.active.r + 1), 1, { select: true });
      case "append-row":
        return addRows(rows().length, 1, { select: true });
      case "append-rows":
        return addRows(rows().length, 10, { select: true });
      case "add-col":
        return addColumn(state.active.c + 1);
      case "append-col":
        return addColumn(cols().length);
      case "total-row":
        return totals("row");
      case "total-col":
        return totals("column");
      case "fill-down":
        return fill("down");
      case "fill-right":
        return fill("right");
      case "undo":
        return undo();
      case "help":
        return openHelp();
      case "wide":
        return toggleWide();
      case "more":
        return openMenu(button, sheetMenu());
      case "rename-sheet":
        return renameSheet();
      case "rename-col":
        select(-1, c);
        return startEdit("edit");
      case "delete-col":
        return deleteColumn(c);
      case "delete-row":
        return deleteRow(r);
      case "edit-cell":
        return startEdit("edit");
      case "reload":
        return load();
      case "clear-cell":
        return clearSelection();
      default:
        return undefined;
    }
  }

  function toggleWide() {
    state.wide = !state.wide;
    try {
      localStorage.setItem("hof-free-wide", state.wide ? "1" : "0");
    } catch {
      /* tercih bu cihazda saklanamadı */
    }
    document.body.classList.toggle("hof-free-wide", state.wide);
    renderChrome();
    requestAnimationFrame(position);
  }

  // ---------- Kaydetme sırası ----------
  // İstekler sırayla gider (aynı hücreye art arda yazılan değerlerin sırası karışmaz); her yanıt sayfanın güncel hâlidir.
  // Ağ bir an koparsa hücre yazma ve başlık adlandırma (tekrarlanınca aynı sonucu veren istekler) sessizce yeniden denenir.
  async function withRetry(task, retry) {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await task();
      } catch (error) {
        if (!retry || error.status || attempt >= 3) throw error;
        setStatus("Bağlantı bekleniyor…");
        await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** attempt));
      }
    }
  }
  function queue(request, { after, quiet = false, retry = false } = {}) {
    const sheetId = state.id;
    state.busy += 1;
    setStatus();
    const run = saveChain
      .then(() => withRetry(() => request(sheetId), retry))
      .then(
        detail => {
          after?.(detail);
          state.failed = false;
          if (sheetId === state.id) apply(detail);
          refreshSoon();
          return detail;
        },
        error => {
          after?.(null);
          if (sheetId === state.id) {
            if (error.status !== 409 || !quiet) HOF.toastError(error);
            state.failed = error.status !== 409 && error.status !== 400 && error.status !== 403;
            reloadSoon(50);
          }
          return null;
        },
      )
      .finally(() => {
        state.busy -= 1;
        setStatus();
        renderUndo();
      });
    saveChain = run.catch(() => {});
    return run;
  }
  const url = (sheetId, path = "") => `${API}/${encodeURIComponent(sheetId)}${path}`;

  function pushUndo(entry) {
    const list = stack();
    list.push(entry);
    if (list.length > 60) list.shift();
    renderUndo();
  }
  function renderUndo() {
    if (!dom) return;
    const button = dom.root.querySelector('[data-act="undo"]');
    if (!button) return;
    button.disabled = !stack().length || !canEdit();
    button.title = stack().length ? `Geri al: ${stack().at(-1).label} (Ctrl+Z)` : "Geri alınacak işlem yok";
  }
  function undo() {
    const entry = stack().pop();
    renderUndo();
    if (!entry) return HOF.toast("Bu sayfada geri alınacak işlem yok.");
    return Promise.resolve(entry.run()).then(detail => {
      if (detail) HOF.toast(`Geri alındı: ${entry.label}.`, { type: "success", timeout: 2200 });
    });
  }

  // changes: [{ rowId, colId, raw, before }]
  function saveCells(changes, label, { record = true } = {}) {
    if (!changes.length) return Promise.resolve(null);
    const marks = changes.map(change => [key(change.rowId, change.colId), change.raw]);
    for (const [k, raw] of marks) pending.set(k, raw);
    patchPending();
    if (record) {
      const reverse = changes.map(change => ({ rowId: change.rowId, colId: change.colId, raw: change.before, before: change.raw }));
      pushUndo({ label: changes.length > 1 ? `${changes.length} hücre` : label, run: () => saveCells(reverse, label, { record: false }) });
    }
    return queue(sheetId => HOF.api(url(sheetId, "/cells"), { method: "PUT", body: { cells: changes.map(change => ({ row: change.rowId, col: change.colId, raw: change.raw })) } }), {
      retry: true,
      after: () => {
        for (const [k, raw] of marks) if (pending.get(k) === raw) pending.delete(k);
      },
    });
  }
  function patchPending() {
    if (!dom || !state.sheet) return;
    rows().forEach((row, r) =>
      cols().forEach((column, c) => {
        if (!pending.has(key(row.id, column.id))) return;
        const td = tdAt(r, c);
        if (!td) return;
        setCellText(td, cellText(r, c));
        td.classList.add("is-pending");
      }),
    );
  }

  function renameColumn(colId, name, before) {
    const c = cols().findIndex(column => column.id === colId);
    const th = tdAt(-1, c);
    const text = th?.querySelector(".hof-free-headtext");
    if (text) text.textContent = name || `Sütun ${colLetter(c)}`;
    const entry = { label: "başlık", run: () => queue(sheetId => HOF.api(url(sheetId, `/columns/${encodeURIComponent(colId)}`), { method: "PUT", body: { name: before } })) };
    pushUndo(entry);
    return queue(sheetId => HOF.api(url(sheetId, `/columns/${encodeURIComponent(colId)}`), { method: "PUT", body: { name } }), { retry: true }).then(detail => {
      if (!detail) {
        // Kaydedilemediyse (ör. aynı adlı kolon var) geri alma kaydı da düşer.
        const list = stack();
        const index = list.lastIndexOf(entry);
        if (index >= 0) list.splice(index, 1);
        renderUndo();
      }
      return detail;
    });
  }

  function clearSelection() {
    if (!canEdit()) return;
    const { r1, r2, c1, c2 } = range();
    if (state.active.r < 0 && !state.anchor) {
      const column = cols()[state.active.c];
      if (column?.name) renameColumn(column.id, "", column.name);
      return;
    }
    const changes = [];
    for (let r = Math.max(0, r1); r <= r2; r += 1)
      for (let c = c1; c <= c2; c += 1) {
        const before = rawAt(r, c);
        if (before) changes.push({ rowId: rows()[r].id, colId: cols()[c].id, raw: "", before });
      }
    if (changes.length) saveCells(changes, "temizleme");
  }

  // Yapı işlemleri: sunucu anlık görüntü aldıysa geri alma onu geri yükler.
  function structural(label, request, { undoFallback, toast } = {}) {
    return queue(request).then(detail => {
      if (!detail) return null;
      if (detail.snapshot) {
        const snapshot = detail.snapshot;
        pushUndo({ label, run: () => queue(sheetId => HOF.api(url(sheetId, "/undo"), { method: "POST", body: { snapshot } })) });
      } else if (undoFallback) pushUndo({ label, run: () => undoFallback(detail) });
      if (toast) {
        const entry = stack().at(-1);
        HOF.toast(toast(detail), {
          type: "success",
          action: entry
            ? {
                label: "Geri Al",
                onClick: () => {
                  const list = stack();
                  const index = list.lastIndexOf(entry);
                  if (index < 0) return;
                  list.splice(index, 1);
                  renderUndo();
                  entry.run();
                },
              }
            : undefined,
        });
      }
      return detail;
    });
  }

  function addRows(index, count, { select: focus = false, quiet = false } = {}) {
    if (!canCreate()) return Promise.resolve(null);
    const atEnd = index >= rows().length;
    return structural(count > 1 ? `${count} satır ekleme` : "satır ekleme", sheetId => HOF.api(url(sheetId, "/rows"), { method: "POST", body: atEnd ? { count } : { index, count } }), {
      undoFallback: detail => {
        const ids = detail.added || [];
        return ids.reduce((chain, rowId) => chain.then(() => queue(sheetId => HOF.api(url(sheetId, `/rows/${encodeURIComponent(rowId)}`), { method: "DELETE" }), { quiet: true })), Promise.resolve(null));
      },
    }).then(detail => {
      if (detail && focus) {
        const first = detail.rows.findIndex(row => row.id === detail.added?.[0]);
        if (first >= 0) select(first, 0);
      } else if (detail && !quiet) paintSelection();
      return detail;
    });
  }

  function addColumn(index) {
    if (!canCreate()) return Promise.resolve(null);
    const atEnd = index >= cols().length;
    return structural("kolon ekleme", sheetId => HOF.api(url(sheetId, "/columns"), { method: "POST", body: atEnd ? { count: 1 } : { index, count: 1 } }), {
      undoFallback: detail => queue(sheetId => HOF.api(url(sheetId, `/columns/${encodeURIComponent(detail.added[0])}`), { method: "DELETE" }), { quiet: true }),
    }).then(detail => {
      if (!detail) return null;
      const c = detail.columns.findIndex(column => column.id === detail.added?.[0]);
      if (c >= 0) {
        // Yeni kolonun başlığı hemen yazılabilir.
        select(-1, c);
        startEdit("enter", { value: "" });
      }
      return detail;
    });
  }

  function deleteColumn(c) {
    const column = cols()[c];
    if (!column) return;
    if (cols().length === 1) return HOF.toast("Sayfada en az bir kolon kalmalı.", { type: "error" });
    return structural("kolon silme", sheetId => HOF.api(url(sheetId, `/columns/${encodeURIComponent(column.id)}`), { method: "DELETE" }), {
      toast: () => `“${column.header}” kolonu silindi.`,
    });
  }

  function deleteRow(r) {
    const row = rows()[r];
    if (!row) return;
    const empty = rowEmpty(r);
    return structural("satır silme", sheetId => HOF.api(url(sheetId, `/rows/${encodeURIComponent(row.id)}`), { method: "DELETE" }), {
      toast: empty ? undefined : () => `${row.number}. satır silindi.`,
    }).then(detail => {
      if (detail) {
        if (state.active.r >= detail.rows.length) state.active.r = detail.rows.length - 1;
        paintSelection();
        syncCard();
      }
      return detail;
    });
  }

  function totals(kind) {
    // Yan toplam: birden çok kolon seçiliyse yalnızca onlar toplanır.
    const { c1, c2 } = range();
    const body = kind === "column" && state.anchor && c2 > c1 ? { kind, from: c1, to: c2 } : { kind };
    const list = names => (names.length > 4 ? `${names.slice(0, 4).join(", ")} …` : names.join(", "));
    return structural(kind === "row" ? "alt toplam" : "yan toplam", sheetId => HOF.api(url(sheetId, "/totals"), { method: "POST", body }), {
      toast: detail => (kind === "row" ? `Toplam satırı eklendi: ${list(detail.summed || [])}.` : `“Toplam” kolonu eklendi: ${(detail.summed || []).join(" + ")}. Başka kolonları toplamak için önce onları seçin.`),
    });
  }

  function fill(axis) {
    const { r, c } = state.active;
    if (r < 0 || !isFormula(rawAt(r, c))) return HOF.toast(`Önce formül içeren bir hücre seçin (ör. =B1*C1). Formül ${axis === "right" ? "sağdaki kolonlara" : "alttaki satırlara"} uygulanır.`, { type: "error", timeout: 5200 });
    const row = rows()[r];
    const column = cols()[c];
    return structural(axis === "right" ? "sağa doldurma" : "aşağı doldurma", sheetId => HOF.api(url(sheetId, "/fill"), { method: "POST", body: { row: row.id, col: column.id, axis } }), {
      toast: detail => `Formül ${detail.filled} hücreye uygulandı.`,
    });
  }

  // ---------- Sayfa işlemleri ----------
  function sheetMenu() {
    const items = [];
    if (canCreate()) items.push({ label: "Sayfanın Adını Değiştir", run: renameSheet });
    if (HOF.can("records.export")) items.push({ label: "Bu Sayfayı Excel Olarak İndir", run: () => (HOF.exportExcel ? HOF.exportExcel({ tab: state.sheet?.name }) : HOF.toast("Dışa aktar menüsünü kullanın.")) });
    items.push({ label: "Formüller ve Kısayollar", run: openHelp });
    if (canDelete()) items.push({ label: "Sayfayı Sil", danger: true, run: removeSheet });
    return items;
  }

  function renameSheet() {
    if (!state.sheet || !canCreate()) return;
    const sheet = state.sheet;
    HOF.formModal({
      title: "Sayfanın Adını Değiştir",
      eyebrow: "SERBEST SAYFA",
      fields: [{ name: "name", label: "Sayfa Adı", value: sheet.name, required: true, autofocus: true, maxlength: 60 }],
      submitLabel: "Kaydet",
      onSubmit: async data => {
        const detail = await HOF.api(url(sheet.id), { method: "PATCH", body: { name: data.name } });
        HOF.toast(`Sayfanın adı “${detail.name}” oldu.`, { type: "success" });
        if (detail.name !== sheet.name) openTab(detail.name);
      },
    });
  }

  async function removeSheet() {
    if (!state.sheet || !canDelete()) return;
    const sheet = state.sheet;
    const ok = await HOF.confirm({ title: "Sayfayı Sil", message: `“${sheet.name}” sayfası tüm bilgisayarlarda kaldırılacak. Sayfadaki kayıtların notları ve işlemleri silinmez; sayfayı hemen geri alabilirsiniz.`, confirmLabel: "Sayfayı Sil", danger: true });
    if (!ok) return;
    try {
      await HOF.api(url(sheet.id), { method: "DELETE" });
      undoStacks.delete(sheet.id);
      HOF.refreshData();
      HOF.toast(`“${sheet.name}” sayfası silindi.`, {
        type: "success",
        action: {
          label: "Geri Al",
          onClick: async () => {
            try {
              const restored = await HOF.api(url(sheet.id, "/restore"), { method: "POST" });
              HOF.toast(`“${restored.name}” sayfası geri alındı.`, { type: "success" });
              openTab(restored.name);
            } catch (error) {
              HOF.toastError(error);
            }
          },
        },
      });
    } catch (error) {
      HOF.toastError(error);
    }
  }

  function openHelp() {
    const rowsHtml = FUNCTIONS.map(([name, args, text, example]) => `<tr><td><code>${esc(name)}(${esc(args)})</code></td><td>${esc(text)}</td><td><code>${esc(example)}</code></td></tr>`).join("");
    HOF.modal({
      title: "Formüller ve Kısayollar",
      eyebrow: "SERBEST SAYFA",
      size: "wide",
      body: `<div class="hof-free-help">
        <p class="hof-modal-text">Formül <b>=</b> ile başlar. Hücre adresi <b>kolon harfi + satır numarası</b>dır: <code>B1</code> ilk satırın B kolonu (başlık satırı numaralanmaz). Aralık <code>B1:B9</code>, kolonun tamamı <code>B:B</code>. Formül yazarken bir hücreye tıklamak adresini ekler; sürüklemek aralık ekler.</p>
        <ul class="hof-free-help-list">
          <li><b>Türkçe ya da İngilizce</b>: <code>=TOPLA(B1:B9)</code> ve <code>=SUM(B1:B9)</code> aynıdır. Türkçe yazımda ayraç <code>;</code>, ondalık <code>,</code>: <code>=EĞER(B2&gt;1,5;"Yüksek";"Düşük")</code>.</li>
          <li><b>İşlemler</b>: <code>+ - * / ^</code>, karşılaştırma <code>= &lt;&gt; &lt; &gt; &lt;= &gt;=</code>, metin birleştirme <code>&amp;</code>, yüzde <code>%</code>.</li>
          <li><b>Sabit Adres</b>: <code>$B$1</code> doldururken ya da kopyalarken kaymaz.</li>
          <li><b>Σ Alt toplam</b> sayısal kolonların altına toplam satırı, <b>Σ Yan toplam</b> her satırın toplamını gösteren kolon ekler. <b>↓ Doldur</b> seçili hücredeki formülü alttaki satırlara, <b>→ Doldur</b> sağdaki kolonlara uygular.</li>
          <li>Satır ya da kolon eklenip silinince formüllerdeki adresler Excel'deki gibi kendiliğinden kayar; silinen hücreye başvuru <code>#BAŞV!</code> olur.</li>
          <li>Hata kodları: <code>#SAYI/0!</code> sıfıra bölme, <code>#DEĞER!</code> sayı beklenen yerde metin, <code>#AD?</code> tanınmayan işlev, <code>#DÖNGÜ!</code> formül kendine başvuruyor.</li>
        </ul>
        <h3>Kısayollar</h3>
        <ul class="hof-free-help-list hof-free-keys">
          <li><kbd>Yazmaya başlamak</kbd> hücreyi yeni değerle doldurur</li>
          <li><kbd>Enter</kbd> / <kbd>Tab</kbd> / yön tuşları: kaydeder ve geçer (<kbd>Shift</kbd> ile geri)</li>
          <li><kbd>F2</kbd> ya da çift tık: hücredeki değeri düzelt · <kbd>Esc</kbd>: vazgeç</li>
          <li><kbd>Delete</kbd>: seçili hücreleri temizle · <kbd>Shift</kbd>+yön ya da sürükleme: aralık seç</li>
          <li><kbd>Ctrl+C</kbd> / <kbd>Ctrl+X</kbd> / <kbd>Ctrl+V</kbd>: kopyala, kes, yapıştır (Excel'den de) · <kbd>Ctrl+Z</kbd>: geri al</li>
          <li>Satır numarasına ya da kolon harfine sağ tıklayın: ekle, sil, doldur</li>
        </ul>
        <h3>Sık Kullanılan İşlevler</h3>
        <div class="hof-free-help-table"><table><thead><tr><th>İşlev</th><th>Ne Yapar</th><th>Örnek</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>
      </div>`,
    });
  }

  // ---------- Bağlam menüsü ----------
  function openMenu(anchor, items, at) {
    closeMenu();
    if (!items.length) return;
    const menu = HOF.el("div", { class: "hof-free-menu", role: "menu" }, items.map((item, index) => (item.sep ? '<hr role="separator">' : `<button type="button" role="menuitem" data-index="${index}" class="${item.danger ? "is-danger" : ""}" ${item.disabled ? "disabled" : ""}>${esc(item.label)}${item.hint ? `<small>${esc(item.hint)}</small>` : ""}</button>`)).join(""));
    document.body.appendChild(menu);
    const box = anchor ? anchor.getBoundingClientRect() : { left: at.x, right: at.x, top: at.y, bottom: at.y };
    const width = menu.offsetWidth;
    const height = menu.offsetHeight;
    const left = clampValue(anchor ? box.right - width : box.left, 8, window.innerWidth - width - 8);
    const top = box.bottom + 6 + height > window.innerHeight ? Math.max(8, box.top - height - 6) : box.bottom + 6;
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.addEventListener("click", event => {
      const button = event.target.closest("button[data-index]");
      if (!button) return;
      const item = items[Number(button.dataset.index)];
      closeMenu();
      item?.run();
    });
    const close = event => {
      if (event.type === "keydown" && event.key !== "Escape") return;
      if (event.type === "pointerdown" && menu.contains(event.target)) return;
      closeMenu();
    };
    menu.hofClose = close;
    setTimeout(() => {
      document.addEventListener("pointerdown", close, true);
      document.addEventListener("keydown", close, true);
      window.addEventListener("scroll", closeMenu, { once: true, capture: true });
    }, 0);
    dom && (dom.menu = menu);
    menu.querySelector("button:not([disabled])")?.focus({ preventScroll: true });
  }
  function closeMenu() {
    const menu = dom?.menu || document.querySelector(".hof-free-menu");
    if (!menu) return;
    if (menu.hofClose) {
      document.removeEventListener("pointerdown", menu.hofClose, true);
      document.removeEventListener("keydown", menu.hofClose, true);
    }
    menu.remove();
    if (dom) dom.menu = null;
    if (state.id && !state.editing && lastPointer !== "touch" && !HOF.hasOpenModal()) setTimeout(focusGrid, 0);
  }

  function onContextMenu(event) {
    if (!dom || !state.sheet) return;
    const hit = cellFromEvent(event);
    if (!hit) return;
    event.preventDefault();
    if (state.editing) commit(null);
    const { r1, r2, c1, c2 } = range();
    if (hit.kind === "cell") {
      const inside = hit.r >= r1 && hit.r <= r2 && hit.c >= c1 && hit.c <= c2;
      if (!inside) select(hit.r, hit.c);
    } else if (hit.kind === "row") {
      state.anchor = { r: hit.r, c: 0 };
      state.active = { r: hit.r, c: cols().length - 1 };
      paintSelection();
    } else if (hit.kind === "column") {
      if (rows().length) {
        state.anchor = { r: 0, c: hit.c };
        state.active = { r: rows().length - 1, c: hit.c };
      } else state.active = { r: -1, c: hit.c };
      paintSelection();
    }
    const r = hit.kind === "column" ? Math.max(0, state.active.r) : hit.r ?? state.active.r;
    const c = hit.kind === "row" ? state.active.c : hit.c ?? state.active.c;
    const items = [];
    const create = canCreate();
    const edit = canEdit();
    const formula = r >= 0 && isFormula(rawAt(r, c));
    if (hit.kind !== "column" && r >= 0) {
      if (create) items.push({ label: "Üste Satır Ekle", run: () => addRows(r, 1) }, { label: "Alta Satır Ekle", run: () => addRows(r + 1, 1) });
      if (canDelete() || (create && rowEmpty(r))) items.push({ label: `${r + 1}. satırı sil`, danger: true, run: () => deleteRow(r) });
      if (items.length) items.push({ sep: true });
    }
    if (hit.kind !== "row") {
      if (create) items.push({ label: "Sola Kolon Ekle", run: () => addColumn(c) }, { label: "Sağa Kolon Ekle", run: () => addColumn(c + 1) });
      if (edit) items.push({ label: "Başlığı Düzenle", run: () => (select(-1, c), startEdit("edit")) });
      if (canDelete() || (create && columnEmpty(c))) items.push({ label: `${colLetter(c)} kolonunu sil`, danger: true, run: () => deleteColumn(c) });
      if (items.length && items.at(-1).sep !== true) items.push({ sep: true });
    }
    if (edit && hit.kind === "cell" && hit.r >= 0) {
      items.push({ label: "Formülü Aşağı Doldur", disabled: !formula, hint: formula ? "" : "formül yok", run: () => fill("down") });
      items.push({ label: "Formülü Sağa Doldur", disabled: !formula, run: () => fill("right") });
      items.push({ label: "Temizle", hint: "Delete", run: clearSelection });
    }
    while (items.length && items.at(-1).sep) items.pop();
    openMenu(null, items, { x: event.clientX, y: event.clientY });
  }

  // ---------- Kopyala / yapıştır ----------
  const tsvCell = text => (/[\t\n\r"]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text);
  function onCopy(event) {
    if (!dom || state.editing || !state.sheet) return;
    const { r1, r2, c1, c2 } = range();
    if (r1 < 0) return;
    const raws = [];
    const lines = [];
    for (let r = r1; r <= r2; r += 1) {
      const rawLine = [];
      const shown = [];
      for (let c = c1; c <= c2; c += 1) {
        rawLine.push(rawAt(r, c));
        shown.push(tsvCell(cellText(r, c)));
      }
      raws.push(rawLine);
      lines.push(shown.join("\t"));
    }
    const text = lines.join("\r\n");
    clip = { text, raws, origin: { r: r1, c: c1 } };
    event.clipboardData.setData("text/plain", text);
    event.preventDefault();
    const count = (r2 - r1 + 1) * (c2 - c1 + 1);
    HOF.toast(count > 1 ? `${count} hücre kopyalandı.` : "Hücre kopyalandı.", { timeout: 1600 });
  }
  function onCut(event) {
    if (!dom || state.editing) return;
    onCopy(event);
    if (event.defaultPrevented) clearSelection();
  }
  function parseTsv(text) {
    const out = [];
    let row = [];
    let cell = "";
    let quoted = false;
    const source = String(text).replace(/\r\n?/g, "\n").replace(/\n$/, "");
    for (let index = 0; index < source.length; index += 1) {
      const char = source[index];
      if (quoted) {
        if (char === '"' && source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else if (char === '"') quoted = false;
        else cell += char;
      } else if (char === '"' && cell === "") quoted = true;
      else if (char === "\t") {
        row.push(cell);
        cell = "";
      } else if (char === "\n") {
        row.push(cell);
        out.push(row);
        row = [];
        cell = "";
      } else cell += char;
    }
    row.push(cell);
    out.push(row);
    return out;
  }
  function onPaste(event) {
    if (!dom || state.editing || !state.sheet) return;
    const text = event.clipboardData?.getData("text/plain") ?? "";
    event.preventDefault();
    if (!canEdit()) return HOF.toast("Düzenleme yetkiniz yok.", { type: "error" });
    if (!text) return;
    const { r1, c1 } = range();
    if (state.active.r < 0 && !state.anchor) {
      // Başlık satırına yapıştırma: satırdaki değerler başlık olur (ilk satır).
      const first = parseTsv(text)[0] || [];
      return pasteHeaders(first, state.active.c);
    }
    const internal = clip && clip.text === text;
    let grid = internal ? clip.raws : parseTsv(text);
    const top = Math.max(0, r1);
    const { r2, c2 } = range();
    // Tek değer birden çok hücreye yapıştırılınca seçimin tamamı doldurulur (Excel gibi).
    if (grid.length === 1 && grid[0].length === 1 && (r2 > top || c2 > c1)) grid = Array.from({ length: r2 - top + 1 }, () => Array.from({ length: c2 - c1 + 1 }, () => grid[0][0]));
    const origin = internal ? clip.origin : { r: top, c: c1 };
    const needRows = top + grid.length - rows().length;
    const needCols = c1 + Math.max(...grid.map(line => line.length)) - cols().length;
    if ((needRows > 0 || needCols > 0) && !canCreate()) return HOF.toast("Yapıştırılan tablo sayfaya sığmıyor ve satır/kolon ekleme yetkiniz yok.", { type: "error" });
    if (grid.length * Math.max(...grid.map(line => line.length)) > 20000) return HOF.toast("Tek seferde en fazla 20.000 hücre yapıştırılabilir.", { type: "error" });
    const cells = [];
    grid.forEach((line, dr) =>
      line.forEach((raw, dc) => {
        const cell = { r: top + dr, c: c1 + dc, raw };
        // Programın içinden kopyalanan formül yeni yerine göre kayar; dışarıdan gelen formül olduğu gibi yazılır (tek değerin
        // bir aralığa yayılması dışında: o zaman her hücreye kendi satır/kolonuna göre kayarak).
        const spread = grid.length > 1 || grid[0].length > 1 ? !internal : false;
        if (isFormula(raw) && !spread) {
          const shift = internal ? [top + dr - (origin.r + (clip.raws.length > 1 ? dr : 0)), c1 + dc - (origin.c + (clip.raws[0].length > 1 ? dc : 0))] : [dr, dc];
          if (shift[0] || shift[1]) cell.shift = shift;
        }
        cells.push(cell);
      }),
    );
    const grow = needRows > 0 || needCols > 0;
    const before = grow ? null : cells.map(cell => ({ rowId: rows()[cell.r].id, colId: cols()[cell.c].id, raw: rawAt(cell.r, cell.c) }));
    const label = `${cells.length} hücre yapıştırma`;
    return structural(label, sheetId => HOF.api(url(sheetId, "/cells"), { method: "PUT", body: { cells, grow } }), {
      undoFallback: before ? () => saveCells(before.map(item => ({ ...item, before: "" })), label, { record: false }) : undefined,
    }).then(detail => {
      if (detail) {
        state.anchor = { r: top, c: c1 };
        state.active = { r: Math.min(detail.rows.length - 1, top + grid.length - 1), c: Math.min(detail.columns.length - 1, c1 + Math.max(...grid.map(line => line.length)) - 1) };
        paintSelection();
      }
      return detail;
    });
  }
  function pasteHeaders(names, start) {
    const tasks = names.slice(0, cols().length - start).map((name, index) => {
      const column = cols()[start + index];
      return () => renameColumn(column.id, name.trim(), column.name || "");
    });
    return tasks.reduce((chain, task) => chain.then(task), Promise.resolve());
  }

  // ---------- Formül yardımı: öneri listesi ve başvuru vurgusu ----------
  function updateSuggest() {
    if (!dom || !state.editing || state.editing.r < 0) return closeSuggest();
    const field = state.editing.target;
    const text = field.value;
    if (!text.startsWith("=")) return closeSuggest();
    const caret = field.selectionStart ?? text.length;
    const before = text.slice(0, caret);
    const quotes = (before.match(/"/g) || []).length;
    if (quotes % 2) return closeSuggest();
    const match = before.match(/(?:^=|[(;,+\-*/^&<>=\s])([A-Za-zÇĞİÖŞÜçğıöşü_.]{1,20})$/);
    if (!match) return closeSuggest();
    const word = foldText(match[1]);
    const items = FUNCTIONS.filter(([name]) => foldText(name).startsWith(word)).slice(0, 7);
    if (!items.length || (items.length === 1 && foldText(items[0][0]) === word && text[caret] === "(")) return closeSuggest();
    suggestState = { items, index: 0, word: match[1], start: caret - match[1].length, end: caret, touched: false };
    dom.suggest.innerHTML = items.map(([name, args, info], index) => `<div class="hof-free-suggestion${index === 0 ? " is-on" : ""}" role="option" data-fn="${esc(name)}"><b>${esc(name)}</b><span>(${esc(args)})</span><small>${esc(info)}</small></div>`).join("");
    dom.suggest.hidden = false;
    const anchor = field === dom.bar ? dom.bar : dom.input;
    const wrap = dom.wrap.getBoundingClientRect();
    const box = anchor.getBoundingClientRect();
    if (field === dom.bar) {
      dom.suggest.style.left = `${Math.max(0, box.left - wrap.left + dom.wrap.scrollLeft)}px`;
      dom.suggest.style.top = `${dom.wrap.scrollTop + 4}px`;
    } else {
      dom.suggest.style.left = `${box.left - wrap.left + dom.wrap.scrollLeft}px`;
      dom.suggest.style.top = `${box.bottom - wrap.top + dom.wrap.scrollTop + 2}px`;
    }
  }
  function moveSuggest(step) {
    if (!suggestState) return;
    suggestState.index = (suggestState.index + step + suggestState.items.length) % suggestState.items.length;
    suggestState.touched = true;
    [...dom.suggest.children].forEach((node, index) => node.classList.toggle("is-on", index === suggestState.index));
  }
  function acceptSuggest(name) {
    if (!suggestState || !state.editing) return;
    const field = state.editing.target;
    const text = field.value;
    const after = text.slice(suggestState.end);
    const insert = after.startsWith("(") ? name : `${name}(`;
    field.value = text.slice(0, suggestState.start) + insert + after;
    const caret = suggestState.start + insert.length + (after.startsWith("(") ? 1 : 0);
    field.setSelectionRange(caret, caret);
    if (field === dom.input) dom.bar.value = field.value;
    closeSuggest();
    field.focus({ preventScroll: true });
  }
  function closeSuggest() {
    suggestState = null;
    if (dom?.suggest && !dom.suggest.hidden) {
      dom.suggest.hidden = true;
      dom.suggest.innerHTML = "";
    }
  }

  const COLORS = 6;
  let refCells = [];
  function highlightRefs() {
    for (const node of refCells) {
      node.classList.remove("is-ref");
      delete node.dataset.ref;
    }
    refCells = [];
    if (!dom || !state.editing || state.editing.r < 0) return;
    const text = state.editing.target.value;
    if (!text.startsWith("=")) return;
    const outside = text.replace(/"[^"]*"?/g, match => " ".repeat(match.length));
    const pattern = /(?<![A-Za-z0-9_.$])\$?([A-Za-z]{1,3})\$?(\d{1,6})(?::\$?([A-Za-z]{1,3})\$?(\d{1,6}))?(?![A-Za-z0-9_(])/g;
    const letters = cols().map(column => column.letter);
    let match;
    let color = 0;
    while ((match = pattern.exec(outside))) {
      const c1 = letters.indexOf(match[1].toUpperCase());
      const c2 = match[3] ? letters.indexOf(match[3].toUpperCase()) : c1;
      const r1 = Number(match[2]) - 1;
      const r2 = match[4] ? Number(match[4]) - 1 : r1;
      if (c1 < 0 || c2 < 0) continue;
      const tone = String((color % COLORS) + 1);
      color += 1;
      for (let r = Math.min(r1, r2); r <= Math.min(Math.max(r1, r2), rows().length - 1, Math.min(r1, r2) + 400); r += 1)
        for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c += 1) {
          const td = tdAt(r, c);
          if (!td) continue;
          td.classList.add("is-ref");
          td.dataset.ref = tone;
          refCells.push(td);
        }
    }
  }

  // ---------- Bağlantılar ----------
  function sync() {
    updateAlwaysTabs();
    ensureAddButton();
    markFreeTabs();
    const id = activeFreeId();
    if (id !== state.id) switchTo(id);
    if (!state.id) return;
    if (!dom || !dom.root.isConnected) {
      if (!dom) build();
      place();
      if (!state.sheet) load();
    } else place();
    if (wantedKey) selectRecord(wantedKey);
    markCardRow();
  }

  // Son tıklama ızgaradaysa ve odak sayfada kaybolduysa (ör. tıklanan düğme yeniden çizildi), tuşlar ızgaraya gider.
  let pointerInside = false;
  document.addEventListener("pointerdown", event => (pointerInside = Boolean(dom && dom.root.contains(event.target))), true);
  document.addEventListener("keydown", event => {
    if (!dom || !state.sheet || !pointerInside || state.editing || HOF.hasOpenModal() || dom.menu) return;
    const focus = document.activeElement;
    if (focus && focus !== document.body && !(dom.root.contains(focus) && focus.tagName === "BUTTON")) return;
    const printable = event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
    focusGrid();
    if (printable) {
      event.preventDefault();
      dom.input.value = event.key;
      if (!startEdit("enter", { keep: true })) dom.input.value = "";
    } else onKeyDown(event);
  });

  HOF.whenReady(() => {
    HOF.onDom(sync);
    HOF.on("rows", () => {
      sync();
      // Detay kartından ya da "Yeni kayıt" formundan yapılan değişiklik sayfaya da yansısın.
      if (state.id && !state.busy && Date.now() - state.lastApply > 1500) reloadSoon(120);
    });
    HOF.on("live:workspace.changed", change => {
      if (change && state.id && change.free === state.id) reloadSoon(200);
    });
    window.addEventListener("resize", () => position());
  });

  HOF.free = {
    isActive: () => Boolean(state.id),
    activeId: () => state.id,
    open: openCreate,
    reload: () => load(),
  };
})();
