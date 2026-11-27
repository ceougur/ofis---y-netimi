#!/usr/bin/env python3
# WK 22: kahin.py yaması — S-W21-1 / 2 / 3 = A (README §27). Her yer değiştirme TAM BİR kez eşleşmeli; yoksa çıkış 1.
import sys

yol = sys.argv[1]
s = open(yol, encoding="utf-8").read()


def degis(eski, yeni, n=1):
    global s
    k = s.count(eski)
    if k != n:
        sys.exit(f"eşleşme {k} ≠ {n}: {eski[:120]!r}")
    s = s.replace(eski, yeni)


# 1. başlık docstring
degis("(`devri_geri_al {sirket}`), arşivden başlatma yok (`baslat.arsiv`). Çapraz etiket (S-W21-2) ve basma anında süren sözde Yine de Gönder (S-W21-1) KULLANICIYA SORULMALI — kâhin hata verir.\n",
      "(`devri_geri_al {sirket}`), arşivden başlatma yok (`baslat.arsiv`). Çapraz etiket (S-W21-2) ve basma anında süren sözde Yine de Gönder (S-W21-1) KULLANICIYA SORULMALI — kâhin hata verir.\n"
      "GÜNCELLEME 22 (2.5.1 Ç5-C, KULLANICI KARARI 27.11.2026 17:01 UTC \"önerilerini uygula\" — S-W21-1 / 2 / 3 = A; metinler AYNEN KARARLAR SW21; yorumlar README §27, kodlamadan önce yazıldı ve ayrı\n"
      "commit'lendi): S-W21-1 — Sonucu Belirsiz hatırlatmada işteki Yine de Gönder basıldığı anda Ödeme Sözü sürüyorsa ELLE seçim (iz basma anındaki etiketleri aşar), onay penceresinde\n"
      "\"Ödeme Sözü Var\" (`yeniden.<etiket>.soz_etiketi`), gönderim anındaki elle değerlerle gider; S23'ün söz karşılığı aynı yoldan (S23 tetiği: iz basma anındaki etiketlerden birini aşmıyor).\n"
      "S-W21-2 — iz yalnız işaretlendiği andaki etiket TÜRLERİNİ aşar; sonradan gelen BAŞKA etiketle gönderim anında \"Atlandı — <etiket>\"; başlatmada iki etiket + Yine de Ekle → ikisi birlikte.\n"
      "S-W21-3 — Meta Bekletti 2. denemesinden önce iz değiştiyse içerik gönderim anında (şüphesiz / elle tutarla) yeniden hazırlanır; iz aynıysa 5.2 (1. denemenin içeriği). `mb_elle` okuması KALKTI;\n"
      "üç hata KALKTI. Devri Geri Al sonrası iş adı (`devir_geri`) iki okumalı kalır (girdi §2).\n")

# 2. OKUMALAR
degis('''OKUMALAR = {"devam_sd": DEVAM_OKUMALARI, "devir_geri": ("devir", "geri_yukleme"),   # C5C 8.2 (README §26.2): Devri Geri Al sonrası devirle durmuş işin adı — iki okuma
            "mb_elle": ("gonderim_ani", "ilk_icerik")}                           # C5C 5.2 ↔ S23 / S29 (README §26.4 S-W21-3): Meta Bekletti'de elle iz değişen işin 2. deneme içeriği''',
      '''OKUMALAR = {"devam_sd": DEVAM_OKUMALARI, "devir_geri": ("devir", "geri_yukleme")}   # C5C 8.2 (README §26.2): Devri Geri Al sonrası devirle durmuş işin adı — iki okuma
# güncelleme 21'in "mb_elle" okuması ("gonderim_ani", "ilk_icerik") güncelleme 22'de KALKTI: S-W21-3 = A 'gonderim_ani'yı kesinleştirdi, 'ilk_icerik' S-W21-3'ün B seçeneğidir (M321) — README §27 Y22-8''')

# 3. MUTASYONLAR
degis('''    "M316": "4.1 (dönem = GÜN; gün = iletinin gittiği gün)'in tersi: hatırlatmanın günü toplu işin AÇILDIĞI gün — gece yarısını geçen iş eski güne yazılır",
}''', '''    "M316": "4.1 (dönem = GÜN; gün = iletinin gittiği gün)'in tersi: hatırlatmanın günü toplu işin AÇILDIĞI gün — gece yarısını geçen iş eski güne yazılır",
    # ---- güncelleme 22 (2.5.1 Ç5-C, S-W21-1 / 2 / 3 = A — README §27) ----
    "M317": "S-W21-1 A'nın tersi (B): işteki Yine de Gönder basıldığı anda süren söz elle seçim sayılmaz — iş alınır, gönderim anında 'Atlandı — Ödeme Sözü Var' (S23'ün söz karşılığı da F1)",
    "M318": "S-W21-2 A'nın tersi (B): elle iz kişinin BÜTÜN etiketlerini aşar — sonradan gelen başka etiket de aşılır, ileti elle değerlerle gider",
    "M319": "S-W21-2 A (b)'nin tersi: başlatmada Şüpheli + Söz birlikte 'Yine de Ekle' yalnız ilkini (Şüpheli) aşar — kişi 'Ödeme Sözü Var' ile elenir",
    "M320": "S-W21-2 A 'işaretlendiği andaki etiketler'in tersi: işteki Yine de Gönder basma anındaki iki etiketten yalnız ilkini (Şüpheli) aşar — gönderim anında 'Atlandı — Ödeme Sözü Var'",
    "M321": "S-W21-3 A'nın tersi (B): Meta Bekletti 2. denemesinden önce iz değişse de 2. deneme 1. denemenin donmuş içeriğiyle (şüpheli tutar dahil)",
    "M322": "S-W21-3 A 'elle iz değişmediyse 5.2 aynen'in tersi: iz değişmemişken de Meta Bekletti 2. denemesi içeriği yeniden hazırlar (M304 ile aynı etki)",
    "M323": "S-W21-1 A 'aynı kural bekleyen belirsizlik onaylı işte söz verilip asıl işte yeniden basılınca'nın tersi: S23'ün söz karşılığı yok — F1 'Zaten Kuyrukta', bekleyen iş gönderim anında Atlandı",
    "M324": "Y22-4 genel okumanın tersi: S23 yalnız tamamen işaretsiz işte — söz için elle seçilmiş bekleyen işe şüpheli açılıp asıl işte yeniden basılınca F1 'Zaten Kuyrukta'",
    "M325": "S-W21-1 A 'onay penceresinde Ödeme Sözü Var yazar'ın tersi: Yine de Gönder onayında söz etiketi görünmez",
}''')

# 4. KARARLAR SW21 (girdi c5c2-kararlar.md §1.1 AYNEN)
degis('''                       "9.2 KARARLI — Şirket 002'de de aynı kurallar (kural şirkete göre değişmez)."]},
    "K8": {''', '''                       "9.2 KARARLI — Şirket 002'de de aynı kurallar (kural şirkete göre değişmez)."]},
    # ---- kâhin güncellemesi 22 (2.5.1 Ç5-C; docs/devir/2.5.1-DEVAM/c5c2-kararlar.md §1.1 — AYNEN) ----
    "SW21": {"kaynak_turu": "kullanıcı (27.11.2026 17:01 UTC 'önerilerini uygula' = A — öneri; girdi c5c2-kararlar.md §1.1, iş listesi D + C aynen) — WK güncellemesi 21'in KULLANICIYA SORULMALI S-W21-1 / 2 / 3'ü (README §26.4, §26.7)",
             "metin": ["KULLANICI KARARI 27.11 17:01 UTC (AYNEN: \\"önerilerini uygula\\" — bekleyen altı sorunun yanıtı; hepsi A): S-W21-1 = A (Sonucu Belirsiz hatırlatmada \\"Yine de Gönder\\" anında Ödeme "
                       "Sözü sürüyorsa elle seçim sayılır, onay penceresinde \\"Ödeme Sözü Var\\" yazar, ileti gider); S-W21-2 = A (elle seçim — \\"Yine de Ekle\\" — yalnız işaretlendiği andaki etiketleri "
                       "aşar; kuyruktayken sonradan gelen etiketle \\"Atlandı\\"; başlatmada iki etiket birlikte varsa ikisini birlikte aşar); S-W21-3 = A (Meta'nın beklettiği iletinin 2. denemesinden "
                       "önce iş elle sayılmışsa S23 / S29 geçer — iletide şüpheli tutar yer almaz; örnekte 250 / 200 TL); …",
                       "soru (S-W21-1; KİME KAÇ KEZ — ders 45; UÇ DURUM): Sonucu Belirsiz hatırlatmada \\"Yine de Gönder\\" basıldığı anda carinin Ödeme Sözü sürüyor. A (ÖNERİ): elle seçim sayılır "
                       "(S16'daki şüpheli kuralı gibi), onay penceresinde \\"Ödeme Sözü Var\\" yazar, ileti gider (örnek 1.000 TL) — genel ilke (4) \\"çıkmaz yok\\" ile uyumlu. B: gönderim anında \\"Atlandı — "
                       "Ödeme Sözü Var\\"; o gün kişiye hiçbir yoldan gidemez (yeni gönderimi Sonucu Belirsiz eler, Yine de Ekle bunu aşmaz). C: uç durum böyle kalsın (BİLİNEN SINIR; B gibi).",
                       "soru (S-W21-2; KİME KAÇ KEZ — ders 45; UÇ DURUM): elle seçilen (\\"Yine de Ekle\\") kişiye, seçildiği anda OLMAYAN başka bir etiket kuyruktayken gelirse (örnek: söz için eklenen "
                       "kişiye sonra şüpheli kaydı açılıyor). A (ÖNERİ): elle seçim yalnız işaretlendiği andaki etiketleri aşar; sonradan gelen etiketle \\"Atlandı\\" (ileti gitmez); başlatmada iki "
                       "etiket birlikte varsa ikisini birlikte aşar. B: elle seçim bütün etiketleri aşar, ileti gider (örnek 700 TL). C: uç durum böyle kalsın (BİLİNEN SINIR; A gibi).",
                       "soru (S-W21-3; İLETİ İÇERİĞİ / TUTAR — ders 43; UÇ DURUM; iki onaylı karar çatışıyor): Meta'nın beklettiği iletinin 2. denemesinden ÖNCE iş elle sayılmışsa (şüpheli carinin "
                       "elle seçimi — S16 / S23): ilke taslağı 5.2 \\"2. deneme aynı içerikle\\" der, S23 / S29 kararları \\"gönderim anında şüphesiz tutarla\\" der. A (ÖNERİ): S23 / S29 geçer — örnekte "
                       "250 TL / 200 TL (şüpheli tutar iletiye girmez). B: 5.2 her durumda geçer — 650 TL / 400 TL (donmuş içerik şüpheli tutarı da yazar). C: uç durum böyle kalsın (BİLİNEN SINIR; A "
                       "gibi). Yaygın programlar: belgesi okunmadı.",
                       "girdi §4 (WhatsApp kâhini sınıfları, AYNEN): S-W21-1 (Sonucu Belirsiz + söz → Yine de Gönder gider, onayda \\"Ödeme Sözü Var\\"; içerik gönderim anındaki tutar); bekleyen "
                       "belirsizlik onaylı işte söz verilip asıl işte yeniden basılınca (S23'ün söz karşılığı); S-W21-2 (söz için eklenen kişiye kuyruktayken şüpheli → \\"Atlandı — Şüpheli Alacağı "
                       "Var\\"; şüpheli için eklenene sonra söz → \\"Atlandı — Ödeme Sözü Var\\"; başlatmada iki etiket birlikte → ikisi birlikte aşılır, gider); S-W21-3 (2. denemeden önce elle sayılan iş "
                       "→ 2. deneme gönderim anındaki şüphesiz tutarla; elle iz değişmediyse 5.2 aynen); her sınıfta \\"aynı gün en çok bir\\" ve \\"çıkmaz yok\\" değişmezleri; iki saat dilimi; gün dönümü."]},
    "K8": {''')

# 5. yine_de_gonder: S-W21-1 hatası kalkar; S16 / S23 basma anındaki etiketlere genellenir (Y22-1 … Y22-4)
degis('''            hat = tp.sablon == "hatirlatma"
            if hat and "borc" in c and SOZ in self.c5c_etiketler(c, t) and SOZ not in self.c5c_kapsam(j) and "M293" not in self.mut:
                raise ValueError("KULLANICIYA SORULMALI S-W21-1 (README §26.4): işteki Yine de Gönder basıldığı anda Ödeme Sözü sürüyor (iş elle değil) — kodlanmadı")
            # S16 (Y13-1): basma ANINDA şüpheli kaydı açık Ödeme Hatırlatma carisi (M208: kapanmış kalem de açık sayılır)
            acik = hat and (self.supheli_acik(c) or ("M208" in self.mut and any(v.get("supheli") for v in c.get("vadeler", []))))
            # S23 (eski S7-e, README §20 Y15-1): belirsizlik onayıyla gönderim anından ÖNCE bekleyen, elle işaretsiz işte kayıt AÇIKKEN asıl işte yeniden basma → bekleyen iş S16
            # ile elle sayılır, yeni iş açılmaz, F1 "Zaten Kuyrukta" uygulanmaz (Y15-2…4); Hazırlanıyor / Gönderiliyor ve elle işaretli iş F1 aynen (aşağıdaki yol)
            s23 = (acik and j.durum in S23_BEKLEYEN and getattr(j, "belirsiz_onay", False) and not getattr(j, "supheli_elle", False)
                   and "M199" not in self.mut)
            if (acik or ("M209" in self.mut and not hat and self.supheli_acik(c))) and "M201" not in self.mut:
                sonuc["supheli_etiketi"].append(j.cari)                    # Y13-4: onay penceresinde "Şüpheli Alacağı Var" (yanıttan önce — elense de görünür)''',
      '''            hat = tp.sablon == "hatirlatma"
            # S16 (Y13-1): basma ANINDA şüpheli kaydı açık Ödeme Hatırlatma carisi (M208: kapanmış kalem de açık sayılır)
            acik = hat and (self.supheli_acik(c) or ("M208" in self.mut and any(v.get("supheli") for v in c.get("vadeler", []))))
            # S-W21-1 = A (KULLANICI KARARI 27.11.2026 17:01 UTC; README §27 Y22-1…3): basma ANINDA Ödeme Sözü süren (`borc` girdisi) Ödeme Hatırlatma carisi → S16 gibi ELLE seçim
            # (güncelleme 21'in S-W21-1 hatası KALKTI); onay penceresinde "Ödeme Sözü Var" (`soz_etiketi`). M317: B seçeneği (söz basma etiketi sayılmaz — gönderim anında Atlandı)
            soz = hat and "borc" in c and SOZ in self.c5c_etiketler(c, t) and "M317" not in self.mut
            # Y22-2 (S-W21-2 = A "işaretlendiği andaki etiketler"): iz basma anındaki BÜTÜN Şüpheli / Söz etiketlerini aşar (M320: yalnız ilkini)
            basma = [x for x in ETIKET_SIRASI if (x == SUPHELI and acik and "M199" not in self.mut) or (x == SOZ and soz)]
            if "M320" in self.mut:
                basma = basma[:1]
            # S23 (eski S7-e, README §20 Y15-1): belirsizlik onayıyla gönderim anından ÖNCE bekleyen işte kayıt AÇIKKEN asıl işte yeniden basma → bekleyen iş S16 ile elle sayılır,
            # yeni iş açılmaz, F1 "Zaten Kuyrukta" uygulanmaz (Y15-2…4); Hazırlanıyor / Gönderiliyor iş F1 aynen. Güncelleme 22 (Y22-4): söz karşılığı (S-W21-1 A "aynı kural … asıl işte
            # yeniden basılınca") ve tetik "iz basma anındaki etiketlerden en az birini aşmıyor" (tek etiketli eski yolda "elle işaretsiz" ile aynı); iz hepsini aşıyorsa F1 aynen
            s23_et = [x for x in basma if not (x == SOZ and "M323" in self.mut)]
            s23 = (bool(set(s23_et) - self.c5c_kapsam(j)) and j.durum in S23_BEKLEYEN and getattr(j, "belirsiz_onay", False)
                   and not ("M324" in self.mut and getattr(j, "supheli_elle", False)))
            if (acik or ("M209" in self.mut and not hat and self.supheli_acik(c))) and "M201" not in self.mut:
                sonuc["supheli_etiketi"].append(j.cari)                    # Y13-4: onay penceresinde "Şüpheli Alacağı Var" (yanıttan önce — elense de görünür)
            if soz and "M325" not in self.mut:
                sonuc.setdefault("soz_etiketi", []).append(j.cari)         # Y22-3: onay penceresinde "Ödeme Sözü Var" (yalnız boş değilse çıktıda — eski çıktılar değişmez)''')

degis('''            if s23:
                self.s23_yeniden_bas(j, tp, c, t, sonuc)''', '''            if s23:
                self.s23_yeniden_bas(j, tp, c, t, sonuc, basma)''')

degis('''            s16 = (acik and "M199" not in self.mut                          # S16: Yine de Gönder elle seçim sayılır (M199: B seçeneği)
                   and not ("M212" in self.mut and j.durum == ATLANDI and j.elendi_neden == SUPHELI))   # M212: S22 yolunda (Y14-4) yeniden basmada S16 yok''',
      '''            s16 = ((acik and "M199" not in self.mut                         # S16: Yine de Gönder elle seçim sayılır (M199: B seçeneği)
                    and not ("M212" in self.mut and j.durum == ATLANDI and j.elendi_neden == SUPHELI))   # M212: S22 yolunda (Y14-4) yeniden basmada S16 yok
                   or soz)                                                  # S-W21-1 = A (Y22-2): süren söz de
            if "M212" in self.mut and j.durum == ATLANDI and j.elendi_neden == SUPHELI:
                basma = [x for x in basma if x != SUPHELI]''')

degis('''                if s16:
                    k_ = self.c5c_kapsam(j)
                    j.supheli_elle = True                                       # S16 (Y13-2): elle seçim sayılır — işte kalır (Y12-7 / Y12-8)
                    j.elle_kapsam = k_ | {SUPHELI}                              # C5C 6.2: iz Şüpheli'yi aşar''',
      '''                if s16:
                    k_ = self.c5c_kapsam(j)
                    j.supheli_elle = True                                       # S16 (Y13-2): elle seçim sayılır — işte kalır (Y12-7 / Y12-8)
                    j.elle_kapsam = k_ | set(basma)                             # C5C 6.2 + S-W21-1 / S-W21-2 A (Y22-2): iz basma anındaki etiketleri aşar''')

degis('''    def s23_yeniden_bas(self, j, tp, c, t, sonuc):''', '''    def s23_yeniden_bas(self, j, tp, c, t, sonuc, basma=(SUPHELI,)):''')
degis('''        k_ = self.c5c_kapsam(j)
        j.supheli_elle = True                                              # S23 + S29: bekleyen iş elle sayılır (basmada tutar olsun olmasın)
        j.elle_kapsam = k_ | {SUPHELI}                                     # C5C 6.2: iz Şüpheli'yi aşar''',
      '''        k_ = self.c5c_kapsam(j)
        j.supheli_elle = True                                              # S23 + S29: bekleyen iş elle sayılır (basmada tutar olsun olmasın)
        j.elle_kapsam = k_ | set(basma)                                    # C5C 6.2 + Y22-4: iz basma anındaki etiketleri aşar (söz karşılığı — S-W21-1 A)''')

# 6. c5c_kapsam: M318
degis('''        if not getattr(j, "supheli_elle", False):
            return set()
        k = getattr(j, "elle_kapsam", None)''', '''        if not getattr(j, "supheli_elle", False):
            return set()
        if "M318" in self.mut:
            return set(ELLE_ETIKET)                                       # M318 (S-W21-2 A'nın tersi): elle iz bütün etiketleri aşar
        k = getattr(j, "elle_kapsam", None)''')

# 7. c5c_baslat_engeli: S-W21-2 (b) hatası kalkar
degis('''            if len(acik) > 1:
                raise ValueError("KULLANICIYA SORULMALI S-W21-2 (b) (README §26.4): başlatmada Şüpheli + Söz birlikte; 'Yine de Ekle' iki etiketi de aşar mı — kodlanmadı")
            kapsam = set(acik)''', '''            if len(acik) > 1 and "M319" in self.mut:
                return acik[1], set()                                      # M319 (S-W21-2 A (b)'nin tersi): yalnız ilki aşılır — kişi öbür etiketle elenir
            kapsam = set(acik)                                            # S-W21-2 = A (b) (README §27 Y22-7): başlatmada birlikte olan etiketler birlikte aşılır''')

# 8. c5c_gonderim_engeli: S-W21-2 hatası kalkar
degis('''        if yeni:
            if kapsam and not ("M293" in self.mut and not self.c5c_kapsam(j)):
                raise ValueError("KULLANICIYA SORULMALI S-W21-2 (README §26.4): elle seçilen kişiye elle seçildiği anda olmayan etiket geldi ("
                                 + ", ".join(yeni) + ") — kodlanmadı")
            return yeni[0]                                                # 5.3 (S-C5C-5 A) / 5.4 (S7-b, S22): "Atlandı — Ödeme Sözü Var / Şüpheli Alacağı Var"''',
      '''        if yeni:
            # 5.3 (S-C5C-5 A) / 5.4 (S7-b, S22) + S-W21-2 = A (README §27 Y22-5): iz kapsamı dışındaki ilk etiket — elle işte de — "Atlandı — Şüpheli Alacağı Var / Ödeme Sözü Var"
            return yeni[0]''')
degis('''        Tedarikçi → Şüpheli (elle izi yoksa) → Söz (elle izi yoksa) → Gecikmiş Borç Yok (o anki girdi; elle izliyse elle değerler). İz kapsamı dışında yeni etiket elle işte → S-W21-2."""''',
      '''        Tedarikçi → Şüpheli (elle izi yoksa) → Söz (elle izi yoksa) → Gecikmiş Borç Yok (o anki girdi; elle izliyse elle değerler). İz kapsamı dışında yeni etiket elle işte de "Atlandı"
        (S-W21-2 = A, güncelleme 22 — README §27 Y22-5)."""''')

# 9. isci: mb_elle tek okumaya
degis('''                        # C5C 5.2: Meta Bekletti'nin 2. denemesi 1. denemenin içeriğiyle (o an hazırlanan içerik donar). İki deneme arasında iş ELLE sayıldıysa (S16 / S23) 5.2 ↔ S23 / S29
                        # çelişir → S-W21-3 (kodlanmadı): iki okuma birlikte (`mb_elle`), ayrışan içerik `secenek`
                        if frozenset(self.c5c_kapsam(j)) != getattr(j, "icerik_kapsam", frozenset()):
                            self.okuma_izi.add("mb_elle")
                            if self.okuma.get("mb_elle", OKUMALAR["mb_elle"][0]) == "gonderim_ani":
                                j.icerik = self.icerik(c, tp, t, j); j.icerik_kapsam = frozenset(self.c5c_kapsam(j))''',
      '''                        # C5C 5.2: Meta Bekletti'nin 2. denemesi 1. denemenin içeriğiyle (o an hazırlanan içerik donar). S-W21-3 = A (KULLANICI KARARI 27.11.2026 17:01 UTC; README §27
                        # Y22-8): iki deneme arasında iz değiştiyse (S16 / S23 / S-W21-1 — iş elle sayıldı) S23 / S29 geçer: gönderim anında şüphesiz / elle tutarla yeniden hazırlanır;
                        # iz aynıysa 5.2 aynen (güncelleme 21'in `mb_elle` iki okuması KALKTI). M321: B (donmuş içerik); M322: iz aynıyken de yeniden
                        degisti = frozenset(self.c5c_kapsam(j)) != getattr(j, "icerik_kapsam", frozenset())
                        if (degisti and "M321" not in self.mut) or (not degisti and "M322" in self.mut):
                            j.icerik = self.icerik(c, tp, t, j); j.icerik_kapsam = frozenset(self.c5c_kapsam(j))''')

# 10. OKUMA_SUSUYOR
degis('''    MB_ELLE_SUSUYOR = ("KULLANICIYA SORULMALI S-W21-3 (README §26.4): Meta Bekletti'nin 2. denemesinden önce elle sayılan (S16 / S23) Ödeme Hatırlatma işinin içeriği — taslak 5.2 "''',
      '''    # güncelleme 21'in MB_ELLE_SUSUYOR'u (mb_elle) güncelleme 22'de KALKTI — S-W21-3 = A (README §27 Y22-8)
    _MB_ELLE_ESKI = ("KULLANICIYA SORULMALI S-W21-3 (README §26.4): Meta Bekletti'nin 2. denemesinden önce elle sayılan (S16 / S23) Ödeme Hatırlatma işinin içeriği — taslak 5.2 "''')
degis('''    OKUMA_SUSUYOR = {"devam_sd": DEVAM_SD_SUSUYOR, "devir_geri": DEVIR_GERI_SUSUYOR, "mb_elle": MB_ELLE_SUSUYOR}''',
      '''    OKUMA_SUSUYOR = {"devam_sd": DEVAM_SD_SUSUYOR, "devir_geri": DEVIR_GERI_SUSUYOR}''')

# 11. çıktı: soz_etiketi
degis('''                                    **({"supheli_etiketi": v["supheli_etiketi"]} if v.get("supheli_etiketi") else {}),   # Y13-4: yalnız boş değilse (eski çıktılar değişmez)''',
      '''                                    **({"supheli_etiketi": v["supheli_etiketi"]} if v.get("supheli_etiketi") else {}),   # Y13-4: yalnız boş değilse (eski çıktılar değişmez)
                                    **({"soz_etiketi": v["soz_etiketi"]} if v.get("soz_etiketi") else {}),               # Y22-3 (S-W21-1 A): yalnız boş değilse''')

open(yol, "w", encoding="utf-8").write(s)
print("tamam")
