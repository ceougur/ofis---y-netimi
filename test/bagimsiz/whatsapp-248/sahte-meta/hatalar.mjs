// Sahte Meta Graph sunucusu — HATA KATALOĞU (DestekOfis 2.4.8, K0 bağımsız kâhin).
//
// KAYNAK: yalnız Meta belgesi "WhatsApp error codes" (support/error-codes, 30.10.2026 okundu) + template-management
// (100 / 2388024, 132018) + access-tokens (200 = varlık erişimi yok) + registration (133016). Programın kodu GÖRÜLMEDEN yazıldı.
// `details` metinleri belgedeki "details" sütunundan AYNEN; belgede ayrı başlık sütunu yok, `message` = "(#kod) <details>" (belgenin
// örneği "(#130429) Rate limit hit" — yalnız 130429'un başlığı belgede var). Meta "başlığa güvenmeyin, code + details kullanın" der.
//
// HTTP DURUM KODU: belgede yalnız Marketing Messages API tablosunda var (100 / 131009 / 131055 / 134100 / 134101 / 132018 → 400,
// 134102 → 500). Ötekiler için aşağıdaki eşleme bir VARSAYIMDIR (D0) — Meta "HTTP durumuna değil code'a göre işleyin" der; program
// HTTP durumuna dayanmamalı. Her kural `http` ile ezilebilir.

export const HATALAR = Object.freeze({
  // Yetki (Authorization errors)
  0: { details: "We were unable to authenticate the app user.", sinif: "yetki" },
  3: { details: "Capability or permissions issue.", sinif: "yetki" },
  10: { details: "Permission is either not granted or has been removed.", sinif: "yetki" },
  190: { details: "Your access token has expired.", sinif: "yetki" },
  200: { details: "Permission is either not granted or has been removed.", sinif: "yetki" },
  // Bütünlük (Integrity errors)
  368: { details: "The WhatsApp Business Account associated with the app has been restricted or disabled for violating a platform policy.", sinif: "hesap" },
  130497: { details: "The WhatsApp Business Account is restricted from messaging to users in certain countries.", sinif: "hesap" },
  131031: { details: "The WhatsApp Business Account associated with the app has been restricted or disabled for violating a platform policy, or we were unable to verify data included in the request against data set on the WhatsApp Business Account (e.g, the two-step pin included in the request is incorrect).", sinif: "hesap" },
  // Şablon oluşturma (Template creation errors) — kodlar belgede "Error" sütununda
  2388039: { details: "The status for this message template can't be changed. You can only delete or add templates.", sinif: "sablon-olusturma" },
  2388040: { details: "A field in your template has exceeded the maximum character limit allowed.", sinif: "sablon-olusturma" },
  2388047: { details: "Your message header contains invalid formatting.", sinif: "sablon-olusturma" },
  2388072: { details: "Your message body contains invalid formatting.", sinif: "sablon-olusturma" },
  2388073: { details: "Your message footer contains invalid formatting.", sinif: "sablon-olusturma" },
  2388293: { details: "This template has too many variables for its length. Reduce the number of variables or increase the message length.", sinif: "sablon-olusturma" },
  2388299: { details: "Variables cannot be at the start or end of the template.", sinif: "sablon-olusturma" },
  2388019: { details: "You have exceeded the maximum number of message templates you can have for this WhatsApp business account.", sinif: "sablon-olusturma" },
  // Eşitleme (birlikte kullanım)
  2593107: { details: "You have exceeded the maximum number of times to call the synchronization api for this phone number.", sinif: "esitleme" },
  2593108: { details: "Synchronization request can only be made within 24 hours of onboarding", sinif: "esitleme" },
  // Kısma (Throttling errors)
  4: { details: "The app has reached its API call rate limit.", sinif: "gecici" },
  80007: { details: "The WhatsApp Business Account has reached its rate limit.", sinif: "gecici" },
  130429: { details: "Cloud API message throughput has been reached.", sinif: "gecici", baslik: "Rate limit hit" },
  131048: { details: "Message failed to send because there are restrictions on how many messages can be sent from this phone number. This may be because too many previous messages were blocked or flagged as spam.", sinif: "kisma" },
  131056: { details: "Too many messages sent from the sender phone number to the same recipient phone number in a short period of time.", sinif: "gecici" },
  133016: { details: "Registration or Deregistration failed because there were too many attempts for this phone number in a short period of time", sinif: "kayit" },
  131064: { details: "Message failed to send because this account has reached its messaging limit due to template classification violations. This applies to both template messages and direct send messages.", sinif: "kisma" },
  // Diğer (Other errors)
  1: { details: "Invalid request or possible server error.", sinif: "diger" },
  2: { details: "Temporary due to downtime or due to being overloaded.", sinif: "diger" },
  33: { details: "The business phone number has been deleted.", sinif: "diger" },
  100: { details: "The request included one or more unsupported or misspelled parameters.", sinif: "parametre" },
  130403: { details: "Unable to deliver the message. This business has blocked the end user on WhatsApp", sinif: "alici" },
  130472: { details: "Message was not sent as part of an experiment.", sinif: "diger" },
  131000: { details: "Message failed to send due to an unknown error.", sinif: "gecici" },
  131005: { details: "Permission is either not granted or has been removed.", sinif: "yetki" },
  131008: { details: "The request is missing a required parameter.", sinif: "parametre" },
  131009: { details: "One or more parameter values are invalid.", sinif: "parametre" },
  131016: { details: "A service is temporarily unavailable.", sinif: "gecici" },
  131021: { details: "Sender and recipient phone number is the same.", sinif: "alici" },
  131026: { details: "Unable to deliver message.", sinif: "alici" },
  131037: { details: "The 555 business phone number used to send the request does not have an approved display name.", sinif: "hesap" },
  131042: { details: "There was an error related to your payment method.", sinif: "hesap" },
  131045: { details: "Message failed to send due to a phone number registration error.", sinif: "hesap" },
  131047: { details: "More than 24 hours have passed since the recipient last replied to the sender number.", sinif: "diger" },
  131049: { details: "This message was not delivered to maintain healthy ecosystem engagement.", sinif: "alici" },
  131050: { details: "Unable to deliver the message. This recipient has chosen to stop receiving marketing messages on WhatsApp from your business.", sinif: "alici" },
  131051: { details: "Unsupported message type.", sinif: "parametre" },
  131052: { details: "Unable to download the media sent by the user.", sinif: "medya" },
  131053: { details: "Unable to upload the media used in the message.", sinif: "medya" },
  131057: { details: "Business Account is in maintenance mode", sinif: "gecici" },
  131063: { details: "Your template is categorized as Marketing, but marketing templates are currently disabled for your Cloud API configuration.", sinif: "sablon" },
  132000: { details: "The number of variable parameter values included in the request did not match the number of variable parameters defined in the template.", sinif: "sablon" },
  132001: { details: "The template does not exist in the specified language or the template has not been approved.", sinif: "sablon" },
  132005: { details: "Translated text is too long.", sinif: "sablon" },
  132007: { details: "Template content violates a WhatsApp policy.", sinif: "sablon" },
  132012: { details: "Variable parameter values formatted incorrectly.", sinif: "sablon" },
  132015: { details: "Template is paused due to low quality so it cannot be sent in a template message.", sinif: "sablon" },
  132016: { details: "Template has been paused too many times due to low quality and is now permanently disabled.", sinif: "sablon" },
  132018: { details: "There's an issue with the parameters in your template.", sinif: "sablon" },
  133000: { details: "A previous deregistration attempt failed.", sinif: "kayit" },
  133004: { details: "Server is temporarily unavailable.", sinif: "diger" },
  133005: { details: "Two-step verification PIN incorrect.", sinif: "kayit" },
  133006: { details: "Phone number needs to be verified before registering.", sinif: "kayit" },
  133008: { details: "Too many two-step verification PIN guesses for this phone number.", sinif: "kayit" },
  133009: { details: "Two-step verification PIN was entered too quickly.", sinif: "kayit" },
  133010: { details: "Phone number not registered on the WhatsApp Business Platform.", sinif: "hesap" },
  133015: { details: "The phone number you are attempting to register was recently deleted, and deletion has not yet completed.", sinif: "kayit" },
  134011: { details: "Message failed to send because WhatsApp Payments terms of service acceptance is pending for this WhatsApp Business Account.", sinif: "hesap" },
  135000: { details: "Message failed to send because of an unknown error with your request parameters.", sinif: "parametre" },
});

// D0 — HTTP durum eşlemesi (belgede yok; yukarıdaki not). MM API tablosundaki 400/500 değerleri belgedendir.
const HTTP_D0 = new Map([
  [0, 401], [190, 401],
  [3, 403], [10, 403], [200, 403], [131005, 403],
  [4, 429], [80007, 429], [130429, 429], [131056, 429],
  [1, 500], [2, 503], [131000, 500], [131016, 503], [133004, 503],
]);

export function httpDurumu(kod) {
  if (HTTP_D0.has(kod)) return HTTP_D0.get(kod);
  if (kod >= 200 && kod <= 299) return 403; // D0: "200-299 Permission is either not granted or has been removed"
  return 400; // MM API tablosunda 100/131009/132018 … → 400 (belge); ötekiler D0
}

export function bilinenKod(kod) {
  return Object.prototype.hasOwnProperty.call(HATALAR, kod) || (kod >= 200 && kod <= 299);
}

let izSayaci = 0;
export function hataGovdesi(kod, { details, subcode, mesaj } = {}) {
  const bilgi = HATALAR[kod] || (kod >= 200 && kod <= 299 ? HATALAR[200] : { details: "SAHTE-META: belgede olmayan kod (senaryo verdi)" });
  const ayrinti = details ?? bilgi.details;
  const govde = {
    error: {
      message: mesaj ?? `(#${kod}) ${bilgi.baslik ?? ayrinti}`,
      type: "OAuthException", // belgedeki iki örnek de OAuthException (D0: her kod için aynı mı)
      code: kod,
      error_data: { messaging_product: "whatsapp", details: ayrinti },
      fbtrace_id: `SahteIz${(izSayaci += 1).toString(36)}`,
    },
  };
  // error_subcode v16.0+'da dönmez (belge); YALNIZ şablon oluşturmada belge "error code 100, subcode 2388024" dediği için verilir.
  if (subcode !== undefined) govde.error.error_subcode = subcode;
  return govde;
}

// Plan §2.7 / W2'nin sınıfları DEĞİL — bunlar Meta belgesindeki başlıklardır. Programın sınıflaması kâhinde (kahin/kahin.py).
export const SINIFLAR = Object.freeze([...new Set(Object.values(HATALAR).map(h => h.sinif))]);
