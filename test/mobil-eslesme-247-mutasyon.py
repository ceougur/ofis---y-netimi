# M2 güvenlik çekirdeği mutasyonları (2.4.7): yeni kodun AYRI KOPYASINDA (ders 23) bilerek hata → test/mobil-eslesme-247.test.mjs yakalamalı (ders 7).
# Koşum: KANIT_DIR=docs/kanit/<gün> node tools/kanit.mjs kos m2-247-mutasyon -- python3 -I test/mobil-eslesme-247-mutasyon.py
# Kopyalar geçici klasörde (M2_MUT_DIR ya da sistem geçici klasörü), benzersiz adla açılır ve koşudan sonra silinir (ders 25, 36).
import json, os, re, shutil, subprocess, sys, tempfile
WT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(os.environ.get('M2_MUT_DIR') or tempfile.mkdtemp(prefix='m2-247-mut-'), 'kopya')
MUTS = [
    ("MU1 sınır denetimi yok (eşleme)", 'server/lib/mobile-remote.mjs', 'if (used >= limit()) throw fail(409, "remote-limit");', ''),
    ("MU2 karekod süresi denetlenmez", 'server/lib/mobile-remote.mjs', 'if (!row || row.state !== "active" || t >= Date.parse(row.expires_at)) throw fail(400, "remote-code");', 'if (!row || row.state !== "active") throw fail(400, "remote-code");'),
    ("MU3 karekod tek kullanımlık değil", 'server/lib/mobile-remote.mjs', '''store.run("UPDATE mobile_codes SET state = 'used', used_at = ?, device_id = ? WHERE code_hash = ?", at, deviceId, row.code_hash);''', ''),
    ("MU4 silinen cihaz da geçer", 'server/lib/mobile-remote.mjs', 'WHERE d.id = ? AND d.revoked_at IS NULL AND u.deleted_at IS NULL",\n      id,', 'WHERE d.id = ? AND u.deleted_at IS NULL",\n      id,'),
    ("MU5 yol beyaz listesi çözülmeden (ham önek)", 'server/lib/mobile-remote.mjs', 'if (decoded.split("/").slice(1).some(segment => segment === "." || segment === "..")) return "dot-segment";', ''),
    ("MU6 oturum boşta süresi yok", 'server/lib/mobile-remote.mjs', 't - Date.parse(row.last_seen_at) >= MOBILE_RULES.idleMinutes * MINUTE || ', ''),
    ("MU7 oturum cihaza bağlı değil", 'server/lib/mobile-remote.mjs', 'if (!row || row.device_id !== device.id || row.user_id !== device.user_id) return null;', 'if (!row) return null;'),
    ("MU8 P6 yok (başka kullanıcı girer)", 'server/lib/mobile-remote.mjs', 'if (!user || user.id !== device.user_id) throw fail(403, "remote-device-user");', 'if (!user) throw fail(403, "remote-device-user");'),
    ("MU9 kilitliyken doğru parola geçer", 'server/lib/mobile-remote.mjs', '    if (entry?.lockedUntil) {', '    if (entry?.lockedUntil && false) {'),
    ("MU10 imza denetlenmez", 'server/lib/mobile-remote.mjs', 'if (!proofValid(device, body)) throw fail(401, "remote-proof");', ''),
    ("MU11 izin kalkınca cihaz düşmez", 'server/lib/mobile-remote.mjs', 'if (!remote) revoked = revokeUserDevices(user.id, "permission", admin);', ''),
    ("MU12 geri yükleme ortak katmanı mobil tabloları taşımaz", 'server/lib/company-backups.mjs', ', "mobile_access", "mobile_codes", "mobile_devices", "mobile_sessions"]', ']'),
    # 2.4.8 L1: kapı mobil kullanım hakkına göre (eşleme yazılabilir lisans) — satır değişti, mutasyon aynı anlamda.
    ("MU13 lisans denetlenmez", 'server/lib/mobile-remote.mjs', '      if (isPair ? !licenseOk() : !accessOk()) return reject(req, res, licenseFail());', ''),
    ("MU14 uzak istek yerel sayılır (clientIp)", 'server/lib/http.mjs', '  if (isRemoteRequest(req)) return "uzak";\n', ''),
    ("MU15 şirket denetimi mobil katmanda yok", 'server/app.mjs', '      if (viewer && !companies.canAccess(viewer, target.id)) return send(', '      if (false && viewer && !companies.canAccess(viewer, target.id)) return send('),
]
results = []
for i, (name, rel, old, new) in enumerate(MUTS, 1):
    d = f'{BASE}-{i}'
    shutil.rmtree(d, ignore_errors=True)
    os.makedirs(d)
    subprocess.run(f'cd {WT} && git ls-files -co --exclude-standard server client test tools package.json | tar -cf - -T - | tar -xf - -C {d}', shell=True, check=True)
    p = os.path.join(d, rel)
    s = open(p, encoding='utf-8').read()
    assert s.count(old) == 1, (name, s.count(old))
    open(p, 'w', encoding='utf-8').write(s.replace(old, new))
    r = subprocess.run(['node', '--disable-warning=ExperimentalWarning', '--test', f'{d}/test/mobil-eslesme-247.test.mjs'], capture_output=True, text=True, timeout=900)
    out = r.stdout + r.stderr
    def num(k):
        m = re.findall(rf'^# {k} (\d+)$', out, re.M)
        return int(m[-1]) if m else None
    fails = [l.strip() for l in out.splitlines() if l.strip().startswith('not ok') and 'subtest' not in l][:3]
    caught = r.returncode != 0 and (num('fail') or 0) > 0
    results.append({'mutasyon': name, 'cikis': r.returncode, 'tests': num('tests'), 'pass': num('pass'), 'fail': num('fail'), 'yakalandi': caught, 'ornek': fails})
    print(('YAKALANDI ' if caught else 'KAÇTI     ') + name, num('pass'), '/', num('tests'), flush=True)
    shutil.rmtree(d, ignore_errors=True)
caught = sum(1 for r in results if r['yakalandi'])
print(f'# mutasyon yakalanan {caught}/{len(results)}')
print(f'# tests {len(results)}\n# pass {caught}\n# fail {len(results) - caught}')
json.dump(results, open(f'{BASE}-sonuc.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
sys.exit(0 if caught == len(results) else 1)
