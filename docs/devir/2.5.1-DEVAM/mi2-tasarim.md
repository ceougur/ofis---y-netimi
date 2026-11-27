# 2.5.1 Mİ-2 — Cari Grubuna Göre Görünümler: Tasarım Notu (koddan ÖNCE)

Kaynak: görev metni `mi-istem.txt` (Mİ-2 kullanıcı metinleri AYNEN + baş mimar tasarımı (a)–(d) + KURALLAR). Bu not yalnız uygulama ayrıntısıdır.

## 1. Veri kaynağı
- **Gruplar:** `plan_groups` (taksit kartlarıyla ortak; `parent_id` boş = grup, dolu = alt grup). Carinin grubu `accounts.group_id` / `subgroup_id`.
  Grup silinince carinin `group_id`'si temizlenmiyor (yalnız kartlarınki) → carinin GÖRÜNEN grubu yoksa (ad boş) cari "Grupsuz" sayılır — bugün listede de
  "Grupsuz" yazıyor (`whereText`). Alt grup için aynı kural ("Alt Grupsuz").
- **Tahsilat (dönem):** 'Cari Bazında Tahsilat' raporunun (`report-center.mjs` cari-tahsilat; YALNIZ okundu) satır kuralı, cari defteri satırı yerine
  doğrudan tablolardan, TOPLU SQL ile (ders 47; cari başına okuma yok):
  1. `account_entries` kind = 'in' (raporda "Nakit / Havale"): yol `method` → cash = Nakit, card = POS, bank = Havale / EFT. Yolu kaydında belli olmayanlar
     **Diğer**: kaynağı banka olan "POS Komisyon İadesi" (`source = 'bank'`), "Kredi Kartına İade" (method card + bağı Kredi Kartı hesabı), tanınmayan yol.
  2. `account_entries` source = 'cheque', kind = 'credit' (raporda "Çek / Senet (alınan)"): evrakın türü `cheques.instrument` → cheque = Çek, note = Senet;
     evrak bulunamazsa Diğer.
  3. `plan_entries` kind = 'in' (kartı silinmemiş, carili kart): `opening = 1` → **Önceden Ödenen (Açılış)** (AYRI sütun; dönem Tahsilat toplamına KARIŞMAZ);
     `cheque_id` dolu → evrakın türüyle Çek / Senet (evrak yoksa Diğer); değilse `method` ile Nakit / POS / Havale / EFT.
  Cari silinmişse (deleted_at) sayılmaz; tahsilat silinmişse satırı yoktur (tablodan silinir). Karşılıksız çıkan çek, iade, tedarikçiye ödeme: raporda tahsilattan
  düşülmüyor / sayılmıyor (raporun bugünkü düzeni) → aynısı.
- **EŞDEĞERLİK (cari başına, aynı dönem):** `Tahsilat + Önceden Ödenen` = raporun "Toplam"; `Önceden Ödenen` = raporun "Önceden Ödenen (Açılış)";
  `Çek + Senet` = raporun "Çek / Senet (alınan)" (evrakı bulunamayan satır Diğer'e düşer — o durumda Diğer farkı kadar); `Nakit + POS + Havale / EFT + Diğer` =
  raporun "Nakit / Havale" + "Taksit Tahsilatı".

## 2. Dönem
Bugün (bugün–bugün), Dün, Bu Hafta (pazartesi–pazar), Bu Ay (ayın 1'i – son günü; raporun "Bu Ay"ıyla aynı), Tarih Aralığı (başlangıç ≤ bitiş, ikisi de geçerli
gün; yoksa 400). "Bugün" sunucunun saatinden (`config.now`), saat dilimi sunucu süreci. Sınır günleri DAHİL; ileri tarihli tahsilat dönem dışında kalır.

## 3. Uçlar (sunucu)
- `GET /api/workspace/accounts` — yeni parametreler `period`, `from`, `to`, `paid=1`. **`period` yoksa yanıt ve iş BUGÜNKÜ gibi** (yardımcı çağrılmaz, yeni alan
  yok). `period` varsa: her satıra `collected` { total, cash, card, bank, cheque, note, other, opening }, `totals.collected` (aynı alanlar; süzgeçten SONRA) +
  `totals.collectedCount` (dönemde ödeme yapan cari sayısı), `period` { key, from, to }. `paid=1` = "Bu Dönemde Ödeme Yapanlar": `collected.total > 0`.
- `GET /api/workspace/accounts/group-summary` — aynı süzgeçler (durum, tür, arama, bakiye, ödeme yapanlar, dönem; grup / alt grup HARİÇ). Liste'nin
  `list()`'i BİR kez koşar, satırlar gruplanır → satır toplamı = TOPLAM = süzgeçsiz (grup / alt grupsuz) Liste kartları (yapı gereği).
- `GET …/group-summary.pdf`, `…/group-summary.xlsx` — ekranla aynı satırlar / sütunlar, alt TOPLAM satırı; alt gruplar girintili.
- `group=__none` (Grupsuz) ve `subgroup=__none` (Alt Grupsuz) süzgeç seçenekleri (satıra tıklayınca Liste bunlarla açılır).
- Yetki: `accounts.view` (Cari ekranının kendi yetkisi). Bugün bu yetkiyle cari kartının defterinde her tahsilat tutarı görülüyor (personel dahil) → bu sütunlar
  yeni bir sır açmıyor. `accounts.view` olmayan özel rol iki uçta da 403.

## 4. Sütun tanımları (Grup Özeti) ve eşi olan mevcut sayı
| Sütun | Tanım | Aynı olması gereken mevcut sayı |
|---|---|---|
| Cari | süzgeçteki cari sayısı | Liste'nin "N cari" toplamı (`total`) |
| Bakiye | carilerin bakiyelerinin toplamı (borçlu +, alacaklı −) | Liste `totals.balance` = Borçlular − Alacaklılar |
| Taksitlerden Kalan | | Liste kartı "Taksitlerden Kalan" |
| Gecikmiş Borç | vadesi geçmiş açık borç (taksit, fatura, borç kaydı) | Liste kartı "Gecikmiş Borç" (tutar) |
| Geciken Taksit | geciken taksit sayısı | Liste satırlarındaki "N geciken" toplamı |
| Tahsilat | dönem tahsilatı (beş yol + Diğer; açılış hariç) | Liste'nin yeni "Tahsilat" kartı; rapor satırı (§1 eşdeğerlik) |
| Nakit / POS / Havale / EFT / Çek / Senet / Diğer | kırılım; toplamı = Tahsilat | — |
| Önceden Ödenen (Açılış) | dönemde Excel'den yüklenen önceden ödenen | raporun aynı adlı sütunu |
"Diğer" ve "Önceden Ödenen (Açılış)" sütunları değer varsa görünür (ekran = PDF = Excel aynı kural).

## 5. Ekran düzeni (kısa çizim)
```
[Aktif|Pasif|Tümü]                         [Liste | Grup Özeti]   [+ Yeni Cari] [Excel / Sheets'ten Yükle]
[Ara…][Tüm Türler][Tüm Gruplar][Alt Grup][Tüm Bakiyeler][Sırala][PDF][Yazdır][Excel]
[Dönem: Seçilmedi ▾ Bugün/Dün/Bu Hafta/Bu Ay/Tarih Aralığı] [gg.aa.yyyy – gg.aa.yyyy] [☐ Bu Dönemde Ödeme Yapanlar]
Liste:  kartlar … + [Tahsilat · Bugün ₺… · N cari]; tabloda Bakiye'den sonra "Tahsilat" sütunu (toplam + yol kırılımı küçük yazı)
Grup Özeti: Grup | Cari | Bakiye | Taksitlerden Kalan | Gecikmiş Borç | Geciken Taksit | Tahsilat | Nakit | POS | Havale / EFT | Çek | Senet | (Diğer) | (Önceden Ödenen)
            ▸ A Grubu …            (tıkla / Enter → Liste A Grubu'na süzülür; ▸ alt grupları açar)
               › 1. Sınıf …
            Grupsuz …
            TOPLAM …
```
Grup Özeti dönemsiz açılırsa dönem "Bugün" olur (müşterinin ilk sorusu). "Bu Dönemde Ödeme Yapanlar" açıkken toplu seçim yalnız TEK TEK işaretlenenlerle
çalışır ("Tümüne WhatsApp" gizli, başlık kutusu ekrandakileri seçer) — WhatsApp uçları (dokunulmaz) bu süzgeci bilmez, süzgeçteki "hepsi"ne gitmesin.

## 6. Hacim bütçesi (ders 47, 53)
2.000+ cari / 100 bin para satırı: Grup Özeti ≤ 2 sn, dönemli Liste ≤ 2 sn (olay döngüsü en çok da yazılır); dönemsiz Liste tabana göre ≤ %10 kötü. Yardımcı
üç `GROUP BY` sorgusu (tarih aralığında); `list()` zaten tek geçiş.

## 7. Kurallar (görev metninden)
Carinin eski tahsilatı BUGÜNKÜ grubunda sayılır (grup geçmişi tutulmuyor — teslim notuna). Rapor Merkezi kısmı bu turda YOK.
