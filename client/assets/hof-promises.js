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
  const who = item => item.person || item.caseNo || "Kayıt";
  const stateText = item => {
    if (item.state === "overdue") return `${Math.abs(item.days)} gün gecikti`;
    if (item.state === "today") return "Bugün";
    if (item.state === "month") return "Bu ay";
    return item.days === 1 ? "Yarın" : `${item.days} gün kaldı`;
  };
  // Şeritte: gecikenler, bugün/bu ay, 7 gün içinde gelecekler ve 30 gün içindeki açık ödeme sözleri.
  const onStrip = item => item.state !== "upcoming" || item.days <= 7 || item.thisMonth || (item.promise && item.days <= 30);

  async function load() {
    const ticket = ++request;
    try {
      const result = await HOF.api("/api/workspace/dues");
      if (ticket !== request) return;
      data = result;
      render();
      HOF.emit("dues", data);
    } catch {
      // Takvim yardımcıdır; alınamazsa şerit gösterilmez.
    }
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
      await HOF.api("/api/workspace/dues/settle", { method: "POST", body: { id: item.id, reason } });
      closeCard();
      HOF.toast(reason === "paid" ? `${who(item)} · ${item.label} ödendi sayıldı.` : `${who(item)} · ${item.label} iptal edildi.`, {
        type: "success",
        action: {
          label: "Geri al",
          onClick: async () => {
            try {
              await HOF.api("/api/workspace/dues/settle", { method: "POST", body: { id: item.id, undo: true } });
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

  // Tahsilat penceresi: kayıt seçili olmasa da açılır; kalan tutar ve açıklama hazır gelir.
  function pay(item) {
    closeCard();
    if (!HOF.workspace?.payment) return;
    HOF.workspace.payment({
      key: item.caseKey,
      title: who(item),
      amount: item.amount,
      note: `${item.label} · ${item.dueText}`,
      intro: `<b>${esc(item.label)}</b> · vade ${esc(item.dueText)}${item.amount ? ` · beklenen <b>${esc(money(item.amount))}</b>` : ""}. Kaydedince kalem kapanır ve tutar Kasa'ya tahsilat olarak düşer.`,
    });
  }

  function openCard(item, pillNode) {
    closeCard();
    const canPay = HOF.can("payments.create");
    const canSettle = HOF.can("records.edit");
    const card = HOF.el(
      "div",
      { class: "hof-payment-action-card", role: "dialog", "aria-label": `${who(item)} tahsilatı` },
      `<button type="button" class="hof-payment-action-close" aria-label="Kapat">×</button>
      <div class="hof-payment-action-title">${esc(who(item))}</div>
      <div class="hof-payment-action-help">${item.caseNo && item.person ? `${esc(item.caseNo)} · ` : ""}${esc(item.label)} · ${esc(item.dueText)}</div>
      <dl class="hof-due-facts">
        <div><dt>Beklenen</dt><dd>${item.amount ? esc(money(item.amount)) : "Tutar yazılmamış"}${item.partial ? ` <small>(kısmen ödendi)</small>` : ""}</dd></div>
        <div><dt>Durum</dt><dd class="is-${esc(item.state)}">${esc(stateText(item))}</dd></div>
        ${item.debt ? `<div><dt>Kalan borç</dt><dd>${esc(money(item.debt))}</dd></div>` : ""}
        ${item.tab ? `<div><dt>Sekme</dt><dd>${esc(item.tab)}</dd></div>` : ""}
      </dl>
      <div class="hof-payment-action-buttons">
        ${canPay ? '<button type="button" data-act="pay" class="hof-payment-paid">Tahsilat gir</button>' : ""}
        ${canSettle ? `<button type="button" data-act="paid" class="hof-payment-mark" title="Tahsilat girmeden kapatır (ör. başka yoldan ödendi)">Ödendi say</button>` : ""}
        ${canSettle && item.promise ? '<button type="button" data-act="cancelled" class="hof-payment-cancelled">Söz iptal</button>' : ""}
      </div>
      <button type="button" class="hof-payment-go" data-act="go">Kayda git →</button>`,
    );
    card.addEventListener("click", event => {
      const button = event.target.closest("[data-act]");
      if (!button) return;
      const act = button.dataset.act;
      if (act === "pay") pay(item);
      else if (act === "go") {
        closeCard();
        HOF.revealRecord?.(item.caseKey, { tab: item.tab });
      } else settle(item, act, button);
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
    const items = (data.items || []).filter(onStrip);
    const anchor = document.getElementById("hof-summary") || document.querySelector(".welcome-row");
    if (!items.length || !anchor) {
      existing?.remove();
      signature = "";
      return;
    }
    const nextSignature = JSON.stringify(items.map(item => [item.id, item.amount, item.state, item.days]));
    if (existing && existing.isConnected && signature === nextSignature && existing.previousElementSibling === anchor) return;
    existing?.remove();
    signature = nextSignature;
    const overdue = items.filter(item => item.state === "overdue").length;
    const now = items.filter(item => item.state === "today" || item.state === "month").length;
    const soon = items.length - overdue - now;
    const shown = items.slice(0, PILL_LIMIT);
    const parts = [overdue ? `${overdue} gecikmiş` : "", now ? `${now} bugün/bu ay` : "", soon ? `${soon} yaklaşan` : ""].filter(Boolean).join(" · ");
    const band = HOF.el("section", { class: "hof-payment-promises", "aria-label": "Tahsilat takvimi" });
    band.innerHTML = `<div class="hof-payment-promises-heading"><span class="hof-payment-promises-dot${overdue ? " is-late" : ""}"></span><strong>Tahsilat takvimi</strong><small>${esc(parts)}${shown.length < items.length ? ` · ilk ${shown.length}` : ""}</small></div><div class="hof-payment-promises-viewport"><div class="hof-payment-promises-track"></div></div>`;
    const track = band.querySelector(".hof-payment-promises-track");
    const pill = item => {
      const button = HOF.el(
        "button",
        { type: "button", class: `hof-payment-pill is-${item.state}`, title: `${who(item)} · ${item.label} · ${item.dueText}${item.amount ? ` · ${money(item.amount)}` : ""} · ${stateText(item)}` },
        `<span class="hof-payment-pill-icon">₺</span><span class="hof-payment-pill-text"><b>${esc(who(item))}</b><span>${esc(item.label)} · ${esc(item.dueText)}${item.amount ? ` · ${esc(money(item.amount))}` : ""}</span></span><em class="hof-payment-pill-state">${esc(stateText(item))}</em>`,
      );
      button.onclick = event => {
        event.stopPropagation();
        openCard(item, button);
      };
      return button;
    };
    shown.forEach(item => track.appendChild(pill(item)));
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

  HOF.dues = { data: () => data, reload: load, reloadSoon };
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
    // Olay tabanlı yenileme (v2.0.2): gün dönümü ya da uzun arka plan sonrası takvim yeniden alınır.
    HOF.on("dues:refresh", () => load());
    HOF.on("live:workspace.changed", change => {
      if (!change) return;
      if (["dues", "activity", "cash", "records", "source"].includes(change.kind) || change.dataset) reloadSoon(800);
    });
    // Gün dönünce (sayfa uzun süre açık kalırsa) takvim yenilenir.
    setInterval(() => {
      const now = new Date();
      const local = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      if (data.today && data.today !== local) load();
    }, 10 * 60_000);
  });
})();
