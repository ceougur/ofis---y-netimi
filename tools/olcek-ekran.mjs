// Ölçek aracının (tools/olcek-210.mjs) EKRANDAN KAYIT adımı — 13.10.2026, 2.2.0 BİLİNEN SINIR'ın kök nedeni (docs/2.2.0-KANIT.md: "20 kullanıcıda
// Banka → Hareketler, ekrandan kaydedilen masraf 30 sn'de listede görünmedi").
//
// Kayıttan okunan gerçek (docs/kanit/2026-10-12/son-aday-220/olcek-sonuc.json düzey 20 E19; olcek-20-tekrar.json E27): görünmeyen iki masrafın
// ikisi de VERİ TABANINDA YOKTU (veritabaninda 0) — liste gecikmesi değil, kayıt hiç yazılmamıştı. İlk koşuda E19'dan sonraki iki turun
// "Daha Fazla" ve "+ Masraf" tıklamaları 30'ar sn engellendi: masraf formunun ÜSTÜNDE yanıtlanmamış bir soru kalmış, aracın tek Escape'i soruyu
// "Vazgeç"le kapatmış, form "Kaydedilmedi" hatasıyla açık kalmıştı. Ürünün sorusu Benzer İşlem (K8: aynı iş günü, hesap, tür, tutar ve masraf
// türü — 20 kullanıcı aynı iki hesaba bugün tarihli rastgele tutarlı masraf yazarken tutar çakışması) ya da Eksi Bakiye'dir (K7). Eski adım
// Kaydet'ten sonra soruyu yalnız 1,2 sn bekliyordu (answerConfirms); yük altında 409 yanıtı daha geç gelince (20 kullanıcıda yazım p95
// 1,3–1,6 sn, yedek sırasında 10 sn'ye kadar) soru kaçıyor, 30 sn'lik liste beklemesi boşa geçiyordu. 10 kullanıcıda ve 2.1.0'da görülmemesi:
// daha az çakışma, daha kısa yanıt (soru 1,2 sn içinde gelip yanıtlanıyordu). Zorla üretimi: test/e2e/banka-230-hareket-yaris.mjs.
//
// Bu adım: Kaydet'ten sonra liste beklemesi BOYUNCA üstte beliren her soruya ("Yine de Kaydet") gerçek tıklamayla yanıt verir, yanıtlanan
// soruların başlığını ve zamanını, bu sırada dönen POST /vouchers yanıt durumlarını kaydeder; formda hata yazısı belirirse (kayıt olmadı)
// beklemeyi keser ve yazıyı döndürür. Böylece kayıt kaybolmaz ve kaybolursa NEDENİ kayıtta okunur (ders 20: düşen isteğin kimin olduğu kayıttan
// okunur). Playwright sayfasıyla çalışır; ürün koduna dokunmaz.
import { performance } from "node:perf_hooks";

const escapeRegExp = text => String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Formdaki Kaydet'e basar; satır listede görünene, formda hata belirene ya da süre dolana dek bekler; aradaki soruları yanıtlar.
 * submit: Kaydet düğmesi seçicisi; rows: liste satırı seçicisi; needle: satırda aranan iz (TAM eşleşir: "…-E1", "…-E11"in öneki sayılmaz);
 * timeoutMs: bekleme; modal: görünür pencere seçicisi; form: formun seçicisi; path: POST'un yolu (yanıt durumları için).
 * Dönüş: { listedeMs (−1: görünmedi), onaylar: [{ baslik, ms }], durumlar: [HTTP durumu…], hata: formdaki hata yazısı }.
 */
export async function ekranKaydet(page, { submit, rows, needle, timeoutMs = 30000, modal = ".hof-modal-backdrop.is-visible", form = "form.hof-bank-voucher", path = "/api/workspace/bank/vouchers" }) {
  const needleSrc = `${escapeRegExp(needle)}(?![0-9])`;
  const durumlar = [];
  const onResponse = response => {
    if (response.request().method() === "POST" && response.url().includes(path)) durumlar.push(response.status());
  };
  page.on("response", onResponse);
  const onaylar = [];
  let hata = "";
  let listedeMs = -1;
  const t0 = performance.now();
  try {
    await page.click(submit);
    while (performance.now() - t0 < timeoutMs) {
      const state = await page.evaluate(
        ({ rows, needleSrc, modal, form }) => {
          const re = new RegExp(needleSrc);
          const seen = [...document.querySelectorAll(rows)].some(row => re.test(row.textContent));
          const tops = document.querySelectorAll(modal);
          const top = tops[tops.length - 1];
          const yes = top?.querySelector('[data-answer="yes"]');
          const soru = yes ? (top.querySelector(".hof-modal-title")?.textContent || "").trim() || "(başlıksız soru)" : "";
          const formNode = document.querySelector(form);
          const error = formNode ? (formNode.querySelector(".hof-form-error")?.textContent || "").trim() : "";
          return { seen, soru, hata: error };
        },
        { rows, needleSrc, modal, form },
      );
      if (state.seen) {
        listedeMs = Math.round(performance.now() - t0);
        break;
      }
      if (state.soru) {
        // Üstteki soru: kullanıcı gibi "Yine de Kaydet". Üstteki pencere = görünür pencerelerin DOM'daki sonuncusu (HOF.modal sona ekler).
        await page.locator(modal).last().locator('[data-answer="yes"]').click({ timeout: 3000 }).catch(() => null);
        onaylar.push({ baslik: state.soru, ms: Math.round(performance.now() - t0) });
        continue;
      }
      if (state.hata) {
        hata = state.hata;
        break;
      }
      await page.waitForTimeout(100);
    }
    // Yanıt olayı sayfadaki satırdan sonra gelebilir (Playwright olayları eşzamansız): son durum kayda girsin.
    await page.waitForTimeout(200);
  } finally {
    page.off("response", onResponse);
  }
  return { listedeMs, onaylar, durumlar, hata };
}
