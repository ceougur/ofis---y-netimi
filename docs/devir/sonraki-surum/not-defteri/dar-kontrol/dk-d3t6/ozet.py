import json, sys
for f in sys.argv[1:]:
    d = json.load(open(f))
    print("==", f.rsplit("/", 1)[-1], d.get("kod"), d.get("tz"), "carisiz" if d.get("carisiz") else "", d.get("state"), d.get("hata") or "")
    print("  taksitKarti", d.get("sayilar"), "sorunlar", d.get("sorunlar"), "durdurur", d.get("durdurur"), "d127", d.get("d127"))
    if d.get("rapor"):
        print("  rapor[0]", d["rapor"][0], "| Kalan 0 satırı:", sum(1 for r in d["rapor"] if r.startswith("Kalan 0 Taksit")))
    bad = 0
    for r in d["kartlar"]:
        st = r["plan"].split(" ")[0]
        beklenen = "kapali" if (r["durumDb"] == "closed" and r["gun"] <= "2026-12-31") else "acik"
        esit = (r["cariPlanK"] if r["cariPlanK"] != "satırsız" else 0) == (r["cariDefterK"] if r["cariDefterK"] != "-" else 0)
        ok = st == beklenen and esit
        bad += 0 if ok else 1
        print(f"  {'OK ' if ok else 'FARK'} {r['key']:13} db={r['durumDb']:6} closed_at={r['closedAt']} kural={r['kural']!s:6} gun={r['gun']} plan='{r['plan']}' cariPlanK={r['cariPlanK']} defterK={r['cariDefterK']} bugun={r['bugun']}")
    print("  FARK sayısı", bad)
