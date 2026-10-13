// İz 1.1 (2.2.0 iş listesi; 2.0.17 m2 kararı "rapor/PDF/Excel başlığında 001 · Unvan"): Rapor Merkezi'nin Excel çıktısında şirket kodu
// ve unvanı yoktu (PDF'te yalnız unvan vardı). Excel'in ilk sayfasının başında başlık bloğu: "001 · Unvan", rapor adı, kapsam, oluşturma ve
// hazırlayan (PDF'in başlığındaki bilgiler); PDF'in başlığı da aynı "001 · Unvan". Tablo (kolon başlıkları, satırlar, TOPLAM, süzgeç,
// dondurulmuş başlık) bloğun altında, satırları ekranla birebir aynı.
//
// NASIL BOZARIM (testler bu listeden):
//   1. Tek şirkette Excel'in başında şirket yok / yalnız ad var, kod yok.
//   2. İki şirket: 002'den alınan Excel 001'in adını taşır (şirket karışması); 001'in Excel'i 002'yi taşır.
//   3. Pencerenin şirketi (?hofCompany=) kullanıcının sunucudaki seçiminden farklı: başlık seçimden gelir (yanlış şirket).
//   4. Şirketin adı değişince Excel eski adı yazar.
//   5. Unvanda XML/formül karakterleri (&, <, ", =): dosya bozulur ya da unvan formül olur.
//   6. Başlık bloğu tabloyu bozar: kolon başlığı satırı kayar, süzgeç (autoFilter) bloğu ya da TOPLAM'ı kapsar, dondurulmuş satır
//      başlığın üstünde kalır, satırlar ekrandakinden farklı okunur.
//   7. Boş raporda (0 satır) blok ya da başlık eksik; süzgeç boş tabloya kurulur.
//   8. Özet sayfasında şirket yok.
//   9. PDF ile Excel farklı şirket bilgisi taşır.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";
import { pdfText, xlsxSheets } from "./banka-210-ortak.mjs";
import { readZip } from "../server/lib/zip.mjs";

const unwrap = response => (response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data);
const sheetXml = (buffer, index = 1) => readZip(buffer).find(entry => entry.name === `xl/worksheets/sheet${index}.xml`)?.data.toString("utf8") || "";
const pad = value => String(value).padStart(2, "0");
const iso = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const TODAY = iso(new Date());
const RC = "/api/workspace/report-center";

describe("İz 1.1 — Rapor Merkezi Excel'inde şirket kodu ve unvanı (PDF ile aynı)", () => {
  let server;
  let admin;
  let first;
  let second;
  const NAME_1 = "Merkez Ticaret Ltd. Şti.";
  const NAME_2 = 'Şube & <Deneme> "Ltd" =1+1';
  const withCompany = (url, company) => `${url}${url.includes("?") ? "&" : "?"}hofCompany=${encodeURIComponent(company.id)}`;
  const get = async (url, company) => unwrap(await admin.get(withCompany(url, company)));
  const post = async (url, body, company) => {
    const response = await admin.post(withCompany(url, company), body);
    assert.equal(response.status, 200, `${url}: ${JSON.stringify(response.data)}`);
    return unwrap(response);
  };
  const file = async (id, suffix, company, query = "preset=all") => {
    const response = await admin.raw("GET", withCompany(`${RC}/${id}/${suffix}?${query}`, company));
    assert.equal(response.status, 200, `${id}/${suffix}: ${response.status}`);
    return response.buffer;
  };

  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    const list = unwrap(await admin.get("/api/companies"));
    first = list.companies.find(item => item.code === "001");
    assert.ok(first, "001 var");
    assert.equal((await admin.put(`/api/companies/${first.id}`, { name: NAME_1 })).status, 200, "001'in unvanı");
    const created = await admin.post("/api/companies", { code: "002", name: NAME_2 });
    assert.equal(created.status, 200, JSON.stringify(created.data));
    second = unwrap(created).company;
    // 001: üç Kasa hareketi; 002: bir Kasa hareketi (raporlar dolu, iki şirketin sayıları farklı).
    await post("/api/workspace/cash", { kind: "in", amount: "1.000", date: TODAY, description: "Elle giriş bir" }, first);
    await post("/api/workspace/cash", { kind: "in", amount: "250,50", date: TODAY, description: "Elle giriş iki" }, first);
    await post("/api/workspace/cash", { kind: "out", amount: "100", date: TODAY, description: "Kira" }, first);
    await post("/api/workspace/cash", { kind: "in", amount: "7.777", date: TODAY, description: "Şube girişi" }, second);
  });
  after(() => server?.close());

  it("1, 6, 9: 001'in Excel'i başta '001 · Unvan' + rapor adı + kapsam; tablo ekranla birebir; süzgeç ve dondurma başlık satırında; PDF aynı şirket", async () => {
    const screen = await get(`${RC}/kasa-hareketleri?preset=all`, first);
    assert.equal(screen.rows.length, 4, "ekranda Devir satırı + üç Kasa hareketi");
    const buffer = await file("kasa-hareketleri", "xlsx", first);
    const sheets = xlsxSheets(buffer);
    const rows = Object.values(sheets)[0];
    assert.equal(rows[0][0], `001 · ${NAME_1}`, "Excel'in ilk satırı şirket kodu ve unvanı");
    assert.equal(rows[1][0], screen.title, "ikinci satır rapor adı");
    assert.ok(rows.slice(0, 4).some(row => String(row[0]).startsWith("Oluşturma: ")), "oluşturma damgası başlık bloğunda");
    const headerAt = rows.findIndex(row => row.join("|") === screen.headers.join("|"));
    assert.ok(headerAt > 0, `kolon başlıkları başlık bloğunun altında (satır ${headerAt + 1})`);
    const body = rows.slice(headerAt + 1);
    assert.equal(body.length, screen.rows.length + (screen.footer ? 1 : 0), "başlık + satırlar + TOPLAM");
    const money = cell => (typeof cell === "number" ? Math.round(cell * 100) : /TL$/.test(String(cell)) ? Math.round(Number(String(cell).replace(/ TL$/, "").replace(/\./g, "").replace(",", ".").replace("−", "-")) * 100) : String(cell));
    // Tutar hücreleri sayıya, tarih hücreleri Excel tarihine çevrilir (xlsx-write); tutar ve metin hücreleri birebir karşılaştırılır.
    screen.rows.forEach((row, r) => row.forEach((cell, c) => {
      if (/TL$/.test(String(cell)) || typeof body[r][c] === "string") assert.equal(money(body[r][c] ?? ""), money(cell), `satır ${r + 1} kolon ${screen.headers[c]}`);
    }));
    if (screen.footer) assert.equal(body.at(-1).find(cell => cell === "TOPLAM"), "TOPLAM", "TOPLAM en altta");
    // Excel'in süzgeci kolon başlığı satırından son veri satırına; TOPLAM ve başlık bloğu dışarıda; başlık satırı dondurulmuş.
    const xml = sheetXml(buffer);
    const headerRowNo = Number(/<row r="(\d+)">(?:(?!<\/row>)[\s\S])*?Tarih/.exec(xml)?.[1]);
    assert.ok(headerRowNo > 1, `kolon başlığı satırı ${headerRowNo}`);
    const filter = /<autoFilter ref="A(\d+):[A-Z]+(\d+)"\/>/.exec(xml);
    assert.ok(filter, "süzgeç var");
    assert.equal(Number(filter[1]), headerRowNo, "süzgeç kolon başlığı satırında başlar");
    assert.equal(Number(filter[2]), headerRowNo + screen.rows.length, "süzgeç son veri satırında biter (TOPLAM dışarıda)");
    const pane = /<pane ySplit="(\d+)" topLeftCell="A(\d+)"/.exec(xml);
    assert.equal(Number(pane?.[1]), headerRowNo, "dondurulan satırlar: başlık bloğu + kolon başlığı");
    assert.equal(Number(pane?.[2]), headerRowNo + 1);
    const workbook = readZip(buffer).find(entry => entry.name === "xl/workbook.xml").data.toString("utf8");
    assert.match(workbook, new RegExp(`_FilterDatabase[^>]*>[^<]*\\$A\\$${headerRowNo}:\\$[A-Z]+\\$${headerRowNo + screen.rows.length}<`), "Excel'in süzgeç tanımı aynı aralık");
    const text = pdfText(await file("kasa-hareketleri", "pdf", first)).replace(/\s+/g, " ");
    assert.ok(text.includes(`001 · ${NAME_1}`), "PDF'in başlığında aynı '001 · Unvan'");
  });

  it("2, 5: 002'nin Excel'i ve PDF'i '002 · Unvan' (özel karakterler metin olarak, formül değil); 001'in adı geçmez", async () => {
    const buffer = await file("kasa-hareketleri", "xlsx", second);
    const rows = Object.values(xlsxSheets(buffer))[0];
    assert.equal(rows[0][0], `002 · ${NAME_2}`, "002'nin başlığı (XML karakterleri bozulmadan)");
    assert.ok(!JSON.stringify(rows).includes(NAME_1), "002'nin Excel'inde 001'in unvanı yok");
    const xml = sheetXml(buffer);
    assert.ok(!/<f>/.test(xml), "unvan formül olarak yazılmaz");
    assert.ok(xml.includes("&amp;") && xml.includes("&lt;Deneme&gt;"), "XML kaçışı");
    const screen = await get(`${RC}/kasa-hareketleri?preset=all`, second);
    assert.equal(screen.rows.length, 2, "002'de Devir + tek hareket");
    const own = Object.values(xlsxSheets(await file("kasa-hareketleri", "xlsx", first)))[0];
    assert.ok(!JSON.stringify(own).includes("Şube"), "001'in Excel'inde 002'nin unvanı yok");
    const text = pdfText(await file("kasa-hareketleri", "pdf", second)).replace(/\s+/g, " ");
    assert.ok(text.includes(`002 · ${NAME_2}`), "002'nin PDF'inde '002 · Unvan'");
  });

  it("3: sunucuda 002 seçiliyken 001'i gösteren pencerenin Excel'i (?hofCompany=001) '001 · Unvan' der", async () => {
    assert.equal((await admin.post("/api/companies/select", { id: second.id })).status, 200, "kullanıcı 002'yi seçti");
    const rows = Object.values(xlsxSheets(await file("kasa-hareketleri", "xlsx", first)))[0];
    assert.equal(rows[0][0], `001 · ${NAME_1}`, "pencerenin şirketi");
    assert.equal((await admin.post("/api/companies/select", { id: first.id })).status, 200);
  });

  it("4: şirketin adı değişince Excel yeni adı yazar", async () => {
    assert.equal((await admin.put(`/api/companies/${second.id}`, { name: "Yeni Şube A.Ş." })).status, 200);
    const rows = Object.values(xlsxSheets(await file("kasa-hareketleri", "xlsx", second)))[0];
    assert.equal(rows[0][0], "002 · Yeni Şube A.Ş.");
    assert.equal((await admin.put(`/api/companies/${second.id}`, { name: NAME_2 })).status, 200);
  });

  it("7, 8: boş raporda (çek portföyü) başlık bloğu ve kolon başlıkları var, süzgeç yok; Özet sayfasında Şirket satırı", async () => {
    const empty = await get(`${RC}/cek-portfoy?preset=all`, first);
    assert.equal(empty.rows.length, 0, "portföy boş");
    const buffer = await file("cek-portfoy", "xlsx", first);
    const sheets = xlsxSheets(buffer);
    const rows = Object.values(sheets)[0];
    assert.equal(rows[0][0], `001 · ${NAME_1}`);
    assert.ok(rows.some(row => row.join("|") === empty.headers.join("|")), "kolon başlıkları");
    assert.ok(!/<autoFilter/.test(sheetXml(buffer)), "boş tabloda süzgeç yok");
    const summary = sheets["Özet"];
    assert.ok(summary, "Özet sayfası");
    assert.deepEqual(summary.find(row => row[0] === "Şirket"), ["Şirket", `001 · ${NAME_1}`], "Özet'te Şirket satırı");
  });
});
