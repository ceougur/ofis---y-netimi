import sys
p = sys.argv[1] + "/program.mjs"
t = open(p, encoding="utf-8").read()
for a, b in [
    ('''      if (q < p) sira.splice(q, 0, ...sira.splice(p, 1));
    }
  }
''', '''      if (q < p) sira.splice(q, 0, ...sira.splice(p, 1));
    }
  }
  // Eski sürümden sınanan programa geçiş: eski sürüm aşamasının (olay no ≤ SON_YEDEK) programdaki SON olayından sonra (sıra değişse de).
  const SON_ESKI = SON_YEDEK ? [...sira].reverse().find(i => i + 1 <= SON_YEDEK) + 1 : 0;
'''),
    ('''    if (server.eski && no === SON_YEDEK) {''', '''    if (server.eski && no === SON_ESKI) {'''),
]:
    assert t.count(a) == 1, a[:50]
    t = t.replace(a, b)
open(p, "w", encoding="utf-8").write(t)
print("tamam")
