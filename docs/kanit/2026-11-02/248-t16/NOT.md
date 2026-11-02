# T16 — kapıcı Worker dağıtımı (02.11.2026 08:25 UTC, ana oturum)

- Kod: master 6ff09c10 (ağaç 9020e6a5 = PR #38 başı e46e4b90). `wrangler 4.40.0 deploy` (bulut/kapi) → destekofis-kapi sürüm 6c68c79e-9830-4d46-a6e1-3222b21f8d01
  %100 (önceki 5eaae21d-ff52-4c87-b4cf-188d02c07271, 29.10). Bağlar aynı: OZET (destekofis-ozet), OFIS_ALANI, CF_ACCOUNT_ID, CF_ZONE_ID, LISANS_URL, LISANS_ANAHTARLARI.
  Meta gizlileri GİRİLMEDİ (vergi kaydından sonra).
- EKSİK: saatlik Cron (`23 * * * *`, L1 temizliği) KURULAMADI — Cloudflare "You need a workers.dev subdomain in order to proceed" (hesapta workers.dev alt adı yok).
  Etki: 30 günlük hoşgörüsü dolan ofis kayıtlarının otomatik silinmesi çalışmaz; ilk silme en erken ~Aralık. Kullanıcıya soruldu.
- 2.4.7 GERİYE UYUM (çevrimdışı, gerçek kod): v2.4.7'nin istemci kodu + kapıcı testleri (kapi-247, kapi-gg247-b4, kapi-donen-ofis-247, kapi-tunel-247,
  mobil-ozet-247, kapi-tunel-uctan-uca-247) YENİ kapıcıya karşı → 61/62. Tek kırmızı "süresi biten lisans bitiş ANINDA kapanır": L1 kullanıcı kararıyla BİLEREK
  değişti (ücretli lisans 30 gün salt okunur; 2.4.8 testi "DENEME bitiş anında kapanır" olarak güncellendi). Ham çıktı kapi-uyum-247-yeni-kapici.log.
- Canlı duman: https://kapi.destekofis.net/ 200; /wa/bagla 200 ("Bu bağlantı DestekOfis'in Meta onayından sonra çalışır" — kapalı, beklenen).
  Ofis alt adları (<ofis>.destekofis.net) bu ortamdan açılamıyor → canlı 2.4.7 kurulumla uçtan uca DENENMEDİ (kullanıcı telefondan açarak görür).
- İstek sayısı (GraphQL workersInvocationsAdaptive, hata 0): 29.10 738 · 30.10 1.538 · 31.10 458 · 01.11 484 · 02.11 (09:00'a kadar) 80. Ücretsiz plan günlük
  100.000 sınırının çok altında; Workers Paid kararı (~10 aktif WhatsApp müşterisi) kullanıcıda.
