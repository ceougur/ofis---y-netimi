/* DestekOfis — merkezi veri kaynağı araçları.
 * Excel/CSV artık yalnızca yükleyen tarayıcıda kalmaz: dosya ayrıştırılıp sunucuya kaydedilir ve
 * ofisin ortak kaynağı olur. Kaynak ayarlarını yalnızca yönetici ve avukat değiştirebilir. */
(() => {
  "use strict";
  const HOF = window.HOF;
  const { esc } = HOF;
  const MAX_BYTES = 60 * 1024 * 1024;

  const parseInWorker = file =>
    new Promise((resolve, reject) => {
      let worker;
      try {
        worker = new Worker("/assets/hof-excel-worker.js", { type: "module" });
      } catch (error) {
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
      file.arrayBuffer().then(buffer => worker.postMessage({ buffer }, [buffer]), reject);
    });

  async function uploadExcel(file) {
    if (!HOF.can("sources.manage")) {
      HOF.toast("Veri kaynağını yalnızca yönetici veya avukat değiştirebilir.", { type: "error" });
      return;
    }
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      HOF.toast("Yalnızca .xlsx, .xls ve .csv dosyaları yüklenebilir.", { type: "error" });
      return;
    }
    if (file.size > MAX_BYTES) {
      HOF.toast("Dosya çok büyük (en fazla 60 MB).", { type: "error" });
      return;
    }
    const modal = HOF.modal({ title: "Excel tablosu yükleniyor", eyebrow: "VERİ KAYNAĞI", size: "small", dismissible: false, body: `<p class="hof-modal-text" data-status>"${esc(file.name)}" okunuyor…</p><div class="hof-progress"><span></span></div>` });
    const status = text => {
      const node = modal.dialog.querySelector("[data-status]");
      if (node) node.textContent = text;
    };
    try {
      const parsed = await parseInWorker(file);
      if (!parsed.rowCount) throw new Error("Dosyada okunabilir kayıt bulunamadı. Tablonun kolon başlıklarıyla başladığından emin olun.");
      status(`Yaklaşık ${parsed.rowCount} satır sunucuya kaydediliyor…`);
      const result = await HOF.api("/api/workspace/sources/excel", { method: "POST", body: { fileName: file.name, tabs: parsed.tabs, sheets: parsed.sheets }, timeoutMs: 180_000 });
      if (!result.rowCount) throw new Error("Dosyada okunabilir kayıt bulunamadı. Tablonun kolon başlıklarıyla başladığından emin olun.");
      HOF.applyClientState(result.state);
      const sections = result.tabs.length > parsed.tabs.length ? `, alt tablolarla ${result.tabs.length} bölüm` : `, ${result.tabs.length} sayfa`;
      sessionStorage.setItem("hof-flash", `"${result.fileName}" merkezi sunucuya yüklendi (${result.rowCount} kayıt${sections}). Tüm bilgisayarlar aynı tabloyu görür.`);
      location.reload();
    } catch (error) {
      modal.close();
      HOF.toastError(error);
    }
  }

  // React'in yerel Excel okuyucusu yerine merkezi yüklemeyi kullanır (yakalama aşamasında).
  window.addEventListener(
    "change",
    event => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || input.type !== "file" || !input.closest(".source-dropzone")) return;
      event.stopImmediatePropagation();
      event.stopPropagation();
      const file = input.files && input.files[0];
      input.value = "";
      if (file) uploadExcel(file);
    },
    true,
  );

  async function removeSource() {
    const ok = await HOF.confirm({ title: "Veri kaynağını kaldır", message: "Ofisin ortak tablosu tüm bilgisayarlarda kaldırılacak. Notlar, düzeltmeler ve işlem geçmişi silinmez; aynı kaynak yeniden bağlandığında geri gelir.", confirmLabel: "Kaynağı kaldır", danger: true });
    if (!ok) return;
    try {
      const state = await HOF.api("/api/workspace/sources/active", { method: "DELETE" });
      HOF.applyClientState(state);
      sessionStorage.setItem("hof-flash", "Veri kaynağı kaldırıldı.");
      location.reload();
    } catch (error) {
      HOF.toastError(error);
    }
  }

  const sourceDescription = () => {
    const url = HOF.settings.sheetUrl || "";
    if (!url) return "Henüz ortak veri kaynağı yok.";
    if (url.startsWith("excel://")) return `Aktif kaynak: "${url.slice(8)}" (sunucuya yüklenmiş Excel).`;
    return "Aktif kaynak: Google Sheets bağlantısı.";
  };

  function enhanceSettingsModal() {
    const modal = document.querySelector(".settings-modal");
    if (!modal) return;
    const canManage = HOF.can("sources.manage");
    modal.querySelectorAll("input, button.sync-option, .modal-actions .primary-button").forEach(control => {
      if (!canManage && !control.disabled) control.disabled = true;
    });
    if (modal.querySelector(".hof-source-tools")) return;
    const tools = HOF.el(
      "div",
      { class: "hof-source-tools" },
      `<p class="hof-source-hint">${esc(sourceDescription())}</p>
      <p class="hof-source-hint">Yüklenen Excel sunucuda saklanır ve tüm bilgisayarlarda görünür. Aynı adla yeniden yüklenen dosya, ofisin düzeltmelerini koruyarak tabloyu günceller.</p>
      ${canManage ? (HOF.settings.sheetUrl ? '<button type="button" class="hof-button hof-button-ghost hof-button-small" data-remove-source>Veri kaynağını kaldır</button>' : "") : '<p class="hof-inline-note">Veri kaynağını yalnızca yönetici veya avukat değiştirebilir.</p>'}`,
    );
    tools.querySelector("[data-remove-source]")?.addEventListener("click", removeSource);
    const actions = modal.querySelector(".modal-actions");
    if (actions && actions.parentNode === modal) modal.insertBefore(tools, actions);
    else modal.appendChild(tools);
  }

  // Yetkisiz kullanıcılar kaynak menülerini görmez; Excel kaynağında "Sheet'te aç" gizlenir.
  const setHidden = (element, hidden) => {
    const display = hidden ? "none" : "";
    if (element.style.display !== display) element.style.display = display;
  };
  function gateControls() {
    const canManage = HOF.can("sources.manage");
    const url = HOF.settings.sheetUrl || "";
    const isSheet = /^https?:\/\//.test(url);
    document.querySelectorAll(".sidebar .nav-item").forEach(button => {
      const label = button.textContent.trim();
      if (label === "Tabloyu değiştir" || label === "Ayarlar") setHidden(button, !canManage);
    });
    document.querySelectorAll(".sidebar .nav-label").forEach(label => {
      if (label.textContent.trim() === "VERİ KAYNAĞI") setHidden(label, !canManage);
    });
    document.querySelectorAll(".button-row button").forEach(button => {
      if (button.textContent.includes("Yeni tablo yükle")) setHidden(button, !canManage);
    });
    document.querySelectorAll(".detail-actions").forEach(row => {
      let visible = 0;
      row.querySelectorAll("button").forEach(button => {
        const label = button.textContent.trim();
        const hidden = label.includes("Kaynağı değiştir") ? !canManage : label.includes("Sheet'te aç") ? !isSheet : false;
        setHidden(button, hidden);
        if (!hidden) visible += 1;
      });
      setHidden(row, visible === 0);
    });
  }

  function emptyStateNote() {
    const wrap = document.querySelector(".dynamic-table-wrap");
    let note = document.getElementById("hof-source-empty");
    if (!wrap || HOF.settings.sheetUrl) {
      note?.remove();
      return;
    }
    if (!note) {
      note = HOF.el("div", { id: "hof-source-empty", class: "hof-inline-note" });
      if (HOF.can("sources.manage")) {
        note.innerHTML = 'Henüz ortak veri kaynağı yok. <button type="button" class="hof-button hof-button-small">Tablo ekle</button> ile Excel yükleyin veya Google Sheets bağlayın; tablo tüm bilgisayarlarda görünür.';
        note.querySelector("button").onclick = () => [...document.querySelectorAll(".sidebar .nav-item")].find(item => item.textContent.trim() === "Tabloyu değiştir")?.click();
      } else note.textContent = "Henüz ortak veri kaynağı yok. Yöneticinizden veya avukattan Excel yüklemesini ya da Google Sheets bağlamasını isteyin.";
    }
    if (wrap.previousSibling !== note) wrap.before(note);
  }

  HOF.whenReady(() => {
    HOF.onDom(() => {
      enhanceSettingsModal();
      gateControls();
      emptyStateNote();
    });
  });
  HOF.sources = { uploadExcel, removeSource };
})();
