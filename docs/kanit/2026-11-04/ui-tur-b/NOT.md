# 2.4.9 UI TUR B — ORTA-3 (Bildirim Yolu uyarısı) + D8 (App ID yardımı / kılavuz) + gözden geçirme metinleri 3–4

Taban: be58d92b (çalışma dalı claude/compassionate-galileo-f9kghg). Eski kod ayrı kopyada (`git archive be58d92b | tar -x`, not defteri
`uib-7c3e91d4/eski-be58d92b`, node_modules ana depoya bağ; ders 23, 25). Program açan her koşu `HUKUK_LICENSE_URL=http://127.0.0.1:9` (ders 30);
Meta yerine yerel sahte Graph (gerçek Meta'ya istek yok). Eski kopyanın kayıtlarında `commit undefined` görünür (kopya git deposu değil): kod be58d92b'dir.

## Kırmızı kanıt (eski kod be58d92b, yeni testlerle) — ders 7, 38
- `eski-be58d92b-bildirim-yolu-uyari-249` (TZ=UTC): 5 testten 4 kırmızı, BEKLENEN NEDENLE: görünümde `hook.cause` yok ("neden yalnız Türkçe: undefined" — önce
  200 + lastTest.ok + hook failed doğrulandı, yani ön koşul oluştu); eski defter kaydı ayrılmıyor; `splitMetaErrorMessage` dışa açık değil. 1 yeşil = değişmez koruması
  (Bildirim Yolu kaydedilince ayrım alanı yok) — eski kodda da yeşil olması beklenir.
- `eski-be58d92b-senaryo-whatsapp-ayar-248`: 98/118, 20 kırmızı, hepsi beklenen nedenle: ön koşul OLUŞTU ("Meta'ya abonelik kaydı istendi ve reddedildi (1 istek)" ✓);
  bildirim `hof-toast-success|Bağlantı çalışıyor.` (uyarı değil); hücre "Kaydedilemedi · Meta bildirim … (Meta hata kodu 100: (#100) Before override …) (program saatte bir
  yeniden dener)", yükseklik 336 px (Son Sınama 179 px); neden / Meta iletisi satırı yok; Kaydet ve Sına yeşil "Kaydedildi; bağlantı çalışıyor."; App ID yardımı
  "İsteğe bağlı; Meta uygulama panelinin üst kısmındaki App ID." (Ekstre yok).
- `gecersiz-on-kosul-olusmadi/`: A4c'nin İLK hâli eski kodda koşuldu ama ön koşul oluşmadı (A4b'den kalan "Çalışıyor" kaydı Meta'daki adresle eşleşti → program
  yalnız doğruladı, kayıt istemedi). Kırmızılar kanıt SAYILMAZ (ders 20, 38); test Meta'daki adresi kaldırıp abonelik isteğini sayarak düzeltildi, yukarıdaki koşu onunla.

## Yeşil (yeni kod)
- `yeni-senaryo-whatsapp-ayar-248` 118/118; `yeni-senaryo-whatsapp-sablon-248`, `-gonder-248`, `-donem-248`, `yeni-senaryo-221` (Ayır kutusu metni değişti), `yeni-kilavuz-metin`.
- `yeni-whatsapp-ve-genel-UTC` / `-Istanbul`: test/whatsapp-*.test.mjs (82 dosya, yeni dosya dahil) + lisans-servisi-izolasyonu, platform-tasinabilirlik, yazim-duzeni,
  ci-kapi-listesi, kilavuz-surum, kilavuz-pdf-surum.
- `yeni-pdf-denetle` 39/39 (PDF `node docs/kilavuz/pdf-uret.mjs docs/kilavuz DestekOfis-Kullanim-Kilavuzu` ile yeniden üretildi, client/kilavuz'a kopyalandı — ders 42).
  İlk deneme PLAYWRIGHT_BROWSERS_PATH verilmeden koştu, tarayıcı bulunamadı (ortam hatası); aynı adla yeniden koşuldu (kayıt yenisidir).

## Ekran (ekran/)
- oncesi-be58d92b/uiux-gezintisi-w-1366-bildirim-yolu-hata.png (UI/UX gezintisinin görüntüsü), wa-248-05c-… (eski kod, aynı senaryo), wa-248-02-elle-bagla.png (App ID yardımı).
- sonrasi/wa-248-05c-bildirim-yolu-kaydedilemedi.png (uyarı bildirimi, hücrede "Kaydedilemedi · tarih", neden düğmelerin altında, "Meta iletisi: …" ayrı küçük satır),
  wa-248-05d-bildirim-yolu-duzeldi.png (düzelince yeşil, satırlar kalktı), wa-248-02-elle-bagla.png (App ID yardımı).
