# ANA OTURUM — Ç7b TUR 2b görev metni üreteci: c7b2-istem-uret.py'nin çıktısını alır, tur 2b kararlarıyla (iş listesi D, AYNEN) değiştirir.
# Çağrı: cd <depo>; python3 -I <bu> <çıktı>
import os, sys, subprocess
SP = '/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad'
gecici = SP + '/c7b2b-taban-metin.txt'
subprocess.run([sys.executable, '-I', SP + '/c7b2-istem-uret.py', gecici], check=True)
m = open(gecici, encoding='utf-8').read()
il = open('docs/2.5.0-IS-LISTESI.md', encoding='utf-8').read().split('\n')
K = [l.strip() for l in il if l.startswith('- BAŞ MİMAR KARARI 19.11') and 'Ç7b TUR 2 — ARA RAPOR (YARIM)' in l[:200]]
assert len(K) == 1, len(K)
def r(eski, yeni):
    global m
    assert m.count(eski) == 1, eski[:80]
    m = m.replace(eski, yeni)
r("Sen DestekOfis projesinde Ç7b TUR 2 KOD ajanısın", "Sen DestekOfis projesinde Ç7b TUR 2b KOD ajanısın")
r("`git reset --hard c7b2-taban`", "`git reset --hard c7b2b-taban`")
r("(uç fc0d1999 'Ç7b: tasarım notu' olmalı — önceki Ç7b ajanının kapsayıcı yeniden başlayınca kesilen işinin TEK commit'i; değilse DUR)",
  "(uç b88d4402 'Kanıt: Ç7b tur 2' olmalı — tur 2 ajanının yedi commit'i; değilse DUR). ESKİ KOD (kırmızı kanıt) kopyası her yerde `c7b2-taban` (= fc0d1999, Ç7b kodundan önceki uç) — `c7b2b-taban` DEĞİL")
r("ÖNCEKİ TURUN ÖZETİ (ders 46): tabandaki `docs/erp/C7B-FATURA-TASARIM.md` — önceki ajan koddan önce yazdı;",
  "ÖNCEKİ TURLARIN ÖZETİ (ders 46): tur 2'nin ARA RAPORU `docs/devir/2.5.0-DEVAM/c7b2-rapor.md` (YARIM — ne yapıldı, ne kaldı, kırık komşular, not defteri klasörleri; OKU — ajanın sayıları kanıt değildir, kendin yeniden koş) ve tabandaki `docs/erp/C7B-FATURA-TASARIM.md` (§11 tur 2'nin değişen yerleri ve okuyucuları) —")
r("Önceki ajanın commit'siz kod / test değişiklikleri YOKTUR (kullanılmaz; ağacın temiz başlar).",
  "Tur 2'nin not defteri klasörleri (" + SP + "/c7b2/ altında: komsu.sh, kirik1.txt, kirik-yardimci.txt, komsu-utc1.out, surucu-once, olcum/olc-c7b2.mjs, s15/) OKUNUR; kendi klasörüne (`" + SP + "/c7b2b-<kısa>`) KOPYALA, oraya YAZMA (ders 25).\n\n## Tur 2b kararları (iş listesi D'den AYNEN)\n" + K[0] + "\n\n## Tur 2b — İŞİN TAMAMI (sırayla; her biri bitince commit)\n"
  "A. Tur 2'nin kırık komşuları: listeyi tur 2'nin kendi betiğiyle (kopyan) iki TZ koş; her kırığı karar numarasıyla düzelt (beklenti değişikliği gerekçesiyle, tek tek) ya da ÜRÜN HATASI olarak raporla (ders 6). Ç3'ün kural farkı açıklama kümelerine Ç7b kimlikleri. defter-kaynak-iz-250 B-7 ile.\n"
  "B. B-7 (kilit izine kalem alanları; sürüm artışı; var olan kilitlerde yanlış alarm YOK — eski sürüm verisiyle).\n"
  "C. B-6 (yukarıdaki karar; göç 51'de yalnız işaret; tutar değişmez) — KG-7 ile aynı göçte.\n"
  "D. KG-7 (aşağıdaki madde 9) + kılavuz (madde 10).\n"
  "E. Kabul koşulları A–G'nin TAMAMI (aşağıda), mutantlar, 'sonra' kâhin / sürücü koşuları (s17 için `git worktree add --detach` kopyası — ders 54).\n"
  "KAPSAM DIŞI bu turda: madde 7'nin Kartı Kapat 'Borçta Kalsın' kısmı ve S15 (→ Ç7b TUR 3); YB-1, .90, KG-2, KG-3, KG-24, KG-8 / F-08, S4 KODLANDI (yalnız komşu / kabul / mutant işi).\n\n## Görev metninin tur 1 / tur 2 için yazılmış asıl bölümleri (kalan maddeler için geçerli)")
r("8. **S15 = A ve S25 = A (Ç7b payı):**", "8. **YALNIZ S25 = A (S15 Ç7b TUR 3'e — tur 2 bulgusu: kodda YOK; bu turda KODLANMAZ):**")
r("`server/lib/integrity.mjs` (yalnız 191 / 391 / 336.90 denetimlerinin yeni maddeleri bilmesi — kilit izi ve sapma kümesi süzgecine DOKUNMA)",
  "`server/lib/integrity.mjs` (yalnız 191 / 391 / 336.90 denetimlerinin yeni maddeleri bilmesi + B-7'nin kilit izi eki — sapma kümesi süzgecine DOKUNMA)")
r("Yeni sütun gerekiyorsa GÖÇ NUMARASI 51 (ana oturum ayırdı; başka numara KULLANMA;",
  "Yeni sütun gerekiyorsa GÖÇ NUMARASI 51 (ana oturum ayırdı; B-6'nın mahsup kural sürümü işareti de AYNI göçte; başka numara KULLANMA;")
r("- KAPSAYICI YENİDEN BAŞLAYABİLİR",
  "- ÖLÇÜM KİLİDİ: ana oturumun hız kabul ölçümü `olcum.lock`'u ÖZEL tutabilir (saatlerce). Yük koşusunu (komşu yığını, mutasyon, e2e yığını, sürücü / kâhin koşusu) kilit doluysa tek seferlik `flock -s -w 3600 " + SP + "/olcum.lock -c '<komut>'` ile bekle (döngü YOK); beklerken yalnız okuma / kod / TEK test dosyası (sırayla, aynı anda bir tane) yap. 'Kilit dolu' diye kabul koşulunu ATLAYIP rapor verme.\n- KAPSAYICI YENİDEN BAŞLAYABİLİR")
open(sys.argv[1], 'w', encoding='utf-8').write(m)
print('yazıldı', sys.argv[1], len(m))
