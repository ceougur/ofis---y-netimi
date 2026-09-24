/* DestekOfis — ofis içi sohbet paneli.
 * Sağdan açılan panel: "Ofis geneli" kanalı ve kişiler; kişiye tıklayınca özel yazışma. Mesajlar canlı kanaldan
 * (hof-live.js) anında gelir; okunmamış sayısı kenar çubuğundaki "Mesajlar" rozetinde ve sekme başlığında görünür.
 * Özel yazışmayı yalnızca iki taraf görür (sunucu denetler). Mesajdaki dosya numarası (ör. 2024/11710) tıklanınca
 * o dosya tabloda bulunup açılır. */
(() => {
  "use strict";
  const HOF = window.HOF;
  const { esc } = HOF;
  const CASE_PATTERN = /\b(?:19|20)\d{2}\/\d+\b/g;
  const MUTE_KEY = "hof-chat-sessiz";
  const state = { open: false, view: "list", summary: null, active: null, threads: new Map(), drafts: new Map(), filter: "", sending: false, attachCase: false };
  let panel = null;
  let summaryRequest = null;
  const baseTitle = document.title;

  const storage = {
    get(key) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // Gizli pencere vb.: ayar yalnızca bu oturumda geçerli olur.
      }
    },
  };
  const muted = () => storage.get(MUTE_KEY) === "1";

  // ---------- Biçimlendirme ----------
  const timeFormat = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" });
  const dayFormat = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  const shortDay = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit" });
  const dayKey = date => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  const dayLabel = value => {
    const date = new Date(value);
    const today = new Date();
    const yesterday = new Date(Date.now() - 86_400_000);
    if (dayKey(date) === dayKey(today)) return "Bugün";
    if (dayKey(date) === dayKey(yesterday)) return "Dün";
    return dayFormat.format(date);
  };
  const shortTime = value => {
    const date = new Date(value);
    return dayKey(date) === dayKey(new Date()) ? timeFormat.format(date) : shortDay.format(date);
  };
  const COLORS = ["#d9e8e3", "#e7dfd5", "#e5e1f0", "#efe1d8", "#dfe7d7", "#dde7ef"];
  const colorFor = id => COLORS[[...String(id || "")].reduce((total, char) => total + char.charCodeAt(0), 0) % COLORS.length];
  const avatar = (id, name, online) => `<span class="hof-chat-avatar" style="background:${colorFor(id)}" aria-hidden="true">${esc(HOF.initials(name))}${online === undefined ? "" : `<i class="${online ? "is-online" : ""}"></i>`}</span>`;
  const officeAvatar = () => `<span class="hof-chat-avatar hof-chat-avatar-office" aria-hidden="true">✦</span>`;
  const linkify = text => esc(text).replace(CASE_PATTERN, key => `<button type="button" class="hof-chat-case" data-case="${key}">${key}</button>`);

  // ---------- Veri ----------
  const me = () => state.summary?.me || HOF.user?.id;
  const conversationById = id => state.summary?.conversations.find(item => item.id === id) || null;
  const userById = id => state.summary?.users.find(item => item.id === id) || null;
  const isOnline = id => (HOF.live ? HOF.live.isOnline(id) : Boolean(userById(id)?.online));

  async function loadSummary() {
    if (summaryRequest) return summaryRequest;
    summaryRequest = HOF.api("/api/chat")
      .then(summary => {
        state.summary = summary;
        renderBadge();
        if (state.open) render();
        return summary;
      })
      .catch(() => null)
      .finally(() => {
        summaryRequest = null;
      });
    return summaryRequest;
  }

  function renderBadge() {
    const total = state.summary?.conversations.reduce((sum, item) => sum + (item.unread || 0), 0) || 0;
    const node = document.querySelector('[data-badge="messages"]');
    if (node) node.textContent = total ? String(total > 99 ? "99+" : total) : "";
    document.title = total ? `(${total}) ${baseTitle}` : baseTitle;
  }

  function upsertConversation(item) {
    if (!state.summary) return;
    const index = state.summary.conversations.findIndex(conversation => conversation.id === item.id);
    if (index >= 0) state.summary.conversations[index] = { ...state.summary.conversations[index], ...item };
    else state.summary.conversations.push(item);
  }

  async function loadThread(id, { older = false } = {}) {
    const thread = state.threads.get(id) || { messages: [], hasMore: false, loaded: false, loading: false };
    state.threads.set(id, thread);
    if (thread.loading) return thread;
    thread.loading = true;
    try {
      const before = older && thread.messages[0] ? `&before=${encodeURIComponent(thread.messages[0].createdAt)}` : "";
      const result = await HOF.api(`/api/chat/conversations/${encodeURIComponent(id)}/messages?limit=50${before}`);
      const known = new Set(thread.messages.map(message => message.id));
      const fresh = result.messages.filter(message => !known.has(message.id));
      thread.messages = older ? [...fresh, ...thread.messages] : mergeMessages(thread.messages, result.messages);
      if (!older || !thread.loaded) thread.hasMore = result.hasMore;
      thread.loaded = true;
      upsertConversation(result.conversation);
    } finally {
      thread.loading = false;
    }
    return thread;
  }
  const mergeMessages = (current, incoming) => {
    const map = new Map(current.map(message => [message.id, message]));
    for (const message of incoming) map.set(message.id, message);
    return [...map.values()].sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
  };

  async function markRead(id) {
    const conversation = conversationById(id);
    if (!conversation) return;
    const hadUnread = conversation.unread > 0;
    conversation.unread = 0;
    renderBadge();
    if (!hadUnread && conversation.kind !== "direct") return;
    try {
      const result = await HOF.api(`/api/chat/conversations/${encodeURIComponent(id)}/read`, { method: "POST", body: {} });
      conversation.lastReadAt = result.lastReadAt;
    } catch {
      // Bir sonraki açılışta yeniden denenir.
    }
  }

  // ---------- Panel ----------
  function ensurePanel() {
    if (panel) return panel;
    panel = HOF.el(
      "aside",
      { id: "hof-chat", class: "hof-chat", "data-hof-ui": "", role: "complementary", "aria-label": "Mesajlar", hidden: "" },
      `<header class="hof-chat-head"><div><strong>Mesajlar</strong><small data-status></small></div><div class="hof-chat-head-actions"><button type="button" class="hof-chat-icon" data-act="mute"></button><button type="button" class="hof-chat-icon" data-act="close" aria-label="Mesajları kapat" title="Kapat (Esc)">×</button></div></header><div class="hof-chat-body" data-body></div>`,
    );
    document.body.appendChild(panel);
    panel.addEventListener("click", onClick);
    panel.addEventListener("keydown", onKeydown);
    panel.addEventListener("input", event => {
      if (event.target.matches("[data-filter]")) {
        state.filter = event.target.value;
        renderListItems();
      } else if (event.target.matches("[data-composer]")) {
        if (state.active) state.drafts.set(state.active, event.target.value);
        autosize(event.target);
      }
    });
    return panel;
  }

  function renderHead() {
    const mute = panel.querySelector('[data-act="mute"]');
    mute.textContent = muted() ? "🔕" : "🔔";
    mute.title = muted() ? "Bildirim sesi kapalı (açmak için tıklayın)" : "Bildirim sesi açık (kapatmak için tıklayın)";
    mute.setAttribute("aria-label", mute.title);
    const status = panel.querySelector("[data-status]");
    status.textContent = HOF.live && !HOF.live.connected() ? "Bağlantı bekleniyor…" : "";
  }

  async function open(conversationId = null) {
    ensurePanel();
    state.open = true;
    panel.hidden = false;
    document.body.classList.add("hof-chat-open");
    requestAnimationFrame(() => panel.classList.add("is-open"));
    if (!state.summary) await loadSummary();
    if (conversationId) await openThread(conversationId);
    else {
      state.view = state.active ? "thread" : "list";
      render();
      if (state.view === "thread") markRead(state.active);
    }
  }

  function close() {
    if (!panel) return;
    state.open = false;
    panel.classList.remove("is-open");
    document.body.classList.remove("hof-chat-open");
    setTimeout(() => {
      if (!state.open) panel.hidden = true;
    }, 200);
  }

  const toggle = () => (state.open ? close() : open());

  function render() {
    if (!panel || !state.open) return;
    renderHead();
    if (state.view === "thread" && state.active) renderThread();
    else renderList();
  }

  // ---------- Liste ----------
  function listEntries() {
    const summary = state.summary;
    if (!summary) return { office: null, people: [] };
    const office = summary.conversations.find(item => item.kind === "office");
    const byPeer = new Map(summary.conversations.filter(item => item.kind === "direct").map(item => [item.peerId, item]));
    const people = summary.users.map(user => ({ user, conversation: byPeer.get(user.id) || null }));
    // Artık aktif olmayan kişilerle eski yazışmalar da listede kalır (okunabilir, yazılamaz).
    for (const conversation of byPeer.values()) if (!summary.users.some(user => user.id === conversation.peerId)) people.push({ user: { id: conversation.peerId, name: conversation.title, role: "", inactive: true }, conversation });
    const time = entry => entry.conversation?.lastMessage?.createdAt || "";
    people.sort((a, b) => (b.conversation?.unread || 0) - (a.conversation?.unread || 0) || (time(b) > time(a) ? 1 : time(b) < time(a) ? -1 : 0) || a.user.name.localeCompare(b.user.name, "tr"));
    return { office, people };
  }

  function renderList() {
    state.view = "list";
    const body = panel.querySelector("[data-body]");
    body.innerHTML = `<div class="hof-chat-search"><input type="search" data-filter placeholder="Kişi ara…" aria-label="Kişi ara" value="${esc(state.filter)}"></div><div class="hof-chat-list" data-list role="list"></div>`;
    renderListItems();
  }

  function preview(conversation) {
    const last = conversation?.lastMessage;
    if (!last) return "";
    const who = last.senderId === me() ? "Siz: " : conversation.kind === "office" ? `${last.senderName.split(" ")[0]}: ` : "";
    return `${who}${last.body.replace(/\s+/g, " ")}`;
  }

  function renderListItems() {
    const list = panel?.querySelector("[data-list]");
    if (!list) return;
    if (!state.summary) {
      list.innerHTML = '<p class="hof-chat-empty">Yükleniyor…</p>';
      return;
    }
    const { office, people } = listEntries();
    const query = HOF.normalize(state.filter);
    const item = ({ key, attrs, avatarHtml, title, subtitle, time, unread }) =>
      `<button type="button" class="hof-chat-item${unread ? " has-unread" : ""}" ${attrs} role="listitem">${avatarHtml}<span class="hof-chat-item-main"><span class="hof-chat-item-top"><b>${esc(title)}</b>${time ? `<small>${esc(time)}</small>` : ""}</span><span class="hof-chat-item-bottom"><span>${esc(subtitle)}</span>${unread ? `<em aria-label="${unread} okunmamış">${unread}</em>` : ""}</span></span></button>`;
    const rows = [];
    if (office && (!query || HOF.normalize("Ofis geneli herkes").includes(query))) {
      rows.push(item({ attrs: `data-conversation="${esc(office.id)}"`, avatarHtml: officeAvatar(), title: "Ofis geneli", subtitle: preview(office) || "Tüm ofise duyuru ve sorular", time: office.lastMessage ? shortTime(office.lastMessage.createdAt) : "", unread: office.unread }));
    }
    const visible = people.filter(entry => !query || HOF.normalize(entry.user.name).includes(query));
    if (visible.length) rows.push('<p class="hof-chat-section">KİŞİLER</p>');
    for (const { user, conversation } of visible) {
      const role = user.inactive ? "Pasif hesap" : HOF.roleLabels[user.role] || user.role;
      rows.push(item({
        attrs: conversation ? `data-conversation="${esc(conversation.id)}"` : `data-user="${esc(user.id)}"`,
        avatarHtml: avatar(user.id, user.name, user.inactive ? undefined : isOnline(user.id)),
        title: user.name,
        subtitle: preview(conversation) || role,
        time: conversation?.lastMessage ? shortTime(conversation.lastMessage.createdAt) : "",
        unread: conversation?.unread || 0,
      }));
    }
    list.innerHTML = rows.join("") || '<p class="hof-chat-empty">Eşleşen kişi yok.</p>';
  }

  // ---------- Yazışma ----------
  async function openThread(id) {
    state.active = id;
    state.view = "thread";
    const thread = state.threads.get(id);
    render();
    if (!thread?.loaded) {
      try {
        await loadThread(id);
      } catch (error) {
        HOF.toastError(error);
        state.view = "list";
        render();
        return;
      }
      if (state.active === id && state.view === "thread") renderThread();
    }
    markRead(id);
    panel.querySelector("[data-composer]")?.focus();
  }

  async function openUser(userId) {
    try {
      const conversation = await HOF.api("/api/chat/direct", { method: "POST", body: { userId } });
      upsertConversation(conversation);
      await openThread(conversation.id);
    } catch (error) {
      HOF.toastError(error);
    }
  }

  function threadHeader(conversation) {
    if (conversation.kind === "office") {
      const count = (state.summary?.users.length || 0) + 1;
      const onlineCount = state.summary?.users.filter(user => isOnline(user.id)).length || 0;
      return `${officeAvatar()}<span><b>Ofis geneli</b><small>${count} kişi · ${onlineCount + 1} çevrimiçi</small></span>`;
    }
    const online = isOnline(conversation.peerId);
    const status = conversation.peerActive === false ? "Pasif hesap" : online ? "Çevrimiçi" : "Çevrimdışı";
    return `${avatar(conversation.peerId, conversation.title, conversation.peerActive === false ? undefined : online)}<span><b>${esc(conversation.title)}</b><small class="${online ? "is-online" : ""}">${status}</small></span>`;
  }

  function messageHtml(message, previous, conversation) {
    const mine = message.senderId === me();
    const showName = !mine && conversation.kind === "office" && previous?.senderId !== message.senderId;
    const extraCase = message.caseKey && !String(message.body).includes(message.caseKey) ? `<button type="button" class="hof-chat-case" data-case="${esc(message.caseKey)}">📎 ${esc(message.caseKey)}</button>` : "";
    return `<div class="hof-chat-msg${mine ? " is-mine" : ""}" data-id="${esc(message.id)}">${showName ? `<span class="hof-chat-sender">${esc(message.senderName)}</span>` : ""}<div class="hof-chat-bubble"><p>${linkify(message.body)}</p>${extraCase}<time datetime="${esc(message.createdAt)}">${esc(timeFormat.format(new Date(message.createdAt)))}</time></div></div>`;
  }

  function messagesHtml(thread, conversation) {
    if (!thread?.loaded) return '<p class="hof-chat-empty">Yükleniyor…</p>';
    if (!thread.messages.length) return `<p class="hof-chat-empty">${conversation.kind === "office" ? "Ofise ilk mesajı siz yazın." : "Henüz mesaj yok. İlk mesajı yazın."}</p>`;
    const parts = [];
    if (thread.hasMore) parts.push('<button type="button" class="hof-chat-older" data-act="older">Daha eski mesajlar</button>');
    let lastDay = "";
    thread.messages.forEach((message, index) => {
      const day = dayLabel(message.createdAt);
      if (day !== lastDay) {
        parts.push(`<p class="hof-chat-day"><span>${esc(day)}</span></p>`);
        lastDay = day;
      }
      parts.push(messageHtml(message, index ? thread.messages[index - 1] : null, conversation));
    });
    const lastMine = [...thread.messages].reverse().find(message => message.senderId === me());
    if (conversation.kind === "direct" && lastMine && thread.messages[thread.messages.length - 1].id === lastMine.id) {
      const read = conversation.peerLastReadAt && conversation.peerLastReadAt >= lastMine.createdAt;
      parts.push(`<p class="hof-chat-receipt${read ? " is-read" : ""}">${read ? "✓✓ Okundu" : "✓ İletildi"}</p>`);
    }
    return parts.join("");
  }

  function renderThread() {
    const conversation = conversationById(state.active);
    if (!conversation) {
      renderList();
      return;
    }
    const thread = state.threads.get(state.active);
    const body = panel.querySelector("[data-body]");
    const existing = body.querySelector("[data-messages]");
    const nearBottom = !existing || existing.scrollHeight - existing.scrollTop - existing.clientHeight < 80;
    const draft = state.drafts.get(state.active) || "";
    const selected = HOF.selectedCase();
    const canWrite = HOF.can("messages.create") && conversation.peerActive !== false;
    body.innerHTML = `<div class="hof-chat-thread-head"><button type="button" class="hof-chat-icon" data-act="back" aria-label="Kişilere dön" title="Kişilere dön">‹</button>${threadHeader(conversation)}</div>
      <div class="hof-chat-messages" data-messages aria-live="polite">${messagesHtml(thread, conversation)}</div>
      ${canWrite ? `<form class="hof-chat-composer" data-form>${selected ? `<label class="hof-chat-attach"><input type="checkbox" data-attach ${state.attachCase ? "checked" : ""}> Seçili kaydı ekle: <b>${esc(selected.key)}</b></label>` : ""}<div class="hof-chat-compose-row"><textarea data-composer rows="1" maxlength="2000" placeholder="Mesaj yazın… (Enter gönderir, Shift+Enter yeni satır)" aria-label="Mesaj"></textarea><button type="submit" class="hof-button" data-send ${state.sending ? "disabled" : ""}>Gönder</button></div></form>` : `<p class="hof-chat-readonly">${conversation.peerActive === false ? "Bu kişi artık aktif değil; yazışma yalnızca okunabilir." : "Mesaj gönderme yetkiniz yok."}</p>`}`;
    const composer = body.querySelector("[data-composer]");
    if (composer) {
      composer.value = draft;
      autosize(composer);
    }
    const list = body.querySelector("[data-messages]");
    if (nearBottom) list.scrollTop = list.scrollHeight;
  }

  function autosize(textarea) {
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(140, textarea.scrollHeight)}px`;
  }

  async function send() {
    const composer = panel.querySelector("[data-composer]");
    const text = composer?.value.trim();
    if (!text || state.sending || !state.active) return;
    const conversationId = state.active;
    const attach = panel.querySelector("[data-attach]");
    const caseKey = attach?.checked ? HOF.selectedCase()?.key || "" : "";
    state.sending = true;
    panel.querySelector("[data-send]")?.setAttribute("disabled", "");
    // Taslak gönderimden önce temizlenir: canlı kanaldan kendi mesajımız yanıttan önce gelip paneli yeniden çizse de
    // metin kutuda kalmaz. Gönderilemezse geri konur.
    state.drafts.delete(conversationId);
    composer.value = "";
    autosize(composer);
    try {
      const message = await HOF.api(`/api/chat/conversations/${encodeURIComponent(conversationId)}/messages`, { method: "POST", body: { body: text, caseKey } });
      addMessage(conversationId, message);
      if (attach) {
        state.attachCase = false;
        const current = panel.querySelector("[data-attach]");
        if (current) current.checked = false;
      }
    } catch (error) {
      if (!state.drafts.get(conversationId)) state.drafts.set(conversationId, text);
      const current = panel.querySelector("[data-composer]");
      if (current && state.active === conversationId && !current.value) {
        current.value = text;
        autosize(current);
      }
      HOF.toastError(error);
    } finally {
      state.sending = false;
      panel.querySelector("[data-send]")?.removeAttribute("disabled");
      panel.querySelector("[data-composer]")?.focus();
    }
  }

  function addMessage(conversationId, message) {
    const thread = state.threads.get(conversationId);
    // Yazışma o an yükleniyor olsa da eklenir: yükleme sonucu kimliğe göre birleştirildiğinden mesaj kaybolmaz.
    if (thread) thread.messages = mergeMessages(thread.messages, [message]);
    const conversation = conversationById(conversationId);
    if (conversation) conversation.lastMessage = message;
    if (state.open && state.active === conversationId && state.view === "thread") renderThread();
    else if (state.open && state.view === "list") renderListItems();
  }

  // ---------- Dosyaya git ----------
  function revealCase(key, retried = false) {
    const rows = [...document.querySelectorAll(".dynamic-table tbody tr")];
    const row = rows.find(item => item.dataset.hofKey === key) || rows.find(item => (item.textContent || "").includes(key));
    if (!row) {
      const all = [...document.querySelectorAll(".category-bar > .category-tabs:not(.hof-category-tabs) .category-tab")].find(button => /^Tümü\b/.test(button.textContent.trim()));
      if (!retried && all && !all.classList.contains("active")) {
        all.click();
        setTimeout(() => revealCase(key, true), 300);
        return;
      }
      HOF.toast(`${key} tabloda bulunamadı.`, { type: "error" });
      return;
    }
    HOF.table?.revealRow(row);
    row.scrollIntoView({ behavior: "smooth", block: "center" });
    row.click();
    row.classList.add("smart-search-hit");
    setTimeout(() => row.classList.remove("smart-search-hit"), 1600);
    if (window.innerWidth < 1100) close();
  }

  // ---------- Olaylar ----------
  function onClick(event) {
    const target = event.target.closest("button, [data-act]");
    if (!target) return;
    const act = target.dataset.act;
    if (act === "close") close();
    else if (act === "back") {
      state.view = "list";
      state.active = null;
      render();
    } else if (act === "mute") {
      storage.set(MUTE_KEY, muted() ? "0" : "1");
      renderHead();
    } else if (act === "older") {
      const id = state.active;
      target.disabled = true;
      loadThread(id, { older: true }).then(() => state.active === id && renderThread(), HOF.toastError);
    } else if (target.dataset.case) revealCase(target.dataset.case);
    else if (target.dataset.conversation) openThread(target.dataset.conversation);
    else if (target.dataset.user) openUser(target.dataset.user);
  }

  function onKeydown(event) {
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
    } else if (event.key === "Enter" && !event.shiftKey && event.target.matches("[data-composer]")) {
      event.preventDefault();
      send();
    }
  }
  document.addEventListener("submit", event => {
    if (!event.target.matches?.("#hof-chat [data-form]")) return;
    event.preventDefault();
    send();
  });
  document.addEventListener("change", event => {
    if (event.target.matches?.("#hof-chat [data-attach]")) state.attachCase = event.target.checked;
  });

  // Kısa, yumuşak iki tonlu bildirim sesi (dosya indirmeden, Web Audio ile).
  let audio = null;
  function chime() {
    if (muted()) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      const start = audio.currentTime;
      for (const [offset, frequency] of [[0, 880], [0.12, 1320]]) {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, start + offset);
        gain.gain.exponentialRampToValueAtTime(0.08, start + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.25);
        oscillator.connect(gain).connect(audio.destination);
        oscillator.start(start + offset);
        oscillator.stop(start + offset + 0.3);
      }
    } catch {
      // Ses çalınamıyorsa (tarayıcı izni) sessiz geçilir.
    }
  }

  HOF.on("live:chat.message", payload => {
    if (!payload?.message || !state.summary) {
      loadSummary();
      return;
    }
    const { conversationId, message } = payload;
    const mine = message.senderId === me();
    let conversation = conversationById(conversationId);
    if (!conversation) {
      // Yeni bir özel yazışma: özet yeniden alınır.
      loadSummary().then(() => {
        if (!mine) notify(conversationId, message);
      });
      return;
    }
    addMessage(conversationId, message);
    if (mine) return;
    const viewing = state.open && state.active === conversationId && state.view === "thread" && !document.hidden;
    if (viewing) markRead(conversationId);
    else {
      conversation.unread = (conversation.unread || 0) + 1;
      renderBadge();
      if (state.open && state.view === "list") renderListItems();
      notify(conversationId, message);
    }
  });

  function notify(conversationId, message) {
    const conversation = conversationById(conversationId);
    const where = conversation?.kind === "office" ? " (Ofis geneli)" : "";
    const text = message.body.replace(/\s+/g, " ");
    HOF.toast(`${message.senderName}${where}: ${text.length > 90 ? `${text.slice(0, 90)}…` : text}`, { action: { label: "Aç", onClick: () => open(conversationId) }, timeout: 7000 });
    chime();
  }

  HOF.on("live:chat.read", payload => {
    if (!payload) return;
    const conversation = conversationById(payload.conversationId);
    if (!conversation) return;
    if (payload.userId === me()) {
      // Başka bir sekmede/bilgisayarda okundu: burada da sayaç sıfırlanır.
      conversation.unread = 0;
      conversation.lastReadAt = payload.lastReadAt;
      renderBadge();
      if (state.open && state.view === "list") renderListItems();
      return;
    }
    conversation.peerLastReadAt = payload.lastReadAt;
    if (state.open && state.active === payload.conversationId && state.view === "thread") renderThread();
  });

  HOF.on("live:presence", () => {
    if (!state.open) return;
    if (state.view === "list") renderListItems();
    else {
      const head = panel.querySelector(".hof-chat-thread-head");
      const conversation = conversationById(state.active);
      if (head && conversation) head.innerHTML = `<button type="button" class="hof-chat-icon" data-act="back" aria-label="Kişilere dön" title="Kişilere dön">‹</button>${threadHeader(conversation)}`;
    }
  });
  HOF.on("live:hello", () => state.open && renderHead());
  HOF.on("live:disconnected", () => state.open && renderHead());
  HOF.on("live:resync", async () => {
    await loadSummary();
    if (state.active && state.threads.get(state.active)?.loaded) {
      await loadThread(state.active).catch(() => null);
      if (state.open && state.view === "thread") {
        renderThread();
        if (!document.hidden) markRead(state.active);
      }
    }
  });
  // Açık yazışmaya geri dönülünce (sekme görünür olunca) okundu işaretlenir.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && state.open && state.view === "thread" && conversationById(state.active)?.unread) markRead(state.active);
  });

  HOF.whenReady(() => {
    loadSummary();
    // Güvenlik ağı: canlı akışı geciktiren/tamponlayan ağ aygıtı veya antivirüs olsa bile rozet ve açık yazışma
    // en geç 45 sn'de güncellenir.
    setInterval(async () => {
      if (document.hidden) return;
      await loadSummary();
      if (!HOF.live?.connected() && state.open && state.view === "thread" && state.active) {
        const id = state.active;
        await loadThread(id).catch(() => null);
        if (state.active === id && state.view === "thread") {
          renderThread();
          markRead(id);
        }
      }
    }, 45_000);
  });
  HOF.chat = { open, close, toggle, refresh: loadSummary, revealCase };
})();
