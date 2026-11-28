"""M1 küçük tur 4 — D7 / M4 mutantlarının EŞDEĞERLİK yoklaması. Yeni kodda (S-M1K3-1 = A) zincirin her adımında taşınan devreden (carryAfterMinor) ayın gösterilen
'Sonraki Döneme Devreden KDV'sine (carryOutMinor) eşit olmalı (zincir dışı ay: step.carryOut; karma / güncel değil: settled.carryOutMinor; kept / reduced: settle fişin devredenini
döndürür). Ayrı kopyada vatView'a değişmez denetimi eklenir (eşit değilse hata fırlatır), mutant betiğinin test listesi koşulur. Yeşil = testlerin bütün verisinde değişmez tuttu →
D7 (aralığın son ayının görünümü) ve M4 (carryAfter) gözlenebilir davranışı değiştirmez. Kullanım: python3 -I esdegerlik.py <kopya kökü> <TZ>."""
import sys, os, subprocess
root, tz = sys.argv[1], sys.argv[2]
path = os.path.join(root, "server/routes/tax.mjs")
s = open(path, encoding="utf-8").read()
old = "        steps.set(month, { ...settled, carryAfterMinor: next });\n"
new = old + '        if (next !== settled.carryOutMinor) throw new Error(`ESDEGERLIK BOZULDU ${month}: carryAfter ${next} carryOut ${settled.carryOutMinor} ${settled.offsetState}`);\n'
if "ESDEGERLIK BOZULDU" not in s:
    assert s.count(old) == 1
    open(path, "w", encoding="utf-8").write(s.replace(old, new))
TESTS = ["test/kdv-ozeti-yalniz391-251.test.mjs", "test/kdv-ozeti-karma-251.test.mjs", "test/kdv-ozeti-mahsup-sonrasi-251.test.mjs", "test/kdv-ozeti-zincir-251.test.mjs", "test/kdv-ozeti-devreden-251.test.mjs", "test/defter-243-ux24-toplam.test.mjs", "test/c7b-kdv-ozeti-donem-250.test.mjs", "test/c7b-kdv-s4-250.test.mjs"]
env = dict(os.environ, HUKUK_LICENSE_URL="http://127.0.0.1:9", TZ=tz)
r = subprocess.run(["node", "--test", "--test-reporter=tap", *TESTS], cwd=root, env=env, capture_output=True, text=True, timeout=1500)
lines = r.stdout.splitlines()
count = lambda key: next((l.split()[-1] for l in lines if l.startswith(f"# {key} ")), "?")
print(f"{tz}: çıkış {r.returncode} · tests {count('tests')} · pass {count('pass')} · fail {count('fail')} · cancelled {count('cancelled')} · 'ESDEGERLIK BOZULDU' {r.stdout.count('ESDEGERLIK BOZULDU') + r.stderr.count('ESDEGERLIK BOZULDU')}")
