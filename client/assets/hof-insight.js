/* DestekOfis — akıllı veri motoru arayüzü (v1.6.0).
 * - Ofis profili: sektörün kelime dağarcığı (kayıt/uzman adları, alt başlık), rol adları, modüller.
 * - Etiket katmanı: yöneticinin kalemle kalıcı olarak değiştirdiği başlıklar (elle verilen > sektör > varsayılan).
 * - Akıllı özet kartları: yalnızca doğrulanmış kolonlardan, kolonun kendi adıyla (tıklanınca kayıt listesi).
 * - Veri sağlığı raporu, içeri almadan sonra adım adım analiz ekranı, aranabilir ve kaydırılabilir sektör seçici.
 * Sektör önerisi hiçbir zaman kendiliğinden uygulanmaz: yönetici onaylar, başka sektör seçer ya da Genel ile devam eder. */
(() => {
  "use strict";
  const HOF = window.HOF;
  const { esc } = HOF;
  const number = value => new Intl.NumberFormat("tr-TR").format(Number(value) || 0);
  const canManage = () => HOF.can("profile.manage");

  let profile = null;
  let insight = null;
  let catalog = null;
  let insightRequest = null;

  // ---------- Metin yardımcıları ----------
  const fold = value => String(value ?? "").replace(/İ/g, "i").replace(/I/g, "ı").toLocaleLowerCase("tr-TR").replace(/[çğıöşüâîû]/g, char => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" })[char]).replace(/[^a-z0-9]+/g, " ").trim();
  // Kolon adını okunur hâle getirir: "ÖDEME SÖZÜ" → "Ödeme sözü", "TANI (ICD)" → "Tanı (ICD)". Bilinen kısaltmalar,
  // noktalı kısaltmalar (T.C.) ve rakamlı kelimeler olduğu gibi kalır; zaten küçük harf içeren başlıklara dokunulmaz.
  const ACRONYMS = new Set("KDV TC TCKN SGK VKN IBAN ICD SKU KM PNR NPS CTR OEM ISBN IMEI GSM TL TRY USD EUR GBP GTİP GTIP SMS URL ID PT BES DASK İSG ISG OSGB ÇED DÖF CV VKİ BMI SPH CYL AKS HGS OGS LGS YKS TYT AYT KPSS CNC FOB CIF EXW KWP KWH LPG POS SSL SKT TETT HACCP MTSK OGG AKTS GNO NACE".split(" "));
  const nice = column => {
    const text = String(column || "").replace(/\s+/g, " ").trim();
    if (!text) return "";
    if (/[a-zçğıöşü]/.test(text)) return text;
    const words = text.split(" ").map(word => {
      const bare = word.replace(/[^\p{L}\p{N}.]/gu, "");
      if (ACRONYMS.has(bare) || /\p{L}\.\p{L}/u.test(bare) || /\d/.test(bare) || bare.length <= 1) return word;
      return word.toLocaleLowerCase("tr-TR");
    });
    const joined = words.join(" ");
    const first = joined.search(/\p{L}/u);
    return first < 0 ? joined : joined.slice(0, first) + joined.charAt(first).toLocaleUpperCase("tr-TR") + joined.slice(first + 1);
  };
  const upperTr = value => String(value || "").toLocaleUpperCase("tr-TR");
  // Sayının okunuşuna göre iyelik eki: %92'si, %100'ü, %40'ı, %85'i.
  const POSSESSIVE_UNITS = ["ı", "i", "si", "ü", "ü", "i", "sı", "si", "i", "u"];
  const POSSESSIVE_TENS = [null, "u", "si", "u", "ı", "si", "ı", "i", "i", "ı"];
  const percentWord = value => {
    const digits = String(value).replace(/\D/g, "");
    const at = offset => Number(digits.at(offset) || 0);
    const suffix = !digits || /^0+$/.test(digits) ? "ı" : at(-1) ? POSSESSIVE_UNITS[at(-1)] : at(-2) ? POSSESSIVE_TENS[at(-2)] : at(-3) ? "ü" : "i";
    return `%${value}'${suffix}`;
  };
  const money = (value, currency = "TRY") => {
    const amount = Number(value) || 0;
    try {
      return new Intl.NumberFormat("tr-TR", { style: "currency", currency, maximumFractionDigits: Math.abs(amount) >= 1000 ? 0 : 2 }).format(amount);
    } catch {
      return `${number(amount)} ${currency}`;
    }
  };

  const ICONS = {
    records: '<path d="M4 7h16M4 12h16M4 17h10"/>',
    money: '<rect x="3" y="6" width="18" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.6"/><path d="M6.5 9.5v.01M17.5 14.5v.01"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    pulse: '<path d="M3 12h4l2.5-6 4 12 2.5-6H21"/>',
    status: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    people: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 5.2a3 3 0 0 1 0 5.8M17.5 20a5 5 0 0 0-2.6-4.4"/>',
    sparkle: '<path d="M12 3.5l1.9 4.6 4.6 1.9-4.6 1.9L12 16.5l-1.9-4.6L5.5 10l4.6-1.9z"/><path d="M18.5 15.5l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z"/>',
    check: '<path d="M5 12.5l4.2 4.2L19 7"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    pencil: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  };
  const icon = (name, size = 18) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;

  // ---------- Profil ----------
  const DEFAULT_VOCAB = { record: "kayıt", records: "kayıtlar", Record: "Kayıt", Records: "Kayıtlar", expert: "Uzman", subtitle: "Ofis yönetimi" };
  HOF.vocab = { ...DEFAULT_VOCAB };
  HOF.modules = { tahsilat: true, haciz: false };
  HOF.profile = () => profile;

  function applyProfile(next) {
    if (!next) return;
    profile = next;
    HOF.vocab = { ...DEFAULT_VOCAB, ...next.vocab };
    HOF.modules = { ...next.modules };
    if (next.roleLabels) Object.assign(HOF.roleLabels, next.roleLabels);
    const root = document.documentElement;
    root.classList.toggle("hof-no-haciz", !HOF.modules.haciz);
    root.classList.toggle("hof-no-tahsilat", !HOF.modules.tahsilat);
    root.dataset.hofSector = next.sector?.id || "genel";
    const office = HOF.user?.office?.name || "";
    document.title = office ? `${office} · DestekOfis` : `DestekOfis · ${next.tagline || HOF.vocab.subtitle}`;
    labelsTouched();
    HOF.emit("profile", next);
  }

  async function loadProfile() {
    try {
      applyProfile(await HOF.api("/api/workspace/profile"));
    } catch (error) {
      console.warn("[DestekOfis] Profil alınamadı", error.message);
    }
  }

  // ---------- Etiket katmanı ----------
  // Yuvalar: React'in çizdiği başlıklar ve bizim kartımızın başlığı. Metin düğümünün değeri değiştirilir; React aynı
  // öğeyi yeniden çizerse (ör. veri değişince) bir sonraki karede tekrar uygulanır.
  const sectorChosen = () => Boolean(profile?.sector?.id && profile.sector.id !== "genel");
  // v1.7.0: "Tümü" sekmesi yok. Birden çok sekmede sayfa başlığı verinin adı, tablo başlığı açık sekmenin adıdır; kalemle
  // verilen tablo başlığı yalnızca tek sekmeli (ya da sekmesiz) veride uygulanır.
  const singleScope = () => (HOF.tabLabels ? HOF.tabLabels().length <= 1 : true);
  // Her yuva önce kökünü (sayfanın başında, küçük bir bölge), sonra içindeki öğeyi arar: büyük tablolarda (20 bin satır)
  // tüm sayfayı her DOM değişikliğinde taramamak için.
  const SLOTS = [
    { key: "brand.subtitle", root: ".sidebar", selector: ".brand-subtitle", sector: () => HOF.vocab.subtitle },
    { key: "nav.workspace", root: ".sidebar", selector: "nav .nav-label", index: 0 },
    { key: "nav.source", root: ".sidebar", selector: "nav .nav-label", index: 1 },
    { key: "side.title", root: "#hof-sidecard", selector: ".hof-sidecard-label" },
    { key: "page.title", root: ".topbar", selector: ".page-title" },
    // Genel sektörde arayüzün kendi başlığı ("Tablo özeti") kalır.
    { key: "summary.title", root: ".welcome-row", selector: ".section-title", sector: () => (sectorChosen() ? `${HOF.vocab.Record} özeti` : null) },
    { key: "summary.subtitle", root: ".welcome-row", selector: ".section-description" },
    { key: "categories.title", root: ".category-bar", selector: ".category-heading > span" },
    { key: "table.title", root: ".cases-panel", selector: ".panel-title", when: singleScope },
    { key: "table.subtitle", root: ".cases-panel", selector: ".panel-meta" },
  ];
  // Kalemsiz, yalnızca sektör dilinde değişen yerler.
  const VOCAB_SLOTS = [{ root: ".sidebar", selector: "nav .nav-item", original: "Tüm kayıtlar", sector: () => (sectorChosen() ? `Tüm ${HOF.vocab.records}` : null) }];

  // Metin katmanı. Öğe → { originals: düğüm → React'in yazdığı değer, written: düğüm → bizim yazdığımız, applied }.
  // Başlık değiştirilince ilk dolu metin düğümüne başlık, diğerlerine boş yazılır. React kendi düğümlerinden birini
  // güncellerse (ör. kayıt sayısı) o düğümün asıl değeri yenilenir ve başlık yeniden uygulanır. Varsayılana dönünce her
  // düğüm kendi asıl değerine döner; React'in düğümleri ve sonraki güncellemeleri bozulmaz.
  const state = new WeakMap();
  const ownTexts = element => [...element.childNodes].filter(node => node.nodeType === 3);
  const textOf = nodes => nodes.map(node => node.nodeValue).join("");
  const clean = text => text.replace(/\s+/g, " ").trim();
  function textState(element) {
    let entry = state.get(element);
    if (!entry) state.set(element, (entry = { originals: new Map(), written: new Map(), applied: null }));
    const nodes = ownTexts(element);
    for (const node of [...entry.originals.keys()]) {
      if (nodes.includes(node)) continue;
      entry.originals.delete(node);
      entry.written.delete(node);
    }
    for (const node of nodes) {
      if (entry.written.has(node) && entry.written.get(node) === node.nodeValue) continue; // bizim yazdığımız, React dokunmadı
      entry.originals.set(node, node.nodeValue);
      entry.written.delete(node);
    }
    return { entry, nodes, original: clean(nodes.map(node => entry.originals.get(node)).join("")) };
  }
  HOF.labels = {
    // Yuvanın React'in yazdığı asıl metni (başka betikler metin eşleştirmesi için kullanır).
    original: element => (state.has(element) ? textState(element).original : element.textContent.trim()),
  };

  function writeText(element, desired) {
    const { entry, nodes, original } = textState(element);
    if (!nodes.length) return;
    const target = desired(original);
    if (target == null || target === original) {
      for (const node of nodes) {
        if (!entry.written.has(node)) continue;
        const value = entry.originals.get(node);
        if (node.nodeValue !== value) node.nodeValue = value;
        entry.written.delete(node);
      }
      entry.applied = null;
      return;
    }
    // Başlık ilk dolu düğüme, o düğümün baş/son boşluklarıyla yazılır (" Tüm kayıtlar " → " Tüm hastalar ");
    // yalnızca boşluktan oluşan düğümlere dokunulmaz, diğer dolu düğümler boşaltılır.
    const lead = nodes.find(node => entry.originals.get(node).trim()) || nodes[0];
    const leadOriginal = entry.originals.get(lead);
    const [pre, post] = leadOriginal.trim() ? [/^\s*/.exec(leadOriginal)[0], /\s*$/.exec(leadOriginal)[0]] : ["", ""];
    for (const node of nodes) {
      if (node !== lead && !entry.originals.get(node).trim()) continue;
      const value = node === lead ? `${pre}${target}${post}` : "";
      if (node.nodeValue !== value) node.nodeValue = value;
      entry.written.set(node, value);
    }
    entry.applied = target;
  }

  const slotElement = (slot, roots) => {
    if (!roots.has(slot.root)) roots.set(slot.root, document.querySelector(slot.root));
    const root = roots.get(slot.root);
    if (!root) return null;
    return slot.index != null ? root.querySelectorAll(slot.selector)[slot.index] || null : root.querySelector(slot.selector);
  };
  const labelFor = (slot, original) => {
    const manual = profile?.labels?.[slot.key];
    if (manual && (!slot.when || slot.when())) return manual;
    // Tablo başlığı kendi başlığı verilmemişse sayfa başlığını izler (ikisi de verinin adıdır).
    if (slot.key === "table.title" && profile?.labels?.["page.title"] && (!slot.when || slot.when())) return profile.labels["page.title"];
    const sector = slot.sector ? slot.sector() : null;
    return sector || original;
  };

  function applyLabels() {
    const roots = new Map();
    const manage = canManage();
    for (const slot of SLOTS) {
      const element = slotElement(slot, roots);
      if (!element) continue;
      writeText(element, original => labelFor(slot, original));
      if (!element.classList.contains("hof-label-slot")) element.classList.add("hof-label-slot");
      if (manage) ensurePencil(element, slot);
    }
    for (const slot of VOCAB_SLOTS) {
      if (!roots.has(slot.root)) roots.set(slot.root, document.querySelector(slot.root));
      for (const element of roots.get(slot.root)?.querySelectorAll(slot.selector) || []) {
        const original = state.has(element) ? textState(element).original : clean(textOf(ownTexts(element)));
        if (original !== slot.original) continue;
        writeText(element, () => slot.sector() || original);
      }
    }
  }
  let labelsQueued = false;
  function labelsTouched() {
    if (labelsQueued) return;
    labelsQueued = true;
    requestAnimationFrame(() => {
      labelsQueued = false;
      applyLabels();
    });
  }

  function ensurePencil(element, slot) {
    let pencil = element.querySelector(":scope > .hof-label-pencil");
    if (pencil && pencil === element.lastChild) return;
    if (!pencil) {
      pencil = HOF.el("button", { type: "button", class: "hof-label-pencil", "data-slot": slot.key, title: "Başlığı değiştir", "aria-label": `${profile?.slots?.[slot.key]?.name || "Başlığı"} değiştir` }, icon("pencil", 13));
      pencil.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        openLabelEditor(slot, element);
      });
    }
    element.appendChild(pencil);
  }

  function closeLabelEditor() {
    document.querySelector(".hof-label-editor")?.remove();
  }

  function openLabelEditor(slot, element) {
    closeLabelEditor();
    const meta = profile?.slots?.[slot.key] || { max: 80, name: "Başlık" };
    const original = HOF.labels.original(element);
    const fallback = (slot.sector ? slot.sector() : null) || original;
    const manual = profile?.labels?.[slot.key] || "";
    const editor = HOF.el(
      "div",
      { class: "hof-label-editor", role: "dialog", "aria-label": `${meta.name} değiştir` },
      `<label class="hof-label-editor-field"><span>${esc(meta.name)}</span>
        ${meta.max > 90 ? `<textarea rows="3" maxlength="${meta.max}">${esc(manual || fallback)}</textarea>` : `<input type="text" maxlength="${meta.max}" value="${esc(manual || fallback)}">`}</label>
       <small class="hof-label-editor-help">Tüm bilgisayarlarda kalıcı olarak değişir. Varsayılan: “${esc(fallback)}”</small>
       <div class="hof-label-editor-actions">
         ${manual ? '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-reset>Varsayılana dön</button>' : "<span></span>"}
         <span><button type="button" class="hof-button hof-button-small hof-button-ghost" data-cancel>İptal</button>
         <button type="button" class="hof-button hof-button-small" data-save>Kaydet</button></span>
       </div>`,
    );
    document.body.appendChild(editor);
    const rect = element.getBoundingClientRect();
    const width = Math.min(360, window.innerWidth - 24);
    editor.style.width = `${width}px`;
    editor.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`;
    const below = rect.bottom + 8;
    editor.style.top = `${below + 190 > window.innerHeight ? Math.max(12, rect.top - 190) : below}px`;
    const input = editor.querySelector("input, textarea");
    input.focus();
    input.select();
    const save = async value => {
      editor.querySelectorAll("button").forEach(button => (button.disabled = true));
      try {
        applyProfile(await HOF.api("/api/workspace/labels", { method: "PUT", body: { key: slot.key, value } }));
        closeLabelEditor();
        HOF.toast(value ? "Başlık kaydedildi; tüm bilgisayarlarda görünür." : "Başlık varsayılana döndü.", { type: "success" });
      } catch (error) {
        editor.querySelectorAll("button").forEach(button => (button.disabled = false));
        HOF.toastError(error);
      }
    };
    editor.addEventListener("click", event => {
      if (event.target.closest("[data-cancel]")) closeLabelEditor();
      else if (event.target.closest("[data-reset]")) save("");
      else if (event.target.closest("[data-save]")) {
        const value = input.value.replace(/\s+/g, " ").trim();
        save(value === fallback && !manual ? "" : value);
      }
    });
    editor.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        event.stopPropagation();
        closeLabelEditor();
        element.querySelector(".hof-label-pencil")?.focus();
      } else if (event.key === "Enter" && event.target === input && !(input.tagName === "TEXTAREA" && event.shiftKey)) {
        // Yalnızca yazı alanında: düğmelerde (İptal, Varsayılana dön) Enter o düğmeye basar.
        event.preventDefault();
        editor.querySelector("[data-save]").click();
      }
    });
    setTimeout(() => {
      const outside = event => {
        if (!editor.isConnected) return document.removeEventListener("mousedown", outside, true);
        if (!editor.contains(event.target)) {
          closeLabelEditor();
          document.removeEventListener("mousedown", outside, true);
        }
      };
      document.addEventListener("mousedown", outside, true);
    });
  }

  // ---------- Analiz verisi ----------
  async function loadInsight() {
    if (insightRequest) return insightRequest;
    insightRequest = HOF.api("/api/workspace/insight", { timeoutMs: 120_000 })
      .then(result => {
        insight = result.analysis;
        if (result.profile) applyProfile(result.profile);
        HOF.emit("insight", insight);
        renderKpis();
        return insight;
      })
      .catch(error => {
        console.warn("[DestekOfis] Analiz alınamadı", error.message);
        return null;
      })
      .finally(() => {
        insightRequest = null;
      });
    return insightRequest;
  }
  HOF.insight = () => insight;
  let refreshTimer = 0;
  const refreshInsightSoon = (delay = 1200) => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(loadInsight, delay);
  };

  // Arama kutusu ipucu: verideki gerçek kolon adlarından ("Dosya no, borçlu veya telefon ara…").
  // Cümle içinde: ilk harf de küçük (kısaltmalar hariç).
  const lowerNice = column => {
    const text = nice(column);
    if (/[a-zçğıöşü]/.test(String(column || ""))) return text;
    const first = text.split(" ")[0].replace(/[^\p{L}\p{N}.]/gu, "");
    return ACRONYMS.has(first) || /\p{L}\.\p{L}/u.test(first) ? text : text.charAt(0).toLocaleLowerCase("tr-TR") + text.slice(1);
  };
  HOF.searchPlaceholder = () => {
    const columns = insight?.search || [];
    if (!columns.length) return "Tabloda ara…";
    const words = columns.map((column, index) => (index === 0 ? nice(column) : lowerNice(column)));
    return words.length === 1 ? `${words[0]} ara…` : `${words.slice(0, -1).join(", ")} veya ${words[words.length - 1]} ara…`;
  };

  // ---------- Kayda git ----------
  // Kayıt başka bir sekmedeyse o sekme açılır; arama kutusu kaydı gizliyorsa temizlenir; satır seçilir ve kısa bir süre
  // vurgulanır (HOF.flashRow). Arama, kart listeleri, veri sağlığı raporu, sohbet ve ödeme sözleri bunu kullanır.
  const nativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  const frames = count => new Promise(resolve => {
    const step = left => (left ? requestAnimationFrame(() => step(left - 1)) : resolve());
    step(count);
  });
  const rowFor = key => [...document.querySelectorAll(".dynamic-table tbody tr")].find(row => row.dataset.hofKey === key);
  // Tablodaki kaydın kimliği: kimlikle eşleşmezse (ör. mesajda geçen dosya numarası) değerlerinde bu metni taşıyan ilk kayıt.
  const resolveKey = key => {
    const rows = HOF.data?.rows || [];
    if (!rows.length || rows.some(row => row.__hofKey === key)) return key;
    const text = String(key || "").trim();
    const match = text && rows.find(row => Object.entries(row).some(([name, value]) => !name.startsWith("__") && String(value ?? "").includes(text)));
    return match ? match.__hofKey : key;
  };
  async function waitFor(check, attempts = 15) {
    for (let index = 0; index < attempts; index += 1) {
      const value = check();
      if (value) return value;
      await frames(2);
    }
    return check();
  }
  HOF.revealRecord = async (target, { keepSearch = false } = {}) => {
    const key = resolveKey(target);
    let row = rowFor(key);
    if (!row) {
      const tab = HOF.tabOfKey ? HOF.tabOfKey(key) : null;
      if (tab && HOF.selectTab?.(tab)) row = await waitFor(() => rowFor(key));
    }
    if (!row && !keepSearch) {
      const search = document.querySelector(".search-field input");
      if (search && search.value) {
        nativeValue.call(search, "");
        search.dispatchEvent(new Event("input", { bubbles: true }));
        row = await waitFor(() => rowFor(key));
      }
    }
    if (!row) {
      HOF.toast("Kayıt tabloda bulunamadı; silinmiş ya da filtrelenmiş olabilir.", { type: "error" });
      return false;
    }
    HOF.table?.revealRow(row);
    if (!row.classList.contains("selected")) row.click();
    HOF.flashRow(rowFor(key) || row);
    return true;
  };

  // ---------- Akıllı özet kartları ----------
  // v1.7.0: kartlar açık sekmenin kapsamındandır ve sunucuda hücre hücre doğrulanmıştır; doğrulanamayan kart gelmez.
  // Her kartın penceresinde "Nasıl hesaplandı?" açıklaması, "Toplam" kartında sekmenin kart raporu (gösterilmeyen
  // kartların nedenleriyle) vardır.
  const LEVELS = { iyi: "İyi", orta: "Orta", zayif: "Zayıf" };
  const scopeKeys = () => insight?.kpis?.order || [];
  const multiScope = () => scopeKeys().length > 1;
  const scopeFor = key => insight?.kpis?.scopes?.[key] || null;
  const activeScope = () => {
    const keys = scopeKeys();
    const tab = HOF.activeTab ? HOF.activeTab() : "";
    return keys.includes(tab) ? tab : keys[0] ?? "";
  };
  const cardOf = (scope, id) => scope?.cards?.find(card => card.id === id) || null;
  const amount = (value, currency) => (currency ? money(value, currency) : new Intl.NumberFormat("tr-TR", { maximumFractionDigits: Math.abs(Number(value) || 0) >= 1000 ? 0 : 2 }).format(Number(value) || 0));
  const scopeName = key => (key ? `“${key}”` : "Tablo");

  function cardView(card) {
    const label = nice(card.column);
    if (card.id === "money") {
      const skipped = card.text + card.unclear + card.totals;
      return { id: "money", icon: "money", label: `${label} toplamı`, value: amount(card.sum, card.currency), help: `${number(card.count)} kayıtta tutar${skipped ? ` · ${number(skipped)} hücre toplanmadı` : ""}` };
    }
    if (card.id === "deadline") {
      // En yakın anlamlı pencere gösterilir: 7 gün, yoksa 30 gün; ikisi de boşsa yaklaşan yoktur.
      const span = card.next7 ? { label: "7 gün içinde", value: card.next7, help: `Bugün ${number(card.today)} · 30 gün içinde ${number(card.next30)}` } : card.next30 ? { label: "30 gün içinde", value: card.next30, help: "7 gün içinde yok" } : { label: "yaklaşan", value: 0, help: "30 gün içinde tarih yok" };
      return { id: "deadline", icon: "calendar", label: `${label} · ${span.label}`, value: number(span.value), help: `${span.help} · tarihi geçen ${number(card.passed)}${card.unclear ? ` · ${number(card.unclear)} belirsiz` : ""}`, tone: card.next7 ? "warn" : "" };
    }
    if (card.id === "event") return { id: "event", icon: "calendar", label: `${label} · bu ay`, value: number(card.thisMonth), help: `${number(card.dated)} kayıtta tarih${card.unclear ? ` · ${number(card.unclear)} belirsiz` : ""}` };
    if (card.id === "responsible") {
      const top = card.labels[0];
      return { id: "responsible", icon: "people", label, value: `${number(card.people)} kişi`, help: top ? `En çok: ${top.value} (${number(top.count)})` : "" };
    }
    const [first, ...rest] = card.labels;
    const extras = [...rest.slice(0, 3).map(item => `${item.value} ${number(item.count)}`), card.other ? `diğer ${number(card.other)}` : "", card.empty ? `boş ${number(card.empty)}` : ""].filter(Boolean);
    return { id: card.id, icon: "status", label, value: `${number(first.count)} ${first.value}`, help: extras.join(" · ") };
  }

  function kpiCards(scope, key) {
    const V = HOF.vocab;
    const cards = [{ id: "total", icon: "records", label: `Toplam ${V.record}`, value: number(scope.total), help: multiScope() ? `${scopeName(key)} sekmesi · ${number(scope.columnCount)} kolon` : `${number(scope.columnCount)} kolon` }];
    for (const card of scope.cards.slice(0, 2)) cards.push(cardView(card));
    const quality = scope.quality;
    const warnings = quality.issues.filter(issue => issue.severity === "warn").length;
    cards.push({ id: "quality", icon: "pulse", label: "Veri sağlığı", value: `${LEVELS[quality.level] || "—"} · %${quality.score}`, help: quality.issues.length ? `${warnings ? `${number(warnings)} uyarı · ` : ""}${number(quality.issues.length)} bulgu` : "Sorun bulunmadı", tone: quality.level === "iyi" ? "good" : quality.level === "zayif" ? "bad" : "warn" });
    return cards;
  }

  function renderKpis() {
    const welcome = document.querySelector(".main-shell .content-wrap > .welcome-row");
    let strip = document.getElementById("hof-summary");
    // Arama sonuçsuz kalınca tablo yerine "eşleşen kayıt yok" çizilir; kartlar yerinde kalmalı.
    const hasTable = Boolean(document.querySelector(".dynamic-table-wrap"));
    if (!welcome || !insight || !insight.rowCount || !hasTable || !insight.kpis?.scopes) {
      strip?.remove();
      return;
    }
    const key = activeScope();
    const scope = scopeFor(key);
    if (!scope) return;
    const cards = kpiCards(scope, key);
    const signature = JSON.stringify([insight.generatedAt, key, cards.map(card => [card.id, card.label, card.value, card.help, card.tone]), HOF.vocab.records]);
    if (!strip) {
      strip = HOF.el("section", { id: "hof-summary", class: "hof-summary", "aria-label": "Akıllı özet" });
      strip.addEventListener("click", event => {
        const card = event.target.closest("[data-kpi]");
        if (card) openKpi(card.dataset.kpi);
      });
    }
    if (welcome.nextElementSibling !== strip) welcome.after(strip);
    if (strip.dataset.signature === signature) return;
    strip.dataset.signature = signature;
    strip.style.setProperty("--hof-summary-count", String(cards.length));
    strip.innerHTML = cards
      .map(
        card => `<button type="button" class="hof-summary-card ${card.tone ? `is-${card.tone}` : ""}" data-kpi="${card.id}" title="${esc(card.id === "total" ? "Bu sekmenin kart raporu" : "Ayrıntılar ve nasıl hesaplandığı")}">
          <span class="hof-summary-icon" aria-hidden="true">${icon(card.icon)}</span>
          <span class="hof-summary-text"><span class="hof-summary-label">${esc(card.label)}</span><strong class="hof-summary-value" title="${esc(card.value)}">${esc(card.value)}</strong><small class="hof-summary-help">${esc(card.help)}</small></span>
        </button>`,
      )
      .join("");
  }

  // Kenar çubuğundaki "Bu ay": her sekmenin doğrulanmış tarih kolonundan (son tarih, yoksa olay tarihi); hiçbir sekmede
  // doğrulanmış tarih kolonu yoksa sayı gösterilmez (arayüzün kendi tahmini de gösterilmez).
  function applyMonthNav() {
    const item = [...(document.querySelector(".sidebar")?.querySelectorAll("nav .nav-item") || [])].find(element => textOf(ownTexts(element)).trim() === "Bu ay");
    if (!item) return;
    const month = insight?.kpis?.month;
    const count = item.querySelector(".nav-count");
    if (count && insight) {
      const text = month ? number(month.count) : "";
      if (count.textContent !== text) count.textContent = text;
      if (count.hidden !== !month) count.hidden = !month;
      const columns = [...new Set((month?.parts || []).map(part => nice(part.column)))];
      const title = month ? `${columns.join(", ")} bu ay olan kayıtlar` : "Tabloda ay bazında izlenebilecek doğrulanmış bir tarih kolonu yok";
      if (item.title !== title) item.title = title;
    }
    if (!item.dataset.hofMonth) {
      item.dataset.hofMonth = "1";
      item.addEventListener("click", () => openMonth());
    }
  }

  // Kenar çubuğundaki sayı tüm sekmelerden gelir; liste de tüm sekmelerden.
  async function openMonth() {
    const month = insight?.kpis?.month;
    if (!month) return HOF.toast("Tabloda ay bazında izlenebilecek doğrulanmış bir tarih kolonu yok.");
    const result = await fetchList({ list: "month", tab: "" });
    if (!result) return undefined;
    const label = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(new Date());
    const columns = [...new Set(month.parts.map(part => nice(part.column)))].join(", ");
    const modal = HOF.modal({ title: `Bu ay: ${label}`, eyebrow: "BU AY", body: `<p class="hof-modal-text">${number(result.total)} kayıt (${esc(columns)}). Kayda gitmek için tıklayın.</p>${recordList(result.items, item => item.date, { showTab: multiScope() })}${moreNote(result)}` });
    wireOpen(modal);
    return undefined;
  }

  // ---------- Kayıt listesi pencereleri ----------
  // Listeler sunucudan, kartla aynı kapsamda (sekme), aynı kolon ve kuralla ve tamamı sayılarak gelir.
  let listBusy = false;
  async function fetchList({ list, tab = "", limit = 500, card = "", value = "" }) {
    if (listBusy) return null;
    listBusy = true;
    try {
      const params = new URLSearchParams({ list, tab: tab || "", limit: String(limit) });
      if (card) params.set("card", card);
      if (value) params.set("value", value);
      return await HOF.api(`/api/workspace/insight/records?${params}`);
    } catch (error) {
      HOF.toastError(error);
      return null;
    } finally {
      listBusy = false;
    }
  }
  const moreNote = result => (result.total > result.items.length ? `<p class="hof-inline-note">İlk ${number(result.items.length)} kayıt gösteriliyor (toplam ${number(result.total)}). Hepsi için tabloda sıralayın ya da arayın.</p>` : "");
  const recordList = (items, detail, { showTab = false } = {}) =>
    items.length
      ? `<ul class="hof-record-list">${items.map(item => `<li><button type="button" data-open="${esc(item.key)}"><b>${esc(item.title || item.key)}</b><span>${esc([detail(item), showTab && item.tab ? item.tab : ""].filter(Boolean).join(" · "))}</span></button></li>`).join("")}</ul>`
      : '<p class="hof-empty">Kayıt yok.</p>';
  const wireOpen = modal =>
    modal.dialog.addEventListener("click", async event => {
      const button = event.target.closest("[data-open]");
      if (!button) return;
      modal.close();
      await HOF.revealRecord(button.dataset.open);
    });
  const explainHtml = lines => (lines?.length ? `<details class="hof-explain"><summary>Nasıl hesaplandı?</summary><ul>${lines.map(line => `<li>${esc(line)}</li>`).join("")}</ul></details>` : "");
  const eyebrow = (text, key) => (multiScope() && key ? `${text} · ${key}` : text);

  async function openKpi(id) {
    const key = activeScope();
    const scope = scopeFor(key);
    if (!scope) return undefined;
    if (id === "quality") return openQuality(scope.quality, key);
    if (id === "total") return openScopeReport([key]);
    const card = cardOf(scope, id);
    if (!card) return undefined;
    const title = nice(card.column);
    if (id === "money") {
      const result = await fetchList({ list: "topAmount", tab: key, limit: 30 });
      if (!result) return undefined;
      const modal = HOF.modal({ title: `${title}: en yüksek ${number(result.items.length)} kayıt`, eyebrow: eyebrow("AKILLI ÖZET", key), body: `<p class="hof-modal-text">Toplam <b>${esc(amount(card.sum, card.currency))}</b> · ${number(card.count)} kayıtta tutar. Kayda gitmek için tıklayın.</p>${recordList(result.items, item => amount(item.amount, card.currency))}${explainHtml(card.explain)}` });
      return wireOpen(modal);
    }
    if (id === "deadline") {
      const upcoming = await fetchList({ list: "upcoming", tab: key });
      const passed = upcoming && (await fetchList({ list: "passed", tab: key }));
      if (!upcoming || !passed) return undefined;
      const when = item => (item.days === 0 ? `${item.date} · bugün` : item.days > 0 ? `${item.date} · ${number(item.days)} gün sonra` : `${item.date} · ${number(-item.days)} gün önce`);
      const listFor = result => `${recordList(result.items, when)}${moreNote(result)}`;
      const modal = HOF.modal({
        title,
        eyebrow: eyebrow("AKILLI ÖZET", key),
        size: "wide",
        body: `<div class="hof-tabs" role="group" aria-label="Tarih filtresi"><button type="button" data-view="upcoming" aria-pressed="true">Önümüzdeki 30 gün (${number(upcoming.total)})</button><button type="button" data-view="passed" aria-pressed="false">Tarihi geçen (${number(passed.total)})</button></div><div data-list>${listFor(upcoming)}</div>${explainHtml(card.explain)}`,
      });
      modal.dialog.addEventListener("click", event => {
        const view = event.target.closest("[data-view]")?.dataset.view;
        if (!view) return;
        modal.dialog.querySelectorAll("[data-view]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.view === view)));
        modal.dialog.querySelector("[data-list]").innerHTML = listFor(view === "upcoming" ? upcoming : passed);
      });
      return wireOpen(modal);
    }
    if (id === "event") {
      const result = await fetchList({ list: "eventMonth", tab: key });
      if (!result) return undefined;
      const modal = HOF.modal({ title: `${title}: bu ay`, eyebrow: eyebrow("AKILLI ÖZET", key), body: `<p class="hof-modal-text">${number(result.total)} kayıt. Kayda gitmek için tıklayın.</p>${recordList(result.items, item => item.date)}${moreNote(result)}${explainHtml(card.explain)}` });
      return wireOpen(modal);
    }
    // Dağılım (durum, tür, sorumlu): çubuğa tıklanınca o seçeneğin kayıtları listelenir.
    const counted = card.labels.reduce((sum, item) => sum + item.count, 0) || 1;
    const bars = `<ul class="hof-bars hof-bars-clickable">${card.labels.map(item => `<li><button type="button" data-value="${esc(item.value)}" title="Bu kayıtları listele"><span>${esc(item.value)}</span><b>${number(item.count)}</b><i style="--hof-bar:${Math.round((item.count / counted) * 100)}%"></i></button></li>`).join("")}</ul>`;
    const summary = [card.other ? `seçeneklerin dışında ${number(card.other)} hücre` : "", card.empty ? `boş ${number(card.empty)} kayıt` : ""].filter(Boolean).join(" · ");
    const overview = `<div data-overview>${id === "responsible" ? `<p class="hof-modal-text">${number(card.people)} kişi. Bir kişinin kayıtları için tıklayın.</p>` : '<p class="hof-modal-text">Bir seçeneğin kayıtları için tıklayın.</p>'}${bars}${summary ? `<p class="hof-inline-note">${esc(summary)}</p>` : ""}${explainHtml(card.explain)}</div><div data-detail hidden></div>`;
    const modal = HOF.modal({ title, eyebrow: eyebrow("AKILLI ÖZET", key), size: "wide", body: overview });
    const overviewNode = modal.dialog.querySelector("[data-overview]");
    const detailNode = modal.dialog.querySelector("[data-detail]");
    modal.dialog.addEventListener("click", async event => {
      const back = event.target.closest("[data-back]");
      if (back) {
        detailNode.hidden = true;
        overviewNode.hidden = false;
        return;
      }
      const option = event.target.closest("[data-value]");
      if (!option) return;
      const result = await fetchList({ list: "value", tab: key, card: id, value: option.dataset.value });
      if (!result) return;
      detailNode.innerHTML = `<button type="button" class="hof-link" data-back>← Tüm seçenekler</button><p class="hof-modal-text"><b>${esc(option.dataset.value)}</b>: ${number(result.total)} kayıt. Kayda gitmek için tıklayın.</p>${recordList(result.items, () => "")}${moreNote(result)}`;
      overviewNode.hidden = true;
      detailNode.hidden = false;
      detailNode.querySelector("[data-back]")?.focus();
    });
    return wireOpen(modal);
  }

  // Sekmenin (ya da tüm sekmelerin) kart raporu: doğrulanan kartlar ve gösterilmeyen aday kartların nedenleri.
  const CARD_NAMES = { money: "Tutar toplamı", deadline: "Son tarih", event: "Bu ay", status: "Durum dağılımı", category: "Dağılım", responsible: "Sorumlu kişiler" };
  function openScopeReport(keys) {
    const sections = keys
      .map(key => {
        const scope = scopeFor(key);
        if (!scope) return "";
        const shown = scope.cards.map((card, index) => `<li class="is-ok">${icon("check", 14)}<span><b>${esc(CARD_NAMES[card.id] || card.id)}: ${esc(nice(card.column))}</b>${index < 2 ? "" : " <small>(kart şeridinde yer olmadığı için yalnızca raporda)</small>"}</span></li>`);
        const hidden = scope.rejected.map(item => `<li class="is-off"><span class="hof-report-dot" aria-hidden="true"></span><span><b>${esc(nice(item.column))}</b> <small>(${esc(CARD_NAMES[item.id] || item.id)})</small> — ${esc(item.reason)}</span></li>`);
        return `<section class="hof-scope-report">
            ${keys.length > 1 ? `<h3>${esc(key || "Tablo")}</h3>` : ""}
            <p class="hof-muted">${number(scope.total)} kayıt · ${number(scope.columnCount)} kolon</p>
            ${shown.length ? `<p class="hof-report-title">Doğrulanan kartlar</p><ul class="hof-report-list">${shown.join("")}</ul>` : '<p class="hof-empty">Bu sekmede doğrulanabilen özet kartı yok; yalnızca kayıt sayısı ve veri sağlığı gösterilir.</p>'}
            ${hidden.length ? `<p class="hof-report-title">Gösterilmeyen kartlar ve nedenleri</p><ul class="hof-report-list">${hidden.join("")}</ul>` : ""}
          </section>`;
      })
      .join("");
    HOF.modal({
      title: keys.length > 1 ? "Özet kartları raporu" : `${scopeName(keys[0])} özeti`,
      eyebrow: "AKILLI ÖZET",
      size: "wide",
      body: `<p class="hof-modal-text">Bir kart, kolonundaki her hücre tek tek okunup söylediği şey kesinleşirse gösterilir: tutarlar tek tek toplanır, tarihler takvimde denetlenir, dağılım kartları yalnızca birkaç sabit seçenekten oluşan kolonlardan çıkarılır. Kesin olmayan bir kart yerine hiç kart gösterilmez. Değerleri sabit seçeneklere indirmek (Excel'de "Veri doğrulama" ile açılır liste) kolonu karta dönüştürür.</p>${sections}`,
    });
  }
  HOF.openCardReport = () => openScopeReport(scopeKeys());

  function openQuality(quality = insight?.quality, key = "") {
    if (!quality) return;
    const levelText = LEVELS[quality.level];
    const issues = quality.issues
      .map(
        (issue, index) => `<details class="hof-issue is-${esc(issue.severity)}" ${index === 0 ? "open" : ""}>
          <summary><span class="hof-issue-dot" aria-hidden="true"></span><b>${esc(issue.title)}</b></summary>
          <p>${esc(issue.detail)}</p>
          ${issue.items.length ? recordList(issue.items, item => item.tab || "") : ""}
          ${issue.more ? `<p class="hof-inline-note">…ve ${number(issue.more)} kayıt daha.</p>` : ""}
        </details>`,
      )
      .join("");
    const modal = HOF.modal({
      title: `Veri sağlığı: ${levelText} (%${quality.score})`,
      eyebrow: key ? eyebrow("VERİ SAĞLIĞI", key) : multiScope() ? "VERİ SAĞLIĞI · TÜM SEKMELER" : "VERİ SAĞLIĞI",
      size: "wide",
      body: `<p class="hof-modal-text">Kontrol edilen <b>${number(quality.checked)}</b> hücrenin <b>${percentWord(quality.score)}</b> sorunsuz. Kontroller: kimlik ve kişi kolonlarının doluluğu, kimliğin aynı sekmede tekrar etmemesi, T.C./IBAN/VKN sağlaması ve telefon, tarih, tutar biçimleri. Not olarak yazılmış hücreler (ör. “ertelendi”) hata sayılmaz. Kaynak veriniz değiştirilmez; düzeltmeyi tablodan yapabilirsiniz.</p>
        ${issues || '<p class="hof-empty">Sorun bulunmadı.</p>'}`,
    });
    wireOpen(modal);
  }
  HOF.openQuality = openQuality;

  // ---------- Sektör listesi ----------
  async function loadCatalog() {
    if (!catalog) catalog = await HOF.api("/api/workspace/sectors");
    return catalog;
  }
  const allSectors = () => catalog.groups.flatMap(group => group.sectors.map(sector => ({ ...sector, group: group.id, groupName: group.name })));
  const sectorName = id => allSectors().find(sector => sector.id === id)?.name || id;

  // Aranabilir ve kaydırılabilir sektör seçici (klavyeyle: ↑ ↓ Enter Esc).
  async function pickSector({ title = "Sektörünüzü seçin", suggested = "", intro = "" } = {}) {
    try {
      await loadCatalog();
    } catch (error) {
      HOF.toastError(error);
      return null;
    }
    const current = profile?.sector?.id || "genel";
    return new Promise(resolve => {
      let chosen = null;
      const listId = `hof-sector-list-${Math.random().toString(36).slice(2, 7)}`;
      const modal = HOF.modal({
        title,
        eyebrow: "SEKTÖR",
        size: "wide",
        body: `${intro ? `<p class="hof-modal-text">${intro}</p>` : ""}
          <div class="hof-picker">
            <label class="hof-picker-search">${icon("search", 16)}<input type="search" role="combobox" aria-expanded="true" aria-controls="${listId}" aria-autocomplete="list" placeholder="Sektör ara… (ör. klinik, emlak, sigorta, galeri, okul)" autocomplete="off" autofocus></label>
            <div class="hof-picker-list" id="${listId}" role="listbox" aria-label="Sektörler" tabindex="-1"></div>
            <p class="hof-picker-count" aria-live="polite"></p>
          </div>`,
        onClose: () => resolve(chosen),
      });
      const input = modal.dialog.querySelector("input");
      const list = modal.dialog.querySelector(".hof-picker-list");
      const count = modal.dialog.querySelector(".hof-picker-count");
      const sectors = allSectors();
      const haystack = new Map(sectors.map(sector => [sector.id, fold([sector.name, sector.groupName, sector.record, sector.expert, ...(sector.keys || [])].join(" ")).split(" ")]));
      const option = (sector, extraClass = "") => {
        const chips = [sector.id === suggested ? '<span class="hof-chip hof-chip-accent">Önerilen</span>' : "", sector.id === current ? '<span class="hof-chip">Şu an</span>' : ""].join("");
        return `<div role="option" id="${listId}-${sector.id}" class="hof-picker-option ${extraClass}" data-id="${esc(sector.id)}" aria-selected="false"><span class="hof-picker-name"><b>${esc(sector.name)}</b>${chips}</span><small>${esc(sector.record)} · ${esc(sector.expert)}</small></div>`;
      };
      const render = () => {
        const tokens = fold(input.value).split(" ").filter(Boolean);
        const match = sector => tokens.every(token => haystack.get(sector.id).some(word => word.startsWith(token)));
        let html = "";
        let shown = 0;
        if (!tokens.length && suggested) {
          const item = sectors.find(sector => sector.id === suggested);
          if (item) html += `<div class="hof-picker-group" role="presentation">Önerilen</div>${option(item, "is-suggested")}`;
        }
        for (const group of catalog.groups) {
          const items = group.sectors.map(sector => ({ ...sector, groupName: group.name })).filter(sector => !tokens.length || match(sector));
          if (!items.length) continue;
          html += `<div class="hof-picker-group" role="presentation">${esc(group.name)}</div>${items.map(sector => option(sector)).join("")}`;
          shown += items.length;
        }
        list.innerHTML = html || `<p class="hof-empty">“${esc(input.value)}” için sonuç yok. Daha genel bir kelime deneyin ya da <button type="button" class="hof-link" data-id="genel">Genel</button> ile devam edin.</p>`;
        count.textContent = tokens.length ? `${number(shown)} sektör bulundu` : `${number(sectors.length)} sektör, ${number(catalog.groups.length)} grup`;
        setActive(list.querySelector(".hof-picker-option"));
      };
      let active = null;
      const setActive = node => {
        active?.classList.remove("is-active");
        active?.setAttribute("aria-selected", "false");
        active = node || null;
        if (active) {
          active.classList.add("is-active");
          active.setAttribute("aria-selected", "true");
          input.setAttribute("aria-activedescendant", active.id);
          active.scrollIntoView({ block: "nearest" });
        } else input.removeAttribute("aria-activedescendant");
      };
      const choose = id => {
        if (!id) return;
        chosen = id;
        modal.close();
      };
      input.addEventListener("input", render);
      input.addEventListener("keydown", event => {
        const options = [...list.querySelectorAll(".hof-picker-option")];
        const index = options.indexOf(active);
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setActive(options[Math.min(options.length - 1, index + 1)] || options[0]);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          setActive(options[Math.max(0, index - 1)] || options[0]);
        } else if (event.key === "Home" && options.length) {
          event.preventDefault();
          setActive(options[0]);
        } else if (event.key === "End" && options.length) {
          event.preventDefault();
          setActive(options[options.length - 1]);
        } else if (event.key === "Enter") {
          event.preventDefault();
          choose(active?.dataset.id);
        }
      });
      list.addEventListener("mousemove", event => {
        const node = event.target.closest(".hof-picker-option");
        if (node && node !== active) setActive(node);
      });
      list.addEventListener("click", event => choose(event.target.closest("[data-id]")?.dataset.id));
      render();
    });
  }

  async function applySector(id, source) {
    try {
      applyProfile(await HOF.api("/api/workspace/insight/sector", { method: "POST", body: { sectorId: id, source } }));
      HOF.toast(`Sektör: ${profile.sector.name}. Görünüm tüm bilgisayarlarda güncellendi.`, { type: "success", timeout: 5000 });
      return true;
    } catch (error) {
      HOF.toastError(error);
      return false;
    }
  }
  HOF.pickSector = async options => {
    const id = await pickSector(options);
    if (id) await applySector(id, "manual");
    return id;
  };

  // ---------- Adım adım analiz ekranı ----------
  const LEVEL_TEXT = { high: "Yüksek güven", medium: "Orta güven — kontrol edin", low: "Düşük güven" };
  const evidenceText = item => {
    if (item.kind === "header") return `“${item.column}” kolonu`;
    if (item.kind === "value") return `“${item.column}” kolonunda ${item.signal}`;
    if (item.kind === "role") return `Geçerli ${item.role === "plate" ? "plakalar" : item.role === "vkn" ? "vergi numaraları" : item.role} (“${item.column}”)`;
    if (item.kind === "title") return `Dosya/sekme adı: “${item.signal}”`;
    return item.signal;
  };
  function typesSummary(analysis) {
    const chips = [];
    const byColumn = new Map(analysis.columns.map(item => [item.column, item]));
    const add = (column, text) => column && chips.push(`${nice(column)}${text ? ` (${text})` : ""}`);
    const p = analysis.primary;
    add(p.id, "kimlik");
    add(p.person, "kişi/kurum");
    for (const item of analysis.columns.filter(column => column.verified)) add(item.column, `%${Math.round((item.validRate || 0) * 100)} doğrulandı`);
    if (p.phone) add(p.phone, `telefon, %${Math.round((byColumn.get(p.phone)?.validRate || 0) * 100)} geçerli`);
    add(p.money, "tutar");
    add(p.deadline, "son tarih");
    add(p.status, "durum");
    return [...new Set(chips)].slice(0, 6).join(" · ") || "Metin kolonları";
  }

  function modulesText(vocab, modules) {
    const tools = [modules.tahsilat ? "Tahsilat" : "", modules.haciz ? "Haciz" : ""].filter(Boolean);
    return `Kayıtlara <b>${esc(vocab.record)}</b> denir, uzman rolünün adı <b>${esc(vocab.expert)}</b> olur, kenar çubuğunda <b>${esc(vocab.subtitle)}</b> yazar${tools.length ? `; ${tools.map(item => `<b>${item}</b>`).join(" ve ")} araçları açık olur` : ""}.`;
  }

  const verifiedCards = analysis => Object.values(analysis.kpis?.scopes || {}).reduce((sum, scope) => sum + scope.cards.length, 0);
  const skippedCards = analysis => Object.values(analysis.kpis?.scopes || {}).reduce((sum, scope) => sum + scope.rejected.length, 0);

  async function runAnalysis({ reason = "import" } = {}) {
    if (!canManage()) return;
    const steps = [
      ["read", "Kayıtlar okunuyor"],
      ["types", "Veri türleri doğrulanıyor"],
      ["importance", "Önem sırası çıkarılıyor"],
      ["sector", "Sektör belirleniyor"],
      ["ready", "Çalışma alanı hazırlanıyor"],
    ];
    const modal = HOF.modal({
      title: "Verinizi tanıyoruz",
      eyebrow: "AKILLI ANALİZ",
      size: "wide",
      dismissible: false,
      body: `<ol class="hof-steps" aria-live="polite">${steps.map(([id, text]) => `<li data-step="${id}"><span class="hof-step-mark" aria-hidden="true"></span><span class="hof-step-text"><b>${esc(text)}</b><small></small></span></li>`).join("")}</ol>
        <p class="hof-inline-note">Analiz bu sunucuda yapılır; verileriniz internete gönderilmez.</p>
        <div class="hof-analysis-result" hidden></div>`,
    });
    const dialog = modal.dialog;
    const request = HOF.api("/api/workspace/insight", { timeoutMs: 180_000 }).then(result => result, error => ({ error }));
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const setStep = (id, status, detail = "") => {
      const node = dialog.querySelector(`[data-step="${id}"]`);
      if (!node) return;
      node.dataset.status = status;
      if (detail) node.querySelector("small").textContent = detail;
    };
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const pace = reduced ? 60 : 480;
    setStep("read", "active");
    const [result] = await Promise.all([request, wait(pace)]);
    if (result.error) {
      modal.close();
      HOF.toastError(result.error);
      return;
    }
    const analysis = result.analysis;
    insight = analysis;
    if (result.profile) applyProfile(result.profile);
    renderKpis();
    const s = analysis.sector;
    const details = {
      read: `${number(analysis.rowCount)} kayıt, ${number(analysis.columnCount)} kolon${analysis.tabs?.length > 1 ? `, ${number(analysis.tabs.length)} sekme` : ""} · ${number(analysis.ms)} ms`,
      types: typesSummary(analysis),
      importance: analysis.order.slice(0, 4).map(nice).join(" › "),
      sector: s.suggestion === "genel" ? "Belirgin bir sektör bulunamadı" : `${s.suggestionSector?.name} · ${LEVEL_TEXT[s.level]}`,
      ready: `${number(verifiedCards(analysis))} özet kartı doğrulandı · veri sağlığı %${analysis.quality.score} · arama hazır`,
    };
    for (const [id] of steps) {
      setStep(id, "active");
      await wait(pace);
      setStep(id, "done", details[id]);
    }
    dialog.querySelector(".hof-steps")?.classList.add("is-complete");
    showResult(modal, analysis);
  }
  HOF.runAnalysis = runAnalysis;

  function showResult(modal, analysis) {
    const dialog = modal.dialog;
    const s = analysis.sector;
    const current = profile?.sector?.id || "genel";
    const suggested = s.suggestionSector;
    const unsure = s.suggestion === "genel" || !suggested;
    const same = !unsure && suggested.id === current;
    const quality = analysis.quality;
    const levelText = { iyi: "İyi", orta: "Orta", zayif: "Zayıf" }[quality.level];
    const box = dialog.querySelector(".hof-analysis-result");
    const evidence = s.evidence.length ? `<ul class="hof-evidence">${s.evidence.map(item => `<li>${icon("check", 14)}${esc(evidenceText(item))}</li>`).join("")}</ul>` : "";
    let html;
    if (!unsure) {
      html = `<section class="hof-sector-card ${same ? "is-current" : ""}">
          <span class="hof-sector-icon" aria-hidden="true">${icon("sparkle", 22)}</span>
          <div class="hof-sector-main">
            <small>${same ? "Mevcut sektörünüz verinizle uyumlu" : "Önerilen sektör"}</small>
            <b>${esc(suggested.name)}</b>
            <span class="hof-sector-meta"><span class="hof-chip">${esc(suggested.groupName)}</span><span class="hof-confidence is-${esc(s.level)}">${esc(LEVEL_TEXT[s.level])}</span></span>
          </div>
        </section>
        ${evidence ? `<p class="hof-evidence-title">Neden bu sektör?</p>${evidence}` : ""}
        ${same ? "" : `<p class="hof-apply-preview">Uygulanınca: ${modulesText(suggested.vocab, suggested.modules)} Ayarlar'dan istediğiniz zaman değiştirebilirsiniz.</p>`}`;
    } else {
      const candidates = (s.candidates || []).filter(item => item.score >= 2).slice(0, 3);
      html = `<section class="hof-sector-card is-unsure">
          <span class="hof-sector-icon" aria-hidden="true">${icon("search", 22)}</span>
          <div class="hof-sector-main"><small>Sektör</small><b>Kesin olarak belirlenemedi</b><span class="hof-sector-meta"><span class="hof-confidence is-low">Emin olunamayan veriye sektör atanmaz</span></span></div>
        </section>
        <p class="hof-apply-preview">Listeden sektörünüzü seçebilir ya da <b>Genel</b> görünümle devam edebilirsiniz; kolonlarınız, göstergeler ve arama her iki durumda da verinize göre çalışır.${candidates.length ? ` Olası sektörler: ${candidates.map(item => `<button type="button" class="hof-link" data-candidate="${esc(item.id)}">${esc(item.name)}</button>`).join(", ")}.` : ""}</p>`;
    }
    const skipped = skippedCards(analysis);
    html += `<p class="hof-quality-line">${icon("sparkle", 16)} Özet kartları: <b>${number(verifiedCards(analysis))}</b> kart doğrulandı${skipped ? ` · ${number(skipped)} aday kart kesinleşmediği için gösterilmiyor` : ""} <button type="button" class="hof-link" data-cards>${skipped ? "Nedenleri gör" : "Raporu gör"}</button></p>`;
    html += `<p class="hof-quality-line">${icon("pulse", 16)} Veri sağlığı: <b>${esc(levelText)}</b> · kontrol edilen ${number(quality.checked)} hücrenin ${percentWord(quality.score)} sorunsuz${quality.issues.length ? ` · ${number(quality.issues.length)} bulgu` : ""} <button type="button" class="hof-link" data-quality>Raporu gör</button></p>`;
    const buttons = [];
    if (unsure) {
      buttons.push('<button type="button" class="hof-button hof-button-ghost" data-general>Genel ile devam et</button>', '<button type="button" class="hof-button" data-pick>Sektörümü seç</button>');
    } else if (!same) {
      buttons.push('<button type="button" class="hof-button hof-button-ghost" data-pick>Başka sektör seç</button>');
      if (current !== "genel") buttons.push('<button type="button" class="hof-button hof-button-ghost" data-keep>Mevcut görünümü koru</button>');
      else buttons.push('<button type="button" class="hof-button hof-button-ghost" data-general>Genel kullan</button>');
      buttons.push(`<button type="button" class="hof-button" data-apply="${esc(suggested.id)}">Evet, uygula</button>`);
    } else {
      buttons.push('<button type="button" class="hof-button hof-button-ghost" data-pick>Başka sektör seç</button>', '<button type="button" class="hof-button" data-done>Tamam</button>');
    }
    box.innerHTML = `${html}<div class="hof-actions">${buttons.join("")}</div>`;
    box.hidden = false;
    dialog.querySelector(".hof-modal-title").textContent = "Veriniz hazır";
    box.querySelector(".hof-actions .hof-button:last-child")?.focus();
    const finish = async () => {
      if (profile?.introPending) {
        try {
          applyProfile(await HOF.api("/api/workspace/insight/intro", { method: "POST" }));
        } catch {
          // Bir sonraki açılışta yeniden sorulur; kritik değil.
        }
      }
      modal.close();
    };
    box.addEventListener("click", async event => {
      const target = event.target.closest("button");
      if (!target) return;
      if ("quality" in target.dataset) return openQuality();
      if ("cards" in target.dataset) return HOF.openCardReport();
      if (target.dataset.apply) {
        target.disabled = true;
        if (await applySector(target.dataset.apply, "confirmed")) finish();
        else target.disabled = false;
      } else if (target.dataset.candidate) {
        if (await applySector(target.dataset.candidate, "manual")) finish();
      } else if ("pick" in target.dataset) {
        const id = await pickSector({ suggested: s.suggestion !== "genel" ? s.suggestion : "", intro: "Kelimeyle arayın ya da listeyi kaydırarak sektörünüzü bulun." });
        if (id && (await applySector(id, id === s.suggestion ? "confirmed" : "manual"))) finish();
      } else if ("general" in target.dataset) {
        if (current === "genel" || (await applySector("genel", "manual"))) finish();
      } else if ("keep" in target.dataset || "done" in target.dataset) finish();
    });
  }

  // 1.6.0'a güncellenen kurulumda yöneticiye bir kez, sayfayı kapatmayan bir kart. Kapatılınca (sunucu yanıtını
  // beklemeden) bu sayfada bir daha gösterilmez; bir pencere açıkken de gösterilmez.
  let introClosed = false;
  function showIntro() {
    if (introClosed || !canManage() || !profile?.introPending || HOF.hasOpenModal() || document.getElementById("hof-intro")) return;
    const card = HOF.el(
      "aside",
      { id: "hof-intro", class: "hof-intro", role: "status" },
      `<span class="hof-intro-icon" aria-hidden="true">${icon("sparkle", 20)}</span>
       <div><b>Yeni: DestekOfis verinizi tanıyor</b><p>Sektör önerisi, veri sağlığı raporu ve verinize göre özet kartları. Görünümünüz siz onaylamadan değişmez.</p>
       <div class="hof-intro-actions"><button type="button" class="hof-button hof-button-small" data-run>Analizi gör</button><button type="button" class="hof-button hof-button-small hof-button-ghost" data-later>Kapat</button></div></div>`,
    );
    card.addEventListener("click", async event => {
      if (event.target.closest("[data-run]")) {
        introClosed = true;
        card.remove();
        runAnalysis({ reason: "intro" });
      } else if (event.target.closest("[data-later]")) {
        introClosed = true;
        card.remove();
        try {
          applyProfile(await HOF.api("/api/workspace/insight/intro", { method: "POST" }));
          HOF.toast("Analizi istediğiniz zaman Ayarlar → Sektör ve görünüm'den açabilirsiniz.");
        } catch (error) {
          HOF.toastError(error);
        }
      }
    });
    document.body.appendChild(card);
  }

  // ---------- Ayarlar penceresindeki "Sektör ve görünüm" bölümü ----------
  HOF.settingsExtensions = HOF.settingsExtensions || [];
  HOF.settingsExtensions.push({
    html() {
      if (!canManage() || !profile) return "";
      const labels = Object.entries(profile.labels || {});
      const source = { confirmed: "analizle onaylandı", manual: "elle seçildi", legacy: "önceki sürümden", default: "varsayılan" }[profile.sector.source] || "";
      return `<section class="hof-data-section hof-profile-section">
          <h3>Sektör ve görünüm</h3>
          <div class="hof-profile-row">
            <div><b>${esc(profile.sector.name)}</b><small>${esc(profile.sector.groupName)}${source ? ` · ${esc(source)}` : ""}${profile.sector.byName ? ` · ${esc(profile.sector.byName)}` : ""}</small></div>
            <div class="hof-profile-actions"><button type="button" class="hof-button hof-button-small hof-button-ghost" data-profile-analyze>Verimi analiz et</button><button type="button" class="hof-button hof-button-small" data-profile-pick>Sektörü değiştir</button></div>
          </div>
          <p class="hof-modal-text hof-muted">Kayıtlara <b>${esc(HOF.vocab.record)}</b>, uzman rolüne <b>${esc(HOF.vocab.expert)}</b> deniyor. Başlıkları sayfadaki kalem (✎) simgesiyle değiştirebilirsiniz.</p>
          ${labels.length ? `<ul class="hof-label-list">${labels.map(([key, value]) => `<li><span>${esc(profile.slots?.[key]?.name || key)}</span><b>${esc(value)}</b><button type="button" class="hof-link" data-label-reset="${esc(key)}">Varsayılana dön</button></li>`).join("")}</ul><button type="button" class="hof-button hof-button-small hof-button-ghost" data-labels-reset>Tüm başlıkları varsayılana döndür</button>` : ""}
        </section>`;
    },
    wire(modal) {
      const dialog = modal.dialog;
      dialog.querySelector("[data-profile-analyze]")?.addEventListener("click", () => {
        modal.close();
        runAnalysis({ reason: "settings" });
      });
      dialog.querySelector("[data-profile-pick]")?.addEventListener("click", async () => {
        modal.close();
        const id = await pickSector({ suggested: insight?.sector?.suggestion !== "genel" ? insight?.sector?.suggestion || "" : "" });
        if (id) applySector(id, "manual");
      });
      dialog.querySelectorAll("[data-label-reset]").forEach(button =>
        button.addEventListener("click", async () => {
          try {
            applyProfile(await HOF.api("/api/workspace/labels", { method: "PUT", body: { key: button.dataset.labelReset, value: "" } }));
            button.closest("li")?.remove();
            HOF.toast("Başlık varsayılana döndü.", { type: "success" });
          } catch (error) {
            HOF.toastError(error);
          }
        }),
      );
      dialog.querySelector("[data-labels-reset]")?.addEventListener("click", async event => {
        const ok = await HOF.confirm({ title: "Başlıkları sıfırla", message: "Değiştirilen tüm başlıklar varsayılana döner. Devam edilsin mi?", confirmLabel: "Varsayılana döndür" });
        if (!ok) return;
        try {
          applyProfile(await HOF.api("/api/workspace/labels", { method: "DELETE" }));
          event.target.closest(".hof-profile-section")?.querySelector(".hof-label-list")?.remove();
          event.target.remove();
          HOF.toast("Tüm başlıklar varsayılana döndü.", { type: "success" });
        } catch (error) {
          HOF.toastError(error);
        }
      });
    },
  });

  // ---------- Canlı değişiklikler ----------
  HOF.on("live:workspace.changed", change => {
    if (!change) return;
    if (change.kind === "profile") loadProfile();
    if (change.kind === "records" || change.dataset) refreshInsightSoon(change.dataset ? 400 : 1500);
  });
  HOF.on("live:resync", () => {
    loadProfile();
    refreshInsightSoon(300);
  });
  HOF.on("data-refresh", () => refreshInsightSoon(1500));

  // Sayfa açılışı: profil /api/auth/me ile gelir; analiz arka planda alınır.
  HOF.whenReady(user => {
    if (user?.profile) applyProfile(user.profile);
    else loadProfile();
    let pendingAnalysis = null;
    try {
      pendingAnalysis = sessionStorage.getItem("hof-analyze");
      if (pendingAnalysis) sessionStorage.removeItem("hof-analyze");
    } catch {
      pendingAnalysis = null;
    }
    if (HOF.settings?.sheetUrl) loadInsight();
    HOF.onDom(() => {
      applyLabels();
      renderKpis();
      applyMonthNav();
      if (pendingAnalysis && canManage() && document.querySelector(".dynamic-table") && !HOF.hasOpenModal()) {
        pendingAnalysis = null;
        setTimeout(() => runAnalysis({ reason: "import" }), 350);
      } else if (!pendingAnalysis && profile?.introPending && document.querySelector(".dynamic-table")) showIntro();
    });
  });
})();
