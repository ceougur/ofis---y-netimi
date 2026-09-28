/* DestekOfis — operasyon merkezi: kenar çubuğu kartı, kullanıcı menüsü, dosya işlemleri ve işlem geçmişi. */
(() => {
  "use strict";
  const HOF = window.HOF;
  const { esc } = HOF;
  let users = [];
  let activityKey = "";
  let activityRequest = 0;

  const loadUsers = async () => {
    try {
      users = await HOF.api("/api/workspace/users");
    } catch {
      users = [];
    }
    return users;
  };
  const userNames = () => users.map(user => user.name);
  const priorityLabel = { normal: "Normal", high: "Yüksek", urgent: "Acil" };

  // Türk cep telefonlarını wa.me biçimine çevirir (90XXXXXXXXXX).
  const extractPhones = text => {
    const matches = String(text || "").match(/(?:\+?90[\s().-]*)?(?:0?5\d{2}|5\d{2})[\s().-]*\d{3}[\s().-]*\d{2}[\s().-]*\d{2}/g) || [];
    return [...new Set(matches.map(value => {
      const digits = value.replace(/\D/g, "");
      return digits.startsWith("90") ? digits : digits.startsWith("0") ? `9${digits}` : `90${digits}`;
    }).filter(value => value.length === 12))];
  };
  const openWhatsApp = number => window.open(`https://wa.me/${number}`, "_blank", "noopener");

  const requireCase = () => {
    const selected = HOF.selectedCase();
    if (!selected) HOF.toast(`Önce tablodan bir ${HOF.vocab.record} seçin.`, { type: "error" });
    return selected;
  };
  const caseUrl = (key, suffix) => `/api/workspace/cases/${encodeURIComponent(key)}/${suffix}`;
  const afterCaseChange = () => {
    activityKey = "";
    renderActivity();
    HOF.emit("case-activity");
  };

  // ---------- Dosya işlem pencereleri ----------
  const actions = {
    note() {
      const selected = requireCase();
      if (!selected) return;
      HOF.formModal({
        title: "Not ekle",
        eyebrow: selected.title,
        fields: [{ name: "note", label: "Not", type: "textarea", required: true, maxlength: 5000, placeholder: "Yapılan son işlemi yazın…" }],
        submitLabel: "Notu kaydet",
        onSubmit: async data => {
          await HOF.api(caseUrl(selected.key, "notes"), { method: "POST", body: data });
          HOF.toast("Not kaydedildi.", { type: "success" });
          afterCaseChange();
        },
      });
    },
    phone() {
      const selected = requireCase();
      if (!selected) return;
      HOF.formModal({
        title: "Telefon bilgisi ekle",
        eyebrow: selected.title,
        fields: [
          { name: "phone", label: "Telefon", type: "tel", required: true, inputmode: "tel", placeholder: "05xx xxx xx xx" },
          { name: "label", label: "Etiket", placeholder: "Cep / iş / vekil", list: ["Cep", "İş", "Ev", "Vekil", "Yakını"] },
        ],
        submitLabel: "Telefonu kaydet",
        onSubmit: async data => {
          await HOF.api(caseUrl(selected.key, "phones"), { method: "POST", body: data });
          HOF.toast("Telefon bilgisi kaydedildi.", { type: "success" });
          afterCaseChange();
        },
      });
    },
    // target: kayan ödeme şeridinden ya da bildirimden gelinince { key, title, amount, note } (kayıt seçili olmasa da).
    payment(target) {
      const selected = target && target.key ? target : requireCase();
      if (!selected) return;
      const suggested = target && Number(target.amount) > 0 ? new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(target.amount) : "";
      HOF.formModal({
        title: "Tahsilat işle",
        eyebrow: selected.title,
        intro: target && target.intro ? target.intro : "",
        fields: [
          { name: "amount", label: "Tutar (₺)", required: true, inputmode: "decimal", placeholder: "Örn. 1.250,00", value: suggested },
          { name: "date", label: "Tahsilat tarihi", type: "date", value: new Date().toISOString().slice(0, 10) },
          { name: "note", label: "Açıklama", placeholder: "Ödeme kanalı veya açıklama", maxlength: 500, value: (target && target.note) || "" },
        ],
        submitLabel: "Tahsilatı kaydet",
        onSubmit: async data => {
          await HOF.api(caseUrl(selected.key, "payments"), { method: "POST", body: { ...data, caseTitle: selected.title } });
          HOF.toast("Tahsilat kaydedildi. Kasaya tahsilat olarak işlendi.", { type: "success" });
          afterCaseChange();
          HOF.emit("payment-saved", { key: selected.key });
        },
      });
    },
    lien() {
      const selected = requireCase();
      if (!selected) return;
      HOF.formModal({
        title: "Haciz kaydı",
        eyebrow: selected.title,
        intro: "Sistem haczin bir yıl sonraki düşüm tarihini hesaplar ve son 7 gün kala uyarır.",
        fields: [
          { name: "title", label: "Haciz başlığı", required: true, list: ["Araç haczi", "Taşınmaz haczi", "Banka haczi", "Maaş haczi", "Menkul haczi"] },
          { name: "placedAt", label: "Konulduğu tarih", type: "date", required: true },
        ],
        submitLabel: "Haczi kaydet",
        onSubmit: async data => {
          const result = await HOF.api(caseUrl(selected.key, "liens"), { method: "POST", body: data });
          HOF.toast(`Haciz kaydedildi. Düşüm tarihi: ${HOF.formatDate(result.expiresAt)}`, { type: "success" });
          afterCaseChange();
        },
      });
    },
    async task() {
      if (!HOF.can("tasks.create")) {
        HOF.toast(`Görev atama yalnızca yönetici ve ${HOF.roleLabels.avukat.toLocaleLowerCase("tr-TR")} hesaplarında kullanılabilir.`, { type: "error" });
        return;
      }
      const selected = HOF.selectedCase();
      await loadUsers();
      HOF.formModal({
        title: "Görev ata",
        eyebrow: selected ? selected.title : "OPERASYON",
        fields: [
          { name: "title", label: "Görev", required: true, maxlength: 300, placeholder: HOF.modules.haciz ? "Örn. haciz yenileme evrakını kontrol et" : "Örn. eksik belgeleri tamamla ve bilgi ver" },
          { name: "assignee", label: "Atanacak kişi", list: userNames(), value: HOF.user.name, placeholder: "Personel adı" },
          { name: "dueDate", label: "Son tarih", type: "date" },
          { name: "priority", label: "Öncelik", type: "select", value: "normal", options: [{ value: "normal", label: "Normal" }, { value: "high", label: "Yüksek" }, { value: "urgent", label: "Acil" }] },
          ...(selected ? [{ name: "linkCase", label: `Görevi "${selected.title}" kaydına bağla`, type: "checkbox", value: true }] : []),
        ],
        submitLabel: "Görevi ata",
        onSubmit: async data => {
          const body = { title: data.title, assignee: data.assignee, dueDate: data.dueDate, priority: data.priority, caseKey: selected && data.linkCase ? selected.key : "" };
          await HOF.api("/api/workspace/tasks", { method: "POST", body });
          HOF.toast("Görev atandı.", { type: "success" });
          refreshBadges();
          if (body.caseKey) afterCaseChange();
        },
      });
    },
    whatsapp() {
      const selected = requireCase();
      if (!selected) return;
      const number = extractPhones(selected.panel.innerText)[0];
      if (!number) return HOF.toast("Bu kayıtta cep telefonu bulunamadı.", { type: "error" });
      openWhatsApp(number);
    },
  };

  // ---------- Tahsilat düzeltme ve silme (v2.0.1) ----------
  // Herkes kendi girdiği tahsilatı; kasa yetkisi olanlar (yönetici, muhasebe) tüm tahsilatları düzeltip silebilir.
  const canEditPayment = item => HOF.can("cash.manage") || (HOF.can("payments.create") && item.actorId === HOF.user?.id);
  const isoDate = value => String(value || "").slice(0, 10);
  const amountText = value => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);

  function editPayment(item, { title = "", after } = {}) {
    HOF.formModal({
      title: "Tahsilatı düzelt",
      eyebrow: title || "TAHSİLAT",
      intro: "Düzeltme kasaya da yansır. Eski ve yeni değer işlem kayıtlarında saklanır.",
      fields: [
        { name: "amount", label: "Tutar (₺)", required: true, inputmode: "decimal", value: amountText(item.amount) },
        { name: "date", label: "Tahsilat tarihi", type: "date", required: true, value: isoDate(item.date) },
        { name: "note", label: "Açıklama", maxlength: 500, value: item.note ?? item.description ?? "" },
      ],
      submitLabel: "Düzeltmeyi kaydet",
      onSubmit: async data => {
        await HOF.api(`/api/workspace/payments/${encodeURIComponent(item.id)}`, { method: "PUT", body: data });
        HOF.toast("Tahsilat düzeltildi.", { type: "success" });
        after?.();
      },
    });
  }

  async function deletePayment(item, { title = "", after } = {}) {
    const ok = await HOF.confirm({
      title: "Tahsilatı sil",
      message: `${HOF.formatMoney(item.amount)} tutarındaki tahsilat${title ? ` (${title})` : ""} silinecek ve kasadan düşülecek. Silme işlem kayıtlarında saklanır.`,
      confirmLabel: "Sil",
      danger: true,
    });
    if (!ok) return;
    try {
      await HOF.api(`/api/workspace/payments/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      HOF.toast("Tahsilat silindi.", { type: "success" });
      after?.();
    } catch (error) {
      HOF.toastError(error);
    }
  }

  // ---------- Kasa (v2.0.1) ----------
  const pad2 = value => String(value).padStart(2, "0");
  const dayText = date => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  const PERIODS = [
    { id: "month", label: "Bu ay" },
    { id: "last", label: "Geçen ay" },
    { id: "year", label: "Bu yıl" },
    { id: "all", label: "Tümü" },
    // "Aralık" aynı zamanda ay adı (December); karışmasın diye "Tarih aralığı".
    { id: "range", label: "Tarih aralığı" },
  ];
  // "01.09–27.09" (bu yıl içinde), yoksa yıllarıyla "01.09.2025–27.09.2026".
  const rangeText = ({ from, to }) => {
    const short = iso => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
    const full = iso => `${short(iso)}.${iso.slice(0, 4)}`;
    const year = String(new Date().getFullYear());
    if (!from || !to) return "Tarih aralığı";
    return from.startsWith(year) && to.startsWith(year) ? `${short(from)}–${short(to)}` : `${full(from)}–${full(to)}`;
  };
  const periodRange = (id, custom) => {
    const today = new Date();
    if (id === "range") return custom;
    if (id === "month") return { from: dayText(new Date(today.getFullYear(), today.getMonth(), 1)), to: dayText(new Date(today.getFullYear(), today.getMonth() + 1, 0)) };
    if (id === "last") return { from: dayText(new Date(today.getFullYear(), today.getMonth() - 1, 1)), to: dayText(new Date(today.getFullYear(), today.getMonth(), 0)) };
    if (id === "year") return { from: `${today.getFullYear()}-01-01`, to: `${today.getFullYear()}-12-31` };
    return { from: "", to: "" };
  };
  let cashModal = null;

  function editCashEntry(entry, kind, after) {
    const incoming = (entry?.kind || kind) === "in";
    HOF.formModal({
      title: entry ? (incoming ? "Tahsilatı düzelt" : "Ödemeyi düzelt") : incoming ? "Kasaya tahsilat ekle" : "Kasadan ödeme ekle",
      eyebrow: "KASA",
      intro: incoming ? "Bir kayda bağlı olmayan tahsilatlar için (ör. danışmanlık ücreti). Kayda bağlı tahsilatı detay kartındaki Tahsilat düğmesiyle girin; kasaya kendiliğinden düşer." : "Kira, fatura, maaş, masraf gibi kasadan çıkan ödemeler.",
      fields: [
        { name: "amount", label: "Tutar (₺)", required: true, inputmode: "decimal", placeholder: "Örn. 1.250,00", value: entry ? amountText(entry.amount) : "" },
        { name: "date", label: "Tarih", type: "date", required: true, value: entry ? isoDate(entry.date) : dayText(new Date()) },
        { name: "description", label: "Açıklama", required: true, maxlength: 300, placeholder: incoming ? "Kimden / ne için" : "Kime / ne için", value: entry?.description || "", list: incoming ? [] : ["Kira", "Elektrik faturası", "Su faturası", "İnternet", "Maaş", "Kırtasiye", "Vergi", "Masraf"] },
      ],
      submitLabel: entry ? "Düzeltmeyi kaydet" : incoming ? "Tahsilatı ekle" : "Ödemeyi ekle",
      onSubmit: async data => {
        const body = { ...data, kind: entry?.kind || kind };
        if (entry) await HOF.api(`/api/workspace/cash/${encodeURIComponent(entry.id)}`, { method: "PUT", body });
        else await HOF.api("/api/workspace/cash", { method: "POST", body });
        HOF.toast(entry ? "Kasa hareketi düzeltildi." : incoming ? "Tahsilat kasaya eklendi." : "Ödeme kasaya işlendi.", { type: "success" });
        after?.();
      },
    });
  }

  async function deleteCashEntry(entry, after) {
    const ok = await HOF.confirm({ title: "Kasa hareketini sil", message: `${HOF.formatMoney(entry.amount)} tutarındaki ${entry.kind === "in" ? "tahsilat" : "ödeme"} (${entry.description}) silinecek. Silme işlem kayıtlarında saklanır.`, confirmLabel: "Sil", danger: true });
    if (!ok) return;
    try {
      await HOF.api(`/api/workspace/cash/${encodeURIComponent(entry.id)}`, { method: "DELETE" });
      HOF.toast("Kasa hareketi silindi.", { type: "success" });
      after?.();
    } catch (error) {
      HOF.toastError(error);
    }
  }

  // Kasa dökümü PDF: sunucu hazırlar (Türkçe harfler gömülü yazı tipiyle), tarayıcı dosyayı indirir.
  async function downloadCashPdf(range, invalid, button) {
    if (invalid) return HOF.toast(invalid, { type: "error" });
    button.disabled = true;
    button.classList.add("is-busy");
    try {
      const query = new URLSearchParams({ from: range.from, to: range.to, download: "1" });
      const response = await HOF.nativeFetch(`/api/workspace/cash.pdf?${query}`, { credentials: "same-origin" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "PDF hazırlanamadı.");
      }
      const blob = await response.blob();
      const header = response.headers.get("content-disposition") || "";
      const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header)?.[1];
      let name = "Kasa-dokumu.pdf";
      try {
        name = encoded ? decodeURIComponent(encoded) : /filename="([^"]+)"/i.exec(header)?.[1] || name;
      } catch {
        // ad çözülemezse varsayılan ad kullanılır
      }
      const url = URL.createObjectURL(blob);
      const link = HOF.el("a", { href: url, download: name, hidden: true });
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      HOF.toast(`Kasa dökümü indirildi: ${name}`, { type: "success" });
    } catch (error) {
      HOF.toastError(error);
    } finally {
      button.disabled = false;
      button.classList.remove("is-busy");
    }
  }

  function openCash() {
    if (!HOF.can("cash.view")) return HOF.toast(`Kasayı yalnızca yönetici, ${HOF.roleLabels.avukat.toLocaleLowerCase("tr-TR")} ve muhasebe hesapları görebilir.`, { type: "error" });
    if (cashModal) return;
    let period = "month";
    let data = null;
    const today = new Date();
    // "Tarih aralığı": ör. 01.09.2026 – 25.09.2026; ilk açılışta bu ayın başından bugüne.
    const custom = { from: dayText(new Date(today.getFullYear(), today.getMonth(), 1)), to: dayText(today) };
    const manage = HOF.can("cash.manage");
    const modal = HOF.modal({
      title: "Kasa",
      eyebrow: "OPERASYON",
      size: "wide",
      body: `<div class="hof-kpis hof-cash-kpis" data-kpis></div>
        <div class="hof-cash-bar"><div class="hof-tabs" role="group" aria-label="Dönem">${PERIODS.map(item => `<button type="button" data-period="${item.id}">${item.label}</button>`).join("")}</div>
        <div class="hof-cash-add"><button type="button" class="hof-button hof-button-small hof-button-ghost" data-pdf title="Seçili dönemin kasa hareketlerini PDF olarak indir">PDF indir</button>${manage ? '<button type="button" class="hof-button hof-button-small" data-add="in">+ Tahsilat</button><button type="button" class="hof-button hof-button-small hof-button-ghost" data-add="out">− Ödeme</button>' : ""}</div>
        <div class="hof-cash-range" data-range hidden><label><span>Başlangıç</span><input type="date" data-from value="${custom.from}"></label><span aria-hidden="true">–</span><label><span>Bitiş</span><input type="date" data-to value="${custom.to}"></label></div></div>
        <div class="hof-cash-list" data-list><p class="hof-empty">Yükleniyor…</p></div>
        <p class="hof-edit-meta">Detay kartında girilen tahsilatlar kasaya kendiliğinden tahsilat olarak düşer. Hareketler eskiden yeniye sıralıdır; en yeni en altta. Kasa ofisin tek kasasıdır: tüm oturumlardaki tahsilatları içerir, oturum değiştirmek ya da silmek kasayı sıfırlamaz.</p>
        <div class="hof-actions"><button type="button" class="hof-button" data-close>Kapat</button></div>`,
      onClose: () => {
        cashModal = null;
      },
    });
    cashModal = { modal, reload: () => load() };
    const kpis = modal.dialog.querySelector("[data-kpis]");
    const list = modal.dialog.querySelector("[data-list]");
    const row = entry => {
      const payment = entry.source === "payment";
      const title = payment ? entry.caseTitle || (String(entry.caseKey).startsWith("satir:") ? "" : entry.caseKey) : "";
      const text = payment ? `Tahsilat${title ? ` · ${title}` : ""}${entry.description ? ` · ${entry.description}` : ""}` : entry.description;
      const actions = entry.editable ? `<button type="button" class="hof-mini" data-edit="${esc(entry.id)}" title="Düzelt" aria-label="Düzelt">✎</button><button type="button" class="hof-mini hof-mini-danger" data-delete="${esc(entry.id)}" title="Sil" aria-label="Sil">×</button>` : "";
      return `<tr data-kind="${esc(entry.kind)}"><td>${esc(HOF.formatDate(entry.date))}</td><td><b>${esc(text)}</b><small>${payment ? "Detay kartından" : entry.kind === "in" ? "Kasaya elle" : "Ödeme"} · ${esc(entry.actorName || "—")}</small></td><td class="num hof-cash-in">${entry.kind === "in" ? esc(HOF.formatMoney(entry.amount)) : ""}</td><td class="num hof-cash-out">${entry.kind === "out" ? esc(HOF.formatMoney(entry.amount)) : ""}</td><td class="num"><b>${esc(HOF.formatMoney(entry.balance))}</b></td><td class="hof-cash-actions">${actions}</td></tr>`;
    };
    const render = () => {
      modal.dialog.querySelectorAll("[data-period]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.period === period)));
      rangeBox.hidden = period !== "range";
      if (!data) return;
      // Göstergelerde dönemin adı; tarih aralığında tarihlerin kendisi (ör. 01.09–27.09).
      const label = period === "range" ? rangeText(custom) : PERIODS.find(item => item.id === period)?.label || "";
      kpis.innerHTML = `<div class="hof-cash-balance"><strong>${esc(HOF.formatMoney(data.totals.balance))}</strong><span>Güncel kasa</span></div><div><strong>${esc(HOF.formatMoney(data.period.in))}</strong><span>Tahsilat · ${esc(label)}</span></div><div><strong>${esc(HOF.formatMoney(data.period.out))}</strong><span>Ödeme · ${esc(label)}</span></div><div><strong>${esc(HOF.formatMoney(data.period.net))}</strong><span>Fark · ${esc(label)}</span></div>`;
      const opening = period !== "all" ? `<tr class="hof-cash-opening"><td></td><td><b>Devreden kasa</b><small>Dönem başındaki bakiye</small></td><td></td><td></td><td class="num"><b>${esc(HOF.formatMoney(data.opening))}</b></td><td></td></tr>` : "";
      list.innerHTML = data.entries.length || opening
        ? `<table class="hof-table hof-cash-table"><thead><tr><th>Tarih</th><th>Açıklama</th><th class="num">Tahsilat</th><th class="num">Ödeme</th><th class="num">Kasa</th><th></th></tr></thead><tbody>${opening}${data.entries.map(row).join("")}</tbody></table>${data.entries.length ? "" : '<p class="hof-empty">Bu dönemde kasa hareketi yok.</p>'}`
        : '<p class="hof-empty">Henüz kasa hareketi yok. Detay kartında tahsilat girildiğinde ya da yukarıdan tahsilat/ödeme eklendiğinde burada görünür.</p>';
      list.scrollTop = list.scrollHeight; // en yeni hareket en altta: listeyi oraya kaydır
    };
    const rangeBox = modal.dialog.querySelector("[data-range]");
    const rangeError = () => {
      if (period !== "range") return "";
      if (!custom.from || !custom.to) return "Başlangıç ve bitiş tarihini seçin.";
      if (custom.from > custom.to) return "Başlangıç tarihi bitiş tarihinden sonra olamaz.";
      return "";
    };
    rangeBox.addEventListener("change", event => {
      const input = event.target.closest("input");
      if (!input) return;
      custom[input.matches("[data-from]") ? "from" : "to"] = input.value;
      load();
    });
    async function load() {
      const range = periodRange(period, custom);
      const invalid = rangeError();
      if (invalid) {
        list.innerHTML = `<p class="hof-empty">${esc(invalid)}</p>`;
        return;
      }
      try {
        data = await HOF.api(`/api/workspace/cash?from=${range.from}&to=${range.to}`);
        render();
      } catch (error) {
        list.innerHTML = `<p class="hof-empty">${esc(error.message)}</p>`;
      }
    }
    const byId = id => data?.entries.find(entry => entry.id === id);
    const afterChange = () => {
      load();
      refreshActivity();
    };
    modal.dialog.addEventListener("click", event => {
      const target = event.target.closest("button");
      if (!target) return;
      if (target.dataset.period) {
        period = target.dataset.period;
        render();
        load();
      } else if ("pdf" in target.dataset) downloadCashPdf(periodRange(period, custom), rangeError(), target);
      else if (target.dataset.add) editCashEntry(null, target.dataset.add, load);
      else if (target.dataset.edit) {
        const entry = byId(target.dataset.edit);
        if (!entry) return;
        if (entry.source === "payment") editPayment({ ...entry, note: entry.description }, { title: entry.caseTitle, after: afterChange });
        else editCashEntry(entry, entry.kind, load);
      } else if (target.dataset.delete) {
        const entry = byId(target.dataset.delete);
        if (!entry) return;
        if (entry.source === "payment") deletePayment(entry, { title: entry.caseTitle, after: afterChange });
        else deleteCashEntry(entry, load);
      } else if ("close" in target.dataset) modal.close();
    });
    render();
    load();
  }

  // ---------- Operasyon pencereleri ----------
  async function openTasks(initial = "mine") {
    let view = initial;
    // Herkesin görevlerini yalnızca avukat ve yönetici görür; diğerleri kendi görevlerini (sunucu da süzer).
    const everyone = HOF.can("tasks.viewAll");
    const tabs = everyone
      ? '<button type="button" data-view="mine">Bana atananlar</button><button type="button" data-view="open">Tüm açık görevler</button><button type="button" data-view="completed">Tamamlananlar</button>'
      : '<button type="button" data-view="mine">Açık görevlerim</button><button type="button" data-view="completed">Tamamladıklarım</button>';
    const modal = HOF.modal({ title: "Görevler", eyebrow: "OPERASYON", size: "wide", body: `<div class="hof-tabs" role="group" aria-label="Görev filtresi">${tabs}</div><div class="hof-list" data-list><p class="hof-empty">Yükleniyor…</p></div><div class="hof-actions">${HOF.can("tasks.create") ? '<button type="button" class="hof-button hof-button-ghost" data-new>Yeni görev</button>' : ""}<button type="button" class="hof-button" data-close>Kapat</button></div>` });
    const list = modal.dialog.querySelector("[data-list]");
    const render = async () => {
      modal.dialog.querySelectorAll("[data-view]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.view === view)));
      list.innerHTML = '<p class="hof-empty">Yükleniyor…</p>';
      try {
        const query = view === "mine" ? "status=open&mine=1" : `status=${view}`;
        const tasks = await HOF.api(`/api/workspace/tasks?${query}`);
        list.innerHTML = tasks.length
          ? tasks.map(task => `<article class="hof-list-item"><header><b>${esc(task.title)}</b><span class="hof-chip ${task.priority !== "normal" ? `hof-chip-${esc(task.priority)}` : ""}">${esc(priorityLabel[task.priority] || task.priority)}</span></header><small>${esc(task.assignee)}${task.dueDate ? ` · son tarih ${esc(HOF.formatDate(task.dueDate))}` : ""}${task.caseKey ? ` · ${esc(HOF.vocab.record)} ${esc(task.caseKey)}` : ""} · ${esc(task.actorName)} tarafından</small>${task.status === "open" && HOF.can("tasks.complete") ? `<div class="hof-actions"><button type="button" class="hof-button hof-button-small" data-complete="${esc(task.id)}">Tamamlandı</button></div>` : task.completedAt ? `<small>✓ ${esc(task.completedByName || "")} · ${esc(HOF.formatDateTime(task.completedAt))}</small>` : ""}</article>`).join("")
          : `<p class="hof-empty">${view === "mine" ? "Size atanmış açık görev yok." : "Görev bulunmuyor."}</p>`;
      } catch (error) {
        list.innerHTML = `<p class="hof-empty">${esc(error.message)}</p>`;
      }
    };
    modal.dialog.addEventListener("click", async event => {
      const target = event.target.closest("button");
      if (!target) return;
      if (target.dataset.view) {
        view = target.dataset.view;
        render();
      } else if (target.dataset.complete) {
        target.disabled = true;
        try {
          await HOF.api(`/api/workspace/tasks/${encodeURIComponent(target.dataset.complete)}/complete`, { method: "POST" });
          HOF.toast("Görev tamamlandı.", { type: "success" });
          refreshBadges();
          render();
        } catch (error) {
          HOF.toastError(error);
          target.disabled = false;
        }
      } else if ("new" in target.dataset) {
        modal.close();
        actions.task();
      } else if ("close" in target.dataset) modal.close();
    });
    render();
  }

  // Eski "Mesajlar" penceresinin yerini sağdan açılan sohbet paneli aldı (hof-chat.js).
  const openMessages = () => HOF.chat?.open();

  async function openReports() {
    try {
      const result = await HOF.api("/api/workspace/reports");
      const rows = result.report.map(item => `<tr><td>${esc(item.userName)}<br><small>${esc(HOF.roleLabels[item.role] || item.role)}</small></td><td class="num">${item.tasksCompleted}</td><td class="num">${item.notes}</td><td class="num">${item.calls}</td><td class="num">${esc(HOF.formatMoney(item.collections))}</td><td class="num">${item.dataEntries}</td></tr>`).join("");
      HOF.modal({
        title: "Personel performans özeti",
        eyebrow: "RAPOR",
        size: "wide",
        body: `<div class="hof-kpis"><div><strong>${result.totals.tasks}</strong><span>toplam görev</span></div><div><strong>${result.totals.completedTasks}</strong><span>tamamlanan</span></div><div><strong>${result.totals.notes}</strong><span>not</span></div><div><strong>${esc(HOF.formatMoney(result.totals.payments))}</strong><span>tahsilat</span></div></div><div style="overflow:auto"><table class="hof-table"><thead><tr><th>Personel</th><th>Görev</th><th>Not</th><th>Telefon</th><th>Tahsilat</th><th>İşlem</th></tr></thead><tbody>${rows || '<tr><td colspan="6">Henüz işlem yok.</td></tr>'}</tbody></table></div><p class="hof-edit-meta">Oluşturulma: ${esc(HOF.formatDateTime(result.generatedAt))}</p>`,
      });
    } catch (error) {
      HOF.toastError(error);
    }
  }

  async function openLiens() {
    try {
      const result = await HOF.api("/api/workspace/liens?days=30");
      const urgent = result.upcoming.filter(item => new Date(item.expiresAt).getTime() - Date.now() <= 7 * 86_400_000);
      const list = result.upcoming.map(item => {
        const days = Math.max(0, Math.ceil((new Date(item.expiresAt).getTime() - Date.now()) / 86_400_000));
        return `<article class="hof-list-item ${days <= 7 ? "is-highlight" : ""}"><header><b>${esc(item.title)} · ${esc(item.caseKey)}</b><span class="hof-chip ${days <= 7 ? "hof-chip-urgent" : "hof-chip-high"}">${days} gün</span></header><small>Düşüm: ${esc(HOF.formatDate(item.expiresAt))} · kaydı giren ${esc(item.actorName || "—")}</small></article>`;
      }).join("");
      HOF.modal({ title: "Yaklaşan haciz düşümleri", eyebrow: "UYARI", body: `<div class="hof-alert">Bir yılını dolduracak aktif hacizler. ${urgent.length ? `${urgent.length} haciz 7 gün içinde düşüyor.` : "Önümüzdeki 7 gün içinde düşecek haciz yok."}</div><div class="hof-list">${list || '<p class="hof-empty">Önümüzdeki 30 gün içinde düşecek haciz yok.</p>'}</div>` });
    } catch (error) {
      HOF.toastError(error);
    }
  }

  function openProfile() {
    HOF.formModal({
      title: "Profilim",
      eyebrow: HOF.roleLabels[HOF.user.role] || HOF.user.role,
      intro: "Bu ad not, tahsilat, görev ve mesaj kayıtlarında görünür. Rolünüzü yalnızca yönetici değiştirebilir.",
      fields: [{ name: "name", label: "Ad soyad", required: true, value: HOF.user.name, maxlength: 120 }],
      submitLabel: "Kaydet",
      onSubmit: async data => {
        const result = await HOF.api("/api/workspace/profile", { method: "POST", body: data });
        HOF.user.name = result.name;
        renderUser();
        HOF.toast("Profiliniz güncellendi.", { type: "success" });
      },
    });
  }

  // ---------- Kenar çubuğu ----------
  const sideItem = (action, icon, label, badge = "", requires = "") => `<button type="button" class="hof-side-item" data-action="${action}" ${requires ? `data-requires="${requires}"` : ""}><span class="hof-side-icon" aria-hidden="true">${icon}</span><span class="hof-side-text">${label}</span><span class="hof-badge ${badge === "warn" ? "hof-badge-warn" : ""}" data-badge="${action}"></span></button>`;
  // Operasyon merkezi düğmeleri. Adları yönetici kartın köşesindeki kalemle değiştirebilir (ofis geneli, v2.0.1).
  const SIDE_ITEMS = [
    { action: "tasks", icon: "✓", key: "side.tasks", label: () => "Görevler" },
    { action: "messages", icon: "✉", key: "side.messages", label: () => "Mesajlar" },
    { action: "newTask", icon: "+", key: "side.newTask", label: () => "Görev ata", requires: "tasks.create" },
    // Sabit "Yeni kayıt" (v2.0.2): açık sekme araç, kasa ya da öğrenci listesi olabilir; sektör sözcüğü yanıltır.
    { action: "newRecord", icon: "+", key: "side.newRecord", label: () => "Yeni kayıt" },
    { action: "cash", icon: "₺", key: "side.cash", label: () => "Kasa", requires: "cash.view" },
    { action: "liens", icon: "!", key: "side.liens", label: () => "Haciz uyarıları", badge: "warn", module: "haciz" },
    { action: "analytics", icon: "▤", key: "side.analytics", label: () => "Raporlar", requires: "reports.view" },
    { action: "reports", icon: "↗", key: "side.reports", label: () => "Personel raporu", requires: "reports.view" },
    { action: "guide", icon: "?", key: "side.guide", label: () => "Kullanım kılavuzu" },
  ];
  const sideTitle = () => HOF.uiLabel?.("side.title", "OPERASYON MERKEZİ") || "OPERASYON MERKEZİ";
  const sideLabel = item => HOF.uiLabel?.(item.key, item.label()) || item.label();
  const PENCIL = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>';

  function renderSideLabels() {
    const card = document.getElementById("hof-sidecard");
    if (!card) return;
    const title = card.querySelector(".hof-sidecard-label");
    if (title && title.textContent !== sideTitle()) title.textContent = sideTitle();
    for (const item of SIDE_ITEMS) {
      const text = card.querySelector(`[data-action="${item.action}"] .hof-side-text`);
      const value = sideLabel(item);
      if (text && text.textContent !== value) text.textContent = value;
    }
  }

  // Kalem: kartın başlığı ve düğme adları tek pencerede. Boş bırakılan ya da varsayılana eşit alan varsayılana döner.
  function openSideEditor() {
    if (!HOF.can("profile.manage")) return;
    const items = SIDE_ITEMS.filter(item => !item.module || HOF.modules[item.module]);
    const rows = [{ key: "side.title", label: "Kartın başlığı", fallback: "OPERASYON MERKEZİ" }, ...items.map(item => ({ key: item.key, label: item.label(), fallback: item.label(), icon: item.icon }))];
    const current = HOF.profile?.()?.labels || {};
    const modal = HOF.formModal({
      title: "Operasyon merkezini düzenle",
      eyebrow: "GÖRÜNÜM",
      size: "wide",
      intro: "Düğmelerin adlarını ofisinize göre değiştirin (ör. <b>Kasa</b> yerine <b>Vezne</b>). Değişiklik tüm bilgisayarlarda görünür; boş bırakılan ad varsayılana döner.",
      fields: rows.map((row, index) => ({
        name: `l${index}`,
        label: row.icon ? `${row.icon}  ${row.fallback}` : row.label,
        value: current[row.key] || "",
        placeholder: row.fallback,
        maxlength: row.key === "side.title" ? 40 : 32,
        autofocus: index === 1,
      })),
      extraHtml: '<div class="hof-side-editor-reset"><button type="button" class="hof-button hof-button-small hof-button-ghost" data-reset-all>Tümünü varsayılana döndür</button></div>',
      submitLabel: "Adları kaydet",
      onSubmit: async data => {
        const labels = {};
        rows.forEach((row, index) => {
          const value = String(data[`l${index}`] || "").replace(/\s+/g, " ").trim();
          const normalized = value.toLocaleLowerCase("tr-TR") === row.fallback.toLocaleLowerCase("tr-TR") ? "" : value;
          if ((current[row.key] || "") !== normalized) labels[row.key] = normalized;
        });
        if (!Object.keys(labels).length) return;
        const next = await HOF.api("/api/workspace/labels/batch", { method: "PUT", body: { labels } });
        HOF.applyProfile?.(next);
        renderSideLabels();
        HOF.toast("Operasyon merkezi güncellendi; tüm bilgisayarlarda görünür.", { type: "success" });
      },
    });
    modal.dialog.classList.add("hof-side-editor");
    modal.dialog.querySelector("[data-reset-all]")?.addEventListener("click", () => {
      modal.dialog.querySelectorAll('.hof-form input[name^="l"]').forEach(input => (input.value = ""));
      modal.dialog.querySelector('.hof-form input[name^="l"]')?.focus();
    });
  }

  function renderUser() {
    const target = document.querySelector("#hof-sidecard .hof-user");
    if (!target || !HOF.user) return;
    target.innerHTML = `<span class="hof-user-avatar" aria-hidden="true">${esc(HOF.initials(HOF.user.name))}</span><span class="hof-user-info"><strong title="${esc(HOF.user.name)}">${esc(HOF.user.name)}</strong><span>${esc(HOF.roleLabels[HOF.user.role] || HOF.user.role)}</span></span><span class="hof-user-menu"><button type="button" data-action="profile">Profil</button><button type="button" data-action="password">Parola</button>${HOF.can("users.manage") || HOF.can("audit.view") ? '<a href="/admin.html">Yönetim</a>' : ""}<button type="button" data-action="logout">Çıkış</button></span>`;
  }

  function installSidebar() {
    if (!HOF.user || document.getElementById("hof-sidecard")) return;
    const sidebar = document.querySelector(".sidebar");
    if (!sidebar) return;
    const card = HOF.el(
      "div",
      { id: "hof-sidecard", class: "hof-sidecard" },
      `<div class="hof-sidecard-head"><p class="hof-sidecard-label">${esc(sideTitle())}</p><button type="button" class="hof-sidecard-edit" data-action="editSide" data-requires="profile.manage" title="Düğme adlarını değiştir" aria-label="Operasyon merkezindeki düğme adlarını değiştir">${PENCIL}</button></div>
      ${SIDE_ITEMS.map(item => sideItem(item.action, item.icon, esc(sideLabel(item)), item.badge || "", item.requires || "")).join("")}
      <div class="hof-user"></div>`,
    );
    const bottom = sidebar.querySelector(".sidebar-bottom");
    if (bottom && bottom.parentNode === sidebar) sidebar.insertBefore(card, bottom);
    else sidebar.appendChild(card);
    renderUser();
    card.addEventListener("click", event => {
      const action = event.target.closest("[data-action]")?.dataset.action;
      if (!action) return;
      if (action === "tasks") openTasks();
      else if (action === "messages") HOF.chat ? HOF.chat.toggle() : openMessages();
      else if (action === "newTask") actions.task();
      else if (action === "newRecord") HOF.emit("new-record");
      else if (action === "liens") openLiens();
      else if (action === "cash") openCash();
      else if (action === "editSide") openSideEditor();
      else if (action === "guide") window.open("/kilavuz/DestekOfis-Kullanim-Kilavuzu.pdf", "_blank", "noopener");
      else if (action === "reports") openReports();
      else if (action === "analytics") HOF.reports?.open();
      else if (action === "profile") openProfile();
      else if (action === "password") HOF.changePassword();
      else if (action === "logout") HOF.logout();
    });
    refreshBadges();
  }

  async function refreshBadges() {
    const setBadge = (name, value) => {
      const node = document.querySelector(`[data-badge="${name}"]`);
      if (node) node.textContent = value ? String(value) : "";
    };
    try {
      const [tasks, liens] = await Promise.all([HOF.api("/api/workspace/tasks?status=open&mine=1"), HOF.api("/api/workspace/liens?days=7")]);
      setBadge("tasks", tasks.length);
      setBadge("liens", liens.total);
    } catch {
      // Rozetler kritik değil; bir sonraki turda yeniden denenir.
    }
  }

  // ---------- Detay paneli: işlem düğmeleri ve geçmiş ----------
  const ACTIVITY_ICONS = { note: "✎", phone: "☎", payment: "₺", lien: "⚖", task: "✓" };
  const describe = item => {
    if (item.type === "note") return esc(item.text);
    if (item.type === "phone") return `${esc(item.label)}: ${esc(item.phone)}`;
    if (item.type === "payment") return `${esc(HOF.formatMoney(item.amount))} tahsilat${item.note ? ` · ${esc(item.note)}` : ""} (${esc(HOF.formatDate(item.date))})`;
    if (item.type === "lien") return `${esc(item.title)} · düşüm ${esc(HOF.formatDate(item.expiresAt))}`;
    if (item.type === "task") return `Görev: ${esc(item.title)} → ${esc(item.assignee)}${item.status === "completed" ? " ✓" : ""}`;
    return "";
  };

  let activityItems = new Map();
  // İşlem geçmişindeki tahsilatın düzelt/sil düğmeleri (liste her çizimde yenilendiği için tek dinleyici).
  document.addEventListener("click", event => {
    const button = event.target.closest("#hof-activity [data-payment-edit], #hof-activity [data-payment-delete]");
    if (!button) return;
    const item = activityItems.get(button.dataset.paymentEdit || button.dataset.paymentDelete);
    if (!item) return;
    const title = HOF.selectedCase()?.title || "";
    if (button.dataset.paymentEdit) editPayment(item, { title, after: afterCaseChange });
    else deletePayment(item, { title, after: afterCaseChange });
  });

  async function renderActivity() {
    const selected = HOF.selectedCase();
    const panel = HOF.detailPanel();
    let box = document.getElementById("hof-activity");
    if (!selected || !panel) {
      if (box) box.hidden = true;
      return;
    }
    if (!box) {
      box = HOF.el("section", { id: "hof-activity", class: "hof-activity", "aria-live": "polite" });
      panel.appendChild(box);
    } else if (box.parentNode !== panel) panel.appendChild(box);
    box.hidden = false;
    if (activityKey === selected.key) return;
    activityKey = selected.key;
    const request = ++activityRequest;
    box.innerHTML = '<div class="hof-activity-head"><h3>İŞLEM GEÇMİŞİ</h3></div><p class="hof-empty">Yükleniyor…</p>';
    try {
      const result = await HOF.api(caseUrl(selected.key, "activity"));
      if (request !== activityRequest) return;
      const tools = ["not", "telefon", HOF.modules.tahsilat ? "tahsilat" : "", HOF.modules.haciz ? "haciz" : ""].filter(Boolean);
      const toolsText = `${tools.slice(0, -1).join(", ")} veya ${tools[tools.length - 1]}`;
      // Eskiden yeniye (v2.0.1): yeni eklenen işlem en altta; uzun geçmişte son 30 işlem gösterilir.
      const shown = result.items.slice(-30);
      const hidden = result.items.length - shown.length;
      activityItems = new Map(shown.map(item => [item.id, item]));
      const itemActions = item => (item.type === "payment" && canEditPayment(item) ? `<span class="hof-activity-tools"><button type="button" class="hof-mini" data-payment-edit="${esc(item.id)}" title="Tahsilatı düzelt" aria-label="Tahsilatı düzelt">✎</button><button type="button" class="hof-mini hof-mini-danger" data-payment-delete="${esc(item.id)}" title="Tahsilatı sil" aria-label="Tahsilatı sil">×</button></span>` : "");
      const edited = item => (item.updatedAt ? ` · düzeltildi${item.updatedByName ? ` (${esc(item.updatedByName)})` : ""}` : "");
      box.innerHTML = `<div class="hof-activity-head"><h3>İŞLEM GEÇMİŞİ</h3>${result.paidTotal ? `<span>Toplam tahsilat ${esc(HOF.formatMoney(result.paidTotal))}</span>` : ""}</div>${result.items.length ? `${hidden ? `<p class="hof-empty">Önceki ${hidden} işlem gösterilmiyor.</p>` : ""}<ol>${shown.map(item => `<li data-type="${esc(item.type)}"><span class="hof-activity-icon" aria-hidden="true">${ACTIVITY_ICONS[item.type] || "•"}</span><span class="hof-activity-main"><b>${describe(item)}</b><small>${esc(item.actorName || "—")} · ${esc(HOF.formatDateTime(item.createdAt))}${edited(item)}</small></span>${itemActions(item)}</li>`).join("")}</ol>` : `<p class="hof-empty">Bu kayıtta henüz işlem yok. Yukarıdaki düğmelerle ${toolsText} ekleyebilirsiniz.</p>`}`;
    } catch (error) {
      if (request === activityRequest) box.innerHTML = `<p class="hof-empty">${esc(error.message)}</p>`;
    }
  }

  function installDetailActions() {
    const panel = HOF.detailPanel();
    const header = panel?.querySelector(".detail-header");
    if (!header) return;
    let row = panel.querySelector(".hof-case-actions");
    if (!row) {
      row = HOF.el("div", { class: "hof-case-actions", role: "toolbar", "aria-label": "Kayıt işlemleri" }, `<button type="button" class="hof-whatsapp" data-case-action="whatsapp">WhatsApp</button><button type="button" data-case-action="note" data-requires="notes.write">Not</button><button type="button" data-case-action="phone" data-requires="phones.create">Telefon</button><button type="button" data-case-action="payment" data-requires="payments.create">Tahsilat</button><button type="button" data-case-action="task" data-requires="tasks.create">Görev</button><button type="button" data-case-action="lien" data-requires="liens.create">Haciz</button>`);
      row.addEventListener("click", event => {
        const action = event.target.closest("[data-case-action]")?.dataset.caseAction;
        if (action && actions[action]) actions[action]();
      });
    }
    if (header.nextSibling !== row) header.after(row);
  }

  let selectedAtPress = "";
  document.addEventListener("pointerdown", () => (selectedAtPress = HOF.selectedCase()?.key || ""), true);
  // Tablo veya detaydaki telefon hücresine tıklayınca WhatsApp açılır.
  document.addEventListener("click", event => {
    const target = event.target.closest(".dynamic-table td, .dynamic-detail-grid > div");
    if (!target || event.target.closest("button, a, [data-hof-ui]")) return;
    const cell = target.closest("td");
    // Tabloda ilk tıklama satırı seçer; WhatsApp yalnızca zaten seçili olan satırın telefonuna tıklanınca açılır
    // (v2.0.1). Seçim, tıklama başlamadan önceki hâlinden okunur (arayüz seçimi tıklama sırasında günceller).
    if (cell) {
      const row = cell.closest("tr");
      const key = row?.dataset.hofKey || HOF.rowKey?.(row) || "";
      if (!key || selectedAtPress !== key) return;
    }
    const header = cell ? HOF.tableHeaders(cell.closest("table"))[cell.cellIndex] || "" : "";
    const label = HOF.columnOf(target.querySelector?.(".detail-label"));
    if (!/(telefon|tel\b|gsm|cep)/i.test(`${header} ${label}`)) return;
    const number = extractPhones(target.textContent)[0];
    if (!number) return;
    event.preventDefault();
    openWhatsApp(number);
    HOF.toast("WhatsApp açılıyor…");
  });

  // Açık dosyanın işlem geçmişini yeniden çeker (başka bir bilgisayar not/işlem eklediğinde).
  function refreshActivity() {
    activityKey = "";
    renderActivity();
    HOF.emit("activity-changed");
  }

  // ---------- Canlı değişiklikler (hof-live.js) ----------
  HOF.on("live:workspace.changed", change => {
    if (!change) return;
    if (change.kind === "task") {
      refreshBadges();
      // Kişiye kimliğiyle bağlı görevde kimlik, serbest yazılmış görevde ad karşılaştırılır.
      const mine = change.assigneeId ? change.assigneeId === HOF.user?.id : Boolean(change.assignee) && HOF.normalize(change.assignee) === HOF.normalize(HOF.user?.name || "");
      if (mine) {
        HOF.toast(`${change.actorName || "Bir kullanıcı"} size görev atadı: ${change.title || ""}`, { action: { label: "Görevler", onClick: () => openTasks("mine") }, timeout: 8000 });
      }
    }
    if ((change.kind === "activity" || change.kind === "task") && change.caseKey && HOF.selectedCase()?.key === change.caseKey) refreshActivity();
    if (change.kind === "cash" && cashModal) cashModal.reload();
  });
  HOF.on("live:resync", () => {
    refreshBadges();
    refreshActivity();
  });
  // Sektör değişince (bu veya başka bir bilgisayarda) kenar çubuğu ve işlem geçmişi yeni dili kullanır.
  HOF.on("profile", () => {
    renderSideLabels();
    renderUser();
    refreshActivity();
  });

  HOF.whenReady(() => {
    loadUsers();
    HOF.onDom(() => {
      installSidebar();
      installDetailActions();
      renderActivity();
    });
    setInterval(refreshBadges, 120_000);
  });
  HOF.workspace = { openTasks, openMessages, openReports, openLiens, openCash, refreshBadges, refreshActivity, extractPhones, payment: target => actions.payment(target) };
})();
