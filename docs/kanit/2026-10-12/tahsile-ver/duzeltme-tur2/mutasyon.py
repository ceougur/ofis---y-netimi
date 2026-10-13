#!/usr/bin/env python3
# Tur 2 düzeltmelerinin mutasyon denemesi (KANIT KURALI 3): her mutasyon çalışma ağacının AYRI kopyasında (ders 23, 25) uygulanır, yeni test dosyası
# (test/banka-220-tahsile-ver-tur2.test.mjs) koşulur; yakalanan mutasyon = çıkış ≠ 0. Kullanım (worktree kökünden):
#   python3 docs/kanit/2026-10-12/tahsile-ver/duzeltme-tur2/mutasyon.py <worktree> <scratch klasörü> [M1,M2,…]
import json, os, shutil, subprocess, sys

W, S = sys.argv[1], sys.argv[2]
MUTATIONS = [
    ("M1 Alt Hesap Mizanı: taksit ters kaydı tahsilde dönse de 101.01", "server/lib/bank/collections.mjs",
     "${bank(`e.kind = 'out' AND ${returned(\"e.cheque_id\")}`)}", "'${CHEQUE_SUB.portfolio}'", "G1"),
    ("M2 Alt Hesap Mizanı: carisiz evrakın karşılıksızı yok", "server/lib/bank/collections.mjs",
     "WHERE f.status = 'bounced' AND f.bounced IS NOT NULL", "WHERE 0 AND f.status = 'bounced' AND f.bounced IS NOT NULL", "G1"),
    ("M3 Alt Hesap Mizanı: tahsille kapanan kayda ayrı kapanış (çift)", "server/lib/bank/collections.mjs",
     "      AND NOT (k.status = 'collected'", "      AND NOT (0 AND k.status = 'collected'", "G1"),
    ("M4 Yevmiye: taksit ters kaydı tahsilde dönse de 101.01", "server/lib/general-ledger.mjs",
     "row.note, control, row.bankReturned ? { account: \"101\", sub: CHEQUE_SUB.bank } : \"101\", row.amount);\n    } else post(id, row.date, \"Taksit iadesi\"",
     "row.note, control, \"101\", row.amount);\n    } else post(id, row.date, \"Taksit iadesi\"", "T11"),
    ("M5 Ters kayıt alış gününe yazılır", "server/routes/cheques.mjs",
     "id, row.plan_id, row.amount, effect.date,", "id, row.plan_id, row.amount, store.get(\"SELECT date FROM plan_entries WHERE id = ?\", effect.id).date,", "T11"),
    ("M6 Eylem adı prototip anahtarıyla eşleşir", "server/routes/cheques.mjs",
     "if (Object.hasOwn(BANK_ACTIONS, action)) {", "if (BANK_ACTIONS[action]) {", "proto"),
    ("M7 Onarım eski sürümde geri alınan kapanışı açmaz", "server/lib/bank/repair.mjs",
     "report.reopenedCollections = reopenLegacyClosures(store, { open, at, pending });", "report.reopenedCollections = [];", ""),
    ("M8 Onarım hesap uygunluğunu denetlemez", "server/lib/bank/repair.mjs",
     "if (problem) pending(\"h\", item.id,", "if (false) pending(\"h\", item.id,", ""),
    ("M9 Onarım veriliş gününü açılışa almaz", "server/lib/bank/repair.mjs",
     "const given = [item.issueDate, opened]", "const given = [item.issueDate]", ""),
    ("M10 Zil parmak izi ayarı ve hesap adını görmez", "server/lib/bank/collections.mjs",
     "  if (!banks.n) return own;", "  if (banks.n >= 0) return own;", "T13|B1"),
    ("M11 Hesap silmede karşılıksız denetimi yok", "server/lib/bank/accounts.mjs",
     "assertNoPendingCollections(store, row.id, \"silinemez\", { returned: true });", "assertNoPendingCollections(store, row.id, \"silinemez\");", "A22"),
    ("M12 Rapor tutarı evrakın bugünkü tutarı", "server/routes/report-center.mjs",
     "COALESCE(NULLIF((SELECT d.try_minor FROM fin_events d WHERE d.id = k.event_id), 0), CAST(ROUND(c.amount * 100) AS INTEGER)) / 100.0 AS amount",
     "c.amount", "T12"),
    ("M13 Pencere özeti tahsildekini Portföyde sayar", "server/routes/cheques.mjs",
     "    summary.in.open = { count: summary.in.open.count - deposited.count", "    if (0) summary.in.open = { count: summary.in.open.count - deposited.count", "ozet"),
    ("M14 Tahsil Edildi hesap uygunluğu denetimi yok", "server/lib/bank/collections.mjs",
     "      if (problem) throw new HttpError(problem.status,", "      if (0 && problem) throw new HttpError(problem.status,", ""),
    ("M15 Saklanan toplam yazımdan sonra yenilenmez", "server/lib/bank/collections.mjs",
     "  if (stamp && cache?.stamp !== stamp) SUB_TRIAL_CACHE.set(store, (cache = { stamp, values: new Map() }));",
     "  if (stamp && !cache) SUB_TRIAL_CACHE.set(store, (cache = { stamp, values: new Map() }));", "G1"),
]
ONLY = set(sys.argv[3].split(",")) if len(sys.argv) > 3 else None
results = []
os.makedirs(S, exist_ok=True)
for name, path, old, new, pattern in MUTATIONS:
    if ONLY and name.split()[0] not in ONLY:
        continue
    copy = os.path.join(S, "kopya")
    shutil.rmtree(copy, ignore_errors=True)
    shutil.copytree(W, copy, ignore=shutil.ignore_patterns(".git", "docs", "node_modules"))
    # Kopyada .git yok: eski sürüm etiketi (v2.1.0) çalışma ağacının deposundan çözülür (yalnız test düzeneği; ürün kodu değil).
    helper = os.path.join(copy, "test", "guvenilirlik", "surumler.mjs")
    h = open(helper, encoding="utf8").read()
    open(helper, "w", encoding="utf8").write(h.replace('["-C", REPO,', '["-C", process.env.SURUM_GIT || REPO,'))
    file = os.path.join(copy, path)
    text = open(file, encoding="utf8").read()
    if text.count(old) != 1:
        results.append({"mutasyon": name, "uygulandi": False, "bulunan": text.count(old)})
        continue
    open(file, "w", encoding="utf8").write(text.replace(old, new))
    cmd = ["node", "--disable-warning=ExperimentalWarning", "--test", "--test-concurrency=1"] + ([f"--test-name-pattern={pattern}"] if pattern else []) + ["test/banka-220-tahsile-ver-tur2.test.mjs"]
    run = subprocess.run(cmd, cwd=copy, capture_output=True, text=True, env={**os.environ, "SURUM_GIT": W}, timeout=1200)
    counts = {line.split()[1]: int(line.split()[2]) for line in run.stdout.splitlines() if line.startswith("# ") and len(line.split()) == 3 and line.split()[2].isdigit()}
    results.append({"mutasyon": name, "uygulandi": True, "cikis": run.returncode, "yakalandi": run.returncode != 0 and counts.get("fail", 0) > 0, **{k: counts.get(k) for k in ("tests", "pass", "fail")}})
    print(json.dumps(results[-1], ensure_ascii=False), flush=True)
shutil.rmtree(os.path.join(S, "kopya"), ignore_errors=True)
print(json.dumps({"toplam": len(results), "yakalanan": sum(1 for r in results if r.get("yakalandi")), "uygulanamayan": [r["mutasyon"] for r in results if not r["uygulandi"]]}, ensure_ascii=False))
sys.exit(0 if all(r.get("yakalandi") for r in results) else 1)
