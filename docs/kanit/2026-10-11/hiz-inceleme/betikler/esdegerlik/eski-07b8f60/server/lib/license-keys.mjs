// Lisans belirteçlerini imzalayan anahtarların AÇIK (public) kısımları. Uygulama yalnızca bu listedeki bir anahtarla
// imzalanmış lisans belirtecini (lisans servisi yanıtı veya internetsiz etkinleştirme kodu) kabul eder.
//
// Bu anahtar güncelleme imza anahtarından (update-keys.mjs) AYRIDIR: lisans servisi (Vercel) bu gizli anahtarı
// taşır; ele geçirilirse yalnızca lisans üretilebilir, güncelleme gönderilemez.
// Gizli anahtar hiçbir zaman depoya girmez (Vercel ortam değişkeni DESTEKOFIS_LICENSE_KEY; operatör bilgisayarında
// parola yöneticisi veya şifreli USB). Anahtar değiştirme: yeni açık anahtarı buraya EKLEYİN, bu sürüm tüm
// kurulumlara ulaştıktan sonra servisi yeni anahtarla imzalatın, eski anahtarı bir sonraki sürümde çıkarın.
export const TRUSTED_LICENSE_KEYS = Object.freeze({
  // SHA-256 parmak izi (ilk 16): 49cc9e7174dda649
  "destekofis-lisans-2026-1": "MCowBQYDK2VwAyEAZRdIMB11WVitpkoOEgCZDF/ULwhcsQ2mUuv9fl8Td7c=",
});
