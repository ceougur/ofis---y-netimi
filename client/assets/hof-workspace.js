/* DestekOfis — operasyon merkezi: kenar çubuğu kartı, kullanıcı menüsü, dosya işlemleri ve işlem geçmişi. */
(() => {
  "use strict";
  const HOF = window.HOF;
  const { esc } = HOF;
  let users = [];
  let activityKey = "";
  let activityRequest = 0;

  const loadUsers = async () => {
    try {
      users = await HOF.api("/api/workspace/users");
    } catch {
      users = [];
    }
    return users;
  };
  const userNames = () => users.map(user => user.name);
  const priorityLabel = { normal: "Normal", high: "Yüksek", urgent: "Acil" };

  // Türk cep telefonlarını wa.me biçimine çevirir (90XXXXXXXXXX).
  const extractPhones = text => {
    const matches = String(text || "").match(/(?:\+?90[\s().-]*)?(?:0?5\d{2}|5\d{2})[\s().-]*\d{3}[\s().-]*\d{2}[\s().-]*\d{2}/g) || [];
    return [...new Set(matches.map(value => {
      const digits = value.replace(/\D/g, "");
      return digits.startsWith("90") ? digits : digits.startsWith("0") ? `9${digits}` : `90${digits}`;
    }).filter(value => value.length === 12))];
  };
  const openWhatsApp = number => window.open(`https://wa.me/${number}`, "_blank", "noopener");

  const requireCase = () => {
    const selected = HOF.selectedCase();
    if (!selected) HOF.toast(`Önce tablodan bir ${HOF.vocab.record} seçin.`, { type: "error" });
    return selected;
  };
  const caseUrl = (key, suffix) => `/api/workspace/cases/${encodeURIComponent(key)}/${suffix}`;
  const afterCaseChange = () => {
    activityKey = "";
    renderActivity();
    HOF.emit("case-activity");
  };

  // ---------- Dosya işlem pencereleri ----------
  const actions = {
    note() {
      const selected = requireCase();
      if (!selected) return;
      HOF.formModal({
        title: "Not ekle",
        eyebrow: selected.title,
        fields: [{ name: "note", label: "Not", type: "textarea", required: true, maxlength: 5000, placeholder: "Yapılan son işlemi yazın…" }],
        submitLabel: "Notu kaydet",
        onSubmit: async data => {
          await HOF.api(caseUrl(selected.key, "notes"), { method: "POST", body: data });
          HOF.toast("Not kaydedildi.", { type: "success" });
          afterCaseChange();
        },
      });
    },
    phone() {
      const selected = requireCase();
      if (!selected) return;
      HOF.formModal({
        title: "Telefon bilgisi ekle",
        eyebrow: selected.title,
        fields: [
          { name: "phone", label: "Telefon", type: "tel", required: true, inputmode: "tel", placeholder: "05xx xxx xx xx" },
          { name: "label", label: "Etiket", placeholder: "Cep / iş / vekil", list: ["Cep", "İş", "Ev", "Vekil", "Yakını"] },
        ],
        submitLabel: "Telefonu kaydet",
        onSubmit: async data => {
          await HOF.api(caseUrl(selected.key, "phones"), { method: "POST", body: data });
          HOF.toast("Telefon bilgisi kaydedildi.", { type: "success" });
          afterCaseChange();
        },
      });
    },
    payment() {
      const selected = requireCase();
      if (!selected) return;
      HOF.formModal({
        title: "Tahsilat işle",
        eyebrow: selected.title,
        fields: [
          { name: "amount", label: "Tutar (₺)", required: true, inputmode: "decimal", placeholder: "Örn. 1.250,00" },
          { name: "date", label: "Tahsilat tarihi", type: "date", value: new Date().toISOString().slice(0, 10) },
          { name: "note", label: "Açıklama", placeholder: "Ödeme kanalı veya açıklama", maxlength: 500 },
        ],
        submitLabel: "Tahsilatı kaydet",
        onSubmit: async data => {
          await HOF.api(caseUrl(selected.key, "payments"), { method: "POST", body: data });
          HOF.toast("Tahsilat kaydedildi.", { type: "success" });
          afterCaseChange();
        },
      });
    },
    lien() {
      const selected = requireCase();
      if (!selected) return;
      HOF.formModal({
        title: "Haciz kaydı",
        eyebrow: selected.title,
        intro: "Sistem haczin bir yıl sonraki düşüm tarihini hesaplar ve son 7 gün kala uyarır.",
        fields: [
          { name: "title", label: "Haciz başlığı", required: true, list: ["Araç haczi", "Taşınmaz haczi", "Banka haczi", "Maaş haczi", "Menkul haczi"] },
          { name: "placedAt", label: "Konulduğu tarih", type: "date", required: true },
        ],
        submitLabel: "Haczi kaydet",
        onSubmit: async data => {
          const result = await HOF.api(caseUrl(selected.key, "liens"), { method: "POST", body: data });
          HOF.toast(`Haciz kaydedildi. Düşüm tarihi: ${HOF.formatDate(result.expiresAt)}`, { type: "success" });
          afterCaseChange();
        },
      });
    },
    async task() {
      if (!HOF.can("tasks.create")) {
        HOF.toast(`Görev atama yalnızca yönetici ve ${HOF.roleLabels.avukat.toLocaleLowerCase("tr-TR")} hesaplarında kullanılabilir.`, { type: "error" });
        return;
      }
      const selected = HOF.selectedCase();
      await loadUsers();
      HOF.formModal({
        title: "Görev ata",
        eyebrow: selected ? selected.title : "OPERASYON",
        fields: [
          { name: "title", label: "Görev", required: true, maxlength: 300, placeholder: HOF.modules.haciz ? "Örn. haciz yenileme evrakını kontrol et" : "Örn. eksik belgeleri tamamla ve bilgi ver" },
          { name: "assignee", label: "Atanacak kişi", list: userNames(), value: HOF.user.name, placeholder: "Personel adı" },
          { name: "dueDate", label: "Son tarih", type: "date" },
          { name: "priority", label: "Öncelik", type: "select", value: "normal", options: [{ value: "normal", label: "Normal" }, { value: "high", label: "Yüksek" }, { value: "urgent", label: "Acil" }] },
          ...(selected ? [{ name: "linkCase", label: `Görevi "${selected.title}" kaydına bağla`, type: "checkbox", value: true }] : []),
        ],
        submitLabel: "Görevi ata",
        onSubmit: async data => {
          const body = { title: data.title, assignee: data.assignee, dueDate: data.dueDate, priority: data.priority, caseKey: selected && data.linkCase ? selected.key : "" };
          await HOF.api("/api/workspace/tasks", { method: "POST", body });
          HOF.toast("Görev atandı.", { type: "success" });
          refreshBadges();
          if (body.caseKey) afterCaseChange();
        },
      });
    },
    whatsapp() {
      const selected = requireCase();
      if (!selected) return;
      const number = extractPhones(selected.panel.innerText)[0];
      if (!number) return HOF.toast("Bu kayıtta cep telefonu bulunamadı.", { type: "error" });
      openWhatsApp(number);
    },
  };

  // ---------- Operasyon pencereleri ----------
  async function openTasks(initial = "mine") {
    let view = initial;
    // Herkesin görevlerini yalnızca avukat ve yönetici görür; diğerleri kendi görevlerini (sunucu da süzer).
    const everyone = HOF.can("tasks.viewAll");
    const tabs = everyone
      ? '<button type="button" data-view="mine">Bana atananlar</button><button type="button" data-view="open">Tüm açık görevler</button><button type="button" data-view="completed">Tamamlananlar</button>'
      : '<button type="button" data-view="mine">Açık görevlerim</button><button type="button" data-view="completed">Tamamladıklarım</button>';
    const modal = HOF.modal({ title: "Görevler", eyebrow: "OPERASYON", size: "wide", body: `<div class="hof-tabs" role="group" aria-label="Görev filtresi">${tabs}</div><div class="hof-list" data-list><p class="hof-empty">Yükleniyor…</p></div><div class="hof-actions">${HOF.can("tasks.create") ? '<button type="button" class="hof-button hof-button-ghost" data-new>Yeni görev</button>' : ""}<button type="button" class="hof-button" data-close>Kapat</button></div>` });
    const list = modal.dialog.querySelector("[data-list]");
    const render = async () => {
      modal.dialog.querySelectorAll("[data-view]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.view === view)));
      list.innerHTML = '<p class="hof-empty">Yükleniyor…</p>';
      try {
        const query = view === "mine" ? "status=open&mine=1" : `status=${view}`;
        const tasks = await HOF.api(`/api/workspace/tasks?${query}`);
        list.innerHTML = tasks.length
          ? tasks.map(task => `<article class="hof-list-item"><header><b>${esc(task.title)}</b><span class="hof-chip ${task.priority !== "normal" ? `hof-chip-${esc(task.priority)}` : ""}">${esc(priorityLabel[task.priority] || task.priority)}</span></header><small>${esc(task.assignee)}${task.dueDate ? ` · son tarih ${esc(HOF.formatDate(task.dueDate))}` : ""}${task.caseKey ? ` · ${esc(HOF.vocab.record)} ${esc(task.caseKey)}` : ""} · ${esc(task.actorName)} tarafından</small>${task.status === "open" && HOF.can("tasks.complete") ? `<div class="hof-actions"><button type="button" class="hof-button hof-button-small" data-complete="${esc(task.id)}">Tamamlandı</button></div>` : task.completedAt ? `<small>✓ ${esc(task.completedByName || "")} · ${esc(HOF.formatDateTime(task.completedAt))}</small>` : ""}</article>`).join("")
          : `<p class="hof-empty">${view === "mine" ? "Size atanmış açık görev yok." : "Görev bulunmuyor."}</p>`;
      } catch (error) {
        list.innerHTML = `<p class="hof-empty">${esc(error.message)}</p>`;
      }
    };
    modal.dialog.addEventListener("click", async event => {
      const target = event.target.closest("button");
      if (!target) return;
      if (target.dataset.view) {
        view = target.dataset.view;
        render();
      } else if (target.dataset.complete) {
        target.disabled = true;
        try {
          await HOF.api(`/api/workspace/tasks/${encodeURIComponent(target.dataset.complete)}/complete`, { method: "POST" });
          HOF.toast("Görev tamamlandı.", { type: "success" });
          refreshBadges();
          render();
        } catch (error) {
          HOF.toastError(error);
          target.disabled = false;
        }
      } else if ("new" in target.dataset) {
        modal.close();
        actions.task();
      } else if ("close" in target.dataset) modal.close();
    });
    render();
  }

  // Eski "Mesajlar" penceresinin yerini sağdan açılan sohbet paneli aldı (hof-chat.js).
  const openMessages = () => HOF.chat?.open();

  async function openReports() {
    try {
      const result = await HOF.api("/api/workspace/reports");
      const rows = result.report.map(item => `<tr><td>${esc(item.userName)}<br><small>${esc(HOF.roleLabels[item.role] || item.role)}</small></td><td class="num">${item.tasksCompleted}</td><td class="num">${item.notes}</td><td class="num">${item.calls}</td><td class="num">${esc(HOF.formatMoney(item.collections))}</td><td class="num">${item.dataEntries}</td></tr>`).join("");
      HOF.modal({
        title: "Personel performans özeti",
        eyebrow: "RAPOR",
        size: "wide",
        body: `<div class="hof-kpis"><div><strong>${result.totals.tasks}</strong><span>toplam görev</span></div><div><strong>${result.totals.completedTasks}</strong><span>tamamlanan</span></div><div><strong>${result.totals.notes}</strong><span>not</span></div><div><strong>${esc(HOF.formatMoney(result.totals.payments))}</strong><span>tahsilat</span></div></div><div style="overflow:auto"><table class="hof-table"><thead><tr><th>Personel</th><th>Görev</th><th>Not</th><th>Telefon</th><th>Tahsilat</th><th>İşlem</th></tr></thead><tbody>${rows || '<tr><td colspan="6">Henüz işlem yok.</td></tr>'}</tbody></table></div><p class="hof-edit-meta">Oluşturulma: ${esc(HOF.formatDateTime(result.generatedAt))}</p>`,
      });
    } catch (error) {
      HOF.toastError(error);
    }
  }

  async function openLiens() {
    try {
      const result = await HOF.api("/api/workspace/liens?days=30");
      const urgent = result.upcoming.filter(item => new Date(item.expiresAt).getTime() - Date.now() <= 7 * 86_400_000);
      const list = result.upcoming.map(item => {
        const days = Math.max(0, Math.ceil((new Date(item.expiresAt).getTime() - Date.now()) / 86_400_000));
        return `<article class="hof-list-item ${days <= 7 ? "is-highlight" : ""}"><header><b>${esc(item.title)} · ${esc(item.caseKey)}</b><span class="hof-chip ${days <= 7 ? "hof-chip-urgent" : "hof-chip-high"}">${days} gün</span></header><small>Düşüm: ${esc(HOF.formatDate(item.expiresAt))} · kaydı giren ${esc(item.actorName || "—")}</small></article>`;
      }).join("");
      HOF.modal({ title: "Yaklaşan haciz düşümleri", eyebrow: "UYARI", body: `<div class="hof-alert">Bir yılını dolduracak aktif hacizler. ${urgent.length ? `${urgent.length} haciz 7 gün içinde düşüyor.` : "Önümüzdeki 7 gün içinde düşecek haciz yok."}</div><div class="hof-list">${list || '<p class="hof-empty">Önümüzdeki 30 gün içinde düşecek haciz yok.</p>'}</div>` });
    } catch (error) {
      HOF.toastError(error);
    }
  }

  function openProfile() {
    HOF.formModal({
      title: "Profilim",
      eyebrow: HOF.roleLabels[HOF.user.role] || HOF.user.role,
      intro: "Bu ad not, tahsilat, görev ve mesaj kayıtlarında görünür. Rolünüzü yalnızca yönetici değiştirebilir.",
      fields: [{ name: "name", label: "Ad soyad", required: true, value: HOF.user.name, maxlength: 120 }],
      submitLabel: "Kaydet",
      onSubmit: async data => {
        const result = await HOF.api("/api/workspace/profile", { method: "POST", body: data });
        HOF.user.name = result.name;
        renderUser();
        HOF.toast("Profiliniz güncellendi.", { type: "success" });
      },
    });
  }

  // ---------- Kenar çubuğu ----------
  const sideItem = (action, icon, label, badge = "", requires = "") => `<button type="button" class="hof-side-item" data-action="${action}" ${requires ? `data-requires="${requires}"` : ""}><span class="hof-side-icon" aria-hidden="true">${icon}</span><span class="hof-side-text">${label}</span><span class="hof-badge ${badge === "warn" ? "hof-badge-warn" : ""}" data-badge="${action}"></span></button>`;

  function renderUser() {
    const target = document.querySelector("#hof-sidecard .hof-user");
    if (!target || !HOF.user) return;
    target.innerHTML = `<span class="hof-user-avatar" aria-hidden="true">${esc(HOF.initials(HOF.user.name))}</span><span class="hof-user-info"><strong title="${esc(HOF.user.name)}">${esc(HOF.user.name)}</strong><span>${esc(HOF.roleLabels[HOF.user.role] || HOF.user.role)}</span></span><span class="hof-user-menu"><button type="button" data-action="profile">Profil</button><button type="button" data-action="password">Parola</button>${HOF.can("users.manage") || HOF.can("audit.view") ? '<a href="/admin.html">Yönetim</a>' : ""}<button type="button" data-action="logout">Çıkış</button></span>`;
  }

  function installSidebar() {
    if (!HOF.user || document.getElementById("hof-sidecard")) return;
    const sidebar = document.querySelector(".sidebar");
    if (!sidebar) return;
    const card = HOF.el(
      "div",
      { id: "hof-sidecard", class: "hof-sidecard" },
      `<p class="hof-sidecard-label">OPERASYON MERKEZİ</p>
      ${sideItem("tasks", "✓", "Görevler")}
      ${sideItem("messages", "✉", "Mesajlar")}
      ${sideItem("newTask", "+", "Görev ata", "", "tasks.create")}
      ${sideItem("newRecord", "+", `Yeni ${esc(HOF.vocab.record)}`)}
      ${sideItem("liens", "!", "Haciz uyarıları", "warn")}
      ${sideItem("reports", "↗", "Personel raporu", "", "reports.view")}
      <div class="hof-user"></div>`,
    );
    const bottom = sidebar.querySelector(".sidebar-bottom");
    if (bottom && bottom.parentNode === sidebar) sidebar.insertBefore(card, bottom);
    else sidebar.appendChild(card);
    renderUser();
    card.addEventListener("click", event => {
      const action = event.target.closest("[data-action]")?.dataset.action;
      if (!action) return;
      if (action === "tasks") openTasks();
      else if (action === "messages") HOF.chat ? HOF.chat.toggle() : openMessages();
      else if (action === "newTask") actions.task();
      else if (action === "newRecord") HOF.emit("new-record");
      else if (action === "liens") openLiens();
      else if (action === "reports") openReports();
      else if (action === "profile") openProfile();
      else if (action === "password") HOF.changePassword();
      else if (action === "logout") HOF.logout();
    });
    refreshBadges();
  }

  async function refreshBadges() {
    const setBadge = (name, value) => {
      const node = document.querySelector(`[data-badge="${name}"]`);
      if (node) node.textContent = value ? String(value) : "";
    };
    try {
      const [tasks, liens] = await Promise.all([HOF.api("/api/workspace/tasks?status=open&mine=1"), HOF.api("/api/workspace/liens?days=7")]);
      setBadge("tasks", tasks.length);
      setBadge("liens", liens.total);
    } catch {
      // Rozetler kritik değil; bir sonraki turda yeniden denenir.
    }
  }

  // ---------- Detay paneli: işlem düğmeleri ve geçmiş ----------
  const ACTIVITY_ICONS = { note: "✎", phone: "☎", payment: "₺", lien: "⚖", task: "✓" };
  const describe = item => {
    if (item.type === "note") return esc(item.text);
    if (item.type === "phone") return `${esc(item.label)}: ${esc(item.phone)}`;
    if (item.type === "payment") return `${esc(HOF.formatMoney(item.amount))} tahsilat${item.note ? ` · ${esc(item.note)}` : ""} (${esc(HOF.formatDate(item.date))})`;
    if (item.type === "lien") return `${esc(item.title)} · düşüm ${esc(HOF.formatDate(item.expiresAt))}`;
    if (item.type === "task") return `Görev: ${esc(item.title)} → ${esc(item.assignee)}${item.status === "completed" ? " ✓" : ""}`;
    return "";
  };

  async function renderActivity() {
    const selected = HOF.selectedCase();
    const panel = HOF.detailPanel();
    let box = document.getElementById("hof-activity");
    if (!selected || !panel) {
      if (box) box.hidden = true;
      return;
    }
    if (!box) {
      box = HOF.el("section", { id: "hof-activity", class: "hof-activity", "aria-live": "polite" });
      panel.appendChild(box);
    } else if (box.parentNode !== panel) panel.appendChild(box);
    box.hidden = false;
    if (activityKey === selected.key) return;
    activityKey = selected.key;
    const request = ++activityRequest;
    box.innerHTML = '<div class="hof-activity-head"><h3>İŞLEM GEÇMİŞİ</h3></div><p class="hof-empty">Yükleniyor…</p>';
    try {
      const result = await HOF.api(caseUrl(selected.key, "activity"));
      if (request !== activityRequest) return;
      const tools = ["not", "telefon", HOF.modules.tahsilat ? "tahsilat" : "", HOF.modules.haciz ? "haciz" : ""].filter(Boolean);
      const toolsText = `${tools.slice(0, -1).join(", ")} veya ${tools[tools.length - 1]}`;
      box.innerHTML = `<div class="hof-activity-head"><h3>İŞLEM GEÇMİŞİ</h3>${result.paidTotal ? `<span>Toplam tahsilat ${esc(HOF.formatMoney(result.paidTotal))}</span>` : ""}</div>${result.items.length ? `<ol>${result.items.slice(0, 30).map(item => `<li data-type="${esc(item.type)}"><span class="hof-activity-icon" aria-hidden="true">${ACTIVITY_ICONS[item.type] || "•"}</span><span class="hof-activity-main"><b>${describe(item)}</b><small>${esc(item.actorName || "—")} · ${esc(HOF.formatDateTime(item.createdAt))}</small></span></li>`).join("")}</ol>` : `<p class="hof-empty">Bu kayıtta henüz işlem yok. Yukarıdaki düğmelerle ${toolsText} ekleyebilirsiniz.</p>`}`;
    } catch (error) {
      if (request === activityRequest) box.innerHTML = `<p class="hof-empty">${esc(error.message)}</p>`;
    }
  }

  function installDetailActions() {
    const panel = HOF.detailPanel();
    const header = panel?.querySelector(".detail-header");
    if (!header) return;
    let row = panel.querySelector(".hof-case-actions");
    if (!row) {
      row = HOF.el("div", { class: "hof-case-actions", role: "toolbar", "aria-label": "Kayıt işlemleri" }, `<button type="button" class="hof-whatsapp" data-case-action="whatsapp">WhatsApp</button><button type="button" data-case-action="note" data-requires="notes.write">Not</button><button type="button" data-case-action="phone" data-requires="phones.create">Telefon</button><button type="button" data-case-action="payment" data-requires="payments.create">Tahsilat</button><button type="button" data-case-action="task" data-requires="tasks.create">Görev</button><button type="button" data-case-action="lien" data-requires="liens.create">Haciz</button>`);
      row.addEventListener("click", event => {
        const action = event.target.closest("[data-case-action]")?.dataset.caseAction;
        if (action && actions[action]) actions[action]();
      });
    }
    if (header.nextSibling !== row) header.after(row);
  }

  // Tablo veya detaydaki telefon hücresine tıklayınca WhatsApp açılır.
  document.addEventListener("click", event => {
    const target = event.target.closest(".dynamic-table td, .dynamic-detail-grid > div");
    if (!target || event.target.closest("button, a, [data-hof-ui]")) return;
    const cell = target.closest("td");
    const header = cell ? HOF.tableHeaders(cell.closest("table"))[cell.cellIndex] || "" : "";
    const label = target.querySelector?.(".detail-label")?.textContent || "";
    if (!/(telefon|tel\b|gsm|cep)/i.test(`${header} ${label}`)) return;
    const number = extractPhones(target.textContent)[0];
    if (!number) return;
    event.preventDefault();
    openWhatsApp(number);
    HOF.toast("WhatsApp açılıyor…");
  });

  // Açık dosyanın işlem geçmişini yeniden çeker (başka bir bilgisayar not/işlem eklediğinde).
  function refreshActivity() {
    activityKey = "";
    renderActivity();
  }

  // ---------- Canlı değişiklikler (hof-live.js) ----------
  HOF.on("live:workspace.changed", change => {
    if (!change) return;
    if (change.kind === "task") {
      refreshBadges();
      // Kişiye kimliğiyle bağlı görevde kimlik, serbest yazılmış görevde ad karşılaştırılır.
      const mine = change.assigneeId ? change.assigneeId === HOF.user?.id : Boolean(change.assignee) && HOF.normalize(change.assignee) === HOF.normalize(HOF.user?.name || "");
      if (mine) {
        HOF.toast(`${change.actorName || "Bir kullanıcı"} size görev atadı: ${change.title || ""}`, { action: { label: "Görevler", onClick: () => openTasks("mine") }, timeout: 8000 });
      }
    }
    if ((change.kind === "activity" || change.kind === "task") && change.caseKey && HOF.selectedCase()?.key === change.caseKey) refreshActivity();
  });
  HOF.on("live:resync", () => {
    refreshBadges();
    refreshActivity();
  });
  // Sektör değişince (bu veya başka bir bilgisayarda) kenar çubuğu ve işlem geçmişi yeni dili kullanır.
  HOF.on("profile", () => {
    const newRecord = document.querySelector('#hof-sidecard [data-action="newRecord"] .hof-side-text');
    if (newRecord) newRecord.textContent = `Yeni ${HOF.vocab.record}`;
    renderUser();
    refreshActivity();
  });

  HOF.whenReady(() => {
    loadUsers();
    HOF.onDom(() => {
      installSidebar();
      installDetailActions();
      renderActivity();
    });
    setInterval(refreshBadges, 120_000);
  });
  HOF.workspace = { openTasks, openMessages, openReports, openLiens, refreshBadges, refreshActivity, extractPhones };
})();
