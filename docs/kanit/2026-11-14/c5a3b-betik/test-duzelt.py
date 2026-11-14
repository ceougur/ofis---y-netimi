import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
head, sep, tail = s.partition("const HAKEM_ZINCIR = path.join(")
assert sep
def rep(a, b):
    global tail
    assert tail.count(a) == 1, a[:80]
    tail = tail.replace(a, b)

rep("""      digests[`${state}|${company}|${name}`] = norm(JSON.stringify({ kuyruk: JSON.parse(fresh), satirlar: plain(lines.get(id)), kartlar: plain(cardsOf(map.get(id))) }));""",
    """      digests[`${state}|${company}|${name}`] = norm(JSON.stringify({ kuyruk: JSON.parse(fresh), defter: plain(ledgerOf(id)), kartListesi: plain(ctx.plans.forAccount(id, AUDIT)), satirlar: plain(lines.get(id)), kartlar: plain(cardsOf(map.get(id))) }));""")
rep("""  function snapshot(target, company, state, digests) {""", """  // Modül ↔ servis uyuşmazlıkları TOPLANIR, hakem karşılaştırmasından SONRA bildirilir: servisin de kullandığı zincire konan hata önce hakemde (değerle) görünsün.
  function snapshot(target, company, state, digests, problems) {""")
rep("""    if (WRITE_ZINCIR) return;
    assert.ok(!loaded.error, `lib/obligation-input.mjs yüklenemedi: ${loaded.error?.message}`);""", """    if (WRITE_ZINCIR) return;
    if (loaded.error) return void problems.push(`lib/obligation-input.mjs yüklenemedi: ${loaded.error.message}`);
    const soft = fn => {
      try {
        fn();
      } catch (error) {
        problems.push(String(error.message).split("\\n")[0]);
      }
    };""")
rep("""      assert.equal(typeof input.ledgerLines, "function", "modül carinin satırlarını kendisi kuramıyor (ledgerLines yok — zincir taşınmadı)");""",
    """      if (typeof input.ledgerLines !== "function") return void problems.push("modül carinin satırlarını kendisi kuramıyor (ledgerLines yok — zincir taşınmadı)");""")
rep("""      assert.deepEqual([...own.keys()].sort(), [...lines.keys()].sort(), `${state} ${company}: modülün cari kümesi = allLedgers'ın cari kümesi`);
      assert.deepEqual([...own.keys()].sort(), [...all.keys()].sort(), `${state} ${company}: modülün cari kümesi = allObligations'ın cari kümesi`);""",
    """      soft(() => assert.deepEqual([...own.keys()].sort(), [...lines.keys()].sort(), `${state} ${company}: modülün cari kümesi = allLedgers'ın cari kümesi`));
      soft(() => assert.deepEqual([...own.keys()].sort(), [...all.keys()].sort(), `${state} ${company}: modülün cari kümesi = allObligations'ın cari kümesi`));""")
rep("""        assert.equal(text(own.get(id)), text(lines.get(id)), `${state} ${company} ${name}: modülün kendi kurduğu satırlar = allLedgers`);
        const mine = text(buildObligations(input.accountInput(id, TODAY)));
        assert.equal(mine, text(inv.obligationsFor(id, ledgerOf(id))), `${state} ${company} ${name}: modül (yalnız store, satırları kendisi; tek cari) = servis obligationsFor`);
        assert.equal(text(buildObligations(inputs.get(id))), text(all.get(id)), `${state} ${company} ${name}: modül (yalnız store, satırları kendisi; toplu) = servis allObligations`);
        // eski "satırlar parametreyle" yolu da çalışır
        assert.equal(text(buildObligations(input.accountInput(id, TODAY, ledgerOf(id)))), mine, `${state} ${company} ${name}: satırlar parametreyle = kendisi`);""",
    """        soft(() => assert.equal(text(own.get(id)), text(lines.get(id)), `${state} ${company} ${name}: modülün kendi kurduğu satırlar = allLedgers`));
        const mine = text(buildObligations(input.accountInput(id, TODAY)));
        soft(() => assert.equal(mine, text(inv.obligationsFor(id, ledgerOf(id))), `${state} ${company} ${name}: modül (yalnız store, satırları kendisi; tek cari) = servis obligationsFor`));
        soft(() => assert.equal(text(buildObligations(inputs.get(id))), text(all.get(id)), `${state} ${company} ${name}: modül (yalnız store, satırları kendisi; toplu) = servis allObligations`));
        // eski "satırlar parametreyle" yolu da çalışır
        soft(() => assert.equal(text(buildObligations(input.accountInput(id, TODAY, ledgerOf(id)))), mine, `${state} ${company} ${name}: satırlar parametreyle = kendisi`));""")
rep("""    const digests = {};
    snapshot(server.app, "001", "ilk", digests);
    snapshot(child(), "002", "ilk", digests);""", """    const digests = {};
    const problems = [];
    snapshot(server.app, "001", "ilk", digests, problems);
    snapshot(child(), "002", "ilk", digests, problems);""")
rep("""    snapshot(server.app, "001", "iade-sil", digests);
    snapshot(child(), "002", "iade-sil", digests);""", """    snapshot(server.app, "001", "iade-sil", digests, problems);
    snapshot(child(), "002", "iade-sil", digests, problems);""")
rep("""    snapshot(server.app, "001", "geri", digests);
    snapshot(child(), "002", "geri", digests);""", """    snapshot(server.app, "001", "geri", digests, problems);
    snapshot(child(), "002", "geri", digests, problems);""")
rep("""    assert.deepEqual(differ, [], `hakemden farklı çıktı (taşıma davranışı değiştirdi): ${differ.slice(0, 5).join(" · ")}`);
  });""", """    assert.deepEqual(differ, [], `hakemden farklı çıktı (taşıma davranışı değiştirdi): ${differ.slice(0, 5).join(" · ")}`);
    // (1) modül (yalnız store, satırları kendisi) = servis yüzü
    assert.deepEqual(problems, [], `modül ≠ servis (${problems.length}): ${problems.slice(0, 3).join(" · ")}`);
  });""")
open(p, "w", encoding="utf-8").write(head + sep + tail)
print("ok")
