src=open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/istem-uret.py').read().split('# ---------------------------------------------------------------- P-D')[0]
exec(src)
M1K2 = f"""Sen DestekOfis projesinde 2.5.1'in KDV ÖZETİ KÜÇÜK TUR 2 KOD ajanısın (eforun high). KDV Özeti küçük turu başka bir ajanla bitti (dal ucu etiketi t251-m1k = 52fb473f; ana dala GİRMEDİ); sen temiz bağlamla YALNIZ aşağıdaki tek işi yaparsın (ders 46). Mahsup fişi, mahsup ön izlemesi ve defter DEĞİŞMEZ — yalnız rapor (KDV Özeti görünümü).

{hazirlik(taban="t251-m1k", taban_ne="KDV Özeti küçük turunun dal ucu 52fb473f")}
3. Sonra oku: küçük turun raporu `docs/devir/2.5.1-DEVAM/m1k-rapor.md` (kendi ağacında; özellikle S-M1K-1 ve §17 betikleri), farkı `git diff t251-m1k-taban t251-m1k -- server client test`, `test/kdv-ozeti-*-251.test.mjs`, `test/e2e/senaryo-kdv-*-251.mjs`, betikler `docs/kanit/2026-11-27/m1k-betik/` (özellikle `karma-yoklama.mjs` — S-M1K-1'in yoklaması).

## Kararlar (AYNEN)
KULLANICI 27.11.2026 16:16 UTC (AYNEN: "önerilerini uygula açık sorulara") — S-M1K-1 = A: mahsup fişinden sonra aynı ayda hem İndirilecek KDV azalmış hem satış KDV'si (391) değişmişse: İndirilecek KDV FİŞTEN, satış KDV'si BUGÜNKÜ kayıtlardan; her değişiklik bir kez sayılır. Örnek (AYNEN): Ocak fişi 500 kesildi; sonra Ocak alışı iptal edildi ve Ocak'a KDV'si 100 olan satış girildi; Şubat fişi 700 → Ocak 600, Ocak–Şubat 1.300 (= 391). Bugün (taban): Ocak 1.100, Ocak–Şubat 1.800.
ÖNCEKİ KARARLAR (değişmez): S-DKM1-1 = A (yalnız İndirilecek KDV azalmışsa ayın sonucu kesilmiş fişten, azalma sonraki ayda); S-M1-3 = C (mahsuptan sonra değişen ay — 'mahsup fişi güncel değil' notu); S-M1-1 = B (zincirli devreden); S-M1-2 = B (yön notu). Yeni kuralın bu dördüyle birlikte tutarlı olduğunu (aynı ayda yalnız azalma / yalnız 391 değişimi / ikisi birden / hiçbiri) tablo testle göster.
BAŞ MİMAR KARARLARI (küçük tur raporu): fişin zincirde sayılması için S4 emilim eşitliği şartı KABUL (dokunma); 'kayıtları değişti' notunun seyrek durumu ve öbür raporların tablo altı SONRAKİ SÜRÜME.

## İşler
0. NASIL BOZULUR (rapor taslağının başına, koddan ÖNCE, commit): aynı ayda alış iptali + satış eklenmesi; satış silinmesi (391 azalır) + alış iptali; yalnız 391 değişimi (S-M1-3 davranışı kalır); devreden yönde (fiş devreden yazmış) aynı karma; yıl dönümü (Aralık fişi); iki şirket; aralık özetleri (Ocak–Şubat, Ocak–Mart, Bu Yıl) = 391; 6 ay sınırı.
1. Kod (yalnız KDV Özeti hesabı + gerekiyorsa not metni) + test: örnek AYNEN + tutarlılık tablosu; ekran senaryosuna (kdv-mahsup-sonrasi-251) karma durum adımı.
2. Ön izleme ve fiş satırları tabanla birebir (küçük turun `onizleme-esit.sh` betiği AYNEN) iki TZ.
3. Mutant: en az üç (İndirilecek bugünkü kayıtlardan alınsın; 391 fişten alınsın; karma durumda not çıkmasın) — her biri en az bir testte kırmızı; küçük turun 28 mutantı AYNEN.
4. Kâhin: `npm run test:kahin-defter` iki TZ 187 / 187 (dokunmadan).

## Kabul
A yeni testler tabanda (t251-m1k) beklenen nedenle kırmızı, yenide yeşil iki TZ; B ön izleme / fiş birebir; C komşular (değişen işlevlerin adları + çağıranları `git grep`) iki TZ yeşil; D KDV Özeti'ne dokunan BÜTÜN ekran senaryoları yeşil (kdv-mahsup-sonrasi-251, kdv-zincir-251, kdv-devreden-251, kdv-donemi-250, defter-243, c7b-kabul-250, mobil-247, banka-210); E mutantlar hepsi yakalandı.

{KURALLAR_KULLANICI}

{kurallar('m1k2', taban="t251-m1k")}

{rapor()}
"""
open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/m1k2-istem.txt','w').write(M1K2)
print(len(M1K2))
