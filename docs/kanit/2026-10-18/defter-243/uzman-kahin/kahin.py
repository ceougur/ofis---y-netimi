# Bağımsız kâhin (SMMM eli; programın kodundan değil, TDHP + VUK/KDV uygulamasından). Tutarlar kuruş.
# Kullanım: python3 -I kahin.py prog-1.json
import json, sys
from collections import defaultdict

J = []  # (tarih, açıklama, [(hesap, borç, alacak)])
def f(date, text, *lines):
    d = sum(l[1] for l in lines); a = sum(l[2] for l in lines)
    assert d == a, (text, d, a)
    J.append((date, text, lines))
def B(acc, x): return (acc, round(x * 100), 0)
def A(acc, x): return (acc, 0, round(x * 100))

# Açılış 01.09 (açılış fişi: varlıklar borç / 500 alacak; yükümlülükler alacak / 500 borç)
f("2026-09-01", "Kasa açılış", B("100", 10000), A("500", 10000))
f("2026-09-01", "Banka açılış", B("102", 50000), A("500", 50000))
f("2026-09-01", "M1 cari açılış", B("120", 5000), A("500", 5000))
f("2026-09-01", "T1 cari açılış", B("500", 8000), A("320", 8000))
f("2026-09-01", "Stok açılış P1 100x50", B("153", 5000), A("500", 5000))
# Faturalar
f("2026-09-02", "F1 alış", B("153", 16000), B("191", 2240), A("320", 18240))
f("2026-09-03", "F2 kâğıt gider", B("770", 1000), B("191", 200), A("320", 1200))
f("2026-09-03", "F2 peşin nakit", B("320", 1200), A("100", 1200))
f("2026-09-04", "F3 tevkifatlı alış 612 9/10", B("770", 2000), B("191", 400), A("360", 360), A("320", 2040))
f("2026-09-05", "F4 satış e-Fatura", B("120", 3900), A("600", 3300), A("391", 600))
f("2026-09-06", "F5 satış e-Arşiv KDV dahil", B("120", 1610), A("600", 1500), A("391", 110))
f("2026-09-06", "F5 peşin nakit", B("100", 1610), A("120", 1610))
f("2026-09-07", "F6 tevkifatlı satış 624 2/10", B("120", 5800), A("600", 5000), A("391", 800))
f("2026-09-07", "F7 satış M3", B("120", 3000), A("600", 2500), A("391", 500))
f("2026-09-08", "F8 satıştan iade", B("610", 1050), B("391", 195), A("120", 1245))
f("2026-09-09", "F9 alıştan iade", B("320", 624), A("153", 600), A("191", 24))
f("2026-09-01", "F12 kira stopajlı", B("770", 10000), A("360", 2000), A("320", 8000))
# Tahsilat / ödeme
f("2026-09-12", "Tahsilat nakit", B("100", 2000), A("120", 2000))
f("2026-09-13", "Tahsilat havale", B("102", 3000), A("120", 3000))
f("2026-09-14", "Tahsilat POS", B("108", 1000), A("120", 1000))
f("2026-09-14", "POS valör aynı gün, %2,5 komisyon", B("102", 975), B("653", 25), A("108", 1000))
f("2026-09-15", "Ödeme kredi kartı", B("320", 1500), A("309", 1500))
f("2026-09-15", "Ödeme havale", B("320", 5000), A("102", 5000))
f("2026-09-15", "Kira ödemesi", B("320", 8000), A("102", 8000))
# Çek / senet
f("2026-09-16", "Çek alındı M1", B("101", 4000), A("120", 4000))
f("2026-09-16", "Senet alındı M1", B("121", 2000), A("120", 2000))
f("2026-09-17", "Çek ciro T1", B("320", 4000), A("101", 4000))
f("2026-09-18", "Çek alındı M3", B("101", 3000), A("120", 3000))
f("2026-09-19", "Tahsile ver (101.01→101.02)", B("101", 3000), A("101", 3000))
f("2026-09-25", "Karşılıksız", B("120", 3000), A("101", 3000))
f("2026-09-18", "Verilen çek T1", B("320", 2000), A("103", 2000))
f("2026-09-26", "Şüpheliye al", B("128", 3000), A("120", 3000))
f("2026-09-29", "Karşılık", B("654", 3000), A("129", 3000))
# Banka
f("2026-09-20", "Masraf 52,50 BSMV dahil", B("770", 52.5), A("102", 52.5))
f("2026-09-30", "Faiz geliri brüt 1000 stopaj %15", B("102", 850), B("193", 150), A("642", 1000))
f("2026-09-30", "KMH faizi + BSMV", B("780", 210), A("102", 210))
f("2026-09-21", "Kasadan bankaya", B("102", 5000), A("100", 5000))
f("2026-09-22", "Kasa gideri", B("770", 300), A("100", 300))
# Taksitli satış ve eksi stok
f("2026-09-23", "F13 taksitli satış KDV dahil", B("120", 1200), A("600", 1000), A("391", 200))
f("2026-09-30", "Taksit 1 nakit", B("100", 400), A("120", 400))
f("2026-09-24", "F14 eksi stok satış", B("120", 4040), A("600", 4000), A("391", 40))
f("2026-09-24", "F14 havale tahsil", B("102", 4040), A("120", 4040))

bal = defaultdict(int); deb = defaultdict(int); cre = defaultdict(int)
for _, _, lines in J:
    for acc, d, a in lines:
        bal[acc] += d - a; deb[acc] += d; cre[acc] += a

prog = {}
if len(sys.argv) > 1:
    data = json.load(open(sys.argv[1]))
    for row in data["/api/workspace/ledger"]["data"]["trial"]["accounts"]:
        prog[row["code"]] = round(row["balance"] * 100)
codes = sorted(set(bal) | set(prog))
print(f"{'Hesap':6}{'Kâhin bakiye':>14}{'Program':>14}{'Fark':>12}")
for code in codes:
    k = bal.get(code, 0); p = prog.get(code, 0)
    mark = "" if k == p else "  <-- FARK"
    print(f"{code:6}{k/100:14.2f}{p/100:14.2f}{(p-k)/100:12.2f}{mark}")
print("Toplam borç", sum(deb.values())/100, "alacak", sum(cre.values())/100)
