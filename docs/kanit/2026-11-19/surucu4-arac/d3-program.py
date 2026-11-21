import sys
p = sys.argv[1]
t = open(p, encoding="utf-8").read()


def rep(a, b, n=1):
    global t
    assert t.count(a) == n, (a[:80], t.count(a))
    t = t.replace(a, b)


# 1. KG-7: KDV İndirim Dönemi programda (Ç7b tur 2d — routes/invoices.mjs vatPeriodOf; gövde alanı vatPeriod 'YYYY-AA'; istemci fatura formunun 'KDV İndirim Dönemi' açılır listesi)
rep('''      if (o.tur === "alis_faturasi" && v.indirim_ayi) body.__kdvIndirimAyi = v.indirim_ayi;
      delete body.__kdvIndirimAyi;
''', '''      // SÜRÜCÜ BAKIMI 4 (Ç7b tur 2d / 2e; kâhin bakımı 13 A3): alış faturasının (ve programda alış türündeki gelen SMM'nin) 'KDV İndirim Dönemi' → gövdenin `vatPeriod` alanı (YYYY-AA;
      // fatura formunun açılır listesi: fatura ayı … izleyen yılın Aralık'ı). Sınır dışı dönem programda 400 vat-period-range (kâhin RED KDV_INDIRIM_DONEMI) — red karşılaştırılır.
      if ((o.tur === "alis_faturasi" || o.tur === "gelen_smm") && v.indirim_ayi) body.vatPeriod = v.indirim_ayi;
''')
rep('''...(v.indirim_ayi ? { eksik: "KG-7 KDV İndirim Dönemi alanı programda yok (gönderilmedi)" } : {}), ''', '''...(v.indirim_ayi ? { yol: `KDV İndirim Dönemi ${v.indirim_ayi}` } : {}), ''')
# 2. S190 (kâhin bakımı 13 A4, s116): banka / kart açılışının Sil'i = Banka Hesapları › hesabı Sil (programda açılış hesabın kartındadır; silinen hesabın açılışı ters kaydedilir)
rep('''    case "banka_acilis": {
      if (ids.banka[v.banka]) return sonuc(o, await api("POST", `/api/workspace/bank/accounts/${ids.banka[v.banka]}/opening`, { date: v.tarih, amount: tl(v.tutar), confirmed: true }));
      const id = await bankaAc(v.banka, v);''', '''    case "banka_acilis": {
      if (o.id) hesapOlayi[o.id] = { tur: "banka", anahtar: v.banka };
      if (ids.banka[v.banka]) return sonuc(o, await api("POST", `/api/workspace/bank/accounts/${ids.banka[v.banka]}/opening`, { date: v.tarih, amount: tl(v.tutar), confirmed: true }));
      const id = await bankaAc(v.banka, v);''')
rep('''    case "kart_acilis": {
      if (ids.kart[v.kart])''', '''    case "kart_acilis": {
      if (o.id) hesapOlayi[o.id] = { tur: "kart", anahtar: v.kart };
      if (ids.kart[v.kart])''')
rep('''    case "sil": {
      const fid = ids.olay[v.kaynak];''', '''    case "sil": {
      // SÜRÜCÜ BAKIMI 4 (S190 = A; kâhin bakımı 13 A4 / Ü11 'silinen hesap = Silinenler'deki açılış kaydı' — s116): banka / kart açılışının silinmesi ekranda hesabın Sil'idir
      // (Banka Hesapları › Sil — DELETE /api/workspace/bank/accounts/:id; açılış ters kaydedilir). Açılışı yalnız silen ayrı bir ekran yolu yok.
      if (hesapOlayi[v.kaynak]) {
        const h = hesapOlayi[v.kaynak];
        const hid = (h.tur === "banka" ? ids.banka : ids.kart)[h.anahtar];
        if (!hid) return apiYok(`silinecek ${h.tur} hesabı ${h.anahtar} programda yok`);
        const r = await api("DELETE", `/api/workspace/bank/accounts/${encodeURIComponent(hid)}`);
        if (r.ok) delete (h.tur === "banka" ? ids.banka : ids.kart)[h.anahtar];
        return sonuc(o, r, { yol: `Banka Hesapları › ${h.anahtar} Sil (açılış ters kaydedilir)` });
      }
      const fid = ids.olay[v.kaynak];''')
rep('''const ids = { cari: {}''', '''const hesapOlayi = {}; // SÜRÜCÜ BAKIMI 4: banka / kart açılış olayının kimliği → hesap (S190 silme)
const ids = { cari: {}''')
open(p, "w", encoding="utf-8").write(t)
print("tamam")
