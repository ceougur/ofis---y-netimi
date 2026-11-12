"""Madde 3 — S129 testlerinde PDF / Excel / rapor okuma biçimleri (pdfText satır satır metin; rapor hücresi '500,00 TL'; Excel hücresi sayı)."""


def edit(path, pairs):
    s = open(path, encoding="utf-8").read()
    for old, new in pairs:
        assert s.count(old) == 1, (path, old[:90], s.count(old))
        s = s.replace(old, new)
    open(path, "w", encoding="utf-8").write(s)


edit("test/tyk-kapanis-250.test.mjs", [
    ("""  const moneyText = value => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
""", """  const tlText = value => `${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} TL`;
  // Rapor hücresi "500,00 TL" → 500 (boş hücre 0).
  const num = cell => Number(String(cell ?? "").replace(/[^\\d,-]/g, "").replace(",", ".")) || 0;
"""),
    ("""    assert.match(ekstre, new RegExp(`Tahsil edilen[\\\\s\\\\S]*${moneyText(500)}`), "taksit ekstresi: Tahsil edilen 500,00");
    assert.ok(ekstre.includes(moneyText(400)) && !ekstre.includes(moneyText(900) + " TL\\n" + moneyText(0)), "taksit ekstresi: Kalan 400,00");
    const xlsx = xlsxRows(await raw("/api/workspace/accounts/export.xlsx?status=all"));
    const head = xlsx[0];
    const line = xlsx.find(cells => cells[head.indexOf("Ad / Unvan")] === acc.name);
    assert.equal(String(line[head.indexOf("Taksitten Kalan")]).replace(/\\./g, "").replace(",", "."), "400.00", "Cari Listesi Excel: Taksitten Kalan");
    const kartlar = await report("taksit-kartlari", "planStatus=all");
    const kHead = kartlar.headers;
    const kRow = kartlar.rows.find(cells => cells[kHead.indexOf("Ad")] === acc.name);
    assert.deepEqual([kRow[kHead.indexOf("Ödenen")], kRow[kHead.indexOf("Kalan")]].map(cell => (typeof cell === "object" ? cell.value ?? cell.text : cell)).map(Number), [500, 400], "Rapor Merkezi Taksit Kartları");""",
     """    assert.ok(ekstre.includes(`Toplam tutar\\n${tlText(900)}\\nTahsil edilen\\n${tlText(500)}\\nKalan\\n${tlText(400)}`), `taksit ekstresi göstergeleri: ${ekstre.slice(0, 300)}`);
    assert.ok(ekstre.includes(`${tlText(300)}\\n${tlText(200)}\\n${tlText(100)}`), "taksit ekstresi 2. taksit: Tutar 300 / Ödenen 200 / Kalan 100");
    assert.ok(ekstre.includes(`Toplam\\n${tlText(900)}\\n${tlText(500)}\\n${tlText(400)}`), "taksit ekstresi tablo toplamı");
    const liste = pdfText(await raw("/api/workspace/plans/liste.pdf?status=all"));
    assert.ok(liste.includes(`${acc.name}\\n`) && liste.includes(`${tlText(900)}\\n${tlText(500)}\\n${tlText(400)}`), "Taksit Listesi PDF satırı: Toplam 900 / Ödenen 500 / Kalan 400");
    const xlsx = xlsxRows(await raw("/api/workspace/accounts/export.xlsx?status=all"));
    const head = xlsx[0];
    const line = xlsx.find(cells => cells[head.indexOf("Ad / Unvan")] === acc.name);
    assert.equal(line[head.indexOf("Taksitten Kalan")], 400, "Cari Listesi Excel: Taksitten Kalan");
    const cariPdf = pdfText(await raw(`/api/workspace/accounts/${acc.id}/ekstre.pdf`));
    assert.ok(cariPdf.includes(`Taksitlerden Kalan (bakiyeye dahil)\\n${tlText(400)}`), "cari ekstresi özeti: Taksitlerden Kalan 400");
    const kartlar = await report("taksit-kartlari", "planStatus=all");
    const kHead = kartlar.headers;
    const kRow = kartlar.rows.find(cells => cells[kHead.indexOf("Ad")] === acc.name);
    assert.deepEqual([num(kRow[kHead.indexOf("Toplam")]), num(kRow[kHead.indexOf("Ödenen")]), num(kRow[kHead.indexOf("Kalan")])], [900, 500, 400], "Rapor Merkezi Taksit Kartları");"""),
    ("""    assert.match(makbuz, new RegExp(`Tahsil edilen\\\\s*${moneyText(500)}`), "makbuz: Tahsil edilen 500,00");
    assert.match(makbuz, new RegExp(`Kalan borç\\\\s*${moneyText(400)}`), "makbuz: Kalan borç 400,00");""",
     """    assert.ok(makbuz.includes(`Toplam borç\\n${tlText(900)}\\nTahsil edilen\\n${tlText(500)}\\nKalan borç\\n${tlText(400)}`), `makbuz: ${makbuz.slice(0, 400)}`);"""),
    ("""    const cell = value => Number(typeof value === "object" ? value.value ?? value.text : value);
    const rows = vade.rows.filter(cells => cells[vHead.indexOf("Ad")] === acc.name).map(cells => [cells[vHead.indexOf("Taksit")], cell(cells[vHead.indexOf("Ödenen")]), cell(cells[vHead.indexOf("Kalan")])]);
    assert.deepEqual(rows, [["1. taksit", 300, 0], ["2. taksit", 200, 100], ["3. taksit", 0, 300]]);""",
     """    const rows = vade.rows.filter(cells => cells[vHead.indexOf("Ad")] === acc.name).map(cells => [cells[vHead.indexOf("Taksit")], num(cells[vHead.indexOf("Ödenen")]), num(cells[vHead.indexOf("Kalan")]), cells[vHead.indexOf("Durum")]]);
    assert.deepEqual(rows, [["1. taksit", 300, 0, "Ödendi"], ["2. taksit", 200, 100, "Kısmen ödendi"], ["3. taksit", 0, 300, "Açık"]]);
    // Aylık performans: bu carinin taksit ayları (bu sunucuda başka kartlar da var — yalnız toplamın tutarlılığı: Ödenen + Kalan = Vadesi Gelen).
    const perf = await report("taksit-performans", `from=${day(-60)}&to=${day(120)}`);
    const pHead = perf.headers;
    for (const cells of perf.rows) assert.equal(r2(num(cells[pHead.indexOf("Ödenen")]) + num(cells[pHead.indexOf("Kalan")])), num(cells[pHead.indexOf("Vadesi Gelen")]), `performans ${cells[0]}: Ödenen + Kalan = Vadesi Gelen`);"""),
])
print("tamam")
