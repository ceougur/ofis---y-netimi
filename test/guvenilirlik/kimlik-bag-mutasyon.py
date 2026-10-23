#!/usr/bin/env python3
# 31e B1–B3 + tur 7 (N1–N6) mutasyon koşucusu: her mutasyon program ağacının AYRI KOPYASINDA (ders 23) uygulanır; yeni testler (API + birim) koşulur.
# Kullanım: python3 -I test/guvenilirlik/kimlik-bag-mutasyon.py <kaynak ağaç (depo kökü)> <çıktı klasörü (depo dışında, geçici)>
import json, os, shutil, subprocess, sys

SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
B = "server/lib/dataset-bonds.mjs"
D = "server/lib/dataset.mjs"
W = "server/routes/workspace.mjs"
DOC = "server/routes/documents.mjs"
DC = "server/lib/insight/debt-column.mjs"
R = "server/lib/reports.mjs"
MUT = {
    "M1-tasima-kapali": [(D, "const result = moves.length ? report.bonds.move(moves, { user: actor, at: now() }) : { moved: {}, kept: {} };", "const result = { moved: {}, kept: {} };")],
    "M2-teklik-gevsek": [(B, "    if (people.stored.count(oldTab, anchor) === 1 && people.incoming.count(tab, anchor) === 1) [match] = people.incoming.only(tab, anchor);", "    if (true) [match] = people.incoming.only(tab, anchor);")],
    # tur 7 N3: aday 17'nin "aynı row_id'de aynı kişi" konum kuralı geri gelirse iki Ali yer değiştirip değişince bağ yanlış Ali'ye gider.
    "M3-konum-kurali-geri": [(B, "    const tab = tabFor(oldTab);\n    if (tab === null) continue;", "    const same = entries.find(entry => entry.id === row.rowId);\n    if (same && same.caseKey !== key && fresh(same) && samePerson(sig, people.incoming.sig(same)) && people.stored.count(oldTab, anchor) === people.incoming.count(people.tabOfEntry(same), anchor)) {\n      candidate.set(key, same);\n      continue;\n    }\n    const tab = tabFor(oldTab);\n    if (tab === null) continue;")],
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
    "M12-bayat-anahtar-kabul": [(D, "    if (key.startsWith(\"satir:\") && !hasRecord(key)) {", "    if (false) {")],
    "M13-esitlemede-kisiyle-esleme-yok": [(D, "resolveIncoming(rawEntries, storedRows, people, { byPerson: mode === \"sync\" })", "resolveIncoming(rawEntries, storedRows, people, { byPerson: false })")],
    "M14-onay-bayati-denetlenmez": [(D, "    if (confirmed && known && (unmatchedKeys.some(key => !known.unmatched.has(key)) || report.duplicates.length > known.duplicates)) {", "    if (false) {")],
    # ---- tur 7 ----
    "M15-N1-acik-kimlik-kisiyle-tasinir": [(B, "    if (!isPrint(key) && !isPrint(match.caseKey)) continue;\n", "")],
    "M16-N5-veriyi-kaldir-onaysiz": [(D, "    const logBonds = assertRemovalConfirmed(user, loadRows().rows.map(row => row.rowId), confirm, \"dataset-remove\");", "    const logBonds = null;")],
    "M17-N5-sheette-yok-onaysiz": [(D, "    const logBonds = action === \"remove\" ? assertRemovalConfirmed(user, ids.filter(id => missingIds.has(id)), confirm, \"missing-remove\") : null;", "    const logBonds = null;")],
    "M18-N5-sayfa-silme-onaysiz": [(D, "    const logBonds = withKey(target, () => assertRemovalConfirmed(", "    const logBonds = null && withKey(target, () => assertRemovalConfirmed(")],
    "M19-N5-sayfa-silme-ortak-anahtar-sayilir": [(D, ", global: true }));", ", global: false }));")],
    "M20-N5-listede-bag-yok": [(D, "bonds: Object.keys(bonds.get(row.caseKey) || {}).map(kind => BOND_NAMES[kind] || kind) }));", "bonds: [] }));")],
    "M21-N6-belge-bayat-kabul": [(DOC, "const key = dataset?.liveKey ? dataset.liveKey(caseKeyOf(params.key)) : caseKeyOf(params.key);", "const key = caseKeyOf(params.key);")],
    "M22-N6-gorev-bayat-kabul": [(W, "    const key = liveCaseKey(limited(body.caseKey || body.case_key, CASE_KEY_MAX, \"Dosya kimliği\"));", "    const key = limited(body.caseKey || body.case_key, CASE_KEY_MAX, \"Dosya kimliği\");")],
    "M23-N6-duzeltme-bayat-kabul": [(W, "    const key = liveCaseKey(caseKeyOf(body.caseKey || body.case_key, \"Dosya kimliği\"));", "    const key = caseKeyOf(body.caseKey || body.case_key, \"Dosya kimliği\");")],
    "M24-N4-tek-vergi-kolonu-duser": [(DC, "  const rest = nonTax.length || remaining ? nonTax : amountRest;", "  const rest = nonTax;")],
    "M26-N4-seyrek-kalan-raporda-yok": [(R, "  const plan = debtPlan(moneyColumns, { sparse: sparseDebtColumn(analyses.map(item => item.column), rows, undefined, { analyses }) });", "  const plan = debtPlan(moneyColumns);")],
    "M27-N2-bekleyen-esitleme-her-turda": [(D, "if (!manual && heldBefore?.contentHash && heldBefore.contentHash === contentHash)", "if (false)")],
    "M29-b3g-icerik-ikizi-yok": [(B, "      const news = common.length ? people.incoming.byContent(tab, common).get(value) || [] : [];\n      if (olds.length === 1 && news.length === 1) [match] = news;\n", "      const news = common.length ? people.incoming.byContent(tab, common).get(value) || [] : [];\n")],
    # ---- tur 8 ----
    "M30-Y1-rol-denetimi-yok": [(DC, " || NOT_AMOUNT_ROLES.has(roles.get(column))) return false;", ") return false;")],
    "M31-Y1-tutar-adayinda-kisi-ozniteligi": [(DC, "  .filter(column => column && !isNotAmountHeader(column) && !isPersonAttributeHeader(column) && !isBarePromiseHeader(column));", "  .filter(column => column && !isNotAmountHeader(column) && !isBarePromiseHeader(column));")],
    "M32-Y1-seyrek-baslik-yok": [(DC, "isPersonAttributeHeader(column) || IDENTIFIER_HEADER.test(folded) || NOT_AMOUNT_ROLES", "NOT_AMOUNT_ROLES")],
    "M33-Y1-kalem-tutari-kisi-ozniteligi": [("server/lib/insight/dues.mjs", ".map(item => item.column).filter(column => !isPersonAttributeHeader(column) && !isBarePromiseHeader(column));", ".map(item => item.column).filter(column => !isBarePromiseHeader(column));")],
    "M34-Z1-kalem-sinirsiz": [("server/lib/insight/dues.mjs", "return typeof left === \"number\" && left > 0 ? Math.min(value, left) : value;", "return value;")],
    "M42-Z1-kalem-tum-kalan": [("server/lib/insight/dues.mjs", "? Math.min(value, left) : value;", "? left : value;")],
    "M43-Z1-donem-birden-cok": [("server/lib/insight/dues.mjs", "const period = single && periods.length === 1 ? periods[0] : null;", "const period = single && periods.length >= 1 ? periods[0] : null;")],
    "M44-Z1-kalan-bos-borcsuz": [("server/lib/insight/dues.mjs", "? Math.min(value, left) : value;", "? Math.min(value, left) : state.debt;")],
    "M38-5b-acilis-kalem-tutarsiz": [("server/lib/insight/dues.mjs", "rowDebt(plan, column => parseAmount(cell(row, column)), { expected: !feeOnly });", "rowDebt(plan, column => parseAmount(cell(row, column)), { expected: false });")],
    "M41-5b-aylik-ucret-acilis": [("server/lib/insight/dues.mjs", "rowDebt(plan, column => parseAmount(cell(row, column)), { expected: !feeOnly });", "rowDebt(plan, column => parseAmount(cell(row, column)));")],
    "M39-Y3-takvim-notu-yok": [("server/routes/dues.mjs", "unresolved: computed.debtUnresolved || [] });", "unresolved: [] });")],
    "M40-Z3-bos-soz-sinirsiz": [("server/lib/insight/dues.mjs", "    entry.amountFallbackCap = entry.amountFallback && entry.amountFallback === period ? plan.remaining || \"\" : null;", "    entry.amountFallbackCap = null;")],
    "M35-Y3-not-yok": [(R, "      ...(!plan.unresolved && plan.grossUnresolved && debt.amount === null ? {", "      ...(false ? {")],
    "M36-Y3-seyrek-kalan-kalan-degil": [(DC, " || (sparse && !isNotAmountHeader(sparse) && REMAINING_DEBT_HEADER.test(header(sparse)) ? sparse : null);", " || null;")],
    "M37-Y2-kimlik-esleme-yok": [(B, "        if (match || !sig[field]) continue;", "        continue;")],
    # ---- tur 10 ----
    "M45-Z2-eksi-kalan-kalem": [("server/lib/insight/dues.mjs", "typeof debtAmount === \"number\" && debtAmount <= 0 && ", "debtAmount === 0 && ")],
    "M46-Z3-soz-tutari-sonra": [("server/lib/insight/dues.mjs", "    const promiseFirst = entry.promise && entry.installment === null ? promiseAmount : null;", "    const promiseFirst = null;")],
    "M47-Z3-bos-soz-onceki-kural-yok": [("server/lib/insight/dues.mjs", "        if (!(ownAmount > 0) && entry.amountFallback) ownAmount = capped(entry.amountFallbackFromDebt ? state.debt : parseAmount(cell(row, entry.amountFallback)), entry.amountFallbackCap);\n", "")],
    # ---- tur 11 ----
    "M48-Z4-soz-kalibi-genis": [(DC, "export const PROMISE_HEADER = /\\b(soz|sozu|taahhut\\w*|taahhud\\w*)\\b/;", "export const PROMISE_HEADER = /\\b(soz\\w*|taahhut\\w*|taahhud\\w*)\\b/;")],
    "M49-Z4-soz-tutari-tutar-sozcuksuz": [(DC, "  return PROMISE_HEADER.test(folded) && PROMISE_AMOUNT_WORD.test(folded);", "  return PROMISE_HEADER.test(folded);")],
    "M50-Z4-bos-soz-satir-borcu-yok": [("server/lib/insight/dues.mjs", "    entry.amountFallback = promiseFirst && base && base !== promiseFirst ? base : null;", "    entry.amountFallback = promiseFirst && period && period !== promiseFirst ? period : null;")],
    # ---- tur 12 ----
    "M51-Z5-taahhut-tam-sozcuk": [(DC, "export const PROMISE_HEADER = /\\b(soz|sozu|taahhut\\w*|taahhud\\w*)\\b/;", "export const PROMISE_HEADER = /\\b(soz|sozu|taahhut|taahhudu)\\b/;")],
    "M52-Z5-taahhud-oneki-yok": [(DC, "export const PROMISE_HEADER = /\\b(soz|sozu|taahhut\\w*|taahhud\\w*)\\b/;", "export const PROMISE_HEADER = /\\b(soz|sozu|taahhut\\w*)\\b/;")],
    "M53-Z5-strong-taahhud-yok": [("server/lib/insight/dues.mjs", "|taahhut\\w*|taahhud\\w*|vade\\w*|", "|taahhut\\w*|vade\\w*|")],
    "M54-Z6-miktar-yok": [(DC, "const PROMISE_AMOUNT_WORD = /\\b(tutar\\w*|miktar\\w*)\\b/;", "const PROMISE_AMOUNT_WORD = /\\btutar\\w*\\b/;")],
    "M55-Z6-soz-tutari-yalniz-para": [("server/lib/insight/dues.mjs", "const promiseAmount = analyses.filter(item => item.role === \"money\" || item.role === \"number\")", "const promiseAmount = analyses.filter(item => item.role === \"money\")")],
    "M56-Z5-donem-soz-sozcugu-dislar": [("server/lib/insight/dues.mjs", "AMOUNT_OWN.test(foldText(column)) && !isPromiseAmountHeader(column) && ", "AMOUNT_OWN.test(foldText(column)) && !PROMISE.test(foldText(column)) && ")],
    # ---- tur 13 ----
    "M57-T13-yardimci-ikiye": [("server/lib/insight/dues.mjs", "isPersonAttributeHeader, isPromiseAmountHeader, PROMISE_HEADER, rowDebt", "isPersonAttributeHeader, PROMISE_HEADER, rowDebt"), ("server/lib/insight/dues.mjs", "const PROMISE = PROMISE_HEADER;\n", "const PROMISE = PROMISE_HEADER;\nconst isPromiseAmountHeader = column => PROMISE.test(foldText(column)) && /\\btutar\\w*\\b/.test(foldText(column));\n")],
    "M58-T13-borc-eski-kalip": [(DC, "  const list = (candidates || []).filter(column => column && !isNotAmountHeader(column) && !isPromiseAmountHeader(column));", "  const list = (candidates || []).filter(column => column && !isNotAmountHeader(column) && !/\\b(soz|sozu|taahhut|taahhudu)\\b/.test(foldText(column)));")],
    "M59-T13-borc-soz-suzgeci-yok": [(DC, "  const list = (candidates || []).filter(column => column && !isNotAmountHeader(column) && !isPromiseAmountHeader(column));", "  const list = (candidates || []).filter(column => column && !isNotAmountHeader(column));")],
    # ---- tur 14 ----
    "M60-T14-yalin-soz-borc-adayi": [(DC, "!isPersonAttributeHeader(column) && !isBarePromiseHeader(column));", "!isPersonAttributeHeader(column));")],
    "M61-T14-yalin-soz-kalem-tutari": [("server/lib/insight/dues.mjs", ".filter(column => !isPersonAttributeHeader(column) && !isBarePromiseHeader(column));", ".filter(column => !isPersonAttributeHeader(column));")],
    "M62-T14-donem-sozcugu-yok": [(DC, "  return PROMISE_HEADER.test(folded) && !PROMISE_AMOUNT_WORD.test(folded) && !EXPECTED_AMOUNT_HEADER.test(folded);", "  return PROMISE_HEADER.test(folded) && !PROMISE_AMOUNT_WORD.test(folded);")],
    "M28-N2-elle-esitleme-de-atlar": [(D, "if (!manual && heldBefore?.contentHash && heldBefore.contentHash === contentHash)", "if (heldBefore?.contentHash && heldBefore.contentHash === contentHash)")],
}
TESTS = ["test/kayit-bag-31e.test.mjs", "test/kayit-bag-31e-birim.test.mjs", "test/tablo-borc-r31e.test.mjs", "test/tablo-borc-dosya-u2.test.mjs"]
SUPPORT = ["test/helpers.mjs", "test/banka-210-ortak.mjs", "test/guvenilirlik/surumler.mjs"]
# İsteğe bağlı: MUT_SEC=M27,M28 yalnız adı bu öneklerle başlayan mutasyonları koşar (düzeltmeden sonra dar yeniden koşu).
SEC = [x for x in os.environ.get("MUT_SEC", "").split(",") if x]
if SEC:
    MUT = {name: edits for name, edits in MUT.items() if any(name.startswith(f"{prefix}-") for prefix in SEC)}
summary = {}
for name, edits in MUT.items():
    root = os.path.join(OUT, name)
    shutil.rmtree(root, ignore_errors=True)
    os.makedirs(os.path.join(root, "test"))
    for item in ["server", "client"]:
        shutil.copytree(os.path.join(SRC, item), os.path.join(root, item))
    shutil.copy(os.path.join(SRC, "package.json"), root)
    for item in [*SUPPORT, *TESTS]:
        os.makedirs(os.path.dirname(os.path.join(root, item)), exist_ok=True)
        shutil.copy(os.path.join(SRC, item), os.path.join(root, item))
    shutil.copytree(os.path.join(SRC, "test", "fixtures"), os.path.join(root, "test", "fixtures"))
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
