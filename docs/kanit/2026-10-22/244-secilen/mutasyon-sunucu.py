# 2.4.4 E6 sunucu mutasyonları: kopyada (git archive + değişen dosyalar) invoices.mjs bozulur, test/ebelge-244-secilenleri-gonder.test.mjs koşulur, geri alınır.
# Kullanım: python3 mutasyon-sunucu.py <kopya-kökü>  (kopyada node_modules bağlı; çalışma ağacında KOŞULMAZ — ders 23)
import subprocess, sys, re, os
M = sys.argv[1]
f = os.path.join(M, "server/routes/invoices.mjs")
orig = open(f, encoding="utf-8").read()
MUT = [
 ("M1 ön denetim 409 kaldırıldı", "        if (older.length) {\n          const first = older[0];", "        if (false) {\n          const first = older[0];"),
 ("M2 eski/yeni karşılaştırması ters", "return newest.has(key) && row.issueDate < newest.get(key);", "return newest.has(key) && row.issueDate > newest.get(key);"),
 ("M3 aynı gün de eski sayıldı", "return newest.has(key) && row.issueDate < newest.get(key);", "return newest.has(key) && row.issueDate <= newest.get(key);"),
 ("M4 Seçilenleri Gönder'de outside yok", "    for (const row of outsideRows) {\n      if (inTurn.has(row.id)) continue;", "    for (const row of only ? [] : outsideRows) {\n      if (inTurn.has(row.id)) continue;"),
 ("M5 seçim süzgeci yok (hepsi)", "${only ? \" AND i.id IN (SELECT value FROM json_each(?))\" : \"\"}`, ...unsent.args, ...(only ? [JSON.stringify(only)] : []))", "`, ...unsent.args)"),
 ("M6 parça sınırı yalnız all", "      if (turn && (attempted >= SEND_CHUNK ||", "      if (all && (attempted >= SEND_CHUNK ||"),
 ("M7a kronoloji engelli eski de sayıldı", "        if (!unselected(row.id) || sendBlockOf(row, lastOf) || buyerBlockOf(row, row)) continue;", "        if (!unselected(row.id) || buyerBlockOf(row, row)) continue;"),
 ("M7b alıcı engelli eski de sayıldı", "        if (!unselected(row.id) || sendBlockOf(row, lastOf) || buyerBlockOf(row, row)) continue;", "        if (!unselected(row.id) || sendBlockOf(row, lastOf)) continue;"),
 ("M8 seçilmemiş yerine hepsi (seçili de 'eski')", "      const unselected = only ? id => !onlySet.has(id) : () => true;", "      const unselected = () => true;"),
]
sonuc = []
try:
    for ad, a, b in MUT:
        assert orig.count(a) == 1, ad
        open(f, "w", encoding="utf-8").write(orig.replace(a, b))
        komut = ["node", "--test", os.path.join(M, "test/ebelge-244-secilenleri-gonder.test.mjs")]
        r = subprocess.run(komut, capture_output=True, text=True, timeout=600)
        out = r.stdout + r.stderr
        fail = re.search(r"^# fail (\d+)", out, re.M)
        tests = re.search(r"^# tests (\d+)", out, re.M)
        kirmizi = [m.group(1) for m in re.finditer(r"^\s*not ok \d+ - (S\d+)", out, re.M)]
        satir = f"{ad}: çıkış {r.returncode}, tests {tests.group(1) if tests else '?'}, fail {fail.group(1) if fail else '?'} → {'YAKALANDI' if r.returncode != 0 and fail and int(fail.group(1)) > 0 else 'YAKALANMADI'} ({', '.join(sorted(set(kirmizi)))})"
        print(satir, flush=True)
        sonuc.append(satir)
finally:
    open(f, "w", encoding="utf-8").write(orig)
eksik = [s for s in sonuc if "YAKALANMADI" in s]
print("# tests", len(MUT))
print("# pass", len(MUT) - len(eksik))
print("# fail", len(eksik))
sys.exit(1 if eksik else 0)
