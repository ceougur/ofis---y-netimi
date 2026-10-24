/* DestekOfis — tahsilat takvimi şeridi (v2.0.1).
 * Sunucu (server/lib/insight/dues.mjs) verinin tüm sekmelerinde ödenmesi beklenen kalemleri bulur: ödeme sözü, taahhüt,
 * vade, "1. Taksit Tarihi / Tutarı" çiftleri, "Eylül 2026" gibi ay yazımları, ayın belli günü ödenen kira/aidat.
 * Programda girilen tahsilatlar kalemlere vade sırasıyla sayılır; satırın durumu "Ödendi / Kapandı / İptal" ise kalem
 * kapanır. Ödenmemiş kalemler (gecikenler, bu ay ve 7 gün içinde gelecekler) ekranın üstünde kayan piller olarak
 * görünür; tahsilat girilince ya da "Ödendi say" denince pil kaybolur. Programda eklenen yeni satırlar ve serbest
 * sayfalar da aynı kuralla izlenir.
 * Veri HOF.dues ile paylaşılır ve her değişiklikte "dues" olayı yayımlanır (sağ alt bildirimler: hof-alerts.js). */
(() => {
  "use strict";
  const HOF = window.HOF;
  const { esc } = HOF;
  const PILL_LIMIT = 40;
  let data = { items: [], deadlines: [], today: "" };
  let request = 0;
  let signature = "";

  const money = value => (value === null || value === undefined ? "" : HOF.formatMoney(value));
  // 2.4.3 (keşif A21): takvimde ve bildirimde aynı adlı farklı kişiler (iki "Ahmet Yılmaz" carisi, aynı adlı iki kayıt) ayırt edilir — adın
  // yanına Cari No (taksit kartının carisi), kart No'su, dosya no ya da telefon. Yalnız ad gerçekten çakışınca eklenir (öbürlerinde sade ad).
  const identityOf = item => item.accountId || item.planId || item.caseKey || item.id;
  let twinCache = { items: null, names: new Set() };
  const twinNames = () => {
    if (twinCache.items === data.items) return twinCache.names;
    const keys = new Map();
    for (const item of data.items || []) {
      const name = HOF.normalize(item.person || "");
      if (!name) continue;
      if (!keys.has(name)) keys.set(name, new Set());
      keys.get(name).add(identityOf(item));
    }
    twinCache = { items: data.items, names: new Set([...keys].filter(([, ids]) => ids.size > 1).map(([name]) => name)) };
    return twinCache.names;
  };
  const tagOf = item => (item.accountRef ? `Cari No ${item.accountRef}` : item.refNo ? `No ${item.refNo}` : item.source !== "plan" && item.caseNo ? item.caseNo : item.phone || "");
  const who = item => {
    const name = item.person || item.caseNo || "Kayıt";
    const tag = item.person && twinNames().has(HOF.normalize(item.person)) ? tagOf(item) : "";
    return tag && tag !== name ? `${name} · ${tag}` : name;
  };
  // v2.0.17: öbür sayfanın kalemi (item.foreign) pilde sayfa adıyla görünür; "Kayda Git" o sayfaya geçer ve (2.0.25) kaydı açar.
  const pageTag = item => (item.foreign && item.pageName ? ` · ${item.pageName}` : "");
  const stateText = item => {
    if (item.state === "overdue") return `${Math.abs(item.days)} gün gecikti`;
    if (item.state === "today") return "Bugün";
    if (item.state === "month") return "Bu ay";
    return item.days === 1 ? "Yarın" : `${item.days} gün kaldı`;
  };
  // Şeritte: gecikenler, bugün/bu ay, 7 gün içinde gelecekler ve 30 gün içindeki açık ödeme sözleri.
  const onStrip = item => item.state !== "upcoming" || item.days <= 7 || item.thisMonth || (item.promise && item.days <= 30);
  // 2.4.5 B1: sunucu kalemleri kaynak sırasıyla birleştirir (tablo, taksit, çek, fatura, banka, cari vade, öbür sayfa); şerit ilk PILL_LIMIT pili
  // gösterdiği için kesmeden ÖNCE zildeki kuralla sıralanır (hof-alerts.js: önce alınmayanlar [gecikmiş/bugün/bu ay], sonra yaklaşanlar; gün
  // sırası; aynı günde ad; ad da aynıysa sort kararlı → sunucunun kaynak/yazım sırası; kimlikle sıralanmaz, ders 31).
  const stripRank = item => (item.state !== "upcoming" ? 0 : 4);
  const stripTitle = item => `${who(item)}${pageTag(item)}`;
  const stripOrder = items => [...items].sort((a, b) => stripRank(a) - stripRank(b) || a.days - b.days || stripTitle(a).localeCompare(stripTitle(b), "tr"));

  let loadedAt = 0;
  async function load() {
    const ticket = ++request;
    try {
      // 2.4.3 H2 (fatura yükte hız testi): elimizdeki takvimin sürümü gönderilir; sunucuda içerik aynıysa yalnız "değişmedi" döner (10.000
      // faturalı veride yanıt 2,8 MB idi ve açık her pencere başkasının her kaydında yeniden alıyordu). Ekran ve bildirimler yine yenilenir.
      const since = data.version ? `?since=${encodeURIComponent(data.version)}` : "";
      const result = await HOF.api(`/api/workspace/dues${since}`, { background: true });
      if (ticket !== request) return;
      if (result?.unchanged) {
        // Beklenmez (sunucu yalnız aynı sürüme "değişmedi" der); yine de elimizdeki takvim o sürüm değilse tamamı istenir.
        if (result.version !== data.version) {
          data = { ...data, version: "" };
          return load();
        }
      } else data = result;
      loadedAt = Date.now();
      render();
      HOF.emit("dues", data);
    } catch {
      // Takvim yardımcıdır; alınamazsa şerit gösterilmez.
    }
  }
  // Kapanan kalem sunucu yanıtını beklemeden şeritten ve bildirimlerden düşer; ardından gelen yenileme doğrular.
  function drop(match) {
    const before = (data.items || []).length;
    const items = (data.items || []).filter(item => !match(item));
    if (items.length === before) return;
    // Yerelde düşürülen takvim artık sunucunun o sürümü değildir: sonraki yenileme tamamını alır (sunucu kalemi hâlâ veriyorsa geri gelir).
    data = { ...data, items, version: "" };
    closeCard();
    render();
    HOF.emit("dues", data);
  }
  const reloadSoon = (() => {
    let timer = 0;
    return (delay = 700) => {
      clearTimeout(timer);
      timer = setTimeout(load, delay);
    };
  })();

  const closeCard = () => {
    const card = document.querySelector(".hof-payment-action-card");
    if (!card) return;
    if (card.hofAway) {
      document.removeEventListener("pointerdown", card.hofAway, true);
      document.removeEventListener("keydown", card.hofAway, true);
    }
    card.remove();
  };

  async function settle(item, reason, button) {
    button.disabled = true;
    try {
      await HOF.api("/api/workspace/dues/settle", { method: "POST", body: { id: item.id, reason, session: item.foreign ? item.session : undefined } });
      closeCard();
      HOF.toast(reason === "paid" ? `${who(item)} · ${item.label} ödendi sayıldı.` : `${who(item)} · ${item.label} iptal edildi.`, {
        type: "success",
        action: {
          label: "Geri Al",
          onClick: async () => {
            try {
              await HOF.api("/api/workspace/dues/settle", { method: "POST", body: { id: item.id, undo: true, session: item.foreign ? item.session : undefined } });
              load();
            } catch (error) {
              HOF.toastError(error);
            }
          },
        },
      });
      load();
    } catch (error) {
      button.disabled = false;
      HOF.toastError(error);
    }
  }

  // ---------- Kaynağa göre işlemler (2.4.5 madde 6a; kullanıcı bulgusu 24.10.2026) ----------
  // Takvim kalemi tablodaki bir kayıt, taksit, çek/senet, fatura, planlı banka işlemi ya da carinin vadeli borcu (madde 6) olabilir. Pil kartı, zil
  // (hof-alerts.js) ve Anlık Durum → Vade Takip (hof-overview.js openRef) hangi düğmenin görüneceğini ve neyi açacağını BURADAN alır (tek yardımcı).
  // Önceden pil kartı ve zil tanımadığı kaynağı (fatura, planlı banka) tablo kaydı sayıyordu: "Kayda Git" → "Kayıt tabloda bulunamadı", "Ödendi Say" → 400
  // "Kalem tanınmadı", "Tahsilat Gir" → SEÇİLİ tablo kaydının carisine fatura tutarıyla dolu form (alış faturasında yön de ters). Kaynağı tanınmayan kalemde
  // düğme yoktur (tablo kaydı gibi işlenmez). Sunucunun ürettiği her kaynak burada bir dal ister: test/takvim-pil-kaynak.test.mjs.
  const can = permission => Boolean(HOF.can?.(permission));
  const sourceOf = item => (item?.source ? String(item.source) : String(item?.id || "").startsWith("due|") ? "table" : "");
  const noteOf = item => [item.label, item.dueText].filter(Boolean).join(" · ");
  // go.allowed: kişinin o kaynağı görme yetkisi (yoksa pil kartında / zilde düğme çıkmaz; Vade Takip'te modül kendi iletisini verir).
  const DUE_SOURCES = {
    // Tablodaki kayıt (Excel / Sheets): tahsilat kaydın carisine (ya da kayda bağlı taksit kartına) girilir (hof-workspace.js actions.payment). 2.4.5 madde 3:
    // tutar ve tablo borcu forma GELMEZ (tablodaki tutar muhasebe kaydı değildir); kişi, telefon ve not gelir. Kayıt anahtarı yoksa düğme yok (seçili kayda
    // düşmez). Öbür sayfanın kalemi: tahsilat o sayfaya geçince girilir; Ödendi Say buradan çalışır.
    table: {
      settle: true,
      pay: item =>
        !item.foreign && item.caseKey && (can("accounts.collect") || can("plans.collect")) && HOF.workspace?.payment
          ? { label: "Tahsilat Gir", run: () => HOF.workspace.payment({ key: item.caseKey, title: who(item), person: item.person || "", phone: item.phone || "", note: noteOf(item) }) }
          : null,
      go: item =>
        item.foreign
          ? { label: `Kayda Git (“${item.pageName || "Sayfa"}”)`, allowed: true, run: () => HOF.sessions?.select?.(item.session, { reveal: { caseKey: item.caseKey, tab: item.tab || "" } }) }
          : item.caseKey
            ? { label: "Kayda Git", allowed: true, run: () => HOF.revealRecord?.(item.caseKey, { tab: item.tab || "" }) }
            : null,
    },
    // Taksit kartı (v2.0.4): tahsilat kartın üstünden.
    plan: {
      pay: item => (can("plans.collect") && HOF.plans?.pay ? { label: "Tahsilat Gir", run: () => HOF.plans.pay(item) } : null),
      go: item => (item.planId && HOF.plans?.open ? { label: "Taksit Kartını Aç", allowed: true, run: () => HOF.plans.open(item.planId) } : null),
    },
    // Çek / senet (v2.0.7): tahsil / ödeme evrak kartından.
    cheque: {
      pay: item => (can("cheques.manage") && HOF.cheques?.open ? { label: item.direction === "out" ? "Ödeme Gir" : "Tahsil Et", run: () => HOF.cheques.open({ id: item.chequeId, action: item.direction === "out" ? "pay" : "collect" }) } : null),
      go: item => (item.chequeId && HOF.cheques?.open ? { label: "Çek / Senet Kartını Aç", allowed: can("cheques.view"), run: () => (can("cheques.view") ? HOF.cheques.open({ id: item.chequeId }) : HOF.toast("Çek/senet kartı kasa yetkisi olanlara açılır.", { type: "error" })) } : null),
    },
    // Fatura (v2.0.15): faturanın KENDİ ödeme formu (kartındaki "+ Tahsilat Ekle" / "+ Ödeme Yap"; taksitli faturada taksit kartı) — tahsilat bu faturaya bağlı,
    // faturanın carisine yazılır. Satışta Tahsilat Gir, alışta Ödeme Gir (yetki kartla aynı). Ödendi Say yok (fatura para kaydıyla kapanır).
    invoice: {
      pay: item =>
        item.invoiceId && can("invoices.view") && can(item.direction === "out" ? "accounts.manage" : "accounts.collect") && HOF.invoices?.payDoc
          ? { label: item.direction === "out" ? "Ödeme Gir" : "Tahsilat Gir", run: () => HOF.invoices.payDoc(item.invoiceId) }
          : null,
      go: item => (item.invoiceId && HOF.invoices?.openDoc ? { label: "Fatura Kartını Aç", allowed: can("invoices.view"), run: () => HOF.invoices.openDoc(item.invoiceId) } : null),
    },
    // Planlı banka işlemi (2.3.0 İz 3.3): deftere girmez; Banka → Hareketler → Planlı İşlemler'den gerçekleştirilir (tahsilat formu yok).
    bank: {
      pay: () => null,
      go: () => (HOF.bank?.openPlans ? { label: "Planlı İşlemleri Aç", allowed: can("bank.view"), run: () => HOF.bank.openPlans() } : null),
    },
    // Carinin vadeli borç / alacak kaydı (2.4.5 madde 6, sözleşme K6.3): carinin tahsilat / ödeme formu; tutar = kaydın Kalan'ı (programın kendi kaydı).
    account: {
      pay: item => {
        if (!item.accountId) return null;
        const preset = { amount: Number(item.amount) > 0 ? Number(item.amount) : null, note: noteOf(item) };
        if (item.direction === "out") return can("accounts.manage") && HOF.accounts?.pay ? { label: "Ödeme Gir", run: () => HOF.accounts.pay(item.accountId, preset) } : null;
        return can("accounts.collect") && HOF.accounts?.collect ? { label: "Tahsilat Gir", run: () => HOF.accounts.collect(item.accountId, preset) } : null;
      },
      go: item => (item.accountId && HOF.accounts?.open ? { label: "Cariyi Aç", allowed: can("accounts.view"), run: () => HOF.accounts.open(item.accountId) } : null),
    },
  };
  /** Kalemin düğmeleri: { kind, pay: {label, run} | null, go: {label, allowed, run} | null, settle (Ödendi Say), cancel (Söz İptal) }. */
  function actionsOf(item) {
    const kind = sourceOf(item);
    const spec = Object.hasOwn(DUE_SOURCES, kind) ? DUE_SOURCES[kind] : null;
    if (!spec) return { kind, pay: null, go: null, settle: false, cancel: false };
    // "Ödendi Say" / "Söz İptal" yalnız tablo kalemi (due|) içindir; sunucu (routes/dues.mjs settle) başkasını 400 ile reddeder.
    const settle = Boolean(spec.settle) && String(item.id || "").startsWith("due|") && can("records.edit");
    return { kind, pay: spec.pay(item) || null, go: spec.go(item) || null, settle, cancel: settle && Boolean(item.promise) };
  }
  // Vade Takip satırının kaynağı (sunucu routes/overview.mjs ref.type) → takvim kalemi; aynı "go" yolu açılır. Kayıt (record) ve Kasa (cash) hof-overview.js'te.
  const DUE_REFS = {
    plan: ref => ({ source: "plan", planId: ref.id }),
    cheque: ref => ({ source: "cheque", chequeId: ref.id }),
    invoice: ref => ({ source: "invoice", invoiceId: ref.id }),
    bankPlan: ref => ({ source: "bank", bankPlanId: ref.id }),
    account: ref => ({ source: "account", accountId: ref.id, entryId: ref.entryId || "" }),
  };
  /** Vade Takip satırını açar; bu kaynak burada tanınıyorsa true. */
  function openRef(ref) {
    const make = ref?.id && Object.hasOwn(DUE_REFS, ref.type) ? DUE_REFS[ref.type] : null;
    if (!make) return false;
    const go = actionsOf(make(ref)).go;
    if (go) go.run();
    return true;
  }

  function pay(item) {
    closeCard();
    actionsOf(item).pay?.run();
  }

  function openCard(item, pillNode) {
    closeCard();
    const acts = actionsOf(item);
    const card = HOF.el(
      "div",
      { class: "hof-payment-action-card", role: "dialog", "aria-label": `${who(item)} tahsilatı` },
      `<button type="button" class="hof-payment-action-close" aria-label="Kapat">×</button>
      <div class="hof-payment-action-title">${esc(who(item))}</div>
      <div class="hof-payment-action-help">${item.caseNo && item.person ? `${esc(item.caseNo)} · ` : ""}${esc(item.label)} · ${esc(item.dueText)}</div>
      <dl class="hof-due-facts">
        <div><dt>Beklenen</dt><dd>${item.amount ? esc(money(item.amount)) : "Tutar yazılmamış"}${item.partial ? ` <small>(kısmen ödendi)</small>` : ""}</dd></div>
        <div><dt>Durum</dt><dd class="is-${esc(item.state)}">${esc(stateText(item))}</dd></div>
        ${item.debt ? `<div><dt>Kalan Borç</dt><dd>${esc(money(item.debt))}</dd></div>` : ""}
        ${item.tab ? `<div><dt>Sekme</dt><dd>${esc(item.tab)}</dd></div>` : ""}
        ${item.foreign ? `<div><dt>Sayfa</dt><dd>${esc(item.pageName || "Başka sayfa")}</dd></div>` : ""}
      </dl>
      <div class="hof-payment-action-buttons">
        ${acts.pay ? `<button type="button" data-act="pay" class="hof-payment-paid">${esc(acts.pay.label)}</button>` : ""}
        ${acts.settle ? `<button type="button" data-act="paid" class="hof-payment-mark" title="Tahsilat girmeden kapatır (ör. başka yoldan ödendi)">Ödendi Say</button>` : ""}
        ${acts.cancel ? '<button type="button" data-act="cancelled" class="hof-payment-cancelled">Söz İptal</button>' : ""}
      </div>
      ${acts.go?.allowed ? `<button type="button" class="hof-payment-go" data-act="go">${esc(acts.go.label)} →</button>` : ""}`,
    );
    card.addEventListener("click", event => {
      const button = event.target.closest("[data-act]");
      if (!button) return;
      const act = button.dataset.act;
      if (act === "pay") pay(item);
      else if (act === "go") {
        closeCard();
        acts.go?.run();
      } else if ((act === "paid" || act === "cancelled") && acts.settle) settle(item, act, button);
    });
    card.querySelector(".hof-payment-action-close").onclick = closeCard;
    // Kart tıklanan pilin hemen altında açılır (ekranın kenarlarına taşmadan); sayfa kaydırılınca ya da dışarı
    // tıklanınca kapanır.
    document.body.appendChild(card);
    const box = pillNode.getBoundingClientRect();
    const width = card.offsetWidth;
    const height = card.offsetHeight;
    const left = Math.max(10, Math.min(window.innerWidth - width - 10, box.left + box.width / 2 - width / 2));
    const below = box.bottom + 8 + height <= window.innerHeight;
    card.style.left = `${left}px`;
    card.style.top = `${below ? box.bottom + 8 : Math.max(10, box.top - height - 8)}px`;
    const away = event => {
      if (event.type === "keydown" && event.key !== "Escape") return;
      if (event.type === "pointerdown" && (card.contains(event.target) || event.target.closest?.(".hof-payment-pill"))) return;
      closeCard();
    };
    card.hofAway = away;
    setTimeout(() => {
      document.addEventListener("pointerdown", away, true);
      document.addEventListener("keydown", away, true);
      window.addEventListener("scroll", closeCard, { once: true, passive: true });
    }, 0);
    card.querySelector("[data-act]")?.focus({ preventScroll: true });
  }

  function render() {
    const existing = document.querySelector(".hof-payment-promises");
    const items = stripOrder((data.items || []).filter(onStrip));
    const anchor = document.getElementById("hof-summary") || document.querySelector(".welcome-row");
    if (!items.length || !anchor) {
      existing?.remove();
      signature = "";
      return;
    }
    const notes = data.notes || [];
    const nextSignature = JSON.stringify([items.map(item => [item.id, item.amount, item.state, item.days]), notes]);
    if (existing && existing.isConnected && signature === nextSignature && existing.previousElementSibling === anchor) return;
    existing?.remove();
    signature = nextSignature;
    const overdue = items.filter(item => item.state === "overdue").length;
    const now = items.filter(item => item.state === "today" || item.state === "month").length;
    const soon = items.length - overdue - now;
    const shown = items.slice(0, PILL_LIMIT);
    const parts = [overdue ? `${overdue} gecikmiş` : "", now ? `${now} bugün/bu ay` : "", soon ? `${soon} yaklaşan` : ""].filter(Boolean).join(" · ");
    const band = HOF.el("section", { class: `hof-payment-promises${notes.length ? " has-note" : ""}`, "aria-label": "Tahsilat takvimi" });
    // 31e A1: borcu birden çok sekmede olan dosya no ayrı kalem sayıldı — raporlarla aynı not (zil söylemez).
    const noteHtml = notes.length ? `<p class="hof-payment-promises-note" data-dues-notes>${notes.map(note => esc(note)).join(" ")}</p>` : "";
    band.innerHTML = `<div class="hof-payment-promises-heading"><span class="hof-payment-promises-dot${overdue ? " is-late" : ""}"></span><strong>Tahsilat Takvimi</strong><small>${esc(parts)}${shown.length < items.length ? ` · ilk ${shown.length}` : ""}</small></div><div class="hof-payment-promises-viewport"><div class="hof-payment-promises-track"></div></div>${noteHtml}`;
    const track = band.querySelector(".hof-payment-promises-track");
    const pill = item => {
      const button = HOF.el(
        "button",
        { type: "button", class: `hof-payment-pill is-${item.state}`, title: `${who(item)} · ${item.label} · ${item.dueText}${item.amount ? ` · ${money(item.amount)}` : ""} · ${stateText(item)}` },
        `<span class="hof-payment-pill-icon">₺</span><span class="hof-payment-pill-text"><b>${esc(who(item))}${esc(pageTag(item))}</b><span>${esc(item.label)} · ${esc(item.dueText)}${item.amount ? ` · ${esc(money(item.amount))}` : ""}</span></span><em class="hof-payment-pill-state">${esc(stateText(item))}</em>`,
      );
      button.onclick = event => {
        event.stopPropagation();
        openCard(item, button);
      };
      return button;
    };
    shown.forEach(item => track.appendChild(pill(item)));
    // 2.4.3 (keşif A17): şerit tek Tab durağıdır (gezici sekme sırası) — 40 pil Tab ile tek tek geçilmez; şeritte ← → Home End ile gezilir.
    // Önceden ana sayfada Tab sol menüye ve kayıt tablosuna ancak bütün pillerden sonra ulaşıyordu.
    const originals = [...track.children];
    originals.forEach((button, index) => (button.tabIndex = index === 0 ? 0 : -1));
    track.addEventListener("keydown", event => {
      const at = originals.indexOf(event.target.closest?.(".hof-payment-pill"));
      if (at < 0) return;
      const next = { ArrowRight: at + 1, ArrowDown: at + 1, ArrowLeft: at - 1, ArrowUp: at - 1, Home: 0, End: originals.length - 1 }[event.key];
      if (next === undefined) return;
      event.preventDefault();
      const target = originals[Math.max(0, Math.min(originals.length - 1, next))];
      originals.forEach(button => (button.tabIndex = button === target ? 0 : -1));
      target.focus();
    });
    // Kesintisiz kayma için ikinci kopya (ekran okuyucudan gizli). Tek pilde kaymaz.
    if (shown.length > 1) {
      shown.forEach(item => {
        const copy = pill(item);
        copy.setAttribute("aria-hidden", "true");
        copy.tabIndex = -1;
        track.appendChild(copy);
      });
      // Kayma hızı pil sayısına göre: her pil yaklaşık 4 saniye görünür.
      track.style.animationDuration = `${Math.max(20, shown.length * 4)}s`;
    } else track.style.animation = "none";
    anchor.after(band);
  }

  HOF.dues = { data: () => data, reload: load, reloadSoon, drop, who, actions: actionsOf, openRef };
  HOF.whenReady(() => {
    load();
    // Şerit özet kartlarının altında durur; ekran yeniden çizilince yerine döner.
    HOF.onDom(() => {
      const band = document.querySelector(".hof-payment-promises");
      const anchor = document.getElementById("hof-summary") || document.querySelector(".welcome-row");
      if ((data.items || []).some(onStrip) && anchor && (!band || band.previousElementSibling !== anchor)) render();
    });
    HOF.on("rows", () => reloadSoon(900));
    HOF.on("case-activity", () => reloadSoon(400));
    HOF.on("payment-saved", () => reloadSoon(200));
    // v2.0.10: taksit, çek/senet ve Kasa değişince de (işlemi bu ekranda yapan kişide) takvim hemen yenilenir. Önceden
    // yalnız tablo tahsilatı dinleniyordu; çek ödenince pil ve bildirim program yeniden açılana kadar kalıyordu.
    HOF.on("cheques-changed", cheque => {
      if (cheque?.id && !["portfolio", "pending"].includes(cheque.status)) drop(item => item.chequeId === cheque.id);
      reloadSoon(150);
    });
    HOF.on("plans-changed", () => reloadSoon(200));
    HOF.on("cash-changed", () => reloadSoon(300));
    HOF.on("accounts-changed", () => reloadSoon(400));
    // Olay tabanlı yenileme (v2.0.2): gün dönümü ya da uzun arka plan sonrası takvim yeniden alınır.
    HOF.on("dues:refresh", () => load());
    // v2.0.22 (Excel denetimi): başka bilgisayardaki değişiklikler birleştirilir — takvim yanıtı büyüktür (binlerce kayıtta
    // ~1,4 MB); personel saniyede bir kayıt girerken her açık ekran her kayıtta yeniden istiyordu. En sık 4 sn'de bir.
    const liveSoon = HOF.refresher(load, { delay: 800, gap: 4000 });
    HOF.on("live:workspace.changed", change => {
      if (!change || change.info) return;
      if (["dues", "activity", "cash", "records", "source", "sessions", "plans", "cheques", "accounts", "documents", "invoices"].includes(change.kind) || change.dataset) liveSoon();
    });
    // Sunucu para/evrak değişikliğini işlemi yapan dahil herkese "overview.changed" ile de duyurur (başka bilgisayarda
    // ödenen çek bu ekranda da düşer).
    HOF.on("live:overview.changed", () => liveSoon());
    // Başka sayfadaki değişiklik (hof-live.js): o sayfanın kalemleri bu takvimde "öbür sayfa" olarak durur.
    HOF.on("live:page.changed", change => {
      if (change && !change.info) liveSoon();
    });
    HOF.on("live:resync", () => liveSoon());
    HOF.on("live:hello", () => liveSoon());
    // Yedek yenileme: canlı bağlantı kopsa bile ekran açıkken 5 dakikada bir; sekmeye geri dönülünce de (1 dakikadan
    // eskiyse). Sunucu sonucu önbellekte tuttuğu için değişiklik yoksa yük getirmez.
    setInterval(() => {
      if (!document.hidden) load();
    }, 5 * 60_000);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && Date.now() - loadedAt > 60_000) load();
    });
    // Gün dönünce (sayfa uzun süre açık kalırsa) takvim yenilenir.
    setInterval(() => {
      const now = new Date();
      const local = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      if (data.today && data.today !== local) load();
    }, 10 * 60_000);
  });
})();
