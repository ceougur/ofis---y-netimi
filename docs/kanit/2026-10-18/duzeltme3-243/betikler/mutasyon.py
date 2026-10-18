# Mutasyon koşucusu (dar kontrol 2, duzeltme3-243): her mutasyon çalışma ağacının AYRI kopyasında (ders 23) uygulanır, ilgili test koşulur;
# test KIRMIZI olmalı (mutasyon yakalandı). Kullanım: python3 -I mutasyon.py <kaynak ağaç> <kopya klasörü>
import subprocess, sys, os, shutil, json
src, work = sys.argv[1], sys.argv[2]
INV = "server/routes/invoices.mjs"; EDM = "server/lib/einvoice/edm.mjs"; UBL = "server/lib/einvoice/ubl-tr.mjs"
G = "test/gg243-dar2-gonderim.test.mjs"; I = "test/gg243-dar2-iade-sira.test.mjs"; E = "test/gg243-dar2-edm.test.mjs"; O = "test/gg243-dar2-olcek.test.mjs"
M = [
 ("M1 geri bırakma serinin son numarası denetimi yok", INV, "      if (top !== row.seq) return false;\n", "", G, "araya"),
 ("M2 geri bırakma hiç yok", INV, "if (code === \"integrator-unreachable\" && releasable && releaseNumber(", "if (false && releaseNumber(", G, "K12"),
 ("M3 belirsizde de geri bırak", INV, "if (code === \"integrator-unreachable\" && releasable", "if ([\"integrator-unreachable\", \"integrator-uncertain\"].includes(code) && releasable", G, "B2"),
 ("M4 açıklamalar yer tutucuya dönmez", INV, "        store.run(`UPDATE ${table} SET note = REPLACE(note, ?, ?) WHERE ${where} AND instr(note, ?) > 0`, number, PENDING_TAG, id, number);\n", "", G, "K12"),
 ("M5 imleç yok sayılır", INV, "const cursor = all ? cursorOf(body.after) : null;", "const cursor = null;", G, "B1"),
 ("M6 imleçten öncekiler bekletmez", INV, "          if (key && !held.has(key)) held.set(key, { issueDate: row.issueDate, accountName: names.get(row.id) || \"\", number: \"\", code: \"\", reason: \"failed\" });", "", G, "B1"),
 ("M7 kopma = ulaşılamadı", EDM, "      const definite = retry || notConnected(error);", "      const definite = true;", E, "B2"),
 ("M8 ensureSession hep giriş", EDM, "if (cached && Date.now() - cached.at < SESSION_TTL && Date.now() - (contacts.get(sessionKey) || 0) < CONTACT_FRESH_MS) return;", "", E, "B3"),
 ("M9 oturum anahtarında parola yok", EDM, "|${createHash(\"sha256\").update(String(password)).digest(\"hex\").slice(0, 16)}`", "`", G, "B3"),
 ("M10 bağlantı hatası kanıtı silmez", EDM, "      contacts.delete(sessionKey);\n      const timeout", "      const timeout", E, "B3"),
 ("M11 ağ hatası sözleşmesi önbelleğe", EDM, "      if (error instanceof IntegratorError && error.code === \"integrator-unreachable\") return entry;\n", "", E, "B6"),
 ("M12 Kes, Sonra Gönder kronolojisi yok", INV, "        if (tail && doc.date < tail.issueDate) fail400(", "        if (false) fail400(", I, "B5"),
 ("M13 B7 Müşteri Fişi sırası okunmaz", INV, "    const withdrawOpen = row.eStatus === \"waiting\" && !(lastPaper && lastPaper.issueDate > row.issueDate);", "    const withdrawOpen = row.eStatus === \"waiting\";", I, "B7"),
 ("M14 iade Ticari serbest", INV, "return INVOICE_KINDS[kind].return ? [\"TEMELFATURA\"] : [\"TEMELFATURA\", \"TICARIFATURA\"];", "return [\"TEMELFATURA\", \"TICARIFATURA\"];", I, "MM2"),
 ("M15 UBL referansı yok sayar", UBL, "tag(\"cbc:ID\", doc.returnRef || doc.originalNumber)", "tag(\"cbc:ID\", doc.originalNumber)", I, "MM1"),
 ("M16 olderPending tabanı yıl başı", INV, "    const floor = last && last.issueDate > `${year}-01-01` ? last.issueDate : `${year}-01-01`;", "    const floor = `${year}-01-01`;", I, "B7"),
 ("M17 kayıt defterindeki alıcı sayılır", INV, "seriesFor(row.kind, row.profile, s) === series && !buyerBlockOf(row, row)).length;", "seriesFor(row.kind, row.profile, s) === series).length;", O, "B4 kural"),
 ("M18 olderPending seri süzgeci yok", INV, "seriesFor(row.kind, row.profile, s) === series && !buyerBlockOf(row, row)).length;", "!buyerBlockOf(row, row)).length;", O, "B4 kural"),
]
out = []
for name, f, old, new, test, pattern in M:
    if os.path.exists(work): shutil.rmtree(work)
    shutil.copytree(src, work, symlinks=True, ignore=shutil.ignore_patterns("node_modules", ".git", "docs"))
    os.symlink(os.path.join(src, "node_modules"), os.path.join(work, "node_modules")) if not os.path.exists(os.path.join(work, "node_modules")) else None
    p = os.path.join(work, f); s = open(p, encoding="utf8").read()
    n = s.count(old)
    if n != 1:
        out.append(f"{name}: UYGULANAMADI (eşleşme {n})"); print(out[-1], flush=True); continue
    open(p, "w", encoding="utf8").write(s.replace(old, new))
    r = subprocess.run(["node", "--disable-warning=ExperimentalWarning", "--test", "--test-name-pattern", pattern, test], cwd=work, capture_output=True, text=True, env={**os.environ, "HUKUK_LICENSE_URL": "http://127.0.0.1:9"}, timeout=1200)
    lines = [l for l in r.stdout.splitlines() if l.startswith("# pass") or l.startswith("# fail") or l.startswith("# tests")]
    out.append(f"{name}: çıkış={r.returncode} {' '.join(lines)} → {'YAKALANDI' if r.returncode != 0 else 'YAKALANMADI'}")
    print(out[-1], flush=True)
shutil.rmtree(work, ignore_errors=True)
