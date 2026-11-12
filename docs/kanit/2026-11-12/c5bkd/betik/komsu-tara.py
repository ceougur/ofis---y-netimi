"""Kabul C — komşu taraması (ders 10: tahminle değil test/ taramasıyla): değişen her ürün dosyasını (ve değişen test yardımcısını) ADIYLA anan bütün test/*.test.mjs.
Çalışma ağacının kökünden. Çıktı: <scratchpad>/c5bkd-kanit/komsu-liste.txt (her satır bir test dosyası) + özet."""
import glob, os, re, subprocess

S = "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad"
changed = subprocess.run(["git", "diff", "--name-only", "c5bkd-taban", "HEAD"], capture_output=True, text=True, check=True).stdout.split()
changed += [l[3:] for l in subprocess.run(["git", "status", "-s"], capture_output=True, text=True, check=True).stdout.splitlines() if not l.endswith("node_modules")]
product = sorted({f for f in changed if f.startswith(("server/", "client/")) or f in ("test/mutabakat/motor.mjs", "test/mutabakat/kos.mjs", "test/e2e/zil-oku.mjs")})
# Anma kalıpları: yolun son iki parçası (lib/accounts.mjs ↔ routes/accounts.mjs ayrışsın) ve yalnız adı tekil olan dosyalarda çıplak ad.
names = {}
for f in product:
    parts = f.split("/")
    pats = ["/".join(parts[-2:])]
    base = parts[-1]
    if sum(1 for g in product if g.endswith("/" + base)) == 1 and base not in ("accounts.mjs", "plans.mjs", "invoices.mjs", "stock.mjs", "http.mjs", "dues.mjs", "integrity.mjs", "kos.mjs"):
        pats.append(base)
    names[f] = pats
hits = {}
for t in sorted(glob.glob("test/*.test.mjs")):
    text = open(t, encoding="utf-8", errors="replace").read()
    for f, pats in names.items():
        if any(p in text for p in pats):
            hits.setdefault(t, []).append(f)
mine = [t for t in ("test/tyk-kapanis-250.test.mjs", "test/tyk-kapanis-sigma-250.test.mjs", "test/takvim-govde-250.test.mjs", "test/tyk-kapanis-dis-250.test.mjs") if os.path.exists(t)]
all_tests = sorted(set(hits) | set(mine))
open(f"{S}/c5bkd-kanit/komsu-liste.txt", "w", encoding="utf-8").write("\n".join(all_tests) + "\n")
print("değişen ürün / yardımcı dosyası:", len(product))
for f in product:
    print(f"  {f}: {sum(1 for t in hits if f in hits[t])} test anıyor")
print("komşu test dosyası:", len(all_tests))
