#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Cari kâhini bakımı 25 (§37): model.py yaması — her değişiklik tam metin eşleşmesiyle (bir kez) uygulanır; eşleşme yoksa DURUR. Kullanım: python3 -I yama-model.py <model.py>"""
import sys

P = sys.argv[1]
s = open(P, encoding="utf-8").read()


def r(eski, yeni, n=1):
    global s
    c = s.count(eski)
    if c != n:
        raise SystemExit("eşleşme %d (beklenen %d): %r" % (c, n, eski[:120]))
    s = s.replace(eski, yeni)


# ── mutantlar
r('''    340: "Ç5 C36 ((4) 'fazlası avans' yok): küçülme taksitin AÇIK kısmıyla sınırlanmaz (ödenmiş kısmı da düşer) — kartın açık kalanını aşan iade avansa gitmez",
}''', '''    340: "Ç5 C36 ((4) 'fazlası avans' yok): küçülme taksitin AÇIK kısmıyla sınırlanmaz (ödenmiş kısmı da düşer) — kartın açık kalanını aşan iade avansa gitmez",
    # bakım 25 (§37 — S238–S242, §3)
    341: "Ç5 C37 (S241 yok — bakım 24 davranışı): Düzenle kartın açık kalanından fazla azaltınca fazlası avans olmaz, cari SUS (SK-42 (a))",
    342: "Ç5 C37 (S242 B — artış kartı büyütür): Düzenle ile artan tutar kartın son taksitine eklenir (taksitli faturada plan yeni tutarla)",
    343: "Ç5 C37 (§3 — seçilmeyen kalemin iptali kartı küçültür): kartın içine ALMADIĞI faturanın İptal Et'i carinin Taksitler kartını fatura tutarı kadar (son taksitten) küçültür",
    345: "Ç5 C37 (S239 B — önce kartın içindeki pay): kısmen kartta olan faturaya iade önce kartı küçültür, dış açık sonra",
    346: "Ç5 C37 (S240 B — iade gelen kalem ödemeden önce pay alır): çok kalemli kartta ödeme önce iade gelen faturaya dağılır",
    347: "Ç5 C37 (§3 SUS yok — SK-45): yalnız faturaların açık olduğu elle kartta aday faturanın iptali / iadesi Y23-5 okumasıyla (en eski fatura kartta) değer alır",
}''')

# ── S240 mutantı 346: dağılım sırası (S126 kartında iade gelen fatura önce)
r('''                        if not ot_fat:
                            return x
                        if self.mut == 270:''', '''                        if not ot_fat:
                            return x
                        if self.mut == 346:
                            # mutant 346 (S240 B): iade gelen (kartı küçültmüş) fatura ödemeden önce pay alır
                            s234f_ = {i_["asil"] for i_ in self.faturalar.values() if i_["tur"] == "iade" and i_["durum"] == "kesildi" and i_.get("s234")}
                            return [a for a in x if a in s234f_] + [a for a in x if a not in s234f_]
                        if self.mut == 270:''')

# ── _alacak_govde250: Düzenle fazlası / artışı (Y25-5 / Y25-6)
r('''                for kad, vade, tutar, i in self._taksit_plani(ad, f):
                    # bakım 24 (§36 Y24-2) [KULLANICI KG-23 = A; S205 = A, S220 = A]: Kartı Kapat 'Borçta Kalsın' — açık taksitin gecikme günü min(kendi vadesi, kapanış günü)
                    vade = min(vade, f["kapanis"]) if f.get("kapanis") else vade
                    kalemler[kad] = {"d": f["tarih"], "v": vade, "s": (f["seq"], i), "kalan": tutar, "tur": "n", "kart": "fatura:" + ad}
                    taksitli[ad].append(kad)
                continue
            kalemler[ad] = {"d": f["tarih"], "v": f["tarih"], "s": (f["seq"], 0), "kalan": f["tutar"], "tur": "n", "kart": None}
            satis[ad] = kalemler[ad]''', '''                for kad, vade, tutar, i in self._taksit_plani(ad, f):
                    # bakım 24 (§36 Y24-2) [KULLANICI KG-23 = A; S205 = A, S220 = A]: Kartı Kapat 'Borçta Kalsın' — açık taksitin gecikme günü min(kendi vadesi, kapanış günü)
                    vade = min(vade, f["kapanis"]) if f.get("kapanis") else vade
                    kalemler[kad] = {"d": f["tarih"], "v": vade, "s": (f["seq"], i), "kalan": tutar, "tur": "n", "kart": "fatura:" + ad}
                    taksitli[ad].append(kad)
                if f.get("artis") and self.k250:
                    # bakım 25 (§37 Y25-6) [S242 = A]: Düzenle ile artan tutar kendi kartını büyütmez — faturanın günüyle (vade) ayrı açık; Düzenle'nin anında doğar
                    kalemler["artis:" + ad] = {"d": f["artisD"], "v": f["tarih"], "s": (f["artisS"], 0), "kalan": f["artis"], "tur": "n", "kart": None}
                    taksitli[ad].append("artis:" + ad)
                continue
            # bakım 25 (§37 Y25-5 / Y25-6): Düzenle'nin artışı ayrı kalem (kartın gününden sonra doğar — kartın içine girmez; kuyruktan sonra faturaya katılır); Düzenle'nin fazlası (S241) faturanın
            # kuyruk kalemini kartın tükettiği kadar tutar, fazla ayrıca para dışı bağsız kapatıcı (aşağıda)
            kalemler[ad] = {"d": f["tarih"], "v": f["tarih"], "s": (f["seq"], 0), "kalan": f["tutar"] - (f.get("artis", 0) - f.get("duzFazla", 0) if self.k250 else 0), "tur": "n", "kart": None}
            satis[ad] = kalemler[ad]
            if f.get("artis") and self.k250:
                kalemler["artis:" + ad] = {"d": f["artisD"], "v": f["tarih"], "s": (f["artisS"], 0), "kalan": f["artis"], "tur": "n", "kart": None}''')

r('''        stok = []
        para_disi = {"iade:" + iad: "iade" for _d, _s, iad in iadeler}  # bakım 15 (§26 Y15-7): para DIŞI kapatıcılar (S151 / SK-32)''', '''        stok = []
        para_disi = {"iade:" + iad: "iade" for _d, _s, iad in iadeler}  # bakım 15 (§26 Y15-7): para DIŞI kapatıcılar (S151 / SK-32)
        if self.k250:
            for ad, f in self.faturalar.items():
                if f["cari"] == cari and f["durum"] == "kesildi" and f["tur"] == "satis" and f.get("duzFazla"):
                    # bakım 25 (§37 Y25-5) [S241 = A]: Düzenle kesintisinin kartın açık kalanını aşan kısmı carinin avansı — iade kesintisi gibi (Düzenle'nin gününde, para DIŞI bağsız kapatıcı)
                    kaynaklar.append({"ad": "duzfazla:" + ad, "d": f["duzD"], "s": (f["duzS"], 0), "tutar": f["duzFazla"], "havuz": "i"})
                    para_disi["duzfazla:" + ad] = "iade"
        for no_, kt_ in self.kartlar.items():
            if kt_["aktif"] and kt_["cari"] == cari and kt_.get("_s234susKart") and self.k250:
                neden.add(kt_["_s234susKart"])  # bakım 25 (§37 Y25-4 / Y25-7): SK-45 / SK-46 — kartın kendisi de tanımsız''')

# artış kalemini kuyruktan sonra faturaya kat (non-taksitli) + başka kartın tükettiği artış SUS
r('''        Gp = {xn: gp[xn] for _, xn, _ in R}
        acik = {ad: kalemler[ad]["kalan"] for ad in satis}''', '''        Gp = {xn: gp[xn] for _, xn, _ in R}
        for ad in list(satis):
            # bakım 25 (§37 Y25-6): Düzenle artışı faturanın kendi kalemidir (vadesi aynı — faturanın günü) — kuyruk kalanı faturaya katılır
            if "artis:" + ad in kalemler:
                if any("artis:" + ad in tk_ for tk_ in tuketilen.values()):
                    neden.add("fatura %s Düzenle ile artırıldıktan sonra açılan kart artışı da içine aldı — iki kuralın birlikte okunuşu kararda yok — KULLANICIYA SORULMALI SK-47 (§37 Y25-8)" % ad)
                kalemler[ad]["kalan"] += kalemler.pop("artis:" + ad)["kalan"]
        acik = {ad: kalemler[ad]["kalan"] for ad in satis}''')

# s200 aday faturaları (SK-45) son'a
r('''               "s120": sorted(s120_kart),  # bakım 9 (§21): yalnız elle borçları eskiden yeniye içine alan kartlar (iz — sonucu değiştirmez)''',
  '''               "s120": sorted(s120_kart),  # bakım 9 (§21): yalnız elle borçları eskiden yeniye içine alan kartlar (iz — sonucu değiştirmez)
               # bakım 25 (§37 Y25-7): S200 kartının gününde aday olan (iki ya da daha çok) taksitsiz satış faturası — kartın hangisini aldığı kararlarda açıkça yok (SK-45)
               "s200sec": {t_["kart"]: [a_ for a_ in t_["s110"][1] if a_ in self.faturalar] for t_ in tuketimler
                           if t_.get("s110") and t_["s110"][0] == "s200" and sum(1 for a_ in t_["s110"][1] if a_ in self.faturalar) >= 2},''')

# ── iade döngüsü: dış açık (S239) da bağ
r('''                x = p234["kucul"]
                kt_ = self.kartlar.get(p234["no"]) if p234["tur"] == "kart" else None''', '''                x = p234["kucul"] + p234.get("dis", 0)  # bakım 25 (§37 Y25-3) [S239 = A]: önce kartın dışındaki açık (bağ), sonra kartın küçülmesi
                kt_ = self.kartlar.get(p234["no"]) if p234["tur"] == "kart" else None''')

# ── iade(): artırılmış / fazlalı faturaya iade SUS (SK-47)
r('''        p234 = self._s234_plan(a["fatura"], tutar - (tutar if a.get("geri") == "nakit" else 0)) if self.k250 else None
        self.faturalar[a["ad"]] = {"cari": asil["cari"], "tutar": tutar, "tarih": t,''', '''        p234 = self._s234_plan(a["fatura"], tutar - (tutar if a.get("geri") == "nakit" else 0)) if self.k250 else None
        if self.k250 and (asil.get("artis") or asil.get("duzFazla")):
            p234 = ("sus", "fatura %s Düzenle ile değiştirildikten sonra iade edildi (artış / fazla avans) — iki kuralın birlikte okunuşu kararda yok — KULLANICIYA SORULMALI SK-47 (§37 Y25-8 (iv))" % a["fatura"])
        self.faturalar[a["ad"]] = {"cari": asil["cari"], "tutar": tutar, "tarih": t,''')

# ── _s234_plan: SK-45, S239 dış önce, S240 çok kalemli, SK-46
r('''        else:
            kartlar = sorted(no_ for no_, tk in (t.get("tuketilen") or {}).items() if tk.get(asil_ad))
            if not kartlar:
                return None
            if t["neden"]:''', '''        else:
            for no_, adaylar_ in sorted((t.get("s200sec") or {}).items()):
                kt0_ = self.kartlar.get(no_)
                if asil_ad in adaylar_ and kt0_ and kt0_["aktif"] and self.mut != 347:
                    # bakım 25 (§37 Y25-7): §3'ün kendi örneği — yalnız faturaların (ya da faturaların da) açık olduğu S200 kartında aday faturaya iade / Düzenle
                    return ("sus", "Mevcut Borç kartı %s açılırken (S200) birden çok fatura adaydı (%s) — kartın hangi faturayı içine aldığı kararlarda açıkça yok; aday faturanın (%s) iadesi / Düzenle'si — "
                                   "KULLANICIYA SORULMALI SK-45 (§37 Y25-7)" % (no_, ",".join(adaylar_), asil_ad), no_)
            kartlar = sorted(no_ for no_, tk in (t.get("tuketilen") or {}).items() if tk.get(asil_ad))
            if not kartlar:
                return None
            if t["neden"]:''')

r('''            if set(tk) != {asil_ad}:
                return ("sus", "Mevcut Borç kartı %s faturayla birlikte başka kalem de içine aldı (%s) — küçülen faturanın kartın ödemesindeki payı kararda yok — KULLANICIYA SORULMALI SK-44 "
                               "(§36 Y24-9 (ii))" % (no, ",".join(sorted(tk))))
            if t["kuyruk"].get(asil_ad, 0) > 0 or A > tk[asil_ad]:
                return ("sus", "fatura %s kartın (%s) dışında da açık ya da iade kartın aldığı paydan büyük — iadenin önce hangi payı düşeceği kararda yok — KULLANICIYA SORULMALI SK-43 "
                               "(§36 Y24-9 (i) / (iii))" % (asil_ad, no))''', '''            # bakım 25 (§37 Y25-3) [S239 = A]: iade önce faturanın kart DIŞINDAKİ açık kısmını kapatır (kart değişmez); artanı kartın içindeki payı düşer (karar (4)) — en çok o pay (S240 'yalnız
            # kendi kalemini'); payı aşan kısım iadenin artanı (2.4.6). Mutant 345 (S239 B): önce kartın içindeki pay.
            D_, P_ = t["kuyruk"].get(asil_ad, 0), tk[asil_ad]
            if self.mut == 345:
                ic_ = min(A, P_)
                dis_ = min(A - ic_, D_)
            else:
                dis_ = min(A, D_)
                ic_ = min(A - dis_, P_)
            if ic_ <= 0:
                return None  # yalnız dış açık — bugünkü iade bağı (kart değişmez)
            if set(tk) != {asil_ad}:
                if no in (t.get("s120") or []) or D_ > 0:
                    # bakım 25 (§37 Y25-4): S240'ın alanı S126 kartı (bakiye kadar açılan); S120 / S200 alanında açılmış çok kalemli kartta küçülme içine alma sınıfını değiştirebilir — dağılım kararda yok
                    return ("sus", "Mevcut Borç kartı %s S120 / S200 alanında birden çok kalemi içine aldı (%s) ve iade / Düzenle kartı küçültüyor — küçülmeden sonra ödemenin dağılım sırası kararda yok — "
                                   "KULLANICIYA SORULMALI SK-46 (§37 Y25-4)" % (no, ",".join(sorted(tk))), no)
                # bakım 25 (§37 Y25-4) [S240 = A]: S126 kartı — kart küçülür, ödeme S126 sırasıyla (aşağıda _alacak_govde250 dağılımı AYNEN, küçülmüş kalemlerle)
            A = ic_''')

r('''        kucul = A - kalan
        return {"tur": tur, "no": no, "parca": parca, "kucul": kucul, "fazla": kalan, "kapali": kapali, "iki": iki}''', '''        kucul = A - kalan
        return {"tur": tur, "no": no, "parca": parca, "kucul": kucul, "fazla": kalan, "kapali": kapali, "iki": iki, "dis": dis_ if tur == "kart" else 0}''')
# dis_ taksitli dalda tanımsız — dalın başında
r('''        if f["taksitli"]:
            if t["neden"]:
                return ("sus", "taksitli faturanın iadesi — carinin kuyruğu iadeden önce tanımsız (%s) (§36 Y24-4)" % "; ".join(sorted(t["neden"])))''', '''        dis_ = 0
        if f["taksitli"]:
            if t["neden"]:
                return ("sus", "taksitli faturanın iadesi — carinin kuyruğu iadeden önce tanımsız (%s) (§36 Y24-4)" % "; ".join(sorted(t["neden"])))''')

# ── _s234_kaydet: SK-45 / SK-46 kart bayrağı
r('''        if isinstance(p, tuple):
            kayit["s234sus"] = p[1]
        elif p:''', '''        if isinstance(p, tuple):
            kayit["s234sus"] = p[1]
            if len(p) > 2 and p[2] in self.kartlar:
                self.kartlar[p[2]]["_s234susKart"] = p[1]  # bakım 25 (§37 Y25-4 / Y25-7): kartın tutarı / göstergeleri de seçime bağlı — SUS
        elif p:''')

# ── fatura_duzenle: S241 fazla avans, S242 artış, SK-47
r('''        adet0, adet = int(f.get("adet", 1)), int(a["adet"])
        yeni = f["tutar"] * adet // adet0
        delta = f["tutar"] - yeni
        if delta < 0 and self.k250:
            f["s234sus"] = "fatura %s Düzenle ile ARTIRILDI — kartın büyüyüp büyümediği kararda yok — KULLANICIYA SORULMALI SK-42 (b) (§36 Y24-6)" % a["fatura"]
        elif delta > 0 and self.mut != 338 and self.k250:
            p = self._s234_plan(a["fatura"], delta)
            if isinstance(p, dict) and p["fazla"] > 0:
                f["s234sus"] = "fatura %s Düzenle ile kartın açık kalanından fazla azaltıldı — fazlanın taşıyıcısı kararda yok — KULLANICIYA SORULMALI SK-42 (a) (§36 Y24-6)" % a["fatura"]
            else:
                self._s234_kaydet(f, p)
        if f["taksitli"]:
            f.setdefault("planTutar", f["tutar"])''', '''        adet0, adet = int(f.get("adet", 1)), int(a["adet"])
        yeni = f["tutar"] * adet // adet0
        delta = f["tutar"] - yeni
        t_ = a.get("tarih", self.bugun)
        if self.k250 and (f.get("artis") or f.get("duzFazla")):
            # bakım 25 (§37 Y25-5 / Y25-8 (iii)): aynı faturada ikinci Düzenle (artış / fazla avanstan sonra) — kararda yok
            f["s234sus"] = "fatura %s Düzenle ile ikinci kez değiştirildi (önceki Düzenle artış / fazla avans bıraktı) — kararda yok — KULLANICIYA SORULMALI SK-47 (§37 Y25-8 (iii))" % a["fatura"]
        elif delta < 0 and self.k250:
            # bakım 25 (§37 Y25-6) [S242 = A]: artış kartı DEĞİŞTİRMEZ — faturanın kendi vadesiyle ayrı açık (Düzenle anında doğan kalem; kartın / taksitli faturanın kendi kartının içine girmez)
            self._onbellek = {}
            t250_ = self.tyk250(f["cari"])
            self._onbellek = {}
            kartli_ = [no_ for no_, tk_ in (t250_.get("tuketilen") or {}).items() if tk_.get(a["fatura"]) and self.kartlar.get(no_, {}).get("aktif")]
            if self.mut == 342:
                # mutant 342 (S242 B): artış kartın son taksitine (taksitli faturada plan yeni tutarla)
                if f["taksitli"]:
                    f["planTutar"] = yeni
                for no_ in kartli_[:1]:
                    kt_ = self.kartlar[no_]
                    items_ = list(kt_["items"])
                    items_[-1] = (items_[-1][0], items_[-1][1] - delta)
                    kt_["items"], kt_["toplam"] = items_, kt_["toplam"] - delta
            elif f["taksitli"] or kartli_:
                f["artis"], f["artisD"], f["artisS"] = -delta, t_, self.yeni_seq()
                self._iz15[f["cari"]].add("s242")
        elif delta > 0 and self.mut != 338 and self.k250:
            p = self._s234_plan(a["fatura"], delta)
            if isinstance(p, dict) and p["fazla"] > 0 and self.mut == 341:
                f["s234sus"] = "fatura %s Düzenle ile kartın açık kalanından fazla azaltıldı — fazlanın taşıyıcısı kararda yok — KULLANICIYA SORULMALI SK-42 (a) (§36 Y24-6)" % a["fatura"]
            else:
                self._s234_kaydet(f, p)
                if isinstance(p, dict):
                    # bakım 25 (§37 Y25-5) [S241 = A]: Düzenle kesintisinin karta (dış açığa ve kartın açık kalanına) sığmayan kısmı carinin avansı — iade kesintisi gibi
                    fz_ = delta - p["kucul"] - p.get("dis", 0)
                    if fz_ > 0:
                        f["duzFazla"], f["duzD"], f["duzS"] = fz_, t_, self.yeni_seq()
                        self._iz15[f["cari"]].add("s241")
        if f["taksitli"]:
            f.setdefault("planTutar", f["tutar"])''')

# ── fatura_iptal: SK-45 (seçilmeyen / seçilen belirsiz) ve mutant 343
r('''        s206 = self._s206_kartlar(a["fatura"], f) if self.k250 else []  # bakım 21b (§33 Y21b-7 / Y21b-8): iptalden ÖNCE — faturayı içine alan Taksitler kartları''', '''        s206 = self._s206_kartlar(a["fatura"], f) if self.k250 else []  # bakım 21b (§33 Y21b-7 / Y21b-8): iptalden ÖNCE — faturayı içine alan Taksitler kartları
        if self.k250 and f.get("tur", "satis") == "satis" and f["durum"] == "kesildi":
            self._onbellek = {}
            t45_ = self.tyk250(f["cari"])
            self._onbellek = {}
            for no_, adaylar_ in sorted((t45_.get("s200sec") or {}).items()):
                kt0_ = self.kartlar.get(no_)
                if a["fatura"] in adaylar_ and kt0_ and kt0_["aktif"] and self.mut != 347:
                    # bakım 25 (§37 Y25-7): §3'ün kendi örneği — kartın hangi faturayı aldığı açıkça yok: aday faturanın iptali kartı kapatır mı (S206) değiştirmez mi — SUS (SK-45)
                    kt0_["_s234susKart"] = ("Mevcut Borç kartı %s açılırken (S200) birden çok fatura adaydı (%s) — kartın hangi faturayı içine aldığı kararlarda açıkça yok; aday faturanın (%s) iptali — "
                                            "KULLANICIYA SORULMALI SK-45 (§37 Y25-7)" % (no_, ",".join(adaylar_), a["fatura"]))
                    s206 = [x for x in s206 if x[0] != no_]
            if self.mut == 343 and not s206 and not any(a["fatura"] in tk_ for tk_ in (t45_.get("tuketilen") or {}).values()):
                # mutant 343 (§3): kartın içine ALMADIĞI faturanın iptali carinin Taksitler kartını fatura tutarı kadar (son taksitten) küçültür
                for no_, kt_ in sorted(self.kartlar.items()):
                    if kt_["aktif"] and kt_["cari"] == f["cari"] and kt_.get("api") and kt_["mevcut"] and kt_.get("satis") is None:
                        x_, items_ = f["tutar"], list(kt_["items"])
                        for i_ in reversed(range(len(items_))):
                            y_ = min(items_[i_][1], x_)
                            items_[i_] = (items_[i_][0], items_[i_][1] - y_)
                            x_ -= y_
                        kt_["toplam"] -= f["tutar"] - x_
                        kt_["items"] = items_
                        break''')

# ── kontrol: SK-45 / SK-46 kartının göstergeleri SUS
r('''            if s234k:
                et = et_b = kt["s234et"]
            self.d("%s:kart:%s:var" % (k, no), True, et_b, "B1.3 kart açıldı")''', '''            if s234k:
                et = et_b = kt["s234et"]
            if kt.get("_s234susKart") and self.k250:
                # bakım 25 (§37 Y25-4 / Y25-7): kartın hangi kalemi taşıdığı / küçülmeden sonraki dağılım kararda yok — kartın göstergeleri SUS (SK-45 / SK-46)
                self.belirsiz.append("%s: kart %s — %s" % (k, no, kt["_s234susKart"]))
                continue
            self.d("%s:kart:%s:var" % (k, no), True, et_b, "B1.3 kart açıldı")''')

open(P, "w", encoding="utf-8").write(s)
print("yama uygulandı")
