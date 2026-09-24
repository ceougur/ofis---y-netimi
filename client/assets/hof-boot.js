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
    localSet("hukuk-ofisi-active-source-label", settings.activeSourceLabel || (settings.sheetUrl ? "Google Sheets" : "Çalışma tablosu"));
    if (settings.aiMapping) localSet("hukuk-ofisi-ai-mapping", settings.aiMapping);
    else localRemove("hukuk-ofisi-ai-mapping");
  };
  HOF.applyClientState = state => {
    clientVersion = state.version;
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
    if (!state.sheetUrlSet && legacySheet && HOF.can("sources.manage")) {
      try {
        state = await HOF.api("/api/workspace/client-state", { method: "PUT", body: { key: "sheetUrl", value: legacySheet } });
        HOF.toast("Bu bilgisayardaki veri kaynağı ofisin ortak kaynağı yapıldı.", { type: "success" });
      } catch (error) {
        console.warn("[DestekOfis] Kaynak aktarılamadı", error);
      }
    }
    if (!state.sheetUrlSet && legacySheet) {
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
      HOF.toast("Veri kaynağı ayarlarını yalnızca yönetici veya avukat değiştirebilir.", { type: "error" });
      return;
    }
    if (!MANAGED.has(key)) return;
    try {
      const state = await HOF.api("/api/workspace/client-state", { method: "PUT", body: { key, value } });
      HOF.applyClientState(state);
    } catch (error) {
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
      if (state.version !== clientVersion) {
        const sourceChanged = (state.settings.sheetUrl || "") !== (HOF.settings.sheetUrl || "");
        HOF.applyClientState(state);
        if (sourceChanged && appLoaded) showReloadBanner("Veri kaynağı değiştirildi. Güncel tabloyu görmek için yenileyin.");
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

  function showReloadBanner(message) {
    if (document.getElementById("hof-reload-banner")) return;
    const node = HOF.el("div", { id: "hof-reload-banner", class: "hof-banner", role: "status" }, `<span>${HOF.esc(message)}</span><button type="button" class="hof-button hof-button-small">Yenile</button>`);
    node.querySelector("button").onclick = () => location.reload();
    document.body.appendChild(node);
  }

  // ---------- Açılış ----------
  const applyRoleClasses = user => {
    html.dataset.hofRole = user.role;
    for (const permission of user.permissions) html.classList.add(`hof-can-${permission.replace(/\./g, "-")}`);
  };

  const wrapFetch = () => {
    let notified = false;
    window.fetch = async (...args) => {
      const target = String(args[0] && args[0].url ? args[0].url : args[0]);
      const pending = HOF.nativeFetch(...args);
      if (target.includes("/api/trpc/sheets.getRows")) HOF.trackRowsRequest(pending);
      const response = await pending;
      if (response.status === 401 && target.includes("/api/") && !notified) {
        notified = true;
        HOF.emit("unauthorized");
      } else if (response.status === 503 && target.includes("/api/")) {
        response.clone().json().then(payload => payload.code === "MAINTENANCE" && HOF.emit("maintenance", payload), () => {});
      }
      return response;
    };
  };

  // Sunucu güncellenirken/yeniden başlarken: bakım katmanı gösterilir, sunucu dönünce sayfa yenilenir.
  let maintenanceShown = false;
  function showMaintenance(payload = {}) {
    if (maintenanceShown) return;
    maintenanceShown = true;
    const updating = payload.phase === "updating";
    const node = HOF.el("div", { class: "hof-auth hof-maintenance", role: "status", "aria-live": "polite" }, `<section class="hof-auth-card">${HOF.brandHtml}<h1>${updating ? "Sistem güncelleniyor" : "Sunucu yeniden başlatılıyor"}</h1><p class="hof-auth-help">${updating ? "Sistem güncelleniyor, lütfen 1 dakika sonra tekrar deneyin." : "Sunucu kısa bir süre için yeniden başlatılıyor."} Hazır olunca sayfa kendiliğinden yenilenecek; yaptığınız kayıtlar sunucuda güvende.</p><div class="hof-progress"><span></span></div></section>`);
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
  }
  HOF.on("maintenance", showMaintenance);

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
    const node = HOF.el("div", { class: "hof-auth" }, `<section class="hof-auth-card">${HOF.brandHtml}<h1>Sunucuya bağlanılamadı</h1><p class="hof-auth-help">${HOF.esc(message)}</p><button type="button" class="hof-button hof-button-wide">Tekrar dene</button></section>`);
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
        return showMaintenance(error.data);
      }
      return showFatal(error.status ? error.message : "Merkezi sunucuya ulaşılamadı. Sunucu bilgisayarın açık olduğundan emin olun.");
    }
    HOF.user = me;
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
