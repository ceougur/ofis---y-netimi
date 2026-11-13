<!-- Ajan raporu AYNEN (13.11.2026; ajan sözü — kanıt değil; ana oturumun yeniden koşusu KAYIT'ta) -->
# Cari kâhini bakımı 15: rapor

Cari kâhininin 15. bakımı bitti; üç commit kendi dalımda (`worktree-agent-a98fc03cad09a36cd`), push yok. Kâhinin bütün kendi testleri iki saat diliminde geçti: öz test 6.295/6.295, G3'te beklenmeyen fark 0. Senin kararını gerektiren beş yeni toplu soru var (SK-30…SK-34, aşağıda).

Commit'ler:
- `5448c215` — yalnız yorum (KARARLAR.md §26; ders 40, koddan önce).
- `ead8f4b3` — kod: `model.py`, `oz-test.py`, yeni senaryolar d41 / d42 / d43, güncellenen d39 / d40 / d12 / d30 / d34 ve `docs/kanit/2026-11-13/kahineski15-arac/` araçları.
- `6453ad3b` — kanıt (iki TZ) ve G3 dökümü.

## Yorum: eski okuma → yeni kural
- **S136:** Bakım 14'te kâhin taksit kartı, taksitli fatura ya da verilen avans olan şüpheli caride görünümü yazmıyordu (SK-27). Artık şüpheli tutar bunlara da tek kuyruk sırasıyla (vade → belge → yazım) düşüyor.
  - "Kuyruk sırası" bakım 14'teki S130 okumasıyla aynı ve kararın örneğiyle uyuşuyor. Örnek, bakım 14'ün SK-27 örneğiyle (d40 Q3) aynı: 1. taksit 0, F 500, 2. taksit 200, gecikmiş 700. Belge tarihi sırası bu sonucu vermezdi.
  - Kart göstergeleri değişmiyor.
  - Avanslı caride iki zaman okuması ancak bütün kalemler şüpheliden önce doğmuşsa aynı sayılıyor; değilse susuyor (S137).
- **S139:** Eskiden şüpheli caride gecikmiş hiç yazılmıyordu. Artık görünen kalemlerden hesaplanıyor; kararın örneği d39 N1'de 800.
- **S140:** Eskiden iade S2 sırasıyla dağılıp elle borca düşebiliyordu. Artık satış kartından sonraki faturasız iade önce o kartın taksitlerini kapatıyor; örnek aynen tutuyor ([0, 200], gecikmiş 0).
  - Değer yalnız şu alanda yazılıyor: tek satış kartı var, başka satış yok, iadenin geri ödemesi yok, iade kartın açığını aşmıyor. Bunun dışı SK-31'de susuyor.
- **S145:** Eskiden tahsilat her zaman kabul ediliyordu. Artık tahsilat (Taksit Tahsilatı dahil) şüpheli tarihinden önceyse ve o gün K1'i (şüpheli tutar ≤ borç) bozuyorsa reddediliyor.
  - Reddin koşulu NOT (3)'ten "o tarihte borcu aşıyorsa". Bu yüzden tam eşitlik, aynı gün ve "öncesi ama borç yetiyor" kabul. Tahsilatın bir kısmı aşıyorsa adımın tamamı ret.
  - **Teyit isteyebileceğin yer (prensip §4):** karar metninin ilk yarısı "önceki tarihe her tahsilat ret" diye de okunabilir. Ben NOT (3)'ün koşuluyla tek okuma saydım; mutant 296 bu ayrımı yakalıyor.
  - d39 N11 tam bu karar örneğiydi, artık ret: bakiye 500, Kalan 500.
- **S151:** Satış kartında "Tahsil Edilen" ve taksit "Ödenen" iadeyi saymıyor, "Kalan" aynen. Örnek: Tahsil Edilen 0, Kalan 700, bakiye 1.200.
- **Alanı olmayanlar ve onay:** S142, S150 ve S147'nin kâhinde karşılığı yok. S148 zaten A'yı veriyordu; d41 W1 ile onaylandı.
- **S137 / S138:** Sustuğu yerde aynen susuyor; yalnız neden metni "BİLİNEN SINIR" oldu.

Kâhinin bugün değer verip SUS'a çevirdiğim BİLİNEN SINIR'lar:

| Karar | Artık yazılmayan | Gerekçe |
|---|---|---|
| S141 | Kart fazlası olan caride satış faturasının belge açığı ve açık toplamı | Kâhin A'yı veriyordu |
| S143 (a) | Karşı yönlü kalemli kartlı caride kartın Kalan'ı | Kâhin C'yi veriyordu |
| S144 (c) | Kartın kendi fazla tahsilatında Tahsil Edilen | Kâhin A'yı veriyordu |
| S149 | Vade bugün ya da ileride, söz geçmişse takvim kalemi ve gecikmiş | Kâhin C'yi veriyordu |

S143 (b), S144 (d) ve S147 kâhinde alan olarak yok; S144 (e) denenmedi.

## Elle senaryolar
Değerler kâhin koşulmadan karar metninden yazıldı; ilk koşuda d39–d43'ün 575 denetiminin hepsi kâhinle aynı çıktı.
- **d41 (129 denetim):** S136 komşuları R2 (taksiti bitirir), R3 (faturaya geçer), R4 (taksitli fatura), R5 (avans); R7 (SK-30); S139 komşusu V1; S145'te S1 (örnek, ret), S2 (bugün), S3 (aynı gün), S4 (borç yetiyor), S5 (eşitlik), S6 (Taksit Tahsilatı ret), S7 (çek — SK-33), S8 / S9 (SK-34); S148 için W1.
- **d42 (74 denetim):** T1 (S140 örneği), T2 (S151 örneği), T3 (iade = satış), T4 / T5 / T8 (SK-31), T6 (kart tahsilatı + iade), T7 (SK-32). S140'ın "iade satıştan büyük" komşusu (T4) için karar bir şey söylemiyor; orada susuyor ve soru listesinde.
- **d43 (42 denetim):** U1–U7 — BİLİNEN SINIR'lar ve komşuları (söz günü, vade de söz de geçmiş).

**Açıkça yazmam gereken bir şey:** d12 F2, d30 KQ1 / KQ3 ve d34 KE10'daki beş eski beklentiyi SUS'a önceden almamıştım. Öz test bunları "ANAHTAR YOK" diye kırmızı verince her birinin adımlarını okudum, S149 / S144 (c) / S143 (a) alanında olduklarını doğruladıktan sonra `elleYok`'a aldım. Hiçbir değer kâhine uydurulmadı.

## Mutantlar
286–298, S136 / S139 / S140 / S145 / S151 için B seçenekleri ve yarım uygulamalar. Hepsi elle tablolarda değerle yakalanıyor; bakım 6–14'ün mutantları (241–285) da hâlâ yakalanıyor.

## Test sayıları (UTC ve Europe/Istanbul; başlıklar dışında iki dilimde bayt bayt aynı)
- cari öz test 6.295/6.295
- mutasyon taraması 265/265
- eşdeğerlik + G3 583/583 (eski kural setlerinde 468/468 aynı)
- yeni / değişen elle tablolar 990/990
- eski (bakım 14) kâhinde 143/990 kırmızı, beklenen nedenlerle
- eski elle tablo farkı 94/94 izinli
- G1 97/97, mutant ↔ senaryo 342/342, geniş tarama 2.201/2.201, defter öz testi 181/181

Geliştirme sırasında iki hatayı kendi testlerim yakaladı ve düzelttim:
- 2.4.9 kipinde kartın "Tahsil Edilen" değeri değişmişti; eşdeğerlik denetimi yakaladı.
- Karşılıksız dönen evrakı tarihli borçta yanlış saydığım için rastgele senaryolarda 9 adım yersiz susuyordu.

## G3 dökümü (bakım 14 → 15)
Toplam 468 değişiklik, beklenmeyen 0:

| Sınıf | Adet |
|---|---|
| S145 | 268 |
| S149 | 37 |
| S140 | 57 |
| S136 | 21 |
| S139 | 23 |
| S144 | 4 |
| S151 | 4 |
| S141 | 3 |
| S143 | 3 |
| GENEL (Kasa / sayaç / mizan) | 48 |

- Öbür 84 eski elle senaryo ve 14 rastgele senaryoda fark 0.
- S145 rastgelede 217 kalkan veriyor: borç silme (`hareket_sil`) ve Silinenler'den geri yükleme adımları şüpheli gününde borcu düşürdüğü için iki dünya düzeninde susuluyor (SK-33). Bu beklenen ama sayıca büyük.

## KULLANICIYA SORULMALI
Kâhin bu durumların hepsinde susuyor; ayrıntı §26'da.
1. **SK-30 — şüpheliden sonra Taksit Tahsilatı (S138 ailesi, uç değil):** Borç 400 → kart 400 → F 600 → şüpheli 300 → karta tahsilat 200; bakiye 800.
   - A: F 500, gecikmiş 700.
   - B: F 300, gecikmiş 500.
   - C (öneri, S138 gibi): BİLİNEN SINIR.
2. **SK-31 — S140'ın sınırları (uç):** bakiye her seçenekte aynı.
   - (a) İade kartın açığından büyük (iade 1.200, kart 1.000, Borç 500): A (öneri) artan elle borcu kapatır, Borç 300 / B artan avans kalır, Borç 500.
   - (b) Başka satış da var: A (öneri) önce kartın kendi satışı / B S2 kuyruk sırası.
   - (c) İadenin geri ödemesi: A (öneri) taksit yeniden açılır / B kart küçük kalır.
   - Her biri için C: BİLİNEN SINIR.
3. **SK-32 — satış kartı olmayan kartta iade ya da Değersiz:** Borç 900 → kart 900 → iade 300.
   - A (öneri): Tahsil Edilen 0.
   - B: Tahsil Edilen 300.
   - C: BİLİNEN SINIR. Kalan 600 her seçenekte aynı.
4. **SK-33 — tahsilat dışında önceye tarihli kayıt (çek, Alacak Yaz, stok iadesi, borç silme); bakiye seçenekler arasında farklı:** borç 1.000 → şüpheli 900 → önceye tarihli çek 300.
   - A (öneri): ret, bakiye 1.000.
   - B: kabul, bakiye 700.
   - C: BİLİNEN SINIR.
5. **SK-34 — S145'in sınırları (uç; bakiye seçenekler arasında farklı):**
   - (a) Aşım tahsilattan önce zaten var: A (öneri) ret, bakiye 1.000 / B kabul, bakiye 950.
   - (b) Şüpheliyle aynı gün borç: A (öneri) o günün borcu sayılır, kabul, bakiye 1.150 / B sayılmaz, ret, bakiye 1.200.
   - Her biri için C: BİLİNEN SINIR.

## DENENMEYEN
- Program koşulmadı.
- Taksit kaleminin takvim tutarı kâhinin dilinde yok; S110 dışındaki kartlı caride fatura takvim kalemi de yazılmıyor. Bu yüzden S136 örneğindeki "F 500 / 2. taksit 200" kalem kalem değil, gecikmişte ve R4'te denetlendi.
- Şüpheliden sonra açılan kart zaten SK-18 ile susuyor; o kol için senaryo yazılmadı. Ciro avansıyla S136 senaryosu da yok.
- SK-33'te elle senaryo yalnız çek için var; elle Alacak, stok iadesi ve silme yalnız rastgele s1'de görüldü.
- Elle senaryoda yok: havale tahsilatı, birden çok şüpheli kaydı, Değersiz yazılmış kayıtla önceye tahsilat, S145'in ret iletisi / kodu.
- S149'un alacak yönlü (Ödenecek Borç) kalemi; S144 (e).
- İki şirket ve yedek geri yükleme.

## Ana oturuma
- `model.py` değişti: mobil yazma kâhininin `cari_model_sha256`'sı yeniden üretilmeli.
- Yapım aşaması listesi açılmadı; S136–S151 alanında yeni / kalkan kayıtlar çıkabilir.
- Koşucu S145'te `tahsilat` / `kart_tahsilat` adımının "ret" durumunu okuyabilmeli (`kos.mjs` değişmedi).

## Yeniden koşulacak komutlar
Çalışma ağacında; eski kopya `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/kahineski15-eski` (bakım 14 kâhini):
```
bash docs/kanit/2026-11-13/kahineski15-arac/kos.sh utc
bash docs/kanit/2026-11-13/kahineski15-arac/kos.sh ist
```
Betikteki `W` değişkeni bu worktree'yi gösteriyor. Tek tek:
```
KANIT_DIR=<klasör> node tools/kanit.mjs kos kahineski15-cari-oz -- python3 -I -B test/bagimsiz/cari/oz-test.py
python3 -I -B docs/kanit/2026-11-13/kahineski15-arac/karsilastir.py --eski <eski kopya>/test/bagimsiz/cari --yeni test/bagimsiz/cari
```

## Okunan dosyalar
- `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/kahin-eski15-istem.txt` (1–37)
- `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/kahin-eski15-kararlar.md` (1–89)
- `CLAUDE.md` (oturum bağlamında tam metin)
- `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md` (1–82)
- `test/bagimsiz/cari/KARARLAR.md`: başlık taraması; 472–585, 907–1033, 1958–1982, 2090–2179, 2968–3232
- `test/bagimsiz/cari/model.py`: 1–72, 77–351 (yalnız grep), 532–661, 694–750, 1041–1310, 1290–1770, 2137–2306, 2826–2850, 3100–3549, 3974–4295, 4290–4584, 4615–5095
- `test/bagimsiz/cari/oz-test.py`: 1–60, 257–482
- `test/bagimsiz/cari/uretici.py`: 200–232, 320–386
- Senaryolar: d39, d40 (tamamı); d12, d30, d34 (ilgili adımlar)
- `docs/kanit/2026-11-12/kahineski14-arac/`: kos.sh, karsilastir.py, elle-karsilastir.py, elle-fark.py, mutasyon-tara.py, mutant-senaryo.py, bicim.py (tamamı); g1-sirala.py 1–30, genis-tarama.py 1–25, g1-tara.py (grep)

**Okunmayan:** `server/`, `client/`, `bulut/`, `packaging/`, `tools/` (kanit.mjs yalnız çalıştırıldı), `docs/devir/**`, iş listeleri, `YAPIM-ASAMASI.json`, `kos.mjs`, iki kâhin klasörü dışındaki `test/**`, başka ajanların kanıt dosyaları, git farkı / geçmişi.

Kanıt dosyaları `docs/kanit/2026-11-13/kahineski15-*` altında; dökümler `kahineski15-g3-dokum-utc.json` / `kahineski15-g3-dokum-ist.json`.
