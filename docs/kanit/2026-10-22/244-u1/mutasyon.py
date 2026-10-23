#!/usr/bin/env python3
# U1 mutasyonları: her biri server/routes/accounts.mjs retailAccount'a bilerek hata enjekte eder, yeni testi koşar, dosyayı geri yükler.
import hashlib, subprocess, sys, pathlib

WT = pathlib.Path("/home/user/wt/u1")
TARGET = WT / "server/routes/accounts.mjs"
ORIG = TARGET.read_bytes()
H0 = hashlib.sha256(ORIG).hexdigest()

MUTATIONS = {
    # M1 (brief): işaret ve ad kuralı yerine eski davranış — 11111111111'li EN ESKİ cari.
    "M1-eski-findByTaxNo": [(
        "        const previous = store.setting(RETAIL_ACCOUNT_KEY, \"\") || \"\";\n        const marked = usable(previous);\n        if (marked) return { id: marked, created: false, adopted: false };",
        "        const previous = store.setting(RETAIL_ACCOUNT_KEY, \"\") || \"\";\n        const legacy = taxIdentity.findByTaxNo(ANONYMOUS_TCKN);\n        if (legacy) return { id: legacy, created: false, adopted: false };",
    )],
    # M2: işaretli caride ad denetimi yok (yeniden adlandırılmış cari rolde kalır).
    "M2-isaretli-ad-denetimi-yok": [(
        "return row && row.taxNo === ANONYMOUS_TCKN && isRetailName(row.name) ? row.id : \"\";",
        "return row && row.taxNo === ANONYMOUS_TCKN ? row.id : \"\";",
    )],
    # M3: işaretli caride silinme denetimi yok.
    "M3-silinmis-isaretli-gecerli": [(
        "store.get(\"SELECT id, name, tax_no AS taxNo FROM accounts WHERE id = ? AND deleted_at IS NULL\", id)",
        "store.get(\"SELECT id, name, tax_no AS taxNo FROM accounts WHERE id = ?\", id)",
    )],
    # M4: benimsemede ad kuralı yok (11111111111'li en eski cari benimsenir).
    "M4-benimseme-ad-yok": [(
        ".find(row => isRetailName(row.name))?.id || \"\";",
        ".find(() => true)?.id || \"\";",
    )],
    # M5: benimsemede en yeni aday.
    "M5-benimseme-en-yeni": [(
        "ORDER BY created_at, rowid\", ANONYMOUS_TCKN)",
        "ORDER BY created_at DESC, rowid DESC\", ANONYMOUS_TCKN)",
    )],
    # M6: işaret yazılmaz (her basışta yeniden aranır).
    "M6-isaret-yazilmaz": [(
        "        store.setSetting(RETAIL_ACCOUNT_KEY, id, user.id);\n",
        "",
    )],
}

def run(name):
    cmd = ["node", str(WT / "tools/kanit.mjs"), "kos", f"244-u1/mutasyon-{name}", "--", "node", "--disable-warning=ExperimentalWarning", "--test", "test/nihai-tuketici-u1-244.test.mjs"]
    out = subprocess.run(cmd, cwd=WT, capture_output=True, text=True, timeout=900)
    last = [line for line in (out.stdout + out.stderr).splitlines() if line.startswith("[kanit]")]
    fails = [line.strip()[:260] for line in (out.stdout + out.stderr).splitlines() if line.strip().startswith("✖")]
    return out.returncode, (last[-1] if last else "?"), fails

results = []
try:
    for name, edits in MUTATIONS.items():
        text = ORIG.decode("utf-8")
        for old, new in edits:
            assert text.count(old) == 1, f"{name}: kalıp {text.count(old)} kez"
            text = text.replace(old, new)
        TARGET.write_bytes(text.encode("utf-8"))
        try:
            rc, summary, fails = run(name)
        finally:
            TARGET.write_bytes(ORIG)
        caught = rc != 0
        results.append((name, caught, summary, fails))
        print(f"{name}: {'YAKALANDI' if caught else 'YAKALANMADI'} · {summary}")
        for line in fails:
            print(f"    {line}")
finally:
    TARGET.write_bytes(ORIG)
    assert hashlib.sha256(TARGET.read_bytes()).hexdigest() == H0, "dosya geri yüklenemedi"
    print("dosya geri yüklendi (sha256 aynı)")
sys.exit(0 if all(r[1] for r in results) else 3)
