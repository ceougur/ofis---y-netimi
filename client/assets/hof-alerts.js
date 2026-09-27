/* DestekOfis — sağ alt bildirimler ve bildirim listesi (v2.0.1).
 * Kaynaklar:
 *  - Tahsilat alınmadı: vadesi gelmiş/geçmiş ve ödenmemiş taksit, ödeme sözü, kira… (hof-promises.js → HOF.dues).
 *    Tarih yazılmışsa o günden, ay yazılmışsa ayın 1'inden itibaren; kim, hangi vade, ne kadar bekleniyor yazar.
 *  - Son günü yaklaşan işler (7 gün): tablodaki son tarih kolonları (yenileme, bitiş, teslim, duruşma, vade…),
 *    yaklaşan tahsilatlar ve size atanmış görevler.
 * Bildirimler ekranın sağ altından tek tek gelir, 10 saniye durur (üzerine gelinirse bekler) ve kaybolur; biri
 * kapanmadan diğeri açılmaz. Tahsilat girilene (ya da kalem kapatılana), son tarih geçene ya da görev tamamlanana kadar
 * her 3 saatte bir yeniden gösterilir; bir turda çoksa ilk birkaçından sonra "… daha" özeti gelir. Üst çubuktaki zil düğmesi tüm listeyi açar ve sayıyı rozetle gösterir. */
(() => {
  "use strict";
  const HOF = window.HOF;
  const { esc } = HOF;
  const SHOW_MS = 10_000;
  const GAP_MS = 450;
  const FIRST_BATCH = 5;
  const TASK_AHEAD_DAYS = 7;
  const REPEAT_MS = 3 * 60 * 60 * 1000;

  let tasks = [];
  let queue = [];
  let showing = null;
  let timer = 0;
  let remaining = SHOW_MS;
  let startedAt = 0;
  let shownThisLoad = 0;
  let summaryShown = false;
  let roundStart = 0;

  const localDay = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const money = value => (value === null || value === undefined ? "" : HOF.formatMoney(value));
  const who = item => item.person || item.caseNo || "Kayıt";
  const storeKey = () => `hof-notices:${HOF.user?.id || "?"}`;
  const muteKey = () => `hof-notices-off:${HOF.user?.id || "?"}`;
  const read = key => {
    try {
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch {
      return null;
    }
  };
  const write = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* tarayıcı saklamaya izin vermiyor: bildirimler yine çalışır, yalnızca tekrar gösterilebilir */
    }
  };
  // Son 3 saatte gösterilenler (kimlik → zaman). Süresi dolan yeniden gösterilir.
  const shownMap = () => {
    const stored = read(storeKey());
    const map = stored && typeof stored.shown === "object" && stored.shown ? stored.shown : {};
    const now = Date.now();
    for (const [id, at] of Object.entries(map)) if (!(now - Number(at) < REPEAT_MS)) delete map[id];
    return map;
  };
  const seenRecently = () => new Set(Object.keys(shownMap()));
  const markSeen = ids => {
    const map = shownMap();
    const now = Date.now();
    for (const id of ids) map[id] = now;
    const entries = Object.entries(map).slice(-3000);
    write(storeKey(), { shown: Object.fromEntries(entries) });
  };
  const muted = () => read(muteKey()) === true;

  // ---------- Bildirim listesi ----------
  function taskAlerts() {
    const today = new Date(`${localDay()}T00:00:00`);
    const out = [];
    for (const task of tasks) {
      if (!task.dueDate) continue;
      const due = new Date(`${String(task.dueDate).slice(0, 10)}T00:00:00`);
      if (Number.isNaN(due.getTime())) continue;
      const days = Math.round((due - today) / 86_400_000);
      if (days > TASK_AHEAD_DAYS || days < -30) continue;
      out.push({
        id: `task|${task.id}|${task.dueDate}`,
        type: "task",
        tone: days < 0 ? "late" : days <= 1 ? "soon" : "info",
        eyebrow: days < 0 ? `GÖREV GECİKTİ · ${Math.abs(days)} GÜN` : days === 0 ? "GÖREVİN SON GÜNÜ BUGÜN" : `GÖREVİN SON GÜNÜNE ${days} GÜN`,
        title: task.title,
        when: days < 0 ? `${Math.abs(days)} gün gecikti` : days === 0 ? "Bugün" : days === 1 ? "Yarın" : `${days} gün kaldı`,
        text: `Son tarih ${due.toLocaleDateString("tr-TR")}${task.actorName ? ` · veren ${task.actorName}` : ""}`,
        caseKey: task.caseKey || "",
        days,
        rank: days < 0 ? 1 : 3,
      });
    }
    return out;
  }

  // Zil listesinden kaldırılanlar (kişiye özel, sunucuda; v2.0.2).
  let dismissed = new Set();
  async function loadDismissed() {
    try {
      dismissed = new Set((await HOF.api("/api/workspace/alerts/dismissed")).ids || []);
      updateBadge();
    } catch {
      // okunamazsa hiçbiri kaldırılmamış sayılır
    }
  }
  async function dismiss(item, undo = false) {
    if (undo) dismissed.delete(item.id);
    else dismissed.add(item.id);
    updateBadge();
    try {
      const result = await HOF.api("/api/workspace/alerts/dismiss", { method: "POST", body: { id: item.id, undo } });
      dismissed = new Set(result.ids || []);
    } catch (error) {
      HOF.toastError(error);
    }
    updateBadge();
    if (!undo) {
      HOF.toast(`${item.title} bildirimi listenizden kaldırıldı.`, { action: { label: "Geri al", onClick: () => dismiss(item, true) } });
    }
  }

  function alerts() {
    const data = HOF.dues?.data() || { items: [], deadlines: [] };
    const out = [];
    for (const item of data.items || []) {
      const due = item.state !== "upcoming";
      if (!due && item.days > 7) continue;
      const amount = item.amount ? `${money(item.amount)}${item.partial ? " (kalan)" : ""}` : "tutar yazılmamış";
      out.push({
        id: `${due ? "unpaid" : "soon"}|${item.id}`,
        type: due ? "unpaid" : "upcoming",
        tone: due ? (item.state === "overdue" ? "late" : "soon") : "info",
        eyebrow: due
          ? item.state === "overdue"
            ? `TAHSİLAT ALINMADI · ${Math.abs(item.days)} GÜN GECİKTİ`
            : item.state === "month"
              ? "TAHSİLAT ALINMADI · BU AYIN ÖDEMESİ"
              : "TAHSİLAT ALINMADI · VADESİ BUGÜN"
          : item.days === 1
            ? "YARIN TAHSİLAT VAR"
            : `${item.days} GÜN SONRA TAHSİLAT VAR`,
        title: who(item),
        when: item.state === "overdue" ? `${Math.abs(item.days)} gün gecikti` : item.state === "month" ? "Bu ay" : item.state === "today" ? "Bugün" : item.days === 1 ? "Yarın" : `${item.days} gün kaldı`,
        text: `${item.caseNo && item.person ? `${item.caseNo} · ` : ""}${item.label} · ${item.kind === "month" ? item.dueText : `vade ${item.dueText}`} · ${amount}`,
        caseKey: item.caseKey,
        tab: item.tab,
        due: item,
        days: item.days,
        rank: due ? 0 : 4,
      });
    }
    for (const item of data.deadlines || []) {
      // Planlı tarih (randevu, duruşma, sınav, teslim): "son gün" değil, yaklaşan bir olaydır (v2.0.2).
      const planned = item.type === "event";
      const soon = item.days === 0 ? "BUGÜN" : item.days === 1 ? "YARIN" : `${item.days} GÜN SONRA`;
      out.push({
        id: `deadline|${item.id}`,
        type: planned ? "event" : "deadline",
        tone: item.days < 0 ? "late" : item.days <= 1 ? "soon" : "info",
        eyebrow: planned ? `${soon} · ${item.label.toLocaleUpperCase("tr-TR")}` : item.days < 0 ? `SÜRESİ GEÇTİ · ${Math.abs(item.days)} GÜN` : item.days === 0 ? "SON GÜN BUGÜN" : item.days === 1 ? "SON GÜN YARIN" : `SON GÜNE ${item.days} GÜN`,
        title: who(item),
        when: planned ? (item.days === 0 ? "Bugün" : item.days === 1 ? "Yarın" : `${item.days} gün sonra`) : item.days < 0 ? `Süresi ${Math.abs(item.days)} gün önce geçti` : item.days === 0 ? "Bugün" : item.days === 1 ? "Yarın" : `${item.days} gün kaldı`,
        text: `${item.caseNo && item.person ? `${item.caseNo} · ` : ""}${item.label} · ${item.dueText}`,
        caseKey: item.caseKey,
        tab: item.tab,
        days: item.days,
        rank: planned ? 3 : item.days < 0 ? 1 : 2,
      });
    }
    out.push(...taskAlerts());
    // Kişinin zil listesinden kaldırdıkları (v2.0.2) ne listede ne sağ altta görünür.
    for (let index = out.length - 1; index >= 0; index -= 1) if (dismissed.has(out[index].id)) out.splice(index, 1);
    // Önce alınmayan tahsilatlar (en çok gecikenden), sonra geciken görevler, son günler, yaklaşanlar.
    out.sort((a, b) => a.rank - b.rank || (a.rank === 0 ? a.days - b.days : a.days - b.days) || a.title.localeCompare(b.title, "tr"));
    return out;
  }

  // ---------- Sağ alt bildirim kuyruğu ----------
  function host() {
    let node = document.getElementById("hof-notices");
    if (!node) {
      node = HOF.el("div", { id: "hof-notices", class: "hof-notices", "aria-live": "polite", "aria-atomic": "false" });
      document.body.appendChild(node);
    }
    return node;
  }

  function schedule() {
    if (showing || !queue.length || muted() || document.hidden || !HOF.user) return;
    const next = queue.shift();
    show(next);
  }

  // Tahsilat penceresi tutar ve açıklama hazır açılır; kaydedince kalem takvimden düşer.
  const canPay = () => HOF.can("payments.create") && Boolean(HOF.workspace?.payment);
  const pay = item =>
    HOF.workspace.payment({ key: item.caseKey, title: who(item), amount: item.amount, note: `${item.label} · ${item.dueText}`, intro: `<b>${esc(item.label)}</b> · vade ${esc(item.dueText)}${item.amount ? ` · beklenen <b>${esc(money(item.amount))}</b>` : ""}.` });

  function show(alert) {
    showing = alert;
    const index = alert.summary ? "" : `${alert.position}/${alert.total}`;
    const canPayNow = alert.type === "unpaid" && canPay();
    const node = HOF.el(
      "div",
      { class: `hof-notice is-${alert.tone}`, role: alert.tone === "late" ? "alert" : "status" },
      `<span class="hof-notice-icon" aria-hidden="true">${alert.type === "unpaid" || alert.type === "upcoming" ? "₺" : alert.type === "task" ? "✓" : alert.summary ? "🔔" : "⏰"}</span>
      <div class="hof-notice-body">
        <p class="hof-notice-eyebrow">${esc(alert.eyebrow)}</p>
        <b class="hof-notice-title">${esc(alert.title)}</b>
        <p class="hof-notice-text">${esc(alert.text)}</p>
        <div class="hof-notice-actions">
          ${canPayNow ? '<button type="button" data-act="pay">Tahsilat gir</button>' : ""}
          ${alert.caseKey ? '<button type="button" data-act="go">Kayda git</button>' : ""}
          ${alert.summary ? '<button type="button" data-act="list">Tümünü gör</button>' : ""}
          ${alert.type === "task" && !alert.caseKey ? '<button type="button" data-act="tasks">Görevler</button>' : ""}
        </div>
      </div>
      <div class="hof-notice-side">
        <button type="button" class="hof-notice-close" data-act="close" aria-label="Bildirimi kapat">×</button>
        ${index ? `<span class="hof-notice-count">${index}</span>` : ""}
      </div>
      <span class="hof-notice-progress" aria-hidden="true"><i></i></span>`,
    );
    node.addEventListener("click", event => {
      const button = event.target.closest("[data-act]");
      if (!button) return;
      const act = button.dataset.act;
      if (act === "pay") pay(alert.due);
      else if (act === "go") HOF.revealRecord?.(alert.caseKey, { tab: alert.tab || "" });
      else if (act === "list") openPanel();
      else if (act === "tasks") HOF.workspace?.openTasks?.();
      hide(node);
    });
    // Üzerine gelince ya da klavyeyle odaklanınca süre durur.
    const pause = () => {
      if (!timer) return;
      clearTimeout(timer);
      timer = 0;
      remaining -= Date.now() - startedAt;
      node.classList.add("is-paused");
    };
    const resume = () => {
      if (timer || !node.isConnected) return;
      node.classList.remove("is-paused");
      startedAt = Date.now();
      timer = setTimeout(() => hide(node), Math.max(1200, remaining));
    };
    node.addEventListener("mouseenter", pause);
    node.addEventListener("mouseleave", resume);
    node.addEventListener("focusin", pause);
    node.addEventListener("focusout", event => {
      if (!node.contains(event.relatedTarget)) resume();
    });
    host().appendChild(node);
    node.style.setProperty("--hof-notice-ms", `${SHOW_MS}ms`);
    requestAnimationFrame(() => node.classList.add("is-visible"));
    document.body.classList.add("hof-notice-open");
    remaining = SHOW_MS;
    startedAt = Date.now();
    timer = setTimeout(() => hide(node), SHOW_MS);
    if (!alert.summary) markSeen([alert.id]);
  }

  function hide(node) {
    clearTimeout(timer);
    timer = 0;
    if (!node.isConnected) return;
    node.classList.remove("is-visible");
    node.classList.add("is-leaving");
    setTimeout(() => {
      node.remove();
      showing = null;
      if (!document.querySelector(".hof-notice")) document.body.classList.remove("hof-notice-open");
      setTimeout(schedule, GAP_MS);
    }, 260);
  }

  // Yeni (bugün gösterilmemiş) bildirimleri kuyruğa ekler. Sayfa açılışında çoksa ilk birkaçı ve bir özet gelir.
  function enqueue() {
    if (!HOF.user || muted()) return;
    const all = alerts();
    updateBadge(all);
    // Yeni tur (3 saatte bir): yine ilk birkaç bildirim ve bir özet.
    if (Date.now() - roundStart >= REPEAT_MS) {
      roundStart = Date.now();
      shownThisLoad = 0;
      summaryShown = false;
    }
    const seen = seenRecently();
    const queued = new Set(queue.map(item => item.id));
    const fresh = all.filter(item => !seen.has(item.id) && !queued.has(item.id) && item.id !== showing?.id && item.type !== "upcoming");
    const upcoming = all.filter(item => !seen.has(item.id) && !queued.has(item.id) && item.id !== showing?.id && item.type === "upcoming");
    const candidates = [...fresh, ...upcoming];
    if (!candidates.length) return;
    const room = Math.max(0, FIRST_BATCH - shownThisLoad);
    const batch = candidates.slice(0, room);
    const rest = candidates.slice(room);
    const total = batch.length;
    batch.forEach((item, index) => queue.push({ ...item, position: index + 1, total }));
    shownThisLoad += batch.length;
    if (rest.length && !summaryShown) {
      summaryShown = true;
      const late = rest.filter(item => item.type === "unpaid").length;
      queue.push({ id: `summary|${roundStart}`, summary: true, tone: late ? "late" : "info", type: "summary", eyebrow: "BİLDİRİMLER", title: `${rest.length} bildirim daha var`, text: late ? `${late} tahsilat alınmadı; diğerleri son günü yaklaşan işler.` : "Son günü yaklaşan işler ve yaklaşan tahsilatlar." });
      markSeen(rest.map(item => item.id));
    } else if (rest.length) markSeen(rest.map(item => item.id));
    schedule();
  }

  // ---------- Zil: tüm liste ----------
  function bell() {
    return document.querySelector(".topbar .top-actions > .icon-button");
  }
  function updateBadge(list = alerts()) {
    const button = bell();
    if (!button) return;
    const count = list.filter(item => item.type !== "upcoming").length;
    button.setAttribute("aria-label", count ? `Bildirimler: ${count}` : "Bildirimler");
    button.title = count ? `${count} bildirim` : "Bildirim yok";
    let badge = button.querySelector(":scope > .hof-bell-badge");
    if (!count) {
      badge?.remove();
      return;
    }
    if (!badge) {
      badge = HOF.el("span", { class: "hof-bell-badge", "aria-hidden": "true" });
      button.appendChild(badge);
    }
    const text = count > 99 ? "99+" : String(count);
    if (badge.textContent !== text) badge.textContent = text;
    badge.classList.toggle("is-late", list.some(item => item.type === "unpaid" && item.tone === "late"));
  }

  function openPanel() {
    const list = alerts();
    const groups = [
      ["Tahsilat alınmadı", list.filter(item => item.type === "unpaid")],
      ["Son günü yaklaşan ya da geçen işler", list.filter(item => item.type === "deadline")],
      ["Yaklaşan randevu ve planlı tarihler", list.filter(item => item.type === "event")],
      ["Görevler", list.filter(item => item.type === "task")],
      ["Yaklaşan tahsilatlar (7 gün)", list.filter(item => item.type === "upcoming")],
    ].filter(([, items]) => items.length);
    const body = groups.length
      ? groups
          .map(
            ([title, items]) => `<section class="hof-alert-group"><h3>${esc(title)} <span>${items.length}</span></h3><ul>${items
              .map(
                (item, index) => `<li class="is-${esc(item.tone)}"><span class="hof-alert-when">${esc(item.when || "")}</span><span class="hof-alert-main"><b>${esc(item.title)}</b><small>${esc(item.text)}</small></span><span class="hof-alert-buttons"><button type="button" class="hof-alert-dismiss" data-dismiss="${esc(title)}|${index}" title="Bu bildirimi listemden kaldır" aria-label="Bildirimi kaldır">✕</button>${item.due && canPay() ? `<button type="button" class="hof-button hof-button-small" data-pay="${esc(title)}|${index}">Tahsilat gir</button>` : ""}${item.caseKey ? `<button type="button" class="hof-button hof-button-small hof-button-ghost" data-go="${esc(title)}|${index}">Kayda git</button>` : ""}</span></li>`,
              )
              .join("")}</ul></section>`,
          )
          .join("")
      : '<p class="hof-empty">Şu an bildirim yok. Vadesi gelen tahsilatlar, son günü yaklaşan işler ve görevler burada görünür.</p>';
    const modal = HOF.modal({
      title: "Bildirimler",
      eyebrow: "DESTEKOFİS",
      size: "wide",
      body: `<div class="hof-alert-list">${body}</div><label class="hof-check hof-alert-mute"><input type="checkbox" ${muted() ? "" : "checked"}><span>Sağ altta açılır bildirim göster (10 saniye; tahsilat girilene ya da iş bitene kadar 3 saatte bir)</span></label>`,
    });
    modal.dialog.addEventListener("click", event => {
      const button = event.target.closest("[data-go], [data-pay], [data-dismiss]");
      if (!button) return;
      const [title, index] = (button.dataset.go || button.dataset.pay || button.dataset.dismiss).split("|");
      const item = groups.find(([name]) => name === title)?.[1][Number(index)];
      if (!item) return;
      if (button.dataset.dismiss) {
        const row = button.closest("li");
        row?.classList.add("is-leaving");
        setTimeout(() => {
          const list = row?.parentElement;
          row?.remove();
          const group = list?.closest(".hof-alert-group");
          if (group) {
            const left = group.querySelectorAll("li").length;
            if (!left) group.remove();
            else group.querySelector("h3 span").textContent = String(left);
          }
        }, 180);
        dismiss(item);
        return;
      }
      modal.close();
      if (button.dataset.pay) pay(item.due);
      else HOF.revealRecord?.(item.caseKey, { tab: item.tab || "" });
    });
    modal.dialog.querySelector(".hof-alert-mute input").addEventListener("change", event => {
      write(muteKey(), !event.target.checked);
      if (event.target.checked) enqueue();
    });
  }

  async function loadTasks() {
    try {
      tasks = await HOF.api("/api/workspace/tasks?status=open&mine=1");
    } catch {
      tasks = [];
    }
    enqueue();
  }
  const tasksSoon = (() => {
    let timer = 0;
    return () => {
      clearTimeout(timer);
      timer = setTimeout(loadTasks, 800);
    };
  })();

  // Zil düğmesi (paketin üst çubuğundaki, önceden işlevsiz düğme) bildirim listesini açar.
  document.addEventListener(
    "click",
    event => {
      const button = event.target.closest(".topbar .top-actions > .icon-button");
      if (!button) return;
      event.preventDefault();
      openPanel();
    },
    true,
  );
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) schedule();
  });

  HOF.whenReady(() => {
    // Açılışta ekran yerleşsin diye bir süre beklenir; takvim geldikçe yeni bildirimler kuyruğa girer.
    // Kaldırılanlar önce gelir; ilk bildirim kuyruğu kaldırılanları göstermesin.
    loadDismissed().finally(() => setTimeout(loadTasks, 2500));
    HOF.on("dues", () => setTimeout(enqueue, 300));
    HOF.on("live:workspace.changed", change => {
      if (change?.kind === "task") tasksSoon();
    });
    HOF.onDom(() => updateBadge());
    // Program açık kaldıkça 3 saati dolan bildirimler yeniden kuyruğa girer.
    setInterval(enqueue, 5 * 60_000);
  });
  HOF.alerts = { open: openPanel, list: alerts, enqueue };
})();
