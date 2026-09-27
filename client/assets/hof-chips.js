/* DestekOfis — durum/kategori renkleri ve satır sıklığı (v2.0.2).
 * Airtable, monday.com ve Notion'da "tek seçimli" alanlar renkli görünür; kullanıcı "Aktif / Pasif / Bekliyor"u okumadan
 * tanır. Burada analizin durum ya da kategori dediği kolonların hücreleri renkli bir noktayla işaretlenir:
 *   olumlu (ödendi, aktif, tamamlandı) yeşil · olumsuz (iptal, pasif, gecikmiş) kırmızı · bekleyen (bekliyor, kısmen) sarı ·
 *   diğer değerler (ilçe, sınıf, marka) kendi sabit rengini alır — aynı değer her yerde aynı renktir.
 * React'in yazdığı metin düğümlerine dokunulmaz (sarmalanmaz, silinmez); yalnızca hücreye data-tone yazılır, rengi CSS
 * verir. Böylece React sonraki güncellemede hücreyi güvenle yeniler.
 * Satır sıklığı: Excel/Sheets/Airtable'daki gibi "Rahat / Sık" görünüm; tercih bu tarayıcıda hatırlanır. */
(() => {
  const HOF = window.HOF;
  if (!HOF) return;
  const GOOD = /\b(aktif|odendi|odenmis|odenmistir|tamamlandi|tamamlanmis|kapandi|kapatildi|onaylandi|onayli|geldi|evet|teslim edildi|yenilendi|tahsil edildi|sonuclandi|satildi|kabul|olumlu|basarili|bitti|tamam|gerceklestirildi|infaz|acildi)\b/;
  const BAD = /\b(pasif|iptal\w*|gecikmis|gecikti|gecikme|ayrildi|reddedildi|red|hayir|odenmedi|odenmemis|basarisiz|olumsuz|borclu|bloke|engelli|kayip|feragat|dusuruldu|vazgecti|hatali|ret)\b/;
  const WARN = /\b(bekliyor|beklemede|bekleyen|devam\w*|kismen|kismi|eksik|inceleme\w*|askida|ertelendi|acik|planlandi|yeni|surecte|islemde|taslak|onay bekliyor|hazirlaniyor|yolda|kargoda)\b/;
  const COLORED_ROLES = new Set(["status", "category"]);
  const HUES = 8;
  const fold = value => HOF.fold ? HOF.fold(value) : String(value || "").toLocaleLowerCase("tr-TR").replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ç/g, "c").replace(/ö/g, "o").replace(/ü/g, "u").replace(/[^a-z0-9]+/g, " ").trim();
  const toneOf = value => {
    const text = fold(value);
    if (!text || text === "—" || text === "-") return "";
    if (GOOD.test(text)) return "good";
    if (BAD.test(text)) return "bad";
    if (WARN.test(text)) return "warn";
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
    return `h${hash % HUES}`;
  };

  // Analizin verdiği roller: kolon adı → rol. Analiz henüz gelmediyse boş; gelince yeniden çizilir.
  let roles = new Map();
  const readRoles = analysis => {
    roles = new Map();
    for (const item of analysis?.columns || []) if (COLORED_ROLES.has(item.role)) roles.set(item.column, item.role);
  };
  HOF.on("insight", analysis => {
    readRoles(analysis);
    paint();
  });

  function paint() {
    const analysis = HOF.insight?.();
    if (analysis && !roles.size) readRoles(analysis);
    const table = document.querySelector(".cases-panel .dynamic-table") || document.querySelector(".dynamic-table");
    if (table && !document.body.classList.contains("hof-free-mode")) {
      const heads = [...table.querySelectorAll("thead th")];
      const colored = heads.map(th => (roles.size ? roles.has(HOF.columnOf(th)) : false));
      for (const row of table.querySelectorAll("tbody tr")) {
        const cells = row.children;
        for (let index = 0; index < cells.length; index += 1) {
          const cell = cells[index];
          const tone = colored[index] ? toneOf(cell.textContent) : "";
          if (tone) {
            if (cell.dataset.tone !== tone) cell.dataset.tone = tone;
          } else if (cell.dataset.tone) delete cell.dataset.tone;
        }
      }
    }
    const selected = HOF.selectedCase?.();
    if (selected?.panel) {
      for (const cell of selected.panel.querySelectorAll(".dynamic-detail-grid > div")) {
        const value = cell.querySelector(".detail-value");
        if (!value) continue;
        const column = HOF.columnOf(cell.querySelector(".detail-label"));
        const tone = roles.has(column) ? toneOf(value.textContent) : "";
        if (tone) {
          if (value.dataset.tone !== tone) value.dataset.tone = tone;
        } else if (value.dataset.tone) delete value.dataset.tone;
      }
    }
    densityButton();
  }

  // ---------- Satır sıklığı ----------
  const KEY = "hof.density";
  const read = () => {
    try {
      return localStorage.getItem(KEY) === "dense";
    } catch {
      return false;
    }
  };
  const apply = dense => {
    document.body.classList.toggle("hof-dense", dense);
    try {
      localStorage.setItem(KEY, dense ? "dense" : "comfortable");
    } catch {
      // gizli pencere: tercih bu oturumla sınırlı kalır
    }
    HOF.grid?.update?.();
  };
  function densityButton() {
    const heading = document.querySelector(".cases-panel > .panel-heading");
    if (!heading || document.body.classList.contains("hof-free-mode")) return;
    let button = heading.querySelector(":scope > .hof-density");
    if (!button) {
      button = HOF.el("button", { type: "button", class: "hof-density", "data-hof-ui": "" });
      button.addEventListener("click", () => {
        apply(!document.body.classList.contains("hof-dense"));
        densityButton();
      });
      heading.appendChild(button);
    }
    const dense = document.body.classList.contains("hof-dense");
    const label = dense ? "Rahat görünüm" : "Sık görünüm";
    if (button.getAttribute("aria-label") !== label) {
      button.setAttribute("aria-label", label);
      button.title = `${label} (satır yüksekliği)`;
      button.setAttribute("aria-pressed", String(dense));
      button.innerHTML = dense
        ? '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M2 3.5h12M2 8h12M2 12.5h12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
        : '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M2 2.5h12M2 5.5h12M2 8h12M2 10.5h12M2 13.5h12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
    }
  }
  if (read()) document.body.classList.add("hof-dense");

  HOF.onDom(paint);
  HOF.chips = { tone: toneOf, paint };
})();
