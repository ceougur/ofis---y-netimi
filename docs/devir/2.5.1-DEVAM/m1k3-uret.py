src=open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/istem-uret.py').read().split('# ---------------------------------------------------------------- P-D')[0]
exec(src)
M1K3 = f"""Sen DestekOfis projesinde 2.5.1'in KDV ÖZETİ KÜÇÜK TUR 3 KOD ajanısın (eforun high). KDV Özeti küçük tur 1 ve 2 başka ajanlarla bitti (tur 2'nin dal ucu etiketi t251-m1k2 = f2412ba9; ana dala GİRMEDİ); sen temiz bağlamla YALNIZ aşağıdaki tek işi yaparsın (ders 46). Mahsup fişi, mahsup ön izlemesi ve defter DEĞİŞMEZ — yalnız rapor (KDV Özeti görünümü).

{hazirlik(taban="t251-m1k2", taban_ne="KDV Özeti küçük tur 2'nin dal ucu f2412ba9")}
3. Sonra oku: tur 2'nin raporu `docs/devir/2.5.1-DEVAM/m1k2-rapor.md` (kendi ağacında; özellikle KULLANICIYA SORULMALI S-M1K2-1, BAŞ MİMAR KARARI GEREKİYOR ve §16 betikleri), farkı `git diff t251-m1k t251-m1k2 -- server client test`, `test/kdv-ozeti-*-251.test.mjs`, `test/e2e/senaryo-kdv-*-251.mjs`, betikler `docs/kanit/2026-11-27/m1k2-betik/` (özellikle `yalniz-391-devreden-yoklama.mjs`).

## Kararlar (AYNEN)
KULLANICI 27.11.2026 19:5x UTC (AYNEN: "önerini uygula") — S-M1K2-1 = A: mahsup fişi kesilmiş, DEVREDEN yönde bir ayda sonradan YALNIZ satış KDV'si (391) değişirse 'güncel değil' ayında da o ayın (bugünkü kayıtlardan) devredeni sonraki aya taşınır; her değişiklik bir kez sayılır (S-M1K-1 = A ile aynı çizgi); sonraki ayın fişi eski devredenle kesildiyse o ayın satırında 'Zincirle Uyuşmayan Mahsup Fişi' notu. Örnek (AYNEN): Mart fişi 'sonraki döneme devreden 800' ile kesildi; sonra Mart'a KDV'si 100 olan satış girildi; Nisan fişi 200 → Mart sonraki devreden 700, Nisan önceki devreden 700, Mart–Nisan Ödenecek 300 (= 391 − 191); Nisan satırında uyuşmazlık notu. Bugün (taban): Mart 700 / Nisan önceki 800, Mart–Nisan 200. Defter / mahsup fişi DEĞİŞMEZ.
ÖNCEKİ KARARLAR (değişmez): S-M1K-1 = A (karma ay: İndirilecek fişten, 391 bugünkü kayıtlardan); S-DKM1-1 = A (yalnız İndirilecek KDV azalmışsa ayın sonucu kesilmiş fişten, azalma sonraki ayda); S-M1-3 = C (mahsuptan sonra değişen ay — 'mahsup fişi güncel değil' notu; BAŞ MİMAR OKUMASI: S-M1K2-1 = A bu notu KALDIRMAZ, yalnız devreden yönde taşınan sayıyı düzeltir — ödenecek yönde yalnız 391 değişiminin davranışı DEĞİŞMEZ; ödenecek yönde de aralık toplamı 391 − 191'den sapıyorsa KODLAMA, raporda 'KULLANICIYA SORULMALI' — ders 43); S-M1-1 = B (zincirli devreden); S-M1-2 = B (yön notu).
BAŞ MİMAR KARARLARI (tur 2 raporu; kullanıcıya gösterildi): devreden yönde karma ayda sonraki aya karma hesabın devredeni taşınır — KABUL (dokunma); karma notunun metni KABUL; 'İ azaldı' ölçüsünün S4 taşımasını kapsaması SINANMADI — bu turda bir test YAZ (önceki fişli ayın azalması bu aya taşınmış + bu ayın 391'i değişmiş: rapor sayıları elle hesapla; tek okuması varsa sabitle, iki okuması varsa KODLAMA, 'KULLANICIYA SORULMALI').

## İşler
0. NASIL BOZULUR (rapor taslağının başına, koddan ÖNCE, commit): devreden yönde yalnız 391 artışı / azalışı (devreden ödenecek yöne dönerse); ödenecek yönde yalnız 391 değişimi (DEĞİŞMEZ olmalı); sonraki ayın fişi eski / yeni devredenle kesilmiş; arada mahsupsuz ay; yıl dönümü (Aralık fişi); iki şirket; aralık özetleri (Mart–Nisan, Bu Yıl) = 391 − 191; 6 ay sınırı; karma ay ile aynı ayda.
1. Kod (yalnız KDV Özeti hesabı + gerekiyorsa not metni) + test: örnek AYNEN + tutarlılık tablosu (yalnız azalma / yalnız 391 ödenecek yönde / yalnız 391 devreden yönde / ikisi birden / hiçbiri) + S4 taşımalı karma testi; ekran senaryosuna (kdv-mahsup-sonrasi-251) devreden yönde yalnız 391 adımı (ekranda kurulabiliyorsa; kurulamıyorsa nedeni raporda).
2. Ön izleme ve fiş satırları tabanla birebir (tur 2'nin `onizleme-esit.sh` betiği AYNEN, yollar bu tura) iki TZ.
3. Mutant: en az üç (devreden yönde fişin eski devredeni taşınsın; uyuşmazlık notu çıkmasın; ödenecek yönde de yeni kural uygulansın) — her biri en az bir testte kırmızı; tur 2'nin 34 mutantı AYNEN.
4. Kâhin: `npm run test:kahin-defter` iki TZ 187 / 187 (dokunmadan).

## Kabul
A yeni testler tabanda (t251-m1k2) beklenen nedenle kırmızı (NEDENİ yazılır — ders 38), yenide yeşil iki TZ; B ön izleme / fiş birebir; C komşular (değişen işlevlerin adları + çağıranları `git grep`) iki TZ yeşil; D KDV Özeti'ne dokunan BÜTÜN ekran senaryoları yeşil (kdv-mahsup-sonrasi-251, kdv-zincir-251, kdv-devreden-251, kdv-donemi-250, defter-243, c7b-kabul-250, mobil-247, banka-210); E mutantlar hepsi yakalandı.

{KURALLAR_KULLANICI}

{kurallar('m1k3', taban="t251-m1k2")}

{rapor()}
"""
open('/home/user/ofis---y-netimi/docs/devir/2.5.1-DEVAM/m1k3-istem.txt','w').write(M1K3)
print(len(M1K3))
