/* DestekOfis — ortak kimlik arayüzü: giriş ekranı, parola değişimi ve çıkış (uygulama ve yönetim sayfası). */
(() => {
  "use strict";
  const HOF = window.HOF;
  const html = document.documentElement;
  const hideSplash = () => document.getElementById("hof-splash")?.remove();

  // ---------- Giriş ekranı ----------
  const brand = `<div class="hof-auth-brand"><img src="/assets/brand/destekofis-mark.svg" alt="" width="48" height="48"><div><strong>DestekOfis</strong><span>Ofis yönetimi</span></div></div>`;

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
          <label class="hof-field"><span>Kullanıcı adı</span><input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required autofocus></label>
          <label class="hof-field"><span>Parola</span><span class="hof-password"><input name="password" type="password" autocomplete="current-password" required><button type="button" class="hof-password-toggle" aria-label="Parolayı göster">Göster</button></span></label>
          <p class="hof-form-error" role="alert">${HOF.esc(message)}</p>
          <button type="submit" class="hof-button hof-button-wide">Giriş yap</button>
        </form>
        <small class="hof-auth-foot">Hesabınız yoksa ofis yöneticinizden isteyin.</small>
      </section>`,
    );
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

  // ---------- Parola değişimi ----------
  HOF.changePassword = ({ forced = false } = {}) =>
    new Promise(resolve => {
      const body = `
        <p class="hof-modal-text">${forced ? "Güvenliğiniz için devam etmeden önce size verilen geçici parolayı değiştirin." : "Yeni parolanız en az 10 karakter olmalı ve harf ile rakam içermelidir."}</p>
        <form class="hof-form" novalidate>
          <label class="hof-field"><span>Mevcut parola</span><input name="currentPassword" type="password" autocomplete="current-password" required autofocus></label>
          <label class="hof-field"><span>Yeni parola</span><input name="newPassword" type="password" autocomplete="new-password" minlength="10" required><small>En az 10 karakter; harf ve rakam içermeli.</small></label>
          <label class="hof-field"><span>Yeni parola (tekrar)</span><input name="confirmPassword" type="password" autocomplete="new-password" required></label>
          <div class="hof-meter" aria-hidden="true"><span></span></div>
          <p class="hof-form-error" role="alert"></p>
          <div class="hof-actions">${forced ? '<button type="button" class="hof-button hof-button-ghost" data-logout>Çıkış yap</button>' : '<button type="button" class="hof-button hof-button-ghost" data-cancel>Vazgeç</button>'}<button type="submit" class="hof-button">Parolayı değiştir</button></div>
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
