/* DestekOfis — Yönetim → Mobil Cihazlar (2.4.7 M2; sunucu routes/mobile-admin.mjs, lib/mobile-remote.mjs). Kullanıcıya "Uzaktan Bağlanabilir" izni, tek kullanımlık
   karekod (5 dk) ve eşli cihaz listesi (program başına sınır, iki şirket birlikte). Sınır doluyken karekod düğmesi pasif ve nedeni görünür yazılır. */
(() => {
  "use strict";
  const HOF = window.HOF;
  const esc = value => HOF.esc(value);
  const $ = selector => document.querySelector(selector);
  let view = null;

  const statusHtml = data => {
    if (!data.licenseOk) return `<p class="adm-mobile-warn" data-mobile-license>Lisans geçerli değil; uzaktan erişim kapalı ve karekod oluşturulamaz. Eşli cihazlar silinmez, lisans yenilenince yeniden bağlanır.</p>`;
    const count = `<p class="adm-mobile-count" data-mobile-count><b>${data.used} / ${data.limit}</b> eşli cihaz (iki şirket birlikte; telefon, tablet ve uzak tarayıcı sayılır).</p>`;
    const full = data.full ? `<p class="adm-mobile-warn" data-mobile-full-note>${data.limit} cihazın hepsi eşli; yeni cihaz için önce aşağıdan birini silin.</p>` : "";
    return count + full;
  };
  const codeBlocked = (data, user) => {
    if (!data.licenseOk) return "Lisans geçerli değil.";
    if (!user.active) return "Hesap pasif.";
    if (!user.remote) return "Önce Uzaktan Bağlanabilir işaretlenmeli.";
    if (data.full) return "Cihaz sınırı dolu.";
    return "";
  };

  function render() {
    const data = view;
    $("#adm-mobile-status").innerHTML = statusHtml(data);
    $("#adm-mobile-users").innerHTML = data.users.length
      ? data.users
          .map(user => {
            const blocked = codeBlocked(data, user);
            return `<tr data-mobile-user="${esc(user.id)}"><td>${esc(user.name)}${user.active ? "" : ' <span class="hof-chip">Pasif</span>'}</td><td>${esc(user.username)}</td>
              <td><label class="adm-mobile-remote"><input type="checkbox" data-mobile-remote ${user.remote ? "checked" : ""} aria-label="${esc(user.name)}: Uzaktan Bağlanabilir"> Uzaktan Bağlanabilir</label></td>
              <td class="adm-right"><button type="button" class="hof-button hof-button-small" data-mobile-code ${blocked ? "disabled" : ""}>Karekod Oluştur</button>${blocked ? `<small class="adm-mobile-why" data-mobile-why>${esc(blocked)}</small>` : ""}</td></tr>`;
          })
          .join("")
      : '<tr><td colspan="4" class="adm-muted">Kullanıcı yok.</td></tr>';
    $("#adm-mobile-devices").innerHTML = data.devices.length
      ? data.devices
          .map(
            device => `<tr data-mobile-device="${esc(device.id)}"><td>${esc(device.name)} <small class="adm-muted">${esc(device.kindLabel)}</small></td><td>${esc(device.userName)}</td>
              <td>${esc(HOF.formatDateTime(device.createdAt))}</td><td>${esc(device.lastSeenAt ? HOF.formatDateTime(device.lastSeenAt) : "—")}</td>
              <td class="adm-right"><button type="button" class="hof-button hof-button-small hof-button-danger" data-mobile-delete>Sil</button></td></tr>`,
          )
          .join("")
      : '<tr><td colspan="5" class="adm-muted" data-mobile-empty>Eşli cihaz yok. Kullanıcının satırındaki “Karekod Oluştur” ile eşleyin.</td></tr>';
  }

  async function load() {
    try {
      view = await HOF.api("/api/admin/mobile/devices");
      render();
    } catch (error) {
      $("#adm-mobile-status").innerHTML = `<p class="adm-mobile-warn">${esc(error.message)}</p>`;
    }
  }

  function showCode(result) {
    const until = HOF.formatDateTime(result.expiresAt);
    const body = result.url
      ? `<div class="adm-mobile-qr" data-mobile-qr>${result.qr}</div><p class="hof-modal-text">${esc(result.user.name)} bu karekodu telefonunun kamerasıyla okutsun; açılan sayfada “Eşleştir”e bassın. Karekod ${result.minutes} dakika (${esc(until)}'e kadar) geçerlidir ve tek kullanımlıktır; yenisi oluşturulunca bu kod geçersiz olur.</p>`
      : `<p class="hof-modal-text" data-mobile-no-url>Karekod oluşturuldu (${esc(until)}'e kadar geçerli), ancak uzaktan bağlantı adresi henüz hazır değil. Uzaktan bağlantı açılınca karekod burada görünür.</p>`;
    HOF.modal({ title: "Karekodu Telefonla Okutun", eyebrow: "MOBİL CİHAZ EŞLEME", body, onClose: () => load() });
  }

  document.addEventListener("click", async event => {
    const codeButton = event.target.closest("[data-mobile-code]");
    const deleteButton = event.target.closest("[data-mobile-delete]");
    if (codeButton) {
      const userId = codeButton.closest("[data-mobile-user]").dataset.mobileUser;
      codeButton.disabled = true;
      try {
        showCode(await HOF.api("/api/admin/mobile/codes", { method: "POST", body: { userId } }));
      } catch (error) {
        HOF.toastError(error);
        await load();
      }
      return;
    }
    if (deleteButton) {
      const id = deleteButton.closest("[data-mobile-device]").dataset.mobileDevice;
      const device = view?.devices.find(item => item.id === id);
      if (!(await HOF.confirm({ title: "Cihaz silinsin mi?", message: `“${device?.name || "Cihaz"}” (${device?.userName || ""}) silinir; bu cihazdaki açık oturum hemen kapanır ve cihaz yeniden eşlenmeden giremez. Yer açılır.`, confirmLabel: "Sil", danger: true }))) return;
      try {
        await HOF.api(`/api/admin/mobile/devices/${encodeURIComponent(id)}`, { method: "DELETE" });
        HOF.toast("Cihaz silindi; açık oturumu kapandı.", { type: "success" });
      } catch (error) {
        HOF.toastError(error);
      }
      await load();
    }
  });
  document.addEventListener("change", async event => {
    const box = event.target.closest("[data-mobile-remote]");
    if (!box) return;
    const userId = box.closest("[data-mobile-user]").dataset.mobileUser;
    const user = view?.users.find(item => item.id === userId);
    const remote = box.checked;
    if (!remote && view?.devices.some(device => device.userId === userId)) {
      const sure = await HOF.confirm({ title: "Uzaktan bağlanma izni kaldırılsın mı?", message: `${user?.name || "Kullanıcı"} kişisinin bütün eşli cihazları silinir ve açık oturumları hemen kapanır. İzin yeniden verilirse cihazlar yeniden eşlenir.`, confirmLabel: "İzni Kaldır", danger: true });
      if (!sure) {
        box.checked = true;
        return;
      }
    }
    try {
      await HOF.api(`/api/admin/mobile/access/${encodeURIComponent(userId)}`, { method: "PUT", body: { remote } });
    } catch (error) {
      HOF.toastError(error);
    }
    await load();
  });

  HOF.mobileDevices = { load };
})();
