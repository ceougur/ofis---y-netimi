# ANA OTURUM — Ç6-HESAP TUR 3 görev metni üreteci (KISA, TEK İŞ: KABUL — hacim 100 bin / 1 M, eski sürüm sınıf testi (ders 53 b), iki şirket / yedek, mutantlar — + B-g (b) kilitli dönemin donmuş toplamlarının SQL ile okunması).
# Kararlar iş listesi D'den AYNEN (19.11 07:21 turlara bölme; 20.11 Ç6-HESAP TUR 2 raporu kararı). Çağrı: cd <depo>; python3 -I <bu> <çıktı> <taban dalı> <taban ucu> <gün YYYY-AA-GG>
import sys
SP = '/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad'
CIKTI, TABAN, UC, GUN = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
t = open('docs/2.5.0-IS-LISTESI.md', encoding='utf-8').read()
D = t[t.find('\n## D'):]
dent = D.split('\n- ')[1:]
on = open('docs/devir/2.5.0-DEVAM/c5a2-istem.txt', encoding='utf-8').read().split('\n')
pl = open('docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md', encoding='utf-8').read().split('\n')


def dkayit(onek, icerir=''):
    x = [e for e in dent if e.startswith(onek) and icerir in e[:160]]; assert len(x) == 1, (onek, len(x)); return x[0].strip()


def tek(lines, b):
    h = [l for l in lines if l.startswith(b)]; assert len(h) == 1, (b, len(h)); return h[0].strip()


D0721 = dkayit('BAŞ MİMAR KARARI 19.11 07:21')
DT2 = dkayit('BAŞ MİMAR KARARI 20.11', 'Ç6-HESAP TUR 2 — RAPOR')
P10 = tek(pl, '10. Hacim:')
P58 = tek(pl, '- Hacim: 1 M satırda')
cl = open('CLAUDE.md', encoding='utf-8').read().split('\n')
BIRAK = [l.strip() for l in cl if l.strip().startswith("2.5.1'E BIRAK")]; assert len(BIRAK) == 1
assert on[36].startswith('- G2 komşu') and on[37].startswith('- Koşular') and on[42].startswith('- PARA / DEFTER') and on[44].startswith("- İşleri ayrı") and on[47].startswith('- Commit iletisi'), 'c5a2 satırları kaydı'

o = []; w = o.append
w("Sen DestekOfis projesinde Ç6-HESAP TUR 3 KOD ajanısın (2.5.0 muhasebe çekirdeği; mali tabloların HESABI — ekran DEĞİL; eforun high). TEK İŞ: Ç6-HESAP'ın KABULÜ (hacim 100 bin / 1 M, eski sürüm sınıf testi — ders 53 (b), iki şirket / yedek, mutantlar son kodda) + B-g (b): kilitli dönemin donmuş toplamlarının SQL ile okunması (Bilanço'nun süresi için). Yanıtın Türkçe. PUSH YOK. Zamanlanmış görev KURMA. Her bitmiş adımı HEMEN commit et. Kendi arka plan işin sürerken rapor vermeden bitirme.")
w("")
w("## Hazırlık")
w(f"1. Worktree'de `git reset --hard {TABAN}` (sıfırlama, birleştirme DEĞİL); `git log --oneline -2` ucu {UC[:8]} göstermeli, değilse DUR. Taban = Ç6-HESAP tur 2'nin ucu (çalışma dalının kodu dahil). `ln -s /home/user/ofis---y-netimi/node_modules node_modules` (`npm ci` YOK). ESKİ KOD (kırmızı kanıt) = `{TABAN}`: `git -C /home/user/ofis---y-netimi archive <ref> ':!docs/kanit' | tar -x -C <klasör>` (+ node_modules bağı); eski sürüm ETİKETİ (v2.4.9) `git -C /home/user/ofis---y-netimi worktree add --detach <klasör> v2.4.9` (ders 54: `GIT_DIR` / `GIT_WORK_TREE` VERME; iş bitince `git worktree remove`). Not defteri `{SP}/c6h3-<kısa>` (ders 25). DİSK: başta ~8 GB boş, 5 GB'ın altına DÜŞMEZ — aynı anda en çok BİR eski kod kopyası ve BİR büyük veri kopyası; bitenleri TAM yoluyla sil.")
w("2. ÖNCE oku: `CLAUDE.md` dersleri (özellikle 6, 10, 13, 15, 17, 22, 23, 24, 25, 31, 38, 40, 43, 44, 47, 51, 52, 53, 54); `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md` §5; `docs/erp/C6-HESAP-TASARIM.md` (TAMAMI — §6, §8 hacim, §9 nasıl bozulur, §10 B-g); `docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md` §8, §9, §13; tur 2'nin raporu `docs/devir/2.5.0-DEVAM/c6h2-rapor.md` (hacim parça ayrıştırması) ve betikleri `docs/kanit/2026-11-20/c6h2-betik/` (kendi klasörüne kopyala). Kodda `server/lib/ledger-snapshots.mjs` (donmuş dönem) ve `server/routes/ledger.mjs` `book()`.")
w("3. BEKLENENLERİN KAYNAĞI (ders 5, 40): kullanıcı kararları + kural kitabı + plan + eski sürümün KENDİ okuduğu sayılar. Kâhin MODEL dosyaları (`test/bagimsiz/muhasebe/**`, `test/bagimsiz/defter/kahin.py`, `test/bagimsiz/cari/model.py`) OKUNMAZ; `test/bagimsiz/**` DEĞİŞTİRİLMEZ.")
w(f"4. BÜYÜK VERİ: temiz 100 bin `{SP}/ana-kabul/temiz-100k` (OKUNUR; kendi kopyanı al). 1 M satır: programın KENDİ yoluyla bir kez üret (örnek düzenek `{SP}/c3-yamalar/cekirdek-1m.sh`, `{SP}/ana-kabul/betik/`; kopyala, uyarla) — üretimi ≤ 40 dk parçalara böl, ürettiğin veriyi not defterinde tut, ölçüm bitince TAM yoluyla sil.")
w("")
w("## Kaynaklar (AYNEN)")
w("BAŞ MİMAR KARARI (Ç6-HESAP TURLARA BÖLÜNDÜ): " + D0721)
w("BAŞ MİMAR KARARI (TUR 2 RAPORU — bu turun B-g kararı ve kabul sırası): " + DT2)
w("PLAN §9 (kabul): " + P10)
w("PLAN §8 (hacim): " + P58)
w("")
w("## İş (sırayla; her biri bitince HEMEN commit)")
w("1. TASARIM NOTU (KISA; §8 ve §10): B-g (b)'nin tasarımı — kilitli dönemin donmuş toplamları hangi tablodan, hangi TEK toplu SQL ile (hesap / alt hesap / cari boyutu, Bilanço'nun brütleştirme boyutuyla aynı); kilitsiz dönem canlı türetmeyle nasıl birleşir; Gelir Tablosu ve Bilanço aynı okuyucuyu mu kullanır; 'nasıl bozulur' (kilit t'nin içinde / dışında, kilit açıldı → yeniden kilitlendi, kural değişikliği farkı olan kilitli yıl, iki şirket, yedek → geri yükleme, boş donmuş dönem).")
w("2. B-g (b) KOD: `server/lib/ledger-snapshots.mjs` içine YALNIZ yeni bir okuma işlevi (var olan işlevler DEĞİŞMEZ) + Ç6 dosyalarında kullanımı. DAVRANIŞ AYNEN (ders 47): EŞDEĞERLİK TESTİ — eski okuma ↔ yeni okuma çıktısı BİREBİR (küçük elle örnekler + temiz 100 bin; kilitli / kilitsiz t; iki şirket); aynı veri kopyasıyla ÖNCE / SONRA ölçüm (Bilanço ve Gelir Tablosu; kilitsiz + kilitli). Karşı mutantlar DEĞERLE: donmuş toplamı bir gün kaydır; kilitli dönemde canlıyı oku; bir alt hesabı / cari boyutunu atla; kural değişikliği farkını düşür.")
w("3. KABUL — HACİM (plan §8 / §9 madde 10; ders 47, 52, 53 (a)): 100 bin ve 1 M satırda Gelir Tablosu, Bilanço, dönem sonu stok değerlemesi — t = yıl sonu ve yıl içi; kilitli / kilitsiz; süre (en iyi + ortanca, ≥ 5 tekrar) + olay döngüsü en çok + bellek; ilk açılış ve önbellekten ayrı. Ölçüm `flock -x -w 3600 " + SP + "/olcum.lock -c '<komut>'` (tek seferlik bekleme); /proc/loadavg yazılır, yük > 2 ise GEÇERSİZ, yinele. Bütçe aşılırsa parça ayrıştırması (hangi adım kaç sn) — KOD DEĞİŞTİRME, rapora yaz.")
w("4. KABUL — ESKİ SÜRÜM SINIF TESTİ (ders 53 (b); KALICI test, `test/c6h-*`): v2.4.9'un GERÇEK koduyla üretilmiş veri (o sürümün API'siyle) → göç → 2.5.0'ın Gelir Tablosu / Bilanço / değerlemesi; SINIF LİSTESİ (her kayıt / kart türü: satış / alış faturası + iade, kasa / banka / POS, çek / senet, taksit kartı, elle borç / alacak, açılış, stok hareketi, şüpheli alacak, vergi ödemesi — × boş / eksik / tam × kilitli / kilitsiz); eski sürümün KENDİ okuduğu sayılar (cari bakiyeleri, kasa, banka, stok değeri, raporlarındaki kâr / zarar ya da toplamlar — karşılığı olan her biri) fikstür; her fark karar numarasıyla `test/fixtures/` altında 'beklenen farklar' dosyasında; yazılı olmayan fark = BULGU.")
w("5. KABUL — DURUM VE SIRA (ders 17, 31): iki şirket karışmaz; yedek → kayıt → geri yükleme sonrası tablolar yedekteki gibi; aynı gün kayıtlarının sırası sonucu değiştirmez; tur 1 + tur 2'nin mutant listesi SON kodda yeniden (iki TZ, birden çok koşu).")
w("6. BİTİŞ: yeni / değişen testler iki TZ; G2 komşu taramayla (değiştirdiğin dosyaları ve `ledger-snapshots` okuyucularını anan testler; şema / geri yükleme testleri komşu — ders 10); `npm run test:kahin-defter` ve `npm run test:kahin-cari` önce / sonra AYNI (değişen her sayı BULGU). Tam npm test YOK.")
w("KAPSAM DIŞI (DOKUNMA): ekranlar / PDF / Excel / rapor merkezi (Ç6-EKRAN); dönem sonu kapanış fişi (D4); Ç7b'nin dosyaları; B-g (c) (Mutabakat sonucunu son taramadan okumak — REDDEDİLDİ); KDV dönemi boyutlu iki uyarı (B-e — Ç6-EKRAN); tur 1 uç testinin açılış dondurmalı kurgusu (2.5.1); sürücü / kâhin eşlemesi (ayrı sürücü bakımı).")
w("")
w("## Kanıt")
w("- Her yeni test: `" + TABAN + "` kopyasında KIRMIZI ve nedeni iletide okunur (ders 38, 51) — 'işlev yok' kırmızısı tek başına diş sayılmaz, DİŞİ mutantlar verir; eşdeğerlik testinin dişi: eski okumayı bozan mutant. Yeni kodda yeşil; iki TZ; ay / yıl sonu ve 29 Şubat (ders 13, 22 — sahte saat). Beklenenler ELLE hesaplanmış örneklerden ya da eski sürümün KENDİ okuduğu sayılardan — programın yeni çıktısından türetilmez.")
w(on[36])
w(on[37].replace('c5a2-<ad>', 'c6h3-<ad>').replace('docs/kanit/<gün>/c5a2-*', 'docs/kanit/<gün>/c6h3-*'))
w("- ÖLÇÜM KİLİDİ: ana oturum ya da başka ajan `olcum.lock`'u ÖZEL tutabilir. Yük koşusu kilit doluysa tek seferlik `flock -s -w 3600 " + SP + "/olcum.lock -c '<komut>'` (döngü YOK); beklerken okuma / kod / TEK test dosyası. Kabul koşulunu 'kilit dolu' diye ATLAMA.")
w("")
w("## Kurallar — DOSYA SINIRI (Ç7b aynı anda türetme dosyalarına yazıyor)")
w("- Yazabileceğin: tur 1–2'nin Ç6 dosyaları (tasarım notunun §2 tablosu), `server/lib/ledger-snapshots.mjs` (YALNIZ yeni okuma işlevi, dosyanın sonuna), testler (`test/c6h-*`) + `test/fixtures/**` (yeni dosya), tasarım notu.")
w("- YAZILMAZ: `server/lib/general-ledger.mjs`, `server/routes/ledger.mjs`, öbür `server/lib/ledger-*.mjs`, `server/lib/integrity*.mjs`, `server/lib/migrations.mjs` (GÖÇ YOK), `server/routes/{invoices,tax,stock,report-center,plans,accounts}.mjs`, `server/app.mjs`, `client/**`, kılavuz, `.github/**`, package.json, tools/**, `test/bagimsiz/**`. Bunlardan birinde değişiklik gerekirse DUR, 'BAŞ MİMAR KARARI GEREKİYOR' diye raporla.")
w(on[42])
w("- KULLANICI KURALI (CLAUDE.md'den AYNEN): " + BIRAK[0] + " — bu turda programı ya da kullanıcıyı etkilemeyen ayrıntıyı (test düzeni, araç, ölçüm nüansı, doğrulanmamış kuşku) KOVALAMA; raporun 'SONRAKİ SÜRÜME (2.5.1)' başlığına yaz.")
for i in (44, 45, 46, 47, 48, 49): w(on[i])
w("- KAPSAYICI SIK YENİLENİYOR (20.11'de dört kez; ajanlar ve arka plan işleri kesilir, dosya sistemi kalır): koşuları ≤ 40 dk parçalara böl; her parçanın kanıtını HEMEN 'Kanıt:' commit'iyle yaz; rapor taslağını `docs/kanit/" + GUN + "/c6h3-rapor-taslak.md`'de adım adım tut — kesilirsen yeni ajan oradan sürdürür. Bağlamın daralırsa BİTMİŞ adımların commit'leriyle ARA RAPOR ver ve dur (ders 46). Uzun çıktıyı dosyaya yaz, yalnız sayıları oku.")
w("")
w("## Rapor (SubagentHandback, Türkçe)")
w("EN BAŞTA: değişen her gözlenebilir davranış (beklenen: YOK — B-g (b) yalnız hız; varsa önce → sonra, sayıyla); B-g (b) eşdeğerlik sonucu + önce / sonra hız tablosu (yol × kip × 100 bin / 1 M × en iyi + ortanca, olay döngüsü en çok, yük); bütçe aşan yolların parça ayrıştırması; eski sürüm sınıf tablosu (sınıf × v2.4.9'un sayısı × 2.5.0'ın sayısı × fark × karar numarası); iki şirket / yedek / sıra sonuçları; mutant tablosu (son kod, iki TZ); yeni testlerin kırmızı nedeni + yeşili; komşu / kâhin önce-sonra sayıları; ana oturumun yeniden koşacağı komutlar + beklenen sayılar; commit'ler; dal ucu; BAŞ MİMAR KARARI GEREKİYOR; SONRAKİ SÜRÜME (2.5.1); KULLANICIYA SORULMALI (iki seçenek + öneri; uç durumsa 'Uç durum böyle kalsın (BİLİNEN SINIR)'); DOĞRULANMADI; DENENMEYEN; not defteri klasörleri.")
open(CIKTI, 'w', encoding='utf-8').write('\n'.join(o) + '\n')
print('yazıldı', CIKTI, sum(len(x) + 1 for x in o))
