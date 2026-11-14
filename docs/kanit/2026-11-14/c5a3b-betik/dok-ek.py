# dok.mjs'e (tur 3a'nın döküm betiğinin kopyası) tur 3b'nin ekleri: carinin defter satırları (cari kartı detail().ledger, allLedgers satırları), cari kartının kart listesi
# (plans.forAccount) ve kart haritası (plans.ledgerPlansByAccount) — taban ↔ yeni aynı döküm dosyasında; YENİ kodda ayrıca modülün kendi kurduğu yol (yalnız store, ayrı salt okunur bağlantı)
# ↔ servis — ayrı dosyaya (KENDI=<dosya>; taban kodunda bu işlevler yok).
import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
a = "  const card = new Map(invoices.filter(row => row.planId).map(row => [row.id, inv.cardLedgerState(row)]));\n"
assert s.count(a) == 1
s = s.replace(a, a + "  const allLines = ctx.accounts.allLedgers({}).lines;\n  const planMap = ctx.plans.ledgerPlansByAccount();\n")
b = "      kalan: ledger ? plain(inv.entryStates(id, ledger)) : null,\n"
assert s.count(b) == 1
s = s.replace(b, b + "      defter: ledger ? plain(ledger) : null,\n      satirlar: plain(allLines.get(id) || null),\n      kartListesi: plain(ctx.plans.forAccount(id, AUDITOR)),\n      kartHaritasi: plain(planMap.get(id) || null),\n")
c = "  summary.cariler += ids.length;\n"
assert s.count(c) == 1
s = s.replace(c, '''  if (process.env.KENDI) {
    const { createStore, openDatabase } = await import(pathToFileURL(path.join(root, "server", "lib", "db.mjs")).href);
    const { resolveDbPath } = await import(pathToFileURL(path.join(root, "server", "lib", "db-path.mjs")).href);
    const { createObligationInput } = await import(pathToFileURL(path.join(root, "server", "lib", "obligation-input.mjs")).href);
    const { buildObligations } = await import(pathToFileURL(path.join(root, "server", "lib", "obligation-queue.mjs")).href);
    const file = company.id === app.companyId ? app.config.dbPath : resolveDbPath(app.companies.dirsOf(app.companies.get(company.id)).dataDir);
    const db = openDatabase(file, { readOnly: true });
    const input = createObligationInput({ store: createStore(db) });
    const own = input.ledgerLines();
    const inputs = input.batchInputs(day);
    const live = new Set(ctx.store.all("SELECT id FROM accounts WHERE deleted_at IS NULL").map(row => row.id));
    const k = { sirket: company.id, cari: 0, kumeAyni: JSON.stringify([...own.keys()].sort()) === JSON.stringify([...allLines.keys()].sort()) && JSON.stringify([...own.keys()].sort()) === JSON.stringify([...(all ? all.keys() : [])].sort()), satirFark: 0, tekFark: 0, topluFark: 0, ornek: [] };
    const t0 = Date.now();
    for (const id of ids) {
      if (!live.has(id)) continue;
      k.cari += 1;
      const ledger = ledgerOf(id);
      const bad = [];
      if (JSON.stringify(plain(own.get(id))) !== JSON.stringify(plain(allLines.get(id)))) { k.satirFark += 1; bad.push("satir"); }
      if (JSON.stringify(plain(buildObligations(input.accountInput(id, day, null)))) !== JSON.stringify(plain(inv.obligationsFor(id, ledger)))) { k.tekFark += 1; bad.push("tek"); }
      if (JSON.stringify(plain(buildObligations(inputs.get(id)))) !== JSON.stringify(plain(all.get(id)))) { k.topluFark += 1; bad.push("toplu"); }
      if (bad.length && k.ornek.length < 5) k.ornek.push([id, bad]);
    }
    k.sure = Date.now() - t0;
    db.close();
    writeFileSync(process.env.KENDI, `${JSON.stringify(k)}\\n`, { flag: "a" });
  }
''' + c)
open(p, "w", encoding="utf-8").write(s)
print("ok")
