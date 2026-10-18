# Mutasyon koşucusu: her mutasyon ayrı kopyada (defter-243-mutasyon-<commit>) uygulanır, ilgili testler koşulur, dosya geri yüklenir.
import subprocess, sys, json, pathlib, re
M = pathlib.Path(sys.argv[1]); out = pathlib.Path(sys.argv[2])
MUT = [
 ("M1 stok açılışı karşı hesap 500→602", "server/lib/general-ledger.mjs", 'Açılış stoku${row.itemName ? `: ${row.itemName}` : ""}`, "153", "500"', 'Açılış stoku${row.itemName ? `: ${row.itemName}` : ""}`, "153", "602"', ["test/defter-243-stok-acilis.test.mjs"]),
 ("M2 stok açılışı değeri 0", "server/lib/general-ledger.mjs", "export const stockOpeningValue = row => roundMoney((Number(row.qty) || 0) * (Number(row.unitPrice) || 0));", "export const stockOpeningValue = row => roundMoney((Number(row.qty) || 0) * 0);", ["test/defter-243-stok-acilis.test.mjs"]),
 ("M3 göç işaretlemesi yok", "server/lib/migrations.mjs", "store.run(`UPDATE stock_moves SET is_opening = 1 WHERE kind = 'in'", "void (`UPDATE stock_moves SET is_opening = 1 WHERE kind = 'in'", ["test/goc-243-stok-acilis.test.mjs"]),
 ("M4 Kasa vergi ödemesi 360→770", "server/lib/general-ledger.mjs", '{ account: "360", debit: tax.taxMinor, credit: 0 },', '{ account: "770", debit: tax.taxMinor, credit: 0 },', ["test/defter-243-vergi.test.mjs"]),
 ("M5 beklenen 360 Kasa ödemesi işareti ters", "server/routes/ledger.mjs", "if (paid) out[360] = roundMoney((out[360] || 0) + paid / 100);\n    }\n    if (has(\"vat_offsets\")", "if (paid) out[360] = roundMoney((out[360] || 0) - paid / 100);\n    }\n    if (has(\"vat_offsets\")", ["test/defter-243-vergi.test.mjs"]),
 ("M6 mahsup devreden 190 tarafı ters", "server/lib/general-ledger.mjs", '{ account: "190", debit: carry, credit: 0 },', '{ account: "190", debit: 0, credit: carry },', ["test/defter-243-vergi.test.mjs"]),
 ("M7 mahsup önceki devreden kullanılmaz", "server/routes/tax.mjs", "const position = out - input - carry;", "const position = out - input;", ["test/defter-243-vergi.test.mjs"]),
 ("M8 Diğer Gider'e 360 açılır", "server/lib/bank/voucher.mjs", 'expense: ["653", "656", "659", "770", "780"],\n  tax:', 'expense: ["653", "656", "659", "770", "780", "360"],\n  tax:', ["test/defter-243-vergi.test.mjs"]),
 ("M8b yasak liste istisnası her role", "server/lib/bank/voucher.mjs", 'if (FORBIDDEN_GL.has(String(gl)) && !(role === "tax_payable" && String(gl) === "360")) return false;', 'if (FORBIDDEN_GL.has(String(gl)) && String(gl) !== "360") return false;', ["test/defter-243-vergi.test.mjs"]),
 ("M9 faturasız FIFO en eskiden", "server/lib/receivable-aging.mjs", "ORDER BY date DESC, created_at DESC, rowid DESC", "ORDER BY date ASC, created_at ASC, rowid ASC", ["test/defter-243-raporlar.test.mjs"]),
 ("M10 kaleme bağlanmamış tahsilat düşülmez", "server/lib/receivable-aging.mjs", "    if (rest < 0) {", "    if (rest < 0 && false) {", ["test/defter-243-raporlar.test.mjs"]),
 ("M11 banka nakit akışı verilen çek yok", "server/routes/report-center.mjs", 'else if (flow.direction === "out" && flow.bankAccountId && realBank.has(flow.bankAccountId))', 'else if (false && flow.direction === "out" && flow.bankAccountId && realBank.has(flow.bankAccountId))', ["test/defter-243-raporlar.test.mjs"]),
 ("M12 vergi aşım uyarısı yok", "server/routes/tax.mjs", "    if (taxMinor > room) {", "    if (false && taxMinor > room) {", ["test/defter-243-vergi.test.mjs"]),
 ("M13 mahsup aynı ay iki kez", "server/routes/tax.mjs", "if (active.some(item => item.month === month)) blocks.push(", "if (false) blocks.push(", ["test/defter-243-vergi.test.mjs"]),
 ("M14 kapı stock:opening hiç denetlemez", "server/lib/integrity.mjs", 'checks.push({ code: "stock:opening", name: "Açılış Stoku ↔ Ana Defter (B 153 / A 500)", ok: wrong.length === 0,', 'checks.push({ code: "stock:opening", name: "Açılış Stoku ↔ Ana Defter (B 153 / A 500)", ok: true,', ["test/defter-243-kapi.test.mjs"]),
 ("M15 kapı tax rolü tür denetimi yok", "server/lib/bank/checks.mjs", "if (!glAllowed(line.role, line.gl, head.type) || (ROLE_TYPES[line.role] && !ROLE_TYPES[line.role].has(head.type))) {", "if (!glAllowed(line.role, line.gl, \"tax_payment\")) {", ["test/defter-243-kapi.test.mjs"]),
]
only = set(sys.argv[3:])
results = []
for name, rel, old, new, tests in MUT:
    if only and name.split()[0] not in only: continue
    path = M / rel
    text = path.read_text(encoding="utf-8")
    if text.count(old) != 1:
        results.append({"mutasyon": name, "sonuc": f"UYGULANAMADI ({text.count(old)} eşleşme)"}); continue
    path.write_text(text.replace(old, new), encoding="utf-8")
    try:
        r = subprocess.run(["node", "--disable-warning=ExperimentalWarning", "--test", "--test-concurrency=1", *tests], cwd=M, capture_output=True, text=True, env={**__import__("os").environ, "HUKUK_LICENSE_URL": "http://127.0.0.1:9"}, timeout=1800)
        tail = r.stdout + r.stderr
        nums = {k: int(v) for k, v in re.findall(r"^# (tests|pass|fail|cancelled) (\d+)", tail, re.M)}
        results.append({"mutasyon": name, "dosya": rel, "testler": tests, "cikis": r.returncode, **nums, "yakalandi": r.returncode != 0 and nums.get("fail", 0) > 0})
    finally:
        path.write_text(text, encoding="utf-8")
    print(json.dumps(results[-1], ensure_ascii=False), flush=True)
out.write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8")
