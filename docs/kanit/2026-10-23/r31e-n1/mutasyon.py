# r31e N1 + Y8 mutasyon koşucusu: her mutasyon kopyadaki dosyaya uygulanır, ilgili test koşulur; testin KIRMIZI olması (çıkış ≠ 0 ve fail > 0) = yakalandı.
import subprocess, sys, pathlib, re
root = pathlib.Path(sys.argv[1])
INV = "server/routes/invoices.mjs"; MIG = "server/lib/migrations.mjs"; NF = "server/lib/number-floor.mjs"
N1 = ["test/numara-silinen-tarih-244.test.mjs"]; Y8 = ["test/ux18-cek-fatura-244.test.mjs"]
def sub(text, old, new):
    assert text.count(old) == 1, (old[:70], text.count(old))
    return text.replace(old, new)
ORDER = '''    const order = row.status === "draft" ? null : restoreOrderProblem(row);
    if (order) throw new HttpError(409, order.text, { code: "invoice-restore-chronology", number: row.number, otherNumber: order.other.number });
'''
LOCK = '''    if (row.status !== "draft") period?.assertOpen(row.issue_date, `Bu ${label.toLocaleLowerCase("tr-TR")}`);
'''
muts = [
  ("M1 tarih bağı geri (sıra-tarih tabanı silinen belgenin tarihini sayar)", INV, lambda t: sub(t, "const held = keptOf(floorOf(series, year));", "const held = floorOf(series, year);"), N1),
  ("M2 geri yükleme sıra denetimi kaldırıldı", INV, lambda t: sub(t, "    if (order) throw new HttpError(409, order.text,", "    if (false && order) throw new HttpError(409, order.text,"), N1),
  ("M3 kept yok sayılır (taşınan numaranın tarihi taban değil)", NF, lambda t: sub(t, "return floor.deleted === true ? entry(floor.kept) : entry(floor);", "return floor.deleted === true ? null : entry(floor);"), N1),
  ("M4 geri yüklemede yalnız sonraki taraf (küçük numara daha yeni tarih görülmez)", INV, lambda t: sub(t, "const other = later || earlier ||", "const other = later ||"), N1),
  ("M5 sıra-tarih kilitten önce", INV, lambda t: sub(sub(t, ORDER, ""), LOCK, ORDER + LOCK)),
  ("M6 v32 eski birleşim (Silinenler en büyükse taşınan tarih kaybolur)", MIG, lambda t: sub(t, "best.set(key, mergeFloor(best.get(key) || null, { seq, number: raw.number, issueDate: raw.issue_date, deleted: true }));", "if (!(best.get(key)?.seq >= seq)) best.set(key, { seq, number: raw.number, issueDate: raw.issue_date, deleted: true });"), N1),
  ("M7 Düzenle silinen komşunun tarihine bağlı", INV, lambda t: sub(t, "const kept = existing.seq > 0 ? keptOf(floorOf(existing.series, existing.year)) : null;", "const kept = existing.seq > 0 ? floorOf(existing.series, existing.year) : null;"), N1),
  ("M8 iptal edilmiş belge sırada sayılmaz", INV, lambda t: sub(t, 'const pick = "SELECT seq, number, issue_date AS issueDate FROM invoices WHERE series = ? AND year = ? AND seq > 0";', 'const pick = "SELECT seq, number, issue_date AS issueDate FROM invoices WHERE series = ? AND year = ? AND seq > 0 AND status = \'issued\'";'), N1),
  ("M6q (Y8) ownPaymentLines çek olaylarını saymaz", INV, lambda t: sub(t, '''    for (const event of store.all("SELECT effects_json AS effects FROM cheque_events WHERE invoice_id = ?", invoiceId)) {
      const effects = parseJson(event.effects, []);
      for (const effect of Array.isArray(effects) ? effects : []) if (effect?.table === "account_entries" && effect.id) ids.add(effect.id);
    }
''', ""), Y8),
]
muts = [m if len(m) == 4 else (*m, N1) for m in muts]
caught = 0
for name, rel, fn, tests in muts:
    path = root / rel
    orig = path.read_text()
    text = fn(orig)
    assert text != orig, name
    path.write_text(text)
    try:
        r = subprocess.run(["node", "--disable-warning=ExperimentalWarning", "--test", "--test-concurrency=1", *tests], cwd=root, capture_output=True, text=True, timeout=900)
    finally:
        path.write_text(orig)
    fail = next((int(l.split()[2]) for l in r.stdout.splitlines() if l.startswith("# fail")), 0)
    ok = r.returncode != 0 and fail > 0
    caught += ok
    reds = [l.strip()[:150] for l in r.stdout.splitlines() if re.match(r"\s+not ok", l)]
    print(f"{'YAKALANDI' if ok else 'KAÇTI'} · {name} · çıkış {r.returncode} · fail {fail} · kırmızı: {' | '.join(reds[:3])}")
print(f"# tests {len(muts)}\n# pass {caught}\n# fail {len(muts) - caught}\n# cancelled 0\n# skipped 0\n# todo 0")
sys.exit(0 if caught == len(muts) else 1)
