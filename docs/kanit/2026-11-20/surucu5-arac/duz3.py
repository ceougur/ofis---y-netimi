import json, sys
p = sys.argv[1]
d = json.load(open(p, encoding='utf-8'))
K = d['kurallar']
kalkan = [k['kod'] for k in K if k['kod'].startswith('P7-AYNI-ADLI-EXCEL-KARTI')]
K[:] = [k for k in K if not k['kod'].startswith('P7-AYNI-ADLI-EXCEL-KARTI')]
for k in K:
    if k['kod'] == 'OLC-S91-KAYIT-TARIHI-CARI':
        k['aciklama'] = k['aciklama'].replace(" Son durumdaki C1 farkı P7'nin sonucudur.", " (SÜRÜCÜ BAKIMI 5: P7 Ç7b taksit küçük turunda kapandı — S219 = A; C1'in kartı artık açılıyor.)")
i = next(n for n, k in enumerate(K) if k['kod'] == 'R-B5-YEREL-GUN-UTC/RAPOR')
K.insert(i + 1, {
    "kod": "R-B5-YEREL-GUN-UTC/RAPOR-MZ0", "kapsam": "rapor", "senaryo": "s91-b5-kg5-yukleme-yerel-gunu", "tz": "UTC", "rapor": "mz0", "alan": "ana", "sinif": "R",
    "aciklama": "bkz. R-B5-YEREL-GUN-UTC/RAPOR — AYNI kural, mz0'da (01.01–09.03): TE1'in yükleme anı 09.03.2026 22:30:00Z UTC sürecinde 09.03, İstanbul'da 10.03 → UTC koşusunda program "
                "KG-5 maddesini (B 120 / A 519 20,00) 09.03'e yazar, kâhin İstanbul gününde 10.03'e (mz0'a girmez): 120 / 519 farkı yalnız TZ=UTC (Europe/Istanbul koşusunda AYNI). "
                "Önceden görünmüyordu — TE1'in kartı P7 yüzünden açılmıyordu; Ç7b taksit küçük turunda (S219 = A) açıldı (c7bt raporu C, 'Yeni 2 fark, yalnız UTC'). Yalnız sınıflama; kural değişmedi."})
d['bakim5'] = ("SÜRÜCÜ BAKIMI 5 (20.11.2026; Ç7b tur 3b + taksit küçük turu + kâhin bakımı 14): kalkan kurallar — " + ", ".join(kalkan) +
               " (P7 Ç7b taksit küçük turunda kapandı: S219 = A — aynı adlı ikinci kişinin Excel kartı artık açılıyor; program = kâhin olmalı). Eklenen: R-B5-YEREL-GUN-UTC/RAPOR-MZ0 "
               "(mz1'in yazılı UTC günü kuralının aynısı, mz0'da; c7bt raporu C).")
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
print('kalkan', kalkan, 'kural sayısı', len(K))
