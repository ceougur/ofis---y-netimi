/* DestekOfis — kalıcı çalışma verisi arayüzü (v1.5.0).
 * - Veri yoksa panelin ortasında "başlayalım" kartı: Excel sürükle-bırak / seç ya da Google Sheets bağlantısı yapıştır.
 * - Ayarlar → Veri: özet, Excel yükleme, Sheet bağlama, eşitleme sıklığı, şimdi eşitle, geçmiş, Sheet'te olmayanlar,
 *   bağlantıyı/veriyi kaldırma. Yalnızca yönetici (sources.manage).
 * - Mevcut veri varken yeni dosya/bağlantı gelince önizleme sayılarıyla "devamı olarak ekle" / "yerine koy" sorulur.
 * - Arayüz paketinin kendi yükleme düğmeleri ("Yeni tablo yükle", "Tabloyu değiştir", "Kaynağı değiştir") gizlenir. */
(() => {
  "use strict";
  const HOF = window.HOF;
  const { esc } = HOF;
  const MAX_BYTES = 60 * 1024 * 1024;
  const SHEET_PATTERN = /^https:\/\/docs\.google\.com\/spreadsheets\//i;
  const number = value => new Intl.NumberFormat("tr-TR").format(Number(value) || 0);
  let summary = null; // sunucudaki çalışma verisi özeti
  let missingKeys = new Set();

  const canManage = () => HOF.can("sources.manage");
  const hasData = () => Boolean(HOF.settings && HOF.settings.sheetUrl);

  async function loadSummary() {
    try {
      summary = await HOF.api("/api/workspace/dataset");
      missingKeys = new Set(summary.missingKeys || []);
    } catch {
      // Özet alınamazsa arayüz yine çalışır; bir sonraki değişiklikte yeniden denenir.
    }
    return summary;
  }

  // ---------- Excel okuma (tarayıcıda, arka plan işçisiyle) ----------
  const parseInWorker = file =>
    new Promise((resolve, reject) => {
      let worker;
      try {
        worker = new Worker("/assets/hof-excel-worker.js", { type: "module" });
      } catch {
        reject(new Error("Tarayıcınız Excel okuma işlemini desteklemiyor. Chrome veya Edge'in güncel sürümünü kullanın."));
        return;
      }
      const timer = setTimeout(() => {
        worker.terminate();
        reject(new Error("Excel dosyası 90 saniyede okunamadı. Dosyayı sadeleştirip tekrar deneyin."));
      }, 90_000);
      worker.onmessage = event => {
        clearTimeout(timer);
        worker.terminate();
        if (event.data.ok) resolve(event.data);
        else reject(new Error(`Excel dosyası okunamadı: ${event.data.error}`));
      };
      worker.onerror = event => {
        clearTimeout(timer);
        worker.terminate();
        reject(new Error(event.message || "Excel dosyası okunamadı. XLSX, XLS veya CSV dosyası seçin."));
      };
      file.arrayBuffer().then(buffer => worker.postMessage({ buffer, name: file.name }, [buffer]), reject);
    });

  // ---------- İçeri alma akışı ----------
  function progress(title, text) {
    const modal = HOF.modal({ title, eyebrow: "VERİ", size: "small", dismissible: false, body: `<p class="hof-modal-text" data-status>${esc(text)}</p><div class="hof-progress"><span></span></div>` });
    return {
      set(next) {
        const node = modal.dialog.querySelector("[data-status]");
        if (node) node.textContent = next;
      },
      close: () => modal.close(),
    };
  }

  function finish(result) {
    const counts = result.counts || {};
    const name = `"${result.sourceLabel || result.label}"`;
    const parts = [];
    if (counts.added) parts.push(`${number(counts.added)} yeni`);
    if (counts.updated) parts.push(`${number(counts.updated)} güncellendi`);
    if (counts.removed) parts.push(`${number(counts.removed)} kaldırıldı`);
    const detail = parts.length ? parts.join(", ") : "değişiklik yok";
    const head =
      result.mode === "initial" ? `${name} yüklendi: ${number(result.rowCount)} kayıt.`
      : result.mode === "merge" ? `${name} devamı olarak eklendi: ${detail}.`
      : `${name} mevcut verinin yerine kondu: ${detail}.`;
    HOF.applyClientState(result.state);
    sessionStorage.setItem("hof-flash", `${head} Tüm bilgisayarlar aynı veriyi görür.${result.linked ? " Google Sheets bağlı; değişiklikler kendiliğinden eklenir." : ""}`);
    location.reload();
  }

  async function runImport(body, sourceLabel) {
    if (!canManage()) {
      HOF.toast("Veri yükleme ve kaldırma yalnızca yöneticidedir.", { type: "error" });
      return;
    }
    const busy = progress("Veri okunuyor", body.kind === "sheets" ? "Google Sheets okunuyor…" : `"${sourceLabel}" okunuyor…`);
    let staged;
    try {
      if (body.kind === "excel" && body.file) {
        const parsed = await parseInWorker(body.file);
        if (!parsed.rowCount) throw new Error("Dosyada okunabilir kayıt bulunamadı. Tablonun kolon başlıklarıyla başladığından emin olun.");
        busy.set(`Yaklaşık ${number(parsed.rowCount)} satır mevcut veriyle karşılaştırılıyor…`);
        staged = await HOF.api("/api/workspace/dataset/stage", { method: "POST", body: { kind: "excel", fileName: body.file.name, sheets: parsed.sheets }, timeoutMs: 180_000 });
      } else {
        staged = await HOF.api("/api/workspace/dataset/stage", { method: "POST", body: { kind: "sheets", url: body.url }, timeoutMs: 120_000 });
      }
    } catch (error) {
      busy.close();
      HOF.toastError(error);
      return;
    }
    if (!staged.hasData) {
      busy.set(`${number(staged.rowCount)} kayıt kaydediliyor…`);
      try {
        finish(await HOF.api("/api/workspace/dataset/commit", { method: "POST", body: { stageId: staged.stageId, mode: "replace", link: true }, timeoutMs: 180_000 }));
      } catch (error) {
        busy.close();
        HOF.toastError(error);
      }
      return;
    }
    busy.close();
    decide(staged);
  }

  // "Devamı olarak ekle" / "Yerine koy" kararı; sayılar sunucunun gerçek karşılaştırmasından gelir.
  function decide(staged) {
    const { merge, replace, samples } = staged.preview;
    const sample = (label, list) => (list.length ? `<span><b>${esc(label)}:</b> ${list.map(esc).join(", ")}${list.length === 5 ? "…" : ""}</span>` : "");
    const samplesHtml = [sample("yeni", samples.added), sample("güncellenecek", samples.updated), sample("yeni dosyada olmayan", samples.removed)].filter(Boolean).join("");
    const minutes = Number(summary?.syncMinutes || HOF.settings.syncMinutes || 5);
    const modal = HOF.modal({
      title: `Yeni veri: ${staged.label}`,
      eyebrow: "VERİ",
      size: "wide",
      body: `<p class="hof-modal-text">${number(staged.rowCount)} kayıt okundu${staged.tabs.length ? ` (${number(staged.tabs.length)} sekme)` : ""}. Mevcut veri: <b>${esc(staged.current.label || "Çalışma verisi")}</b>, ${number(staged.current.rowCount)} kayıt. Nasıl eklensin?</p>
        <div class="hof-choice-grid">
          <article class="hof-choice is-recommended">
            <header><b>Mevcut verinin devamı olarak ekle</b><span class="hof-chip">Önerilen</span></header>
            <ul>
              <li><b>${number(merge.added)}</b> yeni kayıt eklenir</li>
              <li><b>${number(merge.updated)}</b> kayıt yeni bilgilerle güncellenir</li>
              <li><b>${number(merge.unchanged)}</b> kayıt aynı kalır</li>
              <li>Yeni dosyada olmayan <b>${number(merge.kept)}</b> kayıt silinmez</li>
            </ul>
            <p>Ofiste yapılan düzeltmeler, notlar ve görevler korunur.</p>
            <button type="button" class="hof-button" data-mode="merge">Devamı olarak ekle</button>
          </article>
          <article class="hof-choice">
            <header><b>Mevcut verinin yerine koy</b></header>
            <ul>
              <li><b>${number(replace.added)}</b> yeni, <b>${number(replace.updated)}</b> güncellenen, <b>${number(replace.unchanged)}</b> aynı kayıt</li>
              <li>Yeni dosyada olmayan <b>${number(replace.removed)}</b> kayıt tablodan kalkar</li>
            </ul>
            <p>Notlar, görevler ve işlem geçmişi silinmez; aynı dosya numarası tekrar gelirse yeniden bağlanır.</p>
            <button type="button" class="hof-button hof-button-ghost" data-mode="replace">Yerine koy</button>
          </article>
        </div>
        ${samplesHtml ? `<p class="hof-choice-samples">Örnek: ${samplesHtml}</p>` : ""}
        ${staged.kind === "sheets" ? `<label class="hof-check"><input type="checkbox" data-link checked><span>Bu Sheet'i bağlı tut; Sheet'teki değişiklikler her ${minutes} dakikada kendiliğinden eklensin</span></label>` : ""}
        <p class="hof-inline-note">Uygulamadan önce veritabanının tam yedeği alınır.</p>
        <div class="hof-actions"><button type="button" class="hof-button hof-button-ghost" data-cancel>Vazgeç</button></div>`,
    });
    modal.dialog.querySelector("[data-cancel]").onclick = () => modal.close();
    modal.dialog.addEventListener("click", async event => {
      const button = event.target.closest("[data-mode]");
      if (!button) return;
      const mode = button.dataset.mode;
      if (mode === "replace" && replace.removed > 0) {
        const ok = await HOF.confirm({ title: "Yerine koy", message: `Yeni dosyada olmayan ${number(replace.removed)} kayıt tablodan kalkacak. Notları ve geçmişi silinmez; işlemden önce yedek alınır. Devam edilsin mi?`, confirmLabel: "Yerine koy", danger: true });
        if (!ok) return;
      }
      const link = staged.kind === "sheets" ? Boolean(modal.dialog.querySelector("[data-link]")?.checked) : true;
      modal.dialog.querySelectorAll("button").forEach(item => (item.disabled = true));
      button.classList.add("is-busy");
      button.textContent = "Uygulanıyor…";
      try {
        finish(await HOF.api("/api/workspace/dataset/commit", { method: "POST", body: { stageId: staged.stageId, mode, link }, timeoutMs: 180_000 }));
      } catch (error) {
        modal.close();
        HOF.toastError(error);
      }
    });
  }

  function importExcel(file) {
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      HOF.toast("Yalnızca .xlsx, .xls ve .csv dosyaları yüklenebilir.", { type: "error" });
      return;
    }
    if (file.size > MAX_BYTES) {
      HOF.toast("Dosya çok büyük (en fazla 60 MB).", { type: "error" });
      return;
    }
    runImport({ kind: "excel", file }, file.name);
  }

  function importSheet(url) {
    const value = String(url || "").trim();
    if (!SHEET_PATTERN.test(value)) {
      HOF.toast("Google Sheets bağlantısını yapıştırın (https://docs.google.com/spreadsheets/… ile başlar).", { type: "error" });
      return;
    }
    runImport({ kind: "sheets", url: value }, "Google Sheets");
  }

  // Sürükle-bırak ve dosya seçimi olan bir alanı bağlar.
  function wireDrop(zone) {
    const input = zone.querySelector("input[type=file]");
    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      input.value = "";
      if (file) importExcel(file);
    });
    zone.addEventListener("dragover", event => {
      event.preventDefault();
      zone.classList.add("is-over");
    });
    zone.addEventListener("dragleave", () => zone.classList.remove("is-over"));
    zone.addEventListener("drop", event => {
      event.preventDefault();
      zone.classList.remove("is-over");
      const file = event.dataTransfer?.files?.[0];
      if (file) importExcel(file);
    });
  }

  const dropHtml = compact => `<label class="hof-drop${compact ? " is-compact" : ""}">
      <span class="hof-drop-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M12 12v6"/><path d="m9.5 14.5 2.5-2.5 2.5 2.5"/></svg></span>
      <span><b>Excel dosyası seçin</b><small>veya buraya sürükleyip bırakın · .xlsx, .xls, .csv</small></span>
      <input type="file" accept=".xlsx,.xls,.csv" hidden>
    </label>`;
  const linkHtml = `<form class="hof-link-form" novalidate>
      <input type="url" name="url" inputmode="url" autocomplete="off" placeholder="Google Sheets bağlantısını yapıştırın" aria-label="Google Sheets bağlantısı">
      <button type="submit" class="hof-button">Bağla</button>
    </form>`;
  const wireLink = form =>
    form.addEventListener("submit", event => {
      event.preventDefault();
      importSheet(form.elements.url.value);
    });

  // ---------- Başlangıç kartı (veri yokken) ----------
  function renderStart() {
    const wrap = document.querySelector(".main-shell .content-wrap");
    let card = document.getElementById("hof-start");
    const empty = Boolean(wrap) && HOF.isReady && !hasData();
    document.documentElement.classList.toggle("hof-no-data", empty);
    if (!empty) {
      card?.remove();
      return;
    }
    if (!card) {
      card = HOF.el("section", { id: "hof-start", class: "hof-start", "aria-labelledby": "hof-start-title" });
      card.innerHTML = `<div class="hof-start-card">
          <span class="hof-start-mark" aria-hidden="true"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M9 9.5V20"/></svg></span>
          <h2 id="hof-start-title">Excelini yükle ya da Google Sheets linkini yapıştır, başlayalım</h2>
          <p>Veriler bu sunucuda saklanır ve ofisteki tüm bilgisayarlarda aynı görünür. Siz silmedikçe korunur; sonradan yapılan işlemlerle birlikte devam eder.</p>
          ${canManage()
            ? `<div class="hof-start-actions">${dropHtml(false)}<div class="hof-start-or"><span>veya</span></div>${linkHtml}<small class="hof-start-hint">Sheet paylaşımı "Bağlantıya sahip olan herkes görüntüleyebilir" olmalıdır.</small></div>`
            : '<p class="hof-start-wait">Yöneticiniz veri yüklediğinde tablo burada görünecek.</p>'}
        </div>`;
      const zone = card.querySelector(".hof-drop");
      if (zone) wireDrop(zone);
      const form = card.querySelector(".hof-link-form");
      if (form) wireLink(form);
    }
    const anchor = wrap.querySelector(":scope > .welcome-row");
    if (card.parentNode !== wrap) (anchor ? anchor.after(card) : wrap.prepend(card));
  }

  // ---------- Ayarlar → Veri ----------
  function sourceLine(data) {
    if (!data.rowCount && !data.linked) return "Henüz veri yok.";
    if (data.linked) {
      const last = data.lastSyncOkAt ? HOF.formatDateTime(data.lastSyncOkAt) : "henüz eşitlenmedi";
      return `Google Sheets'e bağlı · son eşitleme ${last} · her ${data.syncMinutes} dakikada`;
    }
    const lastImport = data.imports?.find(item => item.kind !== "remove");
    return `${lastImport?.kind === "sheets" ? "Google Sheets'ten alındı (bağlı değil)" : "Excel'den yüklendi"}${data.changedAt ? ` · ${HOF.formatDateTime(data.changedAt)}` : ""}`;
  }

  const MODE_LABELS = { initial: "ilk yükleme", merge: "devamı olarak eklendi", replace: "yerine konuldu", sync: "eşitlendi", migration: "1.5.0'a geçiş", remove: "veri kaldırıldı", keep: "Sheet'te olmayanlar tutuldu" };
  function historyHtml(imports) {
    if (!imports?.length) return '<p class="hof-empty">Henüz içeri alma yok.</p>';
    return imports
      .map(item => {
        const counts = [item.added ? `${number(item.added)} yeni` : "", item.updated ? `${number(item.updated)} güncellendi` : "", item.removed ? `${number(item.removed)} kaldırıldı` : "", item.missing ? `${number(item.missing)} Sheet'te yok` : ""].filter(Boolean).join(", ");
        const what = item.kind === "missing" ? (item.mode === "remove" ? "Sheet'te olmayanlar kaldırıldı" : MODE_LABELS.keep) : `${item.label ? `"${item.label}" · ` : ""}${MODE_LABELS[item.mode] || item.mode}`;
        return `<li><span>${esc(HOF.formatDateTime(item.createdAt))}</span><b>${esc(what)}</b>${counts ? `<small>${esc(counts)}</small>` : ""}<em>${esc(item.actorName || "")}</em></li>`;
      })
      .join("");
  }

  async function openDataSettings() {
    if (!canManage()) {
      HOF.toast("Veri ayarları yalnızca yöneticidedir.", { type: "error" });
      return;
    }
    const data = (await loadSummary()) || {};
    const minutes = Number(data.syncMinutes || 5);
    const modal = HOF.modal({
      title: "Veri ve eşitleme",
      eyebrow: "AYARLAR",
      size: "wide",
      body: `<section class="hof-data-summary">
          <div><b>${esc(data.label || (data.rowCount ? "Çalışma verisi" : "Veri yok"))}</b><span>${number(data.rowCount)} kayıt${data.tabs?.length ? ` · ${number(data.tabs.length)} sekme` : ""}${data.recordCount ? ` · uygulamada eklenen ${number(data.recordCount)} kayıt` : ""}</span><small>${esc(sourceLine(data))}</small></div>
          ${data.lastSyncError ? `<p class="hof-alert">Son eşitlemede Google Sheets'e ulaşılamadı: ${esc(data.lastSyncError)} Son eşitlenen veri kullanılmaya devam ediyor.</p>` : ""}
          ${data.syncHold ? `<p class="hof-alert">Sheet'in yapısı değişmiş görünüyor (${number(data.syncHold.added)} yeni, ${number(data.syncHold.missing)} kayıp satır). Yanlışlıkla veri çoğalmasın diye otomatik eşitleme durduruldu. <button type="button" class="hof-button hof-button-small" data-review>İncele ve karar ver</button></p>` : ""}
          ${data.missingCount ? `<p class="hof-alert hof-alert-soft">${number(data.missingCount)} kayıt bağlı Sheet'te artık yok; tabloda duruyor. <button type="button" class="hof-button hof-button-small hof-button-ghost" data-missing>Listeyi gör</button></p>` : ""}
        </section>
        <section class="hof-data-section">
          <h3>Veri ekle veya değiştir</h3>
          <div class="hof-data-import">${dropHtml(true)}${linkHtml}</div>
          <p class="hof-modal-text hof-muted">Mevcut veri varsa önce ne değişeceği gösterilir; "devamı olarak ekle" ya da "yerine koy" seçersiniz.</p>
        </section>
        ${data.linked
          ? `<section class="hof-data-section">
          <h3>Google Sheets eşitlemesi</h3>
          <div class="hof-data-row">
            <label class="hof-field hof-field-inline"><span>Sıklık</span><select data-minutes>${[5, 15, 60].map(value => `<option value="${value}" ${value === minutes ? "selected" : ""}>${value === 60 ? "Saatte bir" : `${value} dakikada bir`}</option>`).join("")}</select></label>
            <button type="button" class="hof-button hof-button-small" data-sync>Şimdi eşitle</button>
            <a class="hof-button hof-button-small hof-button-ghost" href="${esc(data.linkedSheetUrl)}" target="_blank" rel="noopener">Sheet'i aç</a>
            <button type="button" class="hof-button hof-button-small hof-button-ghost" data-unlink>Bağlantıyı kaldır</button>
          </div>
        </section>`
          : ""}
        <section class="hof-data-section">
          <h3>Geçmiş</h3>
          <ul class="hof-history">${historyHtml(data.imports)}</ul>
        </section>
        ${data.rowCount
          ? `<section class="hof-data-section hof-danger-zone">
          <div><b>Veriyi kaldır</b><small>İçeri alınan tüm satırlar tablodan kalkar. Notlar, görevler ve işlem geçmişi silinmez; öncesinde yedek alınır.</small></div>
          <button type="button" class="hof-button hof-button-small hof-button-danger" data-remove>Veriyi kaldır</button>
        </section>`
          : ""}`,
    });
    const dialog = modal.dialog;
    const zone = dialog.querySelector(".hof-drop");
    if (zone) {
      wireDrop(zone);
      zone.querySelector("input").addEventListener("change", () => modal.close(), { once: true });
      zone.addEventListener("drop", () => modal.close(), { once: true });
    }
    const form = dialog.querySelector(".hof-link-form");
    if (form) {
      if (data.linkedSheetUrl) form.elements.url.value = data.linkedSheetUrl;
      form.addEventListener("submit", () => SHEET_PATTERN.test(form.elements.url.value.trim()) && modal.close());
      wireLink(form);
    }
    dialog.querySelector("[data-minutes]")?.addEventListener("change", async event => {
      try {
        HOF.applyClientState(await HOF.api("/api/workspace/client-state", { method: "PUT", body: { key: "syncMinutes", value: event.target.value } }));
        HOF.toast("Eşitleme sıklığı kaydedildi.", { type: "success" });
      } catch (error) {
        HOF.toastError(error);
      }
    });
    dialog.querySelector("[data-sync]")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      button.disabled = true;
      button.textContent = "Eşitleniyor…";
      try {
        const result = await HOF.api("/api/workspace/dataset/sync", { method: "POST", timeoutMs: 120_000 });
        modal.close();
        if (result.held) HOF.toast("Sheet'in yapısı değişmiş görünüyor; eşitleme onayınızı bekliyor (Ayarlar → Veri).", { type: "error", timeout: 8000 });
        else if (!result.ok) HOF.toast(result.message || "Google Sheets okunamadı.", { type: "error", timeout: 7000 });
        else {
          const counts = result.counts || {};
          const changed = counts.added + counts.updated + counts.missing;
          HOF.toast(changed ? `Eşitlendi: ${number(counts.added)} yeni, ${number(counts.updated)} güncellendi${counts.missing ? `, ${number(counts.missing)} Sheet'te yok` : ""}.` : "Eşitlendi; değişiklik yok.", { type: "success" });
          if (changed) HOF.refreshData();
        }
      } catch (error) {
        button.disabled = false;
        button.textContent = "Şimdi eşitle";
        HOF.toastError(error);
      }
    });
    dialog.querySelector("[data-review]")?.addEventListener("click", () => {
      modal.close();
      importSheet(data.linkedSheetUrl);
    });
    dialog.querySelector("[data-missing]")?.addEventListener("click", () => {
      modal.close();
      openMissing();
    });
    dialog.querySelector("[data-unlink]")?.addEventListener("click", async () => {
      const ok = await HOF.confirm({ title: "Bağlantıyı kaldır", message: "Google Sheets eşitlemesi durur. Şu ana kadar alınan veri tabloda kalır ve kullanılmaya devam eder.", confirmLabel: "Bağlantıyı kaldır" });
      if (!ok) return;
      try {
        await HOF.api("/api/workspace/dataset/unlink", { method: "POST" });
        modal.close();
        HOF.toast("Sheet bağlantısı kaldırıldı; veri yerinde.", { type: "success" });
        await loadSummary();
      } catch (error) {
        HOF.toastError(error);
      }
    });
    dialog.querySelector("[data-remove]")?.addEventListener("click", async () => {
      const ok = await HOF.confirm({ title: "Veriyi kaldır", message: `${number(data.rowCount)} kayıt tüm bilgisayarlarda tablodan kalkacak. Notlar, görevler ve işlem geçmişi silinmez; işlemden önce yedek alınır.`, confirmLabel: "Veriyi kaldır", danger: true });
      if (!ok) return;
      try {
        const result = await HOF.api("/api/workspace/dataset", { method: "DELETE" });
        HOF.applyClientState(result.state);
        sessionStorage.setItem("hof-flash", `Veri kaldırıldı (${number(result.removed)} kayıt). Yedek: ${result.backupName || "—"}`);
        location.reload();
      } catch (error) {
        HOF.toastError(error);
      }
    });
  }

  async function openMissing() {
    let rows;
    try {
      rows = await HOF.api("/api/workspace/dataset/missing");
    } catch (error) {
      HOF.toastError(error);
      return;
    }
    const modal = HOF.modal({
      title: "Sheet'te artık olmayan kayıtlar",
      eyebrow: "VERİ",
      size: "wide",
      body: `<p class="hof-modal-text">Bu kayıtlar bağlı Google Sheets'ten silinmiş veya taşınmış. DestekOfis onları kendiliğinden silmez. <b>Tut</b> derseniz bir daha işaretlenmez; <b>Kaldır</b> derseniz tablodan çıkar (notları ve geçmişi silinmez, öncesinde yedek alınır).</p>
        <label class="hof-check"><input type="checkbox" data-all checked><span>Tümünü seç (${number(rows.length)})</span></label>
        <ul class="hof-missing-list">${rows.map(row => `<li><label class="hof-check"><input type="checkbox" value="${esc(row.rowId)}" checked><span><b>${esc(row.caseKey.startsWith("satir:") ? "Kimliksiz satır" : row.caseKey)}</b>${row.tab ? ` · ${esc(row.tab)}` : ""}<small>${esc(row.preview.join(" · "))}</small></span></label></li>`).join("")}</ul>
        <div class="hof-actions"><button type="button" class="hof-button hof-button-ghost" data-action="keep">Seçilenleri tut</button><button type="button" class="hof-button hof-button-danger" data-action="remove">Seçilenleri kaldır</button></div>`,
    });
    const boxes = () => [...modal.dialog.querySelectorAll(".hof-missing-list input[type=checkbox]")];
    modal.dialog.querySelector("[data-all]").addEventListener("change", event => boxes().forEach(box => (box.checked = event.target.checked)));
    modal.dialog.addEventListener("click", async event => {
      const action = event.target.closest("[data-action]")?.dataset.action;
      if (!action) return;
      const rowIds = boxes().filter(box => box.checked).map(box => box.value);
      if (!rowIds.length) {
        HOF.toast("Önce kayıt seçin.", { type: "error" });
        return;
      }
      try {
        const result = await HOF.api("/api/workspace/dataset/missing", { method: "POST", body: { action, rowIds } });
        modal.close();
        HOF.toast(action === "remove" ? `${number(result.changed)} kayıt tablodan kaldırıldı.` : `${number(result.changed)} kayıt tutuldu.`, { type: "success" });
        await loadSummary();
        HOF.refreshData();
      } catch (error) {
        HOF.toastError(error);
      }
    });
  }

  // ---------- Arayüz paketinin yükleme girişlerini yönlendirme ----------
  const navLabel = element => (element?.textContent || "").trim();
  // Kenar çubuğundaki "Ayarlar" bizim Veri penceremizi açar; paketin kendi kaynak penceresi açılmaz.
  document.addEventListener(
    "click",
    event => {
      const item = event.target.closest(".sidebar .nav-item, .banner-link, .button-row button, .detail-actions button");
      if (!item) return;
      const label = navLabel(item);
      const intercept = label === "Ayarlar" || label === "Tabloyu değiştir" || label.includes("Yeni tablo yükle") || label.includes("Kaynağı değiştir");
      if (intercept) {
        event.preventDefault();
        event.stopImmediatePropagation();
        openDataSettings();
      } else if (label.includes("Sheet'te aç")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (HOF.settings.linkedSheetUrl) window.open(HOF.settings.linkedSheetUrl, "_blank", "noopener");
      }
    },
    true,
  );
  // Paketin kaynak penceresi yine de açılırsa (klavye kısayolu vb.) kapatılır ve yerine Veri penceresi açılır.
  function replaceLegacyModal() {
    const legacy = document.querySelector(".settings-modal");
    if (!legacy) return;
    const cancel = [...legacy.querySelectorAll(".modal-actions button")].find(button => navLabel(button) === "Vazgeç");
    cancel?.click();
    if (!document.querySelector(".hof-modal-backdrop")) openDataSettings();
  }
  // Paketin Excel okuyucusu devre dışı: dosya bizim akışımıza gider.
  window.addEventListener(
    "change",
    event => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || input.type !== "file" || !input.closest(".source-dropzone")) return;
      event.stopImmediatePropagation();
      event.stopPropagation();
      const file = input.files && input.files[0];
      input.value = "";
      if (file) importExcel(file);
    },
    true,
  );

  const setHidden = (element, hidden) => {
    const display = hidden ? "none" : "";
    if (element.style.display !== display) element.style.display = display;
  };
  function gateControls() {
    const manage = canManage();
    document.querySelectorAll(".sidebar .nav-item").forEach(button => {
      const label = navLabel(button);
      if (label === "Tabloyu değiştir") setHidden(button, true);
      if (label === "Ayarlar") setHidden(button, !manage);
    });
    document.querySelectorAll(".sidebar .nav-label").forEach(label => {
      if (navLabel(label) === "VERİ KAYNAĞI") setHidden(label, !manage);
    });
    document.querySelectorAll(".button-row button").forEach(button => {
      if (navLabel(button).includes("Yeni tablo yükle")) setHidden(button, true);
    });
    document.querySelectorAll(".banner-link").forEach(link => {
      if (navLabel(link).includes("Tabloyu değiştir")) setHidden(link, true);
    });
    document.querySelectorAll(".detail-actions").forEach(row => {
      let visible = 0;
      row.querySelectorAll("button").forEach(button => {
        const label = navLabel(button);
        const hidden = label.includes("Kaynağı değiştir") || (label.includes("Sheet'te aç") && !HOF.settings.linkedSheetUrl);
        setHidden(button, hidden);
        if (!hidden) visible += 1;
      });
      setHidden(row, visible === 0);
    });
  }

  // Sheet'te artık olmayan kayıtlar tabloda soluk görünür; seçilince detayda kısa açıklama çıkar.
  function markMissing() {
    document.querySelectorAll(".dynamic-table tbody tr").forEach(row => {
      const missing = missingKeys.has(row.dataset.hofKey || "");
      if (row.classList.contains("hof-row-missing") !== missing) row.classList.toggle("hof-row-missing", missing);
    });
    const panel = HOF.detailPanel();
    const key = HOF.selectedCase()?.key || "";
    let note = document.getElementById("hof-missing-note");
    if (!panel || !missingKeys.has(key)) {
      note?.remove();
      return;
    }
    if (!note) {
      note = HOF.el("p", { id: "hof-missing-note", class: "hof-alert hof-alert-soft" }, "Bu kayıt bağlı Google Sheets'te artık yok. Tabloda kalmaya devam eder; yönetici Ayarlar → Veri'den tutabilir veya kaldırabilir.");
    }
    const header = panel.querySelector(".detail-header");
    if (header && note.previousElementSibling !== header) header.after(note);
  }

  HOF.on("live:workspace.changed", change => {
    if (change?.kind === "records" && change.dataset) loadSummary().then(markMissing);
  });
  HOF.on("live:resync", () => loadSummary().then(markMissing));

  HOF.whenReady(() => {
    loadSummary().then(markMissing);
    HOF.onDom(() => {
      gateControls();
      renderStart();
      replaceLegacyModal();
      markMissing();
    });
  });
  HOF.sources = { importExcel, importSheet, openDataSettings, openMissing, uploadExcel: importExcel };
})();
