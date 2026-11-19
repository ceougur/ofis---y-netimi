# ANA OTURUM — cari kâhini bakımı 21b (KISA, tek iş): bakım 21'in girdisinde KESİK verilen karar metinlerinin TAM hâli + S205 / S206.
# Bakım 21'in düzeltilmiş üretecini koşar (devam satırları artık okunuyor), çıktısına S205 / S206'yı AYNEN ekler, kısa görev metni yazar.
# Çağrı: cd <depo>; python3 -I <bu> <girdi çıktısı> <görev metni çıktısı> <taban dalı>
import sys, subprocess, re
G_OUT, I_OUT, TABAN = sys.argv[1], sys.argv[2], sys.argv[3]
SP = '/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad'
tmpg, tmpi = SP + '/kc21b-ara-kararlar.md', SP + '/kc21b-ara-istem.txt'
subprocess.run([sys.executable, '-I', 'docs/devir/2.5.0-DEVAM/kahin-cari21-uret.py', tmpg, tmpi, TABAN], check=True)
il = open('docs/2.5.0-IS-LISTESI.md', encoding='utf-8').read().split('\n')

def blok(basla):
    h = [i for i, l in enumerate(il) if l.startswith(basla)]; assert len(h) == 1, (basla, len(h))
    s = h[0]; e = s + 1
    while e < len(il) and il[e].startswith('  ') and not re.match(r'  (S\d+[ =(]|\(\d+\) )', il[e]): e += 1
    return ' '.join(x.strip() for x in il[s:e])

g = open(tmpg, encoding='utf-8').read().rstrip('\n').split('\n')
g[0] = "# Cari kâhini bakımı 21b — karar girdisi (ana oturum yazdı; TEK girdi kaynağın)"
g.insert(2, "NOT (ana oturum): bakım 21'in girdisinde beş karar metni ana oturumun üretecindeki bir hata yüzünden CÜMLE ORTASINDA KESİKTİ (05.11 'hepsi A' kararı, Borçta Kalsın, S15 sorusu, S25 sorusu, S25 = A kararının (c) kolu). Aşağıda hepsi TAM; C1–C5'in KAPSAM satırları aynı, yalnız C3'ün KAPSAM satırındaki 'kendi vadeleriyle' sözü kaldırıldı (kararın metni değil, baş mimarın sözüydü — S205). Yeni madde C6: bakım 21'in iki sorusunun yanıtı.")
g.insert(3, "")
txt = '\n'.join(g)
eski = "kapatılan kartın kalan kalemleri carinin borcunda (kendi vadeleriyle) kalır,"
assert txt.count(eski) == 1
txt = txt.replace(eski, "kapatılan kartın kalanı carinin borcunda kalır,")
txt += "\n\n## C6. Bakım 21'in soruları (S205 = A, S206 = A; KULLANICI KURALIYLA ÖNERİ UYGULANDI 19.11)\n"
txt += "SORU + KARAR S205 (AYNEN):\n" + blok('  S205 (') + "\n"
txt += "SORU + KARAR S206 (AYNEN):\n" + blok('  S206 (') + "\n"
txt += ("KAPSAM (baş mimar): S205 = A — Kartı Kapat'tan sonra kalan borcun TAMAMI kapatma gününün ertesi gününden gecikmiş (kalemlerin kendi vadesine bakılmaz). S206 = A — S15 kuralı "
        "Taksitler'den açılmış (Mevcut Borç) karta da uygulanır: karttaki faturanın iptalinde kart kapanır, kartın tahsilatı carinin bağsız alacağı (avans) olur. Dil Kartı Kapat'ı "
        "taşımıyorsa S205 yalnız yorum + 'SÜRÜCÜ İÇİN'; S206 dilde kurulabiliyorsa bakım 21'de SUS bırakılan C13.4 (11) alanında beklenen yazılır.\n")
open(G_OUT, 'w', encoding='utf-8').write(txt)

p = []; w = p.append
w("Sen DestekOfis projesinde CARİ KÂHİNİ BAKIMI 21b ajanısın (2.5.0 — cari kâhini `test/bagimsiz/cari/`; KISA, TEK İŞ). PROGRAMIN KODUNU GÖRMEZSİN (ders 5, 40). KENDİ dalında commit edersin; PUSH YAPMAZSIN. Yanıtın Türkçe. Eforun high. Her bitmiş adımı HEMEN commit et. Zamanlanmış görev KURMA.")
w("")
w(f"GİRDİ: `{SP}/kahin-cari21b-kararlar.md` (TAMAMINI oku; başındaki NOT ve OKUMA KURALI bağlayıcı). Bakım 21 (dalın ucundaki `test/bagimsiz/cari/KARARLAR.md` §32) bu girdinin KESİK hâliyle yapıldı.")
w("")
w("TEK İŞ: KARARLAR.md'ye '2.5.0 bakımı 21b' bölümü — (1) bakım 21'de kesik metin yüzünden DENENMEYEN / SUS bırakılan her alanı TAM metinle yeniden değerlendir (özellikle S25 (c): nakit / havale / POS ile şüpheliye aktarılmış faturaya bağlı tahsilat; Borçta Kalsın metninin kalanı; 05.11 kararının cari kâhinine dokunan maddeleri); (2) C6: S205 / S206. Önce YORUM (ayrı commit), sonra senaryo + elle beklenen (model değişmeden ÖNCE; eski modelde beklenen nedenle kırmızı — ders 7, 38; ayrı commit), sonra model (ayrı commit), mutant (her yeni kural için en az bir; değerle yakalanmalı). Dil bir alanı taşımıyorsa EKLEME — SUS + DENENMEYEN + 'SÜRÜCÜ İÇİN'.")
w("")
w(f"HAZIRLIK: worktree'de (kendi commit'in YOKKEN) `git reset --hard {TABAN}`; `git log --oneline -3 -- test/bagimsiz/cari` ile bakım 21'in (301c0e29) dalda olduğunu doğrula; değilse DUR. `ln -s /home/user/ofis---y-netimi/node_modules node_modules`. Önce oku: `CLAUDE.md` dersleri (5, 7, 38, 40, 43, 54); `docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md`; girdi; KARARLAR.md §32 ve ilgili bölümler. Bakım 21'in araçları `docs/kanit/2026-11-19/kahincari21-arac/` (uyarlayıp `kahincari21b-arac/` altına kopyala).")
w("YASAKLAR: `server/`, `client/`, `bulut/`, `packaging/`, `tools/` (kanit.mjs yalnız çalıştırılır), `docs/devir/**`, `docs/2.5.0-IS-LISTESI*.md` (her sürümü), `test/bagimsiz/cari/YAPIM-ASAMASI.json` ve `BILINEN.json`, `test/bagimsiz/muhasebe-surucu/`, `test/bagimsiz/cari` dışındaki `test/` OKUNMAZ; `kos.mjs` yalnız eşleme için okunur, DEĞİŞTİRİLMEZ; program KOŞULMAZ; başka ajanların kanıtları ve git geçmiş içeriği açılmaz.")
w(f"YÖNTEM: eski kopya `git archive HEAD test/bagimsiz/cari | tar -x -C {SP}/kahincari21b-<kısa>/` (değişiklikten ÖNCE); kanıt iki TZ (UTC, Europe/Istanbul) `KANIT_DIR=<not defterin> node tools/kanit.mjs kos kahincari21b-<ad> -- …` (oz-test, mutasyon taraması, G3 bakım 21 ↔ 21b — C1–C6 alanları dışında BEKLENMEYEN 0); mutasyon / geniş tarama `flock -s -w 3600 {SP}/olcum.lock` (tek seferlik); her arka plan koşusu `timeout -k 5 <sn>` (en çok 2 saat); önce `cat /proc/loadavg`, 4'ün üstündeyse tek seferlik bekle. `GIT_DIR` / `GIT_WORK_TREE` VERME. `pkill` / joker `rm` YOK. Commit'e yalnız kendi yolların. Kendi arka plan işin sürerken rapor vermeden BİTİRME. Kanıt `docs/kanit/2026-11-19/kahincari21b-*`.")
w("Commit iletisi sonunda tam olarak (model adı YOK):")
w("  Co-Authored-By: Claude <noreply@anthropic.com>")
w("  Claude-Session: https://claude.ai/code/session_01EhegDvmPQ9hx2ibfitm6og")
w("")
w("RAPOR (SubagentHandback, Türkçe): madde madde yorum; bakım 21'e göre değişen / yeni / SUS'tan çıkan anahtarlar; yeni elle senaryolar ve değerleri; SÜRÜCÜ İÇİN; mutantlar; test sayıları (iki TZ, çıkış kodları; eski modelde kırmızı + nedeni); G3; KULLANICIYA SORULMALI (iki seçenek + öneri; uç durumsa üçüncü 'Uç durum böyle kalsın (BİLİNEN SINIR)'); DENENMEYEN; yeniden koşu komutları; OKUNAN DOSYALARIN TAM LİSTESİ; dal ucu.")
open(I_OUT, 'w', encoding='utf-8').write('\n'.join(p) + '\n')
print(len(txt), len('\n'.join(p)))
