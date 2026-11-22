# İzt3 mutantları: yeni integrity-scope.mjs'ten (argv[1]) bozuk kopya (argv[3]'e) — argv[2]: m1 | m2
#  m1: süzgeç kimlik değişimini hiç saymaz (eşleşme bölünmez, "kimlik değişti" nedeni yok)
#  m2: kimlik farkı EKLENMEMİŞ rowid'de de bölünür (önceki turun prototipi; UPDATE SET id de süzgece girer)
import sys

src, kind, dst = sys.argv[1], sys.argv[2], sys.argv[3]
s = open(src, encoding="utf-8").read()
split = 'if (pre && post && String(pre.id ?? "") !== String(post.id ?? "") && inserted?.has(rowid)) list.push({ pre, post: null }, { pre: null, post });'
reason = 'for (const { pre, post } of list) if (pre && post && String(pre.id ?? "") !== String(post.id ?? "")) s.reason ||= `${table}: kimlik değişti`;'
assert s.count(split) == 1 and s.count(reason) == 1
if kind == "m1":
    s = s.replace(split, "if (false) list.push();").replace(reason, "")
elif kind == "m2":
    s = s.replace(split, split.replace(" && inserted?.has(rowid)", ""))
else:
    raise SystemExit("m1 | m2")
open(dst, "w", encoding="utf-8").write(s)
print(kind, "yazıldı")
