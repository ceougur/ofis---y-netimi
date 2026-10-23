#!/usr/bin/env python3
# 31e B1–B3 mutasyon koşucusu: her mutasyon program ağacının AYRI KOPYASINDA (ders 23) uygulanır; yeni testler (API + birim) koşulur.
# Kullanım: python3 -I test/guvenilirlik/kimlik-bag-mutasyon.py <kaynak ağaç (depo kökü)> <çıktı klasörü (depo dışında, geçici)>
import json, os, shutil, subprocess, sys

SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
B = "server/lib/dataset-bonds.mjs"
D = "server/lib/dataset.mjs"
W = "server/routes/workspace.mjs"
MUT = {
    "M1-tasima-kapali": [(D, "const result = moves.length ? report.bonds.move(moves, { user: actor, at: now() }) : { moved: {}, kept: {} };", "const result = { moved: {}, kept: {} };")],
    "M2-teklik-gevsek": [(B, "if (tab === null || people.stored.count(oldTab, anchor) !== 1 || people.incoming.count(tab, anchor) !== 1) continue;", "if (tab === null) continue;")],
    "M3-rowid-korlemesine": [(B, "if (same && same.caseKey !== key && fresh(same) && samePerson(sig, people.incoming.sig(same)) && people.stored.count(oldTab, anchor) === people.incoming.count(people.tabOfEntry(same), anchor)) {", "if (same && same.caseKey !== key && fresh(same)) {")],
    "M4-onay-atlanir": [(D, "    if (!unmatchedKeys.length && !report.duplicates.length) return;", "    return;")],
    "M5-farkli-kisi-ezer": [(B, "    const keep = (!hasPerson(a) && !hasPerson(b)) || (samePerson(a, b) && people.stored.count(people.tabOfRow(row), anchor) === people.incoming.count(tab, anchor));", "    const keep = true;")],
    "M6-ayni-gorunen-yok": [(B, "  if (!added.length || !storedRows.length) return [];", "  return [];")],
    "M7-esitleme-beklemez": [(D, "if ((!entries.length && fromSheet.length) || structural || unmatchedBonds) {", "if ((!entries.length && fromSheet.length) || structural) {")],
    "M8-baska-sayfa-yok": [(B, "if (entry && targets.get(entry.caseKey) === 1 && !shared.has(key) && !shared.has(entry.caseKey))", "if (entry && targets.get(entry.caseKey) === 1)")],
    "M9-tek-hedef-yok": [(B, "if (entry && targets.get(entry.caseKey) === 1 && !shared.has(key) && !shared.has(entry.caseKey))", "if (entry && !shared.has(key) && !shared.has(entry.caseKey))")],
    "M10-islem-disinda": [
        (D, "      rebound = rebind(user, report, { kind: staged.kind, mode: effective });\n", ""),
        (D, "    stages.delete(staged.id);\n", "    rebound = rebind(user, report, { kind: staged.kind, mode: effective });\n    stages.delete(staged.id);\n"),
    ],
    "M11-isaretler-tasinmaz": [(B, "    const settled = rewrite(setting(\"dues.settled\"), rekeyDue);", "    const settled = 0;"), (B, "    const unflagged = rewrite(setting(\"dataset.unflagged\"), id => map.get(id) || null);", "    const unflagged = 0;")],
    "M12-bayat-anahtar-kabul": [(W, "    if (key.startsWith(\"satir:\") && dataset?.hasRecord && !dataset.hasRecord(key)) {", "    if (false) {")],
    "M13-esitlemede-kisiyle-esleme-yok": [(D, "resolveIncoming(rawEntries, storedRows, people, { byPerson: mode === \"sync\" })", "resolveIncoming(rawEntries, storedRows, people, { byPerson: false })")],
    "M14-onay-bayati-denetlenmez": [(D, "    if (confirmed && known && (unmatchedKeys.some(key => !known.unmatched.has(key)) || report.duplicates.length > known.duplicates)) {", "    if (false) {")],
}
TESTS = ["test/kayit-bag-31e.test.mjs", "test/kayit-bag-31e-birim.test.mjs"]
summary = {}
for name, edits in MUT.items():
    root = os.path.join(OUT, name)
    shutil.rmtree(root, ignore_errors=True)
    os.makedirs(os.path.join(root, "test"))
    for item in ["server", "client"]:
        shutil.copytree(os.path.join(SRC, item), os.path.join(root, item))
    shutil.copy(os.path.join(SRC, "package.json"), root)
    for item in ["test/helpers.mjs", *TESTS]:
        shutil.copy(os.path.join(SRC, item), os.path.join(root, item))
    ok = True
    for path, old, new in edits:
        target = os.path.join(root, path)
        text = open(target, encoding="utf-8").read()
        if text.count(old) != 1:
            ok = False
            summary[name] = {"hata": f"mutasyon uygulanamadı: {path} ({text.count(old)} eşleşme)"}
            break
        open(target, "w", encoding="utf-8").write(text.replace(old, new))
    if not ok:
        continue
    env = dict(os.environ, HUKUK_LICENSE_URL="http://127.0.0.1:9")
    run = subprocess.run(["node", "--disable-warning=ExperimentalWarning", "--test", *TESTS], cwd=root, env=env, capture_output=True, text=True, timeout=1200)
    log = run.stdout + run.stderr
    open(os.path.join(OUT, f"{name}.log"), "w", encoding="utf-8").write(log)
    counts = {k: int(line.split()[-1]) for line in log.splitlines() for k in ["tests", "pass", "fail", "cancelled"] if line.startswith(f"# {k} ")}
    failed = [line.strip()[7:110] for line in log.splitlines() if line.startswith("    not ok") or line.startswith("        not ok")]
    summary[name] = {"cikis": run.returncode, **counts, "yakaladi": counts.get("fail", 0) > 0, "kirmizi": failed[:8]}
    shutil.rmtree(root, ignore_errors=True)
    print(name, json.dumps(summary[name], ensure_ascii=False)[:300], flush=True)
json.dump(summary, open(os.path.join(OUT, "ozet.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
caught = sum(1 for item in summary.values() if item.get("yakaladi"))
print(f"YAKALANAN {caught}/{len(MUT)}")
# Kanıt aracının tanıdığı özet (yakalanan mutasyon = geçen kontrol).
print(f"{caught}/{len(MUT)} kontrol geçti")
sys.exit(0 if caught == len(MUT) else 1)
