"""S231 mutant koşusu (G2; ders 7): her mutant kod KOPYASINA (argv[1]; yeni kodun git worktree kopyası) değerle uygulanır, üç test dosyası koşulur, dosya geri
yazılır. Beklenen: her mutant en az bir testte kırmızı. Kullanım: python3 -I s231-mutant.py <kod kopyası> <çıktı .txt>"""
import os
import re
import subprocess
import sys

ROOT, OUT = sys.argv[1], sys.argv[2]
BS = chr(92)
U0 = BS + "u001f"
U1 = BS + "u001e"
MUTANTS = [
    ("M1 grup katlamasını kaldır", "server/routes/plans.mjs", 'const similar = folded ? folded.find(clean, parentId) : "";', 'const similar = "";'),
    (
        "M2 S228 sırasını ters çevir (Türkçe katlama önce)",
        "server/routes/plans.mjs",
        "    if (found) return found.id;\n    const similar = folded ? folded.find(clean, parentId) : \"\";\n    if (similar) return similar;",
        "    const similar = folded ? folded.find(clean, parentId) : \"\";\n    if (similar) return similar;\n    if (found) return found.id;",
    ),
    ("M3 elle grup formunu katlamalı yap", "server/routes/plans.mjs", "const id = store.tx(() => ensureGroup(user, name, parentId));", "const id = store.tx(() => ensureGroup(user, name, parentId, groupFinder()));"),
    ("M4 aynı yüklemede açılan grubu haritaya ekleme", "server/routes/plans.mjs", "put(id, name, parentId);\n          fresh.add(id);", "fresh.add(id);"),
    ("M5a çek haritası: aranan adların anahtarı İngilizce küçük harf", "server/lib/names.mjs", "    const key = foldPersonName(name);\n    if (key) keys.add(key);", '    const key = String(name ?? "").trim().toLowerCase();\n    if (key) keys.add(key);'),
    ("M5b çek haritası: anahtar katlanmamış addan (İngilizce küçük harf)", "server/lib/names.mjs", "if (keys.has(folded[i])) hits.add(raw[i]);", "if (keys.has(raw[i].toLowerCase())) hits.add(raw[i]);"),
    ("M6 birleşik metinde ayraç yanındaki boşluğu kırpma", "server/lib/names.mjs", ".replace(JOINED_EDGE_SPACE, \"" + U0 + "\")", ""),
    ("M7 parça sayısı (ayraç) denetimini kaldır", "server/lib/names.mjs", "if (folded.length !== n) return (map = false);", ""),
    ("M8 aranmayan adı boş sonuca gönder", "server/lib/names.mjs", "return found ? [...(found.get(key) || [])] : fallback.ids(name);", "return found ? [...(found.get(key) || [])] : keys.has(key) ? fallback.ids(name) : [];"),
    (
        "M9 katlamayla bulunan grubu Tablodan Aktar'ın Geri Al listesine koy",
        "server/routes/plan-transfer.mjs",
        "if (folded) return plansService.ensureGroup(user, name, parentId, folded);",
        "if (folded) { const made = plansService.ensureGroup(user, name, parentId, folded); if (made && !undo.groups.includes(made)) undo.groups.push(made); return made; }",
    ),
    ("M10 geri alınmış iç işlemin grubunu aday say (güncel satır denetimi yok)", "server/routes/plans.mjs", "if (!ids?.size) return \"\";", "if (!ids?.size) return \"\";\n        if (ids.size === 1) return [...ids][0];"),
    ("M11 birleşik metinde boşluk düzeltmesini atla", "server/lib/names.mjs", "if (JOINED_ODD_SPACE.test(spaced))", "if (false)"),
]
TESTS = ["test/s231-grup-adi-turkce-250.test.mjs", "test/s231-cek-hiz-esdegerlik-250.test.mjs", "test/s223-turkce-ad-eslesme-250.test.mjs"]
env = dict(os.environ, HUKUK_LICENSE_URL="http://127.0.0.1:9", TZ="UTC")
lines = []
for name, rel, old, new in MUTANTS:
    path = os.path.join(ROOT, rel)
    original = open(path, encoding="utf-8").read()
    count = original.count(old)
    if count != 1:
        lines.append(f"{name}: UYGULANAMADI (eşleşme {count})")
        continue
    open(path, "w", encoding="utf-8").write(original.replace(old, new))
    try:
        result = subprocess.run(["node", "--test", *TESTS], cwd=ROOT, env=env, capture_output=True, text=True, timeout=1200)
        out = result.stdout + result.stderr
        fails = re.findall(r"^# fail (\d+)", out, re.M)
        passes = re.findall(r"^# pass (\d+)", out, re.M)
        red = [m.group(1).strip()[:110] for m in re.finditer(r"^\s*not ok \d+ - (\(.*)$", out, re.M)]
        verdict = "KIRMIZI (yakalandı)" if result.returncode != 0 else "YEŞİL (YAŞIYOR)"
        lines.append(f"{name}: {verdict} · çıkış {result.returncode} · pass {passes[-1] if passes else '?'} fail {fails[-1] if fails else '?'} · kırmızı: {' | '.join(red[:4])}")
    finally:
        open(path, "w", encoding="utf-8").write(original)
    print(lines[-1], flush=True)
open(OUT, "w", encoding="utf-8").write("\n".join(lines) + "\n")
