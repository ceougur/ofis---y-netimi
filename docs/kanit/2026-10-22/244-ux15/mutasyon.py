# 2.4.4 UX15 mutasyonları: KOPYADA (çalışma ağacının rsync kopyası; ders 23) bir dosya bozulur, ilgili test koşulur, dosya geri yazılır.
#   S*: sunucu (server/routes/invoices.mjs) → test/fatura-244-numara-tarih-onay.test.mjs (kopyada koşar)
#   C*: istemci (client/assets/hof-invoices.js) → test/e2e/gg244-numara-tarih-onay.mjs (çalışma ağacından, DEPO=<kopya>; flock ile)
# Kullanım: python3 mutasyon.py <kopya-kökü> <çalışma-ağacı> <flock-kilidi> [S|C|SC]
# Çoğu S mutasyonu ön hesabı kayıttaki denetimden AYIRIR (ders: ön denetim sunucu kuralından ayrışırsa testler yakalamalı); S10 ortak kuralı bozar.
import os, re, subprocess, sys

M, WT, LOCK = sys.argv[1], sys.argv[2], sys.argv[3]
WHICH = sys.argv[4] if len(sys.argv) > 4 else "SC"
SRV = os.path.join(M, "server/routes/invoices.mjs")
CLI = os.path.join(M, "client/assets/hof-invoices.js")
SERVER = [
 ("S1 ön hesap çakışma döndürmez", "const numbering = numberingCheck(doc, edited ? invoiceRow(edited.id) : null);", "const numbering = { problems: [], orderHold: null };"),
 ("S2 çakışma blockers'a girmez (form onayı açar)", "blockers: [...issueBlockers(doc), ...numbering.problems],", "blockers: issueBlockers(doc),"),
 ("S3 ön hesap seri yılını şaşırır", "    const year = Number(doc.date.slice(0, 4));\n    push(chronologyProblem(series, year, doc.date));", "    const year = Number(doc.date.slice(0, 4));\n    push(chronologyProblem(series, year - 1, doc.date));"),
 ("S4 ön hesap hep kâğıt serisine bakar", "    const series = numberSeriesOf(doc);\n    const year = Number(doc.date.slice(0, 4));\n    push(", "    const series = doc.settings.series.paper;\n    const year = Number(doc.date.slice(0, 4));\n    push("),
 ("S5 ön hesap dönem kilidini atlar (yeni belge)", "    push(lockProblem(doc.date, \"Fatura\"));\n    if (!ownNumbered(doc)) {", "    if (!ownNumbered(doc)) {"),
 ("S6 ön hesap elle numara çakışmasını atlar", "      push(duplicateProblem(doc));\n      return { problems, orderHold: null };", "      return { problems, orderHold: null };"),
 ("S7 ön hesap Düzenle'de yeni belge kuralı", "if (INVOICE_KINDS[existing.kind].own || existing.seq > 0) push(editChronologyProblem(existing, doc));", "if (INVOICE_KINDS[existing.kind].own || existing.seq > 0) push(chronologyProblem(existing.series || numberSeriesOf(doc), Number(doc.date.slice(0, 4)), doc.date));"),
 ("S8 ön hesap Düzenle'yi tanımaz", "const edited = editedId ? store.get(", "const edited = !editedId ? null : false ? store.get("),
 ("S9 orderHold hesaplanmaz", "const count = !problems.length && deferableDoc(doc) ? olderPending(series, year, doc.date) : 0;", "const count = 0;"),
 ("S10 ortak kural: aynı gün de çakışma", "    if (!(last && last.issueDate > date)) return \"\";", "    if (!(last && last.issueDate >= date)) return \"\";"),
 ("S11 ön hesapta kilit iletisi kayıttakinden farklı", "      if (error?.extra?.code === \"period-locked\") return error.message;", "      if (error?.extra?.code === \"period-locked\") return \"Dönem kilitli.\";"),
]
CLIENT = [
 ("C1 Toplamlar kutusu çakışmayı çizmez", ", ...(c.numbering || []), ...(c.orderHold ? [c.orderHold.text] : [])];", "];"),
 ("C2 Kaydet çakışmada da onay açar", "const blockers = [...(c.blockers || []), ", "const blockers = [...[], "),
 ("C3 onay orderHold'u yok sayar (numara gösterir)", "const held = eSend !== \"later\" && !form.modifyId ? c.orderHold : null;", "const held = null;"),
 ("C4 Düzenle'de kimlik gönderilmez (eski davranış)", "...(form.modifyId || (isReturn(form.kind) && form.id) ? { existingId:", "...(isReturn(form.kind) && (form.modifyId || form.id) ? { existingId:"),
 ("C5 çakışmada sıradaki numara görünür", "calc.nextNumber && !(calc.numbering || []).length && !calc.orderHold ?", "calc.nextNumber ?"),
]

def run(cmd, cwd, env=None):
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=900, env=env)
    return r.returncode, r.stdout + r.stderr

sonuc = []
for group, path, muts in (("S", SRV, SERVER), ("C", CLI, CLIENT)):
    if group not in WHICH:
        continue
    orig = open(path, encoding="utf-8").read()
    try:
        for ad, a, b in muts:
            assert orig.count(a) == 1, f"{ad}: kalıp {orig.count(a)} kez"
            open(path, "w", encoding="utf-8").write(orig.replace(a, b))
            if group == "S":
                code, out = run(["node", "--disable-warning=ExperimentalWarning", "--test", "test/fatura-244-numara-tarih-onay.test.mjs"], M)
                fail = re.search(r"^# fail (\d+)", out, re.M)
                tests = re.search(r"^# tests (\d+)", out, re.M)
                red = [m.group(1).split(":")[0] for m in re.finditer(r"^\s*not ok \d+ - (.+)$", out, re.M) if not m.group(1).startswith("2.4.4")]
                # Dosya hiç yüklenmezse (sözdizimi) mutasyon geçersizdir: yakalandı sayılmaz.
                caught = code != 0 and fail and int(fail.group(1)) > 0 and tests and int(tests.group(1)) > 1
                satir = f"{ad}: çıkış {code}, tests {tests.group(1) if tests else '?'}, fail {fail.group(1) if fail else '?'} → {'YAKALANDI' if caught else 'YAKALANMADI'} ({'; '.join(red)[:300]})"
            else:
                env = dict(os.environ, DEPO=M)
                code, out = run(["flock", LOCK, "node", "--disable-warning=ExperimentalWarning", "test/e2e/gg244-numara-tarih-onay.mjs"], WT, env)
                summary = re.search(r"gg244-numara-tarih-onay: (\d+) geçti, (\d+) kaldı", out)
                red = [line.strip()[2:80] for line in out.splitlines() if line.strip().startswith("✗ ") and "gg244" not in line]
                caught = code != 0 and summary and int(summary.group(2)) > 0
                satir = f"{ad}: çıkış {code}, {summary.group(0) if summary else 'özet yok'} → {'YAKALANDI' if caught else 'YAKALANMADI'} ({'; '.join(red)[:300]})"
            print(satir, flush=True)
            sonuc.append(satir)
    finally:
        open(path, "w", encoding="utf-8").write(orig)
eksik = [s for s in sonuc if "YAKALANMADI" in s]
print("# tests", len(sonuc))
print("# pass", len(sonuc) - len(eksik))
print("# fail", len(eksik))
sys.exit(1 if eksik or not sonuc else 0)
