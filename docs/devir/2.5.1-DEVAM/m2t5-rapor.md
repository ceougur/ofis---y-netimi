# 2.5.1 — Değersiz Alacak sınırı TUR 5 raporu (taslak; adım adım doldurulur)

Taban: `t251-m2t5-taban` (9a2b5113). Görev metni: `docs/devir/2.5.1-DEVAM/m2t5-istem.txt`. Kararlar: SK-64 = A, ORTA-A, ORTA-B (S-251Y-1 = A).

## 0. NASIL BOZULUR (koddan ÖNCE yazıldı)

Değersiz Alacak satırı olan cari (taban T: Fatura 2.900 + Borç 3.400; 17.09 bağlı tahsilat 2.876,45; 17.09 Şüpheliye Al 3.000; Değersiz 3.000 @17.09 → bakiye 423,55):

1. Ödeme (cari kartında `Ödeme`) satırı:
   - silme → bakiye düşer; eksiye giderse RET olmalı (SK-64 örneği: −76,45 iken 500'lük Ödeme silinirse −576,45 → RET, −76,45 kalır);
   - tutar DÜŞÜRME (kısmi silme) → aynı sınıf; tutar ARTIRMA → bakiye yükselir, ret yok;
   - tarih değişikliği → bakiye değişmez, ret yok (değişmez başka nedenle kırmızı olmamalı);
   - Borç'a / Alacak'a çevirme → programda tahsilat / ödeme yön değiştirmez (yalnız Borç ↔ Alacak) — 400 / yok sayılır mı ölç;
   - başka cariye taşıma → ESKİ cari düşer (ret), yeni cari yükselir;
   - POS İadesi (kartla Ödeme / iade satırı) silme ve düzeltme → aynı sınıf; Banka → POS İşlemleri'nden iadeye giden ayrı silme yolu var mı (tara).
2. Alacak Yaz satırı:
   - tutar ARTIRMA → bakiye düşer; eksiye giderse RET;
   - Borç'a çevirme → bakiye yükselir, ret yok; silme → yükselir, ret yok;
   - başka cariye taşıma → eski cari yükselir; YENİ cari (Değersiz'li olabilir) düşer — kararın söylemediği yol (yeni Alacak Yaz gibi mi?) → ölç, iki okuma varsa SOR;
   - YENİ Alacak Yaz (BM-M2T4-3: kapsam DIŞI, kabul) → yeniden ölç: kabul kalmalı.
3. Tahsilat: tutar artırma / yeni tahsilat (avans) → BM-M2T4-3 KABUL kalmalı; silme → yükselir.
4. Taksit kartı:
   - Otomatik Dağıt ile toplam DÜŞER (3.400 → 100) → RET, atomik (kart toplamı, taksitler, bakiye, defter değişmez); toplam ARTAR / AYNI → kabul; taksit sayısı 1 / 2 / 12;
   - dönem kilidi Kayıt Tarihi'ni kapsıyorsa kilit iletisi Değersiz iletisinden ÖNCE;
   - kartın ödeme / iade hareketi (Taksit Ödemesi / İadesi) silme / tutar düşürme → Ödeme sınıfı;
   - kartın toplamını değiştiren başka yollar (iade / iptal kırpması, büyütme, Kartı Kapat, Silinenler'den geri yükleme, Excel yüklemesi) → tara.
5. Sınır değerleri: bakiyeyi TAM 0'a götüren işlem kabul; 1 kuruş eksi RET; zaten eksi carinin daha da eksiye gitmesi RET; eksiden daha az eksiye (yükselen) kabul.
6. Değersiz satırı silinmiş cari, hiç Değersiz'i olmayan cari → yeni denetim çalışmaz (S155 bugünkü gibi).
7. 'Ne yapmalı' iletisi: söylediği adımlar (Değersiz satırını sil → [gerekirse şüpheli kaydı sil / Şüpheliden Çıkar] → işlemi yinele) işlemi GERÇEKTEN kabul ettirmeli; ileti sözcüğü işlemin kendi adıyla ('Ödeme hareketi', 'Alacak hareketi' — 'Borç hareketi' DEĞİL).
8. Silinenler taraması (ORTA-B): Silinenler'de 0 / 5.000 / 20.000 fatura × silme anı Değersiz'den önce / SONRA × Değersiz satırlı 1 / 10 cari; başka carilerin silinmiş faturaları; taslak silme; Silinenler'den geri yükleme; aynı gün bağsız tahsilat Değersiz'den ÖNCE yazılmış (tarama gerçekten gereken sınıf) → eski tam tarama ile sayım BİREBİR; Mutabakat ve tahsilat yazımı Silinenler'le büyümemeli.
9. Ortam: iki şirket (şirket ayrı dosya — denetim şirketin kendi deposunda), yedek geri yükleme (geri yüklenen veride aynı kural), iki saat dilimi (UTC, Europe/Istanbul), sahte saat 15.10.2026; v2.5.0 gerçek verisi fikstürü (eski sürüm verisinde Değersiz satırı + eksi bakiye → kapı tabanı).
10. Yarıda kesilme: ret 409 işlemin içinde → hiçbir satır yazılmaz (cari hareketi, Kasa, banka, defter, Silinenler, Değişiklik Geçmişi).
