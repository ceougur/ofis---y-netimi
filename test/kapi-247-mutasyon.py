# M3 kapıcı + şifreli özet güvenlik denetimleri mutasyonları (2.4.7): yeni kodun AYRI KOPYASINDA (ders 23, 25) bilerek hata → test/kapi-247.test.mjs,
# test/mobil-ozet-247.test.mjs ve bağımsız gözden geçirme düzeltmelerinin testleri (test/kapi-gg247-b1/b3/b4, kapi-tunel*) yakalamalı (ders 7).
# Koşum: node tools/kanit.mjs kos m3-247-mutasyon -- python3 -I test/kapi-247-mutasyon.py ; yalnız bir kısmı: M3_MUT_SEC='^MK(1[8-9]|[2-3][0-9])' (ada göre düzenli ifade).
# Kopyalar geçici klasörde (M3_MUT_DIR ya da sistem geçici klasörü), benzersiz adla açılır ve koşudan sonra silinir (ders 25, 36).
import json, os, re, shutil, subprocess, sys, tempfile
WT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(os.environ.get('M3_MUT_DIR') or tempfile.mkdtemp(prefix='m3-247-mut-'), 'kopya')
K = 'bulut/kapi/kapi.mjs'
KM = 'bulut/kapi/makine.mjs'
MUTS = [
    ("MK1 cihaz imzası denetlenmez (özet okuma)", K, '    if (!(await ecdsaDogrula(cihaz.anahtar, mesaj.cihaz(request.method, yol, id, ms), request.headers.get("x-do-imza") || ""))) at("kapi-imza");\n', ''),
    ("MK2 cihaz listesi denetlenmez (kimlik ne olursa ilk cihaz)", K, 'const cihaz = CIHAZ_KIMLIGI.test(id) ? (meta?.cihazlar || []).find(c => c.id === id) : null;', 'const cihaz = (meta?.cihazlar || [])[0];'),
    ("MK3 P9 yok (lisans bilgisi süresiz kabul)", K, 'if (!en || now() - en.issuedAt >= K.lisansTazeMs) return { durum: "dogrulanamadi", iddia: en };', 'if (!en) return { durum: "dogrulanamadi", iddia: en };'),
    ("MK4 lisans engeli ve bitişi görülmez", K, 'return { durum: lisansGecerli(en, now()) ? "gecerli" : "gecersiz", iddia: en };', 'return { durum: "gecerli", iddia: en };'),
    ("MK5 kapıcıda cihaz sınırı yok (K13)", K, '    else if (eklenen.length && temiz.length > sinir) cihazHatasi = "kapi-sinir";\n', ''),
    ("MK6 özet sırası denetlenmez (yeniden oynatma)", K, '    if (govde.sira <= oncekiSira) at("kapi-sira");\n', ''),
    ("MK7 kayıt zamanı denetlenmez (silinmiş cihaz geri gelir)", K, '    if (mevcut && ms <= mevcut.veri.sonKayit) at("kapi-sira");\n', ''),
    ("MK8 ofis anahtarı bağlanmaz (başka anahtar aynı kimliği alır)", K, '    if (mevcut && !ayniAnahtar(mevcut.veri.anahtar, yeniAnahtar)) at("kapi-ofis-anahtari");\n', ''),
    ("MK9 özetin iç imzası denetlenmez", K, '!(await ecdsaDogrula(meta.anahtar, zarf.govde, zarf.imza || ""))', 'false'),
    ("MK10 cihaz özete yazabilir", K, '    if (request.method !== "GET" && request.method !== "HEAD") at("kapi-yazma");\n', ''),
    ("MK11 canlı kapıda yol süzgeci yok", K, '    if (yolSorunu(yolSorgu)) at("kapi-yol");\n', ''),
    ("MK12 canlı kapıda cihaz denetimi yok", K, 'if (CIHAZ_KIMLIGI.test(id) && etkinCihazlar.some(c => c.id === id)) cihaz = id;', 'if (CIHAZ_KIMLIGI.test(id)) cihaz = id;'),
    ("MK13 özet ilk kullanıcının yetkisiyle (K23 ihlali)", 'server/lib/mobile-sync.mjs', '      const veri = await kullaniciOzeti(userId, uretim);', '      const veri = await kullaniciOzeti([...gruplar.keys()][0], uretim);'),
    ("MK14 güvenlik değişikliği hemen yüklenmez", 'server/lib/mobile-sync.mjs', 'pathname === "/api/mobil/eslesme") return "guvenlik";', 'pathname === "/api/mobil/eslesme") return "veri";'),
    ("MK15 programda kapıcı işareti denetlenmez", 'server/lib/mobile-sync.mjs', '      return !checked.ok || checked.cihaz !== cookieId;', '      return false;'),
    ("MK16 sarma bağlamı cihaza bağlı değil (telefonla uyumsuz)", 'server/lib/mobile-ozet.mjs', 'info: utf8(mesaj.sarmaBilgi(c.id)) }', 'info: utf8("sabit") }'),
    ("MK17 işaret yola bağlı değil", 'server/lib/mobile-ozet.mjs', 'update(mesaj.vekil(yontem, yolSorgu, cihaz, ms))', 'update(mesaj.vekil(yontem, "/", cihaz, ms))'),
    # Bağımsız gözden geçirme B3 (makine → ofis tek eşleme, hız sınırları)
    ("MK18 B3 canlı kapı/özet makine eşlemesine bakmaz (yalnız devre dışı işareti)", KM, '  if (m && m.ofis !== meta.ofis) {\n', '  if (false) {\n'),
    ("MK19 B3 yerini bırakmış ofisin kaydı makineyi geri alır (gidip gelme)", K, 'if (esleme && !onarim && mevcut.veri.makine === iddia.machine) {', 'if (false) {'),
    ("MK20 B3 tünel ucu güncel ofisi denetlemez", KM, '      if (m.ofis !== ofis) at("kapi-ofis-degisti");\n', ''),
    ("MK21 B3 kayıt sonrası bekleyen eski ofisler işlenmez (tünel/DNS silinmez)", KM, '  await bekleyenleriIsle(env, makine, { simdi, temizle });\n', ''),
    ("MK22 B3 makine başına günlük ofis değişimi sınırı yok", KM, '    if (degisim && degisimN >= KAPI_HIZ.ofisDegisimGunluk) at("kapi-hiz", { sinir: "ofis-degisim-gunluk" });\n', ''),
    ("MK23 B3 günlük yeni ofis tavanı yok", KM, '  if (n >= KAPI_HIZ.yeniOfisGunluk) at("kapi-hiz", { sinir: "yeni-ofis-gunluk" });\n', ''),
    ("MK24 B3 makine başına saatlik kayıt sınırı yok", KM, '    if (kayitN >= KAPI_HIZ.kayitSaatlik) at("kapi-hiz", { sinir: "kayit-saatlik" });\n', ''),
    ("MK25 B3 makine başına saatlik tünel sınırı yok", KM, '      if (n >= KAPI_HIZ.tunelSaatlik) at("kapi-hiz", { sinir: "tunel-saatlik" });\n', ''),
    # B1 (silinen cihazın tarayıcısı yeniden eşlenir)
    ("MK26 B1 eşleme/sayfa yolunda listede olmayan cihaz çerezi reddedilir (eski davranış)", K, 'if (!eslesme && !sayfa) at("kapi-cihaz", {}, sil.length ? { "set-cookie": sil } : {});', 'at("kapi-cihaz", {}, sil.length ? { "set-cookie": sil } : {});'),
    ("MK27 B1 silinmiş cihazın çerezi silinmez", K, '        if (!CIHAZ_KIMLIGI.test(id) || silinenler.includes(id) || meta?.devreDisi) sil = cerezSilSatirlari();\n', ''),
    ("MK28 B1 cihazsız sayılan istekte eski çerez programa iletilir", K, '      if (cihazsiz) {', '      if (false) {'),
    # B4 (alt alanlar arası çerez)
    ("MK29 B4 kökenin Domain'li Set-Cookie'si geçer", K, 'const kalan = cerezler.filter(satir => !setCookieAlanli(satir));', 'const kalan = cerezler;'),
    ("MK30 B4 kapıcı çakışan çerezi reddetmez", K, '    if (cerezCakisiyor(cerezBasligi)) at("kapi-cerez");\n', ''),
    ("MK31 B4 program çakışan çerezi reddetmez", 'server/lib/mobile-remote.mjs', '    if (cerezCakisiyor(req.headers.cookie)) return reject(req, res, fail(400, "remote-cookie"));\n', ''),
    ("MK32 B4 çerez adı öneksiz", 'server/lib/mobil-cerez.mjs', 'export const CIHAZ_CEREZI = "__Host-hof_device";', 'export const CIHAZ_CEREZI = "hof_device";'),
]
TESTS = ['test/kapi-247.test.mjs', 'test/mobil-ozet-247.test.mjs', 'test/kapi-gg247-b1.test.mjs', 'test/kapi-gg247-b3.test.mjs', 'test/kapi-gg247-b4.test.mjs', 'test/kapi-tunel-247.test.mjs', 'test/kapi-tunel-uctan-uca-247.test.mjs']
SEC = re.compile(os.environ.get('M3_MUT_SEC') or '.')
results = []
for i, (name, rel, old, new) in enumerate(MUTS, 1):
    if not SEC.search(name):
        continue
    d = f'{BASE}-{i}'
    shutil.rmtree(d, ignore_errors=True)
    os.makedirs(d)
    subprocess.run(f'cd {WT} && git ls-files -co --exclude-standard server client test tools bulut package.json | tar -cf - -T - | tar -xf - -C {d}', shell=True, check=True)
    p = os.path.join(d, rel)
    s = open(p, encoding='utf-8').read()
    assert s.count(old) == 1, (name, s.count(old))
    open(p, 'w', encoding='utf-8').write(s.replace(old, new))
    r = subprocess.run(['node', '--disable-warning=ExperimentalWarning', '--test', '--test-concurrency=1', *[f'{d}/{t}' for t in TESTS]], capture_output=True, text=True, timeout=1800)
    out = r.stdout + r.stderr
    def num(k):
        m = re.findall(rf'^# {k} (\d+)$', out, re.M)
        return int(m[-1]) if m else None
    fails = [l.strip() for l in out.splitlines() if re.match(r'^\s*not ok', l) and 'subtest' not in l][:3]
    caught = r.returncode != 0 and (num('fail') or 0) > 0
    results.append({'mutasyon': name, 'cikis': r.returncode, 'tests': num('tests'), 'pass': num('pass'), 'fail': num('fail'), 'yakalandi': caught, 'ornek': fails})
    print(('YAKALANDI ' if caught else 'KAÇTI     ') + name, num('pass'), '/', num('tests'), '·', ' | '.join(fails)[:300], flush=True)
    shutil.rmtree(d, ignore_errors=True)
caught = sum(1 for r in results if r['yakalandi'])
print(f'# mutasyon yakalanan {caught}/{len(results)}')
print(f'# tests {len(results)}\n# pass {caught}\n# fail {len(results) - caught}')
json.dump(results, open(f'{BASE}-sonuc.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
sys.exit(0 if caught == len(results) else 1)
