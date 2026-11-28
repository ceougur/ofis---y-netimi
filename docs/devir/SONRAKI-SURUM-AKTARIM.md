# 2.5.1'den Sonraki Sürüme Aktarım

Kullanıcı kararı, 28.11.2026 (AYNEN):
- "limit yetmez. devir zincirini D4a tur 1 i başlatma diğer sürüme bırakalım kalan işleri. değersiz tur ve kdv tur 6 bitince sürümü yayınlayalım. müşteri istekleride beklememiş olur."
- "2.5.1 de yapmayı planladığımız kalan işlerin hepsini öbür sürüme güvenle aktar"

Bu belge, 2.5.1'de planlanıp yapılmayan bütün işlerin sonraki sürümde (numarayı kullanıcı verir; öneri 2.5.2) kaldığı yerden sürdürülmesi için TEK GİRİŞ NOKTASIDIR. Kararların tam metni `docs/2.5.1-IS-LISTESI.md` (C ve D), zaman sırası `docs/2.5.1-IS-LISTESI-KAYIT.md`, kapsam `docs/devir/2.5.1-PLAN-TASLAK.md`. Bu belgedeki her iş, sonraki sürümün iş listesine A tablosu satırı olarak taşınır. DERS 5: kâhin ajanlarına bu belge VERİLMEZ (program dosya adları içerir).

## 0. 2.5.1'de KALAN (bu belgenin konusu DEĞİL)
- Değersiz Alacak sınırı: tur 4 dar kontrolü → tur 5 (SK-64 = A + dar kontrolün YÜKSEK / ORTA bulguları) — S-251Y-1 = A.
- KDV Özeti küçük tur 6 (tur 5 dar kontrolünün ORTA-1'i — uyuşmazlık notunun metni) + dar kontrolü.
- Aday kapısı (S-251Y-3 = A) → PR → kullanıcı "birleştir" → yayın.

## 1. Birleşmemiş işlerin GÜVENLİ kopyası
Ajanların bitirip çalışma dalına girmemiş işleri yalnız kapsayıcıdaki YEREL etiketlerdeydi; hepsi tek git paketine kondu ve depoya girdi:
- Dosya: `docs/devir/sonraki-surum/t251-birlesmemis.bundle` (1,7 MB; `git bundle verify` geçti; ön koşul commit'leri çalışma dalında: d183d780, 8e0550aa).
- Geri yükleme (yeni kapsayıcıda, depo kökünde): `git fetch docs/devir/sonraki-surum/t251-birlesmemis.bundle 'refs/tags/*:refs/tags/*'` → `git tag -l 't251-*'`.
- İçindeki 12 etiket (dal uçları; her biri rapor + kanıtıyla):

| Etiket | Uç | İş | Rapor (etiketin içinde) |
|---|---|---|---|
| t251-kilit-tur1 | 45d3e3ce | Kilit paketi tur 1 | docs/devir/2.5.1-DEVAM/kilit-rapor.md |
| t251-kilit-tur2 | c8384d0f | Kilit paketi tur 2 (tur 1 dahil) | docs/devir/2.5.1-DEVAM/kilit2-rapor.md |
| t251-kc31-yarim | 0c4237a1 | Cari kâhini bakımı 31 (ara uç) | — (kc32'ye dahil) |
| t251-kc32 | f8ccd96e | Cari kâhini bakımı 31 + 32 | kâhinin kendi belgeleri |
| t251-kc33 | 941c984c | Cari kâhini bakımı 33 | kâhinin kendi belgeleri |
| t251-kseml-taban | e602785d | Sürücü eşlemesinin tabanı | — |
| t251-kseml | 42a1a74c | Cari kâhininin program sürücüsü eşlemesi | docs/devir/2.5.1-DEVAM/kseml-rapor.md |
| t251-kc34 | a2039322 | Cari kâhini bakımı 34 (31–33 + eşleme dahil) | kâhinin kendi belgeleri |
| t251-kd2 | d87d6100 | Muhasebe kâhini devir bakımı 2 | kâhinin kendi belgeleri |
| t251-kd3 | a8dc8cda | Muhasebe kâhini bakımı 3 (2 dahil) | kâhinin kendi belgeleri |
| t251-surucu-taban | 2cc4023f | Devir sürücüsünün tabanı | — |
| t251-sur | efa44ba2 | Kâhin ↔ devir planı karşılaştırması (muhasebe sürücüsü) | docs/devir/2.5.1-DEVAM/sur-rapor.md |

Görev metinleri ve üreticileri çalışma dalında: `docs/devir/2.5.1-DEVAM/<ad>-istem.txt` + `<ad>-uret.py` (kararlar iş listesinden AYNEN çekilir — yeni sürümde iş listesinin adı değişirse üreticideki dosya yolu güncellenir).

Ana oturumun ölçüm / ekran yürüyüşü / yeniden üretim betikleri (kapsayıcıdaki not defterinden kopya; ölçüm verisi depoda değil — `tools/kapi-olcum.mjs` düzeniyle yeniden üretilir, 100 bin para satırı, iki şirket): `docs/devir/sonraki-surum/not-defteri/` (ana-kabul-betik: kabul.sh, olc-yazim / olc-kart, yuruyus*.mjs; olcum: KDV / Değersiz / devir ön izlemesi ölçümleri; dar-kontrol: son dar kontrollerin betikleri). Betiklerdeki mutlak not defteri yolları yeni kapsayıcıya göre düzeltilir.

## 2. Aktarılan işler (sıra = önerilen sıra)

### 2.1 TEK BORÇ SIRASI ZİNCİRİ (kullanıcı 27.11 20:23 UTC — iş listesi D, AYNEN geçerli): KİLİT PAKETİ → D4a TUR 2 → ÖDEME HATIRLATMA KOD TURU
1. **KİLİT PAKETİ tur 1 + 2** (hazır, birleşmedi; S-251Y-2 = A ile bu sürüme alınmadı). Kararlar: S-T4-1 = A, S-KD2-3 = A, S-T4-1-K = A, S-T4-1-K-İ = A, S-SUR-1 = B (POS İşlemleri'nin iade yolları dahil), SK-65 = A, BM (b)–(e). Kalan: ana oturum yeniden koşusu (tur 1 + 2, iki TZ, eski kod kırmızısı), hız (cari kartı, Cari Listesi, Açık Faturalar, devir ön izlemesi, kilit ucu), kâhin karşılaştırması (önce cari kâhini 31–34 ve muhasebe kâhini 2–3 çalışma dalına), tam npm test (ders 41), birleşim (iki ekran senaryosu CI / yayın listelerine), CI (Windows), TEK dar kontrol (eski izsiz veride sayı değişimi ölçülür; SK-65 ölçülür; d71 IK taksit kartı 'Toplam / Ödenen' farkı — BM-KS-2 — kilit tur 2 koduyla ölçülür). DİKKAT: tabanı t251-kilit-taban (eski çalışma dalı) — 2.5.1'de çalışma dalına KDV tur 1–6, Değersiz tur 1–5, müşteri istekleri tur 1–3 girdi; cari / fatura rotası ve cari listesi istemcisinde ÇAKIŞMA beklenir (Değersiz tur 4–5 cari hareketi / taksit kartı rotasına, Mİ tur 3 cari listesi istemcisine dokundu) → önce birleşim kuru denemesi (`git merge-tree`), çakışma varsa yeni ajan turu (rebase değil). Sonra: cari kâhini bakımı 35 + sürücü eşlemesi 2 (POS iadesi dil adımı).
2. **D4a TUR 2** (devirli dosyanın tek borç sırası / defter rotası / şüpheli defter türetmesi içindeki kuralları) — kilit paketi çalışma dalına girdikten sonra; şartı: plan okuyucunun 'önce Ters Kaydet' adımı.
3. **ÖDEME HATIRLATMA (Ç5-C) KOD TURU** — ilke taslağı ONAYLI (`docs/devir/C5C-ILKE-TASLAK.md`; on soru = A + baş mimar ekleri); WhatsApp kâhini 21 + 22 çalışma dalında; cari kâhini bakımı 31 (kc zincirinde) Ödeme Hatırlatma kısmını taşıyor; kod turu D4a tur 2'den sonra; S-C5C-4 = A → yeni taksit kartı açma sınırı ayrı küçük tur. Program bugün eski 'gecikmiş' anlamında (2.5.0 BİLİNEN SINIR, sürüyor).

### 2.2 DEVİR (hedef: müşterilerin 1 Şubat sınırı — kullanıcı 10.11, AYNEN geçerli; bu takvim 2.5.1 ile KARŞILANMADI)
- Çalışma dalında: D0–D2 (2.5.0) + D3 tur 1–6 (saf hesap, Devir Raporu, ön denetim, DEVİR NEDEN DURDU iletileri — yalnız sunucu / yönetici API'si; istemcide ekran YOK). D3, CI #1124'ün uçtan uca işi yeşilse KAPANIR (2.5.1'de okunur).
- **D4a TUR 1** — görev metni HAZIR: `docs/devir/2.5.1-DEVAM/d4a1-istem.txt` (üretici d4a1-uret.py). Taban etiketi ajan başlarken konur (t2xx-d4a-taban = o anki çalışma dalı). Göç numaraları 55–59 (G-1 … G-5) 2.5.1'de VERİLDİ — sonraki sürümde araya başka göç girdiyse numaralar yeniden verilir. Şartlar arasında D3 tur 6 dar kontrolünün yalnız-test DÜŞÜK-1'i (kapanış gününde `closed_at` önceliği — kalıcı test) ve Devir Raporu'nun carisiz 127 / 519 satırları (DOĞRULANMADI — BM).
- **D4b** (uygulayıcı + takas) → **D4c** (Geri Al / Devri Yenile) → **D5** (sihirbaz + arşiv görünümü + kılavuz) → **D6** (WhatsApp 'kime kaç kez' — Devri Geri Al / geri yükleme). Tasarım `docs/devir/D3-D4-TASARIM.md`, plan `docs/devir/DEVIR-PLANI.md`.
- DEVİR YERİ kuralı (kullanıcı 27.11 10:26) ve DEVİR NEDEN DURDU kuralı (27.11 11:39) AYNEN sürer (CLAUDE.md).
- **Devir sürücüsü (t251-sur)**: ana oturum yeniden koşusu → birleşim (D3 artık çalışma dalında).
- HIZ: devir ön izlemesi ~17–18 sn (bütçe 10 sn; ~10 sn'si tek borç sırası) — kullanıcı 27.11 18:36 kararıyla SONRAKİ SÜRÜM (yapısal hız işi).

### 2.3 KÂHİN BAKIMLARI (kodu görmeyen; birleşim kuralları AYNEN)
- **Cari kâhini 31–34 + sürücü eşlemesi** (t251-kc34 zinciri): ana oturum yeniden koşusu (öz test iki TZ, kâhin ↔ program iki TZ, tabanda bilinmeyen dil adımı kırmızısı, G3), sürücünün paket etiket listesine dört etiket (Kilit paketi, Değersiz sınırı tur 2, Cari kâhini 34, Mahsup Et sınırı) + `etiketle.py --yeni-etiketler`, 'AYRIŞTIRILMADI' 0, yapım aşaması listesi kuralı. DİKKAT: 2.5.1'de Değersiz tur 4–5 programı değiştirdi (S-DKM2T3-1 = A, SK-64 = A, ORTA-2 önerilen tutar) → kâhin bakımı 34 bunları içeriyor, karşılaştırma YENİ program koduyla yapılır; farklar karar numarasıyla sınıflanır.
- **Muhasebe kâhini devir bakımı 2 + 3** (t251-kd3): ana oturum yeniden koşusu → birleşim.
- Sonra: cari kâhini bakımı 35 + sürücü eşlemesi 2 (POS iadesi dil adımı — kilit paketinden sonra); Ödeme Hatırlatma için cari + WhatsApp kâhini bakımları (girdi `c5c-kararlar.md`).

### 2.4 KÜÇÜK ÜRÜN İŞLERİ (plan taslağı §3–§5)
- **Mİ-2 (d)**: Rapor Merkezi'nde gruba göre rapor + üç rapora grup süzgeci (yapılmadı).
- **K1–K5, H, İ** (plan taslağı §4–§5): birleşik turlar — kapsam `docs/devir/2.5.1-PLAN-TASLAK.md`.
- **WhatsApp küçükleri**: Mİ tur 3 dar kontrolünün DÜŞÜK-1'i (Grup Özeti'nden Liste'ye geçerken ≤ ~1 sn 'Tümüne WhatsApp' eski listeyle görünüyor; tabanda da var — müşteriye ileti gidebilir; en küçük düzeltme iş listesi D 28.11 03:35'te).
- **HIZ** (kullanıcı 27.11 18:36 AYNEN: "taksit tahsilat raporu, tüm cari hareket raporu ve devir ön izlemesi hız yavaşlamalarını düzeltmeyi sonraki sürüme bırak"): üç yavaşlık + Değersiz Yaz / Silinenler'den geri yükleme ~6 sn (2.5.0'dan).
- **Ç6-ÖN + Ç6-EKRAN** (Gelir Tablosu / Bilanço düzeltmesi ve ekranları) — kullanıcı 27.11 19:58 kararıyla zaten sonraki sürüm.

- **ADAY DAR KONTROLÜ ORTA-1 / ORTA-2** (kullanıcı 28.11 17:30 UTC, AYNEN: "bir sonraki sürümde düzeltilsin 2 bulguda" (S-DKA-1 yanıtı) ve "Sonraki sürüme bırak" (S-DKA-2 yanıtı)): KDV Özeti kayıtsız ay atlanınca azalışın ay kayması (S-DKA-1; öneri A) ve aynı ret ikinci kez denenince uzun bildirimin gizli kalması (S-DKA-2) + altı DÜŞÜK — ayrıntı iş listesi B (28.11 17:30).
### 2.5 SONRAKİ SÜRÜME (20.11 kuralı) listesi
`docs/2.5.1-IS-LISTESI.md` B bölümünün TAMAMI aynen taşınır (test düzeni, kâhin iç bakımı, yaşayan mutantlar, görünüm ayrıntıları, ölçüm nüansları).

## 3. Sonraki sürümde geçerli kalan kullanıcı kararları
İş listesi C ve D'deki BÜTÜN kullanıcı kararları ve '20:26 yetkisiyle öneri uygulanan' yanıtlar (kullanıcı değiştirebilir) aynen geçerlidir; özellikle: devir S-1 / S-2 / S-3 = A, S-KD-1 / 2 = A, S-KD-3 = B, S-T2-1 = B, S-T4-1 = A, S-T4-1-K / -İ = A, S-KD2-3 = A, S-SUR-1 = B, S-SUR-2 = A, S-KD3-1 = a, S-KD3-2 = b, S-KD3-3 = a, SK-59 = A, SK-60 = C, SK-63 = C, SK-64 = A, SK-65 = A, S-KSEML-1 = A, Ödeme Hatırlatma on soru = A, S-W21-1/2/3 ve SK-56/57/58 = A, S-251Y-1/2/3 = A.

## 4. Yeni sürüm başlarken ilk adımlar
1. Bu belge + CLAUDE.md + `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md` okunur.
2. Paketten etiketler geri yüklenir (§1), `git tag -l 't251-*'` ile 12 etiket görülür.
3. Yeni iş listesi + KAYIT açılır ve BELGE_YOLLARI'na eklenir (araç + ci.yml + test — 2.5.1'in Dalga 0a'sı gibi).
4. §2'deki işler A tablosuna; birleşmemiş dalların her biri için önce `git merge-tree` kuru denemesi.
5. RAPOR DÜZENİ (30 dk ara rapor) kurulur.
