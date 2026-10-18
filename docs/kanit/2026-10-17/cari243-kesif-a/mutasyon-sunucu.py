# Mutasyon koşucusu: her mutasyon kopyada uygulanır, cari-243.test.mjs koşulur, dosya geri yüklenir. Kopya: cari243-mut.
import subprocess, os, re
M = "/tmp/claude-0/-home-user/9cd0e60e-f0c5-5d7d-bc4f-899fff43162d/scratchpad/cari243-mut"
MUTS = [
  ("M1 geçmişe cari satırı girmez", "server/routes/workspace.mjs", "      ...accountEntries,\n", ""),
  ("M2 cari tahsilatı toplama girmez", "server/routes/workspace.mjs", "(totals.paid + planPaid + accountPaid)", "(totals.paid + planPaid)"),
  ("M3 ödeme işareti ters", "server/routes/workspace.mjs", "sum + (entry.kind === \"in\" ? entry.amount : -entry.amount), 0);\n    ok(res", "sum + entry.amount, 0);\n    ok(res"),
  ("M4 bağ kaynağı denetlenmez (bağsız cari de girer)", "server/routes/workspace.mjs", "WHERE deleted_at IS NULL AND case_key = ? AND case_source = ? ORDER BY created_at LIMIT 1\", key, dataset.currentKey())", "WHERE deleted_at IS NULL AND (case_key = ? OR name <> '') AND case_source <> ? ORDER BY created_at LIMIT 1\", key, '#')"),
  ("M5 rapor bağlı cariyi almaz", "server/routes/report-center.mjs", "JOIN accounts a ON a.id = e.account_id AND a.deleted_at IS NULL AND a.case_key <> ''", "JOIN accounts a ON a.id = e.account_id AND a.deleted_at IS NULL AND a.case_key = 'yok'"),
  ("M6 rapor bağsız cariyi de alır", "server/routes/report-center.mjs", "AND a.deleted_at IS NULL AND a.case_key <> ''", "AND a.deleted_at IS NULL"),
  ("M7 deleteBlock kartta boş", "server/routes/accounts.mjs", "deleteBlock: manage ? deleteBlock(account)?.message || \"\" : \"\",", "deleteBlock: \"\","),
  ("M8 TOPLAM satırı yok", "server/routes/accounts.mjs", "footer: account.ledger.length ?", "footer: false ?"),
  ("M9 TOPLAM alacak = borç", "server/routes/accounts.mjs", "tl(roundMoney(account.ledger.reduce((sum, line) => sum + line.credit, 0)))", "tl(roundMoney(account.ledger.reduce((sum, line) => sum + line.debit, 0)))"),
]
for name, rel, old, new in MUTS:
    p = os.path.join(M, rel)
    src = open(p, encoding="utf8").read()
    if src.count(old) != 1:
        print(name, "UYGULANAMADI", src.count(old)); continue
    open(p, "w", encoding="utf8").write(src.replace(old, new))
    r = subprocess.run(["node", "--disable-warning=ExperimentalWarning", "--test", "test/cari-243.test.mjs"], cwd=M, capture_output=True, text=True, env={**os.environ, "HUKUK_LICENSE_URL": "http://127.0.0.1:9"})
    open(p, "w", encoding="utf8").write(src)
    fail = re.search(r"^# fail (\d+)", r.stdout, re.M)
    print(f"{name}: çıkış {r.returncode}, kırmızı test {fail.group(1) if fail else '?'} -> {'YAKALANDI' if r.returncode != 0 else 'KAÇTI'}")
