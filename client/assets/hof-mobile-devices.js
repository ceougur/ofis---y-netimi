/* DestekOfis — Yönetim → Mobil Cihazlar (2.4.7 M2; sunucu routes/mobile-admin.mjs, lib/mobile-remote.mjs). Kullanıcıya "Uzaktan Bağlanabilir" izni, tek kullanımlık
   karekod (5 dk) ve eşli cihaz listesi (program başına sınır, iki şirket birlikte). Sınır doluyken karekod düğmesi pasif ve nedeni görünür yazılır.
   P14 (kullanıcı kararı 29.10.2026): karekodun altında AYNI tek kullanımlık kodu taşıyan "Eşleme Bağlantısı" + "Kopyala" — karekod okuyamayan uzak bilgisayar
   için; kurallar karekodla aynı. Kod adresin # kısmında (sunucu günlüğüne, Referer'a düşmez). */
(() => {
  "use strict";
  const HOF = window.HOF;
  const esc = value => HOF.esc(value);
  const $ = selector => document.querySelector(selector);
  let view = null;

  // 2.4.8 L1 (ürün sahibi kararı "KARAR L1"): mobil kullanım hakkı. Bitişe 7 gün kala "Lisansınız N gün sonra bitiyor."; ücretli lisans bitince 30 gün salt okunur
  // ("Lisansınız bitti; mobil kullanım hakkınız N gün sonra sona erecek."); sonunda "Mobil kullanım hakkınız sona erdi; lisansınızı yenileyin.". Kapıcı kaydı
  // silindiyse (hak sona erdikten 30 gün sonra) telefonlar karekodla yeniden eşlenir.
  const HAK_EK = Object.freeze({
    hosgoru: "Bu sürede eşli cihazlar salt okunur bağlanır; yeni karekod oluşturulamaz.",
    "deneme-bitti": "Mobil kaydınız deneme bitişinden 30 gün sonra silinir; o güne kadar lisans alınırsa eşli cihazlar yeniden bağlanır, sonra telefonlar karekodla yeniden eşlenir.",
    bitti: "Mobil kaydınız silinir; lisans yenilenince telefonları karekodla yeniden eşlersiniz.",
    engelli: "Eşli cihazlar silinmez; mobil kaydınız engelden 30 gün sonra silinir.",
    kapali: "Eşli cihazlar silinmez, lisans yenilenince yeniden bağlanır.",
  });
  const hakHtml = data => {
    const hak = data.mobileRight || {};
    const silindi = data.kapiSilindi ? `<p class="adm-mobile-warn" data-mobile-kapi-silindi>Mobil kullanım hakkı sona erdiği için mobil kaydınız silindi; telefonları karekodla yeniden eşleyin.</p>` : "";
    if (!data.licenseOk) {
      const ileti = hak.ileti || "Lisans geçerli değil; uzaktan erişim kapalı ve karekod oluşturulamaz.";
      return `<p class="adm-mobile-warn" data-mobile-license data-mobile-hak="${esc(hak.durum || "")}">${esc(ileti)} ${esc(HAK_EK[hak.durum] || HAK_EK.kapali)}</p>` + silindi;
    }
    return (hak.ileti ? `<p class="adm-mobile-warn" data-mobile-hak="${esc(hak.durum || "")}">${esc(hak.ileti)}</p>` : "") + silindi;
  };
  const statusHtml = data => {
    if (!data.licenseOk) return hakHtml(data) + (data.mobileRight?.acik ? ozetHtml(data.ozet) : "");
    const count = `<p class="adm-mobile-count" data-mobile-count><b>${data.used} / ${data.limit}</b> eşli cihaz (iki şirket birlikte; telefon, tablet ve uzak tarayıcı sayılır).</p>`;
    const full = data.full ? `<p class="adm-mobile-warn" data-mobile-full-note>${data.limit} cihazın hepsi eşli; yeni cihaz için önce aşağıdan birini silin.</p>` : "";
    return hakHtml(data) + count + full + ozetHtml(data.ozet);
  };
  // 2.4.7 M3: sunucu kapalıyken telefonda görünen şifreli özetin son yüklemesi (kapıcı açıksa).
  // B2b: kapıcıyla ölçülen saat farkı 2 dakika ya da daha çoksa (program farkı düzeltir, ama başka şeyler de saate bağlı) kullanıcı uyarılır.
  const saatHtml = saat => {
    const fark = Math.abs(Number(saat?.farkMs) || 0);
    return fark >= 2 * 60_000 ? `<p class="adm-mobile-warn" data-mobile-saat>Bu bilgisayarın saati ${Math.round(fark / 60_000)} dakika farklı; Windows saat ayarını eşitleyin.</p>` : "";
  };
  const ozetHtml = ozet => (ozet?.enabled ? saatHtml(ozet.saat) + sonYuklemeHtml(ozet) : "");
  const sonYuklemeHtml = ozet => {
    const son = ozet.son;
    if (!son) return `<p class="adm-mobile-count" data-mobile-ozet>Bulut Özeti: henüz yüklenmedi (ilk eşli cihazla yüklenir).</p>`;
    const zaman = new Date(son.zaman).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
    return son.ok
      ? `<p class="adm-mobile-count" data-mobile-ozet>Bulut Özeti: son yükleme ${esc(zaman)} (sunucu kapalıyken telefonda bu hâl görünür).</p>`
      : `<p class="adm-mobile-warn" data-mobile-ozet>Bulut Özeti yüklenemedi (${esc(zaman)}): ${esc(son.mesaj || son.kod)}</p>`;
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
    HOF.mobileTunnel?.load();
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
      ? `<div class="adm-mobile-qr" data-mobile-qr>${result.qr}</div><p class="hof-modal-text">${esc(result.user.name)} bu karekodu telefonunun kamerasıyla okutsun; açılan sayfada “Eşleştir”e bassın. Karekod ${result.minutes} dakika (${esc(until)}'e kadar) geçerlidir ve tek kullanımlıktır; yenisi oluşturulunca bu kod geçersiz olur.</p>
        <div class="adm-mobile-link"><label class="hof-field"><span>Eşleme Bağlantısı</span><input type="text" readonly data-mobile-link value="${esc(result.url)}" aria-label="Eşleme Bağlantısı"></label><button type="button" class="hof-button hof-button-small" data-mobile-copy>Kopyala</button></div>
        <p class="hof-modal-text adm-muted">Karekod okuyamayan uzak bilgisayarda bu bağlantıyı tarayıcıda açın; o bilgisayar eşlenir. Kurallar karekodla aynıdır: ${result.minutes} dakika geçerli, tek kullanımlık; bağlantıyı yalnız ${esc(result.user.name)} ile paylaşın.</p>`
      : `<p class="hof-modal-text" data-mobile-no-url>Karekod oluşturuldu (${esc(until)}'e kadar geçerli), ancak uzaktan bağlantı adresi henüz hazır değil. Uzaktan bağlantı açılınca karekod burada görünür.</p>`;
    HOF.modal({ title: "Karekodu Telefonla Okutun", eyebrow: "MOBİL CİHAZ EŞLEME", body, onClose: () => load() });
  }

  // Bağlantıyı panoya kopyala (güvenli olmayan adreste — ofis ağı http — pano erişimi yoksa seçip execCommand ile).
  async function copyLink(button) {
    const input = button.closest(".adm-mobile-link")?.querySelector("[data-mobile-link]");
    if (!input) return;
    let copied = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(input.value);
        copied = true;
      }
    } catch {
      copied = false;
    }
    if (!copied) {
      input.focus();
      input.select();
      try {
        copied = document.execCommand("copy");
      } catch {
        copied = false;
      }
    }
    HOF.toast(copied ? "Eşleme bağlantısı kopyalandı." : "Kopyalanamadı; bağlantıyı seçip elle kopyalayın.", { type: copied ? "success" : "warn" });
  }

  document.addEventListener("click", async event => {
    const copyButton = event.target.closest("[data-mobile-copy]");
    if (copyButton) {
      await copyLink(copyButton);
      return;
    }
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
