#!/usr/bin/env python3
# sira.mjs kopyasından 'kilit geri' ağırlıklı değişke (sira-geri.mjs): gün 2027'den başlar, kilit 31.12.2026 ile 2026 içi / kaldır arasında gidip gelir; her adımdan sonra
# "fişin yılı > eşleme yılı" durumu ve 'rule-diff-own-year' kodu sayılır (yeni yolun kullanıldığının kanıtı). Değişmezler (I1–I4) AYNEN.
import pathlib
d = pathlib.Path("/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a2f-k1/p")
s = (d / "sira.mjs").read_text(encoding="utf-8")
subs = [
    ('const DAYS = ["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-10", "2028-01-05"];', 'const DAYS = ["2027-01-10", "2027-01-20", "2028-01-05"];'),
    ('const LOCKS = ["2026-10-05", "2026-11-30", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-09", ""];', 'const LOCKS = ["2026-11-30", "2026-12-30", "2026-12-31", "2026-12-31", "2027-01-09", ""];'),
    ("let violations = 0;\n", "let violations = 0;\nconst seen = { later: 0, ownYear: 0, correctedLater: 0 };\n"),
    ("      const row = (await integ(api)).item;\n",
     "      const row = (await integ(api)).item;\n      const ruleYear = Number(((lock ? new Date(Date.parse(`${lock}T00:00:00Z`) + 86400000).toISOString() : day)).slice(0, 4));\n"
     "      const later = app.store.get(\"SELECT COUNT(*) AS n FROM ledger_vouchers v WHERE v.type = 'rule-diff-correction' AND NOT EXISTS (SELECT 1 FROM ledger_vouchers r WHERE r.reversal_of = v.id) AND CAST(substr(v.date, 1, 4) AS INTEGER) > ?\", ruleYear).n;\n"
     "      if (lock && later) { seen.later += 1; if (v.code === \"rule-diff-own-year\") seen.ownYear += 1; if (row?.corrected) seen.correctedLater += 1; }\n"),
    ("console.log(`SONUÇ: ihlal ${violations} ${JSON.stringify(tally)} (kod ${ROOT})`);", "console.log(`SONUÇ: ihlal ${violations} ${JSON.stringify(tally)} · fişin yılı > eşleme yılı olan adım ${seen.later} (own-year ${seen.ownYear}, Düzeltildi ${seen.correctedLater}) (kod ${ROOT})`);"),
]
for a, b in subs:
    assert s.count(a) == 1, a[:50]
    s = s.replace(a, b)
(d / "sira-geri.mjs").write_text(s, encoding="utf-8")
print("tamam")
