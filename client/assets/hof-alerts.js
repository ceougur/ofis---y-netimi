/* DestekOfis — sağ alt bildirimler ve bildirim listesi (v2.0.1).
 * Kaynaklar:
 *  - Tahsilat alınmadı: vadesi gelmiş/geçmiş ve ödenmemiş taksit, ödeme sözü, kira… (hof-promises.js → HOF.dues).
 *    Tarih yazılmışsa o günden, ay yazılmışsa ayın 1'inden itibaren; kim, hangi vade, ne kadar bekleniyor yazar.
 *  - Son günü yaklaşan işler (7 gün): tablodaki son tarih kolonları (yenileme, bitiş, teslim, duruşma, vade…),
 *    yaklaşan tahsilatlar ve size atanmış görevler.
 * Bildirimler ekranın sağ altından tek tek gelir, 20 saniye durur (üzerine gelinirse bekler) ve kaybolur; biri
 * kapanmadan diğeri açılmaz, ikisinin arasında 10 saniye boşluk olur, bir pencere açıkken beklenir (v2.0.2). Kısa
 * bildirimler (toast) açık bildirimin yüksekliği kadar yukarıda durur: hiçbir zaman üst üste binmez.
 * "Gerçekleştirildi" (v2.0.2): iş yapıldıysa uyarıya sebep olan hücreye "Gerçekleştirildi" yazılır (tarih korunur:
 * "Gerçekleştirildi · 15.10.2026") ve uyarı bir daha gelmez; her ay tekrarlayan ödeme gününde ayar hücresine
 * dokunulmaz, yalnızca o ayın kalemi kapanır; görevde görev tamamlanır. Hepsi "Geri al" ile geri alınır.
 * Tahsilat girilene (ya da kalem kapatılana), son tarih geçene ya da görev tamamlanana kadar
 * her 3 saatte bir yeniden gösterilir; bir turda çoksa ilk birkaçından sonra "… daha" özeti gelir. Üst çubuktaki zil düğmesi tüm listeyi açar ve sayıyı rozetle gösterir. */
(() => {
  "use strict";
  const HOF = window.HOF;
  const { esc } = HOF;
  const SHOW_MS = 20_000;
  const GAP_MS = 10_000; // iki bildirim arasında
  const LEAVE_MS = 260;
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
  let lastHiddenAt = 0;
  let waitTimer = 0;

  const localDay = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const money = value => (value === null || value === undefined ? "" : HOF.formatMoney(value));
  const who = item => `${item.person || item.caseNo || "Kayıt"}${item.foreign && item.pageName ? ` · ${item.pageName}` : ""}`;
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
  // Görevler: son tarihi 7 gün içinde olan ya da geçen görevler. Acil görev (v2.0.5) son tarihten bağımsız olarak
  // tamamlanana kadar kırmızı uyarı verir ve listenin en üstünde durur.
  function taskAlerts() {
    const today = new Date(`${localDay()}T00:00:00`);
    const out = [];
    for (const task of tasks) {
      const urgent = task.priority === "urgent";
      const due = task.dueDate ? new Date(`${String(task.dueDate).slice(0, 10)}T00:00:00`) : null;
      const dated = due && !Number.isNaN(due.getTime());
      if (!dated && !urgent) continue;
      const days = dated ? Math.round((due - today) / 86_400_000) : null;
      if (!urgent && (days > TASK_AHEAD_DAYS || days < -30)) continue;
      const dueText = !dated ? "" : days < 0 ? `${Math.abs(days)} GÜN GECİKTİ` : days === 0 ? "SON GÜN BUGÜN" : days === 1 ? "SON GÜN YARIN" : `SON GÜNE ${days} GÜN`;
      out.push({
        id: `task|${task.id}|${task.dueDate || ""}${urgent ? "|acil" : ""}`,
        type: "task",
        urgent,
        tone: urgent || days < 0 ? "late" : days <= 1 ? "soon" : "info",
        eyebrow: urgent ? `ACİL GÖREV${dueText ? ` · ${dueText}` : ""}` : days < 0 ? `GÖREV GECİKTİ · ${Math.abs(days)} GÜN` : days === 0 ? "GÖREVİN SON GÜNÜ BUGÜN" : `GÖREVİN SON GÜNÜNE ${days} GÜN`,
        title: task.title,
        when: !dated ? "Acil" : days < 0 ? `${Math.abs(days)} gün gecikti` : days === 0 ? "Bugün" : days === 1 ? "Yarın" : `${days} gün kaldı`,
        text: `${dated ? `Son tarih ${due.toLocaleDateString("tr-TR")}` : "Son tarih yok"}${task.actorName ? ` · veren ${task.actorName}` : ""}`,
        caseKey: task.caseKey || "",
        taskId: task.id,
        days: dated ? days : -9999,
        rank: urgent ? -1 : days < 0 ? 1 : 3,
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
      HOF.toast(`${item.title} bildirimi listenizden kaldırıldı.`, { action: { label: "Geri Al", onClick: () => dismiss(item, true) } });
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
        planId: item.planId || "",
        due: item,
        item,
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
        item,
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

  // Bir bildirim açıkken, iki bildirim arasındaki 10 saniye dolmadan ya da bir pencere (form, onay) açıkken yenisi
  // gelmez; akış kendiliğinden sürer.
  function schedule() {
    clearTimeout(waitTimer);
    waitTimer = 0;
    if (showing || !queue.length || muted() || document.hidden || !HOF.user) return;
    const wait = Math.max(lastHiddenAt ? GAP_MS - (Date.now() - lastHiddenAt) : 0, document.querySelector(".hof-modal-backdrop") ? 2_000 : 0);
    if (wait > 0) {
      waitTimer = setTimeout(schedule, wait);
      return;
    }
    show(queue.shift());
  }

  // Tahsilat penceresi tutar ve açıklama hazır açılır; kaydedince kalem takvimden düşer.
  // Taksit kartı kalemi (v2.0.4): tahsilat kartın üstünden girilir (hof-plans.js).
  const isPlan = item => item?.source === "plan";
  // Çek / senet kalemi (v2.0.7): tahsil ve ödeme evrak kartından yapılır (hof-cheques.js).
  const isCheque = item => item?.source === "cheque";
  const canPay = item => (isCheque(item) ? HOF.can("cheques.manage") && Boolean(HOF.cheques) : isPlan(item) ? HOF.can("plans.collect") && Boolean(HOF.plans) : HOF.can("payments.create") && Boolean(HOF.workspace?.payment));
  const pay = item =>
    isCheque(item)
      ? HOF.cheques.open({ id: item.chequeId, action: item.direction === "out" ? "pay" : "collect" })
      : isPlan(item)
      ? HOF.plans.pay(item)
      : HOF.workspace.payment({ key: item.caseKey, title: who(item), amount: item.amount, note: `${item.label} · ${item.dueText}`, intro: `<b>${esc(item.label)}</b> · vade ${esc(item.dueText)}${item.amount ? ` · beklenen <b>${esc(money(item.amount))}</b>` : ""}.` });

  // ---------- Gerçekleştirildi (v2.0.2) ----------
  const DONE_TEXT = "Gerçekleştirildi";
  const OPEN_MARK = /^(-|–|—|0|x|yok|ödenmedi|odenmedi|ödemedi|ödenmemiş|bekliyor|borç|borçlu|hayır|h)$/i;
  // Hücredeki bilgi kaybolmaz: "15.10.2026" → "Gerçekleştirildi · 15.10.2026"; boş ya da "ödenmedi" → "Gerçekleştirildi".
  const doneValue = original => {
    const text = String(original ?? "").trim();
    if (!text || OPEN_MARK.test(text)) return DONE_TEXT;
    if (/^gerçekleştiril/i.test(text)) return text;
    return `${DONE_TEXT} · ${text}`;
  };
  const rowOf = (key, tab) => {
    const rows = HOF.data?.rows || [];
    return rows.find(row => row.__hofKey === key && (!tab || row.__sheet === tab)) || rows.find(row => row.__hofKey === key) || null;
  };
  const canDone = alert => {
    if (alert.type === "task") return Boolean(alert.taskId) && HOF.can("tasks.complete");
    if (!alert.item || !HOF.can("records.edit") || isPlan(alert.item) || isCheque(alert.item)) return false;
    // Başka sayfanın kaydı (2.0.25): işaret açık sayfaya yazılırdı (yanlış sayfa, uyarı kapanmazdı); "Kayda Git" ile o
    // sayfaya geçilip orada işaretlenir.
    if (alert.item.foreign) return false;
    return alert.item.recurring ? String(alert.item.id || "").startsWith("due|") : Boolean(alert.item.column);
  };
  const doneHint = alert =>
    alert.type === "task"
      ? "Bu iş yapıldıysa tıklayın: görev tamamlandı olarak işaretlenir, bu uyarı tekrarlanmaz."
      : alert.item?.recurring
        ? "Bu işlem yapıldıysa tıklayın: bu ayın kalemi kapanır, bu uyarı tekrarlanmaz."
        : `Bu işlem yapıldıysa tıklayın: “${alert.item?.column || "ilgili"}” hücresine “Gerçekleştirildi” yazılır, bu uyarı tekrarlanmaz.`;

  async function markDone(alert) {
    try {
      let undo = null;
      let message = "";
      if (alert.type === "task") {
        await HOF.api(`/api/workspace/tasks/${encodeURIComponent(alert.taskId)}/complete`, { method: "POST" });
        tasks = tasks.filter(task => task.id !== alert.taskId);
        message = `“${alert.title}” görevi tamamlandı.`;
      } else if (alert.item.recurring) {
        await HOF.api("/api/workspace/dues/settle", { method: "POST", body: { id: alert.item.id, reason: "paid" } });
        undo = () => HOF.api("/api/workspace/dues/settle", { method: "POST", body: { id: alert.item.id, undo: true } });
        message = `${alert.title} · ${alert.item.label} (${alert.item.dueText}) gerçekleştirildi olarak kapandı.`;
      } else {
        const field = alert.item.column;
        const row = rowOf(alert.caseKey, alert.tab);
        const original = row ? String(row[field] ?? "") : "";
        const value = doneValue(original);
        await HOF.api("/api/workspace/overrides", { method: "POST", body: { sourceName: HOF.sourceName(), caseKey: alert.caseKey, field, value, action: "alert.done" } });
        undo = () => HOF.api("/api/workspace/overrides", { method: "POST", body: { sourceName: HOF.sourceName(), caseKey: alert.caseKey, field, value: original, action: "alert.undone" } });
        message = `${alert.title} · “${HOF.columnLabel ? HOF.columnLabel(field) : field}” hücresine “${value}” yazıldı.`;
      }
      queue = queue.filter(item => item.id !== alert.id);
      markSeen([alert.id]);
      HOF.refreshData();
      HOF.dues?.reloadSoon?.(200);
      updateBadge(alerts().filter(item => item.id !== alert.id));
      HOF.toast(message, {
        type: "success",
        timeout: 7000,
        action: undo
          ? {
              label: "Geri Al",
              onClick: async () => {
                try {
                  await undo();
                  HOF.refreshData();
                  HOF.dues?.reloadSoon?.(200);
                } catch (error) {
                  HOF.toastError(error);
                }
              },
            }
          : undefined,
      });
      return true;
    } catch (error) {
      HOF.toastError(error);
      return false;
    }
  }

  // Kısa bildirimler (toast) açık bildirimin hemen üstünde durur: yükseklik değiştikçe boşluk da değişir.
  let noticeSize = null;
  const reserve = node => {
    const apply = () => document.body.style.setProperty("--hof-notice-space", `${Math.ceil(node.getBoundingClientRect().height) + 12}px`);
    apply();
    noticeSize?.disconnect();
    if (typeof ResizeObserver === "function") {
      noticeSize = new ResizeObserver(apply);
      noticeSize.observe(node);
    }
  };

  function show(alert) {
    showing = alert;
    const index = alert.summary ? "" : `${alert.position}/${alert.total}`;
    const canPayNow = alert.type === "unpaid" && canPay(alert.due);
    const node = HOF.el(
      "div",
      { class: `hof-notice is-${alert.tone}`, role: alert.tone === "late" ? "alert" : "status" },
      `<span class="hof-notice-icon" aria-hidden="true">${alert.type === "unpaid" || alert.type === "upcoming" ? "₺" : alert.urgent ? "!" : alert.type === "task" ? "✓" : alert.summary ? "🔔" : "⏰"}</span>
      <div class="hof-notice-body">
        <p class="hof-notice-eyebrow">${esc(alert.eyebrow)}</p>
        <b class="hof-notice-title">${esc(alert.title)}</b>
        <p class="hof-notice-text">${esc(alert.text)}</p>
        <div class="hof-notice-actions">
          ${canPayNow ? '<button type="button" data-act="pay">Tahsilat Gir</button>' : ""}
          ${canDone(alert) ? '<button type="button" class="is-done" data-act="done">✓ Gerçekleştirildi</button>' : ""}
          ${alert.caseKey ? '<button type="button" data-act="go">Kayda Git</button>' : ""}
          ${alert.planId ? '<button type="button" data-act="plan">Taksit Kartı</button>' : ""}
          ${alert.summary ? '<button type="button" data-act="list">Tümünü Gör</button>' : ""}
          ${alert.type === "task" && !alert.caseKey ? '<button type="button" data-act="tasks">Görevler</button>' : ""}
        </div>
        ${canDone(alert) ? `<p class="hof-notice-hint">${esc(doneHint(alert))}</p>` : ""}
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
      if (act === "done") markDone(alert);
      else if (act === "pay") pay(alert.due);
      else if (act === "go") (alert.item?.foreign || alert.due?.foreign ? HOF.sessions?.select?.((alert.item || alert.due).session, { reveal: { caseKey: alert.caseKey, tab: alert.tab || (alert.item || alert.due).tab || "" } }) : HOF.revealRecord?.(alert.caseKey, { tab: alert.tab || "" }));
      else if (act === "plan") HOF.plans?.open(alert.planId);
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
    reserve(node);
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
      lastHiddenAt = Date.now();
      noticeSize?.disconnect();
      noticeSize = null;
      if (!document.querySelector(".hof-notice")) document.body.classList.remove("hof-notice-open");
      schedule();
    }, LEAVE_MS);
  }

  // Yeni (bugün gösterilmemiş) bildirimleri kuyruğa ekler. Sayfa açılışında çoksa ilk birkaçı ve bir özet gelir.
  let lastRefreshAt = Date.now();
  function enqueue() {
    if (!HOF.user || muted()) return;
    lastRefreshAt = Date.now();
    const all = alerts();
    updateBadge(all);
    // v2.0.10: kapanan kalemin (tahsilat girildi, çek ödendi, taksit alındı, başka bilgisayarda kapatıldı) bekleyen ve
    // ekrandaki bildirimi de düşer; program yeniden açılmayı beklemez.
    const current = new Set(all.map(item => item.id));
    queue = queue.filter(item => item.summary || current.has(item.id));
    if (showing && !showing.summary && !current.has(showing.id)) {
      const node = document.querySelector("#hof-notices .hof-notice.is-visible") || document.querySelector("#hof-notices .hof-notice");
      if (node) hide(node);
    }
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
    // Acil görev (v2.0.5) tur sınırına takılmaz: kuyruğun başına girer ve sıradaki bildirim olarak gösterilir.
    const urgent = fresh.filter(item => item.urgent);
    if (urgent.length) {
      queue = [...urgent.map((item, index) => ({ ...item, position: index + 1, total: urgent.length })), ...queue];
    }
    const candidates = [...fresh.filter(item => !item.urgent), ...upcoming];
    if (!candidates.length) {
      if (urgent.length) schedule();
      return;
    }
    const room = Math.max(0, FIRST_BATCH - shownThisLoad);
    const batch = candidates.slice(0, room);
    const rest = candidates.slice(room);
    const total = batch.length;
    batch.forEach((item, index) => queue.push({ ...item, position: index + 1, total }));
    shownThisLoad += batch.length;
    if (rest.length && !summaryShown) {
      summaryShown = true;
      const late = rest.filter(item => item.type === "unpaid").length + rest.filter(item => item.urgent).length;
      queue.push({ id: `summary|${roundStart}`, summary: true, tone: late ? "late" : "info", type: "summary", eyebrow: "BİLDİRİMLER", title: `${rest.length} bildirim daha var`, text: late ? `${late} acil iş ya da alınmayan tahsilat; diğerleri son günü yaklaşan işler.` : "Son günü yaklaşan işler ve yaklaşan tahsilatlar." });
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
    badge.classList.toggle("is-late", list.some(item => (item.type === "unpaid" && item.tone === "late") || item.urgent));
  }

  function openPanel() {
    const list = alerts();
    const groups = [
      ["Acil görevler", list.filter(item => item.urgent)],
      ["Tahsilat alınmadı", list.filter(item => item.type === "unpaid")],
      ["Son günü yaklaşan ya da geçen işler", list.filter(item => item.type === "deadline")],
      ["Yaklaşan randevu ve planlı tarihler", list.filter(item => item.type === "event")],
      ["Görevler", list.filter(item => item.type === "task" && !item.urgent)],
      ["Yaklaşan tahsilatlar (7 gün)", list.filter(item => item.type === "upcoming")],
    ].filter(([, items]) => items.length);
    const body = groups.length
      ? groups
          .map(
            ([title, items]) => `<section class="hof-alert-group"><h3>${esc(title)} <span>${items.length}</span></h3><ul>${items
              .map(
                (item, index) => `<li class="is-${esc(item.tone)}"><span class="hof-alert-when">${esc(item.when || "")}</span><span class="hof-alert-main"><b>${esc(item.title)}</b><small>${esc(item.text)}</small></span><span class="hof-alert-buttons"><button type="button" class="hof-alert-dismiss" data-dismiss="${esc(title)}|${index}" title="Bu bildirimi listemden kaldır" aria-label="Bildirimi kaldır">✕</button>${canDone(item) ? `<button type="button" class="hof-button hof-button-small hof-button-done" data-done="${esc(title)}|${index}" title="${esc(doneHint(item))}">✓ Gerçekleştirildi</button>` : ""}${item.due && canPay(item.due) ? `<button type="button" class="hof-button hof-button-small" data-pay="${esc(title)}|${index}">Tahsilat Gir</button>` : ""}${item.caseKey ? `<button type="button" class="hof-button hof-button-small hof-button-ghost" data-go="${esc(title)}|${index}">Kayda Git</button>` : ""}${item.planId ? `<button type="button" class="hof-button hof-button-small hof-button-ghost" data-plan="${esc(title)}|${index}">Taksit Kartı</button>` : ""}</span></li>`,
              )
              .join("")}</ul></section>`,
          )
          .join("")
      : '<p class="hof-empty">Şu an bildirim yok. Vadesi gelen tahsilatlar, son günü yaklaşan işler ve görevler burada görünür.</p>';
    const modal = HOF.modal({
      title: "Bildirimler",
      eyebrow: "DESTEKOFİS",
      size: "wide",
      body: `<div class="hof-alert-list">${body}</div><label class="hof-check hof-alert-mute"><input type="checkbox" ${muted() ? "" : "checked"}><span>Sağ altta açılır bildirim göster (her biri 20 saniye, aralarında 10 saniye; tahsilat girilene ya da iş bitene kadar 3 saatte bir)</span></label>`,
    });
    modal.dialog.addEventListener("click", async event => {
      const button = event.target.closest("[data-go], [data-pay], [data-dismiss], [data-done], [data-plan]");
      if (!button) return;
      const [title, index] = (button.dataset.go || button.dataset.pay || button.dataset.dismiss || button.dataset.done || button.dataset.plan).split("|");
      const item = groups.find(([name]) => name === title)?.[1][Number(index)];
      if (!item) return;
      if (button.dataset.dismiss || button.dataset.done) {
        if (button.dataset.done) {
          button.disabled = true;
          if (!(await markDone(item))) {
            button.disabled = false;
            return;
          }
        }
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
        if (button.dataset.dismiss) dismiss(item);
        return;
      }
      modal.close();
      if (button.dataset.pay) pay(item.due);
      else if (button.dataset.plan) HOF.plans?.open(item.planId);
      else if (item.item?.foreign || item.due?.foreign) HOF.sessions?.select?.((item.item || item.due).session, { reveal: { caseKey: item.caseKey, tab: item.tab || (item.item || item.due).tab || "" } });
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
    // Olay tabanlı akış (v2.0.2): gün dönümünde sunucu "alerts.refresh" gönderir; takvim yeniden alınır (sunucuda
    // parmak izi değiştiği için bir kez hesaplanır). Sekme uzun süre arka planda kaldıysa görünür olunca da yenilenir.
    HOF.on("live:alerts.refresh", () => {
      HOF.emit("dues:refresh");
      setTimeout(enqueue, 800);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden || !HOF.user) return;
      if (Date.now() - lastRefreshAt > 10 * 60_000) HOF.emit("dues:refresh");
    });
    HOF.on("live:workspace.changed", change => {
      if (change?.kind === "task") tasksSoon();
    });
    HOF.onDom(() => updateBadge());
    // Program açık kaldıkça 3 saati dolan bildirimler yeniden kuyruğa girer.
    // Yedek anket: olaylar kaçarsa (uzun kopukluk) 30 dakikada bir; olağan akış olaylarla yürür.
    setInterval(enqueue, 30 * 60_000);
  });
  HOF.alerts = { open: openPanel, list: alerts, enqueue };
})();
