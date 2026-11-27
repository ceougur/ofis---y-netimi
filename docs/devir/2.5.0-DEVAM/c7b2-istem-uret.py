# ANA OTURUM — Ç7b TUR 2 görev metni üreteci: c7b-istem-uret.py'nin çıktısını alır, tur 2 kararlarıyla (iş listesi D, AYNEN) değiştirir.
# Çağrı: cd <depo>; python3 -I <bu> <çıktı>
import os, sys, subprocess
SP = '/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad'
gecici = SP + '/c7b2-taban-metin.txt'
subprocess.run([sys.executable, '-I', SP + '/c7b-istem-uret.py', gecici], check=True, env={**os.environ, 'TABAN': 'c7b2-taban'})
m = open(gecici, encoding='utf-8').read()
il = open('docs/2.5.0-IS-LISTESI.md', encoding='utf-8').read().split('\n')
K = [l.strip() for l in il if l.startswith('- BAŞ MİMAR KARARI 19.11') and 'Ç7b TASARIM NOTUNUN §9 SORULARI' in l[:200]]
assert len(K) == 1, len(K)
def r(eski, yeni):
    global m
    assert m.count(eski) == 1, eski[:80]
    m = m.replace(eski, yeni)
r("Sen DestekOfis projesinde Ç7b KOD ajanısın", "Sen DestekOfis projesinde Ç7b TUR 2 KOD ajanısın")
r("(uç 9c09f18d olmalı; değilse DUR)", "(uç fc0d1999 'Ç7b: tasarım notu' olmalı — önceki Ç7b ajanının kapsayıcı yeniden başlayınca kesilen işinin TEK commit'i; değilse DUR)")
r("## Kaynaklar (AYNEN)", "ÖNCEKİ TURUN ÖZETİ (ders 46): tabandaki `docs/erp/C7B-FATURA-TASARIM.md` — önceki ajan koddan önce yazdı; bugünkü maddelerin yeniden üretimi (§1), tasarım (§2), okuyucular (§3), nasıl bozulur (§4), §9 sorular. OKU; YENİDEN YAZMA — §9'a aşağıdaki kararları, kod sürerken değişen yerleri ekle. Önceki ajanın commit'siz kod / test değişiklikleri YOKTUR (kullanılmaz; ağacın temiz başlar).\n\n## Tur 2 kararları (iş listesi D'den AYNEN — tasarım notu §9'un yanıtı)\n" + K[0] + "\n\n## Kaynaklar (AYNEN)")
r("Önce tasarım notu `docs/erp/C7B-FATURA-TASARIM.md` (koddan ÖNCE commit):", "Tasarım notu `docs/erp/C7B-FATURA-TASARIM.md` tabanda VAR (önceki turun; içeriği aşağıdaki kalıbı izliyor — eksik kalan yeri koddan ÖNCE tamamla ve commit et):")
r("Gider türü alanı programda yoksa / eksik seçenekliyse DUR ve 'BAŞ MİMAR KARARI GEREKİYOR' (yeni alan bu işin kapsamında değil — varsayılan 770 kalır).", "Finansman (780) türü ve tanınmayan türün 770.90'a düşmesi B-1 = B ile 2.5.1'e — bu turda KODLANMAZ; uyan türler kalıcı testle gösterilir.")
r("7. **Karar (6) = A 'Borçta Kalsın' / KG-23 = A ve YB-1:**", "7. **YALNIZ YB-1 (karar (6) / KG-23 'Borçta Kalsın' B-4 ile Ç7b TUR 3'e — bu turda KODLANMAZ; journal'ın plan-close maddesi, account-lines, kuyruk DEĞİŞMEZ):** aşağıdaki metnin YB-1 kısmı geçerli; kalanı tur 3'ün —")
r("`server/routes/plans.mjs` + `client/assets/hof-plans.js` (YALNIZ Kartı Kapat — madde 7)", "`server/routes/plans.mjs` + `client/assets/hof-plans.js` (YALNIZ YB-1 — madde 7), `server/routes/ledger.mjs` (YALNIZ expected()'in 336 / 191 / 391 kalemleri — B-2 — ve rows().invoices'a kalem bazında istisna kodlu net tutar — B-3; Defter Mutabakatı'nın öbür kalemlerine ve kilit izine DOKUNMA), `server/routes/tax.mjs` (S4, KG-7)")
r("- SIRA ve ARA RAPOR:", "- KAPSAYICI YENİDEN BAŞLAYABİLİR (19.11'de iki kez oldu; ajan ve arka plan işleri kesilir, dosya sistemi kalır): her bitmiş adım (kod + testi) HEMEN commit'lenir; kanıt dosyalarını da adım adım commit'le; commit'siz iş kaybolur.\n- SIRA ve ARA RAPOR:")
open(sys.argv[1], 'w', encoding='utf-8').write(m)
print('yazıldı', sys.argv[1], len(m))
