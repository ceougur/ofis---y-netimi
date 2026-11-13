/* DestekOfis — Yönetim › Sistem › Dönem Kilidi ve Mutabakat › Açılış Olabilir Kayıtlar (2.5.0 Ç5-A tur 2c İş 3; sunucu routes/opening-review.mjs; docs/erp/C5-ACILIS-TASARIM.md
   §2.4, §17.10; KULLANICI S47 = A, S51 = A; BAŞ MİMAR B16). Eski sürümden gelen, açıklaması "Açılış…" ile başlayan Borç Yaz / Alacak Yaz kayıtları: açılış (onay — karşı hesap 519)
   ya da açılış değil (ret — sıradan Borç / Alacak Yaz). Tek ya da toplu karar, kararı geri alma (satır yeniden onay bekler), sayfalama. Kilitli dönemdeki satıra da karar verilir: donmuş
   defter değişmez, fark Kural Farkı Düzeltme fişiyle ilk açık güne alınır (B16: Kural Farkı fişi kilitli dönemdeki adaylar bitmeden yazılmaz). Pencere zildeki bildirimden
   (#system/acilis-olabilir) ve Kural Farkı penceresinin aday nedeninden de açılır ("hof:opening-review-open"). admin.js'e dokunmadan bağlanır. */
(() => {
  "use strict";
  const HOF = window.HOF;
  const esc = value => HOF.esc(value);
  const money = value => HOF.formatMoney(Number(value) || 0);
  const day = iso => (iso ? String(iso).split("-").reverse().join(".") : "—");
  const PAGE = 200;
  const URL = "/api/workspace/opening-review";
  const STATUS = { candidate: "Onay Bekliyor", confirmed: "Açılış", rejected: "Açılış Değil" };
  const KIND = { debt: "Borç Yaz", credit: "Alacak Yaz" };
  const DONE = { confirm: "açılış sayıldı", reject: "açılış sayılmadı", undo: "yeniden onay bekliyor" };
  // Geri Al: kararın öncesine dönüş (önceki durum → karar).
  const UNDO_OF = { candidate: "undo", confirmed: "confirm", rejected: "reject" };

  function summary(counts) {
    const locked = Number(counts.lockedCandidate) || 0;
    return `Onay bekleyen ${counts.candidate || 0} kayıt${locked ? ` (kilitli dönemde ${locked})` : ""} · Açılış ${counts.confirmed || 0} · Açılış Değil ${counts.rejected || 0}`;
  }
  function rowButtons(item) {
    const out = [];
    if (item.review !== "confirmed") out.push(`<button type="button" class="hof-button hof-button-small" data-review-decision="confirm" data-id="${esc(item.id)}">Açılış (Onayla)</button>`);
    if (item.review !== "rejected") out.push(`<button type="button" class="hof-button hof-button-ghost hof-button-small" data-review-decision="reject" data-id="${esc(item.id)}">Açılış Değil (Reddet)</button>`);
    if (item.review !== "candidate") out.push(`<button type="button" class="hof-button hof-button-ghost hof-button-small" data-review-decision="undo" data-id="${esc(item.id)}">Geri Al</button>`);
    return out.join(" ");
  }
  function table(view, selected) {
    if (!view.items.length) return `<p class="adm-muted" data-review-empty>${view.all ? "Açılış Olabilir listesinde kayıt yok." : "Onay bekleyen kayıt yok."}</p>`;
    const all = view.items.every(item => selected.has(item.id));
    return `<table class="hof-table" data-review-table><thead><tr><th><input type="checkbox" data-review-all aria-label="Sayfadaki bütün kayıtları seç"${all ? " checked" : ""}></th><th>Tarih</th><th>Cari</th><th>Tür</th><th class="adm-right">Tutar</th><th>Açıklama</th><th>Durum</th><th>Dönem</th><th>İşlem</th></tr></thead><tbody>
      ${view.items.map(item => `<tr data-review-row="${esc(item.id)}"><td><input type="checkbox" data-review-pick="${esc(item.id)}" aria-label="${esc(`${item.accountName} ${day(item.date)} seç`)}"${selected.has(item.id) ? " checked" : ""}></td><td>${esc(day(item.date))}</td><td>${esc(item.accountName)}${item.accountRef || item.accountPhone ? `<br><small class="adm-muted" data-review-ref>${esc([item.accountRef, item.accountPhone].filter(Boolean).join(" · "))}</small>` : ""}</td><td>${esc(KIND[item.kind] || item.kind)}</td><td class="adm-right">${esc(money(item.amount))}</td><td>${esc(item.note)}</td><td data-review-status>${esc(STATUS[item.review] || item.review)}</td><td>${item.locked ? "Kilitli" : "Açık"}</td><td>${rowButtons(item)}</td></tr>`).join("")}
      </tbody></table>`;
  }
  function pager(view) {
    if (!view.total || view.total <= PAGE) return "";
    const first = view.offset + 1;
    const last = Math.min(view.offset + view.items.length, view.total);
    return `<div class="hof-actions" data-review-pager><button type="button" class="hof-button hof-button-ghost hof-button-small" data-review-page="-1"${view.offset ? "" : " disabled"}>Önceki Sayfa</button><span class="adm-muted">${first}–${last} / ${view.total}</span><button type="button" class="hof-button hof-button-ghost hof-button-small" data-review-page="1"${last < view.total ? "" : " disabled"}>Sonraki Sayfa</button></div>`;
  }
  function render(view, selected) {
    const picked = selected.size;
    const why = picked ? `${picked} kayıt seçili.` : "Toplu karar için kayıt seçin.";
    return `<p class="hof-modal-text">Eski sürümden gelen, açıklaması "Açılış…" ile başlayan Borç Yaz / Alacak Yaz kayıtları. Açılışsa onaylayın (karşı hesap 519 Eşleştirilecek Açılış Bakiyeleri); değilse reddedin (sıradan Borç / Alacak Yaz). Karar kaydın tutarını, tarihini ve cari bakiyesini değiştirmez; onay bekleyen kayıt defterde açılış sayılır. Kilitli dönemdeki karar donmuş defteri değiştirmez; fark Kural Farkı Düzeltme fişiyle ilk açık güne alınır.</p>
      <div class="adm-inline"><label class="hof-field"><span>Gösterilen Kayıtlar</span><select data-review-filter><option value="candidate"${view.all ? "" : " selected"}>Onay Bekleyenler</option><option value="all"${view.all ? " selected" : ""}>Tümü</option></select></label></div>
      <p class="adm-muted" data-review-summary>${esc(summary(view.counts))}</p>
      ${table(view, selected)}${pager(view)}
      <div class="hof-actions"><button type="button" class="hof-button" data-review-bulk="confirm"${picked ? "" : " disabled"}>Seçilenleri Onayla</button><button type="button" class="hof-button hof-button-ghost" data-review-bulk="reject"${picked ? "" : " disabled"}>Seçilenleri Reddet</button></div>
      <p class="adm-muted" data-review-bulk-why>${esc(why)}</p>`;
  }

  let current = null;
  async function open({ all = false } = {}) {
    if (current) return;
    const state = { all, offset: 0, view: null, selected: new Set(), busy: false };
    const load = async () => {
      const query = `?limit=${PAGE}&offset=${state.offset}${state.all ? "&all=1" : ""}`;
      const data = await HOF.api(`${URL}${query}`);
      state.view = { ...data, all: state.all, offset: state.offset };
      // Sayfada olmayan seçim düşer (toplu karar yalnız görülen kayıtlara).
      state.selected = new Set([...state.selected].filter(id => data.items.some(item => item.id === id)));
    };
    try {
      await load();
    } catch (error) {
      HOF.toastError(error);
      return;
    }
    const modal = HOF.modal({ title: "Açılış Olabilir Kayıtlar", eyebrow: "DÖNEM KİLİDİ VE MUTABAKAT", size: "wide", body: '<div data-review-body></div>', onClose: () => (current = null) });
    const root = modal?.dialog;
    if (!root) return;
    current = modal;
    const host = root.querySelector("[data-review-body]");
    const paint = () => (host.innerHTML = render(state.view, state.selected));
    paint();
    const refresh = async () => {
      try {
        await load();
      } catch (error) {
        HOF.toastError(error);
      }
      if (root.isConnected) paint();
    };
    const changed = () => {
      // Yönetim › Sistem'deki Mutabakat satırı ve Kural Farkı penceresi kararla değişir (admin.js "hof:rule-diff-changed"i dinler).
      document.dispatchEvent(new CustomEvent("hof:rule-diff-changed"));
    };
    const decide = async (ids, decision, { undoable = true, previous = [] } = {}) => {
      if (state.busy) return;
      state.busy = true;
      try {
        const single = ids.length === 1;
        const result = single
          ? await HOF.api(`${URL}/${encodeURIComponent(ids[0])}`, { method: "POST", body: { decision } })
          : await HOF.api(URL, { method: "POST", body: { ids, decision } });
        const items = single ? [result.item] : result.items;
        const count = single ? (result.changed ? 1 : 0) : result.changed;
        const back = previous.length ? previous : items.map(item => ({ id: item.id, review: item.previous }));
        state.selected = new Set();
        await refresh();
        changed();
        const text = count ? `${count} kayıt ${DONE[decision]}.` : "Değişiklik yok; kayıt zaten bu durumda.";
        HOF.toast(text, {
          type: count ? "success" : "info",
          action: undoable && count ? { label: "Geri Al", onClick: () => undoAll(back) } : undefined,
        });
      } catch (error) {
        HOF.toastError(error);
        await refresh();
      } finally {
        state.busy = false;
      }
    };
    // Bildirimdeki Geri Al: her kaydı kararın öncesindeki durumuna döndürür (önceki durumlar farklıysa gruplanır).
    const undoAll = async back => {
      const groups = new Map();
      for (const item of back) {
        const decision = UNDO_OF[item.review];
        if (!decision) continue;
        if (!groups.has(decision)) groups.set(decision, []);
        groups.get(decision).push(item.id);
      }
      for (const [decision, ids] of groups) await decide(ids, decision, { undoable: false });
    };
    root.addEventListener("change", async event => {
      if (event.target.matches("[data-review-filter]")) {
        state.all = event.target.value === "all";
        state.offset = 0;
        state.selected = new Set();
        await refresh();
      } else if (event.target.matches("[data-review-all]")) {
        state.selected = event.target.checked ? new Set(state.view.items.map(item => item.id)) : new Set();
        paint();
      } else if (event.target.matches("[data-review-pick]")) {
        const id = event.target.dataset.reviewPick;
        if (event.target.checked) state.selected.add(id);
        else state.selected.delete(id);
        paint();
        root.querySelector(`[data-review-pick="${CSS.escape(id)}"]`)?.focus();
      }
    });
    root.addEventListener("click", async event => {
      const one = event.target.closest("[data-review-decision]");
      if (one) return decide([one.dataset.id], one.dataset.reviewDecision);
      const bulk = event.target.closest("[data-review-bulk]");
      if (bulk && state.selected.size) return decide([...state.selected], bulk.dataset.reviewBulk);
      const page = event.target.closest("[data-review-page]");
      if (page && !page.disabled) {
        state.offset = Math.max(0, state.offset + Number(page.dataset.reviewPage) * PAGE);
        state.selected = new Set();
        await refresh();
      }
    });
  }

  document.addEventListener("click", event => {
    if (event.target.closest("#adm-opening-review-open")) open();
  });
  document.addEventListener("hof:opening-review-open", () => open());
})();
