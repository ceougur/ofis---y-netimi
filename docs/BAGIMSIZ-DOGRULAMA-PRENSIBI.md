# Bağımsız Doğrulama Prensibi (dar kontrol ve katmanlı doğrulama)

Kullanıcı kararı, 31.10.2026: "bu çalışma prensibinden vazgeçmemeliyiz. gerekirse bir md dosyası olmalı bu çalışma prensibi".
Bu belge KALICIDIR. Her sürümde, her düzeltmede uygulanır. Anayasa (CLAUDE.md) ve dersler 1–44 ile birlikte okunur; çelişkide
anayasa geçer. Değiştirmek için kullanıcı kararı gerekir.

## 1. Neden
Testi yazan el, kodu yazan elle aynı varsayımı taşır (ders 5, 16). 2.4.8'de WhatsApp gönderim çekirdeğindeki ince hatalar
(ay sonunda aynı ekstrenin iki kez gitmesi, "Yeniden Dene" ile gidenin sonraki seçimde görünmemesi, yalnız UTC'de dişli test)
ancak kodu yazan ajandan BAĞIMSIZ, yalnız hata arayan ajanların zorla yeniden ürettiği senaryolarla bulundu. Her düzeltme kendi
gerilemesini getirebildi; bu yüzden tek tur yetmez, düzeltmeden sonra yalnız o farka yeni bir tur gelir.

## 2. Katmanlar (hiçbiri tek başına yetmez)
1. **Kâhin (temiz oda):** programın kodunu GÖRMEYEN ayrı ajan, plandan ve kullanıcı kararlarından, ayrı dilde (Python) model yazar;
   program senaryo senaryo karşılaştırılır (ör. 2.4.8 K0/T1, 145 senaryo). Kâhin programa uydurulmaz (ders 40).
2. **Bağımsız gözden geçirme:** son adayın tamamına bir tur, yalnız hata arar (ör. 2.4.8 T2).
3. **Dar kontrol:** her düzeltmeden SONRA, YALNIZ o düzeltmenin farkına (`git diff <önceki>..<düzeltme>`) yeni bir incelemeci (§3).
4. **Tam kapı:** tam `npm test` + ci.yml'nin bütün e2e'leri + CI dışı senaryolar (ders 8, 35, 37, 41).
5. **Bağımsız koşucu:** GitHub CI — Linux + Windows × Node 22/24 + e2e; Uzun Doğrulama + windows.yml ×2 aynı commit'te (ders 1, 18, 21).
6. **İnsan:** teslimde kısa elle kabul listesi (KANIT KURALI 5).

## 3. Dar kontrol ajanının kuralları
- **Bağımsızlık:** düzeltmeyi yapan ajan incelemez. İncelemeci düzeltenin gerekçesini/raporunu görmez; eline yalnız fark (commit aralığı),
  kullanıcı kararlarının AYNEN metni, anayasa + dersler ve iş listesindeki ilgili satır verilir. Kararın baş mimar yorumu ayrıca
  "değerlendir, karar metnine uyuyor mu" diye verilir.
- **Efor:** her zaman `xhigh` (anayasa: AJAN EFORU).
- **Yalnız hata arar:** kod değiştirmez, commit/push yapmaz, çalışma ağacına dokunmaz.
- **Zorla yeniden üretme:** her bulgu bir betikle GERÇEK programda (sahte dış servisle — sahte Meta, `HUKUK_LICENSE_URL=http://127.0.0.1:9`)
  üretilir; çıktıda sayı vardır ("B'ye 2 ileti", "ikinci iş 200"). Üretilemeyen kuşku ayrı başlıkta "DOĞRULANMADI" yazılır, bulgu sayılmaz.
- **Eski kodla karşılaştırma:** aynı betik eski commit'te, `git archive <commit> | tar -x` ile ayrı kopyada koşulur (ders 23); gerilemenin
  hangi commit'le geldiği yazılır. Kopyalar benzersiz not defteri klasöründe (ders 25), iş bitince yalnız kendi tam yoluyla silinir (ders 36).
- **Ne aranır:** kararın yanlış/eksik uygulanması; değişen yardımcıyı kullanan HER çağıran (ders 10); gün/ay/yıl dönümü ve saat dilimi
  (ders 13, 22 — gerekirse TZ=UTC ve TZ=Europe/Istanbul); yarıda kesilme / yazım düşmesi; eski veri ve göç; iki şirket / yedek geri yükleme
  (ders 17); dış istekten iç alanın enjekte edilmesi; testin dişi — yeni test eski kodda BEKLENEN NEDENLE kırmızı mı (ders 7, 38),
  mutasyonda rastlantıyla geçen test var mı.
- **Rapor:** her bulgu için sınıf (YÜKSEK / ORTA / DÜŞÜK), dosya:satır, betik yolu + çıktı, kök neden, en küçük düzeltme önerisi; "kime kaç kez"
  ya da para/kapama kuralı gerekiyorsa ayrıca "KULLANICIYA SORULMALI"; sonra DOĞRULANMADI ve DENENMEYEN. Bulgu yoksa açıkça "YÜKSEK/ORTA YOK".

## 4. Bulgudan sonra
- **YÜKSEK / ORTA düzeltilir; DÜŞÜK sonraki sürüme** (KARAR REVİZYONU + sakınca süzgeci; kuşkuda "müşteriye sorun" sayılır). Yalnız teste
  dokunan, ürün riski olmayan DÜŞÜK (dişsiz test) aynı turda düzeltilebilir.
- **Kural kullanıcınındır:** "kime kaç kez", para / kapama sırası gibi netleştirmeler baş mimarca kesinleştirilmez; kullanıcıya iki seçenekli
  (öneriyle) sorulur, yanıt gelene kadar ne kodda ne kâhinde kesinleşir, 5 dk yetkisi uygulanmaz (ders 43). Soru ÖNCE kullanıcıya iletilir,
  belgeye "SORULDU" ancak iletildikten sonra yazılır.
- **Baş mimar kararları** (karar metninin yorumları) iş listesinde "BAŞ MİMAR KARARI" diye listelenir, kullanıcıya gösterilir (ders 40);
  bir yorum "kime kaç kez" kuralına dokunuyorsa bilgi diye geçilmez, soru olarak sorulur (öz denetim 2, 31.10.2026).

## 5. Düzeltme ajanının kuralları
- Ayrı worktree ve dalda çalışır; commit yalnız kendi yollarıyla (ders 44); PUSH YOK (ana oturum birleştirir).
- Her yeni test: eski kodda (ayrı kopya) beklenen nedenle kırmızı + yeni kodda yeşil; mutasyonda kırmızı (ders 7, 38).
- Her koşu `tools/kanit.mjs kos` ile; ham çıktılar `docs/kanit/<gün>/` ve ayrı "Kanıt:" commit'i (KANIT KURALI 4).
- Bitişte değişen alanın dar listesi + o davranışa dokunan e2e'ler; tam `npm test` adayda.
- Efor işin sınıfına göre (anayasa: AJAN EFORU) — küçük tek dosya düzeltmesi medium.

## 6. Ana oturumun görevi
- Ajan raporu kanıt değildir (ders 16): yeni testleri ana oturum kendisi yeniden koşar (gerekiyorsa iki saat diliminde), sayıları okur.
- Her tur sonucu ve kararı AYNI ANDA iş listesine yazılır ve gönderilir; sıkıştırmadan önce belge her şeyi taşır.
- Disk ders 24'e göre izlenir; bitmiş eski kod kopyaları tam yolla silinir.

## 7. Durma kuralı
Düzeltme → yalnız o farka yeni dar kontrol → YÜKSEK/ORTA yoksa adaya geçilir. Yeni tur YALNIZ yeniden üretilmiş bulgu varsa açılır
(Verimlilik: tur sayısı sınırlı). Adayda kalan DÜŞÜK'ler ve DOĞRULANMADI maddeleri teslim notunun BİLİNEN SINIRLAR / DENENMEYEN bölümüne gider.

## 8. Bilinen sınır
İncelemeci de kaçırır: 2.4.8 dar kontrol 3, kendi kapsamındaki "Yeniden Dene" gerilemesini görmedi; dar kontrol 4 yakaladı. Bu yüzden
katmanlar birbirinin yerine geçmez ve her düzeltmeden sonra tur yinelenir.

## 9. Görev metni iskeleti (dar kontrol)
```
Sen DestekOfis projesinde bağımsız DAR KONTROL <n> incelemecisisin; yalnız HATA ararsın, düzeltme/commit/push YAPMAZSIN. Yanıtın Türkçe.
ÖNCE oku: CLAUDE.md (anayasa + dersler), docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md, iş listesinde ilgili satır.
KAPSAM (DURMA KURALI — yalnız bu fark): <depo>, `git diff <önceki>..<düzeltme>`; bu farktaki işler: <liste>.
KULLANICI KARARLARI (aynen): <metin>. BAŞ MİMAR YORUMLARI (değerlendir): <liste>.
NE ARA: <alana özgü riskler> + §3 genel liste.
YÖNTEM: §3 (zorla üret, eski kod ayrı kopyada, benzersiz not defteri klasörü, gerçek servis yok, pkill/joker rm yok, tam npm test yok).
RAPOR: §3 rapor biçimi.
```
