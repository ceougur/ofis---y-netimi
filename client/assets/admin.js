/* DestekOfis — yönetim paneli: kullanıcılar, yedekler, değişiklik geçmişi ve sistem durumu. */
(() => {
  "use strict";
  const HOF = window.HOF;
  const { esc } = HOF;
  const $ = selector => document.querySelector(selector);
  let me = null;

  const EVENT_LABELS = {
    "auth.login": "Giriş yaptı",
    "auth.login_failed": "Hatalı giriş denemesi",
    "profile.updated": "Profilini güncelledi",
    "profile.password_changed": "Parolasını değiştirdi",
    "user.created": "Kullanıcı oluşturdu",
    "user.updated": "Kullanıcıyı güncelledi",
    "user.password_reset": "Parola sıfırladı",
    "user.sessions_revoked": "Oturumları kapattı",
    "source.row.created": "Yeni kayıt ekledi",
    "source.row.deleted": "Kayıt sildi",
    "source.row.restored": "Silinen kaydı geri aldı",
    "source.cell.updated": "Hücre düzeltti",
    "source.excel.uploaded": "Excel tablosu yükledi",
    "case.note.created": "Dosyaya not ekledi",
    "case.phone.created": "Telefon ekledi",
    "case.payment.created": "Tahsilat işledi",
    "case.lien.created": "Haciz kaydetti",
    "case.status_note.updated": "Dosya notunu güncelledi",
    "case.status_note.imported": "Yerel notları aktardı",
    "task.created": "Görev atadı",
    "task.completed": "Görevi tamamladı",
    "message.created": "Mesaj gönderdi",
    "settings.client.updated": "Ofis ayarını değiştirdi",
    "system.backup_created": "Yedek aldı",
    "system.backup_downloaded": "Yedek indirdi",
  };

  const formatSize = bytes => {
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    return `${(bytes / 1024 ** index).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} ${units[index]}`;
  };
  const strongPassword = () => {
    const alphabet = "ABCDEFGHJKLMNPRSTUVYZabcdefghijkmnoprstuvyz23456789";
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    let value = [...bytes].map(byte => alphabet[byte % alphabet.length]).join("");
    if (!/\d/.test(value)) value = `${value.slice(0, -1)}7`;
    return `${value.slice(0, 4)}-${value.slice(4, 8)}-${value.slice(8)}`;
  };

  // ---------- Kullanıcılar ----------
  async function loadUsers() {
    const body = $("#adm-users");
    try {
      const users = await HOF.api("/api/admin/users");
      body.innerHTML = users
        .map(user => {
          const self = user.id === me.id;
          const roles = Object.entries(HOF.roleLabels).map(([value, label]) => `<option value="${value}" ${value === user.role ? "selected" : ""}>${label}</option>`).join("");
          return `<tr data-id="${esc(user.id)}">
            <td><b>${esc(user.name)}</b>${self ? ' <span class="hof-chip">siz</span>' : ""}${user.mustChangePassword ? ' <span class="hof-chip hof-chip-high">parola bekliyor</span>' : ""}</td>
            <td>${esc(user.username)}</td>
            <td><select class="adm-role" aria-label="${esc(user.name)} rolü" ${self ? "disabled" : ""}>${roles}</select></td>
            <td><button type="button" class="adm-status ${user.active ? "is-active" : ""}" data-toggle ${self ? "disabled" : ""}>${user.active ? "Aktif" : "Pasif"}</button></td>
            <td>${user.lastLoginAt ? `${esc(HOF.formatDateTime(user.lastLoginAt))}` : '<span class="adm-muted">Hiç giriş yapmadı</span>'}</td>
            <td class="adm-right"><button type="button" class="hof-button hof-button-ghost hof-button-small" data-reset>Parola sıfırla</button> <button type="button" class="hof-button hof-button-ghost hof-button-small" data-sessions ${self ? "disabled" : ""}>Oturumları kapat</button></td>
          </tr>`;
        })
        .join("");
    } catch (error) {
      body.innerHTML = `<tr><td colspan="6">${esc(error.message)}</td></tr>`;
    }
  }

  function newUser() {
    const password = strongPassword();
    HOF.formModal({
      title: "Yeni kullanıcı",
      eyebrow: "KULLANICI YÖNETİMİ",
      fields: [
        { name: "name", label: "Ad soyad", required: true, autofocus: true, maxlength: 120 },
        { name: "username", label: "Kullanıcı adı", required: true, maxlength: 60, help: "Harf, rakam, nokta, tire; en az 3 karakter. Girişte büyük/küçük harf fark etmez." },
        { name: "role", label: "Rol", type: "select", value: "personel", options: Object.entries(HOF.roleLabels).map(([value, label]) => ({ value, label })) },
        { name: "password", label: "İlk parola", required: true, value: password, help: "Bu parolayı kullanıcıya iletin. İsterseniz değiştirebilirsiniz." },
        { name: "mustChangePassword", label: "Kullanıcı ilk girişte parolasını değiştirsin (önerilir)", type: "checkbox", value: true },
      ],
      submitLabel: "Kullanıcıyı oluştur",
      onSubmit: async data => {
        await HOF.api("/api/admin/users", { method: "POST", body: data });
        HOF.toast(`${data.name} oluşturuldu. İlk parola: ${data.password}`, { type: "success", timeout: 12000 });
        loadUsers();
      },
    });
  }

  $("#adm-users").addEventListener("change", async event => {
    if (!event.target.classList.contains("adm-role")) return;
    const row = event.target.closest("tr");
    try {
      await HOF.api(`/api/admin/users/${encodeURIComponent(row.dataset.id)}`, { method: "PATCH", body: { role: event.target.value } });
      HOF.toast("Rol güncellendi.", { type: "success" });
    } catch (error) {
      HOF.toastError(error);
    }
    loadUsers();
  });

  $("#adm-users").addEventListener("click", async event => {
    const button = event.target.closest("button");
    if (!button || button.disabled) return;
    const row = button.closest("tr");
    const id = row.dataset.id;
    const name = row.querySelector("b").textContent;
    try {
      if ("toggle" in button.dataset) {
        const activate = !button.classList.contains("is-active");
        if (!activate && !(await HOF.confirm({ title: "Kullanıcıyı pasifleştir", message: `${name} artık giriş yapamayacak ve açık oturumları kapanacak. Kayıtları silinmez.`, confirmLabel: "Pasifleştir", danger: true }))) return;
        await HOF.api(`/api/admin/users/${encodeURIComponent(id)}`, { method: "PATCH", body: { active: activate } });
        HOF.toast(activate ? `${name} aktifleştirildi.` : `${name} pasifleştirildi.`, { type: "success" });
      } else if ("reset" in button.dataset) {
        const password = strongPassword();
        HOF.formModal({
          title: "Parola sıfırla",
          eyebrow: name,
          intro: "Kullanıcının tüm açık oturumları kapanır.",
          fields: [
            { name: "password", label: "Yeni geçici parola", required: true, value: password },
            { name: "mustChangePassword", label: "İlk girişte değiştirsin", type: "checkbox", value: true },
          ],
          submitLabel: "Parolayı sıfırla",
          onSubmit: async data => {
            await HOF.api(`/api/admin/users/${encodeURIComponent(id)}/reset-password`, { method: "POST", body: data });
            HOF.toast(`${name} için yeni parola: ${data.password}`, { type: "success", timeout: 12000 });
            loadUsers();
          },
        });
        return;
      } else if ("sessions" in button.dataset) {
        const result = await HOF.api(`/api/admin/users/${encodeURIComponent(id)}/logout-all`, { method: "POST" });
        HOF.toast(`${result.removed} oturum kapatıldı.`, { type: "success" });
      }
    } catch (error) {
      HOF.toastError(error);
    }
    loadUsers();
  });

  // ---------- Yedekler ----------
  async function loadBackups() {
    const body = $("#adm-backups");
    try {
      const backups = await HOF.api("/api/admin/backups");
      body.innerHTML = backups.length
        ? backups.map(item => `<tr><td><code>${esc(item.name)}</code></td><td>${esc(HOF.formatDateTime(item.createdAt))}</td><td class="adm-right">${esc(formatSize(item.size))}</td><td class="adm-right"><a class="hof-button hof-button-ghost hof-button-small" href="/api/admin/backups/${encodeURIComponent(item.name)}" download>İndir</a></td></tr>`).join("")
        : '<tr><td colspan="4">Henüz yedek yok.</td></tr>';
    } catch (error) {
      body.innerHTML = `<tr><td colspan="4">${esc(error.message)}</td></tr>`;
    }
  }
  $("#adm-backup-now").addEventListener("click", async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const result = await HOF.api("/api/admin/backups", { method: "POST" });
      HOF.toast(`Yedek alındı: ${result.name}`, { type: "success" });
      loadBackups();
    } catch (error) {
      HOF.toastError(error);
    } finally {
      button.disabled = false;
    }
  });

  // ---------- Değişiklik geçmişi ----------
  const detail = event => {
    const payload = event.payload || {};
    const parts = [];
    if (payload.caseKey) parts.push(`Dosya ${payload.caseKey}`);
    if (payload.field) parts.push(`${payload.field}: "${payload.previousValue ?? ""}" → "${payload.value ?? ""}"`);
    if (payload.username) parts.push(`${payload.username} (${HOF.roleLabels[payload.role] || payload.role || ""})`);
    if (payload.fileName) parts.push(`${payload.fileName} · ${payload.rows} kayıt`);
    if (payload.amount) parts.push(HOF.formatMoney(payload.amount));
    if (payload.title) parts.push(payload.title);
    if (payload.recipient) parts.push(`Alıcı: ${payload.recipient}`);
    if (payload.key && event.type.startsWith("settings.")) parts.push(payload.key);
    if (payload.ip) parts.push(`IP ${payload.ip}`);
    return parts.join(" · ");
  };
  async function loadAudit() {
    const body = $("#adm-audit");
    const type = $("#adm-audit-type").value;
    try {
      const events = await HOF.api(`/api/admin/audit?limit=300&type=${encodeURIComponent(type)}`);
      body.innerHTML = events.length
        ? events.map(item => `<tr><td>${esc(HOF.formatDateTime(item.createdAt))}</td><td>${esc(item.actorName)}</td><td>${esc(EVENT_LABELS[item.type] || item.type)}</td><td class="adm-detail">${esc(detail(item))}</td></tr>`).join("")
        : '<tr><td colspan="4">Kayıt yok.</td></tr>';
    } catch (error) {
      body.innerHTML = `<tr><td colspan="4">${esc(error.message)}</td></tr>`;
    }
  }
  $("#adm-audit-type").addEventListener("change", loadAudit);

  // ---------- Sistem ----------
  async function loadSystem() {
    const target = $("#adm-system");
    try {
      const info = await HOF.api("/api/admin/system");
      const tile = (label, value, hint = "") => `<div class="adm-card adm-tile"><span>${esc(label)}</span><strong>${esc(value)}</strong>${hint ? `<small>${esc(hint)}</small>` : ""}</div>`;
      const hours = Math.floor(info.uptimeSeconds / 3600);
      target.innerHTML = [
        tile("Sürüm", `${info.product} ${info.version}`, `Node.js ${info.node}`),
        tile("Çalışma süresi", hours ? `${hours} saat` : `${Math.round(info.uptimeSeconds / 60)} dakika`, `Başlangıç ${HOF.formatDateTime(info.startedAt)}`),
        tile("Veritabanı", formatSize(info.dbSize), `Şema sürümü ${info.schemaVersion}`),
        tile("Son yedek", info.lastBackup ? HOF.formatDateTime(info.lastBackup.createdAt) : "Henüz yok", info.lastBackup ? formatSize(info.lastBackup.size) : "Yedekler sekmesinden hemen alabilirsiniz"),
        tile("Aktif kullanıcı", String(info.users)),
        tile("Veri klasörü", info.dataDir, `Yedekler: ${info.backupDir}`),
      ].join("");
    } catch (error) {
      target.innerHTML = `<div class="adm-card">${esc(error.message)}</div>`;
    }
  }

  // ---------- Sekmeler ----------
  const loaders = { users: loadUsers, backups: loadBackups, audit: loadAudit, system: loadSystem };
  function selectTab(name) {
    document.querySelectorAll(".adm-tabs [data-tab]").forEach(button => button.setAttribute("aria-selected", String(button.dataset.tab === name)));
    document.querySelectorAll(".adm-panel").forEach(panel => {
      panel.hidden = panel.dataset.panel !== name;
    });
    loaders[name]?.();
    history.replaceState(null, "", `#${name}`);
  }
  document.querySelector(".adm-tabs").addEventListener("click", event => {
    const tab = event.target.closest("[data-tab]");
    if (tab) selectTab(tab.dataset.tab);
  });
  $("#adm-new-user").addEventListener("click", newUser);
  $("#adm-logout").addEventListener("click", () => HOF.logout());
  $("#adm-password").addEventListener("click", () => HOF.changePassword());

  async function boot() {
    try {
      me = await HOF.api("/api/auth/me");
    } catch (error) {
      if (error.status === 401) return HOF.showLogin();
      document.getElementById("hof-splash")?.remove();
      return HOF.toastError(error);
    }
    HOF.user = me;
    for (const permission of me.permissions) document.documentElement.classList.add(`hof-can-${permission.replace(/\./g, "-")}`);
    document.getElementById("hof-splash")?.remove();
    if (me.mustChangePassword) {
      if (await HOF.changePassword({ forced: true })) location.reload();
      return;
    }
    $("#adm-user").textContent = `${me.name} · ${HOF.roleLabels[me.role] || me.role}`;
    if (!HOF.can("users.manage") && !HOF.can("audit.view")) {
      $("#adm-denied").hidden = false;
      return;
    }
    $("#adm-app").hidden = false;
    const visible = [...document.querySelectorAll(".adm-tabs [data-tab]")].filter(button => getComputedStyle(button).display !== "none").map(button => button.dataset.tab);
    const requested = location.hash.slice(1);
    selectTab(visible.includes(requested) ? requested : visible[0]);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
