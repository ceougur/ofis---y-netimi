# 2.4.9 B2 — kanıt (elle toplu WhatsApp alıcı listesi; tasarım notu docs/2.4.9-tasarim/B2-elle-toplu-alici.md §13)

Kod: eski = `git archive e3f74093` (not defterinde ayrı kopya, ders 23/25; node_modules sembolik bağ, npm komutu yok), yeni = a9f0b84a (B2-1 + B2-2, yalnız server/routes/whatsapp.mjs).
Bütün koşular `HUKUK_LICENSE_URL=http://127.0.0.1:9`; düzenek test/isz-248/ortak.mjs (sahte Meta / lisans / kapıcı yerel). Ağır koşular `flock /tmp/destekofis-olcum.lock` altında tek tek.

| dosya | ne |
|---|---|
| eski-e3f74093-whatsapp-elle-alici-249.* | E2 eski kodda: 5 hücrenin 3'ü beklenen nedenle KIRMIZI (113 tam kart çağrısı; 8 biçimleyici kurulumu; ekran eki hatasında kişi düşüyor), kâhin ve çekirdek ↔ kart yeşil |
| yeni-whatsapp-elle-alici-249.* | E2 yeni kodda 5/5 |
| mutasyon-M1-M6.* | test/b2-249/mutasyon.mjs — 6/6 mutasyon kırmızı, beklenen hücre ve iletiyle |
| komsu-dar-UTC.*, komsu-dar-Istanbul.* | dar komşu listesi × 2 saat dilimi, 63/63 |
| e2e-*.* | CI dışı + komşu e2e (senaryo-whatsapp, senaryo-213, whatsapp-gonder-248, whatsapp-donem-248, is-akisi-248, tarih-248) |
| e1/ | E1 büyük veri eşitliği: hazırlık özetleri (programın API'siyle; sınıf sayıları), her koşunun günlüğü, zincir.txt, karşılaştırma (e1-karsilastir.*), diş (e1-dis.*). Koşuların JSON çıktıları (21 MB) not defterinde: b2-kod-a954/e1/ |
| olcum/ | §7 ölçümleri: olcum-<eski|yeni>-<set>.json/.log, ekran2-<eski|yeni> (ekran-* ilk koşu: açılışı yanlış andan ölçtü, geçersiz), olcum-tablo.* (bütçe denetimi) |

Veri: T9 taban-2910 / gecmis-40 (programın ürettiği) → test/b2-249/esitlik-hazirla.mjs (API) → hazir-taban / hazir-gecmis; test/b2-249/ek-hazirla.mjs → hazir-bes-bin (5.000 cari), hazir-iade (R2: 1.030 satıştan iade, 1.001'i kart kapsamından düşen).
Yeniden koşmak: betikler/ (e1-zincir.sh, olcum-zincir.sh, ekran-zincir.sh, e2e-zincir.sh) (komutlar içinde; yol değişkenleri baştadır).
