(() => {
  const sourceUrl = () => localStorage.getItem("hukuk-ofisi-sheet-url") || "";
  const trpc = async (path, input, method = "GET") => {
    const encoded = encodeURIComponent(JSON.stringify({ json: input }));
    const response = await fetch(method === "GET" ? `/api/trpc/${path}?input=${encoded}` : `/api/trpc/${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: method === "GET" ? undefined : JSON.stringify({ json: input }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error?.json?.message || "API isteği başarısız");
    return payload?.result?.data?.json ?? payload?.result?.data ?? payload;
  };
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const open = (analysis) => {
    const existing = document.getElementById("hof-ai-modal");
    if (existing) existing.remove();
    const mappings = (analysis.fieldMappings || []).map(item => `<div class="hof-ai-map"><span>${esc(item.semantic)}</span><b>${esc(item.sourceColumn)}</b><em>${Math.round(Number(item.confidence || 0) * 100)}%</em></div>`).join("");
    const warnings = (analysis.warnings || []).map(item => `<li>${esc(item)}</li>`).join("");
    const modal = document.createElement("div");
    modal.id = "hof-ai-modal";
    modal.innerHTML = `<div class="hof-ai-backdrop"><section class="hof-ai-dialog" role="dialog" aria-modal="true"><button class="hof-ai-close" aria-label="Kapat">×</button><p class="eyebrow">AI VERİ MİMARI</p><h2>Tablonun anlam haritası hazır</h2><p class="hof-ai-summary">${esc(analysis.summary)}</p><div class="hof-ai-score"><strong>${Math.round(Number(analysis.confidence || 0) * 100)}%</strong><span>eşleşme kapsamı · ${analysis.mode === "ai" ? "AI analizi" : "güvenli kolon analizi"}</span></div><p class="hof-ai-explain"><b>Bu yüzde ne demek?</b> Sistem, kolon başlıklarının hukuk bürosu alanlarıyla ne kadar anlaşılır biçimde eşleştiğini gösterir. Bu ekran veriyi kendiliğinden değiştirmez; yalnızca aşağıdaki bağlantıları önerir.</p><div class="hof-ai-mappings"><h3>Kurulan bağlantılar</h3>${mappings || "<p>Güvenilir bir alan eşleşmesi bulunamadı.</p>"}</div>${warnings ? `<div class="hof-ai-warnings"><h3>Dikkat edilmesi gerekenler</h3><ul>${warnings}</ul></div>` : ""}<div class="hof-ai-actions"><button class="secondary-button hof-ai-cancel">Vazgeç</button><button class="primary-button hof-ai-apply">Eşlemeyi kaydet</button></div></section></div>`;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector(".hof-ai-close").onclick = close;
    modal.querySelector(".hof-ai-cancel").onclick = close;
    modal.querySelector(".hof-ai-backdrop").onclick = event => { if (event.target === event.currentTarget) close(); };
    modal.querySelector(".hof-ai-apply").onclick = () => {
      const mapping = Object.fromEntries((analysis.fieldMappings || []).filter(item => Number(item.confidence || 0) >= .60).map(item => [item.semantic, item.sourceColumn]));
      localStorage.setItem("hukuk-ofisi-ai-mapping", JSON.stringify(mapping));
      localStorage.setItem("hukuk-ofisi-ai-analysis", JSON.stringify(analysis));
      close();
      const notice = document.createElement("div");
      notice.className = "hof-ai-applied-notice";
      notice.textContent = `${Object.keys(mapping).length} AI eşlemesi kaydedildi. Verileriniz değiştirilmedi.`;
      document.body.appendChild(notice);
      setTimeout(() => notice.remove(), 4200);
    };
  };
  const analyze = async (button) => {
    button.disabled = true;
    button.dataset.original = button.textContent;
    button.textContent = "Analiz ediliyor…";
    try {
      const loaded = await trpc("sheets.getRows", { sheetUrl: sourceUrl() });
      if (!loaded?.rows?.length) throw new Error("Analiz edilecek kayıt bulunamadı.");
      const response = await fetch("/api/ai/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sourceName: loaded.sourceUrl || "Çalışma tablosu", rows: loaded.rows }) });
      if (!response.ok) throw new Error("AI analiz servisi yanıt vermedi.");
      const analysis = await response.json();
      open(analysis);
    } catch (error) {
      window.alert(error?.message || "AI analizi tamamlanamadı.");
    } finally {
      button.disabled = false;
      button.textContent = button.dataset.original || "AI ile analiz et";
    }
  };
  const install = () => {
    if (document.getElementById("hof-ai-button")) return;
    const actions = document.querySelector(".top-actions") || document.querySelector(".button-row");
    if (!actions) return;
    const button = document.createElement("button");
    button.id = "hof-ai-button";
    button.className = "secondary-button hof-ai-button";
    button.innerHTML = "✦ AI ile analiz et";
    button.onclick = () => analyze(button);
    actions.prepend(button);
  };
  const observer = new MutationObserver(install);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  install();
})();
