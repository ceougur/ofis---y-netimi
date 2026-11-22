# Ç6-HESAP tur 5 mutantları (ders 7): kopyada (yalnız /dev/shm/c6h5-mut) bir mutantı uygular. Çağrı: python3 -I mutantlar.py <kök> <ad> | --liste
import sys

FS = "server/lib/financial-statements.mjs"
SN = "server/lib/ledger-snapshots.mjs"
M = {
    "m1-disari-sonrasi-yok": (SN, "AND (date < ?1 OR date > ?2) AND substr(entry_id, 1, 7) <> 'voucher'", "AND (date < ?1) AND substr(entry_id, 1, 7) <> 'voucher'"),
    "m2-from-gunu-iki-kez": (SN, "AND (date < ?1 OR date > ?2) AND substr(entry_id, 1, 7) <> 'voucher'", "AND (date <= ?1 OR date > ?2) AND substr(entry_id, 1, 7) <> 'voucher'"),
    "m3-voucher-disariya": (SN, "AND (date < ?1 OR date > ?2) AND substr(entry_id, 1, 7) <> 'voucher' GROUP BY 1, account, sub, party", "AND (date < ?1 OR date > ?2) GROUP BY 1, account, sub, party"),
    "m4-iceri-unutuldu": (FS, "for (const [year, item] of part.years) for (const [key, net] of item.rule) add(year, key, net);", ""),
    "m5-alt-defter-bos": (FS, "const subledgerOf = ledger => new Set(Object.keys(ledger.expected ? ledger.expected([], [], { every: true }) : {}));", "const subledgerOf = () => new Set();"),
    "m6-gt-ruleThrough-through": (FS, "...(needRemainder ? { ruleThrough: cover } : {})", "...(needRemainder ? { ruleThrough: through } : {})"),
    "m7-bilanco-genis-yok": (FS, "const wide = Boolean(posted?.active.length) && through !== cover;", "const wide = false;"),
    "m8-disari-yanlis-yil": (SN, ".map(row => ({ year: Number(row.year), voucher: false,", ".map(row => ({ year: Number(row.year) + 1, voucher: false,"),
    "m9-through-gunu-iki-kez": (SN, "AND (date < ?1 OR date > ?2) AND substr(entry_id, 1, 7) <> 'voucher'", "AND (date < ?1 OR date >= ?2) AND substr(entry_id, 1, 7) <> 'voucher'"),
}
if sys.argv[1] == "--liste":
    print(" ".join(M))
    sys.exit(0)
root, name = sys.argv[1], sys.argv[2]
path, old, new = M[name]
p = f"{root}/{path}"
s = open(p, encoding="utf8").read()
if s.count(old) != 1:
    print(f"MUTANT UYGULANAMADI {name}: {s.count(old)} eşleşme")
    sys.exit(2)
open(p, "w", encoding="utf8").write(s.replace(old, new))
print(f"uygulandı {name} ({path})")
