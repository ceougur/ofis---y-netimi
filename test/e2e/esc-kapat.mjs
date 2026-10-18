// 2.4.3 (kullanıcı kararı, keşif A4 / B4 / C1): kaydedilmemiş değişikliği olan form Esc / × / dışarı tıklamada "Kaydedilmemiş Değişiklik"
// sorar. Senaryoların "pencereyi kapat" adımı Esc'e basar; soru çıkarsa "Kaydetmeden Kapat" ile kapatır (önceki davranış: sorusuz kapanırdı).
// Soru çıkmazsa (temiz form, açık öneri listesi, pencere değil) yalnız Esc'e basılmış olur.
//
// Ana oturum ek maddesi (anayasa gözden geçirmesi, kör nokta — 18.10.2026): soru SESSİZCE onaylanınca YANLIŞ çıkan sorular (başarılı Kaydet'ten
// sonra, hiçbir alana dokunulmamışken, yalnız görüntüleme penceresinde, arka plan yenilemesinden sonra) gizlenir. Artık:
//  - ESC_KAPAT_GUNLUK=<dosya> verilirse soru her çıktığında bir JSON satırı yazılır: senaryo, çağıran satır (adım), adım adı (verilirse), kapanan
//    pencerenin başlığı ve dokunulmuş alanlar (HOF.isTouched; ad, etiket, kısaltılmış değer, kayıtlı değerden farklı mı).
//  - isteğe bağlı beklenti: escClose(page, { expect: "soru-yok" }) soru çıkarsa, { expect: "soru-var" } çıkmazsa HATA atar (adım kırmızı).
import { appendFileSync } from "node:fs";
import path from "node:path";

function caller() {
  const lines = String(new Error().stack || "").split(/\r?\n/).slice(2);
  const own = lines.find(line => !line.includes("esc-kapat.mjs")) || "";
  const match = /([^/\\(\s]+\.mjs):(\d+)/.exec(own);
  return match ? `${match[1]}:${match[2]}` : "";
}

export async function escClose(page, { expect = "", step = "" } = {}) {
  await page.keyboard.press("Escape");
  const question = page.locator(".hof-modal-backdrop", { hasText: "Kaydedilmemiş Değişiklik" }).locator('[data-answer="yes"]');
  const asked = (await question.count()) > 0;
  if (asked && process.env.ESC_KAPAT_GUNLUK) {
    const info = await page
      .evaluate(() => {
        const visible = [...document.querySelectorAll(".hof-modal-backdrop.is-visible .hof-modal")];
        const form = visible.filter(node => !/Kaydedilmemiş Değişiklik/.test(node.querySelector(".hof-modal-title")?.textContent || "")).at(-1);
        const fields = form ? [...form.querySelectorAll("input, textarea, select")].filter(node => window.HOF?.isTouched?.(node)) : [];
        const labelOf = node => (node.closest("label")?.querySelector("span")?.textContent || node.getAttribute("aria-label") || node.name || node.dataset.f || "").trim().slice(0, 60);
        const changed = node => (node.type === "checkbox" || node.type === "radio" ? node.checked !== node.defaultChecked : node.tagName === "SELECT" ? [...node.options].some(option => option.selected !== option.defaultSelected) : node.value !== node.defaultValue);
        return { title: (form?.querySelector(".hof-modal-title")?.textContent || "").trim().slice(0, 80), forms: form ? form.querySelectorAll("form, [data-hof-form]").length : 0, touched: fields.map(node => ({ name: node.name || node.dataset.f || "", label: labelOf(node), value: String(node.type === "checkbox" ? node.checked : node.value).slice(0, 40), changed: changed(node) })) };
      })
      .catch(error => ({ error: String(error?.message || error).slice(0, 120) }));
    const line = { senaryo: path.basename(process.argv[1] || ""), adim: step, yer: caller(), beklenti: expect, ...info, at: new Date().toISOString() };
    try {
      appendFileSync(process.env.ESC_KAPAT_GUNLUK, `${JSON.stringify(line)}\n`);
    } catch {
      /* günlük yazılamazsa koşu sürer (günlük yalnız ek denetim) */
    }
  }
  if (asked) {
    await question.last().click().catch(() => null);
    await page.waitForTimeout(200);
  }
  if (expect === "soru-yok" && asked) throw new Error(`escClose: "Kaydedilmemiş Değişiklik" sorusu çıkmamalıydı (${step || caller()})`);
  if (expect === "soru-var" && !asked) throw new Error(`escClose: "Kaydedilmemiş Değişiklik" sorusu çıkmalıydı (${step || caller()})`);
  return asked;
}
