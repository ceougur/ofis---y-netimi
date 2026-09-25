/* DestekOfis — akıllı arama: Türkçe karakter duyarsız eşleşme, Enter ile ilk sonuca gitme (gerekirse sonucun sekmesine
 * geçerek), Ctrl+K kısayolu. */
(() => {
  "use strict";
  const HOF = window.HOF;

  // İpucu verideki gerçek kolon adlarından gelir ("Hasta no, ad soyad veya telefon ara…"; hof-insight.js).
  const placeholder = () => (HOF.searchPlaceholder ? HOF.searchPlaceholder() : "Tabloda ara…");
  function install() {
    const input = document.querySelector(".search-field input");
    if (!input) return;
    const text = placeholder();
    if (input.placeholder !== text) {
      input.placeholder = text;
      input.setAttribute("aria-label", text.replace(/…$/, ""));
    }
    if (input.dataset.hofSearch) return;
    input.dataset.hofSearch = "1";
    const field = input.closest(".search-field");
    if (field && !field.querySelector(".smart-search-hint")) field.appendChild(HOF.el("span", { class: "smart-search-hint", text: "Enter · ilk sonuca git  ·  Ctrl+K" }));
    // Enter: açık sekmedeki ilk sonuca, açık sekmede sonuç yoksa sonucu olan ilk sekmedeki ilk kayda gider (v1.7.0: "Tümü"
    // sekmesi olmadığından arama her sekmeyi tarar; sekme düğmeleri eşleşme sayısını gösterir).
    input.addEventListener("keydown", async event => {
      if (event.key !== "Enter") return;
      const query = HOF.normalize(input.value);
      if (!query) return;
      const rows = [...document.querySelectorAll(".dynamic-table tbody tr")];
      const match = rows.find(row => HOF.normalize(row.textContent).includes(query));
      if (match) {
        HOF.table?.revealRow(match);
        if (!match.classList.contains("selected")) match.click();
        HOF.flashRow(match);
        return;
      }
      // Paketin arama kuralıyla aynı: küçük harfe çevrilmiş değerlerde geçiyor mu (sekmeye geçince tabloda görünsün).
      const exact = input.value.trim().toLocaleLowerCase("tr-TR");
      const order = HOF.tabLabels ? HOF.tabLabels() : [];
      const rank = row => {
        const index = order.indexOf(String(row.__sheet || "").trim());
        return index < 0 ? order.length : index;
      };
      const hits = (HOF.data?.rows || []).filter(row => row.__hofKey && Object.values(row).join(" ").toLocaleLowerCase("tr-TR").includes(exact));
      if (!hits.length) return HOF.toast("Eşleşen kayıt bulunamadı.");
      hits.sort((a, b) => rank(a) - rank(b));
      await HOF.revealRecord?.(hits[0].__hofKey, { keepSearch: true });
    });
  }

  document.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      const input = document.querySelector(".search-field input");
      if (!input) return;
      event.preventDefault();
      input.focus();
      input.select();
    }
  });
  HOF.on("insight", install);
  HOF.whenReady(() => HOF.onDom(install));
})();
