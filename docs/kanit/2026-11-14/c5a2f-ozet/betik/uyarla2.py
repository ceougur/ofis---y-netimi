#!/usr/bin/env python3
# hedefli.mjs kopyası: vaka A'yı yıl dönümü çevresine genişletir — geri alınan kilit 30.11.2026 ve 30.12.2026 (ilk açık gün 31.12.2026), bugün 01.01.2027 ve 10.01.2027 (ders 13, 22).
import pathlib
p = pathlib.Path("/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a2f-k1/p/hedefli.mjs")
s = p.read_text(encoding="utf-8")
subs = [
    ('  for (const how of ["dogrudan", "once-kaldir"]) {\n    const d = copy(`A-${how}`);\n    try {\n      const c = await cur(d, "2027-01-10");',
     '  for (const [how, back, today] of [["dogrudan", "2026-11-30", "2027-01-10"], ["once-kaldir", "2026-11-30", "2027-01-10"], ["dogrudan", "2026-12-30", "2027-01-01"], ["once-kaldir", "2026-12-30", "2027-01-01"]]) {\n    const d = copy(`A-${how}`);\n    try {\n      const c = await cur(d, today);\n      console.log(`[A ${how}] --- geri ${back}, bugün ${today}`);'),
    ('const back = await c.api.put("/api/admin/period-lock", { lockedUntil: "2026-11-30" });', 'const backed = await c.api.put("/api/admin/period-lock", { lockedUntil: back });'),
    ("console.log(`[A ${how}] kilit 30.11.2026'ya geri: ${back.status} ${back.data?.code || \"\"} örtü ${c.app.ledger.snapshots.coverage()}`);",
     "console.log(`[A ${how}] kilit ${back}'ya geri: ${backed.status} ${backed.data?.code || \"\"} örtü ${c.app.ledger.snapshots.coverage()}`);"),
]
for a, b in subs:
    assert s.count(a) == 1, a[:60]
    s = s.replace(a, b)
p.write_text(s, encoding="utf-8")
print("tamam")
