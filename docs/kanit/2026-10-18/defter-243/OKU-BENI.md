# 2.4.3 defter ve rapor düzeltmeleri (MM3–MM9, UX24) — kanıt dizini

Dal `defter-243` (taban 78fdd05). Eski kod kırmızı kanıtı ayrı kopyada: `git archive 78fdd05` (`scratchpad/defter-243-eski-78fdd05`), göç testi
için `git worktree --detach 78fdd05` (`scratchpad/defter-243-eski-wt-78fdd05`; etiketler gerekir). Mutasyonlar `git archive a6b3e99` kopyasında.

| Klasör / dosya | İçerik |
|---|---|
| `ham/eski-78fdd05-*.txt` | Yeni testlerin eski kodda ham çıktısı (kırmızı) |
| `ham/komsu-*.txt`, `ham/goc-zinciri.txt` | Komşu birim testleri ve göç zinciri (2.0.16 → güncel) |
| `e2e-*.json/.log` | Ekran senaryoları (`tools/kanit.mjs kos`; kilit senaryo başına) |
| `mutabakat-500x2.*` | `test/mutabakat/kos.mjs --islem 500 --tohumlar 2` |
| `mutasyon/` | 16 mutasyon (+ M8c iki katmanlı beyaz liste), `mutasyon.py` koşucusu |
| `uzman-kahin/` | Denetçinin (uzman mali müşavir) elle yazdığı kâhin güncel kodla: 24 hesap fark 0; MM3 devreden 761 |
| `bagimsiz-kahin/` | `test/bagimsiz/fark.py` (model_a ↔ model_b ↔ program): kabul-1-16, kabul-senet, kabul-supheli fark 0; tohum 7 × 300 yalnız bilinen KDV-DAHIL-ISKONTO |
| `ham/eski-78fdd05-ux24-toplam.txt`, `komsu-ux24.*` | UX24 (çok satırlı TOPLAM) eski kodda 1/4; komşu rapor testleri + altın test 395/395 |
| `npm-test.*` | Tam `npm test` (8d633be): 2796/2801 — 5 kırmızı bilerek değişen eski beklentiydi (iade-210-onarim KILIT yaşlandırması MM5; hiz-esdegerlik `footers` UX24) |
| `npm-test-duzeltme.*` | O 5 testin beklenti güncellemesinden sonra yeniden koşusu: 16/16 |
| `ekran/` | senaryo-defter-243 ekran görüntüleri (MM3 mahsup/vergi, UX24 TOPLAM satırları, MM5, MM9) |

Kâhin dilinde (test/bagimsiz) stok açılışı, Vergi Ödemesi ve KDV Mahsup Fişi YOK: bu üç kuralın bağımsız kâhini denetçinin elle hesabıdır
(`uzman-kahin/`); dil güncellemesi başka el tarafından yapılacak (dal kahin-defter-243).
