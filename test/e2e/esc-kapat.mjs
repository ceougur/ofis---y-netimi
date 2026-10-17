// 2.4.3 (kullanıcı kararı, keşif A4 / B4 / C1): kaydedilmemiş değişikliği olan form Esc / × / dışarı tıklamada "Kaydedilmemiş Değişiklik"
// sorar. Senaryoların "pencereyi kapat" adımı Esc'e basar; soru çıkarsa "Kaydetmeden Kapat" ile kapatır (önceki davranış: sorusuz kapanırdı).
// Soru çıkmazsa (temiz form, açık öneri listesi, pencere değil) yalnız Esc'e basılmış olur.
export async function escClose(page) {
  await page.keyboard.press("Escape");
  const question = page.locator(".hof-modal-backdrop", { hasText: "Kaydedilmemiş Değişiklik" }).locator('[data-answer="yes"]');
  if (await question.count()) {
    await question.last().click().catch(() => null);
    await page.waitForTimeout(200);
  }
}
