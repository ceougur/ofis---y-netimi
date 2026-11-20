# kullanım: mutant.py <kök> <ad|geri>  — orijinalden tek bir mutant uygular (metin tam bir kez bulunmalı); "geri" iki dosyayı orijinale döndürür
import sys
root, ad = sys.argv[1], sys.argv[2]
M = {
 "M1-yalniz-ad": ("plans", 'const duplicate = accounts()?.planDuplicate ? accounts().planDuplicate({ name, phone, groupId: g || "", caseKey: record?.key || "", caseSource: record ? source : "" }, cards) : cards.length ? "same" : "";', 'const duplicate = cards.length ? "same" : "";'),
 "M2-telefonsuz-belirsizde-ac": ("accounts", 'if (relation === "unknown") unknown = true;', 'if (relation === "unknown" && phone) unknown = true;'),
 "M3-kart-sorgusunda-grup-yok": ("plans", "WHERE p.deleted_at IS NULL AND p.name = ? COLLATE NOCASE AND COALESCE(p.group_id, '') = ?`,", "WHERE p.deleted_at IS NULL AND p.name = ? COLLATE NOCASE AND ? IS NOT NULL`,"),
 "M4-telefonsuz-eslesmede-grup-yok": ("accounts", 'return phone ? digits(row.phone) === phone : !digits(row.phone) && (row.groupId || "") === (person.groupId || "");', 'return phone ? digits(row.phone) === phone : !digits(row.phone);'),
 "M5-belirsizde-hep-ac": ("accounts", 'return unknown ? "unknown" : "";', 'return "";'),
 "M6-carisiz-telefon-bakmadan-baska": ("accounts", 'else if (phone && other) relation = other !== phone ? "other" : card.accountId ? "unknown" : "same";', 'else if (phone && other) relation = "other";'),
 "M7-kendi-cari-bakmadan-baska": ("accounts", 'if (card.accountId && own) relation = card.accountId === own ? "same" : "other";', 'if (card.accountId && own) relation = "other";'),
}
def orig(f):
    return open(f"{root}/{f}.orig", encoding="utf8").read()
def put(f, text):
    open(f"{root}/server/routes/{f}.mjs", "w", encoding="utf8").write(text)
put("plans", orig("plans"))
put("accounts", orig("accounts"))
if ad == "geri":
    print("orijinale döndü")
    sys.exit(0)
f, old, new = M[ad]
src = orig(f)
assert src.count(old) == 1, (ad, src.count(old))
put(f, src.replace(old, new))
print("uygulandı", ad)
