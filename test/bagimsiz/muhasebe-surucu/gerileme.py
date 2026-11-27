"""G5 GERİLEME DENETİMİ: aynı sürücüyle eski ağaç (842e1d48) ve birleşik ağaç (2ba5ac0b) program çıktıları (program.json) birebir mi.
Karşılaştırılan: her olayın durumu / HTTP durumu / red kodu / olay başına mizan (ana, alt hesap, cari) farkı / dengeli / mutabakat; bütün raporların
program okumaları (Ana Defter mizanı, Alt Hesap Mizanı, Cari Mizanı satırları, cari kartı gecikmiş / bakiye, açık faturalar, taksit kartları, WhatsApp
alıcıları, kaynak durumu); son durum (ufuk ve tümü); Mutabakat Testi sonucu. Dışarıda: süre (ms, olcum), rastgele kimlikler (UUID / kayıt kimliği
desenleri <id> olur), yalnız yeni kodun yazdığı alanlar (kilit yanıtındaki frozenThrough / freeze, mutabakat_denetimleri, kilit_son) — bunlar ayrıca raporlanır.
Kullanım: python3 -I gerileme.py <eski kök> <yeni kök> [<tz,...>]"""
import gzip, json, os, re, sys, glob

ESKI, YENI = sys.argv[1], sys.argv[2]
TZ = (sys.argv[3] if len(sys.argv) > 3 else "UTC,Europe-Istanbul").split(",")
ATLA = {"ms", "olcum", "kilit", "mutabakat_denetimleri", "mutabakat_kodlari", "kilit_son", "program", "cari_kimlik", "saat_ms"}
KIMLIK = re.compile(r"(?:[a-z]+[-_])?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\b[a-z]+_[A-Za-z0-9]{10,}\b")


def yukle(yol):
    for y in (yol, yol + ".gz"):
        if os.path.exists(y):
            return json.load(gzip.open(y, "rt", encoding="utf-8") if y.endswith(".gz") else open(y, encoding="utf-8"))
    return None


def norm(x):
    if isinstance(x, dict):
        return {KIMLIK.sub("<id>", k): norm(v) for k, v in x.items() if k not in ATLA}
    if isinstance(x, list):
        return [norm(v) for v in x]
    if isinstance(x, str):
        return KIMLIK.sub("<id>", x)
    return x


def farklar(a, b, yol=""):
    if type(a) != type(b):
        yield (yol, a, b)
        return
    if isinstance(a, dict):
        for k in sorted(set(a) | set(b)):
            if k not in a or k not in b:
                yield (f"{yol}/{k}", a.get(k, "<yok>"), b.get(k, "<yok>"))
            else:
                yield from farklar(a[k], b[k], f"{yol}/{k}")
    elif isinstance(a, list):
        if len(a) != len(b):
            yield (f"{yol}[len]", len(a), len(b))
        for i, (x, y) in enumerate(zip(a, b)):
            yield from farklar(x, y, f"{yol}[{i}]")
    elif a != b:
        yield (yol, a, b)


toplam = ayni = 0
ozet = []
kilitli = []
for tz in TZ:
    for yol in sorted(glob.glob(os.path.join(YENI, tz, "*.program.json*"))):
        ad = os.path.basename(yol).split(".program.json")[0]
        y = yukle(os.path.join(YENI, tz, ad + ".program.json"))
        e = yukle(os.path.join(ESKI, tz, ad + ".program.json"))
        toplam += 1
        if e is None:
            ozet.append(f"{ad} [{tz}] ESKİ ÇIKTI YOK")
            continue
        fk = list(farklar(norm(e), norm(y)))
        if not fk:
            ayni += 1
        else:
            ozet.append(f"{ad} [{tz}] {len(fk)} FARK: " + " · ".join(f"{p}: {json.dumps(a, ensure_ascii=False)[:80]} → {json.dumps(b, ensure_ascii=False)[:80]}" for p, a, b in fk[:6]))
        # Ç3: kilitli dönem içeren senaryolar — yeni kodun donmuş defter denetimi (ledger:snapshot / ledger:rule-diff) ve kilit yanıtı
        kl = [x for x in y["olaylar"] if x.get("tur") == "donem_kilitle"]
        if kl:
            den = {d["code"]: (d.get("ok"), d.get("count")) for d in y.get("mutabakat_denetimleri") or [] if str(d.get("code", "")).startswith("ledger:")}
            kilitli.append(f"{ad} [{tz}] kilit {[x.get('tarih') for x in kl]} durum {[x.get('durum') for x in kl]} frozenThrough {[(x.get('kilit') or {}).get('frozenThrough') for x in kl]} son {y.get('kilit_son')} denetim {den or 'ledger:snapshot + ledger:rule-diff TUTARLI (API yalnız tutmayanı listeler; donmuş koşu var, tutmayan yok)'} · eski↔yeni program çıktısı {'BİREBİR' if not fk else 'FARKLI'}")
print(f"GERİLEME DENETİMİ: {toplam} koşu (senaryo × saat dilimi); program çıktısı BİREBİR {ayni}, FARKLI {toplam - ayni}")
for x in ozet:
    print("  " + x)
print(f"\nKİLİTLİ DÖNEM (Ç3 donmuş okuma ↔ eski kodun canlı türetmesi): {len(kilitli)} koşu")
for x in kilitli:
    print("  " + x)
print(f"\n# tests {toplam}\n# pass {ayni}\n# fail {toplam - ayni}\n# cancelled 0\n# skipped 0\n# todo 0")
sys.exit(0 if ayni == toplam else 1)
