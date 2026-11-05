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
  // T2 dar kontrol D3: durum bildirimi yolu (teslim / okundu bilgisi; Meta'da WhatsApp hesabı başına tek adres — lib/whatsapp/connection.mjs ensureHook) kartta görünür.
  // Çakışma: aynı WhatsApp hesabı başka bir bilgisayarda da bağlı; program adresi kendiliğinden ezmez, Bağlantıyı Sına bu bilgisayarı seçer.
  const HOOK_CONFLICT = "Teslim ve okundu bilgisi şu an bu bilgisayara gelmiyor olabilir: aynı WhatsApp hesabı başka bir bilgisayarda da bağlı. Bu bilgisayarda almak için Bağlantıyı Sına'ya basın; öbür bilgisayarda kullanılmıyorsa bağlantıyı orada kaldırın.";
  const hookText = hook => {
    if (!hook) return "Kayıtlı Değil · ofisin uzaktan bağlantısı açılınca kendiliğinden kaydedilir";
    if (hook.state === "active") return `Çalışıyor${hook.registeredAt ? ` · ${when(hook.registeredAt)} tarihinde kaydedildi` : ""}`;
    if (hook.state === "pending") return "Kaydediliyor · Meta'nın yanıtı bekleniyor";
    // 2.4.9 UI tur B (ORTA-3): hücrede yalnız durum + an; neden düğmelerin altında ayrı satırda (hookFailure).
    if (hook.state === "failed") return `Kaydedilemedi${hook.at ? ` · ${when(hook.at)}` : ""}`;
    if (hook.state === "conflict") return "Çakışma · Meta'daki adres bu bilgisayarınkinden farklı";
    return hook.state || "Bilinmiyor";
  };
  // 2.4.9 UI tur B (ORTA-3, UI/UX gezintisi 04.11): Bildirim Yolu kaydedilemediyse neden Türkçe satırda (sunucu Meta'nın iletisini ayırır — lib/whatsapp/connection.mjs
  // hookView); Meta'nın ham iletisi (İngilizce) varsa ayrı, küçük satırda. Önce hata yalnız dar hücrede, İngilizce ileti ve iç içe parantezle görünüyordu.
  const HOOK_FAILED_TAIL = "Kaydedilene dek teslim ve okundu bilgisi bu bilgisayara gelmez; program saatte bir kendiliğinden yeniden dener.";
  const hookFailure = hook => {
    const raw = String(hook.cause ?? hook.error ?? "").trim();
    const cause = raw && !/[.!?]$/.test(raw) ? `${raw}.` : raw;
    const meta = String(hook.metaMessage || "").trim();
    const code = hook.metaCode != null && !meta.includes(`#${hook.metaCode}`) ? ` (hata kodu ${hook.metaCode})` : "";
    const why = `<p class="adm-wa-why" data-wa-hook-why>${esc(`Bildirim Yolu kaydedilemedi${cause ? ` — ${cause}` : "."} ${HOOK_FAILED_TAIL}`)}</p>`;
    return meta ? `${why}<p class="adm-wa-why adm-wa-meta" data-wa-hook-meta>${esc(`Meta iletisi: ${meta}${code}`)}</p>` : why;
  };
  const HOOK_WARNING = "Bağlantı çalışıyor; ancak Bildirim Yolu kaydedilemedi — nedeni aşağıda.";
  // 2.4.8 W7: WhatsApp'ı Bağla yalnız programın YEREL / ÖZEL AĞ adresinden (bağlama penceresi sırrı yalnız böyle kökenden kabul eder). Kural
  // server/lib/whatsapp/embedded.mjs isLocalOrigin ve bulut/kapi/wa-bagla.mjs yerelKoken ile AYNI (test/whatsapp-w7-tasinma-248.test.mjs karşılaştırır).
  // <yerel-koken>
  function isLocalOrigin(origin) {
    let url;
    try {
      url = new URL(String(origin));
    } catch {
      return false;
    }
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.origin !== String(origin)) return false;
    const host = url.hostname;
    if (host === "localhost" || host === "[::1]" || /^([a-z0-9-]+\.)+local$/.test(host)) return true;
    const ip = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
    if (!ip) return false;
    const a = Number(ip[1]);
    const b = Number(ip[2]);
    return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  // </yerel-koken>
  const LOCAL_ONLY = "WhatsApp'ı Bağla işlemi ofisteki bilgisayardan yapılır: programı ofis ağındaki bir bilgisayarda açıp yeniden deneyin.";
  // Düğmeleri pasif bırakan ilk neden (görünür yazı); boşsa düğmeler etkin.
  const blockOf = (data, { needsMeta }) => {
    if (!data.writable) return "Lisans salt okunur: bağlantı değiştirilemez, sınanamaz ve deneme gönderilemez.";
    if (needsMeta && !data.graphAvailable) return "Bu kurulumda WhatsApp Business API adresi tanımlı değil; Meta'ya bağlanılamaz.";
    if (needsMeta && data.configured && !data.tokenUsable) return "Kayıtlı belirteç bu bilgisayarda açılamıyor; Bilgileri Değiştir ile belirteci yeniden girin.";
    return "";
  };

  function stateOf(data) {
    if (!data.configured) return { tone: "off", label: "Bağlı Değil" };
    // 2.5.0 W-1(a): belirtecin süresi doldu (Meta 190 ya da bitiş anı geçti) — yeni gönderim başlatılamaz; Yeniden Bağla.
    if (data.tokenExpiry?.state === "expired") return { tone: "error", label: "Süresi Doldu" };
    if (!data.lastTest) return { tone: "warn", label: "Sınanmadı" };
    return data.lastTest.ok ? { tone: "ok", label: "Bağlı" } : { tone: "error", label: "Sınama Başarısız" };
  }
  // 2.5.0 W-1(a): Bağlantı Süresi satırı (Yol 2: Meta'nın verdiği süre ya da bağlanma + 60 gün; Yol 1: süresiz sayılır).
  const tokenText = token => {
    if (!token) return "";
    if (token.state === "expired") return token.expiredBy === "meta" ? `Süresi Doldu · Meta erişim belirtecini kabul etmiyor${token.expiredAt ? ` (${when(token.expiredAt)})` : ""}` : `Süresi Doldu · ${when(token.expiresAt)}`;
    if (!token.expiresAt) return "Süresiz sayılır · Meta belirteci reddederse bağlantı Süresi Doldu olur";
    return `${when(token.expiresAt)} tarihine kadar · ${token.daysLeft > 1 ? `${token.daysLeft} gün kaldı` : "1 günden az kaldı"}`;
  };
  const tokenNotice = token => (token && token.state !== "ok" && token.message ? `<p class="adm-wa-token${token.state === "expired" ? " is-expired" : ""}" data-wa-token-why>${esc(token.message)}</p>` : "");

  function render() {
    const data = view;
    const state = stateOf(data);
    const box = $("#adm-wa-status");
    box.className = `adm-card adm-wa-status is-${state.tone}`;
    const editBlock = blockOf(data, { needsMeta: false });
    const metaBlock = blockOf(data, { needsMeta: true });
    // WhatsApp'ı Bağla'nın kendi nedeni (yerel adres): yalnız o düğme pasif, neden görünür yazıyla; Elle Bağla etkilenmez.
    const embeddedBlock = editBlock || (isLocalOrigin(location.origin) ? "" : LOCAL_ONLY);
    const embeddedWhy = !editBlock && embeddedBlock ? `<p class="adm-wa-why" data-wa-why-embedded>${esc(embeddedBlock)}</p>` : "";
    if (!data.configured) {
      box.innerHTML = `
        <div class="adm-wa-head"><span class="adm-license-badge" data-wa-state>${esc(state.label)}</span><h2>WhatsApp Business API Bağlantısı</h2>
          <p>Carilere ekstre ve ödeme hatırlatmasını WhatsApp'tan kendiliğinden göndermek için WhatsApp'ı Bağla ile işletmenizin WhatsApp Business numarasını Facebook hesabınızla bağlayın ya da Meta'daki kendi uygulamanızın bilgilerini Elle Bağla ile girin. Kendi WhatsApp'ınızla tek tek gönderim bağlantı olmadan da çalışır.</p></div>
        <div class="adm-inline"><button type="button" class="hof-button" data-wa-action="embedded" ${embeddedBlock ? "disabled" : ""}>WhatsApp'ı Bağla</button><button type="button" class="hof-button hof-button-ghost" data-wa-action="connect" ${editBlock ? "disabled" : ""}>Elle Bağla</button></div>
        ${editBlock ? `<p class="adm-wa-why" data-wa-why>${esc(editBlock)}</p>` : ""}${embeddedWhy}`;
      return;
    }
    const test = data.lastTest;
    const phone = test?.ok ? test.phone : null;
    const lastTest = test ? `${when(test.at)} · ${test.ok ? "başarılı" : `başarısız — ${test.message}`}` : "Henüz sınanmadı";
    const self = data.lastSelfTest;
    const lastSelf = self ? `${when(self.at)} · …${self.to4 || ""} · ${self.ok ? `Meta kabul etti (${self.wamid})` : `gönderilemedi — ${self.message}`}` : "";
    const token = data.tokenExpiry || null;
    const expired = token?.state === "expired";
    // 2.5.0 W-1(a): süresi dolan bağlantıda deneme de gönderilmez (Bağlantıyı Sına açık kalır); Yeniden Bağla her zaman görünür (pasifse nedeni yazılı).
    const selfBlock = metaBlock || (expired ? "Bağlantının süresi doldu; deneme iletisi gönderilemez. Yeniden Bağla ile bağlantıyı yenileyin." : "");
    const reconnectBlock = data.mode === "embedded" ? embeddedBlock : editBlock;
    const reconnect = token && token.state !== "ok" ? `<button type="button" class="hof-button" data-wa-action="reconnect" ${reconnectBlock ? "disabled" : ""}>Yeniden Bağla</button>` : "";
    box.innerHTML = `
      <div class="adm-wa-head"><span class="adm-license-badge" data-wa-state>${esc(state.label)}</span><h2>WhatsApp Business API Bağlantısı</h2>
        <p>${expired ? "Bağlantının süresi doldu; nedeni aşağıda. Yeniden Bağla ile bağlantıyı yenileyin." : test?.ok ? "Bağlantı çalışıyor. Ücreti Meta, işletmenizin Meta hesabından çeker (yalnız teslim edilen ileti ücretlidir)." : test ? "Son sınama başarısız; nedeni aşağıda. Bilgileri düzeltip yeniden sınayın." : "Bilgiler kaydedildi; Bağlantıyı Sına ile Meta'da denetleyin."}</p></div>
      ${tokenNotice(token)}
      <dl class="adm-license-facts" data-wa-facts>
        ${fact("Bağlantı Yolu", data.mode === "embedded" ? "WhatsApp'ı Bağla" : "Elle Bağla (kendi Meta uygulamanız)", "mode")}
        ${fact("Telefon Numarası Kimliği", data.phoneNumberId, "phoneNumberId")}
        ${fact("WhatsApp Business Hesap Kimliği", data.wabaId, "wabaId")}
        ${fact("Uygulama Kimliği", data.appId, "appId")}
        ${fact("Erişim Belirteci", data.tokenUsable ? "Kayıtlı (şifreli; ekranda gösterilmez)" : "Kayıtlı ama bu bilgisayarda açılamıyor — yeniden girin", "token")}
        ${fact("Bağlantı Süresi", tokenText(token), "tokenExpiry")}
        ${fact("Numara", phone?.display, "display")}
        ${fact("Görünen Ad", phone?.verifiedName, "verifiedName")}
        ${fact("Kalite", phone?.qualityLabel, "quality")}
        ${fact("Gönderim Sınırı", phone?.tierLabel, "tier")}
        ${fact("Deneme Şablonu", test?.ok ? templateText(test.templates?.test) : "", "testTemplate")}
        ${fact("Son Sınama", lastTest, "lastTest")}
        ${fact("Bildirim Yolu", hookText(data.hook), "hook")}
        ${fact("Son Deneme", lastSelf, "lastSelfTest")}
        ${fact("Kaydeden", [data.savedByName, when(data.savedAt)].filter(Boolean).join(" · "), "saved")}
        ${data.embedded ? fact("Numara Kullanımı", data.embedded.coex ? "WhatsApp Business uygulamasıyla birlikte" : "Yalnız WhatsApp Business API", "coex") : ""}
        ${data.embedded?.steps?.length ? fact("Meta Adımları", data.embedded.steps.map(step => `${STEP_LABEL[step.name] || step.name}: ${step.ok ? "tamam" : `tamamlanamadı — ${step.message}`}`).join(" · "), "steps") : ""}
      </dl>
      <div class="adm-inline adm-wa-actions">
        ${reconnect}
        <button type="button" class="hof-button${reconnect ? " hof-button-ghost" : ""}" data-wa-action="test" ${metaBlock ? "disabled" : ""}>Bağlantıyı Sına</button>
        <button type="button" class="hof-button hof-button-ghost" data-wa-action="self-test" ${selfBlock ? "disabled" : ""}>Kendime Deneme Gönder</button>
        ${data.mode === "embedded" ? (reconnect ? "" : `<button type="button" class="hof-button hof-button-ghost" data-wa-action="embedded" ${embeddedBlock ? "disabled" : ""}>WhatsApp'ı Yeniden Bağla</button>`) : `<button type="button" class="hof-button hof-button-ghost" data-wa-action="connect" ${editBlock ? "disabled" : ""}>Bilgileri Değiştir</button>`}
        <button type="button" class="hof-button hof-button-danger" data-wa-action="remove" ${editBlock ? "disabled" : ""}>Bağlantıyı Kaldır</button>
      </div>
      ${metaBlock ? `<p class="adm-wa-why" data-wa-why>${esc(metaBlock)}</p>` : selfBlock ? `<p class="adm-wa-why" data-wa-why-self>${esc(selfBlock)}</p>` : ""}${data.mode === "embedded" ? embeddedWhy : ""}
      ${data.hook?.state === "conflict" ? `<p class="adm-wa-why" data-wa-hook-why>${esc(HOOK_CONFLICT)}</p>` : ""}${data.hook?.state === "failed" ? hookFailure(data.hook) : ""}`;
  }

  async function load() {
    try {
      view = await HOF.api(API);
      render();
    } catch (error) {
      $("#adm-wa-status").innerHTML = `<p class="adm-mobile-warn">${esc(error.message)}</p>`;
    }
    // 2.4.8 W5: Bilgilendirme Şablonları kartı (hof-whatsapp-sablon.js) bağlantıyla birlikte yenilenir.
    await HOF.whatsappTemplates?.load();
    await loadSending();
  }

  // ---------- 2.4.8 W4: Gönderim Onayı ve Bu Ay Gönderilen İleti Sayısı ----------
  // Bir kez onay (plan §1, §7a 28): işaretlenmeden toplu/tekli otomatik gönderim BAŞLAMAZ (sunucu da reddeder). "Bu Ay": teslim edilen ileti (Teslim Edildi +
  // Okundu), ay Türkiye saatiyle teslim zamanı, kapsam aynı WhatsApp hesabını kullanan bütün şirketler (§7a 19); Meta faturasıyla karşılaştırma notu.
  const usd = value => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(Number(value) || 0);
  async function loadSending() {
    const box = $("#adm-wa-sending");
    if (!box) return;
    if (!view?.configured) {
      box.hidden = true;
      return;
    }
    let ack = null;
    let stats = null;
    try {
      [ack, stats] = await Promise.all([HOF.api("/api/workspace/whatsapp/ack"), HOF.api("/api/workspace/whatsapp/stats")]);
    } catch (error) {
      box.hidden = false;
      box.innerHTML = `<p class="adm-mobile-warn">${esc(error.message)}</p>`;
      return;
    }
    const writable = view.writable !== false;
    const month = stats?.month ? `${stats.month.slice(5, 7)}.${stats.month.slice(0, 4)}` : "";
    box.hidden = false;
    box.innerHTML = `
      <div class="adm-wa-head"><h2>Gönderim Onayı</h2>
        <p>Carilere WhatsApp ile otomatik gönderim, aşağıdaki onay bu şirket için bir kez işaretlenmeden başlamaz. Carilerinizi kişisel verileri hakkında bilgilendirmek için aşağıdaki Aydınlatma Metni Hazırla'yı kullanabilirsiniz.</p></div>
      <label class="hof-check adm-wa-ack"><input type="checkbox" data-wa-ack data-nodirty ${ack.acknowledged ? "checked" : ""} ${writable ? "" : "disabled"}><span>${esc(ack.text)}</span></label>
      <p class="adm-muted" data-wa-ack-state>${ack.acknowledged ? `Onaylandı: ${esc(when(ack.at))}${ack.byName ? ` · ${esc(ack.byName)}` : ""}` : "Onay verilmedi; otomatik gönderim başlatılamaz."}</p>
      ${writable ? "" : '<p class="adm-wa-why" data-wa-ack-why>Lisans salt okunur: onay değiştirilemez.</p>'}
      <div class="adm-wa-head adm-wa-month"><h2>Bu Ay Gönderilen İleti Sayısı${month ? ` (${esc(month)})` : ""}</h2></div>
      <dl class="adm-license-facts" data-wa-month>
        <div data-wa-month-fact="delivered"><dt>Teslim Edilen İleti</dt><dd>${esc(String(stats.delivered ?? 0))}</dd></div>
        <div data-wa-month-fact="billable"><dt>Ücretli Teslim</dt><dd>${esc(String(stats.billable ?? 0))}</dd></div>
        <div data-wa-month-fact="accepted"><dt>Meta Kabul Etti</dt><dd>${esc(String(stats.accepted ?? 0))}</dd></div>
        <div data-wa-month-fact="usd"><dt>Yaklaşık Ücret</dt><dd>≈ ${esc(usd(stats.approxUsd))} USD (ücretli teslim × ${esc(usd(stats.unitUsd))} USD)</dd></div>
      </dl>
      <p class="adm-muted" data-wa-month-note>Sayı programın kaydıdır; Meta faturası esastır. Meta'daki Fatura ve Ödemeler sayfasıyla karşılaştırın: ay sınırı burada Türkiye saatine göredir, Meta hesabınızın saat dilimi farklıysa ayın ilk ve son günündeki iletiler farklı aya düşebilir. Aynı WhatsApp hesabını kullanan öbür şirketin iletileri de sayılır.</p>`;
  }
  document.addEventListener("change", async event => {
    const box = event.target.closest?.("[data-wa-ack]");
    if (!box) return;
    box.disabled = true;
    try {
      await HOF.api("/api/workspace/whatsapp/ack", { method: "PUT", body: { ack: box.checked } });
      HOF.toast(box.checked ? "Gönderim onayı kaydedildi." : "Gönderim onayı kaldırıldı; otomatik gönderim başlatılamaz.", { type: box.checked ? "success" : "info" });
    } catch (error) {
      HOF.toastError(error);
    }
    await loadSending();
  });

  // Kayıttan sonra hemen sınanır; sınama başarısızsa bağlantı kayıtlı kalır, neden kartta ve bildirimde görünür.
  async function testNow({ afterSave = false } = {}) {
    try {
      view = await HOF.api(`${API}/test`, { method: "POST", body: {} });
      // 2.4.8 W5: bağlantı kaydedilip sınanınca program iki bilgilendirme şablonunu (yoksa) Meta'da kendisi açar; sonuç Şablonlar kartında.
      if (afterSave) await HOF.whatsappTemplates?.ensure({ quiet: true });
      // 2.4.9 UI tur B (ORTA-3): sınama başarılı ama Bildirim Yolu kaydedilemediyse yeşil "çalışıyor" değil UYARI; neden kartta düğmelerin altında.
      if (view?.hook?.state === "failed") HOF.toast(afterSave ? `Kaydedildi. ${HOOK_WARNING}` : HOOK_WARNING, { type: "warn" });
      else HOF.toast(afterSave ? "Kaydedildi; bağlantı çalışıyor." : "Bağlantı çalışıyor.", { type: "success" });
    } catch (error) {
      HOF.toastError(error);
      await load();
      return;
    }
    render();
  }

  // renew (2.5.0 W-1(a) Yeniden Bağla, Elle Bağla yolu): süresi dolan / dolmak üzere olan belirtecin yerine yenisi ZORUNLU.
  function connectForm({ renew = false } = {}) {
    const data = view || {};
    const keep = data.hasToken && !renew;
    HOF.formModal({
      title: renew ? "Yeniden Bağla" : "Elle Bağla",
      eyebrow: "WHATSAPP BUSINESS API",
      intro: renew
        ? "Meta İşletme Ayarları'nda (Business Settings) System Users → Generate token ile yeni kalıcı belirteç oluşturup aşağıya yapıştırın. Kimlikler kayıtlı değerlerle dolu gelir. Belirteç şifreli saklanır ve bir daha ekranda gösterilmez."
        : "Meta İşletme Ayarları'nda oluşturduğunuz uygulamanın bilgilerini girin. Numara WhatsApp uygulamasında kayıtlı olmamalıdır (ör. sabit hat); yeni hesapta Meta 24 saatte en çok 250 farklı kişiye gönderime izin verir. Belirteç şifreli saklanır ve bir daha ekranda gösterilmez.",
      fields: [
        { name: "phoneNumberId", label: "Telefon Numarası Kimliği (Phone Number ID)", required: true, value: data.phoneNumberId || "", inputmode: "numeric", autofocus: !renew },
        { name: "wabaId", label: "WhatsApp Business Hesap Kimliği (WABA ID)", required: true, value: data.wabaId || "", inputmode: "numeric" },
        { name: "appId", label: "Uygulama Kimliği (App ID)", value: data.appId || "", inputmode: "numeric", help: "İsteğe bağlı; Ekstre şablonunu Meta'da açmak için gerekir (Meta uygulama panelinin üst kısmındaki App ID)." },
        { name: "token", label: "Kalıcı Erişim Belirteci (System User)", type: "password", required: !keep, autofocus: renew, autocomplete: "new-password", help: keep ? "Kayıtlı belirteç korunur; değiştirmek için yenisini yapıştırın." : "Meta İşletme Ayarları'nda (Business Settings) System Users → Generate token; izinler: business_management, whatsapp_business_management, whatsapp_business_messaging." },
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

  // ---------- 2.4.8 W7: WhatsApp'ı Bağla (Embedded Signup + birlikte kullanım) ----------
  // Düğme düz açık (ürün sahibi kararı). Bağlama sayfası DestekOfis kapıcısında (Meta'nın izin verdiği sabit HTTPS alanı); pencere tıklama anında açılır
  // (açılır pencere engeli), adresi program kapıcıdan alınca verilir. TAŞINAMAZ BAĞLANTI: sunucu her oturumda tek kullanımlık SIR verir (kapıcıda yalnız
  // özeti); sır ADRESE YAZILMAZ, yalnız bu ekranın açtığı pencereye postMessage ile, hedef köken TAM kapıcının kökeni verilir — pencere "hazırım" deyince
  // (aynı pencere, aynı köken, aynı oturum). Başkasına gönderilen bağlantı sırsızdır; kapıcı sayfası Meta akışını başlatmaz. Program sonucu iki saniyede bir
  // sorar; Meta onayı yoksa iletisi görünür. Yönetim sayfası Cross-Origin-Opener-Policy: same-origin-allow-popups ile sunulur (pencereyle bağ kalsın).
  const STEP_LABEL = Object.freeze({ register: "Numara Kaydı", smb_app_state_sync: "Kişi Eşitlemesi", history: "Geçmiş Eşitlemesi" });
  const WINDOW_NAME = "destekofis-wa-bagla";
  const WINDOW_FEATURES = "popup,width=640,height=760";
  let embeddedBusy = false;
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function embeddedConnect(button) {
    if (embeddedBusy) return;
    if (!isLocalOrigin(location.origin)) {
      HOF.toast(LOCAL_ONLY, { type: "info", timeout: 8000 });
      return;
    }
    embeddedBusy = true;
    button?.classList.add("is-busy");
    let popup = window.open("about:blank", WINDOW_NAME, WINDOW_FEATURES);
    let secret = "";
    let onMessage = null;
    try {
      if (!popup) {
        HOF.toast("Tarayıcı bağlama penceresini engelledi. Bu adres için açılır pencerelere izin verip WhatsApp'ı Bağla'ya yeniden basın.", { type: "error", timeout: 10000 });
        return;
      }
      let session;
      try {
        session = await HOF.api(`${API}/embedded`, { method: "POST", body: {} });
      } catch (error) {
        popup.close();
        HOF.toastError(error);
        return;
      }
      secret = String(session.secret || "");
      let kapiOrigin = "";
      try {
        kapiOrigin = new URL(session.url).origin;
      } catch {
        kapiOrigin = "";
      }
      if (!secret || !kapiOrigin.startsWith("https://")) {
        popup.close();
        HOF.toast("Kapıcının yanıtı okunamadı; WhatsApp'ı Bağla'yı yeniden deneyin.", { type: "error" });
        return;
      }
      // Sır yalnız: bu pencereden (event.source), kapıcının kökeninden, bu oturum için; bir kez verilir ("alındı" gelince bellekten silinir).
      onMessage = event => {
        if (!secret || event.source !== popup || event.origin !== kapiOrigin) return;
        const data = event.data;
        if (!data || typeof data !== "object" || data.oturum !== session.session) return;
        if (data.tur === "destekofis-wa-hazir") popup.postMessage({ tur: "destekofis-wa-sir", oturum: session.session, sir: secret }, kapiOrigin);
        else if (data.tur === "destekofis-wa-alindi") secret = "";
      };
      window.addEventListener("message", onMessage);
      if (popup.closed) popup = window.open("about:blank", WINDOW_NAME, WINDOW_FEATURES);
      if (!popup) {
        HOF.toast("Bağlama penceresi kapatıldı; bağlantı tamamlanmadı. WhatsApp'ı Bağla'yı yeniden açabilirsiniz.", { type: "info", timeout: 8000 });
        return;
      }
      popup.location.href = session.url;
      HOF.toast("Açılan pencerede Facebook ile devam edin; bağlantı tamamlanınca bu ekran kendiliğinden yenilenir.", { type: "info", timeout: 8000 });
      const until = Date.now() + session.seconds * 1000;
      let closedPolls = 0;
      while (Date.now() < until) {
        await wait(2000);
        let answer;
        try {
          answer = await HOF.api(`${API}/embedded/${encodeURIComponent(session.session)}`, { method: "POST", body: {} });
        } catch (error) {
          HOF.toastError(error);
          return;
        }
        if (answer.state === "ready") {
          view = answer.connection;
          render();
          await HOF.whatsappTemplates?.ensure({ quiet: true });
          HOF.toast("WhatsApp bağlandı.", { type: "success" });
          await load();
          return;
        }
        if (answer.state === "error") {
          HOF.toast(answer.message, { type: "error", timeout: 12000 });
          return;
        }
        if (popup.closed && (closedPolls += 1) > 2) {
          HOF.toast("Bağlama penceresi kapatıldı; bağlantı tamamlanmadı. WhatsApp'ı Bağla'yı yeniden açabilirsiniz.", { type: "info", timeout: 8000 });
          return;
        }
      }
      HOF.toast("Bağlama 10 dakika içinde tamamlanmadı; WhatsApp'ı Bağla'yı yeniden açın.", { type: "info", timeout: 8000 });
    } finally {
      secret = "";
      if (onMessage) window.removeEventListener("message", onMessage);
      embeddedBusy = false;
      button?.classList.remove("is-busy");
    }
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

  // 2.5.0 W-2: Meta'daki abonelik de silinir; yerel kaldırma her durumda yapılır. Meta tarafı düşerse uyarı + veri silme sayfası (bağlantı düğmesi).
  let removeBusy = false;
  async function removeConnection(button) {
    if (removeBusy) return;
    const sure = await HOF.confirm({ title: "Bağlantı kaldırılsın mı?", message: "Kayıtlı belirteç ve kimlikler bu şirketten silinir, DestekOfis'in Meta'daki bildirim aboneliği de kaldırılır; bekleyen otomatik gönderimler durdurulur ve WhatsApp ile otomatik gönderim yapılamaz. Meta'daki numaranız ve WhatsApp hesabınız değişmez.", confirmLabel: "Bağlantıyı Kaldır", danger: true });
    if (!sure) return;
    removeBusy = true;
    if (button) {
      button.disabled = true;
      button.classList.add("is-busy");
    }
    try {
      view = await HOF.api(API, { method: "DELETE" });
      const removal = view?.removal || null;
      const stopped = removal?.stopped ? ` ${removal.stopped} bekleyen gönderim durduruldu.` : "";
      if (removal?.meta?.state === "failed") {
        const link = removal.meta.link;
        HOF.toast(`${removal.meta.message}${stopped}`, { type: "warn", timeout: 20000, ...(link ? { action: { label: "Veri Silme Adımları", onClick: () => window.open(link, "_blank", "noopener") } } : {}) });
      } else if (removal?.meta?.state === "skipped" && removal.meta.message) HOF.toast(`${removal.meta.message}${stopped}`, { type: "info", timeout: 12000 });
      else HOF.toast(`${removal?.meta?.message || "WhatsApp bağlantısı kaldırıldı."}${stopped}`, { type: "success" });
    } catch (error) {
      HOF.toastError(error);
    } finally {
      removeBusy = false;
    }
    await load();
  }

  document.addEventListener("click", event => {
    const button = event.target.closest("[data-wa-action]");
    if (!button || button.disabled) return;
    const action = button.dataset.waAction;
    if (action === "connect") connectForm();
    else if (action === "embedded") embeddedConnect(button);
    // 2.5.0 W-1(a): Yeniden Bağla — bağlantının yoluna göre (WhatsApp'ı Bağla ya da yeni belirteçle Elle Bağla).
    else if (action === "reconnect") {
      if (view?.mode === "embedded") embeddedConnect(button);
      else connectForm({ renew: true });
    } else if (action === "test") {
      button.disabled = true;
      button.classList.add("is-busy");
      testNow();
    } else if (action === "self-test") selfTestForm();
    else if (action === "remove") removeConnection(button);
  });

  HOF.whatsappSettings = { load };
})();
