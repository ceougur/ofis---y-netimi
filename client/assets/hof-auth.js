/* DestekOfis — ortak kimlik arayüzü: giriş ekranı, parola değişimi ve çıkış (uygulama ve yönetim sayfası). */
(() => {
  "use strict";
  const HOF = window.HOF;
  const html = document.documentElement;
  const hideSplash = () => document.getElementById("hof-splash")?.remove();

  // ---------- Giriş ekranı ----------
  const brand = `<div class="hof-auth-brand"><img src="/assets/brand/destekofis-mark.svg" alt="" width="48" height="48"><div><strong>DestekOfis</strong><span>Ofis Yönetimi</span></div></div>`;

  HOF.showLogin = function showLogin(message = "") {
    if (document.getElementById("hof-auth")) return;
    hideSplash();
    html.classList.add("hof-auth-required");
    const node = HOF.el(
      "div",
      { id: "hof-auth", class: "hof-auth" },
      `<section class="hof-auth-card" role="dialog" aria-modal="true" aria-labelledby="hof-auth-title">
        ${brand}
        <h1 id="hof-auth-title">Ofis hesabınızla giriş yapın</h1>
        <p class="hof-auth-help">Bu sunucuya bağlı tüm bilgisayarlar aynı merkezi çalışma alanını kullanır.</p>
        <form class="hof-form" novalidate>
          <label class="hof-field"><span>Kullanıcı Adı</span><input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required autofocus></label>
          <label class="hof-field"><span>Parola</span><span class="hof-password"><input name="password" type="password" autocomplete="current-password" required><button type="button" class="hof-password-toggle" aria-label="Parolayı göster">Göster</button></span></label>
          <p class="hof-form-error" role="alert">${HOF.esc(message)}</p>
          <button type="submit" class="hof-button hof-button-wide">Giriş Yap</button>
        </form>
        <button type="button" class="hof-auth-forgot" data-forgot>Parolamı Unuttum</button>
        <small class="hof-auth-foot">Hesabınız yoksa ofis yöneticinizden isteyin.</small>
      </section>`,
    );
    node.querySelector("[data-forgot]").addEventListener("click", () => showRecovery(node));
    document.body.appendChild(node);
    HOF.api("/api/public/info")
      .then(info => {
        // Alt satır: ofis adı; yoksa seçili sektörün alt başlığı ("Hukuk ofisi yönetimi", "Klinik yönetimi"…).
        const name = info?.office?.name;
        const text = name || info?.tagline;
        if (text) node.querySelector(".hof-auth-brand span").textContent = text;
        document.title = name ? `${name} · DestekOfis` : `DestekOfis${info?.tagline ? ` · ${info.tagline}` : ""}`;
      })
      .catch(() => {});
    const form = node.querySelector("form");
    const error = form.querySelector(".hof-form-error");
    const toggle = form.querySelector(".hof-password-toggle");
    toggle.onclick = () => {
      const input = form.elements.password;
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      toggle.textContent = show ? "Gizle" : "Göster";
      toggle.setAttribute("aria-label", show ? "Parolayı gizle" : "Parolayı göster");
    };
    form.elements.username.focus();
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const username = form.elements.username.value.trim();
      const password = form.elements.password.value;
      if (!username || !password) {
        error.textContent = "Kullanıcı adı ve parola gerekli.";
        return;
      }
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      button.textContent = "Giriş yapılıyor…";
      error.textContent = "";
      try {
        await HOF.api("/api/auth/login", { method: "POST", body: { username, password } });
        location.reload();
      } catch (failure) {
        error.textContent = failure.message;
        button.disabled = false;
        button.textContent = "Giriş yap";
        form.elements.password.select();
      }
    });
  };

  // ---------- Parolamı unuttum (v2.0.10) ----------
  // Personel: parolayı yönetici sıfırlar. Yönetici: kurtarma anahtarı ya da sunucu bilgisayarında üretilen tek seferlik kod
  // ile yeni parola belirler; eski parola sorulmaz. Başarılı olunca doğrudan içeri alınır.
  async function showRecovery(node) {
    const card = node.querySelector(".hof-auth-card");
    let info = { local: false, hasKey: false };
    try {
      info = await HOF.api("/api/auth/recovery");
    } catch {
      // bilgi alınamazsa iki yol da anlatılır
    }
    card.innerHTML = `${brand}
      <h1 id="hof-auth-title">Parolamı Unuttum</h1>
      <div class="hof-auth-note"><b>Personel misiniz?</b> Parolanızı ofis yöneticiniz sıfırlar: Yönetim → Kullanıcılar → Parola sıfırla.</div>
      <p class="hof-auth-help"><b>Yönetici misiniz?</b> Yazdırıp sakladığınız <b>kurtarma anahtarıyla</b> ya da sunucu bilgisayarında üretilen <b>sunucu koduyla</b> yeni parola belirleyin. Eski parolanız sorulmaz; kayıtlarınız olduğu gibi kalır.</p>
      <form class="hof-form" novalidate>
        <label class="hof-field"><span>Yönetici Kullanıcı Adı</span><input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="ör. admin"><small>Ofiste tek yönetici varsa boş bırakabilirsiniz.</small></label>
        <label class="hof-field"><span>Kurtarma Anahtarı ya da Sunucu Kodu</span><input name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" required placeholder="XXXXX-XXXXX-XXXXX-XXXXX" class="hof-code-input"></label>
        <label class="hof-field"><span>Yeni Parola</span><input name="newPassword" type="password" autocomplete="new-password" minlength="10" required><small>En az 10 karakter; harf ve rakam içermeli.</small></label>
        <label class="hof-field"><span>Yeni Parola (tekrar)</span><input name="confirmPassword" type="password" autocomplete="new-password" required></label>
        <p class="hof-form-error" role="alert"></p>
        <button type="submit" class="hof-button hof-button-wide">Yeni Parolayı Kaydet ve Gir</button>
      </form>
      <div class="hof-auth-local">${
        info.local
          ? `<p><b>Anahtarınız yok mu?</b> Bu bilgisayar sunucu bilgisayarı. Tek seferlik kod oluşturun; kod bu bilgisayardaki bir dosyaya yazılır ve dosyayı yalnız Windows yöneticisi açabilir.</p><button type="button" class="hof-button hof-button-ghost hof-button-wide" data-local>Sunucu Kodu Oluştur</button><div class="hof-auth-local-result" data-local-result hidden></div>`
          : "<p><b>Anahtarınız yok mu?</b> Programın kurulu olduğu <b>sunucu bilgisayarında</b> tarayıcıdan bu ekranı açın (Başlat → DestekOfis); orada “Sunucu kodu oluştur” düğmesi görünür.</p>"
      }</div>
      <button type="button" class="hof-auth-forgot" data-back>← Giriş Ekranına Dön</button>`;
    const form = card.querySelector("form");
    const error = form.querySelector(".hof-form-error");
    form.elements.code.focus();
    card.querySelector("[data-back]").onclick = () => {
      node.remove();
      HOF.showLogin();
    };
    card.querySelector("[data-local]")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      const box = card.querySelector("[data-local-result]");
      button.disabled = true;
      try {
        const result = await HOF.api("/api/auth/recovery/local-code", { method: "POST", body: {} });
        box.hidden = false;
        box.innerHTML = `<p>Kod ${result.minutes} dakika geçerli. Açmak için: <b>Başlat → DestekOfis → Yönetici kurtarma kodunu aç</b> (Windows onay sorar). Kısayol yoksa (program kurulum dosyasıyla değil otomatik güncellemeyle geldiyse): Başlat'ta <b>Not Defteri</b>'ni sağ tıklayıp <b>Yönetici Olarak Çalıştır</b> deyin, <b>Dosya → Aç</b> kutusuna şu yolu yapıştırın:</p><code>${HOF.esc(result.file)}</code><button type="button" class="hof-button hof-button-ghost hof-button-small" data-copy-path>Yolu Kopyala</button>`;
        box.querySelector("[data-copy-path]").onclick = () => navigator.clipboard?.writeText(result.file).then(() => HOF.toast("Dosya yolu kopyalandı.", { type: "success" })).catch(() => {});
        form.elements.code.focus();
      } catch (failure) {
        box.hidden = false;
        box.textContent = failure.message;
      } finally {
        setTimeout(() => {
          button.disabled = false;
        }, 20_000);
      }
    });
    form.addEventListener("submit", async event => {
      event.preventDefault();
      error.textContent = "";
      const code = form.elements.code.value.trim();
      const newPassword = form.elements.newPassword.value;
      if (!code || !newPassword) {
        error.textContent = "Kodu ve yeni parolayı yazın.";
        return;
      }
      if (newPassword !== form.elements.confirmPassword.value) {
        error.textContent = "Yeni parolalar birbiriyle aynı değil.";
        return;
      }
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        const result = await HOF.api("/api/auth/recover", { method: "POST", body: { username: form.elements.username.value.trim(), code, newPassword } });
        if (result.newKey) {
          // Kullanılan anahtar geçersizleşti; yenisi yalnız şimdi gösterilir.
          node.remove();
          await HOF.showRecoveryKey(result.newKey, { office: result.office?.name || "", used: true });
        }
        location.reload();
      } catch (failure) {
        error.textContent = failure.message;
        button.disabled = false;
      }
    });
  }

  // Kurtarma anahtarı penceresi: bir kez gösterilir; yazdırılır ya da kopyalanır. "Kaydettim" işaretlenmeden kapanmaz.
  function printKey(key, office) {
    const win = window.open("", "_blank", "width=720,height=640");
    if (!win) return HOF.toast("Yazdırma penceresi açılamadı; tarayıcının açılır pencere izni gerekiyor. Anahtarı kopyalayıp bir yere yazın.", { type: "error", timeout: 9000 });
    const today = new Date().toLocaleDateString("tr-TR");
    win.document.write(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>DestekOfis kurtarma anahtarı</title><style>body{font:15px/1.5 system-ui,Segoe UI,sans-serif;color:#142b25;margin:40px}h1{font-size:22px;margin:0 0 6px}.key{margin:22px 0;padding:18px;border:2px dashed #1f6a50;border-radius:12px;font:700 26px/1.2 ui-monospace,Consolas,monospace;letter-spacing:.08em;text-align:center}small{color:#555}ol{padding-left:20px}</style></head><body><h1>DestekOfis — Yönetici Kurtarma Anahtarı</h1><p>${HOF.esc(office || "")}${office ? " · " : ""}${today}</p><div class="key">${HOF.esc(key)}</div><ol><li>Yönetici parolanızı unutursanız giriş ekranında <b>Parolamı Unuttum</b>'a tıklayın.</li><li>Bu anahtarı ve yeni parolanızı yazın; eski parola sorulmaz.</li><li>Anahtar bir kez kullanılır; kullanınca program yenisini verir, onu da yazdırın.</li></ol><p><small>Bu kâğıdı kasada ya da kilitli bir dolapta saklayın. Anahtarı bilen kişi yönetici hesabına girebilir. Kaybolduysa Yönetim → Kullanıcılar → Kurtarma anahtarını yenile (eskisi geçersiz olur).</small></p><script>window.onload=()=>{window.print();}<\/script></body></html>`);
    win.document.close();
    return true;
  }
  HOF.showRecoveryKey = (key, { office = "", used = false } = {}) =>
    new Promise(resolve => {
      const modal = HOF.modal({
        title: used ? "Yeni kurtarma anahtarınız" : "Kurtarma anahtarınız",
        eyebrow: "YÖNETİCİ PAROLASI KURTARMA",
        size: "small",
        dismissible: false,
        body: `<p class="hof-modal-text">${used ? "Kullandığınız anahtar artık geçersiz. Bu yeni anahtarı <b>şimdi</b> yazdırın ya da güvenli bir yere yazın; bir daha gösterilmez." : "Yönetici parolanızı unutursanız giriş ekranında <b>Parolamı Unuttum</b> ile bu anahtarla yeni parola belirlersiniz. Anahtar <b>bir daha gösterilmez</b>; yazdırıp kasada saklayın."}</p>
          <div class="hof-recovery-key" aria-label="Kurtarma anahtarı">${HOF.esc(key)}</div>
          <div class="hof-actions hof-recovery-actions"><button type="button" class="hof-button hof-button-ghost" data-print>Yazdır</button><button type="button" class="hof-button hof-button-ghost" data-copy>Kopyala</button></div>
          <label class="hof-check"><input type="checkbox" data-saved><span>Anahtarı yazdırdım ya da güvenli bir yere kaydettim</span></label>
          <div class="hof-actions"><button type="button" class="hof-button" data-done disabled>Tamam</button></div>`,
        onClose: () => resolve(true),
      });
      const dialog = modal.dialog;
      dialog.querySelector("[data-print]").onclick = () => printKey(key, office);
      dialog.querySelector("[data-copy]").onclick = () =>
        navigator.clipboard
          ?.writeText(key)
          .then(() => HOF.toast("Anahtar kopyalandı. Bir yere yapıştırıp saklayın.", { type: "success" }))
          .catch(() => HOF.toast("Kopyalanamadı; anahtarı elle yazın.", { type: "error" }));
      dialog.querySelector("[data-saved]").onchange = event => {
        dialog.querySelector("[data-done]").disabled = !event.target.checked;
      };
      dialog.querySelector("[data-done]").onclick = () => modal.close(true);
    });

  // ---------- Parola değişimi ----------
  HOF.changePassword = ({ forced = false } = {}) =>
    new Promise(resolve => {
      const body = `
        <p class="hof-modal-text">${forced ? "Güvenliğiniz için devam etmeden önce size verilen geçici parolayı değiştirin." : "Yeni parolanız en az 10 karakter olmalı ve harf ile rakam içermelidir."}</p>
        <form class="hof-form" novalidate>
          <label class="hof-field"><span>Mevcut Parola</span><input name="currentPassword" type="password" autocomplete="current-password" required autofocus></label>
          <label class="hof-field"><span>Yeni Parola</span><input name="newPassword" type="password" autocomplete="new-password" minlength="10" required><small>En az 10 karakter; harf ve rakam içermeli.</small></label>
          <label class="hof-field"><span>Yeni Parola (tekrar)</span><input name="confirmPassword" type="password" autocomplete="new-password" required></label>
          <div class="hof-meter" aria-hidden="true"><span></span></div>
          <p class="hof-form-error" role="alert"></p>
          <div class="hof-actions">${forced ? '<button type="button" class="hof-button hof-button-ghost" data-logout>Çıkış Yap</button>' : '<button type="button" class="hof-button hof-button-ghost" data-cancel>Vazgeç</button>'}<button type="submit" class="hof-button">Parolayı Değiştir</button></div>
        </form>`;
      const modal = HOF.modal({ title: forced ? "Parolanızı yenileyin" : "Parola değiştir", eyebrow: "HESAP GÜVENLİĞİ", size: "small", body, dismissible: !forced, onClose: done => resolve(Boolean(done)) });
      const form = modal.dialog.querySelector("form");
      const error = form.querySelector(".hof-form-error");
      const meter = form.querySelector(".hof-meter span");
      form.elements.newPassword.addEventListener("input", () => {
        const value = form.elements.newPassword.value;
        const score = [value.length >= 10, /[a-zçğıöşü]/i.test(value) && /\d/.test(value), /[^A-Za-z0-9çğıöşüÇĞİÖŞÜ]/.test(value), value.length >= 14].filter(Boolean).length;
        meter.style.width = `${score * 25}%`;
        meter.dataset.score = String(score);
      });
      form.querySelector("[data-cancel]")?.addEventListener("click", () => modal.close());
      form.querySelector("[data-logout]")?.addEventListener("click", HOF.logout);
      form.addEventListener("submit", async event => {
        event.preventDefault();
        const currentPassword = form.elements.currentPassword.value;
        const newPassword = form.elements.newPassword.value;
        if (newPassword !== form.elements.confirmPassword.value) {
          error.textContent = "Yeni parolalar birbiriyle aynı değil.";
          return;
        }
        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        try {
          await HOF.api("/api/auth/change-password", { method: "POST", body: { currentPassword, newPassword } });
          HOF.toast("Parolanız değiştirildi.", { type: "success" });
          modal.close(true);
        } catch (failure) {
          error.textContent = failure.message;
          button.disabled = false;
        }
      });
    });

  HOF.logout = async () => {
    try {
      await HOF.api("/api/auth/logout", { method: "POST" });
    } finally {
      location.reload();
    }
  };

  HOF.brandHtml = brand;

  // ---------- Bakım katmanı ----------
  // Sunucu güncellenirken/yeniden başlarken API 503 MAINTENANCE döner: katman gösterilir, sunucu dönünce sayfa yenilenir.
  let maintenanceShown = false;
  HOF.showMaintenance = (payload = {}) => {
    if (maintenanceShown) return;
    maintenanceShown = true;
    hideSplash();
    const updating = payload.phase === "updating";
    const title = updating ? "Sistem güncelleniyor" : payload.phase === "starting" ? "Sistem başlatılıyor" : "Sunucu yeniden başlatılıyor";
    const text = updating ? "Sistem güncelleniyor, lütfen 1 dakika sonra tekrar deneyin." : "Sunucu kısa bir süre için yeniden başlatılıyor.";
    const node = HOF.el(
      "div",
      { class: "hof-auth hof-maintenance", role: "status", "aria-live": "polite" },
      `<section class="hof-auth-card">${brand}<h1>${title}</h1><p class="hof-auth-help">${text} Hazır olunca sayfa kendiliğinden yenilenecek; yaptığınız kayıtlar sunucuda güvende.</p>${payload.detail ? `<p class="hof-maintenance-detail">${HOF.esc(payload.detail)}</p>` : ""}<div class="hof-progress"><span></span></div></section>`,
    );
    document.body.appendChild(node);
    const check = async () => {
      try {
        const response = await HOF.nativeFetch("/api/health", { cache: "no-store" });
        if (response.ok) return location.reload();
      } catch {
        // Sunucu henüz dönmedi.
      }
      setTimeout(check, 3000);
    };
    setTimeout(check, 3000);
  };
  HOF.on("maintenance", HOF.showMaintenance);
})();
