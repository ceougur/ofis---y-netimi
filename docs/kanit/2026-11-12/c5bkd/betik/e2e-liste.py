"""Ekran senaryoları: ci.yml'de olan / olmayan + kart / taksit / rapor sözcüklerine dokunma sayısı + bu turda koşulup koşulmadığı. Çalışma ağacının kökünden."""
import glob, os, re

S = "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad"
ci = open(".github/workflows/ci.yml", encoding="utf-8").read()
ran = {os.path.basename(p)[len("son-e2e-"):-len(".cikti")] for p in glob.glob(f"{S}/c5bkd-kanit/son-e2e-*.cikti")}
rows = []
for f in sorted(glob.glob("test/e2e/*.mjs")):
    b = os.path.basename(f)[:-4]
    text = open(f, encoding="utf-8", errors="replace").read()
    if "chromium" not in text and "playwright" not in text and "tarayici" not in text:
        continue  # yardımcı / ön yükleme
    hits = len(re.findall(r"taksit|Taksit|workspace/plans|Tahsil Edilen|Taksitten Kalan|taksit-performans", text))
    rows.append((b, b in ci, hits, b in ran))
print("senaryo sayısı", len(rows), "· ci.yml'de", sum(r[1] for r in rows), "· koşulan", sum(r[3] for r in rows))
print("KOŞULMAYAN, karta / taksite dokunan (dokunma sayısı; C = ci.yml'de):")
print(" ".join(f"{b}({h}{'C' if c else ''})" for b, c, h, r in rows if not r and h))
print("KOŞULMAYAN, dokunmayan:", sum(1 for b, c, h, r in rows if not r and not h))
