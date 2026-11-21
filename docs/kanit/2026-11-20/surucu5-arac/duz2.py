import sys
p = sys.argv[1]
t = open(p, encoding='utf-8').read()


def rep(old, new, cnt=1):
    global t
    n = t.count(old)
    assert n == cnt, (old[:80], n)
    t = t.replace(old, new)


# (a) Kartı Kapat: kâhinin `eski: true` kartı göç 53'ün işaretiyle
rep('''      // H-07 Kartı Kapat: kart düzenleme formunun Durum = Kapalı (PUT /plans/:id status closed; kapanış günü = programın bugünü = olay günü).
      // `eski: true` (kâhin bakımı 2 R6: 2.5.0'dan önce kapatılmış kart, göç verisi) programda AYNI yol — bugünkü kural (kalan 689) iki dalda da.
      const pid = ids.taksit[v.kart];
      if (!pid) return apiYok(`kapatılacak kart ${v.kart} programda yok`);
      return sonuc(o, await api("PUT", `/api/workspace/plans/${pid}`, { status: "closed" }), { yol: `Kartı Kapat${v.eski ? " (kâhin: 2.5.0'dan önce kapatılmış kart)" : ""}` });''',
    '''      // H-07 Kartı Kapat: kart düzenleme formunun Durum = Kapalı (PUT /plans/:id status closed; kapanış günü = programın bugünü = olay günü).
      // SÜRÜCÜ BAKIMI 5 (Ç7b tur 3b — karar (6) 'Borçta Kalsın', S205 / S220 = A; kâhin README R6 / bakım 14 İ8): yeni Kartı Kapat kalanı carinin borcunda bırakır. Kâhinin
      // `eski: true` kartı (2.5.0'dan önce — v2.4.9'da — kapatılmış kart, göç verisi; 689 ile düşülmüş kalan) programda GÖÇ 53'ün işaretiyle kurulur: kart aynı yolla kapatılır,
      // kartın kapanış kuralı işareti göçün yazdığı '2.4.9' olur (göç 53: "UPDATE plans SET close_rule = '2.4.9' WHERE status = 'closed'" — v2.4.9'da kapalı her kart).
      // Programın kendi testleri de eski kartı böyle kurar (test/inceleme-226, test/kapali-kart-ekstre-tarihi-250). Olay eski sürüm aşamasında koşuyorsa (server.eski) v2.4.9
      // kartı kendi kuralıyla kapatır, göç işaretler — ek yazım yok. Önceki sürücü `eski`yi güncel Kartı Kapat'a eşliyordu (c7b3b raporu C (b): s60 TK2).
      const pid = ids.taksit[v.kart];
      if (!pid) return apiYok(`kapatılacak kart ${v.kart} programda yok`);
      const r = await api("PUT", `/api/workspace/plans/${pid}`, { status: "closed" });
      let isaret = "";
      if (r.ok && v.eski && !server.eski) {
        const st = server.app?.store;
        if (!st) return { ...sonuc(o, r), durum: "surucu_hatasi", neden: "eski kart: göç işareti yazılamadı (store yok)" };
        st.run("UPDATE plans SET close_rule = '2.4.9' WHERE id = ? AND status = 'closed'", pid);
        isaret = st.get("SELECT close_rule AS k FROM plans WHERE id = ?", pid)?.k || "";
      }
      return sonuc(o, r, { yol: `Kartı Kapat${v.eski ? (server.eski ? ` (kâhin: 2.5.0'dan önce kapatılmış kart — ${server.eski}'da kapatıldı, göç 53 işaretler)` : ` (kâhin: 2.5.0'dan önce kapatılmış kart — göç 53 işareti '${isaret}')`) : " (Borçta Kalsın)"}` });''')

# (b) Excel kartı: bu yüklemenin açtığı kart + programın eşlediği cari
rep('''      const r = await api("POST", "/api/workspace/plans/import", { matrix, headerAt: 0, roles: { 0: "name", 1: "phone", 2: "total", 3: "count", 4: "firstDue", 5: "paid", 6: "registered" }, fileName: `${v.id}.xlsx`, linkRecords: false });
      if (r.ok) {
        const pl = await api("GET", `/api/workspace/plans?status=all&limit=500`);
        const bul = (pl.data?.plans || []).filter(x => x.name === ad).at(-1);
        if (bul) ids.taksit[v.id] = bul.id;
        const bagli = bul ? (await api("GET", `/api/workspace/plans/${bul.id}`)).data : null;
        const hesap = bagli?.accountId || bagli?.plan?.accountId || "";
        return sonuc(o, r, { not: !bul ? "kart bulunamadı" : hesap === ids.cari[v.cari] ? "kart kâhinin carisine bağlı" : hesap ? `kart BAŞKA cariye bağlı (${hesap})` : "kart CARİSİZ", rapor: r.data });
      }
      return sonuc(o, r);''',
    '''      // SÜRÜCÜ BAKIMI 5 (Ç7b taksit küçük turu, S219 / S221 / S222 = A; kâhin bakımı 14 "Sürücü için" A6): kart, yüklemeden ÖNCEKİ kart listesinde olmayan ve bu satırın adını
      // taşıyan karttır (önceki sürücü adla `.at(-1)` alıyordu — aynı adlı iki kişide ötekinin kartını bulabilirdi). Programın kartı bağladığı cari kâhin anahtarına çevrilir
      // (`esle_cari`; karşılaştırıcı kâhine bu cariyle verir). Program satırı atladıysa (created 0) olay "atlandi" — kâhine uygulanmaz, nedeni kayıtta.
      const once = new Set(((await api("GET", `/api/workspace/plans?status=all&limit=500`)).data?.plans || []).map(x => x.id));
      const r = await api("POST", "/api/workspace/plans/import", { matrix, headerAt: 0, roles: { 0: "name", 1: "phone", 2: "total", 3: "count", 4: "firstDue", 5: "paid", 6: "registered" }, fileName: `${v.id}.xlsx`, linkRecords: false });
      if (r.ok) {
        const pl = await api("GET", `/api/workspace/plans?status=all&limit=500`);
        const yeni = (pl.data?.plans || []).filter(x => !once.has(x.id) && x.name === ad);
        const bul = yeni.length === 1 ? yeni[0] : null;
        if (!yeni.length) return { ...sonuc(o, r), durum: "atlandi", neden: `program satırı atladı: ${JSON.stringify(r.data?.skipped || r.data?.summary || r.data || {}).slice(0, 300)}`, rapor: r.data };
        if (!bul) return { ...sonuc(o, r), durum: "surucu_hatasi", neden: `yükleme ${yeni.length} kart açtı (tek satır)`, rapor: r.data };
        ids.taksit[v.id] = bul.id;
        const bagli = (await api("GET", `/api/workspace/plans/${bul.id}`)).data;
        const hesap = bagli?.accountId || bagli?.plan?.accountId || "";
        const esle = Object.entries(ids.cari).find(([, id]) => id && id === hesap)?.[0] || "";
        if (esle) excelCari[v.id] = esle;
        return sonuc(o, r, { not: hesap === ids.cari[v.cari] ? "kart kâhinin carisine bağlı" : esle ? `kart BAŞKA cariye bağlı (${esle})` : hesap ? `kart kâhinde OLMAYAN cariye bağlı (${hesap})` : "kart CARİSİZ", ...(esle ? { esle_cari: esle } : {}), rapor: r.data });
      }
      return sonuc(o, r);''')
rep('''const oncedenAcilis = {}; // cari_acilis olay no → cariyi açan olay no''',
    '''const oncedenAcilis = {}; // cari_acilis olay no → cariyi açan olay no
const excelCari = {}; // SÜRÜCÜ BAKIMI 5: Excel kartı (kâhin kimliği) → programın kartı bağladığı cari (kâhin anahtarı)''')
# (c) kartlar raporu: Excel kartı programın eşlediği cariyle
rep('''      if (!tanim || tanim.cari !== o.cari) continue;''',
    '''      if (!tanim || (excelCari[k] || tanim.cari) !== o.cari) continue;   // SÜRÜCÜ BAKIMI 5: Excel kartı programın eşlediği cariyle''')
open(p, 'w', encoding='utf-8').write(t)
print("tamam")
