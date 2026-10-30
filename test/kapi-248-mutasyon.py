# 2.4.8 L1 (lisans kapısı), K1 (kapıcı temizlik yarışı) ve W7 (WhatsApp'ı Bağla) mutasyonları: yeni kodun AYRI KOPYASINDA (ders 23, 25) bilerek hata → testler
# yakalamalı (ders 7; KANIT KURALI 3). test/kapi-247-mutasyon.py düzeni; her mutasyonun kendi test listesi var (ağır tünel testi yalnız tünel mutasyonunda).
# Koşum: node tools/kanit.mjs kos 248-kapi-mutasyon -- python3 -I test/kapi-248-mutasyon.py ; bir kısmı: KAPI248_MUT_SEC='^ML' (ada göre düzenli ifade).
# Kopyalar geçici klasörde (KAPI248_MUT_DIR ya da sistem geçici klasörü), benzersiz adla açılır ve koşudan sonra silinir (ders 25, 36).
import json, os, re, shutil, subprocess, sys, tempfile
WT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(os.environ.get('KAPI248_MUT_DIR') or tempfile.mkdtemp(prefix='kapi-248-mut-'), 'kopya')
P = 'server/lib/kapi-protokol.mjs'
K = 'bulut/kapi/kapi.mjs'
T = 'bulut/kapi/temizlik.mjs'
L1 = ['test/kapi-lisans-hosgoru-248.test.mjs', 'test/mobil-lisans-hosgoru-248.test.mjs']
TUN = ['test/tunel-yonetici-247.test.mjs']
MUTS = [
    # L1 — kural (kapi-protokol; program ve kapıcı aynı işlev)
    ("ML1 hoşgörü denemeye de verilir", P, 'if (tur === "license" && t < bitis + MOBIL_HAK.hosgoruMs) {', 'if (t < bitis + MOBIL_HAK.hosgoruMs) {', L1),
    ("ML2 hoşgörü 30 değil 60 gün", P, 'hosgoruMs: 30 * GUN_MS,', 'hosgoruMs: 60 * GUN_MS,', L1),
    ("ML3 engellenen lisansa hoşgörü (engel görülmez)", P, '  if (iddia.status === "blocked") return { durum: "engelli", acik: false, tur, kalanGun: null, sonMs: null, uyari: false };\n', '', L1),
    ("ML4 uyarı 7 değil 6 gün kala", P, 'uyariGun: 7 });', 'uyariGun: 6 });', L1),
    # L1 — kapıcı
    ("ML5 hoşgörüde yeni cihaz eklenir", K, 'cihazHatasi = eklenen.length ? "kapi-lisans" : null;', 'cihazHatasi = null;', L1),
    ("ML6 silinmiş kayıt geri gelir (programın cihazları alınır)", K, 'meta.cihazlar = silindi ? [] : cihazHatasi', 'meta.cihazlar = cihazHatasi', L1),
    ("ML7 silinen ofisin kimliği başka anahtara açılır", K, '    if (mezar && !ayniAnahtar(mezar.anahtar, yeniAnahtar)) at("kapi-ofis-anahtari");\n', '', L1),
    # L1 — zamanlanmış temizlik
    ("ML8 silme yapılmaz", T, 'if (await ofisiSil(env, kayit, { neden: hak.durum, simdi, cloudflare, alan })) rapor.silinen.push(ofis);', 'void 0;', L1),
    ("ML9 başka (geçerli) ofis de silinir", T, 'if (!hak.acik && silmeAni !== null && simdi >= silmeAni) {', 'if (true) {', L1),
    ("ML10 taze olmayan (servise ulaşılamayan) belirteçle silinir", T, 'if (!gorunum || gorunum.durum === "dogrulanamadi" || !gorunum.iddia) continue;', 'if (!gorunum || !gorunum.iddia) continue;', L1),
    ("ML11 engelin ilk görülmesi her turda yenilenir (hiç silinmez)", T, 'const engel = iddia.status === "blocked" ? (meta.engel?.ms ? meta.engel : { ms: simdi }) : null;', 'const engel = iddia.status === "blocked" ? { ms: simdi } : null;', L1),
    ("ML12 yarışta (yeniden kayıt) silme bırakılmaz", T, '  if (!(await ayniMi(env, ofis, isaretli.etag))) {\n    await env.OZET.delete(mezarAnahtari(ofis));\n    return false;\n  }\n', '', L1),
    ("ML13 Cloudflare hatasında R2 önce silinir (sıra)", T, '  if (cloudflare) await ofisTuneliniSil(cloudflare, ofis, alan);\n  // Cloudflare', '  await env.OZET.delete(ozetAnahtari(ofis));\n  if (cloudflare) await ofisTuneliniSil(cloudflare, ofis, alan);\n  // Cloudflare', L1),
    # L1 — program
    ("ML14 program hoşgörüyü görmez (süresi dolmuş lisans kapalı)", 'server/lib/license.mjs', '  else if (s.state === "expired" && iddia) hak = mobilHakki(iddia, t);\n', '', L1),
    ("ML15 uzak dinleyici hoşgörüde kapanır", 'server/lib/mobile-remote.mjs', 'if (isPair ? !licenseOk() : !accessOk())', 'if (!licenseOk())', L1),
    ("ML16 program kapıcının 'silindi' bildirimini yok sayar", 'server/lib/mobile-sync.mjs', '    if (silindi) kapiKaydiSilindi(silindi);\n', '', L1),
    ("ML17 tünel hoşgörüde kapanır (yazılabilirlik)", 'server/lib/tunnel/manager.mjs', 'return Boolean(license?.status && mobileRightOf(license.status()).acik);', 'return Boolean(license?.status?.().writable);', TUN),
]
SEC = re.compile(os.environ.get('KAPI248_MUT_SEC') or '.')
results = []
for i, (name, rel, old, new, tests) in enumerate(MUTS, 1):
    if not SEC.search(name):
        continue
    d = f'{BASE}-{i}'
    shutil.rmtree(d, ignore_errors=True)
    os.makedirs(d)
    subprocess.run(f'cd {WT} && git ls-files -co --exclude-standard server client test tools bulut package.json | tar -cf - -T - | tar -xf - -C {d}', shell=True, check=True)
    os.symlink(os.path.join(WT, 'node_modules'), os.path.join(d, 'node_modules'))
    p = os.path.join(d, rel)
    s = open(p, encoding='utf-8').read()
    assert s.count(old) == 1, (name, s.count(old))
    open(p, 'w', encoding='utf-8').write(s.replace(old, new))
    env = {**os.environ, 'HUKUK_LICENSE_URL': 'http://127.0.0.1:9'}
    r = subprocess.run(['node', '--disable-warning=ExperimentalWarning', '--test', '--test-concurrency=1', *[f'{d}/{t}' for t in tests]], capture_output=True, text=True, timeout=1800, env=env, cwd=d)
    out = r.stdout + r.stderr
    def num(k):
        m = re.findall(rf'^# {k} (\d+)$', out, re.M)
        return int(m[-1]) if m else None
    fails = [l.strip() for l in out.splitlines() if re.match(r'^\s*not ok', l) and 'subtest' not in l][:3]
    caught = r.returncode != 0 and (num('fail') or 0) > 0
    results.append({'mutasyon': name, 'cikis': r.returncode, 'tests': num('tests'), 'pass': num('pass'), 'fail': num('fail'), 'yakalandi': caught, 'ornek': fails})
    print(('YAKALANDI ' if caught else 'KAÇTI     ') + name, num('pass'), '/', num('tests'), '·', ' | '.join(fails)[:300], flush=True)
    os.unlink(os.path.join(d, 'node_modules'))
    shutil.rmtree(d, ignore_errors=True)
caught = sum(1 for r in results if r['yakalandi'])
print(f'# mutasyon yakalanan {caught}/{len(results)}')
print(f'# tests {len(results)}\n# pass {caught}\n# fail {len(results) - caught}')
json.dump(results, open(f'{BASE}-sonuc.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
sys.exit(0 if caught == len(results) else 1)
