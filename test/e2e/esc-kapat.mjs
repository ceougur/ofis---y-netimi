// 2.4.3 (kullanıcı kararı, keşif A4 / B4 / C1): kaydedilmemiş değişikliği olan form Esc / × / dışarı tıklamada "Kaydedilmemiş Değişiklik"
// sorar. Senaryoların "pencereyi kapat" adımı Esc'e basar; soru çıkarsa "Kaydetmeden Kapat" ile kapatır (önceki davranış: sorusuz kapanırdı).
// Soru çıkmazsa (temiz form, açık öneri listesi, pencere değil) yalnız Esc'e basılmış olur.
//
// Ana oturum ek maddesi (anayasa gözden geçirmesi, kör nokta — 18.10.2026): soru SESSİZCE onaylanınca YANLIŞ çıkan sorular (başarılı Kaydet'ten
// sonra, hiçbir alana dokunulmamışken, yalnız görüntüleme penceresinde, arka plan yenilemesinden sonra) gizlenir. Artık:
//  - ESC_KAPAT_GUNLUK=<dosya> verilirse soru her çıktığında bir JSON satırı yazılır: senaryo, çağıran satır (adım), adım adı (verilirse), kapanan
//    pencerenin başlığı ve dokunulmuş alanlar (HOF.isTouched; ad, etiket, kısaltılmış değer, kayıtlı değerden farklı mı).
//  - isteğe bağlı beklenti: escClose(page, { expect: "soru-yok" }) soru çıkarsa, { expect: "soru-var" } çıkmazsa HATA atar (adım kırmızı).
//  - Ders 34 sınıflaması (esc-sinif-243): "touched" yalnız ŞU AN ekranda duran dokunulmuş alanları görür. hof-core'un kirlilik hesabı iki kaynaklıdır:
//    (1) dokunulmuş ve kayıtlı değerinden farklı alan, (2) KAPSAM — pencere içi formda ([data-hof-form], ör. fatura formu, Fatura Ayarları) ya da
//    <form> penceresinde herhangi bir alana kullanıcı eliyle dokunulduysa kapsam öğesi ekranda kaldıkça kirli (kalem satırları, cari seçici her
//    hesaplamada yeniden çizilir; yeni çizilen düğüm "dokunulmuş" değildir, defaultValue da formun durumundan gelir → "touched" boş görünür).
//    Bu yüzden satıra ayrıca yazılır: neden ("alan" | "kapsam" | "kapatma-sorusu"), kapsam öğeleri (data-hof-form değerleri, <form> var mı),
//    formdaki DOLU taslak alanları (kalem satırları data-l/data-f, cari seçici data-acc-query dahil; kayıtlı/çizilen değerden farklı mı) ve
//    çağrı zinciri (closeAll gibi yardımcıların içinden çağrılınca adımın gerçek satırı). Senaryo globalThis.__escKapatEk = () => ({…}) verirse
//    (ör. veri tabanındaki fatura sayısı) "ek" alanına yazılır. Özet: test/e2e/esc-kapat-ozet.mjs <jsonl>.
import { appendFileSync } from "node:fs";
import path from "node:path";

function callers() {
  const lines = String(new Error().stack || "").split(/\r?\n/).slice(2);
  return lines
    .filter(line => !line.includes("esc-kapat.mjs") && !line.includes("node:internal"))
    .map(line => /([^/\\(\s]+\.mjs):(\d+)/.exec(line))
    .filter(Boolean)
    .map(match => `${match[1]}:${match[2]}`)
    .slice(0, 4);
}
const caller = () => callers()[0] || "";

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
        const nameOf = node => (node.dataset.l !== undefined ? `kalem${node.dataset.l}.${node.dataset.f || node.name || ""}` : node.hasAttribute("data-acc-query") ? "cari" : node.name || node.dataset.f || node.dataset.s || node.dataset.i || "");
        const draft = form ? [...form.querySelectorAll("input, textarea, select")].filter(node => window.HOF?.isDraftField?.(node) && node.getClientRects().length) : [];
        const filled = draft.filter(node => (node.type === "checkbox" || node.type === "radio" ? node.checked : String(node.value).trim() !== ""));
        const changedTouched = fields.filter(changed);
        return {
          title: (form?.querySelector(".hof-modal-title")?.textContent || "").trim().slice(0, 80),
          // Pencere içi formun başlığı (fatura: "Yeni …" / "Taslak: …" / "Düzenleme: …") — düzenleme formunda dolu alan kullanıcı girdisi değildir.
          altBaslik: (form?.querySelector("[data-hof-form] .hof-plan-title h3, [data-hof-form] h3")?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80),
          forms: form ? form.querySelectorAll("form, [data-hof-form]").length : 0,
          // hof-core isDirty(): önce kapsam, sonra dokunulmuş + değişmiş alan. Değişmiş dokunulmuş alan yoksa soru kapsamdan (ya da pencerenin kendi beforeClose'undan) gelmiştir.
          neden: changedTouched.length ? "alan" : form && form.querySelector("form, [data-hof-form]") ? "kapsam" : "kapatma-sorusu",
          kapsam: form ? [...form.querySelectorAll("[data-hof-form]")].map(node => node.getAttribute("data-hof-form")).concat(form.querySelector("form") ? ["<form>"] : []) : [],
          touched: fields.map(node => ({ name: nameOf(node), label: labelOf(node), value: String(node.type === "checkbox" ? node.checked : node.value).slice(0, 40), changed: changed(node) })),
          dolu: filled.slice(0, 30).map(node => ({ name: nameOf(node), label: labelOf(node), value: String(node.type === "checkbox" || node.type === "radio" ? node.checked : node.value).slice(0, 40), changed: changed(node), touched: Boolean(window.HOF?.isTouched?.(node)) })),
          doluSayi: filled.length,
        };
      })
      .catch(error => ({ error: String(error?.message || error).slice(0, 120) }));
    // Senaryo isterse veri tabanından ek bilgi verir (ör. o anki fatura sayısı: kaydedilmemiş mi, veri tabanı okunarak — ders 12/34).
    const extra = typeof globalThis.__escKapatEk === "function" ? await Promise.resolve(globalThis.__escKapatEk()).catch(error => ({ ekHata: String(error?.message || error) })) : undefined;
    const chain = callers();
    const line = { senaryo: path.basename(process.argv[1] || ""), adim: step, yer: chain[0] || "", zincir: chain, beklenti: expect, ...info, ...(extra ? { ek: extra } : {}), at: new Date().toISOString() };
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
