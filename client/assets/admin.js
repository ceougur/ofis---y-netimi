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
    "user.renamed": "Kullanıcının adını düzeltti",
    "user.deleted": "Kullanıcıyı sildi",
    "user.restored": "Silinen kullanıcıyı geri aldı",
    "role.created": "Rol oluşturdu",
    "role.updated": "Rolü düzenledi",
    "role.deleted": "Rolü sildi",
    "source.row.created": "Yeni kayıt ekledi",
    "source.row.deleted": "Kayıt sildi",
    "source.row.restored": "Silinen kaydı geri aldı",
    "source.tab.renamed": "Sekmeyi yeniden adlandırdı",
    "source.tab.hidden": "Sekmeyi sildi",
    "source.tab.restored": "Sekmeyi geri yükledi",
    "source.column.added": "Tabloya sütun ekledi",
    "source.column.hidden": "Tablodan sütun sildi",
    "source.column.restored": "Sütunu geri yükledi",
    "source.cell.updated": "Hücre düzeltti",
    "source.excel.uploaded": "Excel tablosu yükledi",
    "dataset.imported": "Veri içeri aldı",
    "dataset.removed": "Veriyi kaldırdı",
    "dataset.unlinked": "Sheet bağlantısını kaldırdı",
    "dataset.missing.remove": "Sheet'te olmayan kayıtları kaldırdı",
    "dataset.missing.keep": "Sheet'te olmayan kayıtları tuttu",
    "dataset.exported": "Tabloyu Excel'e aktardı",
    "dataset.session.created": "Yeni veri oturumu açtı",
    "dataset.session.renamed": "Oturumun adını değiştirdi",
    "dataset.session.deleted": "Veri oturumunu sildi",
    "case.document.created": "Belge ekledi",
    "case.document.deleted": "Belgeyi sildi",
    "case.document.restored": "Belgeyi geri yükledi",
    "case.document.exported": "Belgeleri dışa aktardı (.zip)",
    "case.payment.restored": "Tahsilatı geri yükledi",
    "cash.entry.restored": "Kasa hareketini geri yükledi",
    "free.sheet.deleted": "Serbest sayfayı sildi",
    "free.sheet.restored": "Serbest sayfayı geri yükledi",
    "free.row.deleted": "Serbest sayfada satır sildi",
    "free.row.restored": "Serbest sayfada satırı geri yükledi",
    "free.column.deleted": "Serbest sayfada kolon sildi",
    "free.column.restored": "Serbest sayfada kolonu geri yükledi",
    "profile.sector": "Sektörü değiştirdi",
    "profile.sector.custom.created": "Kendi sektörünü oluşturdu",
    "profile.sector.custom.updated": "Kendi sektörünü düzenledi",
    "profile.sector.custom.deleted": "Kendi sektörünü sildi",
    "profile.label": "Başlığı değiştirdi",
    "profile.labels.reset": "Başlıkları varsayılana döndürdü",
    "case.note.created": "Not ekledi",
    "case.phone.created": "Telefon ekledi",
    "case.payment.created": "Tahsilat işledi",
    "case.payment.updated": "Tahsilatı düzeltti",
    "case.payment.deleted": "Tahsilatı sildi",
    "cash.entry.created": "Kasaya hareket ekledi",
    "cash.exported": "Kasa dökümünü PDF indirdi",
    "dues.settled": "Tahsilat kalemini ödendi saydı",
    "dues.cancelled": "Ödeme sözünü iptal etti",
    "dues.reopened": "Tahsilat kalemini yeniden açtı",
    "cash.entry.updated": "Kasa hareketini düzeltti",
    "cash.entry.deleted": "Kasa hareketini sildi",
    "case.lien.created": "Haciz kaydetti",
    "case.status_note.updated": "Kayıt notunu güncelledi",
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
    "license.trial_started": "Ücretsiz deneme başladı",
    "license.activated": "Lisansı etkinleştirdi",
    "license.code_applied": "Etkinleştirme kodu uyguladı",
    "license.assigned": "Lisans servisten tanımlandı",
    "license.contact_sent": "Firma bilgilerini gönderdi",
    "license.checked": "Lisansı doğruladı",
    "license.state_changed": "Lisans durumu değişti",
    "license.transition_started": "Lisans geçiş dönemi başladı",
    "license.tamper": "Lisans kaydında değişiklik fark edildi",
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

  // ---------- Kullanıcılar (v2.0.10: ✎ ad/kullanıcı adı, yetki paneli, özel roller, silme/geri alma) ----------
  let users = [];
  let roles = { builtIn: [], custom: [], groups: [], adminOnly: [] };
  let openPanelFor = "";
  const ROLE_NOTES = {
    admin: "Her şey: veri yükleme, sektör ve başlıklar, kullanıcılar ve roller, yedek, sistem ve lisans. ANLIK DURUM kartı yalnız bu rolde.",
    avukat: "Tüm kayıt işlemleri ve silme, görev atama ve herkesin görevleri, Kasa, Cari, Taksit, Stok, Çek/Senet yönetimi, tablo ve personel raporları. Veri yükleyemez.",
    personel: "Yeni kayıt, düzeltme, not, telefon, tahsilat; kendi görevleri. Silme, görev atama, Kasa ve raporlar yok.",
    muhasebe: "Personelin yaptıkları + Kasa, Cari, Taksit, Stok ve Çek/Senet yönetimi. Görev atama ve raporlar yok.",
  };
  const PENCIL = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
  const LOCK = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
  const allRoles = () => [...roles.builtIn, ...roles.custom];
  const roleOf = key => allRoles().find(role => role.key === key) || null;
  const roleLabel = key => roleOf(key)?.label || HOF.roleLabels[key] || key;
  const rolePermissions = key => new Set(roleOf(key)?.permissions || []);
  const lockedSet = () => new Set(roles.adminOnly || []);
  const permissionCount = () => roles.groups.reduce((sum, group) => sum + group.items.length, 0);
  const roleOptions = selected =>
    `${roles.builtIn.map(role => `<option value="${esc(role.key)}" ${role.key === selected ? "selected" : ""}>${esc(role.label)}</option>`).join("")}${
      roles.custom.length ? `<optgroup label="Ofisin rolleri">${roles.custom.map(role => `<option value="${esc(role.key)}" ${role.key === selected ? "selected" : ""}>${esc(role.label)}</option>`).join("")}</optgroup>` : ""
    }`;

  // Yetki havuzu: gruplu onay kutuları. base verilirse (kişiye özel ayar) rolden farklı olanlar "eklendi / kaldırıldı" diye
  // işaretlenir. Yönetime özgü yetkiler kilitli (yalnız yönetici rolünde). full: yönetici — tümü işaretli ve kapalı.
  function permGrid({ checked, base = null, full = false, readOnly = false }) {
    const locked = lockedSet();
    return `<div class="adm-perm-grid">${roles.groups
      .map(group => {
        const items = group.items
          .map(item => {
            const isLocked = locked.has(item.key);
            const on = full || (!isLocked && checked.has(item.key));
            const state = full || isLocked || !base ? "" : on && !base.has(item.key) ? "is-added" : !on && base.has(item.key) ? "is-removed" : "";
            return `<label class="adm-perm ${state} ${isLocked ? "is-locked" : ""}" title="${esc(item.help)}"><input type="checkbox" data-perm="${esc(item.key)}" ${on ? "checked" : ""} ${full || readOnly || isLocked ? "disabled" : ""}><span class="adm-perm-text"><b>${esc(item.label)}</b><small>${esc(item.help)}</small></span>${isLocked ? `<em class="adm-perm-tag is-lock is-icon" title="Yalnız yönetici" aria-label="Yalnız yönetici">${LOCK}</em>` : '<em class="adm-perm-tag" aria-hidden="true"></em>'}</label>`;
          })
          .join("");
        const allLocked = group.items.every(item => locked.has(item.key));
        return `<fieldset class="adm-perm-group"><legend><span>${esc(group.label)}</span>${full || readOnly || allLocked ? "" : `<button type="button" class="adm-perm-all" data-perm-all title="Bu gruptaki tüm yetkileri seç ya da kaldır">Tümü</button>`}</legend>${items}</fieldset>`;
      })
      .join("")}</div>`;
  }
  const checkedIn = root => new Set([...root.querySelectorAll("[data-perm]:checked:not(:disabled)")].map(input => input.dataset.perm));
  // Onay kutusu değişince "eklendi / kaldırıldı" etiketi ve özet satırı yenilenir.
  function refreshTags(root, base) {
    if (!base) return;
    let added = 0;
    let removed = 0;
    for (const input of root.querySelectorAll("[data-perm]:not(:disabled)")) {
      const label = input.closest(".adm-perm");
      const isAdded = input.checked && !base.has(input.dataset.perm);
      const isRemoved = !input.checked && base.has(input.dataset.perm);
      label.classList.toggle("is-added", isAdded);
      label.classList.toggle("is-removed", isRemoved);
      label.querySelector(".adm-perm-tag").textContent = isAdded ? "eklendi" : isRemoved ? "kaldırıldı" : "";
      added += isAdded ? 1 : 0;
      removed += isRemoved ? 1 : 0;
    }
    const summary = root.querySelector("[data-summary]");
    if (summary) summary.textContent = added || removed ? `Rolden farklı: ${added ? `${added} eklendi` : ""}${added && removed ? " · " : ""}${removed ? `${removed} kaldırıldı` : ""}` : "Rolün varsayılan yetkileri";
  }
  function wireGrid(root, base = null) {
    root.addEventListener("click", event => {
      const all = event.target.closest("[data-perm-all]");
      if (!all) return;
      const inputs = [...all.closest(".adm-perm-group").querySelectorAll("[data-perm]:not(:disabled)")];
      const next = !inputs.every(input => input.checked);
      inputs.forEach(input => {
        input.checked = next;
      });
      refreshTags(root, base);
    });
    root.addEventListener("change", event => {
      if (event.target.matches("[data-perm]")) refreshTags(root, base);
    });
    refreshTags(root, base);
  }
  const grantsFrom = (checked, base) => ({ add: [...checked].filter(key => !base.has(key)), remove: [...base].filter(key => !checked.has(key) && !lockedSet().has(key)) });

  function userRow(user) {
    const self = user.id === me.id;
    const admin = user.roleKey === "admin";
    const total = permissionCount();
    const diff = (user.grants?.add?.length || 0) + (user.grants?.remove?.length || 0);
    const pill = admin
      ? '<span class="adm-perm-pill is-full" title="Yönetici tüm yetkilere sahiptir">Tam Yetki</span>'
      : `<button type="button" class="adm-perm-pill ${openPanelFor === user.id ? "is-open" : ""}" data-perms aria-expanded="${openPanelFor === user.id}" title="Yetkileri gör ve kişiye özel ekle/çıkar">Yetkiler <b>${user.permissions.length}</b><span>/ ${total}</span>${diff ? `<i class="adm-perm-diff">${user.grants.add.length ? `+${user.grants.add.length}` : ""}${user.grants.add.length && user.grants.remove.length ? " " : ""}${user.grants.remove.length ? `−${user.grants.remove.length}` : ""}</i>` : ""}<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>`;
    return `<tr data-id="${esc(user.id)}" class="${user.active ? "" : "is-passive"}">
      <td><span class="adm-inline" data-inline="name"><b>${esc(user.name)}</b><button type="button" class="adm-pencil" data-edit="name" title="Adı düzelt" aria-label="${esc(user.name)} adını düzelt">${PENCIL}</button></span>${self ? ' <span class="hof-chip">siz</span>' : ""}${user.mustChangePassword ? ' <span class="hof-chip hof-chip-high">parola bekliyor</span>' : ""}</td>
      <td><span class="adm-inline" data-inline="username"><code>${esc(user.username)}</code><button type="button" class="adm-pencil" data-edit="username" title="Kullanıcı adını (giriş adı) düzelt" aria-label="${esc(user.name)} kullanıcı adını düzelt">${PENCIL}</button></span></td>
      <td><select class="adm-role" aria-label="${esc(user.name)} rolü" ${self ? "disabled" : ""}>${roleOptions(user.roleKey)}</select></td>
      <td><button type="button" class="adm-status ${user.active ? "is-active" : ""}" data-toggle ${self ? "disabled" : ""}>${user.active ? "Aktif" : "Pasif"}</button></td>
      <td>${pill}</td>
      <td>${user.lastLoginAt ? `${esc(HOF.formatDateTime(user.lastLoginAt))}` : '<span class="adm-muted">Hiç giriş yapmadı</span>'}</td>
      <td class="adm-right adm-row-actions"><button type="button" class="hof-button hof-button-ghost hof-button-small" data-reset>Parola Sıfırla</button><button type="button" class="hof-button hof-button-ghost hof-button-small" data-sessions ${self ? "disabled" : ""}>Oturumları Kapat</button><button type="button" class="hof-button hof-button-small adm-delete" data-delete ${self ? 'disabled title="Kendi hesabınızı silemezsiniz"' : 'title="Kullanıcıyı sil (geçmişi korunur)"'}>Sil</button></td>
    </tr>${openPanelFor === user.id && !admin ? permRow(user) : ""}`;
  }
  function permRow(user) {
    const base = rolePermissions(user.roleKey);
    return `<tr class="adm-perm-row" data-perm-for="${esc(user.id)}"><td colspan="7"><div class="adm-perm-panel" role="group" aria-label="${esc(user.name)} yetkileri">
      <div class="adm-perm-head"><div><b>${esc(user.name)} · yetkiler</b><small>Rol: <b>${esc(roleLabel(user.roleKey))}</b> — rolün verdiği ${base.size} yetki işaretli gelir. İşaret ekleyip kaldırarak bu kişiye özel ayarlayın; rolü değiştirmek diğer kişileri etkilemez.</small></div><div class="adm-perm-legend"><span class="is-added">eklendi</span><span class="is-removed">kaldırıldı</span><span class="is-lock">${LOCK}yalnız yönetici</span></div></div>
      ${permGrid({ checked: new Set(user.permissions), base })}
      <div class="adm-perm-foot"><span class="adm-perm-summary" data-summary></span><button type="button" class="hof-button hof-button-ghost hof-button-small" data-perm-reset>Rol Varsayılanına Dön</button><button type="button" class="hof-button hof-button-ghost hof-button-small" data-perm-cancel>Vazgeç</button><button type="button" class="hof-button hof-button-small" data-perm-save>Yetkileri Kaydet</button></div>
    </div></td></tr>`;
  }
  function renderUsers() {
    const body = $("#adm-users");
    body.innerHTML = users.length ? users.map(userRow).join("") : '<tr><td colspan="7">Kullanıcı yok.</td></tr>';
    const panel = body.querySelector(".adm-perm-panel");
    if (panel) wireGrid(panel, rolePermissions(users.find(user => user.id === openPanelFor)?.roleKey));
  }
  function renderRoles() {
    const card = role => {
      const note = role.builtIn ? ROLE_NOTES[role.key] || "" : role.description || "";
      const count = role.key === "admin" ? "Tüm yetkiler" : `${role.permissions.length} yetki`;
      return `<article class="adm-role-card ${role.builtIn ? "is-builtin" : "is-custom"}" data-role="${esc(role.key)}">
        <header><b>${esc(role.label)}</b><span class="hof-chip ${role.builtIn ? "" : "hof-chip-accent"}">${role.builtIn ? "Yerleşik" : "Ofisin rolü"}</span></header>
        <p class="adm-role-meta">${count} · ${role.users} kullanıcı</p>
        ${note ? `<p class="adm-role-note">${esc(note)}</p>` : ""}
        <div class="adm-role-actions">${role.builtIn ? `<button type="button" class="hof-button hof-button-ghost hof-button-small" data-role-view>Yetkileri Gör</button>${role.key === "admin" ? "" : '<button type="button" class="hof-button hof-button-ghost hof-button-small" data-role-copy>Bundan Yeni Rol</button>'}` : `<button type="button" class="hof-button hof-button-ghost hof-button-small" data-role-edit>Düzenle</button><button type="button" class="hof-button hof-button-small adm-delete" data-role-delete ${role.users ? `title="${role.users} kullanıcıda kullanılıyor"` : ""}>Sil</button>`}</div>
      </article>`;
    };
    $("#adm-role-list").innerHTML = allRoles().map(card).join("");
  }
  async function loadDeleted() {
    try {
      const list = await HOF.api("/api/admin/users/deleted");
      $("#adm-deleted").hidden = !list.length;
      $("#adm-deleted-count").textContent = String(list.length);
      $("#adm-deleted-body").innerHTML = list
        .map(item => `<tr data-deleted="${esc(item.id)}"><td><b>${esc(item.name)}</b></td><td><code>${esc(item.username)}</code></td><td>${esc(item.roleLabel || HOF.roleLabels[item.roleKey] || item.roleKey)}</td><td>${esc(HOF.formatDateTime(item.deletedAt))}${item.deletedByName ? ` · ${esc(item.deletedByName)}` : ""}</td><td class="adm-right"><button type="button" class="hof-button hof-button-ghost hof-button-small" data-restore>Geri Al</button></td></tr>`)
        .join("");
    } catch {
      $("#adm-deleted").hidden = true;
    }
  }
  // Yönetici parolası kurtarma anahtarı (v2.0.10): yoksa uyarı görünümünde; yenilenince eskisi geçersiz olur.
  let recoveryStatus = null;
  async function loadRecovery() {
    const card = $("#adm-recovery");
    try {
      recoveryStatus = await HOF.api("/api/admin/recovery");
    } catch {
      card.hidden = true;
      return;
    }
    card.hidden = false;
    card.classList.toggle("is-missing", !recoveryStatus.exists);
    $("#adm-recovery-status").innerHTML = recoveryStatus.exists
      ? `<b>Kurtarma anahtarı hazır</b> (oluşturulma: ${esc(HOF.formatDateTime(recoveryStatus.createdAt))}${recoveryStatus.createdByName ? ` · ${esc(recoveryStatus.createdByName)}` : ""}). Yönetici parolası unutulursa giriş ekranında <b>Parolamı Unuttum</b> ile bu anahtarla yeni parola belirlenir. Anahtar kaybolduysa yenileyin (eskisi geçersiz olur). Anahtar da yoksa: sunucu bilgisayarında giriş ekranı → <b>Parolamı Unuttum</b> → <b>Sunucu Kodu Oluştur</b>.`
      : "<b>Kurtarma anahtarı oluşturulmadı.</b> Yönetici parolanızı unutursanız programa bu anahtarla girersiniz; üyelik ve internet gerekmez. Oluşturun, yazdırın ve kasada saklayın.";
    $("#adm-recovery-create").textContent = recoveryStatus.exists ? "Kurtarma Anahtarını Yenile" : "Kurtarma Anahtarı Oluştur";
  }
  $("#adm-recovery-create").addEventListener("click", async () => {
    if (recoveryStatus?.exists && !(await HOF.confirm({ title: "Kurtarma anahtarı yenilensin mi?", message: "Yeni anahtar oluşturulunca eski anahtar (yazdırdığınız kâğıt) geçersiz olur. Yenisini yazdırıp saklayın.", confirmLabel: "Yenile" }))) return;
    try {
      const result = await HOF.api("/api/admin/recovery", { method: "POST", body: {} });
      await HOF.showRecoveryKey(result.key, { office: me.office?.name || "" });
      HOF.toast("Kurtarma anahtarı kaydedildi.", { type: "success" });
    } catch (error) {
      HOF.toastError(error);
    }
    loadRecovery();
  });

  async function loadUsers() {
    const body = $("#adm-users");
    loadRecovery();
    try {
      [users, roles] = await Promise.all([HOF.api("/api/admin/users"), HOF.api("/api/admin/roles")]);
      for (const role of roles.builtIn) HOF.roleLabels[role.key] = role.label;
      if (openPanelFor && !users.some(user => user.id === openPanelFor)) openPanelFor = "";
      renderUsers();
      renderRoles();
      loadDeleted();
    } catch (error) {
      body.innerHTML = `<tr><td colspan="7">${esc(error.message)}</td></tr>`;
    }
  }

  // Yeni kullanıcı: rol seçilir; "Yetkileri özelleştir" açılırsa rolün yetkileri işaretli gelir, kişiye özel ayarlanır.
  function newUser() {
    const password = strongPassword();
    let base = rolePermissions("personel");
    const gridHtml = key => (key === "admin" ? `<p class="adm-muted">Yönetici tüm yetkilere sahiptir; ayrıca ayarlanmaz.</p>${permGrid({ checked: new Set(), full: true })}` : permGrid({ checked: rolePermissions(key), base: rolePermissions(key) }));
    HOF.formModal({
      title: "Yeni Kullanıcı",
      eyebrow: "KULLANICI YÖNETİMİ",
      size: "wide",
      fields: [
        { name: "name", label: "Ad Soyad", required: true, autofocus: true, maxlength: 120 },
        { name: "username", label: "Kullanıcı Adı", required: true, maxlength: 60, help: "Harf, rakam, nokta, tire; en az 3 karakter. Girişte büyük/küçük harf fark etmez." },
        { name: "role", label: "Rol", type: "select", value: "personel", options: allRoles().map(role => ({ value: role.key, label: role.builtIn ? role.label : `${role.label} (ofisin rolü)` })) },
        { name: "password", label: "İlk Parola", required: true, value: password, help: "Bu parolayı kullanıcıya iletin. İsterseniz değiştirebilirsiniz." },
        { name: "mustChangePassword", label: "Kullanıcı ilk girişte parolasını değiştirsin (önerilir)", type: "checkbox", value: true },
      ],
      extraHtml: `<details class="adm-perm-details"><summary>Yetkileri Özelleştir <small>isteğe bağlı · seçilen rolün yetkileri işaretli gelir; ekleyip kaldırabilirsiniz</small></summary><div class="adm-perm-panel is-embedded"><div class="adm-perm-foot is-top"><span class="adm-perm-summary" data-summary></span></div><div data-grid>${gridHtml("personel")}</div></div></details>`,
      submitLabel: "Kullanıcıyı Oluştur",
      onOpen: dialog => {
        const panel = dialog.querySelector(".adm-perm-panel");
        wireGrid(panel, base);
        dialog.querySelector('select[name="role"]').addEventListener("change", event => {
          base = rolePermissions(event.target.value);
          panel.querySelector("[data-grid]").innerHTML = gridHtml(event.target.value);
          refreshTags(panel, event.target.value === "admin" ? null : base);
          if (event.target.value === "admin") panel.querySelector("[data-summary]").textContent = "";
        });
      },
      onSubmit: async (data, modal) => {
        const body = { ...data };
        if (data.role !== "admin") body.grants = grantsFrom(checkedIn(modal.dialog.querySelector("[data-grid]")), base);
        await HOF.api("/api/admin/users", { method: "POST", body });
        HOF.toast(`${data.name} oluşturuldu. İlk parola: ${data.password}`, { type: "success", timeout: 12000 });
        loadUsers();
      },
    });
  }

  // Rol düzenleyici: ad, açıklama ve havuzdan yetkiler. Yerleşik roller yalnız görüntülenir ya da kopyalanır.
  function roleEditor(role = null, { copyFrom = "" } = {}) {
    const start = role ? new Set(role.permissions) : copyFrom ? rolePermissions(copyFrom) : new Set();
    HOF.formModal({
      title: role ? `Rolü düzenle · ${role.label}` : "Yeni Rol",
      eyebrow: "ROLLER",
      size: "wide",
      intro: role ? `Bu rol ${role.users} kullanıcıda. Kaydedince hepsinin yetkileri hemen değişir (kişiye özel eklenen/kaldırılanlar korunur).` : "Rolün adını yazın ve bu roldeki kişilerin yapabileceklerini işaretleyin. Kullanıcı, sistem ve lisans yönetimi ile ANLIK DURUM kartı yalnız yönetici rolündedir.",
      fields: [
        { name: "name", label: "Rol Adı", required: true, autofocus: !role, maxlength: 60, value: role?.label || "", placeholder: "Örn. Veznedar, Sekreter, Stajyer" },
        { name: "description", label: "Kısa Açıklama", maxlength: 200, value: role?.description || "", placeholder: "İsteğe bağlı" },
      ],
      extraHtml: `${role ? "" : `<label class="hof-field adm-role-start"><span>Başlangıç</span><select data-role-start><option value="">Boş (hiç yetki yok)</option>${roles.builtIn.filter(item => item.key !== "admin").map(item => `<option value="${esc(item.key)}" ${item.key === copyFrom ? "selected" : ""}>${esc(item.label)} yetkileriyle başla</option>`).join("")}${roles.custom.map(item => `<option value="${esc(item.key)}">${esc(item.label)} yetkileriyle başla</option>`).join("")}</select></label>`}<div class="adm-perm-panel is-embedded"><div class="adm-perm-foot is-top"><span class="adm-perm-summary" data-count></span></div><div data-grid>${permGrid({ checked: start })}</div></div>`,
      submitLabel: role ? "Rolü Kaydet" : "Rolü Oluştur",
      onOpen: dialog => {
        const panel = dialog.querySelector(".adm-perm-panel");
        const count = () => {
          panel.querySelector("[data-count]").textContent = `${checkedIn(panel).size} yetki seçili`;
        };
        wireGrid(panel);
        panel.addEventListener("change", count);
        panel.addEventListener("click", () => setTimeout(count));
        count();
        dialog.querySelector("[data-role-start]")?.addEventListener("change", event => {
          panel.querySelector("[data-grid]").innerHTML = permGrid({ checked: rolePermissions(event.target.value) });
          count();
        });
      },
      onSubmit: async (data, modal) => {
        const permissions = [...checkedIn(modal.dialog.querySelector("[data-grid]"))];
        const body = { name: data.name, description: data.description, permissions };
        if (role) await HOF.api(`/api/admin/roles/${encodeURIComponent(role.key)}`, { method: "PATCH", body });
        else await HOF.api("/api/admin/roles", { method: "POST", body });
        HOF.toast(role ? `“${data.name}” rolü kaydedildi.` : `“${data.name}” rolü oluşturuldu. Kullanıcının rol listesinden seçebilirsiniz.`, { type: "success" });
        loadUsers();
      },
    });
  }
  function viewRole(role) {
    HOF.modal({
      title: `${role.label} · yetkiler`,
      eyebrow: "YERLEŞİK ROL",
      size: "wide",
      body: `<p class="hof-modal-text">${esc(ROLE_NOTES[role.key] || "")} Yerleşik roller değiştirilemez; kişiye özel yetki için kullanıcının “Yetkiler” düğmesini, farklı bir rol için “Bundan yeni rol”ü kullanın.</p><div class="adm-perm-panel is-embedded">${permGrid({ checked: new Set(role.permissions), full: role.key === "admin", readOnly: true })}</div>`,
    });
  }

  // Satır içi ✎ düzeltme (sitedeki operatör merkezi gibi): Enter kaydeder, Esc vazgeçer.
  function startInline(row, field) {
    const user = users.find(item => item.id === row.dataset.id);
    const holder = row.querySelector(`[data-inline="${field}"]`);
    if (!user || !holder || holder.querySelector("form")) return;
    const value = field === "name" ? user.name : user.username;
    holder.innerHTML = `<form class="adm-edit-form"><input value="${esc(value)}" maxlength="${field === "name" ? 120 : 60}" aria-label="${field === "name" ? "Görünen Ad" : "Kullanıcı Adı"}" ${field === "username" ? 'autocomplete="off" spellcheck="false"' : ""}><button type="submit" class="adm-inline-ok" title="Kaydet" aria-label="Kaydet">✓</button><button type="button" class="adm-inline-cancel" data-inline-cancel title="Vazgeç" aria-label="Vazgeç">✕</button></form>${field === "username" ? '<small class="adm-inline-help">Giriş adı değişir; kişi yeni adla girer. Açık oturumu kapanmaz.</small>' : ""}`;
    const form = holder.querySelector("form");
    const input = form.querySelector("input");
    input.focus();
    input.select();
    form.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        event.preventDefault();
        renderUsers();
      }
    });
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const next = input.value.trim();
      if (!next || next === value) return renderUsers();
      form.querySelector(".adm-inline-ok").disabled = true;
      try {
        await HOF.api(`/api/admin/users/${encodeURIComponent(user.id)}`, { method: "PATCH", body: { [field]: next } });
        HOF.toast(field === "name" ? `Ad düzeltildi: ${next}` : `Kullanıcı adı düzeltildi: ${next}. Kişi artık bu adla giriş yapar.`, { type: "success", timeout: field === "name" ? 5000 : 9000 });
        if (user.id === me.id && field === "name") {
          me.name = next;
          $("#adm-user").textContent = `${me.name} · ${HOF.roleLabels[me.role] || me.role}`;
        }
        loadUsers();
      } catch (error) {
        form.querySelector(".adm-inline-ok").disabled = false;
        HOF.toastError(error);
        input.focus();
      }
    });
  }

  // Silme: geçmiş korunur; açık görev varsa kime devredileceği sorulur. "Geri al" ile ya da Silinen kullanıcılar'dan döner.
  async function deleteUser(user) {
    const text = `${user.name} giriş yapamayacak ve listelerden çıkacak. Yaptığı işlemler, notlar, tahsilatlar ve mesajlar geçmişte adıyla kalır. Kullanıcı adı ve ad yeni bir hesaba verilebilir. Aşağıdaki “Silinen kullanıcılar” bölümünden geri alınabilir.`;
    const remove = async reassignTo => {
      const result = await HOF.api(`/api/admin/users/${encodeURIComponent(user.id)}${reassignTo ? `?reassignTo=${encodeURIComponent(reassignTo)}` : ""}`, { method: "DELETE" });
      HOF.toast(`${user.name} silindi.${result.reassigned ? ` ${result.reassigned} açık görev devredildi.` : ""}`, {
        type: "success",
        timeout: 9000,
        action: {
          label: "Geri Al",
          onClick: async () => {
            try {
              await HOF.api(`/api/admin/users/${encodeURIComponent(user.id)}/restore`, { method: "POST", body: {} });
              HOF.toast(`${user.name} geri alındı.${result.reassigned ? " Devredilen görevler yeni kişide kalır." : ""}`, { type: "success" });
            } catch (error) {
              HOF.toastError(error);
            }
            loadUsers();
          },
        },
      });
      if (openPanelFor === user.id) openPanelFor = "";
      loadUsers();
    };
    if (user.openTasks) {
      const heirs = users.filter(item => item.id !== user.id && item.active);
      HOF.formModal({
        title: `${user.name} silinsin mi?`,
        eyebrow: "KULLANICIYI SİL",
        intro: text,
        fields: [
          {
            name: "reassignTo",
            label: `Açık ${user.openTasks} görevi kime devredilsin?`,
            type: "select",
            value: me.id,
            options: [...heirs.map(item => ({ value: item.id, label: `${item.name}${item.id === me.id ? " (siz)" : ""} · ${item.roleLabel || roleLabel(item.roleKey)}` })), { value: "keep", label: "Devretme — görevler silinen kişide kalsın" }],
          },
        ],
        submitLabel: "Kullanıcıyı Sil",
        onOpen: dialog => dialog.querySelector('button[type="submit"]').classList.add("hof-button-danger"),
        onSubmit: data => remove(data.reassignTo),
      });
      return;
    }
    if (!(await HOF.confirm({ title: `${user.name} silinsin mi?`, message: text, confirmLabel: "Kullanıcıyı Sil", danger: true }))) return;
    try {
      await remove("");
    } catch (error) {
      HOF.toastError(error);
    }
  }
  // Geri alma: eski kullanıcı adı ya da ad artık başka hesaptaysa yenisi sorulur.
  async function restoreUser(id, row) {
    const name = row.querySelector("b").textContent;
    const username = row.querySelector("code").textContent;
    const done = () => {
      HOF.toast(`${name} geri alındı; eski parolasıyla giriş yapabilir.`, { type: "success" });
      loadUsers();
    };
    try {
      await HOF.api(`/api/admin/users/${encodeURIComponent(id)}/restore`, { method: "POST", body: {} });
      return done();
    } catch (error) {
      if (!["USERNAME_TAKEN", "NAME_TAKEN"].includes(error.data?.code)) return HOF.toastError(error);
      HOF.formModal({
        title: `${name} geri alınıyor`,
        eyebrow: "SİLİNEN KULLANICI",
        intro: error.message,
        fields: [
          { name: "name", label: "Görünen Ad", required: true, maxlength: 120, value: error.data.code === "NAME_TAKEN" ? `${name} (2)` : name },
          { name: "username", label: "Kullanıcı Adı", required: true, maxlength: 60, value: `${username}2` },
        ],
        submitLabel: "Geri Al",
        onSubmit: async data => {
          await HOF.api(`/api/admin/users/${encodeURIComponent(id)}/restore`, { method: "POST", body: data });
          done();
        },
      });
    }
  }

  $("#adm-users").addEventListener("change", async event => {
    if (!event.target.classList.contains("adm-role")) return;
    const row = event.target.closest("tr");
    const user = users.find(item => item.id === row.dataset.id);
    const next = event.target.value;
    if (next === "admin" && !(await HOF.confirm({ title: "Yönetici yapılsın mı?", message: `${user.name} yönetici olunca kullanıcıları, yedekleri, sistemi ve lisansı yönetir; ANLIK DURUM kartını görür. Kişiye özel yetki ayarları yöneticiye uygulanmaz.`, confirmLabel: "Yönetici Yap" }))) return renderUsers();
    try {
      await HOF.api(`/api/admin/users/${encodeURIComponent(row.dataset.id)}`, { method: "PATCH", body: { role: next } });
      HOF.toast(`${user.name}: rol “${roleLabel(next)}” oldu.`, { type: "success" });
    } catch (error) {
      HOF.toastError(error);
    }
    loadUsers();
  });

  $("#adm-users").addEventListener("click", async event => {
    const button = event.target.closest("button");
    if (!button || button.disabled) return;
    const permRowNode = button.closest(".adm-perm-row");
    if (permRowNode) {
      const user = users.find(item => item.id === permRowNode.dataset.permFor);
      const panel = permRowNode.querySelector(".adm-perm-panel");
      const base = rolePermissions(user.roleKey);
      if ("permCancel" in button.dataset) {
        openPanelFor = "";
        return renderUsers();
      }
      if ("permReset" in button.dataset) {
        panel.querySelectorAll("[data-perm]:not(:disabled)").forEach(input => {
          input.checked = base.has(input.dataset.perm);
        });
        return refreshTags(panel, base);
      }
      if ("permSave" in button.dataset) {
        button.disabled = true;
        try {
          const grants = grantsFrom(checkedIn(panel), base);
          await HOF.api(`/api/admin/users/${encodeURIComponent(user.id)}`, { method: "PATCH", body: { grants } });
          HOF.toast(`${user.name}: yetkiler kaydedildi${grants.add.length || grants.remove.length ? ` (${grants.add.length} eklendi, ${grants.remove.length} kaldırıldı)` : " (rolün varsayılanı)"}. Açık ekranı hemen güncellenir.`, { type: "success" });
          openPanelFor = "";
          loadUsers();
        } catch (error) {
          button.disabled = false;
          HOF.toastError(error);
        }
      }
      return;
    }
    const row = button.closest("tr");
    if (!row?.dataset.id) return;
    const id = row.dataset.id;
    const user = users.find(item => item.id === id);
    const name = user?.name || "";
    if ("inlineCancel" in button.dataset) return renderUsers();
    if (button.dataset.edit) return startInline(row, button.dataset.edit);
    if ("perms" in button.dataset) {
      openPanelFor = openPanelFor === id ? "" : id;
      renderUsers();
      document.querySelector(".adm-perm-panel")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      return;
    }
    if ("delete" in button.dataset) return deleteUser(user);
    try {
      if ("toggle" in button.dataset) {
        const activate = !button.classList.contains("is-active");
        if (!activate && !(await HOF.confirm({ title: "Kullanıcıyı Pasifleştir", message: `${name} artık giriş yapamayacak ve açık oturumları kapanacak. Kayıtları silinmez; yeniden aktifleştirebilirsiniz.`, confirmLabel: "Pasifleştir", danger: true }))) return;
        await HOF.api(`/api/admin/users/${encodeURIComponent(id)}`, { method: "PATCH", body: { active: activate } });
        HOF.toast(activate ? `${name} aktifleştirildi.` : `${name} pasifleştirildi.`, { type: "success" });
      } else if ("reset" in button.dataset) {
        const password = strongPassword();
        HOF.formModal({
          title: "Parola Sıfırla",
          eyebrow: name,
          intro: "Kullanıcının tüm açık oturumları kapanır.",
          fields: [
            { name: "password", label: "Yeni Geçici Parola", required: true, value: password },
            { name: "mustChangePassword", label: "İlk girişte değiştirsin", type: "checkbox", value: true },
          ],
          submitLabel: "Parolayı Sıfırla",
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

  $("#adm-role-list").addEventListener("click", async event => {
    const button = event.target.closest("button");
    const card = button?.closest("[data-role]");
    if (!card) return;
    const role = roleOf(card.dataset.role);
    if (!role) return;
    if ("roleView" in button.dataset) return viewRole(role);
    if ("roleCopy" in button.dataset) return roleEditor(null, { copyFrom: role.key });
    if ("roleEdit" in button.dataset) return roleEditor(role);
    if ("roleDelete" in button.dataset) {
      if (role.users) return HOF.toast(`“${role.label}” rolü ${role.users} kullanıcıda kullanılıyor. Önce o kullanıcıları başka bir role geçirin.`, { type: "error", timeout: 8000 });
      if (!(await HOF.confirm({ title: `“${role.label}” rolü silinsin mi?`, message: "Rol listeden kalkar. Bu rolü kullanan kimse yok.", confirmLabel: "Rolü Sil", danger: true }))) return;
      try {
        await HOF.api(`/api/admin/roles/${encodeURIComponent(role.key)}`, { method: "DELETE" });
        HOF.toast(`“${role.label}” rolü silindi.`, { type: "success" });
      } catch (error) {
        HOF.toastError(error);
      }
      loadUsers();
    }
  });
  $("#adm-deleted-body").addEventListener("click", event => {
    const button = event.target.closest("[data-restore]");
    if (!button) return;
    const row = button.closest("tr");
    restoreUser(row.dataset.deleted, row);
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
      loadCloud();
    } catch (error) {
      HOF.toastError(error);
    } finally {
      button.disabled = false;
    }
  });

  // ---------- Drive'a yedek (v2.0.2) ----------
  async function loadCloud() {
    const status = $("#adm-cloud-status");
    if (!status) return;
    try {
      const info = await HOF.api("/api/admin/backups/cloud");
      if (!info.enabled) {
        status.textContent = "Bağlı değil. Yedekler yalnızca bu bilgisayarda tutuluyor.";
        status.className = "adm-muted";
        return;
      }
      const where = info.mode === "folder" ? `Klasör: ${info.path}` : `Drive klasörü: ${info.folderId}`;
      const last = info.lastAt ? `Son kopya: ${HOF.formatDateTime(info.lastAt)} (${info.lastName})` : "Henüz kopya alınmadı; ilk yedekte alınır.";
      status.innerHTML = `<b>${esc(where)}</b> · ${esc(last)} · ${esc(String(info.copies))} kopya${info.lastError ? `<br><span class="adm-error">Son Hata: ${esc(info.lastError)}</span>` : ""}`;
      status.className = info.lastError ? "adm-warn" : "adm-ok";
      const input = $("#adm-cloud-target");
      if (input && !input.value) input.value = info.value || "";
    } catch (error) {
      status.textContent = error.message;
    }
  }
  $("#adm-cloud-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await HOF.api("/api/admin/backups/cloud", { method: "POST", body: { target: $("#adm-cloud-target").value } });
      HOF.toast("Drive yedeği bağlandı. Bir sonraki yedek oraya da kopyalanacak.", { type: "success" });
      loadCloud();
    } catch (error) {
      HOF.toastError(error);
    } finally {
      button.disabled = false;
    }
  });
  $("#adm-cloud-test")?.addEventListener("click", async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const result = await HOF.api("/api/admin/backups/cloud/test", { method: "POST" });
      HOF.toast(result.ok ? `Deneme başarılı: ${result.name}` : `Kopya alınamadı: ${result.error}`, { type: result.ok ? "success" : "error" });
      loadCloud();
      loadBackups();
    } catch (error) {
      HOF.toastError(error);
    } finally {
      button.disabled = false;
    }
  });
  $("#adm-cloud-off")?.addEventListener("click", async () => {
    try {
      await HOF.api("/api/admin/backups/cloud", { method: "POST", body: { target: "" } });
      $("#adm-cloud-target").value = "";
      HOF.toast("Drive yedeği kaldırıldı.");
      loadCloud();
    } catch (error) {
      HOF.toastError(error);
    }
  });

  // ---------- Değişiklik geçmişi ----------
  const detail = event => {
    const payload = event.payload || {};
    const parts = [];
    if (event.type === "user.renamed" || (event.type === "user.updated" && (payload.previousName || payload.previousUsername))) {
      if (payload.previousName) parts.push(`Ad: "${payload.previousName}" → "${payload.name}"`);
      if (payload.previousUsername) parts.push(`Kullanıcı adı: ${payload.previousUsername} → ${payload.username}`);
      if (event.type === "user.renamed") return parts.join(" · ");
    }
    if (event.type === "user.deleted") return [`${payload.name} (${payload.username})`, payload.openTasks ? `${payload.openTasks} açık görev${payload.reassignedTo ? ` → ${payload.reassignedTo}` : " kişide kaldı"}` : ""].filter(Boolean).join(" · ");
    if (event.type === "user.restored") return `${payload.name} (${payload.username})`;
    if (event.type.startsWith("role.")) return [payload.name, payload.permissions ? `${payload.permissions.length} yetki` : ""].filter(Boolean).join(" · ");
    if (event.type === "user.updated" && payload.grants) parts.push(`Kişiye özel: ${payload.grants.add?.length || 0} eklendi, ${payload.grants.remove?.length || 0} kaldırıldı`);
    if (payload.caseKey) parts.push(`Kayıt ${payload.caseKey}`);
    if (payload.field) parts.push(`${payload.field}: "${payload.previousValue ?? ""}" → "${payload.value ?? ""}"`);
    if (payload.username && !payload.previousUsername) parts.push(`${payload.username}${payload.role ? ` (${HOF.roleLabels[payload.role] || payload.role})` : ""}`);
    else if (!payload.username && payload.role && event.type === "user.updated") parts.push(`Rol: ${HOF.roleLabels[payload.role] || payload.role}${payload.active === false ? " · pasif" : ""}`);
    if (payload.fileName) parts.push(`${payload.fileName} · ${payload.rows} kayıt`);
    if (event.type === "dataset.imported") {
      const modes = { initial: "ilk yükleme", merge: "devamı olarak", replace: "yerine koyarak" };
      parts.push(`${payload.label || ""} · ${modes[payload.mode] || payload.mode} · ${payload.rows} kayıt (${payload.added || 0} yeni, ${payload.updated || 0} güncellendi${payload.removed ? `, ${payload.removed} kaldırıldı` : ""})`);
    }
    if (event.type === "dataset.removed") parts.push(`${payload.removed} kayıt`);
    if (event.type.startsWith("profile.sector.custom")) parts.push(payload.name || "");
    if (event.type === "profile.sector") parts.push(`${payload.name}${payload.source === "confirmed" ? " (analiz önerisi onaylandı)" : ""}`);
    if (event.type === "profile.label") parts.push(`${payload.name}: "${payload.previous || "varsayılan"}" → "${payload.value || "varsayılan"}"`);
    if (event.type.startsWith("dataset.missing.")) parts.push(`${payload.rows} kayıt`);
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

  // ---------- Silinenler (v2.0.2) ----------
  const TRASH_GROUPS = { row: ["row", "tab", "column"], document: ["document"], free: ["free-sheet", "free-row", "free-column"], money: ["payment", "cash", "plan", "plan-entry"] };
  let trashItems = [];
  function renderTrash() {
    const body = $("#adm-trash");
    const group = TRASH_GROUPS[$("#adm-trash-kind").value];
    const items = group ? trashItems.filter(item => group.includes(item.kind)) : trashItems;
    body.innerHTML = items.length
      ? items
          .map(
            item => `<tr data-id="${esc(item.id)}"><td>${esc(HOF.formatDateTime(item.deletedAt))}</td><td>${esc(item.actorName || "—")}</td><td><span class="adm-kind">${esc(item.kindLabel)}</span></td><td class="adm-detail"><b>${esc(item.title || "—")}</b>${item.detail ? `<small>${esc(item.detail)}</small>` : ""}<small class="adm-trash-note${item.restorable ? "" : " is-blocked"}">${esc(item.note || "")}</small></td><td class="adm-right">${item.restorable ? '<button type="button" class="hof-button hof-button-small" data-restore>Geri Yükle</button>' : ""}</td></tr>`,
          )
          .join("")
      : `<tr><td colspan="5">${trashItems.length ? "Bu türde silinen yok." : "Silinen bir şey yok."}</td></tr>`;
  }
  async function loadTrash() {
    try {
      trashItems = await HOF.api("/api/admin/trash");
      renderTrash();
    } catch (error) {
      $("#adm-trash").innerHTML = `<tr><td colspan="5">${esc(error.message)}</td></tr>`;
    }
  }
  $("#adm-trash-kind").addEventListener("change", renderTrash);
  $("#adm-trash").addEventListener("click", async event => {
    const button = event.target.closest("[data-restore]");
    if (!button) return;
    const id = button.closest("tr").dataset.id;
    button.disabled = true;
    try {
      const result = await HOF.api("/api/admin/trash/restore", { method: "POST", body: { id } });
      HOF.toast(result.message || "Geri yüklendi.", { type: "success" });
      loadTrash();
    } catch (error) {
      button.disabled = false;
      HOF.toastError(error);
    }
  });

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
    if (status.skippedVersions?.length && !busy) parts.push(`<p class="adm-update-warn">${esc(status.skippedVersions.join(", "))} sürümü daha önce açılamadığı için atlandı. <button type="button" class="hof-button hof-button-ghost hof-button-small" id="adm-update-retry">Yine de Kur</button></p>`);
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
      confirmLabel: "Şimdi Güncelle",
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
        tile("Çalışma biçimi", info.supervised ? "Windows Servisi" : "Doğrudan", info.supervised ? "Bilgisayar açılınca oturum açılmadan başlar; çökerse kendiliğinden yeniden başlar." : "Sunucu bir komut penceresinden çalışıyor."),
        tile("Çalışma süresi", hours ? `${hours} saat` : `${Math.round(info.uptimeSeconds / 60)} dakika`, `Başlangıç ${HOF.formatDateTime(info.startedAt)}`),
        tile("Veritabanı", formatSize(info.dbSize), `Şema sürümü ${info.schemaVersion}`),
        tile("Son yedek", info.lastBackup ? HOF.formatDateTime(info.lastBackup.createdAt) : "Henüz yok", info.lastBackup ? formatSize(info.lastBackup.size) : "Yedekler sekmesinden hemen alabilirsiniz"),
        tile("Aktif kullanıcı", String(info.users)),
        tile("Veri klasörü", info.dataDir, `Yedekler: ${info.backupDir}`),
        info.chatArchive ? tile("Mesaj arşivi", info.chatArchive.files ? `${info.chatArchive.files} dosya · ${formatSize(info.chatArchive.bytes)}` : "Henüz yok", `${info.chatArchive.days} günden eski sohbet mesajları programdan kaldırılır ve buraya ay ay metin dosyası olarak yazılır (Not Defteri ile açılır): ${info.chatArchive.dir}. Kişiler kendi yazışmalarının arşivini sohbet penceresinden de indirebilir.`) : "",
      ].join("");
    } catch (error) {
      target.innerHTML = `<div class="adm-card">${esc(error.message)}</div>`;
    }
  }

  // ---------- Lisans ----------
  const STATE_LABELS = { none: "Etkinleştirilmedi", transition: "Geçiş dönemi", trial: "Deneme", licensed: "Lisanslı", expired: "Süresi doldu", blocked: "Engellendi", verify: "Doğrulanamadı", clock: "Saat hatası" };
  function renderLicense(status) {
    const tone = !status.writable ? "error" : status.severity === "warn" ? "warn" : "ok";
    const row = (label, value) => (value ? `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>` : "");
    const lastCheck = status.lastCheck ? `${HOF.formatDateTime(status.lastCheck.at)} · ${status.lastCheck.ok ? "başarılı" : `başarısız (${status.lastCheck.message || "bilinmeyen hata"})`}` : "";
    $("#adm-license-status").className = `adm-card adm-license-status is-${tone}`;
    $("#adm-license-status").innerHTML = `
      <div class="adm-license-head">
        <div><span class="adm-license-badge">${esc(STATE_LABELS[status.state] || status.state)}</span><h2 data-sentence>${esc(status.title)}</h2><p>${esc(status.message)}</p></div>
        ${status.kind && !status.offline ? '<button type="button" class="hof-button hof-button-ghost" id="adm-license-check">Şimdi Doğrula</button>' : ""}
      </div>
      <dl class="adm-license-facts">
        ${row("Tür", status.kind === "trial" ? "Ücretsiz deneme" : status.kind === "license" ? (status.offline ? "Lisans (internetsiz)" : "Lisans") : "")}
        ${row("Lisans sahibi", status.customer)}
        ${row("Lisans no", status.licenseId)}
        ${row("Bitiş", status.expiresAt ? HOF.formatDate(status.expiresAt) : status.kind === "license" ? "Süresiz" : "")}
        ${row("Kalan", status.daysLeft != null && status.writable ? `${status.daysLeft} gün` : "")}
        ${row("Geçiş dönemi sonu", status.state === "transition" ? HOF.formatDate(status.transitionEndsAt) : "")}
        ${row("Son doğrulama", lastCheck)}
        ${row("İnternetsiz çalışma sınırı", status.graceUntil && status.writable ? HOF.formatDateTime(status.graceUntil) : "")}
      </dl>
      ${status.autoTrial?.lastError ? `<p class="adm-update-warn">Deneme kendiliğinden başlatılamadı (${esc(status.autoTrial.lastError)}). Program birkaç dakikada bir yeniden dener; internet bağlantısını kontrol edin veya aşağıdaki “Denemeyi şimdi başlat” düğmesine basın.</p>` : ""}
      ${status.tampered ? '<p class="adm-update-warn">Lisans kaydında elle değişiklik fark edildi; lisans servisiyle doğrulanana kadar en sıkı kurallar uygulanıyor.</p>' : ""}`;
    $("#adm-install-code").textContent = status.installCode || "—";
    // v2.0.8: kimliğin kaynağı; işletim sistemi kimliği okunamadıysa (dosya) uyarı.
    const sourceNode = $("#adm-install-source");
    if (sourceNode) {
      sourceNode.textContent = status.machineSourceText ? `Kimlik kaynağı: ${status.machineSourceText}.` : "";
      sourceNode.classList.toggle("adm-update-warn", ["file", "fallback"].includes(status.machineSource));
    }
    // Deneme yalnızca hiç etkinleştirilmemiş kurulumda anlamlıdır; süresi dolmuş deneme ikinci kez verilmez.
    $("#adm-license-trial").hidden = !status.canStartTrial;
  }
  async function loadLicense() {
    try {
      renderLicense(await HOF.api("/api/license"));
    } catch (error) {
      $("#adm-license-status").innerHTML = `<p class="adm-update-warn">${esc(error.message)}</p>`;
    }
  }
  const licenseAction = async (form, path, body, success) => {
    const button = form?.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    try {
      const status = await HOF.api(path, { method: "POST", body, timeoutMs: 45_000 });
      renderLicense(status);
      HOF.toast(success(status), { type: status.writable ? "success" : "info", timeout: 6000 });
      form?.reset();
      return status;
    } catch (error) {
      HOF.toastError(error);
      if (error.data?.license) renderLicense({ ...error.data.license, installCode: $("#adm-install-code").textContent });
      else loadLicense();
      return null;
    } finally {
      if (button) button.disabled = false;
    }
  };
  $("#adm-license-trial").addEventListener("submit", event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    licenseAction(form, "/api/license/trial", data, status => (status.state === "trial" ? `Ücretsiz deneme başladı: ${status.daysLeft} gün.` : status.title));
  });
  $("#adm-license-key").addEventListener("submit", event => {
    event.preventDefault();
    const form = event.currentTarget;
    const key = form.elements.key.value.trim();
    if (!key) return HOF.toast("Lisans anahtarını yazın.", { type: "error" });
    licenseAction(form, "/api/license/activate", { key }, status => `Lisans etkinleştirildi${status.customer ? `: ${status.customer}` : ""}.`);
  });
  $("#adm-license-code").addEventListener("submit", event => {
    event.preventDefault();
    const form = event.currentTarget;
    const code = form.elements.code.value.trim();
    if (!code) return HOF.toast("Etkinleştirme kodunu yapıştırın.", { type: "error" });
    licenseAction(form, "/api/license/code", { code }, status => status.title);
  });
  $("#adm-license-status").addEventListener("click", event => {
    if (event.target.closest("#adm-license-check")) licenseAction(null, "/api/license/check", {}, status => (status.writable ? "Lisans doğrulandı." : status.title));
  });
  $("#adm-install-copy").addEventListener("click", async () => {
    const value = $("#adm-install-code").textContent.trim();
    if (value && value !== "—" && (await copyText(value))) HOF.toast("Kurulum kodu kopyalandı.", { type: "success" });
  });

  // ---------- Sekmeler ----------
  const loaders = { users: loadUsers, backups: loadBackups, audit: loadAudit, trash: loadTrash, system: loadSystem, license: loadLicense };
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
  $("#adm-new-role").addEventListener("click", () => roleEditor());
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
    // Rol adları ofisin sektörüne göre (ör. "Avukat", "Hekim", "Emlak danışmanı"; sektörsüz "Uzman").
    if (me.profile?.roleLabels) Object.assign(HOF.roleLabels, me.profile.roleLabels);
    document.querySelectorAll("[data-role-label]").forEach(node => {
      node.textContent = HOF.roleLabels[node.dataset.roleLabel] || node.textContent;
    });
    for (const permission of me.permissions) document.documentElement.classList.add(`hof-can-${permission.replace(/\./g, "-")}`);
    document.getElementById("hof-splash")?.remove();
    if (me.mustChangePassword) {
      if (await HOF.changePassword({ forced: true })) location.reload();
      return;
    }
    $("#adm-user").textContent = `${me.name} · ${HOF.roleLabels[me.role] || me.role}`;
    // v2.0.10: Yönetim paneli yalnız yönetici rolündedir (kullanıcı ve rol yönetimi yönetime özgüdür).
    if (!HOF.can("users.manage")) {
      $("#adm-denied").hidden = false;
      return;
    }
    $("#adm-app").hidden = false;
    const visible = [...document.querySelectorAll(".adm-tabs [data-tab]")].filter(button => getComputedStyle(button).display !== "none").map(button => button.dataset.tab);
    const requested = location.hash.slice(1) === "recovery" ? "users" : location.hash.slice(1);
    // Lisans etkinleştirilmemiş veya salt okunurken yönetici önce Lisans sekmesini görür.
    const needsLicense = me.license && !me.license.writable && visible.includes("license");
    selectTab(visible.includes(requested) ? requested : needsLicense ? "license" : visible[0]);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
