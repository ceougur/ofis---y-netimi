/* DestekOfis — Yönetim → Yedekler → Devir Yedekleri (2.5.0 D2; sunucu routes/devir.mjs, lib/devir/devir-backups.mjs; docs/devir/D2-ALTYAPI-TASARIM.md §6).
   Kalıcı devir yedekleri rutin yedeklerden AYRI listelenir (ayrı klasör, budanmaz). Liste yalnız okur; "Doğrula" her dosyanın özetini bildirgeyle karşılaştırır.
   Geri yükleme bu bölümde YOK: devir yedeğine dönüş Yıl Sonu Devri → Devri Geri Al akışının işidir (D4). Bölüm, Yedekler sekmesi her görünür olduğunda yeniden yüklenir
   (admin.js'e dokunmadan: sekmenin hidden özniteliği izlenir). */
(() => {
  "use strict";
  const HOF = window.HOF;
  const esc = value => HOF.esc(value);
  const $ = selector => document.querySelector(selector);
  const STATE = { tamam: "Tamam", yarim: "Yarım Kaldı", bozuk: "Okunamadı" };
  const size = bytes => {
    const value = Number(bytes) || 0;
    if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} GB`;
    if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} MB`;
    return `${Math.max(1, Math.round(value / 1024)).toLocaleString("tr-TR")} KB`;
  };
  let rows = [];

  function render() {
    const body = $("#adm-devir-backups-body");
    if (!body) return;
    body.innerHTML = rows.length
      ? rows
          .map(
            (item, index) => `<tr data-devir-backup="${index}">
              <td><b>${esc(item.companyLabel || "")}</b></td>
              <td><code>${esc(item.name)}</code>${item.year ? `<br><small class="adm-muted">${esc(item.year)} yılı · ${esc(item.label || "")}</small>` : ""}</td>
              <td>${item.createdAt ? esc(HOF.formatDateTime(item.createdAt)) : "—"}</td>
              <td class="adm-right">${item.state === "tamam" ? esc(size(item.size)) : "—"}</td>
              <td data-devir-state>${esc(STATE[item.state] || item.state)}</td>
              <td class="adm-right adm-row-actions">${item.state === "tamam" ? '<button type="button" class="hof-button hof-button-ghost hof-button-small" data-devir-verify>Doğrula</button>' : ""}</td>
            </tr>`,
          )
          .join("")
      : '<tr><td colspan="6" class="adm-muted">Henüz devir yedeği yok. Yıl sonu devri yapıldığında burada görünür.</td></tr>';
  }

  async function load() {
    const body = $("#adm-devir-backups-body");
    if (!body) return;
    try {
      rows = (await HOF.api("/api/admin/devir/backups")).backups || [];
      render();
    } catch (error) {
      body.innerHTML = `<tr><td colspan="6">${esc(error.message)}</td></tr>`;
    }
  }

  document.addEventListener("click", async event => {
    const button = event.target.closest("[data-devir-verify]");
    if (!button) return;
    const row = button.closest("[data-devir-backup]");
    const item = rows[Number(row?.dataset.devirBackup)];
    if (!item) return;
    button.disabled = true;
    try {
      const result = await HOF.api("/api/admin/devir/backups/verify", { method: "POST", body: { company: item.companyId, name: item.name }, timeoutMs: 600000 });
      const cell = row.querySelector("[data-devir-state]");
      if (result.ok) {
        cell.textContent = "Doğrulandı";
        HOF.toast(`Devir yedeği doğrulandı: ${result.files} dosyanın hepsi yerinde ve değişmemiş.`, { type: "success" });
      } else {
        cell.textContent = "Sorunlu";
        const parts = [result.missing?.length ? `${result.missing.length} dosya eksik` : "", result.changed?.length ? `${result.changed.length} dosya değişmiş` : "", result.extra?.length ? `${result.extra.length} fazla dosya` : "", result.error || ""].filter(Boolean);
        HOF.toast(`Devir yedeğinde sorun var: ${parts.join(", ")}. Yedeği değiştirmeyin; destek isteyin.`, { type: "error", timeout: 10000 });
      }
    } catch (error) {
      HOF.toastError(error);
    } finally {
      button.disabled = false;
    }
  });

  // Yedekler sekmesi görünür olunca (admin.js loaders.backups ile aynı anda) liste tazelenir.
  const start = () => {
    const panel = document.querySelector('[data-panel="backups"]');
    if (!panel) return;
    let shown = !panel.hidden;
    if (shown) load();
    new MutationObserver(() => {
      if (!panel.hidden && !shown) load();
      shown = !panel.hidden;
    }).observe(panel, { attributes: true, attributeFilter: ["hidden"] });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
  HOF.devirBackups = { load };
})();
