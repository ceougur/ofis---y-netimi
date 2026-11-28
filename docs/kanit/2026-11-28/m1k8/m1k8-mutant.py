# m1k8 mutasyon: /dev/shm/m1k8-kdv/mut kopyasında (ce0f5a26) tek tek hata enjekte → KDV birim testleri (TZ verilen) → geri yükle.
# Tur 6 + 7 dar kontrolünün mutantları (K1–K9) AYNEN — K5 / K6 küçük tur 8'de değişen satırlara uyarlandı (aynı hata) — + bu turun N1–N7'si.
# python3 -I mutant.py <TZ> [rastgele]
import subprocess, shutil, os, re, sys

N = "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m1k8/mut"
M = "/dev/shm/m1k8-kdv/mut"
L = "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/olcum.lock"
TZ = sys.argv[1]
RANDOM = len(sys.argv) > 2
ONLY = os.environ.get("ONLY", "")
TAX = f"{M}/server/routes/tax.mjs"
RC = f"{M}/server/routes/report-center.mjs"
ORIG = {TAX: f"{N}/tax.orijinal.mjs", RC: f"{N}/rc.orijinal.mjs"}
TESTS = [f"test/kdv-ozeti-{n}-251.test.mjs" for n in ["kayitsiz-ay", "uyusmazlik-yonu", "devreden-onarim", "karma", "s4-guncel-degil", "yalniz391", "devreden", "zincir", "mahsup-sonrasi"]]
if RANDOM:
    TESTS = ["test/kdv-ozeti-rastgele-251.test.mjs"]
MUT = [
    ("K1-absorbShort-hep-yok", TAX, "const absorbShort = Number(offset.carryInMinor) === carry && step.carried < offsetCarried;", "const absorbShort = false;"),
    ("K2-ilk-ay-uyusmayan-fis-sayilmaz", TAX, " || mismatches.some(other => other.month === item.month)", ""),
    ("K3-devreden-farki-onarim-ayi-bos", TAX, "carryGap ? firstStale : \"\"", "carryGap ? \"\" : \"\""),
    ("K4-kisa-not-etki-denetimi-yok", TAX, "return same ? [] : before;", "return before;"),
    ("K5-kisa-not-yalniz-ilk-ay", TAX, "[first, ...resultMonths.filter(month => month >= first && (!last || month <= last))]", "[first]"),
    ("K6-dondurulan-ay-bugunku-I", TAX, "const taken = absorb(month, Number(offset.inMinor));", "const taken = absorb(month, table.of(month).input);"),
    ("K7-kisa-not-karma-haric", TAX, "(steps.get(month).offsetState === \"stale\" || steps.get(month).offsetState === \"mixed\")", "steps.get(month).offsetState === \"stale\""),
    ("K8-eksi-yon-kendi-ayi-yok", TAX, "absorbShort ? firstStale || month :", "absorbShort ? firstStale :"),
    ("K9-onarim-en-gec-ay", RC, ".filter(Boolean).sort()[0];", ".filter(Boolean).sort().at(-1);"),
    ("N1-kayitsiz-ay-zincire-girmez", TAX, "if (!busySet.has(month) && step.carried >= 0) continue;", "if (!busySet.has(month)) continue;"),
    ("N2-azalis-ay-satiri-yok", RC, "if (item.reducedMinor > 0) rows.push(", "if (false) rows.push("),
    ("N3-azalis-ozet-satiri-yok", RC, "...(earlierMinor > 0 ? [[", "...(false ? [["),
    ("N4-azalis-notu-yok", RC, "...(reducedItems.length\n              ? [", "...(false\n              ? ["),
    ("N5-azalis-kaynagi-son-giren-once", TAX, "if (diff < 0) owed.push({ month, minor: -diff });", "if (diff < 0) owed.unshift({ month, minor: -diff });"),
    ("N6-ozet-satiri-aralik-ilk-ayi-dahil", RC, "(item.reducedParts || []).filter(part => part.month < firstMonth)", "(item.reducedParts || []).filter(part => part.month <= firstMonth)"),
    ("N7-hareketsiz-ay-devredeni-kayitli-aydan", TAX, "      for (const [key, item] of map) {\n        if (key >= month) break;\n        previous = item;\n      }", "      for (const [key, item] of map) {\n        if (key >= month) break;\n        if (busy.includes(key)) previous = item;\n      }"),
    ("N8-kayitsiz-ay-pending-sayilmaz", TAX, "return cutoff ? resultMonths.filter(month => month < cutoff && !mahsup.has(month)) : [];", "return cutoff ? busy.filter(month => month < cutoff && !mahsup.has(month)) : [];"),
]
if ONLY:
    MUT = [m for m in MUT if m[0] in ONLY.split(",")]
tag = TZ.replace("/", "_") + ("-rastgele" if RANDOM else "")
out = open(f"{N}/mutant-durum-{tag}.txt", "w", encoding="utf-8")
for name, path, old, new in MUT:
    src = open(ORIG[path], encoding="utf-8").read()
    if src.count(old) != 1:
        out.write(f"{name}: UYGULANAMADI (eşleşme {src.count(old)})\n"); out.flush(); continue
    open(path, "w", encoding="utf-8").write(src.replace(old, new))
    log = f"{N}/mut-{name}-{tag}.log"
    env = dict(os.environ, HUKUK_LICENSE_URL="http://127.0.0.1:9", TZ=TZ)
    with open(log, "w") as fh:
        code = subprocess.call(["flock", "-s", "-w", "3600", L, "timeout", "-k", "5", "2400", "node", "--test", "--test-concurrency=3", *TESTS], cwd=M, stdout=fh, stderr=subprocess.STDOUT, env=env)
    shutil.copyfile(ORIG[path], path)
    text = open(log, encoding="utf-8").read()
    nums = {k: re.search(rf"^# {k} (\d+)", text, re.M) for k in ["tests", "pass", "fail", "cancelled"]}
    nums = {k: (v.group(1) if v else "?") for k, v in nums.items()}
    out.write(f"{name}: çıkış {code} · {nums} · {'YAKALANDI' if nums['fail'] not in ('0', '?') else 'YAŞADI'}\n"); out.flush()
for p, o in ORIG.items():
    assert open(p, encoding="utf-8").read() == open(o, encoding="utf-8").read(), p
out.write("orijinal geri yüklendi (denetlendi)\n")
out.close()
