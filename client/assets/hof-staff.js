/* DestekOfis — Personel Özlük (2.4.4; kullanıcı kararı 21.10.2026). Personel Raporu penceresi: üstte Toplam Maaş / Kayıtlı Personel / Aktif Çalışan /
 * Ayrılan Personel; "Çalışanlar" ve "Ayrılanlar" sekmeleri, arama (yazınca süzülür), "+ Yeni Personel"; satıra tıklayınca çalışan kartı (yalnız
 * "Personel Özeti" görünümü; Evrak Listesi, Maaş Bordrosu, CV, İletişim sekmeleri YOK). İşten Ayrılış Tarihi yazılan kart Ayrılanlar'a geçer, tarih silinince
 * Çalışanlar'a döner. Yaş Doğum Tarihi'nden sunucuda hesaplanır. Yetki: staff.view (görüntüleme) / staff.manage (düzenleme) — varsayılan yalnız yönetici.
 * Performans özeti (reports.view) aynı pencerede "Performans Özeti" sekmesidir. Sunucu: server/routes/staff.mjs. */
(() => {
  "use strict";
  const HOF = window.HOF;
  const { esc } = HOF;
  const STAFF = "/api/workspace/staff";
  const EDUCATION = ["İlkokul", "Ortaokul", "Lise", "Ön Lisans", "Lisans", "Yüksek Lisans", "Doktora"];
  const view = { tab: "active", q: "", data: null, modal: null, performance: null };
  const money = minor => HOF.formatMoney((Number(minor) || 0) / 100);
  const moneyInput = minor => (Number(minor) ? new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(minor) / 100) : "");
  const day = iso => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "—");
  const ibanText = value => String(value || "").replace(/(.{4})/g, "$1 ").trim();
  // 31f U10: Türkçe harf duyarsız arama ("ayse" → "Ayşe") — programın ortak katlaması.
  const fold = value => HOF.fold(value);
  const digits = value => String(value ?? "").replace(/\D+/g, "");
  const canManage = () => HOF.can("staff.manage");

  const matches = (item, q) => {
    if (!q) return true;
    const text = fold(q);
    const number = digits(q);
    if ([item.fullName, item.position, item.specialty, item.email, item.bankName, item.education].some(value => fold(value).includes(text))) return true;
    return number.length >= 3 && [item.phone, item.tcNo, item.iban].some(value => digits(value).includes(number));
  };

  function kpisHtml(totals) {
    return `<div class="hof-kpis hof-staff-kpis" data-staff-kpis>
      <div data-kpi="salary" title="Aktif çalışanların aylık maaşlarının toplamı (ayrılanlar sayılmaz)."><strong>${esc(money(totals.salaryMinor))}</strong><span>Toplam Maaş</span></div>
      <div data-kpi="registered"><strong>${totals.registered}</strong><span>Kayıtlı Personel</span></div>
      <div data-kpi="active"><strong>${totals.active}</strong><span>Aktif Çalışan</span></div>
      <div data-kpi="left"><strong>${totals.left}</strong><span>Ayrılan Personel</span></div>
    </div>`;
  }

  function tabsHtml(totals) {
    const tab = (id, label, count = null) => `<button type="button" role="tab" class="hof-rep-chip ${view.tab === id ? "is-on" : ""}" aria-selected="${view.tab === id}" data-staff-tab="${id}">${esc(label)}${count === null ? "" : ` <b>${count.toLocaleString("tr-TR")}</b>`}</button>`;
    return `<div class="hof-staff-tabs" role="tablist" aria-label="Personel Raporu Bölümleri">${tab("active", "Çalışanlar", totals.active)}${tab("left", "Ayrılanlar", totals.left)}${view.performance ? tab("performance", "Performans Özeti") : ""}</div>`;
  }

  function tableHtml() {
    const left = view.tab === "left";
    const all = (view.data?.items || []).filter(item => item.status === (left ? "left" : "active"));
    const rows = all.filter(item => matches(item, view.q));
    const head = `<tr><th>Ad Soyad</th><th>Görevi</th><th class="num">Yaş</th><th>Telefon</th><th>İşe Giriş Tarihi</th>${left ? "<th>İşten Ayrılış Tarihi</th>" : ""}<th class="num">Kullanılan İzinler</th><th class="num">Maaş</th></tr>`;
    const body = rows
      .map(item => `<tr data-staff-id="${esc(item.id)}" tabindex="0" class="hof-staff-row"><td><b>${esc(item.fullName)}</b>${item.hasPhoto ? ' <small class="hof-staff-photo-mark" title="Fotoğraf var">▣</small>' : ""}${item.leaving ? ` <span class="hof-chip hof-chip-high" data-staff-leaving title="Ayrılış günü gelince Ayrılanlar'a geçer.">Ayrılacak · ${esc(day(item.leaveDate))}</span>` : ""}</td><td>${esc(item.position || "—")}</td><td class="num">${item.age ?? "—"}</td><td>${esc(item.phone || "—")}</td><td>${esc(day(item.hireDate))}</td>${left ? `<td>${esc(day(item.leaveDate))}</td>` : ""}<td class="num">${item.usedLeaveDays ? `${item.usedLeaveDays} Gün` : "—"}</td><td class="num">${item.salaryMinor ? esc(money(item.salaryMinor)) : "—"}</td></tr>`)
      .join("");
    const span = left ? 8 : 7;
    const empty = !all.length && !view.q
      ? left
        ? "Ayrılan personel yok. Bir çalışanın kartına İşten Ayrılış Tarihi yazılınca (ileri tarihliyse o gün gelince) burada görünür."
        : `Henüz çalışan kartı yok.${canManage() ? " + Yeni Personel ile ekleyin." : ""}`
      : "Aramaya uyan personel yok.";
    // 31f U10: bu sekmede sonuç yokken öbür sekmede (Çalışanlar / Ayrılanlar) varsa söylenir ve oraya geçilir (arama korunur).
    const otherTab = left ? "active" : "left";
    const otherHits = view.q && !rows.length ? (view.data?.items || []).filter(item => item.status === otherTab && matches(item, view.q)).length : 0;
    const otherName = otherTab === "left" ? "Ayrılanlar" : "Çalışanlar";
    const otherHtml = otherHits ? ` <span data-staff-other>${esc(`${otherName}'da ${otherHits.toLocaleString("tr-TR")} sonuç var.`)} <button type="button" class="hof-link-button" data-staff-goto="${otherTab}">${esc(`${otherName}'a Geç`)}</button></span>` : "";
    const total = rows.reduce((sum, item) => sum + (Number(item.salaryMinor) || 0), 0);
    const foot = rows.length ? `<tfoot><tr class="hof-staff-total"><td colspan="${span - 1}"><b>TOPLAM</b> · ${rows.length.toLocaleString("tr-TR")} Personel</td><td class="num"><b>${esc(money(total))}</b></td></tr></tfoot>` : "";
    return `<div class="hof-staff-table" style="overflow:auto"><table class="hof-table"><thead>${head}</thead><tbody>${body || `<tr><td colspan="${span}" class="hof-empty" data-staff-empty>${esc(empty)}${otherHtml}</td></tr>`}</tbody>${foot}</table></div>`;
  }

  function toolbarHtml() {
    return `<div class="hof-staff-bar"><input type="search" class="hof-staff-search" data-q aria-label="Personel Ara" placeholder="Ad, görev, telefon ya da TC No ile arayın" value="${esc(view.q)}">${canManage() ? '<button type="button" class="hof-button" data-staff-act="new" data-requires="staff.manage">+ Yeni Personel</button>' : ""}</div>`;
  }

  async function renderBody() {
    const root = view.modal?.dialog.querySelector("[data-staff]");
    if (!root || !view.data) return;
    const totals = view.data.totals;
    root.querySelector("[data-staff-head]").innerHTML = `${kpisHtml(totals)}${tabsHtml(totals)}`;
    const content = root.querySelector("[data-staff-content]");
    if (view.tab === "performance") {
      content.innerHTML = '<p class="hof-empty">Yükleniyor…</p>';
      try {
        content.innerHTML = await view.performance();
      } catch (error) {
        content.innerHTML = `<p class="hof-empty">${esc(error.message || "Performans özeti okunamadı.")}</p>`;
      }
      return;
    }
    // Arama kutusu yeniden çizilmez (odak ve imleç yerinde kalır); yalnız tablo yenilenir.
    if (!content.querySelector("[data-q]")) content.innerHTML = `${toolbarHtml()}<div data-staff-list></div>`;
    content.querySelector("[data-staff-list]").innerHTML = tableHtml();
  }

  async function load({ quiet = false } = {}) {
    try {
      view.data = await HOF.api(STAFF);
    } catch (error) {
      if (!quiet) HOF.toastError(error);
      return false;
    }
    await renderBody();
    return true;
  }

  async function open({ performance = null } = {}) {
    view.performance = performance;
    view.q = "";
    if (view.tab === "performance" && !performance) view.tab = "active";
    try {
      view.data = await HOF.api(STAFF);
    } catch (error) {
      HOF.toastError(error);
      return;
    }
    view.modal = HOF.modal({
      title: "Personel Raporu",
      eyebrow: "PERSONEL",
      size: "wide",
      body: '<div class="hof-staff" data-staff><div data-staff-head></div><div data-staff-content></div></div>',
      onClose: () => {
        view.modal = null;
      },
      onOpen: modal => {
        modal.dialog.classList.add("hof-staff-modal");
        modal.dialog.addEventListener("click", event => {
          const tab = event.target.closest("[data-staff-tab], [data-staff-goto]");
          if (tab) {
            view.tab = tab.dataset.staffTab || tab.dataset.staffGoto;
            const content = modal.dialog.querySelector("[data-staff-content]");
            if (view.tab === "performance") content.innerHTML = "";
            else if (!content.querySelector("[data-q]")) content.innerHTML = "";
            // "…'a Geç" düğmesi yeniden çizimle kalkar; odak arama kutusuna (BODY'ye düşmez).
            renderBody().then(() => tab.dataset.staffGoto && modal.dialog.querySelector("[data-q]")?.focus());
            return;
          }
          if (event.target.closest('[data-staff-act="new"]')) return void openForm(null);
          const row = event.target.closest("tr[data-staff-id]");
          if (row) openCard(row.dataset.staffId);
        });
        modal.dialog.addEventListener("keydown", event => {
          const row = event.target.closest?.("tr[data-staff-id]");
          if (row && event.key === "Enter") {
            event.preventDefault();
            openCard(row.dataset.staffId);
          }
        });
        modal.dialog.addEventListener("input", event => {
          if (!event.target.matches("[data-q]")) return;
          view.q = event.target.value;
          const list = modal.dialog.querySelector("[data-staff-list]");
          if (list) list.innerHTML = tableHtml();
        });
      },
    });
    await renderBody();
  }

  // ---------- Çalışan kartı: yalnız Personel Özeti ----------
  function summaryHtml(item) {
    const row = (label, value, key) => `<div class="hof-staff-field" data-field="${key}"><dt>${esc(label)}</dt><dd>${value ? esc(value) : "—"}</dd></div>`;
    // Durum sunucudan (routes/staff.mjs staffStatus): ileri tarihli ayrılışta çalışan "Ayrılacak" işaretiyle Çalışanlar'dadır.
    const status = item.status === "left" ? `<span class="hof-chip hof-chip-urgent">Ayrıldı · ${esc(day(item.leaveDate))}</span>` : item.leaving ? `<span class="hof-chip hof-chip-high" data-staff-leaving>Ayrılacak · ${esc(day(item.leaveDate))}</span>` : '<span class="hof-chip hof-chip-accent">Aktif Çalışan</span>';
    const photo = item.photo ? `<img class="hof-staff-photo" src="${esc(item.photo)}" alt="${esc(item.fullName)} fotoğrafı">` : `<div class="hof-staff-photo is-empty" aria-hidden="true">${esc((item.fullName || "?").trim().charAt(0).toLocaleUpperCase("tr-TR"))}</div>`;
    return `<div class="hof-staff-card" data-staff-card="${esc(item.id)}">
      <header class="hof-staff-card-head">${photo}<div><h3>${esc(item.fullName)}</h3><p>${esc(item.position || "Görevi yazılmadı")}</p>${status}</div></header>
      <dl class="hof-staff-grid">
        ${row("Ad Soyad", item.fullName, "fullName")}
        ${row("Yaş", item.age === null || item.age === undefined ? "" : `${item.age} (Doğum Tarihi ${day(item.birthDate)})`, "age")}
        ${row("TC No", item.tcNo, "tcNo")}
        ${row("Görevi", item.position, "position")}
        ${row("Maaş", item.salaryMinor ? money(item.salaryMinor) : "", "salary")}
        ${row("Banka Adı", item.bankName, "bankName")}
        ${row("IBAN", ibanText(item.iban), "iban")}
        ${row("İşe Giriş Tarihi", item.hireDate ? day(item.hireDate) : "", "hireDate")}
        ${row("İşten Ayrılış Tarihi", item.leaveDate ? day(item.leaveDate) : "", "leaveDate")}
        ${row("Kullanılan İzinler", item.usedLeaveDays ? `${item.usedLeaveDays} Gün` : "", "usedLeaveDays")}
        ${row("Kişisel E-Posta", item.email, "email")}
        ${row("Telefon", item.phone, "phone")}
        ${row("Öğrenim Durumu", item.education, "education")}
        ${row("Uzmanlık Alanı", item.specialty, "specialty")}
        ${row("Adres", item.address, "address")}
      </dl>
      <div class="hof-actions">${canManage() ? '<button type="button" class="hof-button hof-button-ghost hof-button-danger-ghost" data-staff-card-act="delete" data-requires="staff.manage">Sil</button><button type="button" class="hof-button" data-staff-card-act="edit" data-requires="staff.manage">Düzenle</button>' : ""}<button type="button" class="hof-button hof-button-ghost" data-staff-card-act="close">Kapat</button></div>
    </div>`;
  }

  async function openCard(id) {
    let item;
    try {
      item = await HOF.api(`${STAFF}/${encodeURIComponent(id)}`);
    } catch (error) {
      HOF.toastError(error);
      load({ quiet: true });
      return;
    }
    HOF.modal({
      title: item.fullName,
      eyebrow: "PERSONEL ÖZETİ",
      size: "wide",
      body: summaryHtml(item),
      onOpen: modal => {
        modal.dialog.classList.add("hof-staff-card-modal");
        modal.dialog.addEventListener("click", async event => {
          const act = event.target.closest("[data-staff-card-act]")?.dataset.staffCardAct;
          if (act === "close") modal.close();
          else if (act === "edit") {
            modal.close();
            openForm(item);
          } else if (act === "delete") {
            const yes = await HOF.confirm({ title: "Personel Kartı Silinsin mi?", message: `${item.fullName} kartı ve bütün bilgileri (TC No, IBAN, maaş, fotoğraf) kalıcı olarak silinir; geri alınamaz. Yalnız işten ayrılan çalışan için kartı silmeyin, İşten Ayrılış Tarihi yazın.`, confirmLabel: "Kartı Sil", danger: true });
            if (!yes) return;
            try {
              await HOF.api(`${STAFF}/${encodeURIComponent(item.id)}`, { method: "DELETE" });
              modal.close();
              HOF.toast("Personel kartı silindi.", { type: "success" });
              load({ quiet: true });
            } catch (error) {
              HOF.toastError(error);
            }
          }
        });
      },
    });
  }

  // ---------- Ekle / Düzenle ----------
  async function imageToJpeg(file, { maxSide = 400, maxBytes = 100 * 1024 } = {}) {
    const image = await new Promise((resolve, reject) => {
      const node = new Image();
      node.onload = () => resolve(node);
      node.onerror = () => reject(new Error("Resim okunamadı; PNG ya da JPEG seçin."));
      node.src = URL.createObjectURL(file);
    });
    try {
      for (const side of [maxSide, 300, 200]) {
        const scale = Math.min(1, side / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        for (const quality of [0.86, 0.72, 0.58]) {
          const url = canvas.toDataURL("image/jpeg", quality);
          if (Math.ceil(((url.length - url.indexOf(",") - 1) * 3) / 4) <= maxBytes) return url;
        }
      }
      throw new Error("Fotoğraf 100 KB altına indirilemedi; daha küçük bir resim seçin.");
    } finally {
      URL.revokeObjectURL(image.src);
    }
  }

  // Formun alan değerleri tek yerden: açılışta ve eşzamanlı düzenlemede (409 staff-stale) güncel kartla.
  const formValues = item => ({
    fullName: item?.fullName || "", birthDate: item?.birthDate || "", tcNo: item?.tcNo || "", position: item?.position || "", salary: moneyInput(item?.salaryMinor),
    bankName: item?.bankName || "", iban: ibanText(item?.iban), hireDate: item?.hireDate || "", leaveDate: item?.leaveDate || "",
    usedLeaveDays: item?.usedLeaveDays ? String(item.usedLeaveDays) : "", email: item?.email || "", phone: item?.phone || "", education: item?.education || "",
    specialty: item?.specialty || "", address: item?.address || "",
  });
  // 2.4.4 (eleştirmen E5; cari formundaki 2.4.3 UX1 kalıbı, hof-accounts.js refreshUntouched): güncel kart forma basılır — kullanıcının DEĞİŞTİRDİĞİ alan
  // (dokunulmuş ve kayıtlı değerden farklı) korunur, öbürleri güncel değeri alır; "kayıtlı değer" de güncellenir (kapatırken soru doğru kalır).
  function refreshUntouched(dialog, fresh) {
    for (const node of dialog.querySelectorAll("input[name], textarea[name], select[name]")) {
      if (node.type === "hidden" || node.type === "file" || !(node.name in fresh)) continue;
      const next = fresh[node.name];
      if (node.tagName === "SELECT") {
        const saved = ([...node.options].find(option => option.defaultSelected) || node.options[0])?.value ?? "";
        const edited = HOF.isTouched?.(node) && node.value !== saved;
        if (![...node.options].some(option => option.value === next)) continue;
        for (const option of node.options) option.defaultSelected = option.value === next;
        if (!edited) node.value = next;
        continue;
      }
      const edited = HOF.isTouched?.(node) && node.value !== node.defaultValue;
      const typed = node.value;
      node.defaultValue = next;
      node.value = edited ? typed : next;
    }
  }

  function openForm(item) {
    const editing = Boolean(item);
    // current: formun dayandığı kart sürümü (updatedAt kayıtla gider); 409'dan sonra güncel kart olur, sonraki Kaydet yeni sürümle gider.
    let current = item;
    let photo = editing ? item.photo || "" : "";
    let savedPhoto = photo;
    let paint = () => {};
    const photoBox = () => (photo ? `<img class="hof-staff-photo" src="${esc(photo)}" alt="Fotoğraf">` : '<div class="hof-staff-photo is-empty" aria-hidden="true">?</div>');
    const values = formValues(item);
    const fields = [
      { name: "fullName", label: "Ad Soyad", required: true, value: values.fullName, maxlength: 120, autofocus: true },
      { name: "birthDate", label: "Doğum Tarihi", type: "date", value: values.birthDate, max: "today", help: "Yaş buradan hesaplanır." },
      { name: "tcNo", label: "TC No", value: values.tcNo, maxlength: 11, inputmode: "numeric", placeholder: "11 hane" },
      { name: "position", label: "Görevi", value: values.position, maxlength: 120 },
      { name: "salary", label: "Maaş", value: values.salary, inputmode: "decimal", placeholder: "0,00", help: "Aylık maaş; yalnız bilgi içindir, Kasa'ya ve Banka'ya yazılmaz." },
      { name: "bankName", label: "Banka Adı", value: values.bankName, maxlength: 120 },
      { name: "iban", label: "IBAN", value: values.iban, maxlength: 34, placeholder: "TR00 0000 0000 0000 0000 0000 00" },
      { name: "hireDate", label: "İşe Giriş Tarihi", type: "date", value: values.hireDate },
      { name: "leaveDate", label: "İşten Ayrılış Tarihi", type: "date", value: values.leaveDate, help: "Bugün ya da geçmiş tarih yazılınca kart Ayrılanlar'a geçer; ileri tarihte o güne kadar Çalışanlar'da \"Ayrılacak\" görünür; silinince Çalışanlar'a döner." },
      { name: "usedLeaveDays", label: "Kullanılan İzinler", value: values.usedLeaveDays, inputmode: "numeric", placeholder: "Gün", help: "Kullanılan izin gün sayısı." },
      { name: "email", label: "Kişisel E-Posta", type: "email", value: values.email, maxlength: 200 },
      { name: "phone", label: "Telefon", type: "tel", value: values.phone, maxlength: 40 },
      { name: "education", label: "Öğrenim Durumu", type: "select", value: values.education, options: [{ value: "", label: "— Seçin —" }, ...EDUCATION.map(value => ({ value, label: value }))] },
      { name: "specialty", label: "Uzmanlık Alanı", value: values.specialty, maxlength: 200 },
      { name: "address", label: "Adres", type: "textarea", rows: 2, value: values.address, maxlength: 500 },
    ];
    HOF.formModal({
      title: editing ? "Personel Kartını Düzenle" : "Yeni Personel",
      eyebrow: "PERSONEL ÖZLÜK",
      size: "wide",
      intro: "Yalnız Ad Soyad zorunludur; öbür bilgileri istediğiniz zaman ekleyip düzeltebilirsiniz. Bu bilgiler kişisel veridir; yalnız yetkili kişiler görür.",
      fields,
      extraHtml: `<div class="hof-field hof-staff-photo-field"><span>Fotoğraf</span><div class="hof-staff-photo-row"><div data-staff-photo-preview>${photoBox()}</div><div class="hof-staff-photo-tools"><label class="hof-button hof-button-small hof-button-ghost">Fotoğraf Seç<input type="file" accept="image/*" data-staff-photo-file hidden></label><button type="button" class="hof-button hof-button-small hof-button-ghost" data-staff-photo-clear ${photo ? "" : "hidden"}>Fotoğrafı Kaldır</button><small>PNG ya da JPEG; program küçültüp JPEG'e çevirir.</small></div></div></div>`,
      submitLabel: editing ? "Değişiklikleri Kaydet" : "Personeli Kaydet",
      onOpen: dialog => {
        dialog.classList.add("hof-staff-form");
        paint = () => {
          dialog.querySelector("[data-staff-photo-preview]").innerHTML = photoBox();
          dialog.querySelector("[data-staff-photo-clear]").hidden = !photo;
        };
        dialog.querySelector("[data-staff-photo-file]").addEventListener("change", async event => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          try {
            photo = await imageToJpeg(file);
            paint();
          } catch (error) {
            HOF.toast(error.message || "Resim okunamadı.", { type: "error" });
          }
        });
        dialog.querySelector("[data-staff-photo-clear]").addEventListener("click", () => {
          photo = "";
          paint();
        });
      },
      onSubmit: async (data, modal) => {
        const body = { ...data, photo, ...(editing ? { updatedAt: current.updatedAt || "" } : {}) };
        let saved;
        try {
          saved = editing ? await HOF.api(`${STAFF}/${encodeURIComponent(item.id)}`, { method: "PUT", body }) : await HOF.api(STAFF, { method: "POST", body });
        } catch (error) {
          const code = error?.data?.code;
          if (!editing || (code !== "staff-stale" && code !== "staff-missing")) throw error;
          // Silinmiş kart: sunucunun iletisi formda kalır (yazılanlar kaybolmaz), liste yenilenir.
          load({ quiet: true });
          if (code === "staff-missing") throw error;
          // 2.4.4 (eleştirmen E5): kartı bu form açıldıktan sonra başka biri kaydetti. Güncel kart yüklenir; değiştirdiğiniz alanlar (fotoğraf dahil)
          // formda kalır, öbürleri güncel değeri alır; sonraki Kaydet yeni sürümle gider (öbür kişinin değişikliği sessizce geri alınmaz).
          const fresh = await HOF.api(`${STAFF}/${encodeURIComponent(item.id)}`);
          refreshUntouched(modal.dialog, formValues(fresh));
          if (photo === savedPhoto) photo = fresh.photo || "";
          savedPhoto = fresh.photo || "";
          paint();
          current = fresh;
          throw new Error("Bu personel kartını siz açtıktan sonra başka biri değiştirdi; güncel hâli yüklendi. Değiştirdiğiniz alanlar formda duruyor; kontrol edip yeniden kaydedin.");
        }
        const moved = editing ? saved.moved : saved.status === "left" ? "left" : saved.leaving ? "leaving" : "";
        if (moved === "left") HOF.toast(`${saved.fullName} Ayrılanlar'a geçti.`, { type: "success" });
        else if (moved === "leaving") HOF.toast(`${saved.fullName} ${day(saved.leaveDate)} tarihine kadar Çalışanlar'da kalır ("Ayrılacak"); o gün Ayrılanlar'a geçer.`, { type: "success" });
        else if (moved === "active") HOF.toast(`${saved.fullName} Çalışanlar'a döndü.`, { type: "success" });
        else HOF.toast(editing ? (saved.changed?.length ? "Personel kartı güncellendi." : "Değişiklik yok.") : "Personel kartı eklendi.", { type: "success" });
        await load({ quiet: true });
      },
    });
  }

  HOF.whenReady?.(() => {
    // Başka bilgisayarda yapılan değişiklik (yalnız yetkililere, değersiz olay): açık pencere listeyi yeniden okur.
    // Gün dönümü (sunucunun alerts.refresh olayı): ayrılış günü gelen çalışan açık pencerede de Ayrılanlar'a geçsin.
    HOF.on("live:alerts.refresh", () => {
      if (view.modal) load({ quiet: true });
    });
    HOF.on("live:workspace.changed", change => {
      if (change?.kind === "staff" && view.modal) load({ quiet: true });
    });
  });

  HOF.staff = { open, reload: load };
})();
