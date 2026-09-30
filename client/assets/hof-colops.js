/* DestekOfis — ortadaki tabloda sütun ekleme ve silme (v2.0.6).
 * Yönetici bir sütun başlığının üzerine gelince başlığın üst kenarında küçük bir çubuk çıkar: "+ Ekle" ve kırmızı "× Sil".
 *  - Ekle: o sütunun hemen sağına, sekmedeki her satıra boş hücreyle yeni bir sütun ekler (adı sorulur). Değerleri
 *    kartta ✎ / Düzenle ile yazılır.
 *  - Sil: sütunun tamamını (başlık ve tüm satırlardaki hücreler) kaldırır; sağdaki sütunlar sola kayar. Dolu hücre varsa
 *    önce sorar. Kaynak Excel/Sheets değişmez; "Geri al" ya da Yönetim → Silinenler ile geri gelir.
 * Çubuk başlığın içine yazılmaz (yüzen tek öğe): kolon adları, genişlik tutamacı ve sıralama etkilenmez. Serbest
 * sayfalarda sütunlar ızgaranın kendi araçlarıyla yönetilir; orada çıkmaz. */
(() => {
  "use strict";
  const HOF = window.HOF;
  const { esc } = HOF;
  let bar = null;
  let target = null;
  let hideTimer = 0;

  const allowed = () => Boolean(HOF.user) && HOF.can("sources.manage") && !HOF.free?.isActive?.() && !HOF.hasOpenModal();
  const activeTab = () => (HOF.activeTab && HOF.activeTab()) || "";
  const tabRows = () => {
    const tab = activeTab();
    return (HOF.data?.rows || []).filter(row => !row.__hofFree && (!tab || row.__sheet === tab));
  };
  const labelOf = column => (HOF.columnLabel ? HOF.columnLabel(column) : column);

  function ensureBar() {
    if (bar) return bar;
    bar = HOF.el(
      "div",
      { class: "hof-colops", role: "toolbar", "aria-label": "Sütun işlemleri" },
      '<button type="button" class="hof-colops-add" data-colop="add" title="Bu sütunun sağına, tüm satırlara yeni bir sütun ekle">+ Ekle</button><button type="button" class="hof-colops-del" data-colop="del" title="Bu sütunu başlığı ve tüm hücreleriyle sil">× Sil</button>',
    );
    document.body.appendChild(bar);
    bar.addEventListener("mouseenter", () => clearTimeout(hideTimer));
    bar.addEventListener("mouseleave", scheduleHide);
    bar.addEventListener("click", event => {
      const button = event.target.closest("[data-colop]");
      if (!button || !target) return;
      event.preventDefault();
      event.stopPropagation();
      const th = target;
      hide();
      if (button.dataset.colop === "add") addColumn(th);
      else removeColumn(th);
    });
    return bar;
  }
  function hide() {
    clearTimeout(hideTimer);
    bar?.classList.remove("is-visible");
    target?.classList.remove("hof-colops-target");
    target = null;
  }
  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hide, 220);
  }
  // Çubuk başlığın üst kenarına, ortasına oturur; tablonun görünen alanının dışına taşmaz.
  function place(th) {
    const rect = th.getBoundingClientRect();
    const clip = th.closest(".dynamic-table-wrap")?.getBoundingClientRect() || rect;
    const left = Math.max(rect.left, clip.left);
    const right = Math.min(rect.right, clip.right);
    if (right - left < 24 || rect.bottom < 0 || rect.top > window.innerHeight) return hide();
    const element = ensureBar();
    element.classList.add("is-visible");
    const width = element.offsetWidth;
    const x = Math.min(Math.max(clip.left + 4, (left + right) / 2 - width / 2), clip.right - width - 4);
    element.style.left = `${Math.round(x)}px`;
    element.style.top = `${Math.round(rect.top - element.offsetHeight / 2)}px`;
    if (target !== th) {
      target?.classList.remove("hof-colops-target");
      th.classList.add("hof-colops-target");
    }
    target = th;
  }

  document.addEventListener("mouseover", event => {
    const node = event.target;
    if (!node?.closest) return;
    if (node.closest(".hof-colops")) return clearTimeout(hideTimer);
    const th = node.closest(".dynamic-table thead th");
    // Genişlik tutamacını sürüklerken çubuk çıkmaz.
    if (th && allowed() && !th.closest(".hof-col-dragging") && !node.closest(".hof-col-grip")) {
      clearTimeout(hideTimer);
      place(th);
      return;
    }
    if (target) scheduleHide();
  });
  const follow = () => {
    if (target) target.isConnected ? place(target) : hide();
  };
  window.addEventListener("scroll", follow, true);
  window.addEventListener("resize", follow);

  // Eklenen sütuna kaydırır ve kısa süre vurgular (tablo yeniden çizilene kadar bekler).
  function reveal(column) {
    const started = Date.now();
    const look = () => {
      const table = document.querySelector(".dynamic-table");
      const heads = table ? HOF.tableHeaders(table) : [];
      const index = heads.indexOf(column);
      if (index < 0) {
        if (Date.now() - started < 5000) requestAnimationFrame(look);
        return;
      }
      const th = table.tHead.rows[0].cells[index];
      th.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
      const cells = [th, ...[...table.tBodies[0].rows].slice(0, 60).map(row => row.cells[index]).filter(Boolean)];
      for (const cell of cells) {
        cell.classList.remove("hof-col-flash");
        void cell.offsetWidth;
        cell.classList.add("hof-col-flash");
        setTimeout(() => cell.classList.remove("hof-col-flash"), 2000);
      }
    };
    requestAnimationFrame(look);
  }

  function addColumn(th) {
    const after = HOF.columnOf(th);
    const tab = activeTab();
    const count = tabRows().length;
    HOF.formModal({
      title: "Sütun Ekle",
      eyebrow: tab ? `TABLO · ${tab}` : "TABLO",
      introHtml: `<p class="hof-modal-text">“<b>${esc(labelOf(after))}</b>” sütununun hemen sağına${count ? `, bu sekmedeki <b>${count.toLocaleString("tr-TR")} satırın</b> hepsine boş hücreyle` : ""} yeni bir sütun eklenir. Değerleri kartta <b>✎</b> ya da <b>Düzenle</b> ile yazılır. Kaynak Excel/Sheets dosyanız değişmez.</p>`,
      fields: [{ name: "name", label: "Sütun Adı", value: "Yeni sütun", maxlength: 60, required: true, autofocus: true }],
      submitLabel: "Sütunu Ekle",
      onOpen: dialog => dialog.querySelector('input[name="name"]')?.select(),
      onSubmit: async data => {
        const result = await HOF.api("/api/workspace/columns/add", { method: "POST", body: { tab, after, name: data.name } });
        HOF.refreshData();
        reveal(result.name);
        HOF.toast(`“${result.name}” sütunu eklendi.`, {
          type: "success",
          action: {
            label: "Geri Al",
            onClick: async () => {
              try {
                await HOF.api("/api/workspace/columns/hide", { method: "POST", body: { tab, column: result.name } });
                HOF.refreshData();
              } catch (error) {
                HOF.toastError(error);
              }
            },
          },
        });
      },
    });
  }

  async function removeColumn(th) {
    const column = HOF.columnOf(th);
    const label = labelOf(column);
    const tab = activeTab();
    const filled = tabRows().filter(row => String(row[column] ?? "").trim()).length;
    if (filled) {
      const confirmed = await HOF.confirm({
        title: `“${label}” sütununu sil`,
        message: `Bu sütun ${filled.toLocaleString("tr-TR")} kayıtta dolu. Sütun başlığı ve tüm satırlardaki hücreleriyle tablodan, kartlardan, aramadan ve Excel çıktısından kalkar; sağdaki sütunlar sola kayar. Kaynak Excel/Sheets dosyanız değişmez; Yönetim → Silinenler'den geri yüklenir.`,
        confirmLabel: "Sütunu Sil",
        danger: true,
      });
      if (!confirmed) return;
    }
    try {
      const result = await HOF.api("/api/workspace/columns/hide", { method: "POST", body: { tab, column } });
      HOF.refreshData();
      HOF.toast(`“${label}” sütunu silindi${filled ? ` (${filled.toLocaleString("tr-TR")} dolu hücre)` : ""}.`, {
        type: "success",
        action: {
          label: "Geri Al",
          onClick: async () => {
            try {
              await HOF.api("/api/workspace/columns/unhide", { method: "POST", body: { tab: result.tab, column } });
              HOF.refreshData();
              reveal(column);
            } catch (error) {
              HOF.toastError(error);
            }
          },
        },
      });
    } catch (error) {
      HOF.toastError(error);
    }
  }

  HOF.colops = { hide };
})();
