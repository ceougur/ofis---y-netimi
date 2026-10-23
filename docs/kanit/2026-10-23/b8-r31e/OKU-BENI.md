# 31e tur 13 — söz tutarı tek tanım, hiçbir yolda borç değil — is/r31e-f, kod f8e9ae4 (taban aday 22 = 49072ca; Z5/Z6 sonrası 63b28b4)

## Bulgu (ORTA; sakınca süzgeci: borç tutarı yanlış, Kişiler ↔ Takvim tutarsız)
- Borç düzeni (`debt-column.mjs` debtPlan → Tablodaki Kişiler, "önce cari açın" Açılış Bakiyesi ön dolumu) söz tutarını tam sözcük `soz|sozu|taahhut|taahhudu` kalıbıyla ayırıyordu. Takvim ise taahhüt önekiyle ayırıyor (Z5).
- Sonuçlar (63b28b4, aday 22'de de):
  - "Taahhütname Tutarı" Takvim'de söz tutarı, Kişiler'de borç (Lale 700).
  - "Taahhütlü Tutar" Kişiler'de borç (Mert 800).
  - Kalan'ı boş satırda söz tutarı satır borcu oluyor (Selin 400).
- Söz tutarı ayrıca sekmenin tutar sütunu sayısına katılıyordu (`rest.length === 1`):
  - "Tutar" + "Söz Tutarı" sekmesinde borç seçilmiyordu. Pelin 5.000 Kişiler'den notsuz düşüyor; v2.4.3'te de.
  - "Tutar" + "Taahhütname Tutarı" sekmesinde "borç sütunu seçilemedi" notu çıkıyordu; Rıza 6.000 borçsuz.

## Karar (koordinatör: A1 + Z5/Z6 karar metninden) ve uygulama
- Tek tanım `debt-column.mjs`'te:
  - `PROMISE_HEADER = \b(soz|sozu|taahhut\w*|taahhud\w*)\b`.
  - `isPromiseAmountHeader` = söz / taahhüt sözcüğü + "tutar" ya da "miktar".
  - `dues.mjs` ikisini de içe alır; kendi kopyası yok.
- `debtPlan` söz tutarını borç adayı saymaz (tek süzgeç; aday listesinde). Eski üç ayrı söz denetimi kalktı (single, Genel Toplam'ın öbürü, not adayları).
- "Taahhütlü Ücret" (tutar / miktar sözcüğü yok) söz tutarı değildir: borç (Oya 450) ve dönem tutarı kalır (5b).
- Takvim kalem tutarları değişmez. Yalnız kalemin borcu (Açılış Bakiyesi ön dolumu) değişir.
- KARARDAN TÜRETİLEN YORUM (ders 40; koordinatöre bildirildi):
  - Söz tutarı borç adayı olmadığı için "Tutar" + "Söz Tutarı" sekmesinde "Tutar" sekmenin tek tutar sütunudur. 2.4.4 kararı "tek tutar sütunu borç" olduğundan Pelin 5.000, Rıza 6.000 borçtur.
  - Bu iki kişi v2.4.3'te ve aday 22'de Kişiler'de yoktu.
  - Söz sözcüğü taşıyan ama tutar / miktar sözcüğü taşımayan para kolonu artık borçtan dışlanmaz (ör. "Ödeme Sözü" tutar yazılmış kolon). Tek tanımın sonucu; yeniden üretimde Ufuk Can'ın "Borç" kolonu öncelikli, değişmedi.

## Nasıl bozulur
- İki tanım ayrışır (Takvim söz tutarı, Kişiler borç).
- Taahhüt önekli söz tutarı borç olur.
- Kalan'ı boş satırda söz tutarı borç olur.
- "Taahhütlü Ücret" borçtan düşer.
- Söz tutarı tutar sayısına katılıp gerçek borcu siler; kişi notsuz düşer.
- "Seçilemedi" notu söz tutarını aday sayar.
- Açılış Bakiyesi ön dolumu söz tutarını alır.

## Kanıt
- Yeniden üretim. Betik `betik/tablo-kos.mjs`, senaryo `betik/soz-borc.json`.
  - v2.4.3: `ham/soz-borc-v243.out`.
  - Aday 22 (ayrı kopya): `ham/soz-borc-aday22-49072ca.out`.
  - 63b28b4 (Z5/Z6 sonrası, düzeltme öncesi): `ham/soz-borc-63b28b4.out`.
  - f8e9ae4: `ham/soz-borc-f8e9ae4.out`.
- Kişiler:
  - 63b28b4: Lale 700, Mert 800, Oya 450, Selin 400, Tarık 2.000, Ufuk 3.000 + Rıza notu.
  - f8e9ae4: Oya 450, Pelin 5.000, Rıza 6.000, Tarık 2.000, Ufuk 3.000; not yok.
- Takvim kalem tutarları 63b28b4 ile aynı. Vade / Nakit 9.850 aynı.
- Kırmızı → yeşil:
  - Aday 22'nin ayrı kopyasında yeni testler 2/2 kırmızı: `kirmizi-aday22-49072ca-yeni-testler`.
  - 63b28b4 kopyasında da 2/2 kırmızı (`kirmizi-63b28b4-yeni-testler`). Yalnız bu düzeltmenin nedeni, iletide okunuyor:
    - Kişiler: +Lale 700, +Mert 800, +Selin 400, −Pelin 5.000, −Rıza 6.000.
    - Takvim kalem borcu: 700 / 800 / 400 yerine null; Pelin / Rıza null yerine 5.000 / 6.000.
  - Yeni kodda: `tablo-borc-r31e-yesil` 8/8 (tur 11–13), `komsu-testler` 1194/1194.
- Mutasyon `mutasyon-kimlik-bag-dar` (MUT_SEC: M48–M59) 12/12 yakalandı.
  - M48 / M49 / M51 / M52 / M54 tek tanımın yeni yerine (debt-column) taşındı. M49 artık "tutar / miktar koşulunu kaldırma".
  - Yeni mutasyonlar:
    - M57: yardımcıyı ikiye ayırma; dues kendi "yalnız tutar" kopyası.
    - M58: debt-column'da eski tam sözcük kalıbı.
    - M59: borç adayında söz süzgeci yok.
  - 58 mutasyonun dizgesi kodda tek kez geçiyor.
- e2e (flock altında, f8e9ae4): run 50/50, senaryo-kayit-tahsilat-244 46/46, senaryo-rapor 90/90, uiux-ui11-244 153/153, senaryo (Tablodan Aktar) 47/47, senaryo-cari-243 48/48, senaryo-216 54/54, senaryo-219 42/42, senaryo-kayit-bag-31e 43/43.
- `goc-v243` 46/46.
- Bağımsız cari kâhini `kahin-cari-ee3111e-tum` (is/kahin-244 ee3111e, koşu anında `git -C /home/user/wt/kahin-244 log -1`; dokunulmadı; ayrı kopya, `KAHIN_PROGRAM_KOKU`, program f8e9ae4): 33 senaryo, 3789/3789, 0 fark.
