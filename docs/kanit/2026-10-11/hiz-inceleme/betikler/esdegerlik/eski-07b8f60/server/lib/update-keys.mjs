// Güncelleme paketlerini imzalayan anahtarların AÇIK (public) kısımları. Uygulama yalnızca bu listedeki bir
// anahtarla imzalanmış güncelleme bildirgelerini kabul eder.
//
// Anahtar değiştirme (rotasyon): yeni anahtarın açık kısmını buraya ekleyip eski anahtarla imzalanmış bir sürüm
// yayımlayın; tüm kurulumlar o sürüme geçtikten sonra yeni anahtarla imzalamaya başlayıp eski anahtarı çıkarın.
// Gizli anahtar hiçbir zaman depoya girmez (GitHub Actions gizli değişkeni DESTEKOFIS_RELEASE_KEY).
export const TRUSTED_UPDATE_KEYS = Object.freeze({
  // SHA-256 parmak izi (ilk 16): 2817e154132ada8a
  "destekofis-2026-1": "MCowBQYDK2VwAyEAaQ6SwXoFeyb9SFqNj0ptAYFmCJgoCn/kwXZ9x1YgX50=",
});
