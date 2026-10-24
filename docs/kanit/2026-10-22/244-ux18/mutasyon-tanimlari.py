# UX18 mutasyonları: taban kopyadan ayrı klasöre kopyala, tek değişikliği uygula (tam bir kez), sonra kanit kos ile UX18 testini koş.
import os, shutil, subprocess, sys, json
S = "/tmp/claude-0/-home-user/456ebc12-8183-520e-989e-af270fef8a58/scratchpad/ux18"
BASE = f"{S}/ux18-mut-taban"
WT = "/home/user/wt/ux18"
M = {
 "M1-bag-cheques-invoice-id": ("server/routes/cheques.mjs", "const result = insertCheque(user, input, { eventInvoiceId: bond });", "const result = insertCheque(user, input, { invoiceId: bond });"),
 "M2-karsiliksiz-acmaz": ("server/lib/invoice-settle.mjs", 'if (line.origin !== "cheque" || chequeEvents.get(line.id) !== "bounce") return "";', 'if (true) return "";'),
 "M3-yon-denetimi-yok": ("server/routes/accounts.mjs", "if (side !== kind) throw", "if (false && side !== kind) throw"),
 "M4-iptal-bag-temizlemez": ("server/routes/invoices.mjs", "        store.run(\"UPDATE cheque_events SET invoice_id = '' WHERE id = ?\", row.id);\n", ""),
 "M5-taksitli-red-yok": ("server/routes/accounts.mjs", "if (invoice.planId) throw", "if (false && invoice.planId) throw"),
 "M6-karsiliksiz-eksi-kapatan-gizler": ("server/routes/invoices.mjs", 'filter(item => !own.has(item.id) && item.mode !== "bounce")', 'filter(item => !own.has(item.id))'),
 "M13-taksitlendirmede-bagli-evrak-serbest": ("server/routes/invoices.mjs", "      if (bonded) throw new HttpError(409, `Bu faturaya Kapatılacak Fatura olarak bağlanmış", "      if (false && bonded) throw new HttpError(409, `Bu faturaya Kapatılacak Fatura olarak bağlanmış"),
 "M7-kapama-taksitli-suzgec-yok": ("server/routes/invoices.mjs", 'const link = event.invoiceId && (own || !planned.has(event.invoiceId)) ? event.invoiceId : "";', 'const link = event.invoiceId || "";'),
 "M8-karsiliksiz-taksitliyi-acar": ("server/lib/invoice-settle.mjs", 'invoice.status === "issued" && !invoice.planId && kinds.has(invoice.kind)', 'invoice.status === "issued" && kinds.has(invoice.kind)'),
 "M9-kapi-evrak-bagi-yok": ("server/lib/integrity-scope.mjs", "export const CHEQUE_BOND_BAD = `ev.invoice_id <> '' AND", "export const CHEQUE_BOND_BAD = `0 AND ev.invoice_id <> '' AND"),
 "M10-cari-degisince-sessiz-duser": ("server/routes/cheques.mjs", "const nextBond = asked && (asked !== bond || coreChange) ? invoiceBond(input, asked, { posted: isPosted(first) }) : asked;", "const nextBond = asked && (asked !== bond || coreChange) ? (() => { try { return invoiceBond(input, asked, { posted: isPosted(first) }); } catch { return \"\"; } })() : asked;"),
 "M11-geri-yuklemede-denetim-yok": ("server/routes/cheques.mjs", "      const bond = bondOf(raw, first);\n      if (bond) {", "      const bond = bondOf(raw, first);\n      if (false && bond) {"),
 "M12-iptal-faturaya-bag": ("server/routes/accounts.mjs", "if (invoice.status !== \"issued\") throw", "if (false && invoice.status !== \"issued\") throw"),
}
only = sys.argv[1:] or list(M)
for name in only:
    rel, old, new = M[name]
    dst = f"{S}/ux18-mut-{name}"
    shutil.rmtree(dst, ignore_errors=True)
    shutil.copytree(BASE, dst, symlinks=True)
    p = f"{dst}/{rel}"
    s = open(p, encoding="utf-8").read()
    assert s.count(old) == 1, f"{name}: eski metin {s.count(old)} kez"
    open(p, "w", encoding="utf-8").write(s.replace(old, new))
    r = subprocess.run(["node", "tools/kanit.mjs", "kos", f"244-ux18/mutasyon-{name}", "--", "node", "--test", f"{dst}/test/ux18-cek-fatura-244.test.mjs"], cwd=WT, capture_output=True, text=True, timeout=1200)
    summary = [line for line in r.stdout.splitlines() + r.stderr.splitlines() if line.startswith("[kanit]")]
    fails = [line.strip() for line in (r.stdout + r.stderr).splitlines() if line.strip().startswith("✖")][:6]
    print(json.dumps({"mutasyon": name, "cikis": r.returncode, "yakalandi": r.returncode != 0, "ozet": summary[-1] if summary else "", "kirmizi": fails}, ensure_ascii=False), flush=True)
    shutil.rmtree(dst, ignore_errors=True)
