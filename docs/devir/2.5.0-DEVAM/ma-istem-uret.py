# ANA OTURUM — MALİ MÜŞAVİR ARA KABULÜ (MA; temas noktası A, EKRANSIZ Bilanço / Gelir Tablosu) görev metni üreteci.
# Kaynak: docs/erp/MALI-MUSAVIR-AJANI.md §4 A; iş listesi D 21.11 21:35 (c) 'MA Bilanço / Gelir Tablosu'nu ekransız inceler', D 22.11 04:54 (BULGU-1 bilinen — 2.5.1), D 22.11 18:19.
# 'MA listesine' bırakılan maddeler iş listesinden AYNEN (C satırları tam; D kayıtlarından yalnız MA / mali müşavir geçen CÜMLELER — ajan raporu, KAYIT, sayı dökümü verilmez; ders 5).
# Çağrı: cd <depo>; python3 -I <bu> <çıktı -istem.txt> <incelenecek commit>
import re, sys
OUT, C = sys.argv[1], sys.argv[2]
SP = '/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad'
REPO = '/home/user/ofis---y-netimi'
t = open('docs/2.5.0-IS-LISTESI.md', encoding='utf-8').read()
il = t.split('\n')
D = t[t.find('\n## D'):t.find('\n## E')]
dent = D.split('\n- ')[1:]
def tek(basla):
    hit = [l for l in il if l.startswith(basla)]; assert len(hit) == 1, (basla, len(hit)); return hit[0].strip()
def dkayit(onek):
    x = [e for e in dent if e.startswith(onek)]; assert len(x) == 1, (onek, len(x)); return x[0].strip()
def cumleler(metin, desen):
    parca = re.split(r'(?<=\.)\s+(?=\(|[A-ZÇĞİÖŞÜ])', metin)
    return [p.strip() for p in parca if re.search(desen, p)]
MADDE = r"MA listesine|MA LİSTESİ|MA'da|\(MA\)|mali müşavir ara kabul|MA \(mali müşavir"
k = []
k.append("# MALİ MÜŞAVİR ARA KABULÜ (MA) — KARAR VE MADDE DOSYASI (iş listesinden AYNEN; ana oturum üretti)")
k.append("Soru satırlarında kural SEÇİLEN seçeneğin metnidir ('öneri X UYGULANDI' ya da 'KULLANICI'). 'KULLANICI KURALIYLA ÖNERİ UYGULANDI' = kullanıcının 14.11 06:31 kuralı (AYNEN: \"bana sorun varsa önerilerini uygula\") — kullanıcı değiştirebilir.")
k.append("## Kullanıcının Bilanço / Gelir Tablosu ve kapsam kararları (iş listesi D)")
k.append('- ' + dkayit('KULLANICI KARARI 21.11 21:35 UTC'))
k.append("## 'MA listesine' bırakılan sorular (iş listesi C — satırın tamamı)")
for n in (184, 203, 207, 215):
    k.append(tek(f'  S{n} ('))
k.append("## 'MA listesine' bırakılan baş mimar kararları (iş listesi D — YALNIZ ilgili cümleler)")
for e in dent:
    if re.search(MADDE, e) and e.startswith('BAŞ MİMAR') and not e.startswith(('BAŞ MİMAR KARARI 19.11 03:40', 'BAŞ MİMAR KARARI 11.11 16:50')):
        cs = cumleler(e, MADDE)
        if cs:
            k.append(f"- [{e[:e.find('(')].strip()}] " + ' … '.join(cs))
k.append("## BİLİNEN (bulgu YAZILMAZ; yalnız sayıyla doğrula ve 'bilinen' diye an)")
d0454 = dkayit('BAŞ MİMAR KARARI 22.11 04:54'); i0 = d0454.find('ORTA-1 (BULGU-1'); j0 = d0454.find('eski kodda da aynı)', i0); assert i0 > 0 and j0 > 0
k.append("- Gelir Tablosu BULGU-1 (D 22.11 04:54, AYNEN): " + d0454[i0:j0 + len('eski kodda da aynı)')] + " — 2.5.0'da düzeltilmez (ekran 2.5.1'de; düzeltme Ç6-EKRAN ile ZORUNLU).")
KOUT = OUT.replace('-istem.txt', '-kararlar.md'); assert KOUT != OUT
open(KOUT, 'w', encoding='utf-8').write('\n'.join(k) + '\n')
KYOL = KOUT if KOUT.startswith('/') else REPO + '/' + KOUT
p = []; w = p.append
w("Sen DestekOfis projesinin MALİ MÜŞAVİR ajanısın — temas noktası A (ARA KABUL), 2.5.0. Programın KAYNAK KODUNU GÖRMEZSİN. Yalnız denetler, kod değiştirmez, commit / push yapmazsın. Eforun high. Yanıtın Türkçe. Zamanlanmış görev KURMA.")
w("")
w("## Önce oku")
w("1. `docs/erp/MALI-MUSAVIR-AJANI.md` (tamamı — §2 bağımsızlık, §3 dayanak, §5 rapor biçimi harfiyen) ve `CLAUDE.md` (anayasa + dersler).")
w("2. Kural dayanağın: `docs/erp/MUHASEBELESTIRME-KURAL-KITABI.md` + `-EK-1.md` + `-EK-2.md` + `-EK-2B.md` (P temasında sen yazdın), `docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md`, `docs/erp/MUHASEBE-CEKIRDEGI-TALIMATI.md`, kullanım kılavuzu `docs/kilavuz/DestekOfis-Kullanim-Kilavuzu.html`.")
w(f"3. Bu görevin karar ve madde dosyası: `{KYOL}` — TAMAMINI oku.")
w("OKUMA (bağımsızlık, §2): `server/`, `client/` (client/assets dahil), `test/`, `tools/`, `bulut/`, `docs/kanit/`, git geçmişi / farkı, kâhin kodu (`test/bagimsiz`), `docs/devir/` altındaki rapor / görev metni / karar dosyaları (bu görevin karar dosyası HARİÇ), `docs/2.5.0-IS-LISTESI.md`, `docs/2.5.0-IS-LISTESI-KAYIT.md`, `docs/erp/*-TASARIM.md` (uygulama tasarım notları). Ana oturum araç kaydını denetler; dokunulursa tur GEÇERSİZ.")
w("")
w("## Hazırlık")
w(f"1. Worktree'de ÖNCE `git reset --hard {C}` (incelenecek çalışma dalı commit'i). `git log --oneline -1` ile doğrula. Kendi commit'in olmayacak.")
w(f"2. `ln -s {REPO}/node_modules node_modules` (`npm ci` YOK). Tarayıcı (Playwright): `PLAYWRIGHT_BROWSERS_PATH={SP}/pw-1194`.")
w(f"3. Not defteri: `{SP}/ma-<kısa>` (benzersiz). Programı kendi veri klasörünle aç (kullanıcının bilgisayarındaki gibi): `PORT=<boş port> HUKUK_DATA_DIR=<not defteri>/veri HUKUK_BACKUP_DIR=<not defteri>/yedek HUKUK_ADMIN_PASSWORD=<kendi parolan> HUKUK_LICENSE_URL=http://127.0.0.1:9 HUKUK_LOG_LEVEL=warn npm start` (worktree kökünde; arka planda, açık süre sınırıyla; giriş kullanıcısı `admin`). Program bugünün gerçek tarihiyle (22.11.2026) çalışır — sahte saat YOK: olayları 2026 içinde geçmiş tarihlerle gir; Dönem Kilidi'ni geçmiş bir ay sonuna koy. İş bitince yalnız KENDİ başlattığın süreci (pid) kapat, veri klasörünü TAM yoluyla sil.")
w("4. Gerçek GİB / EDM / Meta isteği YOK (e-Belge gönderme; 'Kaydet' / 'Kes, Sonra Gönder' kullan). Müşteri verisi yok. `pkill` / `killall` / joker `rm` YOK. Tam `npm test` YOK. Disk 5 GB'ın altına düşürülmez (`df -h /`).")
w(f"5. YÜK: koşuların `flock -s -w 3600 {SP}/olcum.lock timeout -k 5 <sn> <komut>` ile (ana oturumun ölçümü sürerken bekler); önce `cat /proc/loadavg` — 4'ün üstündeyse bekle. KAPSAYICI SIK YENİLENİYOR: işi ≤ 40 dk parçalara böl, her parçanın bulgusunu not defterindeki `rapor-taslak.md`'ye HEMEN yaz.")
w("")
w("## Kapsam (A — ARA KABUL; §4)")
w("Tek şirket, tek mali yıl (2026), kendi senaryon: kural kitabındaki olayların her sınıfından en az bir örnek (alış / satış / iade, vadeli satış + tahsilat, kasa / banka, POS, kredi kartı, çek / senet (portföy, tahsile ver, ciro, karşılıksız), taksit kartı (Mevcut Borç ve taksitli fatura), KDV mahsup + vergi ödemesi, stopaj, şüpheli alacak, stok alış / satış / iade / silinen kart, açılış bakiyeleri, Kural Farkı). Her adımda KENDİ elle hesapladığın beklenen yevmiye maddesi ↔ program.")
w("- EKRANDAN (kullanıcı gibi; insan hızı + klavye, ders 12): Hesap Planı, fiş defteri (Yevmiye), Büyük Defter, Mizan (ana hesap / alt hesap / cari), Defter Türü, Dönem Kilidi ve kilit sonrası donmuş okuma, KDV Özeti; varsa PDF / Excel çıktıları (ekran ↔ PDF ↔ Excel aynı sayı).")
w("- EKRANSIZ (2.5.0'da Bilanço / Gelir Tablosu ekranı YOK — kullanıcı kararı 21.11 21:35; programın kullanıcıya açık uçları KARA KUTU, oturum çereziyle): `GET /api/workspace/financial-statements/income-statement?from=YYYY-MM-DD&to=YYYY-MM-DD`, `GET /api/workspace/financial-statements/balance-sheet?date=YYYY-MM-DD`, `GET /api/workspace/financial-statements/stock-valuation?date=YYYY-MM-DD`. Biçimi (Tek Düzen sınıflama, ana / alt kalemler, dönem kârı = 690 / 692, aktif = pasif, kilitli / kilitsiz dönem, Kesin Değil nedenleri) Muhasebe Sistemi Uygulama Genel Tebliği tablolarına göre değerlendir; sayıyı kendi mizanından hesapla.")
w(f"- 'MA LİSTESİ' (karar dosyasında): her maddeyi ayrı başlıkla değerlendir — mevzuat / yaygın uygulama açısından doğru mu, kullanıcıya not gerekiyor mu, 2.5.1'e öneri. Gelir Tablosu BULGU-1 BİLİNEN (2.5.1'de ekranla düzeltilecek) — bulgu yazma, yalnız sayıyla doğrula.")
w("- DEVİR (D3–D6), yıl sonu kapanış / açılış fişi, Devir Raporu, Bilanço / Gelir Tablosu EKRANI, iki şirket, eski sürüm verisi bu temasta KAPSAM DIŞI (2.5.1 / S temas noktası). Ödeme Hatırlatma tutarları (Ç5-C) 2.5.1 — kapsam dışı.")
w("")
w("## Bulgu sınıfı")
w("CLAUDE.md '2.5.1'E BIRAK' kuralı geçerli: defteri, mali tabloyu, beyannameye giden sayıyı ya da kullanıcının gördüğünü YANLIŞ yapan her şey YÜKSEK / ORTA; biçim / adlandırma / sunum önerisi ve doğrulanamayan kuşku DÜŞÜK ya da GÖRÜŞ ('SONRAKİ SÜRÜME (2.5.1)' başlığına). Para / kapama / açılış / sınıflama KURALI gerektiren konu: 'KULLANICIYA SORULMALI' (iki seçenek + öneri; uç durumsa üçüncü seçenek 'Uç durum böyle kalsın (BİLİNEN SINIR)'); önce karar dosyasında aynı konu kararlaştırılmış mı bak.")
w("")
w("## Rapor (§5 biçimi; SubagentHandback ile)")
w("Sırayla: ÖZET (YÜKSEK / ORTA var mı); senaryonun olay listesi ve kendi beklenen mizanın (kısa tablo); her bulgu (sınıf, ekran / uç, adımlar, beklenen ↔ görülen sayı, dayanak + bağlantı + erişim tarihi, etkisi, en küçük öneri); MA LİSTESİ maddelerinin tek tek değerlendirmesi; KULLANICIYA SORULMALI; SONRAKİ SÜRÜME (2.5.1); DOĞRULANMADI; DENENMEYEN; not defteri klasörün (tam yol). Bulgu yoksa açıkça 'YÜKSEK / ORTA YOK'. Kendi arka plan işin sürerken turunu rapor vermeden BİTİRME.")
open(OUT, 'w', encoding='utf-8').write('\n'.join(p) + '\n')
print(len('\n'.join(p)), len('\n'.join(k)))
