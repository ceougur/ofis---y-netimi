/* DestekOfis — kayda belge ekleme (v2.0.1).
 * Detay kartında işlem geçmişinin üstünde "Belgeler" bölümü: PDF, resim ve ekran görüntüsü, Word, Excel,
 * PowerPoint, UYAP (.udf) ve metin dosyaları. Eklemek için işlem satırındaki "Belge" düğmesi, bölüme sürükleyip
 * bırakma ya da açılan pencerede Ctrl+V ile ekran görüntüsü yapıştırma. PDF ve resimler program içinde önizlenir,
 * her belge indirilebilir; kişi kendi eklediğini, yönetici ve ikinci rol herkesinkini siler. Yeni belge listenin
 * sonuna eklenir; başka bilgisayarda eklenen belge açık kartta kendiliğinden görünür. */
(() => {
  "use strict";
  const HOF = window.HOF;
  const { esc } = HOF;
  const MAX_BYTES = 25 * 1024 * 1024;
  const ACCEPT = ".pdf,.jpg,.jpeg,.jfif,.png,.gif,.webp,.tif,.tiff,.doc,.docx,.odt,.rtf,.xls,.xlsx,.ods,.csv,.ppt,.pptx,.udf,.txt";
  const ALLOWED = new Set(ACCEPT.split(",").map(item => item.slice(1)));
  const KIND_LABELS = { pdf: "PDF", image: "Resim", doc: "Word", sheet: "Excel", slide: "Sunum", udf: "UYAP", text: "Metin" };
  const ICONS = {
    pdf: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M8.5 16.5v-4h1.2a1.2 1.2 0 0 1 0 2.4H8.5M13 12.5v4h.8a2 2 0 0 0 0-4zM17.5 12.5h-1.7v4M15.8 14.5h1.4"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="m20.5 16-4.5-4.5-8.5 8"/>',
    doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M8.5 12h7M8.5 15h7M8.5 18h4"/>',
    sheet: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M8 12h8v6H8zM12 12v6M8 15h8"/>',
    slide: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><rect x="8" y="11.5" width="8" height="5.5" rx="1"/>',
    udf: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 12v4a3 3 0 0 0 6 0v-4"/>',
    text: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M8.5 13h7M8.5 16.5h5"/>',
  };
  const icon = kind => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[kind] || ICONS.text}</svg>`;
  const EYE = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const DOWN = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>';
  const size = bytes => {
    if (bytes < 1024) return `${bytes} B`;
    const units = ["KB", "MB", "GB"];
    let value = bytes / 1024;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
      value /= 1024;
      unit += 1;
    }
    return `${value.toLocaleString("tr-TR", { maximumFractionDigits: value < 10 ? 1 : 0 })} ${units[unit]}`;
  };
  const listUrl = key => `/api/workspace/cases/${encodeURIComponent(key)}/documents`;
  const fileUrl = (id, download = false) => `/api/workspace/documents/${encodeURIComponent(id)}/file${download ? "?download=1" : ""}`;
  const extOf = name => String(name || "").toLowerCase().split(".").pop();

  let currentKey = "";
  let documents = [];
  let request = 0;
  const uploads = new Map(); // geçici satırlar: kimlik → { name, progress }

  // ---------- Bölüm ----------
  function section() {
    const panel = HOF.detailPanel();
    const selected = HOF.selectedCase();
    let box = document.getElementById("hof-documents");
    if (!panel || !selected) {
      if (box) box.hidden = true;
      return null;
    }
    if (!box) {
      box = HOF.el("section", { id: "hof-documents", class: "hof-documents", "aria-label": "Belgeler" });
      box.addEventListener("click", onClick);
      wireDrop(box);
    }
    const activity = document.getElementById("hof-activity");
    if (activity && activity.parentNode === panel) {
      if (activity.previousElementSibling !== box) panel.insertBefore(box, activity);
    } else if (box.parentNode !== panel) panel.appendChild(box);
    box.hidden = false;
    return { box, selected };
  }

  function render() {
    const box = document.getElementById("hof-documents");
    if (!box) return;
    const canUpload = HOF.can("documents.upload");
    const pending = [...uploads].map(([id, item]) => ({ id, ...item }));
    const rows = documents
      .map(item => {
        const meta = [KIND_LABELS[item.kind] || "Dosya", size(item.size), item.actorName || "—", HOF.formatDateTime(item.createdAt)].join(" · ");
        const open = item.viewable
          ? `<button type="button" class="hof-doc-name" data-doc-view="${esc(item.id)}" title="Önizle: ${esc(item.name)}">${esc(item.name)}</button>`
          : `<a class="hof-doc-name" href="${fileUrl(item.id, true)}" download title="İndir: ${esc(item.name)}">${esc(item.name)}</a>`;
        return `<li data-kind="${esc(item.kind)}">
          <span class="hof-doc-icon">${icon(item.kind)}</span>
          <span class="hof-doc-main">${open}<small>${esc(meta)}</small></span>
          <span class="hof-doc-tools">
            ${item.viewable ? `<button type="button" class="hof-mini" data-doc-view="${esc(item.id)}" title="Önizle" aria-label="Önizle">${EYE}</button>` : ""}
            <a class="hof-mini" href="${fileUrl(item.id, true)}" download title="İndir" aria-label="İndir">${DOWN}</a>
            ${item.canDelete ? `<button type="button" class="hof-mini hof-mini-danger" data-doc-delete="${esc(item.id)}" title="Sil" aria-label="Sil">×</button>` : ""}
          </span>
        </li>`;
      })
      .concat(
        pending.map(item => `<li class="is-uploading" data-upload="${esc(item.id)}"><span class="hof-doc-icon">${icon(item.kind)}</span><span class="hof-doc-main"><b>${esc(item.name)}</b><span class="hof-doc-progress"><span style="width:${Math.round(item.progress * 100)}%"></span></span></span><span class="hof-doc-tools"><small>%${Math.round(item.progress * 100)}</small></span></li>`),
      )
      .join("");
    const count = documents.length;
    box.innerHTML = `<div class="hof-activity-head"><h3>BELGELER${count ? ` <em>${count}</em>` : ""}</h3>${canUpload ? '<button type="button" class="hof-doc-add" data-doc-add data-requires="documents.upload">+ Belge ekle</button>' : ""}</div>
      ${rows ? `<ol class="hof-doc-list">${rows}</ol>` : `<p class="hof-doc-empty">${canUpload ? "Henüz belge yok. PDF, resim, Word, Excel veya UYAP dosyasını buraya <b>sürükleyip bırakın</b> ya da <b>+ Belge ekle</b>." : "Bu kayıtta belge yok."}</p>`}
      <div class="hof-doc-drop" aria-hidden="true"><span>Bırakın, bu kayda eklensin</span></div>`;
  }

  async function load(force = false) {
    const target = section();
    if (!target) {
      currentKey = "";
      return;
    }
    const { selected } = target;
    if (!force && currentKey === selected.key) return;
    if (currentKey !== selected.key) {
      documents = [];
      uploads.clear();
      target.box.innerHTML = '<div class="hof-activity-head"><h3>BELGELER</h3></div><p class="hof-doc-empty">Yükleniyor…</p>';
    }
    currentKey = selected.key;
    const ticket = ++request;
    try {
      const result = await HOF.api(listUrl(selected.key));
      if (ticket !== request) return;
      documents = result.documents;
      render();
    } catch (error) {
      if (ticket === request) target.box.innerHTML = `<div class="hof-activity-head"><h3>BELGELER</h3></div><p class="hof-doc-empty">${esc(error.message)}</p>`;
    }
  }

  // ---------- Yükleme ----------
  function check(file) {
    const ext = extOf(file.name);
    if (!ALLOWED.has(ext)) return `“${file.name}” eklenemez: bu dosya türü desteklenmiyor. PDF, resim, Word, Excel, PowerPoint, UYAP (.udf) veya metin dosyası seçin.`;
    if (file.size > MAX_BYTES) return `“${file.name}” çok büyük (${size(file.size)}). En fazla 25 MB.`;
    if (!file.size) return `“${file.name}” boş.`;
    return "";
  }
  const kindOf = name => {
    const ext = extOf(name);
    if (ext === "pdf") return "pdf";
    if (["jpg", "jpeg", "jfif", "png", "gif", "webp", "tif", "tiff"].includes(ext)) return "image";
    if (["xls", "xlsx", "ods", "csv"].includes(ext)) return "sheet";
    if (["ppt", "pptx"].includes(ext)) return "slide";
    if (ext === "udf") return "udf";
    if (ext === "txt") return "text";
    return "doc";
  };

  // XMLHttpRequest: fetch yükleme ilerlemesini bildirmez.
  const send = (key, title, file, onProgress) =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${listUrl(key)}?name=${encodeURIComponent(file.name)}&title=${encodeURIComponent(title || "")}`);
      xhr.setRequestHeader("content-type", "application/octet-stream");
      xhr.setRequestHeader("x-hof-upload", "1");
      xhr.upload.onprogress = event => event.lengthComputable && onProgress(event.loaded / event.total);
      xhr.onload = () => {
        let payload = {};
        try {
          payload = JSON.parse(xhr.responseText || "{}");
        } catch {
          payload = {};
        }
        if (xhr.status >= 200 && xhr.status < 300 && payload.ok) resolve(payload.data);
        else {
          if (payload.code === "LICENSE_READ_ONLY") HOF.emit("license-read-only", payload);
          reject(new Error(payload.error || `Belge yüklenemedi (${xhr.status}).`));
        }
      };
      xhr.onerror = () => reject(new Error("Sunucuya ulaşılamadı; belge yüklenemedi."));
      xhr.send(file);
    });

  async function upload(files) {
    const selected = HOF.selectedCase();
    if (!selected || !HOF.can("documents.upload")) return;
    const list = [...files];
    const problems = list.map(check).filter(Boolean);
    const valid = list.filter(file => !check(file));
    for (const problem of problems) HOF.toast(problem, { type: "error", timeout: 6000 });
    if (!valid.length) return;
    let done = 0;
    for (const file of valid) {
      const id = `u${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
      uploads.set(id, { name: file.name, kind: kindOf(file.name), progress: 0 });
      if (currentKey === selected.key) render();
      try {
        const item = await send(selected.key, selected.title, file, progress => {
          const entry = uploads.get(id);
          if (!entry) return;
          entry.progress = progress;
          const row = document.querySelector(`#hof-documents [data-upload="${id}"]`);
          if (!row) return;
          row.querySelector(".hof-doc-progress span").style.width = `${Math.round(progress * 100)}%`;
          row.querySelector(".hof-doc-tools small").textContent = `%${Math.round(progress * 100)}`;
        });
        uploads.delete(id);
        if (currentKey === selected.key) documents.push(item);
        done += 1;
      } catch (error) {
        uploads.delete(id);
        HOF.toastError(error);
      }
      if (currentKey === selected.key) render();
    }
    if (done) HOF.toast(done === 1 ? `Belge eklendi: ${valid.length === 1 ? valid[0].name : "1 dosya"}.` : `${done} belge eklendi.`, { type: "success" });
  }

  // "Belge ekle" penceresi: dosya seçme, sürükle-bırak, Ctrl+V ile ekran görüntüsü.
  function openAdd() {
    const selected = HOF.selectedCase();
    if (!selected) return HOF.toast("Önce tablodan bir kayıt seçin.", { type: "error" });
    const modal = HOF.modal({
      title: "Belge ekle",
      eyebrow: selected.title || "BELGE",
      body: `<label class="hof-drop hof-doc-picker">
          <span class="hof-drop-icon" aria-hidden="true">${icon("doc")}</span>
          <span><b>Dosya seçin</b><small>veya buraya sürükleyip bırakın · birden çok dosya seçilebilir</small></span>
          <input type="file" accept="${ACCEPT}" multiple hidden>
        </label>
        <div class="hof-doc-paste">
          <span class="hof-doc-paste-keys"><kbd>Ctrl</kbd>+<kbd>V</kbd></span>
          <span><b>Ekran görüntüsü</b> eklemek için bu pencere açıkken yapıştırın. Windows'ta ekran görüntüsü <kbd>Win</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> ile alınır.</span>
        </div>
        <p class="hof-modal-text hof-muted">Eklenebilir: PDF, resim (JPG, PNG, WEBP, GIF, TIFF), Word, Excel, PowerPoint, UYAP (.udf), metin. Dosya başına en fazla 25 MB. PDF ve resimler programda önizlenir; tüm belgeler indirilebilir.</p>
        <div class="hof-actions"><button type="button" class="hof-button hof-button-ghost" data-cancel>Kapat</button></div>`,
      onClose: () => document.removeEventListener("paste", onPaste, true),
    });
    const input = modal.dialog.querySelector("input[type=file]");
    const zone = modal.dialog.querySelector(".hof-doc-picker");
    const take = files => {
      if (!files?.length) return;
      modal.close();
      upload(files);
    };
    input.addEventListener("change", () => take(input.files));
    zone.addEventListener("dragover", event => {
      event.preventDefault();
      zone.classList.add("is-over");
    });
    zone.addEventListener("dragleave", () => zone.classList.remove("is-over"));
    zone.addEventListener("drop", event => {
      event.preventDefault();
      take(event.dataTransfer?.files);
    });
    modal.dialog.querySelector("[data-cancel]").onclick = () => modal.close();
    function onPaste(event) {
      const items = [...(event.clipboardData?.items || [])].filter(item => item.kind === "file");
      if (!items.length) return;
      event.preventDefault();
      const stamp = new Date();
      const pad = value => String(value).padStart(2, "0");
      const files = items
        .map(item => item.getAsFile())
        .filter(Boolean)
        .map((file, index) => {
          const ext = (file.type.split("/")[1] || "png").replace("jpeg", "jpg");
          const name = file.name && file.name !== "image.png" ? file.name : `Ekran görüntüsü ${stamp.getFullYear()}-${pad(stamp.getMonth() + 1)}-${pad(stamp.getDate())} ${pad(stamp.getHours())}.${pad(stamp.getMinutes())}${index ? ` (${index + 1})` : ""}.${ext}`;
          return new File([file], name, { type: file.type });
        });
      take(files);
    }
    document.addEventListener("paste", onPaste, true);
  }

  // Kartın üzerine dosya sürüklenince bölüm vurgulanır; bırakılınca doğrudan eklenir.
  function wireDrop(box) {
    let depth = 0;
    const hasFiles = event => [...(event.dataTransfer?.types || [])].includes("Files");
    box.addEventListener("dragenter", event => {
      if (!hasFiles(event) || !HOF.can("documents.upload")) return;
      depth += 1;
      box.classList.add("is-over");
    });
    box.addEventListener("dragover", event => {
      if (!hasFiles(event) || !HOF.can("documents.upload")) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    });
    box.addEventListener("dragleave", () => {
      depth = Math.max(0, depth - 1);
      if (!depth) box.classList.remove("is-over");
    });
    box.addEventListener("drop", event => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth = 0;
      box.classList.remove("is-over");
      upload(event.dataTransfer.files);
    });
  }

  // ---------- Önizleme ----------
  function preview(id) {
    const viewable = documents.filter(item => item.viewable);
    let index = viewable.findIndex(item => item.id === id);
    if (index < 0) return;
    const modal = HOF.modal({ title: viewable[index].name, eyebrow: "BELGE", size: "wide", body: '<div class="hof-doc-viewer" data-stage></div><div class="hof-doc-viewer-bar"><span data-meta></span><span class="hof-doc-viewer-actions"></span></div>' });
    modal.dialog.classList.add("hof-doc-modal");
    const stage = modal.dialog.querySelector("[data-stage]");
    const show = () => {
      const item = viewable[index];
      modal.dialog.querySelector(".hof-modal-title").textContent = item.name;
      stage.innerHTML = item.kind === "pdf"
        ? `<iframe src="${fileUrl(item.id)}" title="${esc(item.name)}"></iframe>`
        : `<img src="${fileUrl(item.id)}" alt="${esc(item.name)}">`;
      modal.dialog.querySelector("[data-meta]").textContent = `${KIND_LABELS[item.kind] || "Dosya"} · ${size(item.size)} · ${item.actorName || "—"} · ${HOF.formatDateTime(item.createdAt)}${viewable.length > 1 ? ` · ${index + 1}/${viewable.length}` : ""}`;
      modal.dialog.querySelector(".hof-doc-viewer-actions").innerHTML = `${viewable.length > 1 ? '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-step="-1" aria-label="Önceki belge">‹ Önceki</button><button type="button" class="hof-button hof-button-small hof-button-ghost" data-step="1" aria-label="Sonraki belge">Sonraki ›</button>' : ""}<a class="hof-button hof-button-small hof-button-ghost" href="${fileUrl(item.id)}" target="_blank" rel="noopener">Yeni sekmede aç</a><a class="hof-button hof-button-small" href="${fileUrl(item.id, true)}" download>İndir</a>`;
    };
    const step = delta => {
      index = (index + delta + viewable.length) % viewable.length;
      show();
    };
    modal.dialog.addEventListener("click", event => {
      const button = event.target.closest("[data-step]");
      if (button) step(Number(button.dataset.step));
    });
    const onKey = event => {
      if (!modal.node.isConnected) return document.removeEventListener("keydown", onKey);
      if (viewable.length > 1 && (event.key === "ArrowRight" || event.key === "ArrowLeft") && !event.target.closest?.("input, textarea")) step(event.key === "ArrowRight" ? 1 : -1);
    };
    document.addEventListener("keydown", onKey);
    show();
  }

  async function remove(id) {
    const item = documents.find(entry => entry.id === id);
    if (!item) return;
    const ok = await HOF.confirm({ title: "Belgeyi sil", message: `“${item.name}” bu kayıttan kaldırılacak. İşlem değişiklik geçmişine yazılır.`, confirmLabel: "Belgeyi sil", danger: true });
    if (!ok) return;
    try {
      await HOF.api(`/api/workspace/documents/${encodeURIComponent(id)}`, { method: "DELETE" });
      documents = documents.filter(entry => entry.id !== id);
      render();
      HOF.toast("Belge silindi.", { type: "success" });
    } catch (error) {
      HOF.toastError(error);
    }
  }

  function onClick(event) {
    const target = event.target.closest("[data-doc-add], [data-doc-view], [data-doc-delete]");
    if (!target) return;
    event.preventDefault();
    if (target.hasAttribute("data-doc-add")) openAdd();
    else if (target.dataset.docView) preview(target.dataset.docView);
    else if (target.dataset.docDelete) remove(target.dataset.docDelete);
  }

  // İşlem satırına "Belge" düğmesi (Not, Telefon, Tahsilat… ile aynı sırada).
  function installButton() {
    const row = document.querySelector(".hof-case-actions");
    if (!row || row.querySelector('[data-case-action="document"]')) return;
    const button = HOF.el("button", { type: "button", "data-case-action": "document", "data-requires": "documents.upload", text: "Belge" });
    button.addEventListener("click", openAdd);
    const edit = row.querySelector('[data-case-action="edit"]');
    if (edit) row.insertBefore(button, edit);
    else row.appendChild(button);
  }

  HOF.on("live:workspace.changed", change => {
    if (change?.kind === "documents" && change.caseKey && change.caseKey === currentKey) load(true);
  });
  HOF.on("live:resync", () => currentKey && load(true));

  HOF.whenReady(() => {
    HOF.onDom(() => {
      installButton();
      load();
    });
  });
  HOF.documents = { open: openAdd, upload, reload: () => load(true) };
})();
