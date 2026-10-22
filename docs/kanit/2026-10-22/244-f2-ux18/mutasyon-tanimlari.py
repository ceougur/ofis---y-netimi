# 31a F2/F3/F6 mutasyonları: çalışma ağacının kopyasında tek değişiklik (tam bir kez), sonra kanit kos ile UX18 testi.
import shutil, subprocess, sys, json
S = "/tmp/claude-0/-home-user/456ebc12-8183-520e-989e-af270fef8a58/scratchpad/f2-ux18"
WT = "/home/user/wt/f2-ux18"
M = {
 "MA-karsiliksiz-cifti-cikmaz": ("server/lib/invoice-settle.mjs", "  if (reversals.size) {", "  if (false && reversals.size) {"),
 "MB-taksitli-faturada-da-cikar": ("server/lib/invoice-settle.mjs", '      if (byId.get(links.get(reversedId) || "")?.planId) continue;\n', ''),
 "MC-kapsam-zamansiz": ("server/lib/invoice-settle.mjs", "const known = sorted.filter(line => facts(line).born <= plan.at && !(netted.has(line.id) && facts(netted.get(line.id)).born <= plan.at));", "const known = ordered.filter(line => facts(line).born <= plan.at);"),
 "MD-karsiliksiz-faturaya-eklenir-eski": ("server/routes/invoices.mjs", "            if (from) reversals.set(effect.id, from);", "            if (from) links.set(effect.id, links.get(from));"),
 "MF-bagsiz-evrak-ters-cevrilmez": ("server/routes/invoices.mjs", '          if (["receive", "issue", "endorse"].includes(event.kind)) linked.set(', '          if (["receive", "issue", "endorse"].includes(event.kind) && link) linked.set('),
 "MG-taraf-denetimi-yok": ("server/lib/invoice-settle.mjs", "      if ((cents(bounce.debit) > 0) !== (cents(reversed.credit) > 0)) continue;\n", ""),
 "MH-tutar-denetimi-yok": ("server/lib/invoice-settle.mjs", "      if ((cents(bounce.debit) || cents(bounce.credit)) !== (cents(reversed.debit) || cents(reversed.credit))) continue;\n", ""),
 "ME-kendi-evrak-bagi-sessiz": ("server/routes/cheques.mjs", "      if (previous.invoiceId && given && text(body.invoiceId) !== previous.invoiceId) throw", "      if (false && previous.invoiceId && given && text(body.invoiceId) !== previous.invoiceId) throw"),
}
for name in sys.argv[1:] or list(M):
    rel, old, new = M[name]
    dst = f"{S}/f2-ux18-mut-{name}"
    shutil.rmtree(dst, ignore_errors=True)
    shutil.copytree(WT, dst, symlinks=True, ignore=shutil.ignore_patterns(".git", "docs"))
    p = f"{dst}/{rel}"
    s = open(p, encoding="utf-8").read()
    assert s.count(old) == 1, f"{name}: eski metin {s.count(old)} kez"
    open(p, "w", encoding="utf-8").write(s.replace(old, new))
    r = subprocess.run(["node", "tools/kanit.mjs", "kos", f"244-f2-ux18/mutasyon-{name}", "--", "node", "--test", f"{dst}/test/ux18-cek-fatura-244.test.mjs"], cwd=WT, capture_output=True, text=True, timeout=1500)
    out = r.stdout + r.stderr
    summary = [line for line in out.splitlines() if line.startswith("[kanit]")]
    fails = [line.strip()[:200] for line in out.splitlines() if line.strip().startswith("✖")][:4]
    print(json.dumps({"mutasyon": name, "cikis": r.returncode, "yakalandi": r.returncode != 0, "ozet": summary[-1][:220] if summary else "", "kirmizi": fails}, ensure_ascii=False), flush=True)
    shutil.rmtree(dst, ignore_errors=True)
