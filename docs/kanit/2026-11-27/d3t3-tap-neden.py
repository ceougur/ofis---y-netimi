# TAP günlüğünden her "not ok" alt testin ilk hata iletisi (ve varsa beklenen / bulunan özetinin ilk satırları). argv[1] = günlük.
import sys, re
lines = open(sys.argv[1], encoding="utf-8", errors="replace").read().split("\n")
i = 0
while i < len(lines):
    m = re.match(r"^(\s+)not ok \d+ - (.*)$", lines[i])
    if m and len(m.group(1)) >= 4:
        name = m.group(2)
        msg = []
        j = i + 1
        while j < len(lines) and not re.match(r"^\s*(not )?ok \d+ - ", lines[j]) and j < i + 60:
            t = lines[j].strip()
            if t.startswith("error:"):
                rest = t[6:].strip()
                if rest in ("|-", ">-", "|"):
                    k = j + 1
                    while k < len(lines) and len(msg) < 4 and lines[k].strip() and not lines[k].strip().startswith(("code:", "name:", "expected:", "actual:", "operator:", "stack:")):
                        msg.append(lines[k].strip())
                        k += 1
                else:
                    msg.append(rest)
                break
            j += 1
        print(f"- {name[:95]} → {' / '.join(msg)[:260]}")
    i += 1
