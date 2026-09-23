(() => {
  const normalize = value => String(value || "").toLocaleLowerCase("tr-TR").replace(/[İI]/g, "i").replace(/ı/g, "i").replace(/\s+/g, " ").trim();
  const install = () => {
    const input = document.querySelector('.search-field input');
    if (!input) return;
    input.placeholder = "Dosya no, müvekkil, borçlu veya telefon ara…";
    input.setAttribute("aria-label", "Dosya numarası, müvekkil, borçlu veya telefon ara");
    const field = input.closest(".search-field");
    if (!field || field.querySelector(".smart-search-hint")) return;
    const hint = document.createElement("span");
    hint.className = "smart-search-hint";
    hint.textContent = "Dosya no · Müvekkil · Borçlu · Telefon";
    field.appendChild(hint);
    input.addEventListener("keydown", event => {
      if (event.key !== "Enter") return;
      const query = normalize(input.value);
      if (!query) return;
      const rows = [...document.querySelectorAll(".dynamic-table tbody tr")];
      const match = rows.find(row => normalize(row.textContent).includes(query));
      if (match) {
        match.scrollIntoView({ behavior: "smooth", block: "center" });
        match.click();
        match.classList.add("smart-search-hit");
        setTimeout(() => match.classList.remove("smart-search-hit"), 1600);
      }
    });
  };
  document.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      document.querySelector('.search-field input')?.focus();
    }
  });
  new MutationObserver(install).observe(document.documentElement, { childList: true, subtree: true });
  install();
})();
