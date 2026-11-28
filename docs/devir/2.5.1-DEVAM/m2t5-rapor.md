# 2.5.1 — Değersiz Alacak sınırı TUR 5 raporu

Taban: `t251-m2t5-taban` (9a2b5113). Görev metni: `docs/devir/2.5.1-DEVAM/m2t5-istem.txt`. Kararlar: SK-64 = A, ORTA-A, ORTA-B (S-251Y-1 = A).
Bu dosya rapor taslağıdır; SON hâli ajanın son iletisidir (aşağıdaki "SONUÇLAR" bölümü koşular bitince doldurulur).

## 0. NASIL BOZULUR (koddan ÖNCE yazıldı — commit c97a5d6d)

Değersiz Alacak satırı olan cari (taban T: Fatura 2.900 + Borç 3.400; 17.09 bağlı tahsilat 2.876,45; 17.09 Şüpheliye Al 3.000; Değersiz 3.000 @17.09 → bakiye 423,55):

1. Ödeme (cari kartında `Ödeme`) satırı: silme (SK-64 örneği −76,45 → −576,45 RET); tutar DÜŞÜRME; tutar ARTIRMA (ret yok); tarih (ret yok); tür değişikliği (programda tahsilat / ödeme yön değiştirmez); başka cariye taşıma (ESKİ cari düşer); POS İadesi silme / düzeltme; Banka → POS İşlemleri'nden ayrı silme yolu var mı.
2. Alacak Yaz: tutar ARTIRMA (RET); Borç'a çevirme / silme (yükselir); başka cariye taşıma (YENİ cari düşer — kararın söylemediği yol); YENİ Alacak Yaz (BM-M2T4-3: kabul).
3. Tahsilat artışı / yeni tahsilat (avans) → BM-M2T4-3 kabul.
4. Taksit kartı: Otomatik Dağıt toplam düşer / artar / aynı × taksit sayısı; dönem kilidi önce; kartın ödeme / iade hareketi silme / düşürme; kart toplamını değiştiren başka yollar.
5. Sınır: tam 0 kabul; 1 kuruş eksi ret; zaten eksi carinin daha da eksiye gitmesi ret.
6. Değersiz satırı silinmiş / hiç olmayan cari → yeni denetim çalışmaz.
7. 'Ne yapmalı' adımları işlemi gerçekten kabul ettirmeli; ileti işlemin kendi adıyla.
8. Silinenler (ORTA-B): 0 / 5.000 / 20.000 fatura × silme anı önce / SONRA × 1 / 10 cari; başka carilerin faturaları; taslak; geri yükleme; aynı gün Değersiz'den ÖNCE bağsız tahsilat (taramanın gerçekten gereken sınıfı) → eşdeğerlik BİREBİR, hız büyümemeli.
9. İki şirket, yedek geri yükleme, iki TZ, sahte saat, v2.5.0 verisi.
10. Yarıda kesilme: 409 işlemin içinde → hiçbir satır yazılmaz.
