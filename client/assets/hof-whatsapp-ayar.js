/* DestekOfis — Yönetim → WhatsApp (2.4.8 W1; sunucu routes/whatsapp.mjs, lib/whatsapp/connection.mjs; plan docs/erp/WHATSAPP-API-PLANI-2.4.8.md §6 W1).
   WhatsApp Business API (Meta Cloud API) bağlantısı, şirket başına. "Elle Bağla": müşterinin kendi Meta uygulamasının Telefon Numarası Kimliği, WhatsApp Business
   Hesap Kimliği, isteğe bağlı Uygulama Kimliği ve kalıcı erişim belirteci (System User). Belirteç sunucuda şifreli saklanır; ekrana bir daha gelmez (yalnız
   "Kayıtlı"). Kaydedince bağlantı hemen sınanır; "Kendime Deneme Gönder" Meta'nın hazır deneme şablonunu yöneticinin yazdığı numaraya bir kez gönderir.
   Pasif düğmenin nedeni düğmenin yanında görünür yazıyla söylenir (salt okunur lisans, Meta adresi yok, belirteç bu bilgisayarda açılamıyor). */
(() => {
  "use strict";
  const HOF = window.HOF;
  const esc = value => HOF.esc(value);
  const $ = selector => document.querySelector(selector);
  const API = "/api/workspace/whatsapp/connection";
  let view = null;

  const fact = (label, value, key) => (value ? `<div data-wa-fact="${esc(key)}"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>` : "");
  const when = value => (value ? HOF.formatDateTime(value) : "");
  const templateText = item => {
    if (!item) return "Hesapta yok (deneme gönderilemez)";
    const status = String(item.status || "").toUpperCase();
    const state = status === "APPROVED" ? "Onaylı" : status === "PENDING" ? "Onay bekliyor" : status === "REJECTED" ? "Reddedildi" : status === "PAUSED" ? "Duraklatıldı" : status === "DISABLED" ? "Kapatıldı" : item.status || "Bilinmiyor";
    return `${item.name}: ${state}${item.language ? ` (${item.language})` : ""}`;
  };
  // Düğmeleri pasif bırakan ilk neden (görünür yazı); boşsa düğmeler etkin.
  const blockOf = (data, { needsMeta }) => {
    if (!data.writable) return "Lisans salt okunur: bağlantı değiştirilemez, sınanamaz ve deneme gönderilemez.";
    if (needsMeta && !data.graphAvailable) return "Bu kurulumda WhatsApp Business API adresi tanımlı değil; Meta'ya bağlanılamaz.";
    if (needsMeta && data.configured && !data.tokenUsable) return "Kayıtlı belirteç bu bilgisayarda açılamıyor; Bilgileri Değiştir ile belirteci yeniden girin.";
    return "";
  };

  function stateOf(data) {
    if (!data.configured) return { tone: "off", label: "Bağlı Değil" };
    if (!data.lastTest) return { tone: "warn", label: "Sınanmadı" };
    return data.lastTest.ok ? { tone: "ok", label: "Bağlı" } : { tone: "error", label: "Sınama Başarısız" };
  }

  function render() {
    const data = view;
    const state = stateOf(data);
    const box = $("#adm-wa-status");
    box.className = `adm-card adm-wa-status is-${state.tone}`;
    const editBlock = blockOf(data, { needsMeta: false });
    const metaBlock = blockOf(data, { needsMeta: true });
    if (!data.configured) {
      box.innerHTML = `
        <div class="adm-wa-head"><span class="adm-license-badge" data-wa-state>${esc(state.label)}</span><h2>WhatsApp Business API Bağlantısı</h2>
          <p>Carilere ekstre ve ödeme hatırlatmasını WhatsApp'tan kendiliğinden göndermek için Meta'daki uygulamanızın bilgilerini Elle Bağla ile girin. Kendi WhatsApp'ınızla tek tek gönderim bağlantı olmadan da çalışır.</p></div>
        <div class="adm-inline"><button type="button" class="hof-button" data-wa-action="connect" ${editBlock ? "disabled" : ""}>Elle Bağla</button></div>
        ${editBlock ? `<p class="adm-wa-why" data-wa-why>${esc(editBlock)}</p>` : ""}`;
      return;
    }
    const test = data.lastTest;
    const phone = test?.ok ? test.phone : null;
    const lastTest = test ? `${when(test.at)} · ${test.ok ? "başarılı" : `başarısız — ${test.message}`}` : "Henüz sınanmadı";
    const self = data.lastSelfTest;
    const lastSelf = self ? `${when(self.at)} · …${self.to4 || ""} · ${self.ok ? `Meta kabul etti (${self.wamid})` : `gönderilemedi — ${self.message}`}` : "";
    box.innerHTML = `
      <div class="adm-wa-head"><span class="adm-license-badge" data-wa-state>${esc(state.label)}</span><h2>WhatsApp Business API Bağlantısı</h2>
        <p>${test?.ok ? "Bağlantı çalışıyor. Ücreti Meta, işletmenizin Meta hesabından çeker (yalnız teslim edilen ileti ücretlidir)." : test ? "Son sınama başarısız; nedeni aşağıda. Bilgileri düzeltip yeniden sınayın." : "Bilgiler kaydedildi; Bağlantıyı Sına ile Meta'da denetleyin."}</p></div>
      <dl class="adm-license-facts" data-wa-facts>
        ${fact("Bağlantı Yolu", data.mode === "embedded" ? "WhatsApp'ı Bağla" : "Elle Bağla (kendi Meta uygulamanız)", "mode")}
        ${fact("Telefon Numarası Kimliği", data.phoneNumberId, "phoneNumberId")}
        ${fact("WhatsApp Business Hesap Kimliği", data.wabaId, "wabaId")}
        ${fact("Uygulama Kimliği", data.appId, "appId")}
        ${fact("Erişim Belirteci", data.tokenUsable ? "Kayıtlı (şifreli; ekranda gösterilmez)" : "Kayıtlı ama bu bilgisayarda açılamıyor — yeniden girin", "token")}
        ${fact("Numara", phone?.display, "display")}
        ${fact("Görünen Ad", phone?.verifiedName, "verifiedName")}
        ${fact("Kalite", phone?.qualityLabel, "quality")}
        ${fact("Gönderim Sınırı", phone?.tierLabel, "tier")}
        ${fact("Deneme Şablonu", test?.ok ? templateText(test.templates?.test) : "", "testTemplate")}
        ${fact("Son Sınama", lastTest, "lastTest")}
        ${fact("Son Deneme", lastSelf, "lastSelfTest")}
        ${fact("Kaydeden", [data.savedByName, when(data.savedAt)].filter(Boolean).join(" · "), "saved")}
      </dl>
      <div class="adm-inline adm-wa-actions">
        <button type="button" class="hof-button" data-wa-action="test" ${metaBlock ? "disabled" : ""}>Bağlantıyı Sına</button>
        <button type="button" class="hof-button hof-button-ghost" data-wa-action="self-test" ${metaBlock ? "disabled" : ""}>Kendime Deneme Gönder</button>
        <button type="button" class="hof-button hof-button-ghost" data-wa-action="connect" ${editBlock ? "disabled" : ""}>Bilgileri Değiştir</button>
        <button type="button" class="hof-button hof-button-danger" data-wa-action="remove" ${editBlock ? "disabled" : ""}>Bağlantıyı Kaldır</button>
      </div>
      ${metaBlock ? `<p class="adm-wa-why" data-wa-why>${esc(metaBlock)}</p>` : ""}`;
  }

  async function load() {
    try {
      view = await HOF.api(API);
      render();
    } catch (error) {
      $("#adm-wa-status").innerHTML = `<p class="adm-mobile-warn">${esc(error.message)}</p>`;
    }
  }

  // Kayıttan sonra hemen sınanır; sınama başarısızsa bağlantı kayıtlı kalır, neden kartta ve bildirimde görünür.
  async function testNow({ afterSave = false } = {}) {
    try {
      view = await HOF.api(`${API}/test`, { method: "POST", body: {} });
      HOF.toast(afterSave ? "Kaydedildi; bağlantı çalışıyor." : "Bağlantı çalışıyor.", { type: "success" });
    } catch (error) {
      HOF.toastError(error);
      await load();
      return;
    }
    render();
  }

  function connectForm() {
    const data = view || {};
    HOF.formModal({
      title: "Elle Bağla",
      eyebrow: "WHATSAPP BUSINESS API",
      intro: "Meta İşletme Ayarları'nda oluşturduğunuz uygulamanın bilgilerini girin. Numara WhatsApp uygulamasında kayıtlı olmamalıdır (ör. sabit hat); yeni hesapta Meta 24 saatte en çok 250 farklı kişiye gönderime izin verir. Belirteç şifreli saklanır ve bir daha ekranda gösterilmez.",
      fields: [
        { name: "phoneNumberId", label: "Telefon Numarası Kimliği (Phone Number ID)", required: true, value: data.phoneNumberId || "", inputmode: "numeric", autofocus: true },
        { name: "wabaId", label: "WhatsApp Business Hesap Kimliği (WABA ID)", required: true, value: data.wabaId || "", inputmode: "numeric" },
        { name: "appId", label: "Uygulama Kimliği (App ID)", value: data.appId || "", inputmode: "numeric", help: "İsteğe bağlı; Meta uygulama panelinin üst kısmındaki App ID." },
        { name: "token", label: "Kalıcı Erişim Belirteci (System User)", type: "password", required: !data.hasToken, autocomplete: "new-password", help: data.hasToken ? "Kayıtlı belirteç korunur; değiştirmek için yenisini yapıştırın." : "Meta İşletme Ayarları'nda (Business Settings) System Users → Generate token; izinler: business_management, whatsapp_business_management, whatsapp_business_messaging." },
      ],
      submitLabel: "Kaydet ve Sına",
      onSubmit: async values => {
        view = await HOF.api(API, { method: "PUT", body: { phoneNumberId: values.phoneNumberId, wabaId: values.wabaId, appId: values.appId, token: values.token } });
        render();
        // Pencere kapanınca sınanır (sonuç kartta ve bildirimde).
        setTimeout(() => testNow({ afterSave: true }), 0);
      },
    });
  }

  function selfTestForm() {
    HOF.formModal({
      title: "Kendime Deneme Gönder",
      eyebrow: "WHATSAPP BUSINESS API",
      intro: "Meta'nın hazır deneme şablonu bu numaraya bir kez gönderilir. Kendi cep telefonu numaranızı yazın; ileti ücretini Meta, işletmenizin Meta hesabından çeker.",
      fields: [{ name: "to", label: "Cep Telefonu", required: true, inputmode: "tel", placeholder: "05xx xxx xx xx", autofocus: true }],
      submitLabel: "Deneme Gönder",
      onSubmit: async values => {
        const answer = await HOF.api(`${API}/self-test`, { method: "POST", body: { to: values.to } });
        view = answer.connection;
        render();
        HOF.toast(answer.result.message, { type: "success", timeout: 7000 });
      },
    });
  }

  async function removeConnection() {
    const sure = await HOF.confirm({ title: "Bağlantı kaldırılsın mı?", message: "Kayıtlı belirteç ve kimlikler bu şirketten silinir; WhatsApp ile otomatik gönderim yapılamaz. Meta'daki uygulamanız ve numaranız değişmez.", confirmLabel: "Bağlantıyı Kaldır", danger: true });
    if (!sure) return;
    try {
      view = await HOF.api(API, { method: "DELETE" });
      HOF.toast("WhatsApp bağlantısı kaldırıldı.", { type: "success" });
    } catch (error) {
      HOF.toastError(error);
    }
    await load();
  }

  document.addEventListener("click", event => {
    const button = event.target.closest("[data-wa-action]");
    if (!button || button.disabled) return;
    const action = button.dataset.waAction;
    if (action === "connect") connectForm();
    else if (action === "test") {
      button.disabled = true;
      button.classList.add("is-busy");
      testNow();
    } else if (action === "self-test") selfTestForm();
    else if (action === "remove") removeConnection();
  });

  HOF.whatsappSettings = { load };
})();
