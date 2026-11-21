"""Ç7b aday düzeltme turu — mutantlar (yalnız /dev/shm/c7bfix-a66/mut kopyasında). Kullanım: python3 -I mutant.py <plans.mjs> <ozgun|m1|m2|m3|m4>
m1 denetimi kaldır (eski onay kabul); m2 karşılaştırmayı yine kartın kendi hesabıyla; m3 409'da güncel kalanı kartın kendi hesabından söyle; m4 kalansız kartı denetim dışı bırak."""
import sys, shutil, os
p, m = sys.argv[1], sys.argv[2]
orig = p + ".ozgun"
if not os.path.exists(orig):
    shutil.copyfile(p, orig)
s = open(orig, encoding="utf-8").read()
COND = 'if (previous.status !== "closed" && status === "closed" && body.closeRemaining !== undefined && body.closeRemaining !== null) {'
CUR = "const current = shownRemaining(previous, user);"
FMT = '.format(current)} TL. Kartı Kapat yeniden sorulacak.`, { code: "plan-close-stale", remaining: current });'
OWN = "roundMoney(Number(detail(previous.id, user)?.totals?.remaining) || 0)"
for needle in (COND, CUR, FMT):
    assert s.count(needle) == 1, needle
if m == "m1":
    s = s.replace(COND, "if (false) {")
elif m == "m2":
    s = s.replace(CUR, f"const current = {OWN};")
elif m == "m3":
    s = s.replace(FMT, f'.format({OWN})}} TL. Kartı Kapat yeniden sorulacak.`, {{ code: "plan-close-stale", remaining: {OWN} }});')
elif m == "m4":
    s = s.replace(COND, COND[:-3] + " && Number(body.closeRemaining) > 0) {")
elif m != "ozgun":
    raise SystemExit("bilinmeyen mutant")
open(p, "w", encoding="utf-8").write(s)
print(m, "uygulandı")
