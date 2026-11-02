// 2.4.8 W6 (docs/erp/WHATSAPP-API-PLANI-2.4.8.md §5, §6 W6; kullanıcı kararı 30.10.2026 ~10:45 UTC): "Aydınlatma Metni Hazırla" — firma bilgileriyle
// (Fatura Ayarları → Firma Bilgisi) KVKK aydınlatma metni; metin + PDF. Beklenen içerik DIŞ KAYNAKTAN (ders 5): 6698 sayılı KVKK md. 10 (veri sorumlusunun
// kimliği, amaç, aktarılan kişiler ve amacı, toplama yöntemi ve hukuki sebep, md. 11 hakları), md. 11'in dokuz bendi (a, b, c, ç, d, e, f, g, ğ), plan §5
// (Meta — yurt dışı aktarım md. 9; DestekOfis durum bilgisini saklamadan geçiren veri işleyen; PDF Meta'da en çok 30 gün). Testler yalnız HTTP uçlarından
// (eski kodda 404 = davranış yok; ders 7, 38). PDF metni pdf-write'ın ToUnicode eşlemesinden okunur (banka-210-ortak pdfText; Windows'ta da).
import assert from "node:assert/strict";
import { describe, it, after, before } from "node:test";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";
import { pdfText } from "./banka-210-ortak.mjs";

const NOW = { time: "2026-11-03T09:00:00+03:00", fixed: true };
const URL_NOTICE = "/api/workspace/whatsapp/aydinlatma-metni";
const SELLER = { name: "Mavi Muhasebe Ltd. Şti.", taxNo: "4840847211", taxOffice: "Kadıköy", address: "Caferağa Mah. Moda Cad. No: 12", district: "Kadıköy", city: "İstanbul", phone: "0216 555 01 02", email: "kvkk@mavimuhasebe.com.tr", mersisNo: "0484084721100011" };
const RIGHTS = ["a)", "b)", "c)", "ç)", "d)", "e)", "f)", "g)", "ğ)"];

describe("2.4.8 W6 — Aydınlatma Metni Hazırla", () => {
  let server;
  let admin;
  before(async () => {
    server = await startTestServer({ now: NOW });
    admin = await loginAdmin(server);
  });
  after(async () => {
    await server?.close();
  });

  it("firma bilgisi eksikken: eksikler adıyla, metinde köşeli ayraçlı yer tutucu; 'undefined' / 'null' yok", async () => {
    const res = await admin.get(URL_NOTICE);
    assert.equal(res.status, 200, `GET ${URL_NOTICE} → ${res.status}`);
    const notice = res.data.data;
    const labels = notice.missing.map(item => item.label);
    for (const label of ["Adres", "E-posta", "VKN / TCKN"]) assert.ok(labels.includes(label), `eksik: ${label} (${labels.join(", ")})`);
    assert.match(notice.text, /\[Firma adresi\]/);
    assert.match(notice.text, /\[Firma e-posta adresi\]/);
    assert.doesNotMatch(notice.text, /undefined|null|NaN/);
    assert.equal(notice.draft, false, "ürün sahibince onaylı metin (30.10.2026)");
    assert.ok(notice.version, "metin sürümü var");
  });

  it("firma bilgileriyle: KVKK md. 10 öğeleri, md. 11'in dokuz bendi, Meta + yurt dışı (md. 9), veri işleyen, 30 gün; eksik yok", async () => {
    assert.equal((await admin.put("/api/workspace/invoices/settings", { seller: SELLER })).status, 200);
    const notice = (await admin.get(URL_NOTICE)).data.data;
    assert.deepEqual(notice.missing, []);
    const text = notice.text;
    // Veri sorumlusunun kimliği (md. 10/1-a)
    for (const value of [SELLER.name, SELLER.taxNo, SELLER.taxOffice, SELLER.address, SELLER.city, SELLER.phone, SELLER.email, SELLER.mersisNo]) assert.ok(text.includes(value), `firma bilgisi: ${value}`);
    assert.match(text, /veri sorumlusu/);
    assert.match(text, /6698 sayılı Kişisel Verilerin Korunması Kanunu/);
    // İşlenen veriler: ad, telefon, bakiye / ekstre
    assert.match(text, /cep telefonu numaranız/);
    assert.match(text, /cari hesap bakiyeniz/);
    assert.match(text, /ekstre/);
    // Amaç (md. 10/1-b); yalnız bilgilendirme
    assert.match(text, /amaçlarıyla işlenir/);
    assert.match(text, /reklam, kampanya ya da tanıtım içermez/);
    // Toplama yöntemi ve hukuki sebep (md. 10/1-ç): 5/2-c ve 5/2-f (plan §5 / W6 talimatı)
    assert.match(text, /toplanır/);
    assert.match(text, /5\. maddesinin ikinci fıkrasının \(c\) bendi/);
    assert.match(text, /\(f\) bendi/);
    // Aktarım (md. 10/1-c): Meta, yurt dışı, md. 9; DestekOfis veri işleyen, saklanmadan
    assert.match(text, /Meta Platforms/);
    assert.match(text, /yurt dışı/);
    assert.match(text, /9\. maddesinde/);
    assert.match(text, /DestekOfis/);
    assert.match(text, /veri işleyen/);
    assert.match(text, /saklanmadan/);
    // Saklama: PDF Meta'da en çok 30 gün (plan §2.3, §11 S3)
    assert.match(text, /30 gün/);
    // Haklar (md. 10/1-d → md. 11): dokuz bent, sırayla
    const rights = notice.sections.flatMap(section => section.items).filter(item => /^[a-zçğ]\) /.test(item)).map(item => item.slice(0, 2));
    assert.deepEqual(rights, RIGHTS, "md. 11 bentleri a–ğ");
    assert.match(text, /11\. maddesi/);
    // Başvuru yolu: adres + e-posta, 30 gün, ücretsiz
    assert.match(text, new RegExp(`${SELLER.email.replace(/\./g, "\\.")} adresine iletebilirsiniz`));
    assert.match(text, /otuz gün içinde ücretsiz/);
    // WhatsApp iletisi istemeyen için yol (ürün kararı "WhatsApp Mesajı İstemiyor")
    assert.match(text, /almak istemiyorsanız/);
    // Tarih sahte saatten (ders 13)
    assert.match(text, /03\.11\.2026 tarihinde hazırlanmıştır/);
  });

  it("PDF: indirme, application/pdf, dosya adı firma adıyla; metin PDF'te de aynı (başlık, firma, md. 9, ğ bendi, sayfa numarası)", async () => {
    const res = await admin.raw("GET", `${URL_NOTICE}.pdf?download=1`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type"), /application\/pdf/);
    assert.match(res.headers.get("content-disposition"), /attachment/);
    assert.match(decodeURIComponent(res.headers.get("content-disposition")), /KVKK Aydınlatma Metni \(WhatsApp\) Mavi Muhasebe Ltd\. Şti\.\.pdf/);
    assert.equal(res.buffer.subarray(0, 5).toString("latin1"), "%PDF-");
    const lines = pdfText(res.buffer);
    assert.ok(lines.includes("Aydınlatma Metni"), "başlık PDF'te");
    assert.ok(lines.includes(SELLER.name), "firma adı PDF'te");
    assert.ok(lines.includes("Meta Platforms"), "Meta PDF'te");
    assert.ok(/9\. maddesinde/.test(lines.replace(/\n/g, " ")), "md. 9 PDF'te");
    assert.ok(lines.includes("ğ)"), "ğ bendi PDF'te");
    assert.match(lines, /Sayfa 1 \/ \d/);
  });

  it("yetkisiz kullanıcı (Personel) metni ve PDF'i alamaz (403)", async () => {
    const user = await createUser(server, admin, { username: "w6-personel", role: "personel" });
    assert.equal((await user.get(URL_NOTICE)).status, 403);
    assert.equal((await user.get(`${URL_NOTICE}.pdf`)).status, 403);
  });
});
