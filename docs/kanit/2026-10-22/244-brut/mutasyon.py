# Netten Brüte mutasyon koşucusu (2.4.4 madde 26): kopyada (brut-mutasyon) bilerek hata enjekte eder, testi koşar, geri alır.
# Kullanım: python3 -I mutasyon.py <kopya> — <kopya> yeni kodun ayrı kopyası (git ls-files | tar; node_modules cp -al); dosyalar her mutasyondan sonra
# çalışma ağacından (WT) geri yüklenir; çalışma ağacına yazılmaz. Mutasyon "yakalandı" = test dosyası kırmızı (çıkış ≠ 0, fail > 0).
import subprocess, sys, shutil, re, os
M = sys.argv[1]
WT = "/home/user/wt/brut"
ROUTE = "server/routes/invoices.mjs"
MATH = "server/lib/invoice-math.mjs"
CLIENT = "client/assets/hof-invoices.js"
MUTS = [
  ("M1 varsayılan oranı geri koy (kutu boşsa her alıcıya ayar oranı)", ROUTE,
   "pricesIncludeVat: doc.pricesIncludeVat, discountRate: doc.discountRate, stoppageRate: doc.stoppageRate })",
   "pricesIncludeVat: doc.pricesIncludeVat, discountRate: doc.discountRate, stoppageRate: body.stoppageRate === undefined || body.stoppageRate === \"\" ? doc.settings.defaults.stoppageRate : doc.stoppageRate })"),
  ("M2 KDV'yi atla (KDV dahil fiyat yok sayılır)", ROUTE,
   "pricesIncludeVat: doc.pricesIncludeVat, discountRate: doc.discountRate, stoppageRate: doc.stoppageRate })",
   "pricesIncludeVat: false, discountRate: doc.discountRate, stoppageRate: doc.stoppageRate })"),
  ("M3 KDV kuruşu matrahtan seçilmez (en küçük fiyat)", MATH,
   "if (line.vat === mulDiv(line.net, line.vatRate, 100)) {", "if (true) {"),
  ("M4 öbür kalemler yok sayılır", ROUTE,
   "priceForNetFee(doc.lines, 0,", "priceForNetFee(doc.lines.slice(0, 1), 0,"),
  ("M5 kalem iskontosu yok sayılır", MATH,
   "(i === index ? { ...line, qty: 1, unitPrice: price / 100 } : line)", "(i === index ? { ...line, qty: 1, unitPrice: price / 100, discountRate: 0 } : line)"),
  ("M6 eski formül (brüt = net ÷ (1 − oran), doğru oranla)", ROUTE,
   "ok(res, { unitPrice: found.unitPrice,", "ok(res, { unitPrice: roundMoney(target / (1 - doc.stoppageRate / 100)),"),
  ("M7 genel iskonto yok sayılır", ROUTE,
   "pricesIncludeVat: doc.pricesIncludeVat, discountRate: doc.discountRate, stoppageRate: doc.stoppageRate })",
   "pricesIncludeVat: doc.pricesIncludeVat, discountRate: 0, stoppageRate: doc.stoppageRate })"),
]
def restore():
  for f in (ROUTE, MATH, CLIENT):
    shutil.copyfile(os.path.join(WT, f), os.path.join(M, f))
restore()
caught = 0
for name, f, old, new in MUTS:
  p = os.path.join(M, f)
  s = open(p, encoding="utf-8").read()
  assert s.count(old) == 1, (name, s.count(old))
  open(p, "w", encoding="utf-8").write(s.replace(old, new))
  r = subprocess.run(["node", "--disable-warning=ExperimentalWarning", "--test", "test/netten-brute-244.test.mjs"], cwd=M, capture_output=True, text=True, env={**os.environ, "HUKUK_LICENSE_URL": "http://127.0.0.1:9"})
  out = r.stdout + r.stderr
  tests = re.search(r"^# tests (\d+)", out, re.M); fail = re.search(r"^# fail (\d+)", out, re.M)
  failed_names = [l.strip()[:110] for l in out.splitlines() if l.lstrip().startswith("not ok")]
  ok = r.returncode != 0 and fail and int(fail.group(1)) > 0
  caught += bool(ok)
  print(f"{'YAKALANDI' if ok else 'YAKALANMADI'} · {name} · çıkış {r.returncode} · tests {tests and tests.group(1)} fail {fail and fail.group(1)}")
  for l in failed_names: print("     yakalayan test:", re.sub(r"^not ok \d+ - ", "", l))
  restore()
print(f"\n{caught}/{len(MUTS)} mutasyon yakalandı")
print(f"# tests {len(MUTS)}\n# pass {caught}\n# fail {len(MUTS) - caught}\n# cancelled 0\n# skipped 0\n# todo 0")
sys.exit(0 if caught == len(MUTS) else 1)
