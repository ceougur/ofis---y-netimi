#!/usr/bin/env python3
# ekran-hafta.mjs sonucundan (cikti/ekran-hafta-sonuc.json → "kontrol") belge tablosu üretir: her rapor kalemi için
# bağımsız beklenen · Ekran Şirketi (002) · API Şirketi (001) · sonuç. Kullanım: python3 hafta-tablo.py
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
res = json.load(open(os.path.join(HERE, "cikti", "ekran-hafta-sonuc.json")))
TITLES = {
    "kasa": "Kasa Hareketleri", "bankaPos": "Banka ve POS Hareketleri (Tümü)", "bankaPosYol": "Banka ve POS · Yol kolonundan",
    "banka": "Banka ve POS · Yol = Banka", "pos": "Banka ve POS · Yol = POS", "satis": "Satış Faturaları", "alis": "Alış Faturaları",
    "kdv": "KDV Özeti", "gider": "Gider Raporu", "mizan": "Cari Mizanı", "cariler": "Cari Listesi ve Bakiyeler", "acik": "Açık Faturalar",
    "taksit": "Taksit Kartları (Tümü)", "cek": "Çek / Senet Portföyü", "stok": "Stok Durumu", "ekstre": "Cari Ekstre · Deniz Yapı (yeni cari)",
    "hesapMizani": "Hesap Planı Mizanı", "anlik": "ANLIK DURUM",
}


def tr(value, money=True):
    if value is None:
        return "—"
    if not money:
        return str(int(value))
    s = f"{abs(value):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return ("−" if value < 0 else "") + s


# Sonuç işaretiyle yeniden hesaplanır (koşudaki karşılaştırma mutlak değerdi; gözden geçirme notu).
def signed_ok(row):
    if row.get("dosya") or row.get("rapor") == "stok" or row.get("rapor") == "bankaPosYol":
        return row["ok"]
    return row["ekran"] is not None and abs(float(row["ekran"]) - float(row["beklenen"])) < 0.005


for side in ("Ekran", "API"):
    for row in res["kontrol"][side]:
        row["ok"] = signed_ok(row)
ekran = res["kontrol"]["Ekran"]
api = {(r["rapor"], r["kalem"]): r for r in res["kontrol"]["API"]}
out = ["| Rapor | Kalem | Bağımsız Beklenen | Ekran Şirketi (002) | API Şirketi (001) | Sonuç |", "|---|---|---|---|---|---|"]
files = {"ok": 0, "all": 0}
count = {"ok": 0, "bad": 0, "bulgu": 0}
for r in ekran:
    a = api.get((r["rapor"], r["kalem"]), {})
    if r.get("dosya"):
        files["all"] += 2
        files["ok"] += int(r["ok"]) + int(a.get("ok", False))
        continue
    integer = r["kalem"] in ("Satış Faturası", "Alış Faturası", "Kart") or r["rapor"] == "stok"
    ok = r["ok"] and a.get("ok", False)
    mark = "✓" if ok else f"✗ {r['bulgu']}" if r["bulgu"] else "✗"
    count["ok" if ok else "bulgu" if r["bulgu"] else "bad"] += 1
    out.append(f"| {TITLES.get(r['rapor'], r['rapor'])} | {r['kalem']} | {tr(r['beklenen'], not integer)} | {tr(r['ekran'], not integer)} | {tr(a.get('ekran'), not integer)} | {mark} |")
print("\n".join(out))
print(f"\nKalem: {count['ok'] + count['bad'] + count['bulgu']} · iki şirkette de beklenenle aynı {count['ok']} · bilinen bulgudan farklı {count['bulgu']} · açıklanmamış {count['bad']}")
print(f"PDF/Excel: {files['ok']}/{files['all']} dosya indi, bağlantı pencerenin şirketini taşıyor ve ekrandaki her tutar dosyada da geçiyor (tam eşitlik değil, içerme denetimi)")
