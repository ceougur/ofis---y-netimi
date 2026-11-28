# M2T2 mutasyon: her mutant /dev/shm/m2t2-a2da/mut kopyasında tek metin değişikliği; ilgili testler koşulur; dosya git checkout ile geri alınır (yalnız bu kopya).
import subprocess, sys, json, os
M = "/dev/shm/m2t2-a2da/mut"
K = "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m2t2/kanit/mutant"
os.makedirs(K, exist_ok=True)
D = "server/lib/bank/doubtful.mjs"
I = "server/routes/invoices.mjs"
G = "server/lib/integrity.mjs"
TESTS = ["test/supheli-degersiz-hiz-m2t2-251.test.mjs", "test/supheli-degersiz-iptal-iade-m2t2-251.test.mjs", "test/supheli-degersiz-siniri-m2-251.test.mjs"]
MUT = [
  ("M1-aday-gunler-geri", D, "if (WRITE_OFF_TEST.exact || sorted.length <= 2) return out(sorted.map(quoteOf));", "if (true) return out(sorted.map(quoteOf));"),
  ("M2-iade-denetimi-yok", I, "      writeOffGuard?.check();\n      return { id: invoiceId", "      return { id: invoiceId"),
  ("M2b-iade-duzenle-denetimi-yok", I, "      writeOffGuard?.check();\n      return written;", "      return written;"),
  ("M2c-iptal-denetimi-yok", I, "      writeOffGuard?.check();\n      if (dryRun) throw DRY_RUN;", "      if (dryRun) throw DRY_RUN;"),
  ("M3-degismez-i-fatura-iptali-kosulu-yok", D, "    if (lastUnbond) {", "    if (false) {"),
  ("M4-silme-iletisi-eski", D, "carinin bağsız tahsilatı Değersiz Alacak yazılan kayda düşer ve o kaydın ${label} Değersiz Alacak satırı, kayda düşen tahsilat çıkınca kalanı aşar (Değersiz Alacak bu kalanı aşamaz)", "${label} Değersiz Alacak satırı yazıldığı andaki sınırı aşardı"),
  ("M4b-kapi-iletisi-genel", G, "  if (writeOff) return writeOff;\n", ""),
  ("M5-sonra-gelen-degersiz-denemesi-yok", D, "const fits = quick && !targetAfter(ctx, date, at) ? () => true : minor => trial(minor).fits;", "const fits = quick ? () => true : minor => trial(minor).fits;"),
  ("M6-s155-ust-sinir-kesin-sayilir", D, "      if (passes(minor, upper) || !boundLater) return passes(minor, upper);", "      return passes(minor, upper);"),
  ("M7-budama-esitlik-kosulu-yok", D, "return cap < best.offerMinor || (cap === best.offerMinor && (best.limitMinor > cap || best.date < day));", "return cap <= best.offerMinor;"),
  ("M8-onceki-gun-kesiti-ayni-gunu-de-alir", D, "if (day && day < extra.entry.date) return linked(credit, view);", "if (day && day <= extra.entry.date) return linked(credit, view);"),
  ("M9-guard-degersizsiz-eksi-de-reddeder", D, "if (!(after < before && after < 0 && after + total >= 0)) return;", "if (!(after < before && after < 0)) return;"),
]
only = sys.argv[1:]
out = []
for name, path, a, b in MUT:
    if only and name not in only:
        continue
    full = os.path.join(M, path)
    s = open(full, encoding="utf-8").read()
    if s.count(a) != 1:
        out.append({"mutant": name, "sonuc": "UYGULANAMADI", "adet": s.count(a)}); continue
    open(full, "w", encoding="utf-8").write(s.replace(a, b))
    try:
        env = dict(os.environ, TZ="UTC", HUKUK_LICENSE_URL="http://127.0.0.1:9", M2T2_TOHUM="1,2,3,4")
        r = subprocess.run(["node", "--test", *TESTS], cwd=M, env=env, capture_output=True, text=True, timeout=3000)
        log = r.stdout + r.stderr
        open(os.path.join(K, name + ".log"), "w", encoding="utf-8").write(log)
        fails = [l for l in log.splitlines() if l.startswith("# fail ")]
        nots = [l.strip() for l in log.splitlines() if l.strip().startswith("not ok")]
        out.append({"mutant": name, "cikis": r.returncode, "fail": fails[-1] if fails else "?", "kirilan": nots[:6], "sonuc": "YAKALANDI" if r.returncode != 0 else "YASADI"})
    finally:
        subprocess.run(["git", "checkout", "--", path], cwd=M, check=True)
    print(json.dumps(out[-1], ensure_ascii=False), flush=True)
open(os.path.join(K, "ozet.json"), "w", encoding="utf-8").write(json.dumps(out, ensure_ascii=False, indent=1))
