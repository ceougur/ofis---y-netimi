/*
 * WhatsApp ile ekstre ve mesaj (v2.0.13, müşteri talebi).
 *
 * Tek cariye ya da toplu: tüm cariler, süzgeçteki cariler ya da seçilen N cari. İki adım:
 *   1) Hazırlık — alıcı listesi (numarası geçerli olanlar işaretli; olmayanlar nedeniyle ayrı), dönem (ekstre) ya da
 *      şablon (mesaj; {Ad}, {Bakiye}… değişkenleri), kişiye özel ön izleme.
 *   2) Gönderim sırası — her kişi için mesaj hazır; "WhatsApp'ta Aç" aynı WhatsApp sekmesinde sohbeti açar, kişi
 *      gönderildi sayılır ve sıradakine geçilir. Metin kişiye göre düzeltilebilir, kopyalanabilir; ekstrenin PDF'i
 *      indirilip sohbete eklenebilir. Her gönderim ve atlama cari kartına yazılır (kime, ne zaman, kim).
 * WhatsApp'ın resmi toplu gönderimi ücretli iş hesabı ve onaylı şablon ister; burada kullanıcının kendi WhatsApp'ı
 * (masaüstü ya da web) kullanılır — mesajı gönderen her zaman kullanıcıdır.
 */
(() => {
  const HOF = window.HOF;
  if (!HOF) return;
  const { esc } = HOF;
  const money = value => HOF.formatMoney(value);
  const day = iso => (iso ? HOF.formatDate(iso) : "");
  const side = balance => (balance > 0.005 ? "borcunuz" : balance < -0.005 ? "alacağınız" : "bakiyeniz yok");
  const TEMPLATES = [
    { id: "reminder", label: "Ödeme Hatırlatma", text: "Sayın {Ad}, {Firma} hesabınızda güncel {Borç Durumu} {Bakiye}.{Sıradaki Taksit Satırı} Ödemeniz için teşekkür ederiz." },
    { id: "overdue", label: "Geciken Taksit", text: "Sayın {Ad}, {Vadesi Geçen} vadesi geçmiş ödemeniz bulunmaktadır. Güncel {Borç Durumu} {Bakiye}. Bilginize sunarız. {Firma}" },
    { id: "campaign", label: "Kampanya Duyurusu", text: "Sayın {Ad}, {Firma} olarak bu hafta seçili ürünlerde indirim yapıyoruz. Sizi mağazamızda görmekten mutluluk duyarız." },
    { id: "thanks", label: "Teşekkür", text: "Sayın {Ad}, ödemeniz için teşekkür ederiz. Güncel {Borç Durumu} {Bakiye}. {Firma}" },
    { id: "blank", label: "Boş", text: "" },
  ];
  const VARIABLES = ["{Ad}", "{Bakiye}", "{Borç Durumu}", "{Sıradaki Taksit}", "{Vadesi Geçen}", "{Son Ödeme}", "{Firma}"];
  const render = (template, person, office) =>
    String(template || "")
      .replaceAll("{Ad}", person.name)
      .replaceAll("{Bakiye}", money(Math.abs(person.balance)))
      .replaceAll("{Borç Durumu}", side(person.balance))
      .replaceAll("{Sıradaki Taksit Satırı}", person.next ? ` Sıradaki taksit: ${day(person.next.dueDate)} · ${money(person.next.amount)}.` : "")
      .replaceAll("{Sıradaki Taksit}", person.next ? `${day(person.next.dueDate)} · ${money(person.next.amount)}` : "yok")
      .replaceAll("{Vadesi Geçen}", person.overdue?.count ? `${person.overdue.count} taksit (${money(person.overdue.amount)})` : "yok")
      .replaceAll("{Son Ödeme}", person.lastPayment ? `${day(person.lastPayment.date)} · ${money(person.lastPayment.amount)}` : "yok")
      .replaceAll("{Firma}", office || "")
      .replace(/[ \t]+\n/g, "\n")
      .trim();
  const waUrl = (wa, text) => `https://wa.me/${wa}?text=${encodeURIComponent(text)}`;

  /**
   * @param {{ kind: "statement"|"message", selection: { ids?: string[], all?: boolean, ...süzgeçler }, title?: string }} options
   */
  async function open({ kind = "message", selection, title = "", onDone = null }) {
    if (!HOF.can("accounts.view")) return HOF.toast("WhatsApp gönderimi için cari görme yetkisi gerekir.", { type: "error" });
    const state = { kind, preset: "thisMonth", templateId: TEMPLATES[0].id, template: TEMPLATES[0].text, onlyDebtors: false, data: null, picked: new Set(), preview: "", queue: [], at: 0, sent: 0, skipped: 0, batchId: `wa-${Date.now().toString(36)}` };
    const modal = HOF.modal({
      title: kind === "statement" ? "WhatsApp ile Ekstre Gönder" : "WhatsApp ile Mesaj Gönder",
      eyebrow: title || "CARİ",
      size: "wide",
      body: '<div class="hof-wa" data-wa><p class="hof-empty">Alıcılar hazırlanıyor…</p></div>',
    });
    const root = modal.dialog.querySelector("[data-wa]");
    const load = async () => {
      root.innerHTML = '<p class="hof-empty">Alıcılar hazırlanıyor…</p>';
      try {
        state.data = await HOF.api("/api/workspace/whatsapp/targets", { method: "POST", body: { ...selection, kind, preset: state.preset } });
        state.picked = new Set(state.data.recipients.filter(item => item.valid).map(item => item.id));
        state.preview = state.data.recipients.find(item => item.valid)?.id || state.data.recipients[0]?.id || "";
        prepare();
      } catch (error) {
        root.innerHTML = `<p class="hof-empty">${esc(error.message)}</p>`;
      }
    };
    const textFor = person => (kind === "statement" ? person.statement : render(state.template, person, state.data.office));
    const eligible = () => state.data.recipients.filter(item => item.valid && (!state.onlyDebtors || item.balance > 0.005));

    // ---------- 1) Hazırlık ----------
    function prepare() {
      const list = state.data.recipients;
      const valid = list.filter(item => item.valid);
      const invalid = list.filter(item => !item.valid);
      const picked = eligible().filter(item => state.picked.has(item.id));
      const person = list.find(item => item.id === state.preview) || valid[0];
      const fits = item => item.valid && (!state.onlyDebtors || item.balance > 0.005);
      const row = item => `<tr class="${fits(item) ? "" : "is-muted"}${item.id === state.preview ? " is-current" : ""}" data-preview="${esc(item.id)}"><td class="hof-acc-check"><input type="checkbox" data-pick="${esc(item.id)}" ${fits(item) ? "" : "disabled"} ${state.picked.has(item.id) && fits(item) ? "checked" : ""} aria-label="${esc(item.name)} gönder"></td><td><b>${esc(item.name)}</b><small>${item.phone ? esc(item.phone) : ""}${item.valid ? "" : `${item.phone ? " · " : ""}${esc(item.reason)}`}${item.valid && state.onlyDebtors && !(item.balance > 0.005) ? " · borcu yok" : ""}${item.lastSend ? ` · son gönderim ${esc(day(item.lastSend.at.slice(0, 10)))}` : ""}</small></td><td class="num">${esc(money(Math.abs(item.balance)))}<small>${item.balance > 0.005 ? "Borçlu" : item.balance < -0.005 ? "Alacaklı" : "Kapalı"}</small></td></tr>`;
      root.innerHTML = `
        <div class="hof-wa-head"><div><strong>${list.length}</strong><span>Cari</span></div><div><strong>${valid.length}</strong><span>Geçerli Numara</span></div><div class="${invalid.length ? "is-warn" : ""}"><strong>${invalid.length}</strong><span>Numarası Yok / Hatalı</span></div><div><strong>${picked.length}</strong><span>Gönderilecek</span></div></div>
        <div class="hof-wa-grid">
          <div class="hof-wa-left">
            ${kind === "statement"
              ? `<label class="hof-field"><span>Ekstre Dönemi</span><select data-preset>${[["thisMonth", "Bu Ay"], ["lastMonth", "Geçen Ay"], ["last3", "Son 3 Ay"], ["all", "Tüm Hareketler"]].map(([id, label]) => `<option value="${id}" ${id === state.preset ? "selected" : ""}>${label}</option>`).join("")}</select></label>`
              : `<label class="hof-field"><span>Hazır Şablon</span><select data-template>${TEMPLATES.map(item => `<option value="${item.id}" ${item.id === state.templateId ? "selected" : ""}>${item.label}</option>`).join("")}</select></label>
                 <label class="hof-field"><span>Mesaj</span><textarea data-body rows="6" maxlength="3000">${esc(state.template)}</textarea><small>Değişken eklemek için tıklayın; her kişide kendi bilgisiyle dolar.</small></label>
                 <div class="hof-wa-vars">${VARIABLES.map(item => `<button type="button" class="hof-chip" data-var="${esc(item)}">${esc(item)}</button>`).join("")}</div>`}
            <label class="hof-check"><input type="checkbox" data-debtors ${state.onlyDebtors ? "checked" : ""}><span>Yalnız Borçlu Carilere Gönder</span></label>
            <div class="hof-wa-list"><table class="hof-table"><thead><tr><th class="hof-acc-check"><input type="checkbox" data-pick-all aria-label="Hepsini seç" ${picked.length === eligible().length && picked.length ? "checked" : ""}></th><th>Cari</th><th class="num">Bakiye</th></tr></thead><tbody>${list.map(row).join("")}</tbody></table></div>
          </div>
          <div class="hof-wa-right">
            <p class="hof-wa-label">Ön İzleme${person ? ` · ${esc(person.name)}` : ""}</p>
            <div class="hof-wa-bubble">${person ? esc(textFor(person)).replace(/\*(.+?)\*/g, "<b>$1</b>").replace(/\n/g, "<br>") : "Alıcı yok."}</div>
            <p class="hof-edit-meta">Gönderim sırasında her kişinin mesajı WhatsApp'ta hazır açılır; siz <b>Gönder</b>'e basarsınız. Mesaj kişiye göre değiştirilebilir. ${kind === "statement" ? "Ekstrenin PDF'ini aynı sohbete ekleyebilirsiniz." : ""}</p>
          </div>
        </div>
        <div class="hof-actions"><button type="button" class="hof-button hof-button-ghost" data-close>Vazgeç</button><button type="button" class="hof-button" data-start ${picked.length ? "" : "disabled"}>Gönderime Başla (${picked.length} Kişi)</button></div>`;
    }

    // ---------- 2) Gönderim sırası ----------
    function queueView() {
      const total = state.queue.length;
      if (state.at >= total) {
        root.innerHTML = `<div class="hof-wa-done"><strong>Gönderim Tamamlandı</strong><p>${state.sent} kişiye gönderildi${state.skipped ? `, ${state.skipped} kişi atlandı` : ""}. Gönderimler carilerin kartına kaydedildi.</p></div><div class="hof-actions"><button type="button" class="hof-button" data-close>Kapat</button></div>`;
        if (!state.finished) {
          state.finished = true;
          if (state.sent || state.skipped) onDone?.({ sent: state.sent, skipped: state.skipped });
        }
        return;
      }
      const person = state.queue[state.at];
      const text = person.text;
      root.innerHTML = `
        <div class="hof-wa-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${state.at}"><span style="width:${Math.round((state.at / total) * 100)}%"></span></div>
        <p class="hof-wa-step"><b>${state.at + 1} / ${total}</b> · ${state.sent} gönderildi${state.skipped ? ` · ${state.skipped} atlandı` : ""}</p>
        <div class="hof-wa-person"><strong>${esc(person.name)}</strong><span>${esc(person.phone)} · ${esc(money(Math.abs(person.balance)))} ${person.balance > 0.005 ? "borçlu" : person.balance < -0.005 ? "alacaklı" : ""}</span></div>
        <label class="hof-field"><span>Mesaj (bu kişiye özel düzeltebilirsiniz)</span><textarea data-current rows="10" maxlength="4000">${esc(text)}</textarea></label>
        <div class="hof-actions hof-wa-actions">
          <button type="button" class="hof-button hof-button-ghost" data-prev ${state.at ? "" : "disabled"}>← Önceki</button>
          <button type="button" class="hof-button hof-button-ghost" data-skip>Atla</button>
          <button type="button" class="hof-button hof-button-ghost" data-copy>Metni Kopyala</button>
          ${kind === "statement" ? `<a class="hof-button hof-button-ghost" href="/api/workspace/accounts/${encodeURIComponent(person.id)}/ekstre.pdf" target="_blank" rel="noopener">Ekstre PDF</a>` : ""}
          <button type="button" class="hof-button hof-whatsapp" data-send>WhatsApp'ta Aç ve Sıradakine Geç</button>
        </div>
        <p class="hof-edit-meta">WhatsApp sekmesinde mesaj hazır gelir; <b>Gönder</b>'e basıp buraya dönün. Aynı WhatsApp sekmesi her kişide yeniden kullanılır.</p>`;
    }
    const log = (person, status, body) => HOF.api("/api/workspace/whatsapp/log", { method: "POST", body: { batchId: state.batchId, accountId: person.id, kind, phone: person.phone, body, status } }).catch(() => {});

    root.addEventListener("change", event => {
      const target = event.target;
      if (target.matches("[data-preset]")) {
        state.preset = target.value;
        load();
      } else if (target.matches("[data-template]")) {
        state.templateId = target.value;
        state.template = TEMPLATES.find(item => item.id === target.value)?.text ?? "";
        prepare();
      } else if (target.matches("[data-debtors]")) {
        state.onlyDebtors = target.checked;
        prepare();
      } else if (target.matches("[data-pick]")) {
        target.checked ? state.picked.add(target.dataset.pick) : state.picked.delete(target.dataset.pick);
        prepare();
      } else if (target.matches("[data-pick-all]")) {
        for (const item of eligible()) target.checked ? state.picked.add(item.id) : state.picked.delete(item.id);
        prepare();
      }
    });
    root.addEventListener("input", event => {
      if (event.target.matches("[data-body]")) {
        state.template = event.target.value;
        const bubble = root.querySelector(".hof-wa-bubble");
        const person = state.data.recipients.find(item => item.id === state.preview);
        if (bubble && person) bubble.innerHTML = esc(textFor(person)).replace(/\*(.+?)\*/g, "<b>$1</b>").replace(/\n/g, "<br>");
      }
    });
    root.addEventListener("click", async event => {
      const target = event.target.closest("button, tr[data-preview]");
      if (!target) return;
      if (target.matches("tr[data-preview]") && !event.target.closest("input")) {
        state.preview = target.dataset.preview;
        prepare();
        return;
      }
      if (target.dataset.var) {
        const area = root.querySelector("[data-body]");
        const at = area.selectionStart ?? area.value.length;
        area.value = `${area.value.slice(0, at)}${target.dataset.var}${area.value.slice(area.selectionEnd ?? at)}`;
        state.template = area.value;
        prepare();
        return;
      }
      if ("close" in target.dataset) return modal.close();
      if ("start" in target.dataset) {
        if (kind === "message" && !state.template.trim()) return HOF.toast("Mesajı yazın.", { type: "error" });
        state.queue = eligible().filter(item => state.picked.has(item.id)).map(item => ({ ...item, text: textFor(item) }));
        if (state.queue.length > 1 && !(await HOF.confirm({ title: "Gönderime Başlansın mı?", message: `${state.queue.length} kişiye sırayla WhatsApp mesajı hazırlanacak. Her kişide WhatsApp açılır, siz Gönder'e basarsınız.`, confirmLabel: "Başla" }))) return;
        state.at = 0;
        queueView();
        return;
      }
      const person = state.queue[state.at];
      const current = root.querySelector("[data-current]");
      if (person && current) person.text = current.value;
      if ("send" in target.dataset) {
        window.open(waUrl(person.wa, person.text), "hof-whatsapp");
        log(person, "sent", person.text);
        state.sent += 1;
        state.at += 1;
        queueView();
      } else if ("skip" in target.dataset) {
        log(person, "skipped", "");
        state.skipped += 1;
        state.at += 1;
        queueView();
      } else if ("prev" in target.dataset) {
        state.at = Math.max(0, state.at - 1);
        queueView();
      } else if ("copy" in target.dataset) {
        try {
          await navigator.clipboard.writeText(person.text);
          HOF.toast("Metin kopyalandı.", { type: "success" });
        } catch {
          current?.select();
          HOF.toast("Metni seçtim; Ctrl+C ile kopyalayın.", { type: "info" });
        }
      }
    });
    load();
  }

  // Tek cari: ekstre, mesaj ya da doğrudan sohbet.
  function forAccount(account) {
    const chooser = HOF.modal({
      title: "WhatsApp",
      eyebrow: account.name,
      body: `<div class="hof-acc-choices">
          <button type="button" class="hof-acc-choice" data-kind="statement"><b>Ekstre Gönder</b><small>Hareketler, güncel bakiye ve sıradaki taksit hazır mesaj olarak</small></button>
          <button type="button" class="hof-acc-choice" data-kind="message"><b>Mesaj Gönder</b><small>Hazır şablon ya da kendi mesajınız ({Ad}, {Bakiye} ile)</small></button>
          <button type="button" class="hof-acc-choice is-plain" data-kind="chat"><b>Sohbeti Aç</b><small>Boş sohbet</small></button>
        </div><div class="hof-wa-history" data-history></div><div class="hof-actions"><button type="button" class="hof-button hof-button-ghost" data-close>Vazgeç</button></div>`,
    });
    HOF.api(`/api/workspace/whatsapp/history?accountId=${encodeURIComponent(account.id)}`)
      .then(rows => {
        const box = chooser.dialog.querySelector("[data-history]");
        if (!box || !rows?.length) return;
        box.innerHTML = `<p class="hof-wa-label">Son Gönderimler</p><ul>${rows.slice(0, 5).map(row => `<li>${esc(HOF.formatDate(row.at))} · ${row.kind === "statement" ? "Ekstre" : "Mesaj"}${row.status === "skipped" ? " (atlandı)" : ""}${row.actorName ? ` · ${esc(row.actorName)}` : ""}</li>`).join("")}</ul>`;
      })
      .catch(() => {});
    chooser.dialog.addEventListener("click", event => {
      const button = event.target.closest("[data-kind], [data-close]");
      if (!button) return;
      chooser.close();
      if (button.dataset.kind === "chat") return account.wa && window.open(`https://wa.me/${account.wa}`, "hof-whatsapp");
      if (button.dataset.kind) open({ kind: button.dataset.kind, selection: { ids: [account.id] }, title: account.name });
    });
  }

  HOF.whatsapp = { open, forAccount, render, waUrl };
})();
