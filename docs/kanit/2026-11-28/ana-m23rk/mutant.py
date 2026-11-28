# M2T3 mutasyon: tur 2'nin 12 mutantı AYNEN (metinleri docs/kanit/2026-11-28/m2t2-arac/mutant.py) + tur 3'ün yenileri. Her mutant /dev/shm/m2t3-ae39/mut kopyasında (HEAD) tek metin değişikliği;
# ilgili testler koşulur; dosya git checkout ile geri alınır (yalnız bu kopya). Değişmeyen kural: bir mutantın metni kodda tam BİR kez geçmeli, yoksa UYGULANAMADI (adet yazılır).
import subprocess, sys, json, os
M = "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m23rk/mut"
K = "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m23rk/kanit/mutant"
os.makedirs(K, exist_ok=True)
D = "server/lib/bank/doubtful.mjs"
I = "server/routes/invoices.mjs"
G = "server/lib/integrity.mjs"
TESTS = ["test/supheli-degersiz-hiz-m2t2-251.test.mjs", "test/supheli-degersiz-iptal-iade-m2t2-251.test.mjs", "test/supheli-degersiz-siniri-m2-251.test.mjs", "test/supheli-degersiz-m2t3-251.test.mjs"]
MUT = [
  # --- tur 2 (AYNEN) ---
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
  # --- tur 3 ---
  ("M10-eksi-kontrolu-yalniz-degersiz-kaynakli", D, "if (!(after < before && after < 0)) return;", "if (!(after < before && after < 0 && after + total >= 0)) return;"),
  ("M11-tutar-dusurme-denetimi-yok", I, ": INVOICE_KINDS[existing.kind]?.party === \"debt\" && decrease > 0.005", ": false && decrease > 0.005"),
  ("M12-duzenle-denetimi-tutar-dusmese-de", I, ": INVOICE_KINDS[existing.kind]?.party === \"debt\" && decrease > 0.005", ": INVOICE_KINDS[existing.kind]?.party === \"debt\""),
  ("M13-neden-cumlesi-hep-degersiz-yuzunden", D, "const why = after + total >= 0", "const why = true"),
  ("M14-bakiyeyi-dusurdu-kosulu-yok", D, "if (!(after < before && after < 0)) return;", "if (!(after < 0)) return;"),
  ("M15-duzenle-eylemi-iade-diye-anlatilir", I, "? writeOffBalanceGuard(store, existing.accountId, { action: \"edit\" })", "? writeOffBalanceGuard(store, existing.accountId, { action: \"return\" })"),
]
only = sys.argv[1:]
out = []
for name, path, a, b in MUT:
    if only and name not in only:
        continue
    full = os.path.join(M, path)
    s = open(full, encoding="utf-8").read()
    if s.count(a) != 1:
        out.append({"mutant": name, "sonuc": "UYGULANAMADI", "adet": s.count(a)}); print(json.dumps(out[-1], ensure_ascii=False), flush=True); continue
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
