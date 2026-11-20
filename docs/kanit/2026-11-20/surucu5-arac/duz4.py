import json, sys
p = sys.argv[1]
d = json.load(open(p, encoding='utf-8'))
K = d['kurallar']
KALK = ['U-S58-KART-KUCULTME', 'U-S69-S15-IPTAL-DURUMU', 'U-S15-KARTLI-FATURA-IPTAL', 'U-S15-KARTLI-FATURA-IPTAL/s69', 'R-S192-BAG-SONRA/r1', 'R-S192-BAG-SONRA/r2',
        'OLC-S87-ESKI-SURUMDE-GERI-ALMA/RAPOR']
var = {k['kod'] for k in K}
assert all(x in var for x in KALK), [x for x in KALK if x not in var]
K[:] = [k for k in K if k['kod'] not in KALK]
K.append({
    "kod": "R-S200-ACIK-FATURALAR-KART-PAYI", "kapsam": "rapor", "senaryo": "s118-a1-s200-elle-once-sonra-fatura", "rapor": "*", "alan": "fatura", "sinif": "R",
    "kimlik": "SORU (sürücü bakımı 5 — S200 × Açık Faturalar)",
    "aciklama": "KURAL BELİRSİZ (rapor kuralı; bakiye ve gecikmiş AYNI): Mevcut Borç kartının İÇİNE ALDIĞI fatura kısmı Açık Faturalar raporunda kapanmış mı sayılır? Kâhin (README bakım 2 R5 / M1e "
                "'fatura durumu' görünümü; bakım 14 İ1: 'acik_faturalar F1 20.000') NET: kartın tükettiği kısım kapanmış — F1 50.000 − kartın aldığı 30.000 = 20.000. Program BRÜT: "
                "server/routes/invoices.mjs openItems (yorum: 'v2.0.23 (Bulgu 2 D) … Açık Faturalar raporu ve fatura kartı faturanın kendi açığını gösterir (net istemez)'; birleşik listeler "
                "— yaşlandırma, nakit akışı, Vade Takip, takvim — net ister) → F1 50.000. v2.4.9'un gerçek kodu ve Ç7b öncesi kod (c7b2-taban) da 50.000 (gerileme değil). Önceden görünmüyordu: "
                "kâhinin hiçbir senaryosunda kart açık Faturalar raporundaki bir faturayı içine almıyordu (s51'de S120 ile kart yalnız elle borcu alır). Bu senaryoda af3 (C3: F2 40.000 / "
                "F3 20.000 ↔ kâhin 30.000 / 0) aynı kök (rapor geçmiş günlü olsa da 20.02 sonrasında yalnız rapor olayı var — program değeri günden bağımsız). Kartın KENDİ faturası "
                "(Kalanı Taksitlendir) Açık Faturalar'a hiç girmez (plan_id ≠ '' süzülür; alt başlık 'taksitli faturalar taksit kartında izlenir'). KULLANICIYA SORULMALI (sürücü bakımı 5 raporu)."})
d['bakim5'] = d['bakim5'] + (" Ayrıca ATEŞLEMEYEN (eskimiş) kurallar kalktı — " + ", ".join(KALK) + " (U-S58 / U-S69 / U-S15: Ç7b tur 3'te karar (4) ve S15 = A programda — bekleyen 'Ç7b' kimliği 0; "
                             "R-S192-BAG-SONRA: S212 = A tek aday düzeltme turunda programda (9db9b69d) — rastgele-1 / -2'de program = kâhin, sürücü bakımı 4'ün en küçük örneği ek-bag-sonra c7b-aday'da "
                             "AYNI, c7b2-taban'da eski fark; OLC-S87/RAPOR: sınamada ve taban koşusunda hiç ateşlemedi). Ateşlemeyen kural bir gerilemeyi örtebilirdi. Eklenen: R-S200-ACIK-FATURALAR-KART-PAYI.")
sat = ["{"]
anahtarlar = [k for k in d if k != 'kurallar'] + ['kurallar']
for n, k in enumerate(anahtarlar):
    son = n == len(anahtarlar) - 1
    if k == 'kurallar':
        sat.append(' "kurallar": [')
        for m, x in enumerate(d['kurallar']):
            sat.append('  ' + json.dumps(x, ensure_ascii=False) + (',' if m < len(d['kurallar']) - 1 else ''))
        sat.append(' ]' + ('' if son else ','))
    else:
        sat.append(' ' + json.dumps(k, ensure_ascii=False) + ': ' + json.dumps(d[k], ensure_ascii=False) + ('' if son else ','))
sat.append('}')
open(p, 'w', encoding='utf-8').write('\n'.join(sat) + '\n')
json.load(open(p, encoding='utf-8'))
print('kural sayısı', len(K))
