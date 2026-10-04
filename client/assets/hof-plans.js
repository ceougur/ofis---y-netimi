/* DestekOfis — Taksitler (v2.0.4): Operasyon Merkezi'ndeki kalıcı modül.
 * Tek pencere, iki görünüm: LİSTE (süzgeçler: durum, grup › alt grup, arama; göstergeler; kartlar) ve KART (ad, telefon,
 * not, göstergeler; taksitler; hareketler). Kartın üstündeki düğmeler: + Tahsilat, − Ödeme/İade, + Taksit, Otomatik dağıt,
 * Ekstre PDF, WhatsApp, Düzenle, Sil. Kayıt açılırken taksit sorulmaz; istenirse sonra dağıtılır ya da elle girilir.
 * Excel'den ilk yükleme: dosya tarayıcıda okunur (hof-excel-worker.js), başlıklar rollerle eşlenir, kullanıcı düzeltir.
 * Tahsilatlar Kasa'ya düşer; geciken taksitler tahsilat takvimine ve bildirimlere girer (server/routes/plans.mjs). */
(() => {
  "use strict";
  const HOF = window.HOF;
  const { esc } = HOF;
  const money = value => HOF.formatMoney(value);
  const pad2 = value => String(value).padStart(2, "0");
  const todayIso = () => {
    const date = new Date();
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  };
  const AMOUNT_FORMAT = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const amountText = value => AMOUNT_FORMAT.format(Number(value) || 0);
  const STATUS_TABS = [
    { id: "active", label: "Devam Eden" },
    { id: "overdue", label: "Geciken" },
    { id: "done", label: "Biten" },
    { id: "closed", label: "Kapalı" },
    { id: "all", label: "Tümü" },
  ];
  const STATE = {
    overdue: ["Gecikti", "late"],
    active: ["Devam Ediyor", "info"],
    done: ["Tamamlandı", "done"],
    closed: ["Kapalı", "muted"],
  };
  const ITEM_STATE = {
    paid: ["Ödendi", "done"],
    overdue: ["Gecikti", "late"],
    today: ["Bugün", "soon"],
    upcoming: ["Yaklaşıyor", "soon"],
    open: ["Bekliyor", "muted"],
    closed: ["Kapalı", "muted"],
  };
  const badge = (label, tone) => `<span class="hof-plan-badge is-${tone}">${esc(label)}</span>`;
  const itemBadge = item => {
    const [label, tone] = ITEM_STATE[item.state] || ITEM_STATE.open;
    return badge(item.partial && item.state !== "paid" ? `Kısmen · ${label}` : label, tone);
  };
  const dayLabel = days => (days < 0 ? `${Math.abs(days)} gün gecikti` : days === 0 ? "Bugün" : days === 1 ? "Yarın" : `${days} gün kaldı`);
  const whereText = plan => [plan.groupName, plan.subgroupName].filter(Boolean).join(" › ");
  const canManage = () => HOF.can("plans.manage");
  const canCollect = () => HOF.can("plans.collect");

  // Modülün görünen adı: Operasyon Merkezi'ndeki kalemle değişir ("Taksitler" → "Aidatlar", "Servis ücretleri"…).
  // İç anahtar (side.plans), yetkiler ve API adresleri değişmez; yalnızca kullanıcının gördüğü ad bu işlevden okunur.
  const moduleName = () => HOF.uiLabel?.("side.plans", "Taksitler") || "Taksitler";
  let modal = null;
  const SORT_KEY = "hof.plans.sort";
  const savedSort = () => {
    try {
      return localStorage.getItem(SORT_KEY) || "no";
    } catch {
      return "no";
    }
  };
  const view = { mode: "list", planId: "", q: "", group: "", subgroup: "", status: "active", sort: savedSort(), itemFilter: "all", entryFilter: "all", groups: [], list: null, plan: null };
  const lists = HOF.listGate();

  // ---------- Veri ----------
  const loadGroups = async () => {
    try {
      view.groups = await HOF.api("/api/workspace/plans/groups");
    } catch {
      view.groups = [];
    }
  };
  async function loadList({ quiet = false } = {}) {
    // Sıra kuralları HOF.listGate'te (v2.0.22); arka plan yenilemesi en çok 2 bağlantılık arka plan kuyruğundan gider.
    const load = lists.start({ quiet });
    if (!quiet && view.listError) {
      view.listError = "";
      if (!view.list && view.mode === "list") renderList();
    }
    try {
      const data = await HOF.api(`/api/workspace/plans?${listQuery()}`, quiet ? { background: true } : {});
      if (!load.current()) return;
      load.applied();
      view.listError = "";
      view.list = data;
      if (view.mode === "list") renderList();
    } catch (error) {
      if (quiet) throw error;
      if (!load.current()) return;
      view.list = null;
      view.listError = error.message;
      if (view.mode === "list") renderList();
    } finally {
      load.done();
    }
  }
  async function loadPlan(id, { quiet = false } = {}) {
    try {
      const plan = await HOF.api(`/api/workspace/plans/${encodeURIComponent(id)}`);
      // Arka plan yenilemesi gelene kadar kullanıcı listeye ya da başka karta geçtiyse eski kart geri gelmez.
      if (quiet && (view.mode !== "card" || view.planId !== id)) return;
      // Başka bir karta geçilince taksit/hareket süzgeçleri sıfırlanır.
      if (id !== view.planId) {
        view.itemFilter = "all";
        view.entryFilter = "all";
      }
      view.plan = plan;
      view.planId = id;
      view.mode = "card";
      renderCard();
    } catch (error) {
      if (quiet && (view.mode !== "card" || view.planId !== id)) return;
      if (quiet && !HOF.lostRecord(error)) throw error;
      HOF.toastError(error);
      view.mode = "list";
      renderList();
      loadList();
    }
  }
  const applyPlan = data => {
    view.plan = data;
    if (modal) {
      if (view.mode === "card" && view.planId === data.id) renderCard();
      loadList();
    }
    HOF.dues?.reloadSoon?.(300);
    HOF.emit("plans-changed", { planId: data.id, caseKey: data.caseKey || "" });
  };

  // ---------- Tablodaki kayıt (v2.0.6) ----------
  // Kart, açık veri oturumundaki bir kayda bağlanır: kişinin kartında taksitler ve tahsilat görünür; karttan girilen
  // tahsilat taksitten düşer. Kaydın kısa adı analizden (kimlik ve kişi kolonları), yoksa ilk iki dolu alandan.
  const primaryColumns = () => HOF.insight?.()?.primary || {};
  // Kişi kolonu: önce açık ad kolonu (ADI SOYADI, MÜVEKKİL, ÖĞRENCİ, HASTA…); veli/yetkili gibi ikinci kişi kolonları
  // sonra; en son analizin kişi kolonu. Sıra numarası kolonları (S.N, SIRA) kimlik etiketi sayılmaz.
  const NAME_COLUMN = /(^|[^a-zçğıöşü])(ad[ıi]?\s*soyad[ıi]?|adi\s*soyadi|isim|müvekkil|muvekkil|öğrenci|ogrenci|hasta|müşteri|musteri|borçlu|borclu|kiracı|kiraci|üye|uye|personel|çalışan|calisan|firma|kurum|unvan)([^a-zçğıöşü]|$)/i;
  const SECOND_PERSON = /veli|anne|baba|yetkili|avukat|vekil|kefil|sorumlu/i;
  const RUNNING_NO = /^(s\.?\s*n\.?|s[ıi]ra(\s*no)?|no|#|id)$/i;
  // v2.0.13: "Müşteri No", "Müşteri Telefonu", "Müşteri Kayıt Tarihi" ad kolonu değildir ("müşteri" sözcüğü geçse de);
  // önce açık ad kolonları (Ad Soyad, İsim, Unvan), sonra kişi sözcükleri. Simülasyonda cari adı "1153" olmuştu.
  const NOT_NAME = /(\bno\b|\bnum|numara|kod|kimlik|t\.?c\.?|tel|gsm|telefon|tarih|limit|tutar|bakiye|borcu|şekli|sekli|adres|mahalle|şube|sube|grup|e-?posta|mail)/i;
  const PLAIN_NAME = /(^|[^a-zçğıöşü])(ad[ıi]?\s*soyad[ıi]?|adi\s*soyadi|isim|unvan|ad[ıi]?)([^a-zçğıöşü]|$)/i;
  // v2.0.18 (müşteri, marka/patent tablosu: cari adı "Başvuru Sahibi" yerine "Marka / Buluş Adı" oluyordu; program geneli):
  // "Ürün Adı", "Marka / Buluş Adı", "Proje Adı" gibi EŞYA adları kişi değildir — "Firma Adı", "Müşteri Adı" gibi taraf
  // sözcüğü geçenler kişidir. Taraf sözcükleri analiz motorunun sözlüğüyle aynı (server/lib/insight/columns.mjs).
  const ITEM_WORD = /(ürün|urun|hizmet|proje|etkinlik|kurs|ders|paket|model|marka|buluş|bulus|patent|tasarım|tasarim|eğitim|egitim|oda|menü|menu|kalem|malzeme|parça|parca|ilaç|ilac|dosya|evrak|belge|program|kampanya|görev|gorev|sefer|güzergah|guzergah|cihaz|araç|arac|kitap|konu|eser|yazılım|yazilim|uygulama|site|domain|alan adı|alan adi)/i;
  const PARTY_WORD = /(müvekkil|muvekkil|borçlu|borclu|alacaklı|alacakli|hasta|müşteri|musteri|öğrenci|ogrenci|veli|kişi|kisi|kiracı|kiraci|malik|sürücü|surucu|üye|uye|aday|çalışan|calisan|personel|davacı|davaci|davalı|davali|sanık|sanik|tedarikçi|tedarikci|bayi|firma|şirket|sirket|unvan|kurum|cari|alıcı|alici|satıcı|satici|gönderen|gonderen|misafir|katılımcı|katilimci|sigortalı|sigortali|danışan|danisan|kursiyer|sporcu|abone|yolcu|ortak|bağışçı|bagisci|mükellef|mukellef|sahibi|sahip|başvuran|basvuran|taraf|vekil eden|yetkili)/i;
  const isItemName = key => ITEM_WORD.test(key) && !PARTY_WORD.test(key);
  // Sıra: (1) analiz motorunun kişi kolonu — 143 sektör için ortak sınıflandırıcı; detay kartı başlığı da onu kullanır,
  // (2) açık ad kolonu (Ad Soyad, İsim, Unvan) — eşya adı değilse, (3) kişi/taraf sözcüğü geçen kolon (Müşteri, Borçlu,
  // Başvuru Sahibi, Mükellef…), (4) analizin ad + soyad parçaları. Eskiden (2) öndeydi ve eşya adlarını elemiyordu:
  // "Marka / Buluş Adı" cari adı oluyordu.
  const nameColumn = row => {
    const all = Object.keys(row).filter(key => !key.startsWith("__"));
    const primary = primaryColumns();
    if (primary.person && all.includes(primary.person) && !isItemName(primary.person)) return primary.person;
    const keys = all.filter(key => !NOT_NAME.test(key) && !isItemName(key));
    return (
      keys.find(key => PLAIN_NAME.test(key) && !SECOND_PERSON.test(key)) ||
      keys.find(key => (NAME_COLUMN.test(key) || PARTY_WORD.test(key)) && !SECOND_PERSON.test(key)) ||
      keys.find(key => NAME_COLUMN.test(key)) ||
      (primary.personParts?.[0] && all.includes(primary.personParts[0]) ? primary.personParts[0] : "") ||
      ""
    );
  };
  // v2.0.12: tablodaki kaydın kayıt tarihi ("Kayıt Tarihi", "Kayıt Günü", "Başlangıç Tarihi") → YYYY-AA-GG; yoksa "".
  const recordDay = row => {
    const key = Object.keys(row || {}).find(name => !name.startsWith("__") && /^(kay[ıi]t|başlangıç|baslangic)\s*(tarihi|günü|gunu)?$/i.test(name.trim()));
    const text = key ? String(row[key] || "").trim() : "";
    let m = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    m = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
  };
  const personOf = row => {
    const column = nameColumn(row);
    const value = column ? String(row[column] ?? "").trim() : "";
    // Ad ve soyad ayrı kolonlardaysa ("Adı" + "Soyadı") kişi adı ikisinden kurulur (v2.0.18).
    const parts = primaryColumns().personParts;
    if (parts?.length === 2 && column === parts[0] && row[parts[1]] !== undefined) {
      const last = String(row[parts[1]] ?? "").trim();
      if (last && !value.toLocaleLowerCase("tr-TR").endsWith(last.toLocaleLowerCase("tr-TR"))) return `${value} ${last}`.trim();
    }
    return value;
  };
  const recordLabel = row => {
    const primary = primaryColumns();
    const idColumn = primary.id && !RUNNING_NO.test(String(primary.id).trim()) ? primary.id : "";
    // Kayıt başlığı: kimlik + kişi adı (Adı + Soyadı ayrıysa birleşik; personOf ile aynı kural).
    const parts = [idColumn ? String(row[idColumn] ?? "").trim() : "", personOf(row)].filter(Boolean);
    if (parts.length) return [...new Set(parts)].join(" · ");
    return Object.entries(row).filter(([key, value]) => !key.startsWith("__") && String(value ?? "").trim()).slice(0, 2).map(([, value]) => String(value).trim()).join(" · ");
  };
  const phoneOf = row => {
    const column = Object.keys(row).find(key => !key.startsWith("__") && /(telefon|tel\b|gsm|cep)/i.test(key));
    return column ? String(row[column] ?? "").trim() : "";
  };
  const rowOfKey = key => (HOF.data?.rows || []).find(row => row.__hofKey === key) || null;
  // Bağ başka bir veri oturumunda kurulduysa bu oturumun tablosunda aranmaz (aynı anahtar başka kişiye ait olabilir).
  const foreignCase = plan => Boolean(plan?.caseKey && plan.caseSource && HOF.datasetKey && plan.caseSource !== HOF.datasetKey);
  // Bağlı kayıt açık tabloda artık yoksa (silinmiş ya da yeni dosyada kimliği değişmiş) "Kayda git" yerine uyarı.
  const orphanCase = plan => Boolean(plan?.caseKey && !foreignCase(plan) && (HOF.data?.rows || []).length && !rowOfKey(plan.caseKey));
  function wirePicker(picker) {
    const input = picker.querySelector('input[name="caseTitle"]');
    const key = picker.querySelector('input[name="caseKey"]');
    const source = picker.querySelector('input[name="caseSource"]');
    const list = picker.querySelector(".hof-case-picker-list");
    const clear = picker.querySelector("[data-unlink]");
    const texts = new WeakMap();
    const textOf = row => {
      let value = texts.get(row);
      if (value === undefined) {
        value = HOF.normalize(Object.entries(row).filter(([name]) => !name.startsWith("__")).map(([, cell]) => cell).join(" "));
        texts.set(row, value);
      }
      return value;
    };
    const state = () => {
      picker.classList.toggle("is-linked", Boolean(key.value));
      clear.hidden = !key.value;
    };
    const hide = () => {
      list.hidden = true;
      list.innerHTML = "";
    };
    const search = () => {
      const query = HOF.normalize(input.value);
      if (key.value || !query) return hide();
      const hits = [];
      for (const row of HOF.data?.rows || []) {
        if (!row.__hofKey) continue;
        if (textOf(row).includes(query)) {
          hits.push(row);
          if (hits.length >= 8) break;
        }
      }
      list.innerHTML = hits.length
        ? hits.map(row => `<li role="option" data-key="${esc(row.__hofKey)}"><b>${esc(recordLabel(row))}</b><small>${esc(String(row.__sheet || "").trim())}</small></li>`).join("")
        : '<li class="is-empty">Eşleşen kayıt yok</li>';
      list.hidden = false;
    };
    input.addEventListener("input", () => {
      if (key.value) {
        key.value = "";
        source.value = "";
        state();
      }
      search();
    });
    input.addEventListener("focus", search);
    input.addEventListener("blur", () => setTimeout(hide, 160));
    input.addEventListener("keydown", event => {
      if (event.key === "Escape") hide();
      if (event.key === "Enter" && !list.hidden) {
        event.preventDefault();
        list.querySelector("li[data-key]")?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      }
    });
    list.addEventListener("mousedown", event => {
      const item = event.target.closest("li[data-key]");
      if (!item) return;
      event.preventDefault();
      const row = rowOfKey(item.dataset.key);
      key.value = item.dataset.key;
      source.value = "";
      input.value = row ? recordLabel(row) : item.textContent.trim();
      state();
      hide();
      // Ad ve telefon boşsa kayıttan gelir.
      const form = picker.closest("form");
      const name = form?.querySelector('input[name="name"]');
      if (name && !name.value.trim() && row) name.value = personOf(row) || recordLabel(row);
      const phone = form?.querySelector('input[name="phone"]');
      if (phone && !phone.value.trim() && row) phone.value = phoneOf(row);
    });
    clear.addEventListener("click", () => {
      key.value = "";
      source.value = "";
      input.value = "";
      state();
      input.focus();
    });
    state();
  }
  const pickerHtml = link => `<span>Tablodaki Kayıt</span>
      <div class="hof-case-picker-box"><input type="text" name="caseTitle" autocomplete="off" maxlength="200" placeholder="${(HOF.data?.rows || []).length ? "Ad, dosya no ya da telefon yazın…" : "Tabloda kayıt yok"}" value="${esc(link.caseTitle)}"><button type="button" class="hof-case-picker-clear" data-unlink title="Bağlantıyı kaldır" aria-label="Bağlantıyı kaldır">×</button></div>
      <input type="hidden" name="caseKey" value="${esc(link.caseKey)}"><input type="hidden" name="caseSource" value="${esc(link.caseSource)}">
      <ul class="hof-case-picker-list" role="listbox" hidden></ul>
      <small>Bağlı kaydın kartında taksitler, ödenen ve kalan görünür; oradan girilen tahsilat taksitten düşer ve Kasa'ya tek kayıt olarak iner.</small>`;

  // ---------- Pencere ----------
  const body = () => modal?.dialog.querySelector("[data-plans]");
  function open(planId = "") {
    if (!HOF.can("plans.view")) return HOF.toast(`${moduleName()} için yetkiniz yok.`, { type: "error" });
    // v2.0.14: pencere DOM'dan kaldırıldıysa (kapanışı haber vermeden) referans bayattır; yeniden açılır.
    if (modal && !document.body.contains(modal.node)) modal = null;
    if (modal) {
      if (planId) loadPlan(planId);
      return;
    }
    modal = HOF.modal({
      title: moduleName(),
      eyebrow: "OPERASYON",
      size: "wide",
      body: '<div class="hof-plans" data-plans><p class="hof-empty">Yükleniyor…</p></div>',
      onClose: () => {
        modal = null;
        view.mode = "list";
        view.planId = "";
      },
    });
    modal.dialog.classList.add("hof-plans-modal");
    modal.dialog.addEventListener("click", onClick);
    modal.dialog.addEventListener("change", onChange);
    modal.dialog.addEventListener("input", onInput);
    // Klavye: listede satır odaktayken Enter kartı açar.
    modal.dialog.addEventListener("keydown", event => {
      const row = event.target.closest?.("tr[data-plan]");
      if (row && event.key === "Enter" && view.mode === "list") loadPlan(row.dataset.plan);
    });
    loadGroups().then(() => {
      if (planId) loadPlan(planId);
      else {
        renderList();
        loadList();
      }
    });
  }

  // ---------- PDF ve yazdırma ----------
  // PDF sunucuda hazırlanır (Türkçe harfler gömülü yazı tipiyle). "PDF" yeni sekmede açar (oradan kaydedilir),
  // "Yazdır" aynı PDF'i gizli bir çerçevede açıp tarayıcının yazdırma penceresini çağırır.
  let printFrame = null;
  function printPdf(url) {
    printFrame?.remove();
    const frame = HOF.el("iframe", { class: "hof-print-frame", title: "Yazdırma", "aria-hidden": "true", tabindex: "-1" });
    printFrame = frame;
    document.body.appendChild(frame);
    HOF.toast("Yazdırma hazırlanıyor…");
    frame.addEventListener(
      "load",
      () => {
        try {
          frame.contentWindow.focus();
          frame.contentWindow.print();
        } catch {
          window.open(url, "_blank", "noopener"); // tarayıcı çerçeveden yazdırmaya izin vermezse PDF yeni sekmede açılır
        }
      },
      { once: true },
    );
    frame.src = HOF.apiUrl(url);
  }
  const listQuery = () => new URLSearchParams({ q: view.q, group: view.group, subgroup: view.subgroup, status: view.status, sort: view.sort });
  const listPdfUrl = () => `/api/workspace/plans/liste.pdf?${listQuery()}&title=${encodeURIComponent(moduleName())}`;
  const cardPdfUrl = plan => `/api/workspace/plans/${encodeURIComponent(plan.id)}/ekstre.pdf`;
  const PDF_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>';
  const PEOPLE_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
  const PRINT_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9V3h12v6"/><rect x="6" y="14" width="12" height="7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/></svg>';
  // v2.0.16 (müşteri): düğme ne indirdiğini söyler ("Cari Ekstre - PDF", "Taksit Ekstresi - PDF" …).
  const outputButtons = (pdfUrl, scope, label = "PDF") =>
    `<span class="hof-plan-output" role="group" aria-label="Dışa aktar"><a class="hof-button hof-button-small hof-button-ghost" href="${esc(pdfUrl)}" target="_blank" rel="noopener" data-pdf="${scope}" title="PDF olarak aç; oradan kaydedebilirsiniz">${PDF_ICON}${esc(label)}</a><button type="button" class="hof-button hof-button-small hof-button-ghost" data-print="${scope}" title="Yazıcıya gönder">${PRINT_ICON}Yazdır</button></span>`;

  // ---------- Liste ----------
  const SORT_OPTIONS = [
    ["no", "Sıra No"],
    ["name", "Ada Göre"],
    ["due", "Vadeye Göre (geciken önce)"],
    ["remaining", "Kalana Göre (çoktan aza)"],
    ["registered", "Kayıt Tarihine Göre (yeni önce)"],
  ];
  // Grup süzgeci (v2.0.11): gruplar cari ve taksit kartında ortaktır; seçenekte kart sayısının yanında gruptaki cari
  // sayısı da yazar ("42 C 0079 · 0 kart · 12 cari"). Hiç kartı ve carisi olmayan grup "boş" diye işaretlenir.
  const groupText = item => `${item.name} · ${item.count.toLocaleString("tr-TR")} kart${item.accounts ? ` · ${item.accounts.toLocaleString("tr-TR")} cari` : item.count ? "" : " · boş"}`;
  const groupOptions = () => {
    const group = view.groups.find(item => item.id === view.group);
    const subs = group ? group.subgroups : [];
    return `<select data-filter="group" aria-label="Grup"><option value="">Tüm Gruplar</option>${view.groups.map(item => `<option value="${esc(item.id)}" ${item.id === view.group ? "selected" : ""}>${esc(groupText(item))}</option>`).join("")}</select>
      <select data-filter="subgroup" aria-label="Alt grup" ${subs.length ? "" : "disabled"}><option value="">${subs.length ? "Tüm Alt Gruplar" : "Alt Grup"}</option>${subs.map(item => `<option value="${esc(item.id)}" ${item.id === view.subgroup ? "selected" : ""}>${esc(groupText(item))}</option>`).join("")}</select>`;
  };
  // Toplu taksitlendirme (v2.0.11): taksit yöneten ve carileri görebilen kullanıcıda.
  const canBulk = () => canManage() && HOF.can("accounts.view") && Boolean(HOF.accounts?.bulkPlanForm);
  const selectedGroup = () => {
    const group = view.groups.find(item => item.id === view.group) || null;
    const sub = group?.subgroups.find(item => item.id === view.subgroup) || null;
    return sub || group;
  };
  // Boş liste: seçili grupta cari varsa boş bir tablo yerine ne yapılacağı söylenir (v2.0.11). Önceden "42 C 0079"
  // gibi carisi olan ama kartı olmayan grup seçilince yalnız "Bu süzgeçte kart yok" yazıyordu.
  function emptyList(filtered, manage) {
    const group = selectedGroup();
    if (group && group.withoutPlan && !view.q && canBulk()) {
      return `<div class="hof-empty hof-plan-empty-group"><p><b>${esc(group.name)}</b> grubunda ${group.accounts.toLocaleString("tr-TR")} cari var; ${group.withoutPlan === group.accounts ? "hiçbirinin" : `${group.withoutPlan.toLocaleString("tr-TR")} carinin`} taksit kartı yok.</p><button type="button" class="hof-button hof-button-small" data-act="pick">Bu Gruba Toplu Taksitlendir</button></div>`;
    }
    if (group && !group.accounts && !group.count && !view.q) return `<p class="hof-empty"><b>${esc(group.name)}</b> grubu boş: ne carisi ne taksit kartı var. Cari ya da kart açarken bu grubu seçin; kullanılmayacaksa <b>Gruplar</b>’dan silebilirsiniz.</p>`;
    return `<p class="hof-empty">${filtered || view.status !== "all" ? "Bu süzgeçte kart yok." : "Henüz taksit kartı yok."}${manage && !filtered ? ` <b>+ Yeni Kart</b> ile tek kart açın${canBulk() ? ", <b>+ Toplu Taksitlendir</b> ile carilerinize birlikte plan kurun" : ""} ya da <b>Excel’den Yükle</b> ile listenizi bir kerede aktarın.` : ""}</p>`;
  }
  const progress = totals => {
    const share = totals.total > 0 ? Math.max(0, Math.min(100, Math.round((totals.paid / totals.total) * 100))) : 0;
    return `<span class="hof-plan-progress" title="%${share} ödendi" aria-label="Yüzde ${share} ödendi"><i style="width:${share}%"></i></span>`;
  };
  // Kartı olan grupta kartsız cari kalmışsa (ör. sonradan eklenen öğrenci) listenin üstünde kısa not ve kısayol.
  function groupHint(data) {
    const group = selectedGroup();
    if (!data?.plans.length || !group?.withoutPlan || !canBulk() || view.q) return "";
    return `<p class="hof-plan-group-hint">${esc(group.name)} grubunda taksit kartı olmayan <b>${group.withoutPlan.toLocaleString("tr-TR")} cari</b> var. <button type="button" class="hof-link" data-act="pick">Cari Seç ve Taksitlendir</button></p>`;
  }
  function renderList() {
    const root = body();
    if (!root) return;
    const data = view.list;
    const manage = canManage();
    const filtered = Boolean(view.q || view.group || view.subgroup);
    const row = plan => {
      const [label, tone] = STATE[plan.state] || STATE.active;
      const next = plan.next ? `${HOF.formatDate(plan.next.dueDate)}<small>${esc(plan.next.seq)}. taksit · ${esc(dayLabel(plan.next.days))}</small>` : plan.itemCount ? "<small>—</small>" : '<small class="is-warn">Taksit girilmemiş</small>';
      return `<tr data-plan="${esc(plan.id)}" class="is-${esc(plan.state)}" tabindex="0"><td class="hof-plan-no">${esc(plan.refNo || "")}</td><td><b>${esc(plan.name)}</b><small>${esc(whereText(plan) || "Grupsuz")}${plan.phone ? ` · ${esc(plan.phone)}` : ""}${plan.registeredOn ? ` · kayıt ${esc(HOF.formatDate(plan.registeredOn))}` : ""}</small>${plan.note ? `<small class="hof-plan-row-note" title="${esc(plan.note)}">${esc(plan.note)}</small>` : ""}</td><td class="num">${esc(money(plan.totals.total))}</td><td class="num hof-cash-in">${esc(money(plan.totals.paid))}${progress(plan.totals)}</td><td class="num${plan.totals.remaining > 0 ? " hof-cash-out" : ""}">${esc(money(plan.totals.remaining))}</td><td>${next}</td><td>${badge(label, tone)}${plan.totals.overdueCount ? `<small>${plan.totals.overdueCount} taksit · ${esc(money(plan.totals.overdue))}</small>` : ""}</td></tr>`;
    };
    HOF.swap(root, `<div class="hof-cash-bar"><div class="hof-tabs" role="group" aria-label="Durum">${STATUS_TABS.map(item => `<button type="button" data-status="${item.id}" aria-pressed="${String(item.id === view.status)}">${item.label}</button>`).join("")}</div>
      <div class="hof-cash-add">${manage ? `<button type="button" class="hof-button hof-button-small" data-act="new">+ Yeni Kart</button>${canBulk() ? '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="bulk" title="Carileri seçip her birine aynı planla taksit kartı açın">+ Toplu Taksitlendir</button>' : ""}<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="import" title="Excel dosyasından ya da Google Sheets’ten kartları ve grupları tek seferde oluştur">Excel / Sheets’ten Yükle</button><button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="transfer" title="Ana tabloya yüklenen verideki ödeme planlarını (ay kolonları, taksit kolonları) gerçek vadeleriyle kartlara aktar">Tablodan Aktar</button><button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="groups">Gruplar</button>` : ""}</div></div>
      <div class="hof-plans-filters"><input type="search" data-filter="q" value="${esc(view.q)}" placeholder="Ad, telefon, sıra no, not ara…" aria-label="Ara">${groupOptions()}${canBulk() ? `<button type="button" class="hof-button hof-button-small hof-button-ghost hof-plan-pick" data-act="pick" title="Seçili gruptaki carileri listele, seçip toplu taksitlendir">${PEOPLE_ICON}Cari Seç</button>` : ""}<select data-filter="sort" aria-label="Sıralama">${SORT_OPTIONS.map(([id, label]) => `<option value="${id}" ${id === view.sort ? "selected" : ""}>${label}</option>`).join("")}</select>${outputButtons(listPdfUrl(), "list", "Liste - PDF")}</div>
      <div class="hof-kpis hof-plans-kpis" data-kpis>${data ? `<div class="hof-cash-balance"><strong>${esc(money(data.totals.remaining))}</strong><span>Kalan Alacak · ${data.totals.count} kart</span></div><div class="${data.totals.overdueCount ? "is-late" : ""}"><strong>${esc(money(data.totals.overdue))}</strong><span>Geciken · ${data.totals.overdueCount} taksit</span></div><div><strong>${esc(money(data.totals.month))}</strong><span>Bu Ay Beklenen</span></div><div><strong>${esc(money(data.totals.paid))}</strong><span>Tahsil Edilen</span></div>` : ""}</div>
      ${groupHint(data)}
      <div class="hof-cash-list hof-plans-list" data-list>${
        !data
          ? HOF.listPending(view.listError)
          : data.plans.length
            ? `<table class="hof-table hof-cash-table hof-plans-table"><thead><tr><th class="hof-plan-no">No</th><th>Kart</th><th class="num">Toplam</th><th class="num">Ödenen</th><th class="num">Kalan</th><th>Sıradaki Vade</th><th>Durum</th></tr></thead><tbody>${data.plans.map(row).join("")}</tbody></table>`
            : emptyList(filtered, manage)
      }</div>
      <p class="hof-edit-meta">Satıra tıklayınca kart açılır. PDF ve Yazdır ekrandaki süzgeç ve sıralamayla hazırlanır. Kartın üstüne girilen tahsilatlar Kasa’ya düşer; vadesi gelen taksit tahsilat takviminde ve bildirimlerde görünür.</p>
      <div class="hof-actions"><button type="button" class="hof-button" data-close>Kapat</button></div>`);
  }

  // ---------- Kart ----------
  // Düzen: üstte kişi (ad, sıra no, durum, grup › alt grup, telefon, açan, taksit planı) ve bilgi notu; ardından
  // göstergeler; altta süzgeçli taksit listesi ve hareketler (tahsilat, ödeme/iade). İşlem çubuğu kaydırırken üstte kalır.
  const ITEM_FILTERS = [
    ["all", "Tümü", () => true],
    ["open", "Açık", item => item.remaining > 0.005],
    ["overdue", "Geciken", item => item.state === "overdue"],
    ["paid", "Ödenen", item => item.state === "paid"],
  ];
  const ENTRY_FILTERS = [
    ["all", "Tümü", () => true],
    ["in", "Tahsilat", entry => entry.kind === "in"],
    ["out", "Ödeme / İade", entry => entry.kind === "out"],
  ];
  const chips = (list, rows, current, attr) =>
    `<span class="hof-plan-chips" role="group">${list.map(([id, label, test]) => `<button type="button" ${attr}="${id}" aria-pressed="${String(id === current)}">${label} <b>${rows.filter(test).length}</b></button>`).join("")}</span>`;
  function renderCard() {
    const root = body();
    const plan = view.plan;
    if (!root || !plan) return;
    const manage = plan.canManage;
    const collect = plan.canCollect;
    const active = plan.status === "active";
    const [label, tone] = STATE[plan.state] || STATE.active;
    const t = plan.totals;
    const phone = HOF.workspace?.extractPhones?.(plan.phone || "")[0] || "";
    const itemTest = (ITEM_FILTERS.find(([id]) => id === view.itemFilter) || ITEM_FILTERS[0])[2];
    const entryTest = (ENTRY_FILTERS.find(([id]) => id === view.entryFilter) || ENTRY_FILTERS[0])[2];
    const items = plan.items.filter(itemTest);
    const entries = plan.entries.filter(entryTest);
    const itemRow = item => `<tr data-item="${esc(item.id)}" class="is-${esc(item.state)}"><td>${item.seq}.</td><td>${esc(HOF.formatDate(item.dueDate))}${item.note ? `<small>${esc(item.note)}</small>` : ""}<small>${item.state === "paid" ? "" : esc(dayLabel(item.days))}</small></td><td class="num">${esc(money(item.amount))}</td><td class="num hof-cash-in">${item.paid ? esc(money(item.paid)) : ""}</td><td class="num${item.remaining > 0 ? " hof-cash-out" : ""}">${esc(money(item.remaining))}</td><td>${itemBadge(item)}</td><td class="hof-cash-actions">${collect && item.remaining > 0 && active ? `<button type="button" class="hof-mini hof-mini-pay" data-pay-item="${esc(item.id)}" title="Bu taksite tahsilat gir" aria-label="${item.seq}. taksite tahsilat gir">₺</button>` : ""}${manage ? `<button type="button" class="hof-mini" data-edit-item="${esc(item.id)}" title="Taksiti düzelt" aria-label="${item.seq}. taksiti düzelt">✎</button><button type="button" class="hof-mini hof-mini-danger" data-delete-item="${esc(item.id)}" title="Taksiti sil" aria-label="${item.seq}. taksiti sil">×</button>` : ""}</td></tr>`;
    // Açılış (devir, v2.0.8): Excel'de programa girmeden önce ödenmiş kısım; taksiti kapatır, Kasa'da yoktur, makbuzu olmaz.
    const entryRow = entry => `<tr data-entry="${esc(entry.id)}" data-kind="${esc(entry.kind)}"${entry.opening ? ' data-opening=""' : ""}><td>${esc(HOF.formatDate(entry.date))}</td><td><b>${entry.opening ? 'Açılış (devir) <span class="hof-plan-badge is-muted" title="Programa girmeden önce ödenmiş; taksiti kapatır, Kasa’ya girmez">Kasa Dışı</span>' : entry.kind === "in" ? "Tahsilat" : "Ödeme / İade"}${entry.itemId ? ` · ${esc(plan.items.find(item => item.id === entry.itemId)?.seq || "?")}. taksit` : ""}${entry.receiptNo ? ` <span class="hof-plan-receipt">Makbuz ${esc(entry.receiptNo)}</span>` : ""}${entry.chequeId ? ' <span class="hof-plan-badge is-info" title="Çek / senetle alındı; Kasa’ya evrak tahsil edilince girer">çek / senet</span>' : ""}</b><small>${esc(entry.note || "")}${entry.note ? " · " : ""}${esc(entry.actorName || "—")}${entry.updatedAt ? " · düzeltildi" : ""}</small></td><td class="num hof-cash-in">${entry.kind === "in" ? esc(money(entry.amount)) : ""}</td><td class="num hof-cash-out">${entry.kind === "out" ? esc(money(entry.amount)) : ""}</td><td class="hof-cash-actions">${entry.opening ? "" : `<a class="hof-mini hof-mini-text" href="/api/workspace/plans/${encodeURIComponent(plan.id)}/entries/${encodeURIComponent(entry.id)}/makbuz.pdf" target="_blank" rel="noopener" title="Makbuz (PDF)" aria-label="Makbuz">Makbuz</a>`}${entry.chequeId && HOF.can("cheques.view") ? `<button type="button" class="hof-mini" data-open-cheque="${esc(entry.chequeId)}" title="Çek / senet kartını aç (karşılıksız, geri al buradan)" aria-label="Çek / senet kartını aç">↗</button>` : ""}${entry.editable ? `<button type="button" class="hof-mini" data-edit-entry="${esc(entry.id)}" title="Düzelt" aria-label="Düzelt">✎</button><button type="button" class="hof-mini hof-mini-danger" data-delete-entry="${esc(entry.id)}" title="Sil" aria-label="Sil">×</button>` : ""}</td></tr>`;
    const planWarning = Math.abs(t.unplanned) > 0.005 && plan.items.length ? `<p class="hof-alert">Taksitlerin toplamı (${esc(money(t.planned))}) kartın toplam tutarından (${esc(money(t.total))}) ${t.unplanned > 0 ? "az" : "fazla"}: fark ${esc(money(Math.abs(t.unplanned)))}. Taksitleri düzeltin ya da toplam tutarı güncelleyin.</p>` : "";
    const noItems = !plan.items.length ? `<p class="hof-empty">Bu kartta taksit yok. ${manage ? "<b>Otomatik Dağıt</b> ile toplamı eşit taksitlere bölün ya da <b>+ Taksit</b> ile tek tek girin." : ""}${t.paid ? ` Girilen tahsilatlar kalan tutardan düşülür (kalan ${esc(money(t.remaining))}).` : ""}</p>` : '<p class="hof-empty">Bu süzgeçte taksit yok.</p>';
    const span = plan.items.length ? `${plan.items.length} taksit · ${HOF.formatDate(plan.items[0].dueDate)} – ${HOF.formatDate(plan.items.at(-1).dueDate)}` : "Taksit kurulmadı";
    const share = t.total > 0 ? Math.max(0, Math.min(100, Math.round((t.paid / t.total) * 100))) : 0;
    const sums = entries.reduce((sum, entry) => ({ in: sum.in + (entry.kind === "in" ? entry.amount : 0), out: sum.out + (entry.kind === "out" ? entry.amount : 0) }), { in: 0, out: 0 });
    HOF.swap(root, `<div class="hof-plan-head">
        <div class="hof-plan-headline"><button type="button" class="hof-plan-back" data-act="back" title="Listeye dön">← Liste</button>
          <div class="hof-plan-title"><h3>${plan.refNo ? `<span class="hof-plan-refno" title="Sıra No">No ${esc(plan.refNo)}</span>` : ""}${esc(plan.name)} ${badge(label, tone)}</h3><small>${esc(whereText(plan) || "Grupsuz")}${plan.phone ? ` · ${esc(plan.phone)}` : ""}</small></div></div>
        <div class="hof-plan-actions" role="toolbar" aria-label="Kart işlemleri">
          <span class="hof-plan-toolgroup">${collect && active ? '<button type="button" class="hof-button hof-button-small" data-act="pay">+ Tahsilat</button>' : ""}${manage && active ? '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="refund" title="Müşteriye yapılan ödeme ya da iade">− Ödeme / İade</button><button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="addItem">+ Taksit</button><button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="distribute" title="Toplam tutarı eşit taksitlere böler">Otomatik Dağıt</button>' : ""}</span>
          <span class="hof-plan-toolgroup">${outputButtons(cardPdfUrl(plan), "card", "Taksit Ekstresi - PDF")}${phone ? `<button type="button" class="hof-button hof-button-small hof-button-ghost hof-whatsapp" data-act="whatsapp" data-wa="${esc(phone)}">WhatsApp</button>` : ""}</span>
          ${manage ? `<span class="hof-plan-toolgroup"><button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="edit">Düzenle</button>${active ? '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="close" title="Kart kapanır; uyarı vermez, listede Kapalı altında durur">Kapat</button>' : '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-act="reopen">Yeniden Aç</button>'}<button type="button" class="hof-button hof-button-small hof-button-ghost hof-button-danger-ghost" data-act="delete">Sil</button></span>` : ""}
        </div></div>
      <section class="hof-plan-profile" aria-label="Kişi bilgileri">
        <dl class="hof-plan-facts">
          <div><dt>Sıra No</dt><dd>${esc(plan.refNo || "—")}</dd></div>
          <div><dt>Cari</dt><dd>${plan.accountId && plan.accountName ? `<a href="#" data-act="account" title="Carinin kartını aç">${esc(plan.accountName)}</a>${plan.accountRef ? ` <small>· No ${esc(plan.accountRef)}</small>` : ""}` : '<span class="hof-muted">—</span>'}</dd></div>
          <div><dt>Grup</dt><dd>${esc(plan.groupName || "—")}</dd></div>
          <div><dt>Alt Grup</dt><dd>${esc(plan.subgroupName || "—")}</dd></div>
          <div><dt>Telefon</dt><dd>${plan.phone ? `${phone ? `<a href="tel:+${esc(phone)}">${esc(plan.phone)}</a>` : esc(plan.phone)}` : "—"}</dd></div>
          <div><dt>Taksit Planı</dt><dd>${esc(span)}</dd></div>
          <div><dt>Kayıt Tarihi</dt><dd>${esc(plan.registeredOn ? HOF.formatDate(plan.registeredOn) : "—")}</dd></div>
          ${plan.invoiceId && HOF.can("invoices.view") ? `<div><dt>Fatura</dt><dd><a href="#" data-open-invoice="${esc(plan.invoiceId)}" title="Kart bu faturanın taksitlendirilen kalanıdır">${esc(plan.invoiceNumber || "Faturayı Aç")}</a></dd></div>` : ""}
          <div><dt>Tablodaki Kayıt</dt><dd>${plan.caseKey ? (foreignCase(plan) ? `${esc(plan.caseTitle || plan.caseKey)} <small class="hof-muted">· başka sayfada</small>` : orphanCase(plan) ? `${esc(plan.caseTitle || plan.caseKey)} <small class="hof-muted" title="Kayıt açık tabloda bulunamadı; silinmiş ya da yeni dosyada kimliği değişmiş olabilir.">· tabloda bulunamadı${manage ? " · Düzenle ile yeniden bağlayın" : ""}</small>` : `<a href="#" data-act="reveal" title="Kaydı tabloda aç">${esc(plan.caseTitle || plan.caseKey)}</a> <small>· Kayda git</small>`) : `<span class="hof-muted">Bağlı değil${manage ? " · Düzenle ile bağlayın" : ""}</span>`}</dd></div>
          <div><dt>Kartı Açan</dt><dd>${esc(plan.actorName || "—")} · ${esc(HOF.formatDate(plan.createdAt))}</dd></div>
        </dl>
        <div class="hof-plan-note"><h4>Bilgi Notu</h4>${plan.note ? `<p>${esc(plan.note)}</p>` : `<p class="hof-empty">Not yok.${manage ? " <b>Düzenle</b> ile adres, okul, sınıf gibi bilgileri ekleyin." : ""}</p>`}</div>
      </section>
      <div class="hof-kpis hof-plans-kpis"><div><strong>${esc(money(t.total))}</strong><span>Toplam Tutar</span></div><div><strong class="hof-cash-in">${esc(money(t.paid))}</strong><span>Tahsil Edilen · %${share}${t.paidOut ? ` · iade ${esc(money(t.paidOut))}` : ""}</span></div><div class="hof-cash-balance"><strong>${esc(money(t.remaining))}</strong><span>Kalan${t.extra ? ` · fazla ${esc(money(t.extra))}` : ""}</span></div><div class="${t.overdueCount ? "is-late" : ""}"><strong>${esc(money(t.overdue))}</strong><span>Geciken · ${t.overdueCount} taksit</span></div></div>
      <span class="hof-plan-progress hof-plan-progress-wide" aria-hidden="true"><i style="width:${share}%"></i></span>
      ${planWarning}
      <div class="hof-plan-section"><h4>Taksitler <span>${plan.items.length}</span></h4>${plan.items.length ? chips(ITEM_FILTERS, plan.items, view.itemFilter, "data-item-filter") : ""}</div>
      <div class="hof-cash-list hof-plans-items">${items.length ? `<table class="hof-table hof-cash-table hof-plan-items"><thead><tr><th>No</th><th>Vade</th><th class="num">Tutar</th><th class="num">Ödenen</th><th class="num">Kalan</th><th>Durum</th><th></th></tr></thead><tbody>${items.map(itemRow).join("")}</tbody><tfoot><tr><td></td><td>Toplam</td><td class="num">${esc(money(items.reduce((sum, item) => sum + item.amount, 0)))}</td><td class="num hof-cash-in">${esc(money(items.reduce((sum, item) => sum + item.paid, 0)))}</td><td class="num hof-cash-out">${esc(money(items.reduce((sum, item) => sum + item.remaining, 0)))}</td><td colspan="2"></td></tr></tfoot></table>` : noItems}</div>
      <div class="hof-plan-section"><h4>Hareketler <span>${plan.entries.length}</span></h4>${plan.entries.length ? chips(ENTRY_FILTERS, plan.entries, view.entryFilter, "data-entry-filter") : ""}</div>
      <div class="hof-cash-list hof-plans-entries">${entries.length ? `<table class="hof-table hof-cash-table"><thead><tr><th>Tarih</th><th>İşlem</th><th class="num">Tahsilat</th><th class="num">Ödeme</th><th></th></tr></thead><tbody>${entries.map(entryRow).join("")}</tbody><tfoot><tr><td></td><td>Toplam</td><td class="num hof-cash-in">${esc(money(sums.in))}</td><td class="num hof-cash-out">${esc(money(sums.out))}</td><td></td></tr></tfoot></table>` : plan.entries.length ? '<p class="hof-empty">Bu süzgeçte hareket yok.</p>' : '<p class="hof-empty">Henüz hareket yok. Tahsilat girildiğinde burada ve Kasa’da görünür; her tahsilatın makbuzu PDF olarak alınır.</p>'}</div>
      <div class="hof-actions"><button type="button" class="hof-button hof-button-ghost" data-act="back">Listeye Dön</button><button type="button" class="hof-button" data-close>Kapat</button></div>`);
  }

  // ---------- Formlar ----------
  // Grup alanları (taksit kartı ve cari aynı grupları kullanır; v2.0.6'da genelleşti).
  const groupFieldsFor = (groups, plan = {}) => {
    const subgroups = plan.groupId ? groups.find(item => item.id === plan.groupId)?.subgroups || [] : [];
    return [
      { name: "groupId", label: "Grup", type: "select", value: plan.groupId || "", options: [{ value: "", label: "— Grupsuz —" }, ...groups.map(item => ({ value: item.id, label: item.name })), { value: "\u0001yeni", label: "+ Yeni Grup Yaz…" }], help: "Ör. servis plakası, site adı, sınıf. Gruplar penceresinden de yönetilir." },
      { name: "groupName", label: "Yeni Grup Adı", placeholder: "Ör. 42 C 1070", maxlength: 80 },
      { name: "subgroupId", label: "Alt Grup", type: "select", value: plan.subgroupId || "", options: [{ value: "", label: "— Yok —" }, ...subgroups.map(item => ({ value: item.id, label: item.name })), { value: "\u0001yeni", label: "+ Yeni Alt Grup Yaz…" }], help: "Ör. güzergâh, blok, şube." },
      { name: "subgroupName", label: "Yeni Alt Grup Adı", placeholder: "Ör. 15 Temmuz", maxlength: 80 },
    ];
  };
  const groupFields = (plan = {}) => groupFieldsFor(view.groups, plan);
  // Grup seçimi değişince alt grup listesi yenilenir; "Yeni … yaz" seçilince ad kutusu görünür.
  const wireGroupFields = (dialog, groups = view.groups) => {
    const groupSelect = dialog.querySelector('select[name="groupId"]');
    const subSelect = dialog.querySelector('select[name="subgroupId"]');
    const groupName = dialog.querySelector('input[name="groupName"]').closest(".hof-field");
    const subName = dialog.querySelector('input[name="subgroupName"]').closest(".hof-field");
    const sync = () => {
      groupName.hidden = groupSelect.value !== "\u0001yeni";
      const group = groups.find(item => item.id === groupSelect.value);
      const subs = group ? group.subgroups : [];
      const current = subSelect.value;
      subSelect.innerHTML = `<option value="">— Yok —</option>${subs.map(item => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join("")}<option value="\u0001yeni">+ Yeni Alt Grup Yaz…</option>`;
      subSelect.value = [...subSelect.options].some(option => option.value === current) ? current : "";
      subSelect.disabled = !groupSelect.value;
      subName.hidden = subSelect.value !== "\u0001yeni";
    };
    groupSelect.addEventListener("change", sync);
    subSelect.addEventListener("change", () => (subName.hidden = subSelect.value !== "\u0001yeni"));
    sync();
  };
  const groupBody = data => ({
    groupId: data.groupId === "\u0001yeni" ? "" : data.groupId,
    groupName: data.groupId === "\u0001yeni" ? data.groupName : "",
    subgroupId: data.subgroupId === "\u0001yeni" ? "" : data.subgroupId,
    subgroupName: data.subgroupId === "\u0001yeni" ? data.subgroupName : "",
  });

  // preset (v2.0.6): kişinin kartından "taksit planı oluştur" ile gelince kayıt bağı, ad ve telefon hazır gelir.
  function editPlan(plan, preset = null) {
    const link = { caseKey: plan?.caseKey || preset?.caseKey || "", caseSource: plan?.caseSource || preset?.caseSource || "", caseTitle: plan?.caseTitle || preset?.caseTitle || "" };
    // Cari (v2.0.6): kart bir cariye aittir. Seçilmezse kart açılırken bu ad ve telefonla yeni cari açılır.
    const owner = { id: plan?.accountId || preset?.accountId || "", name: plan?.accountName || preset?.accountName || "" };
    // Borcun kaynağı alanı yalnız borcu olan cari seçiliyken görünür; mevcut borç seçilince tutar borçla dolar.
    let lastAccount = null;
    const syncSource = (account, byUser = false) => {
      lastAccount = account;
      const form = document.querySelector(".hof-modal-backdrop.is-visible:last-of-type form") || document;
      const select = form.querySelector('select[name="source"]');
      if (!select) return;
      const field = select.closest(".hof-field");
      const balance = Number(account?.balance) || 0;
      field.hidden = !(balance > 0.005);
      if (!(balance > 0.005)) {
        select.value = "new";
        return;
      }
      if (!byUser) select.value = "balance";
      const help = field.querySelector("small") || field.appendChild(HOF.el("small", {}));
      help.textContent = select.value === "balance" ? `Carinin borcu ${money(balance)}. Kart bu borcu vadelere böler; carinin defterine ikinci kez borç yazılmaz.` : "Kart tutarı carinin borcuna eklenir (bu kartla yapılan yeni satış ya da hizmet).";
      const total = form.querySelector('input[name="total"]');
      if (select.value === "balance" && total && (!total.value.trim() || byUser)) total.value = amountText(balance);
    };
    HOF.formModal({
      title: plan ? "Kartı Düzenle" : "Yeni Taksit Kartı",
      eyebrow: "TAKSİTLER",
      size: "wide",
      intro: plan ? "" : "Önce kişi ve toplam tutar kaydedilir. Taksitler istenirse sonra kartın üstünden dağıtılır ya da tek tek girilir.",
      fields: [
        { name: "name", label: "Ad Soyad / Kurum", required: true, maxlength: 160, value: plan?.name || preset?.name || "", autofocus: !preset },
        { name: "refNo", label: "Sıra No", maxlength: 30, value: plan?.refNo || "", placeholder: plan ? "" : "Boş bırakılırsa sıradaki numara", help: plan ? "" : "Listede ilk kolon ve varsayılan sıralama." },
        { name: "registeredOn", label: "Kayıt Tarihi", type: "date", required: true, max: "today", value: plan?.registeredOn || preset?.registeredOn || todayIso(), help: plan ? "Kişinin kayıt tarihi (cari kartındakiyle aynı)." : "Kişinin kayıt tarihi: cari seçilince carinin tarihi gelir; carisi yoksa bugün." },
        { name: "phone", label: "Telefon", type: "tel", inputmode: "tel", maxlength: 60, value: plan?.phone || preset?.phone || "", placeholder: "05xx xxx xx xx" },
        // v2.0.13: carinin borcu varsa kart ya o borcu taksitlendirir (ikinci kez borç yazmaz) ya da yeni borç açar.
        // Markette "veresiye sat → taksitlendir" akışı artık alacağı ikiye katlamaz.
        ...(plan
          ? []
          : [{ name: "source", label: "Borcun Kaynağı", type: "select", value: Number(preset?.balance) > 0.005 ? "balance" : "new", options: [{ value: "balance", label: "Carinin Mevcut Borcu (veresiye satış, açılış)" }, { value: "new", label: "Yeni Borç (bu kartla borçlanır)" }], help: "" }]),
        { name: "total", label: "Toplam Tutar (₺)", required: true, inputmode: "decimal", value: plan ? amountText(plan.total) : Number(preset?.balance) > 0.005 ? amountText(preset.balance) : "", placeholder: "Örn. 12.000,00", autofocus: Boolean(preset) },
        // v2.0.12: taksit bilgileri tutarın hemen altında; Taksit Sayısı ile İlk Vade yan yana (müşteri: "ilk vade aşağıda kalıyor").
        ...(plan
          ? []
          : [
              { name: "items", label: "Taksitler", type: "select", value: "auto", options: [{ value: "auto", label: "Toplamı eşit taksitlere böl (sayı ve ilk vade)" }, { value: "manual", label: "Elle gireceğim (kart açılınca tek tek)" }, { value: "none", label: "Şimdilik yok" }], help: "Elle girişte her taksitin vadesi ve tutarı sizin yazdığınız gibi olur." },
              { name: "count", label: "Taksit Sayısı", inputmode: "numeric", value: "" },
              { name: "firstDue", label: "İlk Vade", type: "date", value: "" },
            ]),
        ...groupFields(plan || { groupId: preset?.groupId || "", subgroupId: preset?.subgroupId || "" }),
        { name: "note", label: "Bilgi Notu", type: "textarea", rows: 3, maxlength: 1000, value: plan?.note || "", placeholder: "Adres, okul, sınıf, özel durum…" },
      ],
      submitLabel: plan ? "Kaydet" : "Kartı Aç",
      onOpen: dialog => {
        dialog.classList.add("hof-plan-form");
        const dayInput = dialog.querySelector('input[name="registeredOn"]');
        dayInput?.addEventListener("input", () => (dayInput.dataset.touched = "1"));
        const picker = HOF.el("div", { class: "hof-field hof-case-picker" }, pickerHtml(link));
        dialog.querySelector('input[name="name"]').closest(".hof-field").after(picker);
        wirePicker(picker);
        const accountField = HOF.accounts?.picker?.({
          value: owner,
          label: "Cari",
          help: owner.id ? "Kart bu cariye ait; taksitleri ve tahsilatları carinin defterinde görünür." : "Kişinin carisi varsa seçin. Seçmezseniz aynı ad ve telefonlu cari varsa o kullanılır, yoksa bu adla yeni cari açılır.",
          onPick: account => {
            const form = dialog.querySelector("form");
            const name = form.querySelector('input[name="name"]');
            const phone = form.querySelector('input[name="phone"]');
            if (account && !name.value.trim()) name.value = account.name;
            if (account && !phone.value.trim()) phone.value = account.phone || "";
            // v2.0.12: kişi bir kez kaydolur — kartın Kayıt Tarihi carinin tarihidir (kullanıcı elle değiştirmediyse).
            const day = form.querySelector('input[name="registeredOn"]');
            if (day && !day.dataset.touched) day.value = (account && account.registeredOn) || preset?.registeredOn || todayIso();
            // Cari bir gruptaysa ve formda grup seçilmediyse kart carinin grubuna açılır.
            const group = form.querySelector('select[name="groupId"]');
            if (account?.groupId && group && !group.value && [...group.options].some(option => option.value === account.groupId)) {
              group.value = account.groupId;
              group.dispatchEvent(new Event("change", { bubbles: true }));
              const sub = form.querySelector('select[name="subgroupId"]');
              if (account.subgroupId && sub && [...sub.options].some(option => option.value === account.subgroupId)) sub.value = account.subgroupId;
            }
            // Cari kayda bağlıysa kart da o kayda bağlanır.
            if (account?.caseKey && !form.querySelector('input[name="caseKey"]').value) {
              form.querySelector('input[name="caseKey"]').value = account.caseKey;
              form.querySelector('input[name="caseSource"]').value = account.caseSource || "";
              form.querySelector('input[name="caseTitle"]').value = account.caseTitle || account.name;
              const box = form.querySelector(".hof-case-picker:not(.hof-acc-picker)");
              box?.classList.add("is-linked");
              const unlink = box?.querySelector("[data-unlink]");
              if (unlink) unlink.hidden = false;
            }
            suggestedAccount = "";
            syncSource(account);
          },
        });
        if (accountField) dialog.querySelector('input[name="name"]').closest(".hof-field").before(accountField);
        // v2.0.7: ad yazılınca aynı adlı tek cari varsa öneri olarak seçilir (× ile kaldırılır); iki aynı ad varsa seçilmez.
        let suggestedAccount = "";
        if (accountField && !owner.id) {
          const nameInput = dialog.querySelector('input[name="name"]');
          const hiddenId = accountField.querySelector('input[name="accountId"]');
          const note = accountField.querySelector("small");
          let timer = 0;
          const suggest = () => {
            clearTimeout(timer);
            if (hiddenId.value && hiddenId.value !== suggestedAccount) return;
            const wanted = HOF.normalize(nameInput.value);
            timer = setTimeout(async () => {
              let hits = [];
              try {
                hits = wanted ? (await HOF.api(`/api/workspace/accounts/search?q=${encodeURIComponent(nameInput.value.trim())}`)).filter(item => HOF.normalize(item.name) === wanted) : [];
              } catch {
                hits = [];
              }
              if (HOF.normalize(nameInput.value) !== wanted) return;
              if (hits.length === 1) {
                suggestedAccount = hits[0].id;
                accountField.setAccount(hits[0]);
                note.textContent = "Aynı adlı cari bulundu ve seçildi; kart bu cariye açılır. Başka kişiyse × ile kaldırın.";
              } else if (suggestedAccount) {
                suggestedAccount = "";
                accountField.setAccount(null);
                note.textContent = hits.length > 1 ? "Aynı adlı birden fazla cari var; doğru olanı seçin." : "Kişinin carisi varsa seçin. Seçmezseniz aynı ad ve telefonlu cari varsa o kullanılır, yoksa bu adla yeni cari açılır.";
              } else if (hits.length > 1) note.textContent = "Aynı adlı birden fazla cari var; doğru olanı seçin.";
            }, 220);
          };
          nameInput.addEventListener("input", suggest);
          if (nameInput.value.trim()) suggest();
        }
        wireGroupFields(dialog);
        syncSource(owner.id ? { balance: preset?.balance } : null);
        dialog.querySelector('select[name="source"]')?.addEventListener("change", () => syncSource(lastAccount, true));
        const items = dialog.querySelector('select[name="items"]');
        if (items) {
          const count = dialog.querySelector('input[name="count"]').closest(".hof-field");
          const first = dialog.querySelector('input[name="firstDue"]').closest(".hof-field");
          const sync = () => {
            count.hidden = items.value !== "auto";
            first.hidden = items.value !== "auto";
          };
          items.addEventListener("change", sync);
          sync();
        }
      },
      onSubmit: async data => {
        const payload = { name: data.name, refNo: data.refNo, registeredOn: data.registeredOn, phone: data.phone, total: data.total, note: data.note, caseKey: data.caseKey || "", caseSource: data.caseSource || "", caseTitle: data.caseKey ? data.caseTitle : "", ...(data.accountId !== undefined ? { accountId: data.accountId } : {}), ...groupBody(data) };
        if (!plan && data.source === "balance") payload.coversBalance = true;
        if (!plan && data.items === "auto") {
          if (!(Number(data.count) > 0)) throw new Error("Eşit bölmek için taksit sayısını yazın.");
          if (!data.firstDue) throw new Error("Eşit bölmek için ilk vadeyi seçin.");
          Object.assign(payload, { mode: "auto", count: data.count, firstDue: data.firstDue });
        }
        const result = plan ? await HOF.api(`/api/workspace/plans/${encodeURIComponent(plan.id)}`, { method: "PUT", body: payload }) : await HOF.api("/api/workspace/plans", { method: "POST", body: payload });
        await loadGroups();
        HOF.toast(plan ? "Kart güncellendi." : data.items === "manual" ? "Taksit kartı açıldı; şimdi taksitleri tek tek girin." : "Taksit kartı açıldı.", { type: "success" });
        view.planId = result.id;
        view.mode = "card";
        applyPlan(result);
        // Elle giriş: kart açılır açılmaz ilk taksit formu gelir; sonrakiler "+ Taksit" ile.
        if (!plan && data.items === "manual") setTimeout(() => editItem(result, null), 250);
      },
    });
  }

  function distributePlan(plan) {
    const hasEntries = plan.entries.length > 0;
    HOF.formModal({
      title: "Otomatik Dağıt",
      eyebrow: plan.name,
      intro: `Toplam tutar eşit taksitlere bölünür; her ay aynı gün, kuruş farkı son taksitte.${plan.items.length ? " <b>Mevcut taksitler silinir</b>; girilen tahsilatlar yeni taksitlere en eski vadeden başlayarak sayılır." : ""}`,
      fields: [
        { name: "total", label: "Toplam Tutar (₺)", required: true, inputmode: "decimal", value: amountText(plan.total) },
        { name: "count", label: "Taksit Sayısı", required: true, inputmode: "numeric", value: plan.items.length ? String(plan.items.length) : "", placeholder: "Örn. 9", autofocus: true },
        { name: "firstDue", label: "İlk Vade", type: "date", required: true, value: plan.items[0]?.dueDate || todayIso() },
        { name: "everyMonths", label: "Taksit Aralığı", type: "select", value: "1", options: [{ value: "1", label: "Her Ay" }, { value: "2", label: "2 Ayda Bir" }, { value: "3", label: "3 Ayda Bir" }, { value: "6", label: "6 Ayda Bir" }, { value: "12", label: "Yılda Bir" }] },
      ],
      submitLabel: plan.items.length ? "Taksitleri Yeniden Kur" : "Taksitleri Kur",
      onSubmit: async data => {
        const result = await HOF.api(`/api/workspace/plans/${encodeURIComponent(plan.id)}/distribute`, { method: "POST", body: data });
        HOF.toast(`${result.items.length} taksit kuruldu.${hasEntries ? " Tahsilatlar yeniden eşlendi." : ""}`, { type: "success" });
        applyPlan(result);
      },
    });
  }

  function editItem(plan, item) {
    HOF.formModal({
      title: item ? `${item.seq}. taksiti düzelt` : "Taksit Ekle",
      eyebrow: plan.name,
      fields: [
        { name: "dueDate", label: "Vade", type: "date", required: true, value: item?.dueDate || (plan.items.length ? nextMonth(plan.items.at(-1).dueDate) : todayIso()) },
        { name: "amount", label: "Tutar (₺)", required: true, inputmode: "decimal", value: item ? amountText(item.amount) : "", autofocus: true },
        { name: "note", label: "Açıklama", maxlength: 200, value: item?.note || "", placeholder: "İsteğe bağlı (ör. servis farkı)" },
      ],
      submitLabel: item ? "Kaydet" : "Taksiti Ekle",
      onSubmit: async data => {
        const url = `/api/workspace/plans/${encodeURIComponent(plan.id)}/items${item ? `/${encodeURIComponent(item.id)}` : ""}`;
        const result = await HOF.api(url, { method: item ? "PUT" : "POST", body: data });
        HOF.toast(item ? "Taksit düzeltildi." : "Taksit eklendi.", { type: "success" });
        applyPlan(result);
      },
    });
  }
  const nextMonth = iso => {
    const [y, m, d] = iso.split("-").map(Number);
    const date = new Date(Date.UTC(y, m, 1));
    const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(Math.min(d, last))}`;
  };

  // kind: "in" (tahsilat) | "out" (ödeme/iade). item: taksite bağlı tahsilat. entry: düzeltme.
  function editEntry(plan, { kind = "in", item = null, entry = null, amount = null } = {}) {
    const incoming = (entry?.kind || kind) === "in";
    const openItems = plan.items.filter(row => row.remaining > 0.005 || row.id === entry?.itemId);
    const suggested = entry ? amountText(entry.amount) : amount ? amountText(amount) : item ? amountText(item.remaining) : plan.next ? amountText(plan.next.remaining) : "";
    HOF.formModal({
      title: entry ? (incoming ? "Tahsilatı Düzelt" : "Ödemeyi Düzelt") : incoming ? "Tahsilat Gir" : "Ödeme / İade Gir",
      eyebrow: plan.name,
      intro: incoming
        ? `Kalan ${money(plan.totals.remaining)}${plan.next ? ` · sıradaki ${plan.next.seq}. taksit ${money(plan.next.remaining)} (${dayLabel(plan.next.days)})` : ""}. Tutar seçilen yola (nakit kasa, banka, kredi kartı) tahsilat olarak düşer; çekle/senetle ödemede Çek / Senet Al’da “Taksite Say”ı seçin. Makbuz PDF’i hareketler listesinden alınır.`
        : "Müşteriye geri verilen ya da onun adına yapılan ödeme. Kasa’dan düşer ve kartın ödenen tutarını azaltır.",
      fields: [
        { name: "amount", label: "Tutar (₺)", required: true, inputmode: "decimal", value: suggested, autofocus: true },
        { name: "date", label: "Tarih", type: "date", required: true, max: "today", value: entry?.date || todayIso() },
        // v2.0.13: tahsilat / ödeme yolu (Nakit, Havale / EFT, Kredi Kartı). Çekle/senetle ödeme Çek / Senet Al'dan "Taksite Say" ile.
        HOF.methodField(entry?.method || "cash", { incoming }),
        ...(incoming ? [{ name: "itemId", label: "Hangi Taksite", type: "select", value: entry?.itemId || item?.id || "", options: [{ value: "", label: "En Eski Açık Taksite (önerilen)" }, ...openItems.map(row => ({ value: row.id, label: `${row.seq}. taksit · ${HOF.formatDate(row.dueDate)} · kalan ${money(row.remaining)}` }))] }] : []),
        { name: "note", label: "Açıklama", maxlength: 300, value: entry?.note || "", placeholder: incoming ? "Ör. Ekim taksidi" : "Ne için", list: incoming ? [] : ["İade", "Fazla Alınan", "İndirim"] },
      ],
      submitLabel: entry ? "Kaydet" : incoming ? "Tahsilatı Kaydet" : "Ödemeyi Kaydet",
      onSubmit: async data => {
        const url = `/api/workspace/plans/${encodeURIComponent(plan.id)}/entries${entry ? `/${encodeURIComponent(entry.id)}` : ""}`;
        const result = await HOF.api(url, { method: entry ? "PUT" : "POST", body: { ...data, kind: entry?.kind || kind } });
        HOF.toast(entry ? "Hareket düzeltildi." : incoming ? `Tahsilat kaydedildi. Kalan ${money(result.totals.remaining)}.` : "Ödeme kaydedildi.", {
          type: "success",
          action: !entry && incoming && result.entryId ? { label: "Makbuz", onClick: () => window.open(`/api/workspace/plans/${encodeURIComponent(plan.id)}/entries/${encodeURIComponent(result.entryId)}/makbuz.pdf`, "_blank", "noopener") } : undefined,
        });
        applyPlan(result);
        HOF.emit("payment-saved", { planId: plan.id, caseKey: result.caseKey || plan.caseKey || "" });
      },
    });
  }

  async function deleteEntry(plan, entry) {
    const ok = await HOF.confirm({ title: "Hareketi Sil", message: `${money(entry.amount)} tutarındaki ${entry.kind === "in" ? "tahsilat" : "ödeme"} silinecek; Kasa ve kart yeniden hesaplanır. Yönetim panelindeki Silinenler’den geri yüklenebilir.`, confirmLabel: "Sil", danger: true });
    if (!ok) return;
    try {
      applyPlan(await HOF.api(`/api/workspace/plans/${encodeURIComponent(plan.id)}/entries/${encodeURIComponent(entry.id)}`, { method: "DELETE" }));
      HOF.toast("Hareket silindi.", { type: "success" });
    } catch (error) {
      HOF.toastError(error);
    }
  }
  async function deleteItem(plan, item) {
    const ok = await HOF.confirm({ title: "Taksiti Sil", message: `${item.seq}. taksit (${money(item.amount)}, vade ${HOF.formatDate(item.dueDate)}) silinecek. Ona bağlı tahsilatlar en eski açık taksite sayılır.`, confirmLabel: "Sil", danger: true });
    if (!ok) return;
    try {
      applyPlan(await HOF.api(`/api/workspace/plans/${encodeURIComponent(plan.id)}/items/${encodeURIComponent(item.id)}`, { method: "DELETE" }));
    } catch (error) {
      HOF.toastError(error);
    }
  }
  async function deletePlan(plan) {
    const ok = await HOF.confirm({ title: "Kartı Sil", message: `“${plan.name}” kartı taksitleri ve hareketleriyle silinecek; hareketleri Kasa’dan düşer. Yönetim panelindeki Silinenler’den geri yüklenebilir.`, confirmLabel: "Kartı Sil", danger: true });
    if (!ok) return;
    try {
      await HOF.api(`/api/workspace/plans/${encodeURIComponent(plan.id)}`, { method: "DELETE" });
      HOF.toast("Kart silindi.", { type: "success" });
      view.mode = "list";
      view.planId = "";
      renderList();
      await loadGroups();
      loadList();
      HOF.dues?.reloadSoon?.(300);
    } catch (error) {
      HOF.toastError(error);
    }
  }
  async function setStatus(plan, status) {
    try {
      applyPlan(await HOF.api(`/api/workspace/plans/${encodeURIComponent(plan.id)}`, { method: "PUT", body: { status } }));
      HOF.toast(status === "closed" ? "Kart kapatıldı; uyarı vermez." : "Kart yeniden açıldı.", { type: "success" });
    } catch (error) {
      HOF.toastError(error);
    }
  }

  // ---------- Gruplar ----------
  function openGroups() {
    const groupsModal = HOF.modal({
      title: "Gruplar ve Alt Gruplar",
      eyebrow: "TAKSİTLER",
      body: '<p class="hof-modal-text">Grup: servis plakası, site, sınıf gibi ana başlık. Alt grup: güzergâh, blok, şube. Kartlar gruba ve alt gruba göre süzülür.</p><div class="hof-groups" data-groups></div><form class="hof-groups-add" data-add-group><input type="text" name="name" maxlength="80" placeholder="Yeni grup adı (ör. 42 C 1070)" aria-label="Yeni grup adı" required><button type="submit" class="hof-button hof-button-small">+ Grup Ekle</button></form><div class="hof-actions"><button type="button" class="hof-button" data-close>Kapat</button></div>',
    });
    const render = () => {
      const host = groupsModal.dialog.querySelector("[data-groups]");
      host.innerHTML = view.groups.length
        ? view.groups.map(group => `<section class="hof-group"><header><b>${esc(group.name)}</b><small>${group.count} kart</small><span><button type="button" class="hof-mini" data-rename="${esc(group.id)}" title="Adı değiştir" aria-label="Adı değiştir">✎</button><button type="button" class="hof-mini hof-mini-danger" data-remove="${esc(group.id)}" title="Sil" aria-label="Sil">×</button></span></header>
            <ul>${group.subgroups.map(sub => `<li><span>${esc(sub.name)}</span><small>${sub.count} kart</small><span><button type="button" class="hof-mini" data-rename="${esc(sub.id)}" title="Adı değiştir" aria-label="Adı değiştir">✎</button><button type="button" class="hof-mini hof-mini-danger" data-remove="${esc(sub.id)}" title="Sil" aria-label="Sil">×</button></span></li>`).join("")}</ul>
            <form class="hof-groups-add" data-add-sub="${esc(group.id)}"><input type="text" name="name" maxlength="80" placeholder="Alt grup (ör. 15 Temmuz)" aria-label="Yeni alt grup adı" required><button type="submit" class="hof-button hof-button-small hof-button-ghost">+ Alt Grup</button></form></section>`).join("")
        : '<p class="hof-empty">Henüz grup yok.</p>';
    };
    const findGroup = id => {
      for (const group of view.groups) {
        if (group.id === id) return { ...group, parent: null };
        const sub = group.subgroups.find(item => item.id === id);
        if (sub) return { ...sub, parent: group };
      }
      return null;
    };
    const refresh = async result => {
      view.groups = result?.groups || (await HOF.api("/api/workspace/plans/groups"));
      render();
      if (view.mode === "list") {
        renderList();
        loadList();
      }
    };
    groupsModal.dialog.addEventListener("submit", async event => {
      const form = event.target.closest("form[data-add-group], form[data-add-sub]");
      if (!form) return;
      event.preventDefault();
      const name = form.querySelector("input").value.trim();
      if (!name) return;
      try {
        await refresh(await HOF.api("/api/workspace/plans/groups", { method: "POST", body: { name, parentId: form.dataset.addSub || "" } }));
        form.reset();
      } catch (error) {
        HOF.toastError(error);
      }
    });
    groupsModal.dialog.addEventListener("click", async event => {
      const button = event.target.closest("[data-rename], [data-remove], [data-close]");
      if (!button) return;
      if ("close" in button.dataset) return groupsModal.close();
      const target = findGroup(button.dataset.rename || button.dataset.remove);
      if (!target) return;
      if (button.dataset.rename) {
        HOF.formModal({
          title: target.parent ? "Alt Grubun Adı" : "Grubun Adı",
          eyebrow: target.parent ? target.parent.name : "TAKSİTLER",
          fields: [{ name: "name", label: "Ad", required: true, maxlength: 80, value: target.name, autofocus: true }],
          onSubmit: async data => refresh(await HOF.api(`/api/workspace/plans/groups/${encodeURIComponent(target.id)}`, { method: "PUT", body: data })),
        });
        return;
      }
      const ok = await HOF.confirm({ title: target.parent ? "Alt Grubu Sil" : "Grubu Sil", message: `“${target.name}” silinecek. İçinde kart varsa silinemez; önce kartları taşıyın.`, confirmLabel: "Sil", danger: true });
      if (!ok) return;
      try {
        await refresh(await HOF.api(`/api/workspace/plans/groups/${encodeURIComponent(target.id)}`, { method: "DELETE" }));
      } catch (error) {
        HOF.toastError(error);
      }
    });
    render();
  }

  // ---------- Excel'den ilk yükleme ----------
  const parseInWorker = file =>
    new Promise((resolve, reject) => {
      let worker;
      try {
        worker = new Worker("/assets/hof-excel-worker.js", { type: "module" });
      } catch {
        reject(new Error("Tarayıcınız Excel okumayı desteklemiyor. Chrome veya Edge'in güncel sürümünü kullanın."));
        return;
      }
      const timer = setTimeout(() => {
        worker.terminate();
        reject(new Error("Excel dosyası 90 saniyede okunamadı."));
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
        reject(new Error(event.message || "Excel dosyası okunamadı. XLSX, XLS veya CSV dosyası seçin."));
      };
      file.arrayBuffer().then(buffer => worker.postMessage({ buffer, name: file.name }, [buffer]), reject);
    });

  // Toplu yükleme kaynağı (v2.0.6): Excel dosyası ya da Google Sheets bağlantısı. Sonuç tek sayfanın hücre matrisidir;
  // Cari, Stok ve Taksitler aynı eşleme ekranına geçer. Binlerce satır tek seferde gelir.
  const SHEET_ICON = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 9h16M4 15h16M10 3v18"/></svg>';
  function chooseSheet({ title = "Toplu yükleme", eyebrow = "", hint = "" } = {}) {
    return new Promise(resolve => {
      let settled = false;
      const modal = HOF.modal({
        title,
        eyebrow: eyebrow || "TOPLU YÜKLEME",
        body: `${hint ? `<p class="hof-modal-text">${hint}</p>` : ""}
          <div class="hof-source-choice">
            <button type="button" class="hof-source-card" data-src="excel">${SHEET_ICON}<b>Excel Dosyası</b><small>.xlsx, .xls, .csv — bilgisayarınızdan seçin</small></button>
            <form class="hof-source-card hof-source-sheets" data-src-form><span>${SHEET_ICON}<b>Google Sheets</b></span><small>Sheet’in bağlantısını yapıştırın. Paylaş → “Bağlantıya sahip olan herkes: Görüntüleyen”.</small><input type="url" name="url" placeholder="https://docs.google.com/spreadsheets/d/…" aria-label="Google Sheets bağlantısı" autocomplete="off"><button type="submit" class="hof-button hof-button-small">Sheets’ten Oku</button></form>
          </div>
          <p class="hof-form-error" role="alert" data-src-error></p>
          <div class="hof-actions"><button type="button" class="hof-button hof-button-ghost" data-close>Vazgeç</button></div>`,
        onClose: () => {
          if (!settled) resolve(null);
        },
      });
      const error = modal.dialog.querySelector("[data-src-error]");
      const busy = on => modal.dialog.querySelectorAll("button, input").forEach(node => (node.disabled = on));
      const finish = async (fileName, sheets) => {
        const usable = sheets.filter(sheet => sheet.matrix.some(row => row.some(cell => String(cell ?? "").trim())));
        if (!usable.length) throw new Error("Dosyada dolu sayfa yok.");
        settled = true;
        modal.close();
        const sheet = usable.length === 1 ? usable[0] : await pickSheet(usable);
        resolve(sheet ? { fileName, sheetName: sheet.name, matrix: sheet.matrix } : null);
      };
      modal.dialog.addEventListener("click", event => {
        if (event.target.closest("[data-close]")) return modal.close();
        if (!event.target.closest('[data-src="excel"]')) return;
        const input = HOF.el("input", { type: "file", accept: ".xlsx,.xls,.xlsm,.csv", hidden: true });
        document.body.appendChild(input);
        input.addEventListener("change", async () => {
          const file = input.files?.[0];
          input.remove();
          if (!file) return;
          error.textContent = "";
          busy(true);
          try {
            HOF.toast(`${file.name} okunuyor…`);
            await finish(file.name, (await parseInWorker(file)).sheets);
          } catch (failure) {
            error.textContent = failure.message;
          } finally {
            busy(false);
          }
        });
        input.click();
      });
      modal.dialog.querySelector("[data-src-form]").addEventListener("submit", async event => {
        event.preventDefault();
        const url = event.target.url.value.trim();
        if (!url) {
          error.textContent = "Google Sheets bağlantısını yapıştırın.";
          return;
        }
        error.textContent = "";
        busy(true);
        try {
          const result = await HOF.api("/api/workspace/import/google-sheet", { method: "POST", body: { url } });
          await finish(result.title || "Google Sheets", result.sheets);
        } catch (failure) {
          error.textContent = failure.message;
        } finally {
          busy(false);
        }
      });
    });
  }
  const ROLE_OPTIONS = [["", "— Kullanma —"], ["seq", "Sıra No"], ["name", "Ad Soyad *"], ["registered", "Kayıt Tarihi"], ["group", "Grup (plaka, site…)"], ["subgroup", "Alt Grup (güzergâh, blok…)"], ["phone", "Telefon"], ["total", "Toplam Tutar *"], ["count", "Taksit Sayısı"], ["firstDue", "İlk Vade"], ["installment", "Taksit Tutarı"], ["paid", "Ödenen (açılış olarak düşülür)"], ["remaining", "Kalan Borç (ödenen = toplam − kalan)"], ["note", "Bilgi Notu"]];

  async function importFromExcel() {
    const source = await chooseSheet({ title: "Taksit Kartlarını Toplu Yükle", eyebrow: moduleName().toLocaleUpperCase("tr-TR"), hint: "Her satır bir taksit kartı olur. Kolonları bir sonraki adımda eşlersiniz." });
    if (!source) return;
    try {
      const preview = await HOF.api("/api/workspace/plans/import/preview", { method: "POST", body: { matrix: source.matrix } });
      mappingForm(source.fileName, { name: source.sheetName, matrix: source.matrix }, preview);
    } catch (error) {
      HOF.toastError(error);
    }
  }
  const pickSheet = sheets =>
    new Promise(resolve => {
      let picked = null;
      HOF.formModal({
        title: "Hangi sayfa?",
        eyebrow: "EXCEL’DEN YÜKLE",
        fields: [{ name: "sheet", label: "Sayfa", type: "select", value: sheets[0].name, options: sheets.map(sheet => ({ value: sheet.name, label: `${sheet.name} (${Math.max(0, sheet.matrix.filter(row => row.length).length - 1)} satır)` })) }],
        submitLabel: "Devam",
        onSubmit: data => {
          picked = sheets.find(sheet => sheet.name === data.sheet) || null;
        },
        onClose: () => resolve(picked),
      });
    });
  function mappingForm(fileName, sheet, preview) {
    const sample = sheet.matrix[preview.headerAt + 1] || [];
    HOF.formModal({
      title: "Excel’den Yükle: Kolonları Eşle",
      eyebrow: fileName,
      size: "wide",
      // v2.0.8: ay kolonları ("Eylül", "Ekim taksiti"…) ve sıralı taksit kolonları ("1. Taksit Tarihi/Tutarı") gerçek vade ve
      // tutarlarıyla okunur; Ödenen / Kalan kolonu açılış (devir) olur; kartlar açık tablodaki aynı kişiye bağlanır.
      intro: `${preview.rows} satır bulundu. Her satır bir taksit kartı olur; Sıra No kolonu kartın numarası olur, Kayıt tarihi kolonu yoksa bugün yazılır, grup ve alt grup adları tanımlanır. ${
        preview.schedule
          ? `Taksitler ${preview.schedule.shape === "months" ? "ay kolonlarından" : "sıralı taksit kolonlarından"} (${preview.schedule.columns.slice(0, 6).join(", ")}${preview.schedule.columns.length > 6 ? "…" : ""}) gerçek vade ve tutarlarıyla okunur${preview.schedule.monthMode === "payment" ? "; ay hücresindeki tutar ödenmiş sayılır" : preview.schedule.monthMode === "plan" ? "; hücredeki tutar taksit tutarıdır, “ödendi” yazan ay kapanır" : ""}.`
          : "Toplam tutar taksit sayısına eşit bölünür (ilk vadeden başlayarak, her ay aynı gün)."
      } Ödenen ya da Kalan kolonu varsa ödenmiş kısım açılış (devir) olarak yazılır: taksiti kapatır, cariye sayılır, Kasa’ya girmez. Aynı ad ve grupla açık kart varsa satır atlanır. Program başlıkları tanıdı; yanlışsa değiştirin.`,
      fields: [
        ...preview.headers.map((header, index) => ({ name: `c${index}`, label: `${header || `${index + 1}. kolon`}${sample[index] !== undefined && String(sample[index]).trim() ? ` — ör. ${String(sample[index]).slice(0, 30)}` : ""}`, type: "select", value: preview.roles[index] || "", options: ROLE_OPTIONS.map(([value, label]) => ({ value, label })), ...(preview.schedule?.columns.includes(header) ? { help: preview.schedule.shape === "months" ? "Ay kolonu: taksit olarak okunur." : "Taksit kolonu: vade/tutar olarak okunur.", readonly: true } : {}) })),
        ...(preview.schedule?.shape === "months" ? [{ name: "dueDay", label: "Ay Kolonlarındaki Taksitlerin Vade Günü", type: "select", value: "1", options: Array.from({ length: 28 }, (_, index) => ({ value: String(index + 1), label: `Ayın ${index + 1}’i` })) }] : []),
        ...(preview.schedule ? [] : [
          { name: "defaultCount", label: "Taksit sayısı yazılmayan satırlar için", inputmode: "numeric", placeholder: "Örn. 9 (boş: taksit kurulmaz)" },
          { name: "defaultFirstDue", label: "İlk vade yazılmayan satırlar için", type: "date", value: todayIso() },
        ]),
        { name: "groupName", label: "Grup kolonu yoksa hepsi bu gruba", maxlength: 80, placeholder: "İsteğe bağlı" },
        ...(preview.hasTable ? [{ name: "linkRecords", label: "Ortadaki tabloda aynı adlı (ve telefonlu) tek kayıt varsa kartı ona bağla", type: "checkbox", value: true }] : []),
      ],
      submitLabel: "Kartları Oluştur",
      onOpen: dialog => dialog.classList.add("hof-import-form"),
      onSubmit: async data => {
        const roles = {};
        preview.headers.forEach((_, index) => {
          if (data[`c${index}`]) roles[index] = data[`c${index}`];
        });
        const result = await HOF.api("/api/workspace/plans/import", { method: "POST", body: { matrix: sheet.matrix, headerAt: preview.headerAt, roles, defaultCount: data.defaultCount, defaultFirstDue: data.defaultFirstDue, dueDay: data.dueDay, groupName: data.groupName, linkRecords: preview.hasTable ? Boolean(data.linkRecords) : false, fileName }, timeoutMs: 300_000 });
        await loadGroups();
        view.status = "all";
        view.mode = "list";
        renderList();
        loadList();
        HOF.dues?.reloadSoon?.(300);
        const skipped = result.skipped.length ? ` ${result.skipped.length} satır atlandı (${[...new Set(result.skipped.map(item => item.reason))].join("; ")}).` : "";
        HOF.toast(`${result.created} kart oluşturuldu${result.groups ? `, ${result.groups} grup tanımlandı` : ""}${result.records ? `, ${result.records} kart tablodaki kaydına bağlandı` : ""}${result.opening ? `; Excel'de ödenmiş ${money(result.opening)} açılış olarak yazıldı (Kasa dışı)` : ""}.${skipped}${result.importId ? " Yanlışsa Tablodan aktar → Son aktarımlar’dan geri alınır." : ""}`, { type: result.created ? "success" : "error", timeout: 12000 });
      },
    });
  }

  // ---------- Cari seç → toplu taksitlendir (v2.0.11) ----------
  // Taksitler'den çıkmadan: gruba/alt gruba ve aramaya göre carileri listeler; açık taksit kartı olan cari işaretli gelir
  // ve seçilemez (çift kart açılmaz). Seçilenler Cari ekranındaki aynı forma gider (HOF.accounts.bulkPlanForm).
  const PICK_PAGE = 500;
  function pickAccounts(preset = {}) {
    const state = { q: "", group: preset.group || "", subgroup: preset.subgroup || "", plan: "none", data: null, selected: new Set(), all: false, request: 0 };
    const picker = HOF.modal({
      title: "Cari Seç · Toplu Taksitlendir",
      eyebrow: moduleName().toLocaleUpperCase("tr-TR"),
      size: "wide",
      body: `<div class="hof-plans-filters hof-pick-filters"><input type="search" data-pick="q" placeholder="Ad, telefon, cari no ara…" aria-label="Cari ara"><select data-pick="group" aria-label="Grup"></select><select data-pick="subgroup" aria-label="Alt grup"></select><select data-pick="plan" aria-label="Taksit durumu"><option value="none">Kartı Olmayanlar</option><option value="">Tüm Cariler</option></select></div>
        <div class="hof-acc-selbar" data-pick-bar></div>
        <div class="hof-cash-list hof-pick-list" data-pick-list><p class="hof-empty">Yükleniyor…</p></div>
        <p class="hof-edit-meta">Açık taksit kartı olan cari seçilemez (çift kart açılmaz). Aradığınız kişi listede yoksa önce <b>Cari</b> ekranından açın ya da carilerinizi Excel’den yükleyin.</p>
        <div class="hof-actions"><button type="button" class="hof-button hof-button-ghost" data-pick-cancel>Vazgeç</button><button type="button" class="hof-button" data-pick-go disabled>Seçilenlere Taksit Planı</button></div>`,
    });
    const root = picker.dialog;
    const $ = selector => root.querySelector(selector);
    const groupSelect = $('[data-pick="group"]');
    const subSelect = $('[data-pick="subgroup"]');
    const peopleText = item => `${item.name} · ${item.accounts.toLocaleString("tr-TR")} cari`;
    const renderGroups = () => {
      groupSelect.innerHTML = `<option value="">Tüm Gruplar</option>${view.groups.map(item => `<option value="${esc(item.id)}" ${item.id === state.group ? "selected" : ""}>${esc(peopleText(item))}</option>`).join("")}`;
      const subs = view.groups.find(item => item.id === state.group)?.subgroups || [];
      subSelect.innerHTML = `<option value="">${subs.length ? "Tüm Alt Gruplar" : "Alt Grup"}</option>${subs.map(item => `<option value="${esc(item.id)}" ${item.id === state.subgroup ? "selected" : ""}>${esc(peopleText(item))}</option>`).join("")}`;
      subSelect.disabled = !subs.length;
    };
    const filters = () => ({ q: state.q, group: state.group, subgroup: state.subgroup, plan: state.plan, status: "active" });
    const selectable = item => !item.activePlans;
    // "Süzgeçteki hepsi": yalnız kartı olmayanlar sayılır (kartı olan zaten atlanır).
    const count = () => (state.all ? state.data?.total || 0 : state.selected.size);
    const renderBar = () => {
      const data = state.data;
      const n = count();
      const eligible = (data?.accounts || []).filter(selectable).length;
      const more = data && data.hasMore && state.plan === "none";
      $("[data-pick-bar]").classList.toggle("is-active", n > 0);
      $("[data-pick-bar]").innerHTML = !data
        ? ""
        : n
          ? `<span><b>${n.toLocaleString("tr-TR")}</b> cari seçildi${state.all ? " (süzgeçteki hepsi)" : ""}</span><button type="button" class="hof-button hof-button-small hof-button-ghost" data-pick-clear>Seçimi Temizle</button>`
          : `<span>${data.total ? `${data.total.toLocaleString("tr-TR")} cari listelendi${eligible ? "; kutularla seçin ya da başlıktaki kutuyla listedekilerin hepsini seçin." : "; hepsinin açık taksit kartı var."}` : "Bu süzgeçte cari yok."}</span>${more ? `<button type="button" class="hof-button hof-button-small hof-button-ghost" data-pick-all>Süzgeçteki ${data.total.toLocaleString("tr-TR")} Carinin Hepsini Seç</button>` : ""}`;
      const go = $("[data-pick-go]");
      go.disabled = !n;
      go.textContent = n ? `Seçilenlere Taksit Planı (${n.toLocaleString("tr-TR")})` : "Seçilenlere Taksit Planı";
    };
    const renderRows = () => {
      const data = state.data;
      const list = $("[data-pick-list]");
      if (!data) return;
      if (!data.accounts.length) {
        list.innerHTML = `<p class="hof-empty">${state.plan === "none" ? "Bu süzgeçte taksit kartı olmayan cari yok. Kartı olanları görmek için “Tüm Cariler”i seçin." : "Bu süzgeçte cari yok."}</p>`;
        return renderBar();
      }
      const eligible = data.accounts.filter(selectable);
      const allOn = state.all || (eligible.length > 0 && eligible.every(item => state.selected.has(item.id)));
      const row = item => {
        const locked = !selectable(item);
        const on = !locked && (state.all || state.selected.has(item.id));
        return `<tr class="${locked ? "is-muted" : on ? "is-selected" : ""}" data-pick-row="${esc(item.id)}"><td class="hof-acc-check"><input type="checkbox" data-pick-id="${esc(item.id)}" ${on ? "checked" : ""} ${locked || state.all ? "disabled" : ""} aria-label="${esc(item.name)} seç"></td><td class="hof-plan-no">${esc(item.refNo || "")}</td><td><b>${esc(item.name)}</b>${item.phone ? `<small>${esc(item.phone)}</small>` : ""}</td><td>${esc([item.groupName, item.subgroupName].filter(Boolean).join(" › ") || "Grupsuz")}</td><td>${locked ? '<span class="hof-plan-badge is-info" title="Açık taksit kartı var; ikinci kart açılmaz">Kartı Var</span>' : '<span class="hof-plan-badge is-muted">Kartı Yok</span>'}</td></tr>`;
      };
      list.innerHTML = `<table class="hof-table hof-cash-table hof-pick-table"><thead><tr><th class="hof-acc-check"><input type="checkbox" data-pick-head ${allOn ? "checked" : ""} ${eligible.length && !state.all ? "" : "disabled"} aria-label="Listedeki hepsini seç"></th><th class="hof-plan-no">No</th><th>Cari</th><th>Grup</th><th>Taksit</th></tr></thead><tbody>${data.accounts.map(row).join("")}</tbody></table>${data.hasMore ? `<p class="hof-rep-note">İlk ${data.accounts.length.toLocaleString("tr-TR")} cari gösteriliyor; aramayla daraltın ya da “hepsini seç” düğmesini kullanın.</p>` : ""}`;
      renderBar();
    };
    async function load() {
      const ticket = ++state.request;
      state.data = null;
      $("[data-pick-list]").innerHTML = '<p class="hof-empty">Yükleniyor…</p>';
      renderBar();
      try {
        const query = new URLSearchParams({ ...filters(), sort: "name", limit: String(PICK_PAGE), offset: "0" });
        const data = await HOF.api(`/api/workspace/accounts?${query}`);
        if (ticket !== state.request) return;
        state.data = data;
        const visible = new Set(data.accounts.filter(selectable).map(item => item.id));
        for (const id of [...state.selected]) if (!visible.has(id)) state.selected.delete(id);
        renderRows();
      } catch (error) {
        if (ticket === state.request) $("[data-pick-list]").innerHTML = `<p class="hof-empty">${esc(error.message)}</p>`;
      }
    }
    let typing = 0;
    root.addEventListener("input", event => {
      if (!event.target.matches('[data-pick="q"]')) return;
      clearTimeout(typing);
      typing = setTimeout(() => {
        state.q = event.target.value.trim();
        state.all = false;
        load();
      }, 250);
    });
    root.addEventListener("change", event => {
      const target = event.target;
      if (target.matches("select[data-pick]")) {
        state[target.dataset.pick] = target.value;
        if (target.dataset.pick === "group") {
          state.subgroup = "";
          renderGroups();
        }
        state.all = false;
        return load();
      }
      if (target.matches("[data-pick-head]")) {
        for (const item of state.data.accounts.filter(selectable)) {
          if (target.checked) state.selected.add(item.id);
          else state.selected.delete(item.id);
        }
        return renderRows();
      }
      if (target.matches("[data-pick-id]")) {
        if (target.checked) state.selected.add(target.dataset.pickId);
        else state.selected.delete(target.dataset.pickId);
        return renderRows();
      }
    });
    root.addEventListener("click", event => {
      const target = event.target;
      if (target.closest("[data-pick-cancel]")) return picker.close();
      if (target.closest("[data-pick-all]")) {
        state.all = true;
        return renderRows();
      }
      if (target.closest("[data-pick-clear]")) {
        state.all = false;
        state.selected.clear();
        return renderRows();
      }
      if (target.closest("[data-pick-go]")) {
        const n = count();
        if (!n) return;
        const chosen = state.data.accounts.filter(item => selectable(item) && (state.all || state.selected.has(item.id)));
        return HOF.accounts.bulkPlanForm({
          selection: state.all ? { all: true, ...filters(), plan: "none" } : { ids: [...state.selected] },
          count: n,
          names: chosen.map(item => item.name),
          fieldLabels: state.data.fieldLabels || [],
          onDone: async () => {
            picker.close();
            await loadGroups();
            if (modal && view.mode === "list") {
              renderList();
              loadList();
            }
          },
        });
      }
      // Satırın herhangi bir yerine tıklamak kutuyu değiştirir (kartı olan cari hariç).
      const tr = target.closest("tr[data-pick-row]");
      if (tr && !target.closest("input") && !state.all) {
        const box = tr.querySelector("input[data-pick-id]");
        if (box && !box.disabled) {
          box.checked = !box.checked;
          box.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    });
    renderGroups();
    load();
    setTimeout(() => $('[data-pick="q"]')?.focus(), 50);
  }

  // ---------- Olaylar ----------
  function onClick(event) {
    const row = event.target.closest("tr[data-plan]");
    if (row && view.mode === "list") return loadPlan(row.dataset.plan);
    const button = event.target.closest("button, a[data-act]");
    if (!button) return;
    if (button.dataset.openCheque) {
      modal?.close();
      return HOF.cheques?.open({ id: button.dataset.openCheque });
    }
    const plan = view.plan;
    if (button.dataset.status) {
      view.status = button.dataset.status;
      renderList();
      return loadList();
    }
    if (button.dataset.print) return printPdf(button.dataset.print === "list" ? listPdfUrl() : cardPdfUrl(plan));
    if (button.dataset.itemFilter) {
      view.itemFilter = button.dataset.itemFilter;
      return renderCard();
    }
    if (button.dataset.entryFilter) {
      view.entryFilter = button.dataset.entryFilter;
      return renderCard();
    }
    if ("close" in button.dataset) return modal.close();
    const act = button.dataset.act;
    if (act === "retryList") {
      view.listError = "";
      renderList();
      return loadList();
    }
    if (act === "back") {
      view.mode = "list";
      view.planId = "";
      renderList();
      return loadList();
    }
    if (act === "reveal") {
      event.preventDefault();
      if (!plan?.caseKey) return;
      if (foreignCase(plan)) return HOF.toast("Bu kart başka bir sayfadaki kayda bağlı; o sayfaya geçince açılır.", { type: "info" });
      modal.close();
      return HOF.revealRecord?.(plan.caseKey);
    }
    if (act === "account") {
      event.preventDefault();
      if (!plan?.accountId || !HOF.accounts) return;
      modal.close();
      return HOF.accounts.open(plan.accountId);
    }
    if (act === "new") return editPlan(null);
    if (act === "import") return importFromExcel();
    if (act === "transfer") return HOF.planTransfer?.open();
    if (act === "groups") return openGroups();
    if (act === "bulk") return pickAccounts({ group: view.group, subgroup: view.subgroup });
    if (act === "pick") return pickAccounts({ group: view.group, subgroup: view.subgroup });
    if (!plan) return;
    if (act === "pay") return editEntry(plan, { kind: "in" });
    if (act === "refund") return editEntry(plan, { kind: "out" });
    if (act === "addItem") return editItem(plan, null);
    if (act === "distribute") return distributePlan(plan);
    if (act === "edit") return editPlan(plan);
    if (act === "close") return setStatus(plan, "closed");
    if (act === "reopen") return setStatus(plan, "active");
    if (act === "delete") return deletePlan(plan);
    if (act === "whatsapp") return window.open(`https://wa.me/${button.dataset.wa}`, "_blank", "noopener");
    const itemOf = id => plan.items.find(item => item.id === id);
    const entryOf = id => plan.entries.find(entry => entry.id === id);
    if (button.dataset.payItem) return editEntry(plan, { kind: "in", item: itemOf(button.dataset.payItem) });
    if (button.dataset.editItem) return editItem(plan, itemOf(button.dataset.editItem));
    if (button.dataset.deleteItem) return deleteItem(plan, itemOf(button.dataset.deleteItem));
    if (button.dataset.editEntry) return editEntry(plan, { entry: entryOf(button.dataset.editEntry) });
    if (button.dataset.deleteEntry) return deleteEntry(plan, entryOf(button.dataset.deleteEntry));
  }
  function onChange(event) {
    const select = event.target.closest("select[data-filter]");
    if (!select) return;
    view[select.dataset.filter] = select.value;
    if (select.dataset.filter === "group") view.subgroup = "";
    if (select.dataset.filter === "sort") {
      try {
        localStorage.setItem(SORT_KEY, select.value);
      } catch {
        // tarayıcı saklamaya izin vermiyorsa sıralama yalnız bu pencerede geçerli
      }
    }
    renderList();
    loadList();
  }
  const onInput = (() => {
    let timer = 0;
    return event => {
      const input = event.target.closest('input[data-filter="q"]');
      if (!input) return;
      view.q = input.value;
      clearTimeout(timer);
      timer = setTimeout(loadList, 250);
    };
  })();

  // Bildirimden / şeritten: geciken taksite tahsilat (kart penceresi açılır, tahsilat formu hazır gelir).
  async function pay(item) {
    if (!item?.planId) return;
    if (!canCollect()) return open(item.planId);
    try {
      const plan = await HOF.api(`/api/workspace/plans/${encodeURIComponent(item.planId)}`);
      const target = plan.items.find(row => row.id === item.itemId) || null;
      editEntry(plan, { kind: "in", item: target, amount: item.amount });
    } catch (error) {
      HOF.toastError(error);
    }
  }

  // Ortak araçlar (v2.0.6): Cari ve Stok da aynı Excel okuyucuyu, yazdırmayı ve grup alanlarını kullanır.
  HOF.office = { parseExcel: parseInWorker, pickSheet, chooseSheet, printPdf, outputButtons, groupFields: groupFieldsFor, wireGroupFields, groupBody, amountText, todayIso };
  HOF.whenReady(() => {
    // v2.0.22: canlı olaylar ve defter değişiklikleri tek yenileme kapısından (HOF.refresher; açık pencere başına tek yükleme).
    const refreshOpen = HOF.refresher(async () => {
      if (!modal) return;
      await loadGroups();
      if (view.mode === "card" && view.planId) await loadPlan(view.planId, { quiet: true });
      else if (view.mode === "list") {
        renderList();
        await loadList({ quiet: true });
      }
    });
    HOF.on("live:workspace.changed", change => {
      if (!modal || !change || change.info) return;
      if (change.kind !== "plans" && change.kind !== "accounts") return;
      if (view.mode === "card" && view.planId && change.kind === "plans" && change.planId && change.planId !== view.planId) return;
      refreshOpen();
    });
    // v2.0.11: taksit kartına dokunan başka pencerelerdeki işlemler (Cari kartından toplu plan, Kasa'da taksit
    // tahsilatını silme, detay kartı) açık Taksitler penceresini de yeniler.
    HOF.onLedger(["plans", "accounts"], detail => {
      if (!modal || /^\/api\/workspace\/(plans|plan-transfer)\b/.test(detail.path || "")) return;
      if (detail.local) refreshOpen.now();
      else refreshOpen();
    }, 350);
  });
  HOF.plans = {
    open,
    pay,
    refresh: () => (view.mode === "card" && view.planId ? loadPlan(view.planId) : loadList()),
    // v2.0.6: kişinin kartı için.
    forCase: key => HOF.api(`/api/workspace/cases/${encodeURIComponent(key)}/plans`),
    openNew: preset => {
      if (!HOF.can("plans.manage")) return HOF.toast("Taksit kartı açmak yönetici, uzman ve muhasebe yetkisidir.", { type: "error" });
      open();
      editPlan(null, preset || null);
    },
    collect: (plan, item = null) => editEntry(plan, { kind: "in", item }),
    casePicker: { html: pickerHtml, wire: wirePicker },
    recordLabel,
    recordDay,
    personOf,
    phoneOf,
  };
})();
