/* DestekOfis — akıllı arama: Türkçe karakter duyarsız eşleşme, Enter ile ilk sonuca gitme, Ctrl+K kısayolu. */
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
    input.addEventListener("keydown", event => {
      if (event.key !== "Enter") return;
      const query = HOF.normalize(input.value);
      if (!query) return;
      const rows = [...document.querySelectorAll(".dynamic-table tbody tr")];
      const match = rows.find(row => HOF.normalize(row.textContent).includes(query));
      if (!match) return HOF.toast("Eşleşen kayıt bulunamadı.");
      HOF.table?.revealRow(match);
      match.scrollIntoView({ behavior: "smooth", block: "center" });
      match.click();
      match.classList.add("smart-search-hit");
      setTimeout(() => match.classList.remove("smart-search-hit"), 1600);
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
