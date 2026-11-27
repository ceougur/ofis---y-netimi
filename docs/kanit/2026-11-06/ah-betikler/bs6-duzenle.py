import sys
p = sys.argv[1]
s = open(p, encoding="utf8").read()
def rep(old, new):
    global s
    assert s.count(old) == 1, (old, s.count(old))
    s = s.replace(old, new)
rep("""        db.exec("BEGIN IMMEDIATE");
        dangling = false; // BEGIN geçti: önceden açık kalan işlem yok
""", """        db.exec("BEGIN IMMEDIATE");
        dangling = false; // BEGIN geçti: önceden açık kalan işlem yok
        lostBy = null;
""")
rep("""      } else db.exec(`SAVEPOINT ${savepoint}`);
      // İç işlem (SAVEPOINT) geri alınırsa""", """      } else {
        // BS-6: dış işlem kendiliğinden geri alındıysa SAVEPOINT yeni bir işlem açar, RELEASE onu kapısız kesinleştirirdi.
        assertLive();
        db.exec(`SAVEPOINT ${savepoint}`);
      }
      // İç işlem (SAVEPOINT) geri alınırsa""")
rep("""        if (depth === 0) {
          db.exec("COMMIT");
          money = null;""", """        // BS-6: işlem kendiliğinden geri alındıysa (yakalanıp yutulan hata) COMMIT / RELEASE "no transaction" iletisiyle asıl nedeni örtmesin.
        if (openTx() === false) throw lostTx();
        if (depth === 0) {
          db.exec("COMMIT");
          money = null;""")
rep("""          undo(`ROLLBACK TO ${savepoint}; RELEASE ${savepoint}`);
          if (money) money.violations.length = Math.min(money.violations.length, violationsAt);""", """          undo(`ROLLBACK TO ${savepoint}; RELEASE ${savepoint}`);
          if (money) money.violations.length = Math.min(money.violations.length, violationsAt);
          noteLost(error);""")
rep("""    setSetting(key, value, userId = null) {
      const result""", """    setSetting(key, value, userId = null) {
      assertLive();
      const result""")
open(p, "w", encoding="utf8").write(s)
print("ok")
