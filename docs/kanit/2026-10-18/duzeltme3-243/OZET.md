# Dar kontrol 2 düzeltmeleri (dal duzeltme3-243) — kanıt özeti

Komutlar depo kökünden, `HUKUK_LICENSE_URL=http://127.0.0.1:9`; eski kod ayrı kopyalarda (`git archive 276f94e|d64ebf8`).

| Bulgu | Test | 276f94e | d64ebf8 | Yeni |
|---|---|---|---|---|
| B1 | gg243-dar2-gonderim (B1 ×3) | 1/3 (2 kırmızı) | 2/3 (ana test yeşil: gerileme) | 3/3 |
| B2 | gg243-dar2-gonderim (B2 ×2), gg243-dar2-edm (B2 ×3) | 1/2, 2/3 | 0/2, 0/3 (ileti/ensureSession yok) | 2/2, 3/3 |
| B3 | gg243-dar2-gonderim (B3 ×4), gg243-dar2-edm (B3) | 2/4, 0/1 | 2/4 (giriş testi yeşil: gerileme), 0/1 | 4/4, 1/1 |
| B4 | gg243-dar2-olcek | 1/2 (maliyet kırmızı) | 1/2 (maliyet yeşil: gerileme) | 2/2 |
| B5, B7, MM1, MM2 | gg243-dar2-iade-sira (6) | 0/6 | 0/6 | 6/6 |
| B6 | gg243-dar2-edm (B6) | 0/1 | 0/1 | 1/1 |
| MM1 göç | goc-243-iade-ref (v2.4.2 gerçek kodu) | — | — | 1/1 |
| e2e | gg243-dar2-ekran | 5 geçti / 4 kaldı | — | 21/0 |

Mutasyon: `betikler/mutasyon.py` 18/18 yakalandı (`yeni/mutasyon.txt`).
Kâhin: senaryolar 9/9 (`kahin/senaryolar-*.txt`); tohum 4–8 × 200 küçültmeli (`kahin/tohum-4-8x200.txt`) — farkların sınıfı ana raporda.
Ölçüm (B4): `olcum/` — kilitli, tek başına.
Tam npm test (68506f4): 2792/2792 geçti, çıkış 0 (`tam/`, tools/kanit.mjs kos).
