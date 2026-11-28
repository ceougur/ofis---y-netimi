# M2T6 mutasyon (docs/kanit/2026-11-28/m2t5-arac/mutant.py'den m2t6-arac/mutant-uret.py ile üretildi): tur 2–5 mutantları AYNEN (M27'nin metni tur 6'da değişti → M27p aynı anlamla
# yeni metinde) + tur 6'nın yenileri. Her mutant /dev/shm/m2t6-mut/mut kopyasında (tur 6 kodu); TZ ortamdan (MUT_TZ, varsayılan UTC); argüman verilirse yalnız o mutantlar.
# tek metin değişikliği; ilgili testler koşulur; dosya git checkout ile geri alınır (yalnız bu kopya). Kural: mutantın metni kodda tam BİR kez geçmeli, yoksa UYGULANAMADI (adet yazılır).
import subprocess, sys, json, os
M = "/dev/shm/m2t6-mut/mut"
TZV = os.environ.get("MUT_TZ", "UTC")
K = "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/m2t6-kanit/mutant-" + TZV.replace("/", "-")
os.makedirs(K, exist_ok=True)
D = "server/lib/bank/doubtful.mjs"
I = "server/routes/invoices.mjs"
G = "server/lib/integrity.mjs"
A = "server/routes/accounts.mjs"
P = "server/routes/plans.mjs"
TESTS = ["test/supheli-degersiz-hiz-m2t2-251.test.mjs", "test/supheli-degersiz-iptal-iade-m2t2-251.test.mjs", "test/supheli-degersiz-siniri-m2-251.test.mjs", "test/supheli-degersiz-m2t3-251.test.mjs", "test/supheli-degersiz-m2t4-251.test.mjs", "test/supheli-degersiz-m2t5-251.test.mjs", "test/supheli-degersiz-m2t6-251.test.mjs"]
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
  # --- tur 3 (AYNEN) ---
  ("M10-eksi-kontrolu-yalniz-degersiz-kaynakli", D, "if (!(after < before && after < 0)) return;", "if (!(after < before && after < 0 && after + total >= 0)) return;"),
  ("M11-tutar-dusurme-denetimi-yok", I, ": INVOICE_KINDS[existing.kind]?.party === \"debt\" && decrease > 0.005", ": false && decrease > 0.005"),
  ("M12-duzenle-denetimi-tutar-dusmese-de", I, ": INVOICE_KINDS[existing.kind]?.party === \"debt\" && decrease > 0.005", ": INVOICE_KINDS[existing.kind]?.party === \"debt\""),
  ("M13-neden-cumlesi-hep-degersiz-yuzunden", D, "const why = after + total >= 0", "const why = true"),
  ("M14-bakiyeyi-dusurdu-kosulu-yok", D, "if (!(after < before && after < 0)) return;", "if (!(after < 0)) return;"),
  ("M15-duzenle-eylemi-iade-diye-anlatilir", I, "? writeOffBalanceGuard(store, existing.accountId, { action: \"edit\" })", "? writeOffBalanceGuard(store, existing.accountId, { action: \"return\" })"),
  # --- tur 4 ---
  ("M16-t5-silinenler-taramasi-eski-hali", D, "    const at = store.get(WRITE_OFF_TRASH_SQL, wanted[0].party, wanted[0].since)?.at || \"\";", "    const at = store.get(\"SELECT MAX(deleted_at) AS at FROM trash WHERE kind = 'invoice' AND instr(payload_json, ?) > 0\", wanted[0].party)?.at || \"\";"),
  ("M16b-bakiye-kolu-silinenler-taramasi-eski-hali", D, "  if (has(\"trash\") && !WRITE_OFF_TEST.fullTrash && q(WRITE_OFF_ACTIVITY_TRASH_SQL, line.at, party)) return true;", "  if (has(\"trash\") && !WRITE_OFF_TEST.fullTrash && q(\"SELECT 1 AS found FROM trash WHERE (deleted_at >= ?1 OR COALESCE(restored_at, '') >= ?1) AND instr(payload_json, ?2) > 0 LIMIT 1\", line.at, party)) return true;"),
  ("M16c-t5-daraltma-en-son-satirdan", D, "    if (since !== null && line.at >= since) continue;", "    if (since !== null && line.at <= since) continue;"),
  ("M17-degismez-i-sonraki-degersizi-kuyruktan-okur", D, "      const later = WRITE_OFF_TEST.leakLater ? [] : own.slice(index + 1);", "      const later = [];"),
  ("M17b-cikarma-kisa-yolu-ayni-gunu-de-alir", D, "      if (day && day < drop.from) return linked(credit, view);", "      if (day && day <= drop.from) return linked(credit, view);"),
  ("M18-t5-borc-yaz-silme-denetimi-yok", A, "const writeOffGuard = WRITE_OFF_GUARDED.delete.has(previous.kind) ? writeOffBalanceGuard(store, account.id, { action: \"entry-delete\", kind: guardKindOf(previous) }) : null;", "const writeOffGuard = null;"),
  ("M18b-t5-borc-yaz-duzeltme-denetimi-yok", A, "const writeOffGuard = WRITE_OFF_GUARDED.edit.has(previous.kind) ? writeOffBalanceGuard(store, account.id, { action: \"entry-edit\", kind: guardKindOf(previous) }) : null;", "const writeOffGuard = null;"),
  ("M18c-taksit-karti-silme-denetimi-yok", P, "const writeOffGuard = plan.accountId ? writeOffBalanceGuard(store, plan.accountId, { action: \"plan-delete\" }) : null;", "const writeOffGuard = null;"),
  ("M18d-taksit-karti-duzenleme-denetimi-yok", P, "const writeOffGuard = moneyChange && previous.accountId ? writeOffBalanceGuard(store, previous.accountId, { action: \"plan-edit\" }) : null;", "const writeOffGuard = null;"),
  ("M19-ne-yapmali-eski-hali", D, "      const held = s155AfterWriteOffsRemoved(store, party, after + total);", "      const held = null;"),
  ("M19b-ne-yapmali-hep-kayit-yolu", D, "      const held = s155AfterWriteOffsRemoved(store, party, after + total);", "      const held = { openMinor: 0 };"),
  # --- tur 5 ---
  ("M20-odeme-silme-denetimi-yok", A, "delete: new Set([\"debt\", \"out\"])", "delete: new Set([\"debt\"])"),
  ("M21-alacak-artirma-denetimi-yok", A, "edit: new Set([\"debt\", \"out\", \"credit\"])", "edit: new Set([\"debt\", \"out\"])"),
  ("M21b-odeme-duzeltme-denetimi-yok", A, "edit: new Set([\"debt\", \"out\", \"credit\"])", "edit: new Set([\"debt\", \"credit\"])"),
  ("M22-otomatik-dagit-denetimi-yok", P, "writeOffGuard = plan.accountId ? writeOffBalanceGuard(store, plan.accountId, { action: \"plan-distribute\" }) : null;", "writeOffGuard = null;"),
  ("M22b-otomatik-dagit-denetlenmeden-yazar", P, "      writeOffGuard?.check();\n      audit(user, \"plan.distributed\"", "      audit(user, \"plan.distributed\""),
  ("M23-silinenler-taramasi-tur4-hali", D, "  const trashAt = writeOffTrashMax(store, prepared, has(\"trash\"));", "  const trashAt = new Map(prepared.map(item => [item.party, has(\"trash\") ? store.get(WRITE_OFF_TRASH_SQL, item.party, item.own[0].at)?.at || \"\" : \"\"]));"),
  ("M23b-gereken-satir-daraltmasi-yok", D, "  if (!unbondIds.size) return null;\n  let since = null;", "  if (true) return own[0].at;\n  let since = null;"),
  ("M23c-tek-gecis-cari-kosulu-yok", D, "if (row.at >= since && (!out.has(party) || row.at > out.get(party)) && body.includes(party)) out.set(party, row.at);", "if (row.at >= since && (!out.has(party) || row.at > out.get(party))) out.set(party, row.at);"),
  ("M24-ileti-sozcugu-borc-hareketi", D, "}[kind && kind !== \"debt\" ? `${action}:${kind}` : action]", "}[action]"),
  ("M25-kart-iadesi-silme-denetimi-yok", P, "const writeOffGuard = previous.kind === \"out\" && plan.accountId ? writeOffBalanceGuard(store, plan.accountId, { action: \"plan-entry-delete\" }) : null;", "const writeOffGuard = null;"),
  ("M25b-kart-iadesi-duzeltme-denetimi-yok", P, "const writeOffGuard = previous.kind === \"out\" && plan.accountId ? writeOffBalanceGuard(store, plan.accountId, { action: \"plan-entry-edit\" }) : null;", "const writeOffGuard = null;"),
  ("M27-alis-faturasi-artirma-denetimi-yok", I, ": existing.kind === \"purchase\" && decrease < -0.005", ": false && decrease < -0.005"),  # tur 6 metni değişti: UYGULANAMADI beklenir
  ("M27p-alis-faturasi-denetimi-yok", I, ": existing.kind === \"purchase\" && !(doc.account?.id && doc.account.id !== existing.accountId)", ": false"),
  ("M26-pos-iadesi-sozcugu-yok", A, "(previous.kind === \"out\" && posRefundOf(null, previous) ? \"pos-refund\" : previous.kind)", "(previous.kind)"),
  # --- tur 6 ---
  ("M28-alis-tutar-kosulu-geri-geldi", I, ": existing.kind === \"purchase\" && !(doc.account?.id && doc.account.id !== existing.accountId)", ": existing.kind === \"purchase\" && decrease < -0.005"),
  ("M29-alis-ileti-sozu-tutarin-artirilmasi", D, "op: \"alış faturasının düzenlenmesi\"", "op: \"alış faturasının tutarının artırılması\""),
  ("M30-alis-cari-degisiminde-de-denetim", I, ": existing.kind === \"purchase\" && !(doc.account?.id && doc.account.id !== existing.accountId)", ": existing.kind === \"purchase\""),
  ("M31-alis-yalniz-tutar-duserken", I, ": existing.kind === \"purchase\" && !(doc.account?.id && doc.account.id !== existing.accountId)", ": existing.kind === \"purchase\" && decrease > 0.005"),
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
        env = dict(os.environ, TZ=TZV, HUKUK_LICENSE_URL="http://127.0.0.1:9", M2T2_TOHUM="1,2,3,4")
        r = subprocess.run(["node", "--test", "--test-concurrency=2", *TESTS], cwd=M, env=env, capture_output=True, text=True, timeout=3000)
        log = r.stdout + r.stderr
        open(os.path.join(K, name + ".log"), "w", encoding="utf-8").write(log)
        fails = [l for l in log.splitlines() if l.startswith("# fail ")]
        nots = [l.strip() for l in log.splitlines() if l.strip().startswith("not ok")]
        out.append({"mutant": name, "cikis": r.returncode, "fail": fails[-1] if fails else "?", "kirilan": nots[:6], "sonuc": "YAKALANDI" if r.returncode != 0 else "YASADI"})
    finally:
        subprocess.run(["git", "checkout", "--", path], cwd=M, check=True)
    print(json.dumps(out[-1], ensure_ascii=False), flush=True)
open(os.path.join(K, "ozet.json"), "w", encoding="utf-8").write(json.dumps(out, ensure_ascii=False, indent=1))
