/* DestekOfis — açılış yükleyicisi.
 * 1) Oturumu doğrular (yoksa giriş ekranı, zorunluysa parola değişimi),
 * 2) ofis geneli ayarları ve merkezi notları sunucudan alır,
 * 3) tarayıcı deposunu sunucuyla eşleyen köprüyü kurar,
 * 4) ancak bundan sonra arayüz paketini yükler. */
(() => {
  "use strict";
  const HOF = window.HOF;
  const html = document.documentElement;
  const storage = window.localStorage;
  const proto = Storage.prototype;
  const rawGet = proto.getItem;
  const rawSet = proto.setItem;
  const rawRemove = proto.removeItem;
  const localGet = key => rawGet.call(storage, key);
  const localSet = (key, value) => rawSet.call(storage, key, value);
  const localRemove = key => rawRemove.call(storage, key);

  const SETTING_KEYS = {
    "hukuk-ofisi-sheet-url": "sheetUrl",
    "hukuk-ofisi-sync-minutes": "syncMinutes",
    "hukuk-ofisi-ai-mapping": "aiMapping",
    "hukuk-ofisi-active-source-label": "activeSourceLabel",
  };
  const NOTES_KEY = "hukuk-ofisi-notlar";
  let clientVersion = 0;
  let notesCursor = "";
  let appLoaded = false;

  const splash = () => document.getElementById("hof-splash");
  const hideSplash = () => {
    const node = splash();
    if (!node) return;
    node.classList.add("is-hidden");
    setTimeout(() => node.remove(), 300);
  };
  const setSplashText = text => {
    const target = splash()?.querySelector("p");
    if (target) target.textContent = text;
  };

  // ---------- Sunucu ⇄ tarayıcı deposu köprüsü ----------
  const applySettings = settings => {
    HOF.settings = { ...HOF.settings, ...settings };
    localSet("hukuk-ofisi-sheet-url", settings.sheetUrl || "");
    localSet("hukuk-ofisi-sync-minutes", String(settings.syncMinutes || "5"));
    localSet("hukuk-ofisi-active-source-label", settings.activeSourceLabel || (settings.sheetUrl ? "Google Sheets" : "Çalışma Tablosu"));
    if (settings.aiMapping) localSet("hukuk-ofisi-ai-mapping", settings.aiMapping);
    else localRemove("hukuk-ofisi-ai-mapping");
  };
  HOF.applyClientState = state => {
    clientVersion = state.version;
    // Seçili veri oturumu (v2.0.1; hof-live.js başka oturumun olaylarını süzer, hof-sessions.js seçiciyi çizer).
    if (state.datasetKey) HOF.datasetKey = state.datasetKey;
    if (state.sessionCount) HOF.sessionCount = state.sessionCount;
    applySettings(state.settings);
    HOF.emit("settings", HOF.settings);
  };

  const parseNotes = value => {
    try {
      const parsed = JSON.parse(value || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  };

  async function loadClientState() {
    let state = await HOF.api("/api/workspace/client-state");
    const legacySheet = localGet("hukuk-ofisi-sheet-url");
    // v1.0.0'dan geçiş: kaynak henüz sunucuda yoksa, bu tarayıcıdaki kaynak yetkili kullanıcı tarafından ofise taşınır.
    // v2.0.17: yalnız gerçek bir Google Sheets bağlantısı taşınır. Programın kendi iç anahtarı ("dataset://…") şirket
    // değişince tarayıcıda kalır; boş şirkete taşınsaydı şirket "Google Sheets'e bağlı" görünürdü (sahte kaynak).
    if (!state.sheetUrlSet && legacySheet && /^https?:\/\//i.test(legacySheet) && HOF.can("sources.manage")) {
      try {
        state = await HOF.api("/api/workspace/client-state", { method: "PUT", body: { key: "sheetUrl", value: legacySheet } });
        HOF.toast("Bu bilgisayardaki veri kaynağı ofisin ortak kaynağı yapıldı.", { type: "success" });
      } catch (error) {
        console.warn("[DestekOfis] Kaynak aktarılamadı", error);
      }
    }
    if (!state.sheetUrlSet && legacySheet && /^https?:\/\//i.test(legacySheet)) {
      state = { ...state, settings: { ...state.settings, sheetUrl: legacySheet } };
    }
    HOF.applyClientState(state);

    const importFlag = `hof-notes-imported:${state.instanceId}`;
    if (!localGet(importFlag)) {
      const legacyNotes = parseNotes(localGet(NOTES_KEY));
      if (Object.keys(legacyNotes).length && HOF.can("notes.write")) {
        try {
          const result = await HOF.api("/api/workspace/case-notes/import", { method: "POST", body: { notes: legacyNotes } });
          if (result.imported) HOF.toast(`${result.imported} yerel not merkezi sunucuya aktarıldı.`, { type: "success" });
        } catch (error) {
          console.warn("[DestekOfis] Notlar aktarılamadı", error);
        }
      }
      localSet(importFlag, "1");
    }
    const notes = await HOF.api("/api/workspace/case-notes");
    const map = {};
    for (const item of notes.notes) map[item.caseKey] = item.note;
    localSet(NOTES_KEY, JSON.stringify(map));
    notesCursor = notes.serverTime;
  }

  const MANAGED = new Set(["sheetUrl", "syncMinutes", "aiMapping"]);
  async function pushSetting(key, value, previous) {
    if (MANAGED.has(key) && !HOF.can("sources.manage")) {
      if (previous == null) localRemove(Object.keys(SETTING_KEYS).find(name => SETTING_KEYS[name] === key));
      else localSet(Object.keys(SETTING_KEYS).find(name => SETTING_KEYS[name] === key), previous);
      HOF.toast("Veri kaynağı ayarlarını yalnızca yönetici değiştirebilir.", { type: "error" });
      return;
    }
    if (!MANAGED.has(key)) return;
    try {
      const state = await HOF.api("/api/workspace/client-state", { method: "PUT", body: { key, value } });
      HOF.applyClientState(state);
    } catch (error) {
      // Sunucu kabul etmediyse (ör. veri kaynağı artık Ayarlar → Veri'den yönetilir) tarayıcıdaki değer eski hâline döner.
      const storageKey = Object.keys(SETTING_KEYS).find(name => SETTING_KEYS[name] === key);
      if (previous == null) localRemove(storageKey);
      else localSet(storageKey, previous);
      HOF.toastError(error);
    }
  }

  async function pushNotes(previousJson, nextJson) {
    const before = parseNotes(previousJson);
    const after = parseNotes(nextJson);
    const changed = Object.keys(after).filter(key => after[key] !== before[key]);
    for (const key of changed) {
      try {
        await HOF.api(`/api/workspace/case-notes/${encodeURIComponent(key)}`, { method: "PUT", body: { note: String(after[key] ?? "") } });
      } catch (error) {
        HOF.toast(`Not merkezi sunucuya kaydedilemedi: ${error.message}`, { type: "error", timeout: 6000 });
      }
    }
  }

  function installStorageBridge() {
    proto.setItem = function setItem(key, value) {
      if (this !== storage) return rawSet.call(this, key, value);
      const previous = rawGet.call(this, key);
      rawSet.call(this, key, value);
      if (key in SETTING_KEYS && String(value) !== previous) pushSetting(SETTING_KEYS[key], String(value), previous);
      else if (key === NOTES_KEY && String(value) !== previous) pushNotes(previous, String(value));
    };
    proto.removeItem = function removeItem(key) {
      if (this !== storage) return rawRemove.call(this, key);
      const previous = rawGet.call(this, key);
      rawRemove.call(this, key);
      if (key in SETTING_KEYS && previous) pushSetting(SETTING_KEYS[key], "", previous);
    };
  }

  // Diğer bilgisayarlardaki değişiklikleri düzenli aralıkla alır.
  async function poll() {
    if (document.hidden) return;
    try {
      const state = await HOF.api("/api/workspace/client-state");
      // Sunucu arada güncellendiyse (bakım ekranı görülmeden bile) eski arayüzle çalışmamak için yenileme öner.
      const bootVersion = HOF.user?.product?.version;
      if (state.appVersion && bootVersion && state.appVersion !== bootVersion) {
        showReloadBanner(`DestekOfis ${state.appVersion} sürümüne güncellendi. Yenilikleri görmek için sayfayı yenileyin.`);
      }
      if (state.version !== clientVersion) {
        const wasEmpty = !HOF.settings.sheetUrl;
        const sourceChanged = (state.settings.sheetUrl || "") !== (HOF.settings.sheetUrl || "");
        HOF.applyClientState(state);
        // Boş ekrandayken yönetici veri yüklediyse kaybedilecek bir şey yok: sayfa kendiliğinden açılır.
        if (sourceChanged && appLoaded && wasEmpty && !HOF.hasOpenModal()) location.reload();
        else if (sourceChanged && appLoaded) showReloadBanner("Veri kaynağı değiştirildi. Güncel tabloyu görmek için yenileyin.");
      }
      const notes = await HOF.api(`/api/workspace/case-notes?since=${encodeURIComponent(notesCursor)}`);
      if (notes.notes.length) {
        const map = parseNotes(localGet(NOTES_KEY));
        for (const item of notes.notes) map[item.caseKey] = item.note;
        localSet(NOTES_KEY, JSON.stringify(map));
      }
      notesCursor = notes.serverTime;
    } catch (error) {
      if (error.status !== 401) console.warn("[DestekOfis] Eşitleme", error.message);
    }
  }

  // Canlı kanal (hof-live.js): sürüm değişikliği, başka bilgisayarlardaki değişiklikler ve yeniden bağlanma.
  let syncTimer = 0;
  let refreshTimer = 0;
  HOF.syncNow = () => {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(poll, 400);
  };
  const refreshTableSoon = () => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => HOF.refreshData(), 800);
  };
  HOF.on("live:hello", data => {
    const bootVersion = HOF.user?.product?.version;
    if (data?.version && bootVersion && data.version !== bootVersion) showReloadBanner(`DestekOfis ${data.version} sürümüne güncellendi. Yenilikleri görmek için sayfayı yenileyin.`);
  });
  HOF.on("live:workspace.changed", change => {
    if (!change) return;
    if (change.kind === "records") refreshTableSoon();
    // Çalışma verisi içeri alındı/kaldırıldı/eşitlendi: veri adı, bağlantı ve boş/dolu durumu da değişmiş olabilir.
    if (change.kind === "note" || change.kind === "source" || change.dataset) HOF.syncNow();
  });
  HOF.on("live:resync", () => {
    HOF.syncNow();
    refreshTableSoon();
  });

  function showReloadBanner(message) {
    if (document.getElementById("hof-reload-banner")) return;
    const node = HOF.el("div", { id: "hof-reload-banner", class: "hof-banner", role: "status" }, `<span>${HOF.esc(message)}</span><button type="button" class="hof-button hof-button-small">Yenile</button>`);
    node.querySelector("button").onclick = () => location.reload();
    document.body.appendChild(node);
  }
  HOF.showReloadBanner = showReloadBanner;

  // ---------- Açılış ----------
  // Yetki sınıfları (hof-can-*): [data-requires] öğeleri CSS ile gizlenir. v2.0.10: yetki değişince (yönetici rolü ya da
  // kişiye özel yetkiyi değiştirdi) eski sınıflar silinip yenileri yazılır; ekran yeniden açılmaz.
  const applyRoleClasses = user => {
    html.dataset.hofRole = user.role;
    for (const name of [...html.classList]) if (name.startsWith("hof-can-")) html.classList.remove(name);
    for (const permission of user.permissions) html.classList.add(`hof-can-${permission.replace(/\./g, "-")}`);
  };
  HOF.applyPermissions = applyRoleClasses;

  const wrapFetch = () => {
    let notified = false;
    window.fetch = async (...args) => {
      if (typeof args[0] === "string") args[0] = HOF.apiUrl(args[0]);
      const target = String(args[0] && args[0].url ? args[0].url : args[0]);
      const pending = HOF.nativeFetch(...args);
      if (target.includes("/api/trpc/sheets.getRows")) HOF.trackRowsRequest(pending);
      const response = await pending;
      if (response.status === 401 && target.includes("/api/") && !notified) {
        notified = true;
        HOF.emit("unauthorized");
      } else if (response.status === 503 && target.includes("/api/")) {
        response.clone().json().then(payload => payload.code === "MAINTENANCE" && HOF.emit("maintenance", payload), () => {});
      } else if (response.status === 403 && target.includes("/api/")) {
        // Lisans salt okunurken arayüz paketinin kendi yazma istekleri de açıklanır (hof-license.js).
        response.clone().json().then(payload => payload.code === "LICENSE_READ_ONLY" && HOF.emit("license-read-only", payload), () => {});
      }
      return response;
    };
  };


  // İndirme bağlantıları (PDF/Excel) ve yeni pencerede açılan belgeler de sayfanın şirketinden gelir (v2.0.21).
  // Orta tık, sağ tık ("yeni sekmede aç", "bağlantıyı kaydet") ve sürükleme de yakalanır; Yönetim sayfasına giden
  // bağlantı bu pencerenin şirketini taşır (?sirket=).
  const withCompany = href => {
    const next = HOF.apiUrl(href);
    if (next !== href || !HOF.companyId) return next;
    try {
      const url = new URL(href, location.href);
      if (url.origin !== location.origin || url.pathname !== "/admin.html" || url.searchParams.has("sirket")) return href;
      url.searchParams.set("sirket", HOF.companyId);
      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return href;
    }
  };
  const bindCompanyLinks = () => {
    const rewrite = event => {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!link) return;
      const next = withCompany(link.getAttribute("href"));
      if (next !== link.getAttribute("href")) link.setAttribute("href", next);
    };
    for (const type of ["click", "auxclick", "contextmenu", "dragstart"]) document.addEventListener(type, rewrite, true);
    const open = window.open.bind(window);
    window.open = (url, ...rest) => open(typeof url === "string" ? withCompany(url) : url, ...rest);
  };

  HOF.on("unauthorized", () => {
    if (appLoaded) HOF.showLogin("Oturumunuz sona erdi. Lütfen tekrar giriş yapın.");
  });
  HOF.on("password-required", () => HOF.changePassword({ forced: true }).then(done => done && location.reload()));

  async function loadApp() {
    const bundle = document.querySelector('meta[name="hof-app-bundle"]')?.content;
    if (!bundle) throw new Error("Arayüz paketi bulunamadı.");
    await import(bundle);
    appLoaded = true;
    const root = document.getElementById("root");
    const reveal = () => {
      if (root.childElementCount) {
        hideSplash();
        return true;
      }
      return false;
    };
    if (!reveal()) {
      const watcher = new MutationObserver(() => reveal() && watcher.disconnect());
      watcher.observe(root, { childList: true });
      setTimeout(hideSplash, 4000);
    }
  }

  function showFatal(message) {
    hideSplash();
    const node = HOF.el("div", { class: "hof-auth" }, `<section class="hof-auth-card">${HOF.brandHtml}<h1>Sunucuya bağlanılamadı</h1><p class="hof-auth-help">${HOF.esc(message)}</p><button type="button" class="hof-button hof-button-wide">Tekrar Dene</button></section>`);
    node.querySelector("button").onclick = () => location.reload();
    document.body.appendChild(node);
  }

  async function boot() {
    html.classList.add("hof-booting");
    let me;
    try {
      me = await HOF.api("/api/auth/me");
    } catch (error) {
      if (error.status === 401) return HOF.showLogin();
      if (error.status === 503 && error.data.code === "MAINTENANCE") {
        hideSplash();
        return HOF.showMaintenance(error.data);
      }
      return showFatal(error.status ? error.message : "Merkezi sunucuya ulaşılamadı. Sunucu bilgisayarın açık olduğundan emin olun.");
    }
    HOF.user = me;
    HOF.companyId = me.company?.id || "";
    applyRoleClasses(me);
    if (me.mustChangePassword) {
      hideSplash();
      const changed = await HOF.changePassword({ forced: true });
      if (changed) location.reload();
      return;
    }
    try {
      setSplashText("Çalışma alanı hazırlanıyor…");
      await loadClientState();
      installStorageBridge();
      wrapFetch();
      bindCompanyLinks();
      HOF.isReady = true;
      HOF.emit("ready", me);
      await loadApp();
      const pending = sessionStorage.getItem("hof-flash");
      if (pending) {
        sessionStorage.removeItem("hof-flash");
        HOF.toast(pending, { type: "success", timeout: 6000 });
      }
      setInterval(poll, 60_000);
      document.addEventListener("visibilitychange", () => !document.hidden && poll());
    } catch (error) {
      console.error(error);
      showFatal(error.message || "Uygulama başlatılamadı.");
    } finally {
      html.classList.remove("hof-booting");
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
