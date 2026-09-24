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
    "settings.office.updated": "Ofis adını değiştirdi",
    "system.backup_created": "Yedek aldı",
    "system.backup_downloaded": "Yedek indirdi",
    "system.update_checked": "Güncellemeleri denetledi",
    "system.update_requested": "Güncellemeyi başlattı",
    "system.update_settings": "Güncelleme ayarını değiştirdi",
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
  async function copyText(value) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Yerel ağda (http) tarayıcı pano iznini vermeyebilir; eski yöntem denenir.
      const area = HOF.el("textarea", { text: value, readonly: true });
      area.style.cssText = "position:fixed;opacity:0;pointer-events:none";
      document.body.append(area);
      area.select();
      const done = document.execCommand("copy");
      area.remove();
      return done;
    }
  }

  function renderAddresses(info) {
    const list = $("#adm-addresses");
    const items = [...(info.addresses || [])];
    if (info.hostname) items.push(`http://${info.hostname}:${info.port}`);
    list.innerHTML = items.length
      ? items.map(url => `<li><code>${esc(url)}</code><button type="button" class="hof-button hof-button-ghost hof-button-small" data-copy="${esc(url)}">Kopyala</button></li>`).join("")
      : '<li class="adm-muted">Ağ bağlantısı bulunamadı. Sunucu bilgisayarın ağa bağlı olduğundan emin olun.</li>';
  }
  $("#adm-addresses").addEventListener("click", async event => {
    const button = event.target.closest("[data-copy]");
    if (!button) return;
    if (await copyText(button.dataset.copy)) HOF.toast("Adres kopyalandı.");
    else HOF.toast("Kopyalanamadı; adresi seçip elle kopyalayın.", { type: "error" });
  });

  $("#adm-office").addEventListener("submit", async event => {
    event.preventDefault();
    const input = $("#adm-office-name");
    const button = $("#adm-office-save");
    button.disabled = true;
    try {
      const result = await HOF.api("/api/admin/office", { method: "PUT", body: { name: input.value.trim() } });
      input.value = result.name;
      HOF.toast(result.name ? "Ofis adı kaydedildi." : "Ofis adı kaldırıldı.");
    } catch (error) {
      HOF.toastError(error);
    } finally {
      button.disabled = false;
    }
  });

  // ---------- Güncellemeler ----------
  let updateStatus = null;
  let updateTimer = null;
  const CHANNEL_LABELS = { stable: "Kararlı", beta: "Deneme (beta)" };
  const describeCheck = check => {
    if (!check) return "henüz denetlenmedi";
    const when = HOF.formatDateTime(check.at);
    if (check.status === "available") return `${when} — ${check.version} sürümü bulundu`;
    if (check.status === "up-to-date") return `${when} — sistem güncel`;
    if (check.status === "incompatible") return `${when} — kurulum dosyası gerekiyor`;
    return `${when} — denetlenemedi`;
  };

  function renderUpdate(status) {
    updateStatus = status;
    const summary = $("#adm-update-summary");
    const body = $("#adm-update-body");
    const checkButton = $("#adm-update-check");
    const applyButton = $("#adm-update-apply");
    const settings = $("#adm-update-settings");
    if (!status.enabled) {
      summary.textContent = status.reason || "Otomatik güncelleme kullanılamıyor.";
      body.innerHTML = "";
      checkButton.hidden = applyButton.hidden = settings.hidden = true;
      return;
    }
    const busy = status.state !== "idle";
    // Güncelleme bittiğinde (bakım ekranı görülmese bile) sayfa yeni sürümün arayüzüyle yeniden yüklenir.
    const pageVersion = me?.product?.version;
    if (!busy && pageVersion && status.currentVersion && status.currentVersion !== pageVersion && !renderUpdate.reloading) {
      renderUpdate.reloading = true;
      HOF.toast(`DestekOfis ${status.currentVersion} sürümüne güncellendi. Sayfa yenileniyor…`, { type: "success" });
      setTimeout(() => location.reload(), 1500);
    }
    summary.textContent = `Kurulu sürüm ${status.currentVersion} · ${CHANNEL_LABELS[status.channel] || status.channel} kanal · Son denetim: ${describeCheck(status.lastCheck)}`;
    const parts = [];
    if (status.state === "checking") parts.push('<p class="adm-update-note">Denetleniyor…</p>');
    if (status.state === "downloading" && status.progress) {
      const percent = status.progress.total ? Math.floor((status.progress.received / status.progress.total) * 100) : 0;
      parts.push(`<div class="adm-update-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><span style="width:${percent}%"></span></div><p class="adm-update-note">Yeni sürüm indiriliyor · %${percent} (${formatSize(status.progress.received)} / ${formatSize(status.progress.total)})</p>`);
    }
    if (status.state === "installing" || status.state === "switching") parts.push('<p class="adm-update-note">Kuruluyor… Sistem birazdan kısa bir süreliğine yeniden başlayacak.</p>');
    if (status.available && !busy) {
      const date = status.available.releasedAt ? ` · ${HOF.formatDateTime(status.available.releasedAt)}` : "";
      parts.push(`<div class="adm-update-available"><strong>Yeni sürüm hazır: DestekOfis ${esc(status.available.version)}</strong><small>${formatSize(status.available.size)}${esc(date)}${status.autoUpdate ? " · Sunucu yeniden başladığında kendiliğinden de kurulur." : ""}</small>${status.available.notes ? `<pre class="adm-update-notes">${esc(status.available.notes)}</pre>` : ""}</div>`);
    }
    if (status.incompatible) parts.push(`<p class="adm-update-warn">${esc(status.incompatible.reason)}</p>`);
    if (status.skippedVersions?.length && !busy) parts.push(`<p class="adm-update-warn">${esc(status.skippedVersions.join(", "))} sürümü daha önce açılamadığı için atlandı. <button type="button" class="hof-button hof-button-ghost hof-button-small" id="adm-update-retry">Yine de kur</button></p>`);
    const last = status.lastResult;
    if (last?.outcome === "success") parts.push(`<p class="adm-update-ok">✓ ${esc(last.version)} sürümüne güncellendi · ${esc(HOF.formatDateTime(last.at))}</p>`);
    else if (last?.outcome === "rolled-back") parts.push(`<p class="adm-update-warn">${esc(last.version)} sürümü açılamadı; ${esc(last.previous || "önceki")} sürümüne dönüldü. ${esc(last.reason || "")}</p>`);
    else if (last?.outcome === "failed") parts.push(`<p class="adm-update-warn">Güncelleme tamamlanamadı: ${esc(last.reason || "")}</p>`);
    if (status.lastError && !status.available && !busy) parts.push(`<p class="adm-update-warn">Son denetim başarısız: ${esc(status.lastError)}</p>`);
    body.innerHTML = parts.join("");
    checkButton.hidden = false;
    checkButton.disabled = busy;
    applyButton.hidden = !status.available || busy;
    settings.hidden = false;
    $("#adm-update-auto").checked = Boolean(status.autoUpdate);
    $("#adm-update-channel").value = status.channel;
    clearTimeout(updateTimer);
    if (busy && !document.querySelector('[data-panel="system"]').hidden) updateTimer = setTimeout(loadUpdate, 1500);
  }

  async function loadUpdate() {
    try {
      renderUpdate(await HOF.api("/api/admin/update"));
    } catch (error) {
      if (error.status !== 503) $("#adm-update-summary").textContent = error.message;
    }
  }

  async function applyUpdate(retryFailed = false) {
    const version = retryFailed ? updateStatus?.skippedVersions?.[0] : updateStatus?.available?.version;
    const ok = await HOF.confirm({
      title: "Güncelleme kurulsun mu?",
      message: `DestekOfis ${version || "yeni"} sürümüne güncellenecek. Önce veritabanının yedeği alınır; geçiş sırasında sistem yaklaşık 1 dakika kullanılamaz ve açık ekranlar kendiliğinden yenilenir. Yeni sürüm açılamazsa önceki sürüme kendiliğinden dönülür.`,
      confirmLabel: "Şimdi güncelle",
    });
    if (!ok) return;
    try {
      renderUpdate(await HOF.api("/api/admin/update/apply", { method: "POST", body: retryFailed ? { retryFailed: true } : {}, timeoutMs: 95_000 }));
      HOF.toast("Güncelleme başladı. Sistem hazır olunca sayfa kendiliğinden yenilenecek.");
      clearTimeout(updateTimer);
      updateTimer = setTimeout(loadUpdate, 1000);
    } catch (error) {
      HOF.toastError(error);
    }
  }

  $("#adm-update-check").addEventListener("click", async () => {
    const button = $("#adm-update-check");
    button.disabled = true;
    $("#adm-update-body").insertAdjacentHTML("afterbegin", '<p class="adm-update-note">Denetleniyor…</p>');
    try {
      const status = await HOF.api("/api/admin/update/check", { method: "POST", timeoutMs: 95_000 });
      renderUpdate(status);
      if (status.available) HOF.toast(`Yeni sürüm bulundu: ${status.available.version}`);
      else if (status.lastCheck?.status === "up-to-date") HOF.toast("Sistem güncel.", { type: "success" });
    } catch (error) {
      HOF.toastError(error);
      loadUpdate();
    }
  });
  $("#adm-update-apply").addEventListener("click", () => applyUpdate(false));
  $("#adm-update-body").addEventListener("click", event => {
    if (event.target.closest("#adm-update-retry")) applyUpdate(true);
  });
  const saveUpdateSettings = async changes => {
    try {
      renderUpdate(await HOF.api("/api/admin/update/settings", { method: "PUT", body: changes }));
      HOF.toast("Güncelleme ayarı kaydedildi.", { type: "success" });
    } catch (error) {
      HOF.toastError(error);
      loadUpdate();
    }
  };
  $("#adm-update-auto").addEventListener("change", event => saveUpdateSettings({ autoUpdate: event.target.checked }));
  $("#adm-update-channel").addEventListener("change", event => saveUpdateSettings({ channel: event.target.value }));

  async function loadSystem() {
    loadUpdate();
    const target = $("#adm-system");
    try {
      const info = await HOF.api("/api/admin/system");
      const nameInput = $("#adm-office-name");
      if (document.activeElement !== nameInput) nameInput.value = info.officeName || "";
      renderAddresses(info);
      const tile = (label, value, hint = "") => `<div class="adm-card adm-tile"><span>${esc(label)}</span><strong>${esc(value)}</strong>${hint ? `<small>${esc(hint)}</small>` : ""}</div>`;
      const hours = Math.floor(info.uptimeSeconds / 3600);
      target.innerHTML = [
        tile("Sürüm", `${info.product} ${info.version}`, `Node.js ${info.node}`),
        tile("Çalışma biçimi", info.supervised ? "Windows servisi" : "Doğrudan", info.supervised ? "Bilgisayar açılınca oturum açılmadan başlar; çökerse kendiliğinden yeniden başlar." : "Sunucu bir komut penceresinden çalışıyor."),
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
