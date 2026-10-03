/* DestekOfis — kayda belge ekleme (v2.0.1).
 * Detay kartında işlem geçmişinin üstünde "Belgeler" bölümü: PDF, resim ve ekran görüntüsü, Word, Excel,
 * PowerPoint, UYAP (.udf) ve metin dosyaları. Eklemek için işlem satırındaki "Belge" düğmesi, bölüme sürükleyip
 * bırakma ya da açılan pencerede Ctrl+V ile ekran görüntüsü yapıştırma. PDF ve resimler program içinde önizlenir,
 * her belge indirilebilir; kişi kendi eklediğini, yönetici ve ikinci rol herkesinkini siler. Yeni belge listenin
 * sonuna eklenir; başka bilgisayarda eklenen belge açık kartta kendiliğinden görünür.
 * v2.0.2: adet sınırı yok (dosya başına 25 MB). Birden çok belgede "Belge kartı": belgeler yan yana (1–4 sütun),
 * her biri özgün biçimiyle indirilir, seçilenler tek .zip olarak; PDF, resim ve metin belgeleri doğrudan yazdırılır. */
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
  const TRASH = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>';
  const PRINT = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><path d="M7 14h10v7H7z"/></svg>';
  const GRID = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></svg>';
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
  const fileUrl = (id, download = false) => HOF.apiUrl(`/api/workspace/documents/${encodeURIComponent(id)}/file${download ? "?download=1" : ""}`);
  const extOf = name => String(name || "").toLowerCase().split(".").pop();
  // Tarayıcıda doğrudan yazdırılabilenler: PDF, resim (JPG, PNG, GIF, WEBP) ve metin. Word/Excel/UYAP kendi programında.
  const printable = item => Boolean(item.viewable) || item.mime === "text/plain" || item.mime === "text/csv";
  const LIST_LIMIT = 6; // kartta ilk 6 belge; fazlası "Tümünü gör" ile belge kartında
  const clickDownload = href => {
    const link = HOF.el("a", { href, download: "", hidden: true });
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

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
    activeGallery?.refresh();
    const box = document.getElementById("hof-documents");
    if (!box) return;
    const canUpload = HOF.can("documents.upload");
    const pending = [...uploads].map(([id, item]) => ({ id, ...item }));
    const many = documents.length > 1;
    const rows = documents
      .slice(0, documents.length > LIST_LIMIT + 1 ? LIST_LIMIT : documents.length)
      .map(item => {
        const meta = [KIND_LABELS[item.kind] || "Dosya", size(item.size), item.actorName || "—", HOF.formatDateTime(item.createdAt)].join(" · ");
        // Birden çok belgede ad, belge kartını o belgeyle açar (belgeler yan yana).
        const open = many
          ? `<button type="button" class="hof-doc-name" data-doc-gallery="${esc(item.id)}" title="Belge kartında aç: ${esc(item.name)}">${esc(item.name)}</button>`
          : item.viewable
            ? `<button type="button" class="hof-doc-name" data-doc-view="${esc(item.id)}" title="Önizle: ${esc(item.name)}">${esc(item.name)}</button>`
            : `<a class="hof-doc-name" href="${fileUrl(item.id, true)}" download title="İndir: ${esc(item.name)}">${esc(item.name)}</a>`;
        return `<li data-kind="${esc(item.kind)}">
          <span class="hof-doc-icon">${icon(item.kind)}</span>
          <span class="hof-doc-main">${open}<small>${esc(meta)}</small></span>
          <span class="hof-doc-tools">
            ${item.viewable ? `<button type="button" class="hof-mini" data-doc-view="${esc(item.id)}" title="Önizle" aria-label="${esc(item.name)} önizle">${EYE}</button>` : ""}
            ${printable(item) ? `<button type="button" class="hof-mini" data-doc-print="${esc(item.id)}" title="Yazdır" aria-label="${esc(item.name)} yazdır">${PRINT}</button>` : ""}
            <a class="hof-mini" href="${fileUrl(item.id, true)}" download title="İndir" aria-label="${esc(item.name)} indir">${DOWN}</a>
            ${item.canDelete ? `<button type="button" class="hof-mini hof-mini-danger hof-doc-delete" data-doc-delete="${esc(item.id)}" title="Belgeyi sil" aria-label="${esc(item.name)} belgesini sil">${TRASH}</button>` : ""}
          </span>
        </li>`;
      })
      .concat(
        pending.map(item => `<li class="is-uploading" data-upload="${esc(item.id)}"><span class="hof-doc-icon">${icon(item.kind)}</span><span class="hof-doc-main"><b>${esc(item.name)}</b><span class="hof-doc-progress"><span style="width:${Math.round(item.progress * 100)}%"></span></span></span><span class="hof-doc-tools"><small>%${Math.round(item.progress * 100)}</small></span></li>`),
      )
      .join("");
    const count = documents.length;
    const hiddenCount = count > LIST_LIMIT + 1 ? count - LIST_LIMIT : 0;
    const galleryButton = count > 1 ? `<button type="button" class="hof-doc-gallery-open" data-doc-gallery title="Belgeleri yan yana gör, indir, yazdır">${GRID}<span>Yan Yana Gör</span></button>` : "";
    box.innerHTML = `<div class="hof-activity-head"><h3>BELGELER${count ? ` <em>${count}</em>` : ""}</h3><span class="hof-doc-head-tools">${galleryButton}${canUpload ? '<button type="button" class="hof-doc-add" data-doc-add data-requires="documents.upload">+ Belge Ekle</button>' : ""}</span></div>
      ${rows ? `<ol class="hof-doc-list">${rows}</ol>${hiddenCount ? `<button type="button" class="hof-doc-more" data-doc-gallery>+${hiddenCount} belge daha · tümünü belge kartında gör</button>` : ""}` : `<p class="hof-doc-empty">${canUpload ? "Henüz belge yok. PDF, resim, Word, Excel veya UYAP dosyasını buraya <b>sürükleyip bırakın</b> ya da <b>+ Belge Ekle</b>." : "Bu kayıtta belge yok."}</p>`}
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
      xhr.open("POST", HOF.apiUrl(`${listUrl(key)}?name=${encodeURIComponent(file.name)}&title=${encodeURIComponent(title || "")}`));
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
    // Adet sınırı yok; dosyalar aynı anda en çok 3'er yüklenir, sıraları korunur.
    const queue = valid.map(file => ({ file, id: `u${Date.now()}${Math.random().toString(36).slice(2, 8)}` }));
    for (const { file, id } of queue) uploads.set(id, { name: file.name, kind: kindOf(file.name), progress: 0 });
    if (currentKey === selected.key) render();
    const results = new Array(queue.length).fill(null); // null: sürüyor · false: yüklenemedi · belge
    let next = 0;
    let placed = 0;
    const worker = async () => {
      while (next < queue.length) {
        const index = next++;
        results[index] = await one(queue[index].file, queue[index].id);
        // Biten belgeler seçim sırasıyla listeye eklenir (öncekiler bitene kadar bekler).
        while (placed < results.length && results[placed] !== null) {
          if (results[placed] && currentKey === selected.key) documents.push(results[placed]);
          placed += 1;
        }
        if (currentKey === selected.key) render();
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, queue.length) }, worker));
    if (done) HOF.toast(done === 1 ? `Belge eklendi: ${valid.length === 1 ? valid[0].name : "1 dosya"}.` : `${done} belge eklendi.`, { type: "success" });

    async function one(file, id) {
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
        done += 1;
        return item;
      } catch (error) {
        uploads.delete(id);
        HOF.toastError(error);
        return false;
      }
    }
  }

  // "Belge ekle" penceresi: dosya seçme, sürükle-bırak, Ctrl+V ile ekran görüntüsü.
  function openAdd() {
    const selected = HOF.selectedCase();
    if (!selected) return HOF.toast("Önce tablodan bir kayıt seçin.", { type: "error" });
    const modal = HOF.modal({
      title: "Belge Ekle",
      eyebrow: selected.title || "BELGE",
      body: `<label class="hof-drop hof-doc-picker">
          <span class="hof-drop-icon" aria-hidden="true">${icon("doc")}</span>
          <span><b>Dosya Seçin</b><small>veya buraya sürükleyip bırakın · birden çok dosya seçilebilir</small></span>
          <input type="file" accept="${ACCEPT}" multiple hidden>
        </label>
        <div class="hof-doc-paste">
          <span class="hof-doc-paste-keys"><kbd>Ctrl</kbd>+<kbd>V</kbd></span>
          <span><b>Ekran Görüntüsü</b> eklemek için bu pencere açıkken yapıştırın. Windows'ta ekran görüntüsü <kbd>Win</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> ile alınır.</span>
        </div>
        <p class="hof-modal-text hof-muted">Eklenebilir: PDF, resim (JPG, PNG, WEBP, GIF, TIFF), Word, Excel, PowerPoint, UYAP (.udf), metin. Adet sınırı yok; dosya başına en fazla 25 MB. PDF ve resimler programda önizlenir ve yazdırılır; tüm belgeler indirilebilir.</p>
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
      modal.dialog.querySelector(".hof-doc-viewer-actions").innerHTML = `${viewable.length > 1 ? '<button type="button" class="hof-button hof-button-small hof-button-ghost" data-step="-1" aria-label="Önceki belge">‹ Önceki</button><button type="button" class="hof-button hof-button-small hof-button-ghost" data-step="1" aria-label="Sonraki belge">Sonraki ›</button>' : ""}<a class="hof-button hof-button-small hof-button-ghost" href="${fileUrl(item.id)}" target="_blank" rel="noopener">Yeni Sekmede Aç</a><button type="button" class="hof-button hof-button-small hof-button-ghost" data-viewer-print="${esc(item.id)}">Yazdır</button><a class="hof-button hof-button-small" href="${fileUrl(item.id, true)}" download>İndir</a>${item.canDelete ? `<button type="button" class="hof-button hof-button-small hof-button-danger-ghost" data-viewer-delete="${esc(item.id)}">Sil</button>` : ""}`;
    };
    const step = delta => {
      index = (index + delta + viewable.length) % viewable.length;
      show();
    };
    modal.dialog.addEventListener("click", async event => {
      const button = event.target.closest("[data-step]");
      if (button) step(Number(button.dataset.step));
      const printButton = event.target.closest("[data-viewer-print]");
      if (printButton) printDocuments([viewable[index]]);
      const del = event.target.closest("[data-viewer-delete]");
      if (del && (await remove(del.dataset.viewerDelete))) modal.close();
    });
    const onKey = event => {
      if (!modal.node.isConnected) return document.removeEventListener("keydown", onKey);
      if (viewable.length > 1 && (event.key === "ArrowRight" || event.key === "ArrowLeft") && !event.target.closest?.("input, textarea")) step(event.key === "ArrowRight" ? 1 : -1);
    };
    document.addEventListener("keydown", onKey);
    show();
  }

  // ---------- Yazdırma ----------
  // Belge gizli bir çerçevede açılıp tarayıcının yazdırma penceresi çağrılır (yeni sekme açılmaz). Resimler ve metin
  // belgeleri tek yazdırma işinde (her biri ayrı sayfa); PDF'ler kendi yazdırma pencereleriyle sırayla.
  const PRINT_CSS = "@page{margin:12mm}html,body{margin:0;background:#fff;color:#111;font:12px/1.5 'DejaVu Sans',Arial,sans-serif}.page{display:flex;height:calc(100vh - 1px);align-items:center;justify-content:center;break-after:page;page-break-after:always}.page:last-child{break-after:auto;page-break-after:auto}.page img{max-width:100%;max-height:100%;object-fit:contain}.text{white-space:pre-wrap;word-break:break-word;font:11px/1.45 ui-monospace,Consolas,monospace;break-after:page}.text:last-child{break-after:auto}h1{margin:0 0 8px;font-size:12px;font-weight:600;color:#555}";
  let printFrame = null;
  const freshFrame = () => {
    printFrame?.remove();
    printFrame = HOF.el("iframe", { class: "hof-print-frame", title: "Yazdırma", "aria-hidden": "true", tabindex: "-1" });
    document.body.appendChild(printFrame);
    return printFrame;
  };
  const printPdf = item =>
    new Promise(resolve => {
      const frame = freshFrame();
      frame.addEventListener(
        "load",
        () => {
          try {
            frame.contentWindow.focus();
            frame.contentWindow.print();
          } catch {
            window.open(fileUrl(item.id), "_blank", "noopener"); // tarayıcı çerçeveden yazdırmaya izin vermezse
          }
          resolve();
        },
        { once: true },
      );
      frame.src = fileUrl(item.id);
    });
  async function printPages(items) {
    const parts = [];
    for (const item of items) {
      if (item.viewable) parts.push(`<div class="page"><img src="${fileUrl(item.id)}" alt="${esc(item.name)}"></div>`);
      else {
        const response = await fetch(fileUrl(item.id), { credentials: "same-origin" });
        if (!response.ok) throw new Error(`“${item.name}” okunamadı (${response.status}).`);
        parts.push(`<section class="text"><h1>${esc(item.name)}</h1>${esc(await response.text())}</section>`);
      }
    }
    const frame = freshFrame();
    await new Promise(resolve => {
      frame.addEventListener("load", resolve, { once: true });
      frame.srcdoc = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${esc(items.length === 1 ? items[0].name : `${items.length} belge`)}</title><style>${PRINT_CSS}</style></head><body>${parts.join("")}</body></html>`;
    });
    const doc = frame.contentDocument;
    await Promise.all(
      [...doc.images].map(image =>
        image.complete
          ? null
          : new Promise(done => {
              image.addEventListener("load", done, { once: true });
              image.addEventListener("error", done, { once: true });
            }),
      ),
    );
    frame.contentWindow.focus();
    frame.contentWindow.print();
  }
  // PDF sırası: ilki hemen, sonrakiler kullanıcı "Sıradakini yazdır" dedikçe (üst üste yazdırma penceresi açılmaz).
  let printQueue = [];
  const queueBar = () => document.querySelector(".hof-print-queue");
  function showQueue() {
    const bar = queueBar();
    if (!bar) return;
    if (!printQueue.length) {
      bar.hidden = true;
      return;
    }
    bar.hidden = false;
    bar.innerHTML = `<span>Sıradaki PDF: <b>${esc(printQueue[0].name)}</b>${printQueue.length > 1 ? ` · ${printQueue.length - 1} tane daha` : ""}</span><span><button type="button" class="hof-button hof-button-small" data-queue-next>${PRINT} Sıradakini Yazdır</button><button type="button" class="hof-button hof-button-small hof-button-ghost" data-queue-stop>Bitir</button></span>`;
  }
  async function printDocuments(items) {
    const skipped = items.filter(item => !printable(item));
    const pages = items.filter(item => printable(item) && item.kind !== "pdf");
    const pdfs = items.filter(item => item.kind === "pdf" && item.viewable);
    if (skipped.length) HOF.toast(`${skipped.length} belge tarayıcıda yazdırılamaz (${[...new Set(skipped.map(item => KIND_LABELS[item.kind] || "dosya"))].join(", ")}). İndirip kendi programında yazdırın.`, { type: "info", timeout: 7000 });
    try {
      if (pages.length) await printPages(pages);
      if (!pdfs.length) return;
      if (pages.length || pdfs.length > 1) {
        printQueue = pdfs.slice(pages.length ? 0 : 1);
        if (!pages.length) await printPdf(pdfs[0]);
        if (queueBar()) showQueue();
        else if (printQueue.length) queueToast();
      } else await printPdf(pdfs[0]);
    } catch (error) {
      HOF.toastError(error);
    }
  }
  // Belge kartı dışından (kayıt listesinden) çoklu yazdırma olmaz; yine de sıra kalırsa bildirimle sürdürülür.
  function queueToast() {
    const item = printQueue.shift();
    if (!item) return;
    HOF.toast(`Sıradaki PDF: “${item.name}”`, { type: "info", timeout: 15000, action: { label: "Yazdır", onClick: () => printPdf(item).then(queueToast) } });
  }

  // ---------- Belge kartı (v2.0.2) ----------
  let activeGallery = null; // açık belge kartı: belge listesi değişince (ekleme, silme, geri alma) yeniden çizilir
  const COLS_KEY = "hof.documents.columns";
  const savedCols = () => {
    try {
      const value = Number(localStorage.getItem(COLS_KEY));
      return value >= 1 && value <= 4 ? value : 0;
    } catch {
      return 0;
    }
  };
  function tileView(item) {
    if (item.kind === "pdf" && item.viewable) return `<iframe src="${fileUrl(item.id)}#toolbar=0&navpanes=0&view=FitH" title="${esc(item.name)}" loading="lazy"></iframe>`;
    if (item.viewable) return `<img src="${fileUrl(item.id)}" alt="${esc(item.name)}" loading="lazy">`;
    return `<div class="hof-tile-placeholder">${icon(item.kind)}<b>${esc(KIND_LABELS[item.kind] || "Dosya")}</b><small>${printable(item) ? "Önizleme yok; yazdırılabilir ve indirilebilir." : "Tarayıcıda açılmaz. İndirip kendi programında açın ya da yazdırın."}</small></div>`;
  }
  function gallery(focusId = "") {
    const selected = HOF.selectedCase();
    if (!selected || !documents.length) return;
    const key = selected.key;
    const picked = new Set();
    const cols = savedCols() || Math.min(3, Math.max(2, documents.length));
    const modal = HOF.modal({
      title: "Belgeler",
      eyebrow: selected.title || "BELGE",
      size: "wide",
      body: `<div class="hof-gallery-head"><div class="hof-gallery-bar">
          <label class="hof-check"><input type="checkbox" data-pick-all><span>Tümünü Seç</span></label>
          <span class="hof-gallery-count" data-count aria-live="polite"></span>
          <span class="hof-gallery-actions">
            <button type="button" class="hof-button hof-button-small hof-button-ghost" data-bulk-download disabled>${DOWN} <span>İndir</span></button>
            <button type="button" class="hof-button hof-button-small hof-button-ghost" data-bulk-print disabled>${PRINT} <span>Yazdır</span></button>
          </span>
          <span class="hof-gallery-cols" role="group" aria-label="Yan yana kaç belge"><span>Yan Yana</span>${[1, 2, 3, 4].map(value => `<button type="button" data-cols="${value}" aria-pressed="${value === cols}">${value}</button>`).join("")}</span>
        </div>
        <div class="hof-print-queue" role="status" hidden></div></div>
        <div class="hof-gallery-grid" data-grid data-layout="${cols}" style="--cols:${cols}"></div>`,
      onClose: () => {
        printQueue = [];
        observer?.disconnect();
        activeGallery = null;
      },
    });
    modal.dialog.classList.add("hof-doc-gallery-modal");
    const grid = modal.dialog.querySelector("[data-grid]");
    let observer = null;
    let signature = "";
    const draw = () => {
      if (!documents.length) return modal.close();
      signature = documents.map(item => item.id).join(",");
      modal.dialog.querySelector(".hof-modal-title").textContent = `Belgeler (${documents.length})`;
      for (const id of [...picked]) if (!documents.some(item => item.id === id)) picked.delete(id);
      grid.innerHTML = documents
        .map(item => `<article class="hof-tile${picked.has(item.id) ? " is-picked" : ""}" data-tile="${esc(item.id)}" data-kind="${esc(item.kind)}">
          <header>
            <label class="hof-tile-check" title="Seç"><input type="checkbox" data-pick="${esc(item.id)}" ${picked.has(item.id) ? "checked" : ""} aria-label="Seç: ${esc(item.name)}"></label>
            <span class="hof-tile-title"><b title="${esc(item.name)}">${esc(item.name)}</b><small>${esc([KIND_LABELS[item.kind] || "Dosya", size(item.size), HOF.formatDateTime(item.createdAt)].join(" · "))}</small></span>
          </header>
          <div class="hof-tile-view" data-view="${esc(item.id)}"><div class="hof-tile-loading">${icon(item.kind)}</div></div>
          <footer>
            ${item.viewable ? `<button type="button" class="hof-mini" data-tile-open="${esc(item.id)}" title="Büyüt" aria-label="${esc(item.name)} büyüt">${EYE}</button>` : ""}
            ${printable(item) ? `<button type="button" class="hof-mini" data-tile-print="${esc(item.id)}" title="Yazdır" aria-label="${esc(item.name)} yazdır">${PRINT}</button>` : `<span class="hof-mini is-off" title="Tarayıcıda yazdırılamaz; indirip kendi programında yazdırın" aria-hidden="true">${PRINT}</span>`}
            <a class="hof-mini" href="${fileUrl(item.id, true)}" download title="İndir (${esc(extOf(item.name).toUpperCase())})" aria-label="${esc(item.name)} indir">${DOWN}</a>
            ${item.canDelete ? `<button type="button" class="hof-mini hof-mini-danger" data-tile-delete="${esc(item.id)}" title="Belgeyi sil" aria-label="${esc(item.name)} belgesini sil">${TRASH}</button>` : ""}
          </footer>
        </article>`)
        .join("");
      // Önizlemeler görünür oldukça yüklenir (çok belgede kart hızlı açılır).
      observer?.disconnect();
      observer = new IntersectionObserver(
        entries => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            observer.unobserve(entry.target);
            const item = documents.find(doc => doc.id === entry.target.dataset.view);
            if (item) entry.target.innerHTML = tileView(item);
          }
        },
        { root: modal.dialog.querySelector(".hof-modal-body") || null, rootMargin: "300px" },
      );
      for (const view of grid.querySelectorAll("[data-view]")) observer.observe(view);
      sync();
    };
    const sync = () => {
      const count = picked.size;
      modal.dialog.querySelector("[data-count]").textContent = count ? `${count} belge seçili` : "Belge seçin ya da tek tek indirin/yazdırın";
      const all = modal.dialog.querySelector("[data-pick-all]");
      all.checked = count > 0 && count === documents.length;
      all.indeterminate = count > 0 && count < documents.length;
      modal.dialog.querySelector("[data-bulk-download]").disabled = !count;
      modal.dialog.querySelector("[data-bulk-download] span").textContent = count > 1 ? `İndir (.zip, ${count})` : "İndir";
      modal.dialog.querySelector("[data-bulk-print]").disabled = !documents.some(item => picked.has(item.id) && printable(item));
      for (const tile of grid.querySelectorAll("[data-tile]")) tile.classList.toggle("is-picked", picked.has(tile.dataset.tile));
    };
    modal.dialog.addEventListener("change", event => {
      const box = event.target.closest("[data-pick]");
      if (box) {
        if (box.checked) picked.add(box.dataset.pick);
        else picked.delete(box.dataset.pick);
        sync();
      } else if (event.target.closest("[data-pick-all]")) {
        const on = event.target.checked;
        picked.clear();
        if (on) for (const item of documents) picked.add(item.id);
        for (const input of grid.querySelectorAll("[data-pick]")) input.checked = on;
        sync();
      }
    });
    modal.dialog.addEventListener("click", async event => {
      const target = event.target.closest("[data-cols], [data-bulk-download], [data-bulk-print], [data-tile-open], [data-tile-print], [data-tile-delete], [data-queue-next], [data-queue-stop]");
      if (!target) return;
      if (target.dataset.cols) {
        const value = Number(target.dataset.cols);
        grid.style.setProperty("--cols", value);
        grid.dataset.layout = String(value);
        for (const button of modal.dialog.querySelectorAll("[data-cols]")) button.setAttribute("aria-pressed", String(button === target));
        try {
          localStorage.setItem(COLS_KEY, String(value));
        } catch {
          /* tercih hatırlanamaz; sorun değil */
        }
      } else if (target.hasAttribute("data-bulk-download")) {
        const ids = documents.filter(item => picked.has(item.id)).map(item => item.id);
        if (ids.length === 1) clickDownload(fileUrl(ids[0], true));
        else if (ids.length) clickDownload(`${listUrl(key)}/archive?ids=${encodeURIComponent(ids.join(","))}`);
      } else if (target.hasAttribute("data-bulk-print")) {
        printDocuments(documents.filter(item => picked.has(item.id)));
      } else if (target.dataset.tileOpen) preview(target.dataset.tileOpen);
      else if (target.dataset.tilePrint) printDocuments(documents.filter(item => item.id === target.dataset.tilePrint));
      else if (target.dataset.tileDelete) remove(target.dataset.tileDelete);
      else if (target.hasAttribute("data-queue-next")) {
        const item = printQueue.shift();
        showQueue();
        if (item) await printPdf(item);
      } else if (target.hasAttribute("data-queue-stop")) {
        printQueue = [];
        showQueue();
      }
    });
    activeGallery = { refresh: () => signature !== documents.map(item => item.id).join(",") && draw() };
    draw();
    if (focusId) {
      const tile = grid.querySelector(`[data-tile="${CSS.escape(focusId)}"]`);
      if (tile) {
        tile.classList.add("is-focus");
        requestAnimationFrame(() => tile.scrollIntoView({ block: "nearest" }));
      }
    }
  }

  async function remove(id) {
    const item = documents.find(entry => entry.id === id);
    if (!item) return false;
    const ok = await HOF.confirm({ title: "Belgeyi Sil", message: `“${item.name}” bu kayıttan kaldırılacak. Hemen “Geri al” ile, 30 gün içinde de Yönetim → Silinenler'den geri getirilebilir.`, confirmLabel: "Belgeyi Sil", danger: true });
    if (!ok) return false;
    try {
      await HOF.api(`/api/workspace/documents/${encodeURIComponent(id)}`, { method: "DELETE" });
      documents = documents.filter(entry => entry.id !== id);
      render();
      HOF.toast(`“${item.name}” silindi.`, {
        type: "success",
        action: {
          label: "Geri Al",
          onClick: async () => {
            try {
              await HOF.api(`/api/workspace/documents/${encodeURIComponent(id)}/restore`, { method: "POST" });
              load(true);
            } catch (error) {
              HOF.toastError(error);
            }
          },
        },
      });
      return true;
    } catch (error) {
      HOF.toastError(error);
      return false;
    }
  }

  function onClick(event) {
    const target = event.target.closest("[data-doc-add], [data-doc-view], [data-doc-delete], [data-doc-gallery], [data-doc-print]");
    if (!target) return;
    event.preventDefault();
    if (target.hasAttribute("data-doc-add")) openAdd();
    else if (target.hasAttribute("data-doc-gallery")) gallery(target.dataset.docGallery || "");
    else if (target.dataset.docView) preview(target.dataset.docView);
    else if (target.dataset.docPrint) printDocuments(documents.filter(item => item.id === target.dataset.docPrint));
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
  HOF.documents = { open: openAdd, upload, reload: () => load(true), gallery, print: printDocuments };
})();
