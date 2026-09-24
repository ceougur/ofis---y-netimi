/* DestekOfis — akıllı arama: Türkçe karakter duyarsız eşleşme, Enter ile ilk sonuca gitme, Ctrl+K kısayolu. */
(() => {
  "use strict";
  const HOF = window.HOF;

  function install() {
    const input = document.querySelector(".search-field input");
    if (!input || input.dataset.hofSearch) return;
    input.dataset.hofSearch = "1";
    input.placeholder = "Dosya no, müvekkil, borçlu veya telefon ara…";
    input.setAttribute("aria-label", "Dosya numarası, müvekkil, borçlu veya telefon ara");
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
  HOF.whenReady(() => HOF.onDom(install));
})();
