import sys, re
# node --test çıktısından: her alt sınamanın adı, ok / not ok ve ilk başarısızlık iletisi (+ beklenen / gerçek ilk satırlar).
t = open(sys.argv[1]).read().split('\n')
name = None
out = []
for i, l in enumerate(t):
    m = re.match(r'(\s*)(not ok|ok) \d+ - (.*)', l)
    if m and len(m.group(1)) >= 4:
        name = m.group(3)
        out.append([m.group(2), name, ''])
    if out and out[-1][0] == 'not ok' and not out[-1][2] and re.search(r"error: [|'\"]", l):
        block = " ".join(x.strip() for x in t[i:i + 12])
        block = re.sub(r'\s+', ' ', block)
        out[-1][2] = block[:420]
for st, nm, why in out:
    print(f"{st:6} | {nm[:110]}")
    if why:
        print(f"         NEDEN: {why}")
