# 31e aday 24 tam kapı K6 statik kırmızısı — is/r31e-f, kod cfb1405 (taban 43224dd = aday 24 3525c25 ile aynı dataset-bonds.mjs)

## Bulgu (koordinatör: aday 24 npm test 3438/3439; ders 35)
- `test/banka-210-post-statik.test.mjs` not ok 3: `server/lib/dataset-bonds.mjs:562/564/565 UPDATE $ (run)` liste dışı ham yazım. Kaynak: B1 `move()`.
- Kök neden: `payments` (para tablosu) case_key UPDATE'i `run` kapanışındaydı.
  - `bank.post({ op: 'assign', write: run })` çalışma anında doğruydu; SQL ise bank.post'un sözcüksel içinde değildi, tarayıcı göremiyordu.
  - "bag" türüyle izinli liste denenmişti; not ok 4 verdi ("bag" yalnız note; payments.case_key para bağı). Test gevşetilmedi.

## Değişiklik (davranış aynı)
- `move()` içinde iki ayrı yol var.
- `payments` taşıması:
  - `bank.post({ module: 'payment', op: 'assign', prev, write: () => { store.run("UPDATE payments SET case_key = … WHERE case_key IN (SELECT from_key FROM hof_bond_map)") … } })`.
  - SQL, moved / kept sayımı ve tablo sırası aynı; bank.post her taşımada önceki gibi çağrılır.
- Para dışı BOND_TABLES `rekeyNonMoney(spec)` ile doğrudan taşınır.
  - Dinamik tablo adı. İşlev para tablosunda (`spec.money` ya da `LEDGER_TABLES`) hata verir.
  - İzinli liste girdisi `tur: "tablo-disi"` (dataset.mjs deleteSession gibi). Bu girdi gerekiyor, çünkü dinamik `UPDATE ${t}` tarayıcıda "$" görünür.
- bank yoksa (yalnız `kayit-bag-31e-birim` bağ deposu; üretimde app.mjs bank'ı her zaman verir): taşınacak tahsilat varken ham yazım yerine hata. Birim testte tahsilat yok, davranış aynı.

## Kanıt
- Statik test:
  - Eski kod (43224dd ayrı kopya): `kirmizi-43224dd-banka-210-post-statik` not ok 3 — aynı üç satır (562 / 564 / 565 UPDATE $ run).
  - Yeni kod: `banka-210-post-statik-yesil` 6/6. Tarayıcı artık `593 UPDATE payments write post` ve `UPDATE $ rekeyNonMoney` (izinli) görüyor.
- Çalışma anı testi (yeni; `test/kayit-bag-31e.test.mjs` "31e B1 K6"; test kipinde moneyStrict, bank.post dışındaki UPDATE payments K6 (c) money:raw ile geri alınır):
  - Yerine koy taşıması: UPDATE payments bir kez ve `store.inPost` içinde.
  - bank.post adım 11 tahsilatın olayını kapıya bildirir (`store.touchEvent`).
  - Tahsilat yeni anahtarda; olay, İşlem No, tutar, yol, hesap, tarih aynı.
  - Olay kopyası "same": kopyada anahtar yok, damga değişmez (`refreshEvent` ne diyorsa).
  - `meta.bank.integrity` boş.
  - Sonuç: `kayit-bag-k6-yesil` 1/1. Eski kodda da yeşil (`eski-43224dd-kayit-bag-k6`): çalışma anı davranışı zaten doğruydu, değişmedi.
- B1: `kayit-bag-31e-tum` 38/38 (API + birim).
- `komsu-testler` 1208/1208 (1188'lik komşu listesi + tablo-borc + statik K6).
- Mutasyon `mutasyon-kimlik-bag-dar` (MUT_SEC: M71–M73; statik test mutasyon takımına eklendi): 3/3 yakalandı.
  - M71 tahsilat UPDATE bank.post dışında çağrılır: statik ("gerçek kod") + çalışma anı (money-raw).
  - M72 tahsilat para dışı yoldan: çalışma anı ("bank.post dışında taşınmaz").
  - M73 koruma kaldırılıp para dışı yoldan ham yazım: YALNIZ çalışma anı testi yakalar (money-raw). Statik test izinli girdi yüzünden göremez; çalışma anı testinin dişi budur.
- e2e (flock altında, cfb1405): senaryo-kayit-bag-31e 43/43, senaryo-kayit-tahsilat-244 46/46.
- `goc-v243` 46/46.
- Not: statik yeşil, K6 yeşil ve kayit-bag-31e-tum koşuları commit'ten önce aynı içerikle (43224dd + değişiklik = cfb1405) koşuldu. Komşu, mutasyon, e2e ve göç cfb1405'te.
