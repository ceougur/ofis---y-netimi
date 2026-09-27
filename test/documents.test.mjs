// Kayda belge ekleme (v2.0.1): tür doğrulama, görüntüleme/indirme, silme yetkileri, sahipsiz dosya temizliği.
import assert from "node:assert/strict";
import { existsSync, readdirSync, utimesSync } from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { cleanDocumentName, createDocumentStore, detectDocumentType } from "../server/lib/documents.mjs";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4a00000000049454e44ae426082", "hex");
const upload = (client, key, name, body, extra = "") =>
  client.raw("POST", `/api/workspace/cases/${encodeURIComponent(key)}/documents?name=${encodeURIComponent(name)}${extra}`, { body, headers: { "content-type": "application/octet-stream", "x-hof-upload": "1" } });

describe("kayıt belgeleri", () => {
  let server;
  let admin;
  let staff;
  let other;
  const key = "2026/501";

  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    staff = await createUser(server, admin, { username: "selin", name: "Selin Kaya", role: "personel" });
    other = await createUser(server, admin, { username: "mert", name: "Mert Er", role: "personel" });
  });
  after(() => server.close());

  it("tür uzantıdan ve içerikten doğrulanır; adlar temizlenir", () => {
    assert.equal(detectDocumentType("dilekce.pdf", PDF).kind, "pdf");
    assert.equal(detectDocumentType("Ekran görüntüsü.PNG", PNG).mime, "image/png");
    assert.match(detectDocumentType("sahte.pdf", Buffer.from("<html><script>")).error, /pdf dosyası gibi görünmüyor/);
    assert.match(detectDocumentType("zararli.exe", Buffer.from("MZ")).error, /Bu dosya türü eklenemez/);
    assert.match(detectDocumentType("resim.svg", Buffer.from("<svg/>")).error, /Bu dosya türü eklenemez/);
    assert.equal(detectDocumentType("notlar.txt", Buffer.from("merhaba")).kind, "text");
    assert.match(detectDocumentType("ikili.txt", Buffer.from([0x41, 0, 0x42])).error, /txt dosyası gibi görünmüyor/);
    assert.equal(cleanDocumentName("C:\\Users\\a\\..\\gizli<dosya>.pdf"), "gizli dosya .pdf");
    assert.equal(cleanDocumentName(""), "belge");
  });

  it("personel belge ekler; herkes listeler, eskiden yeniye; PDF ve resim tarayıcıda açılır, diğerleri iner", async () => {
    const first = await upload(staff, key, "Dilekçe 2026.pdf", PDF, "&title=Ali%20Veli");
    assert.equal(first.status, 200, JSON.stringify(first.data));
    assert.equal(first.data.data.viewable, true);
    await new Promise(resolve => setTimeout(resolve, 5));
    const second = await upload(staff, key, "Ekran görüntüsü.png", PNG);
    assert.equal(second.status, 200);
    await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal((await upload(staff, key, "not.txt", Buffer.from("Görüşme notu"))).status, 200);

    const list = (await admin.get(`/api/workspace/cases/${encodeURIComponent(key)}/documents`)).data.data.documents;
    assert.deepEqual(list.map(item => item.name), ["Dilekçe 2026.pdf", "Ekran görüntüsü.png", "not.txt"]);
    assert.equal(list[0].actorName, "Selin Kaya");

    const pdf = await other.raw("GET", `/api/workspace/documents/${first.data.data.id}/file`);
    assert.equal(pdf.status, 200);
    assert.equal(pdf.headers.get("content-type"), "application/pdf");
    assert.match(pdf.headers.get("content-disposition"), /^inline;/);
    assert.deepEqual(pdf.buffer, PDF);
    const image = await other.raw("GET", `/api/workspace/documents/${second.data.data.id}/file`);
    assert.match(image.headers.get("content-security-policy"), /sandbox/);
    assert.equal(image.headers.get("x-content-type-options"), "nosniff");
    const text = await other.raw("GET", `/api/workspace/documents/${list[2].id}/file`);
    assert.match(text.headers.get("content-disposition"), /^attachment;/, "metin tarayıcıda açılmaz, iner");
    const download = await other.raw("GET", `/api/workspace/documents/${first.data.data.id}/file?download=1`);
    assert.match(download.headers.get("content-disposition"), /^attachment;.*filename\*=UTF-8''Dil%C4%B1?ek%C3%A7e%202026\.pdf|^attachment;.*Dilek/);
  });

  it("sahte uzantılı, izin verilmeyen ve çok büyük dosya reddedilir; yükleme başlığı zorunlu", async () => {
    assert.equal((await upload(staff, key, "fatura.pdf", Buffer.from("<html>kötü</html>"))).status, 415);
    assert.equal((await upload(staff, key, "sayfa.html", Buffer.from("<html>"))).status, 415);
    const big = Buffer.alloc(25 * 1024 * 1024 + 1, 0x20);
    big.write("%PDF-");
    assert.equal((await upload(staff, key, "buyuk.pdf", big)).status, 413);
    const plain = await staff.raw("POST", `/api/workspace/cases/${encodeURIComponent(key)}/documents?name=a.pdf`, { body: PDF, headers: { "content-type": "application/octet-stream" } });
    assert.equal(plain.status, 400, "özel başlıksız (çapraz site form) yükleme reddedilir");
  });

  it("kişi kendi belgesini siler; başkasınınkini yalnızca yönetici siler; silinen belge açılmaz", async () => {
    const list = (await admin.get(`/api/workspace/cases/${encodeURIComponent(key)}/documents`)).data.data.documents;
    const [pdf, png] = list;
    assert.equal((await other.raw("DELETE", `/api/workspace/documents/${pdf.id}`)).status, 403);
    assert.equal((await staff.raw("DELETE", `/api/workspace/documents/${pdf.id}`)).status, 200);
    assert.equal((await admin.raw("DELETE", `/api/workspace/documents/${png.id}`)).status, 200);
    assert.equal((await admin.raw("GET", `/api/workspace/documents/${pdf.id}/file`)).status, 404);
    const names = (await other.get(`/api/workspace/cases/${encodeURIComponent(key)}/documents`)).data.data.documents.map(item => item.name);
    assert.deepEqual(names, ["not.txt"]);
    const audit = JSON.stringify((await admin.get("/api/admin/audit?type=case.document.deleted")).data);
    assert.match(audit, /Dilekçe 2026\.pdf/);
  });

  it("aynı dosya iki kez yer kaplamaz; silinen belgenin dosyası 30 gün sonra temizlenir", () => {
    const dir = path.join(server.dataDir, "belgeler");
    const before = readdirSync(dir).flatMap(bucket => readdirSync(path.join(dir, bucket)));
    assert.equal(before.length, 3, "üç ayrı içerik");
    const files = createDocumentStore({ dir });
    const store = server.app.store;
    store.run("UPDATE case_documents SET deleted_at = '2020-01-01T00:00:00.000Z' WHERE deleted_at IS NOT NULL");
    const pdfSha = store.get("SELECT sha256 FROM case_documents WHERE name = 'Dilekçe 2026.pdf'").sha256;
    const file = path.join(dir, pdfSha.slice(0, 2), pdfSha);
    // Yeni dosyaya dokunulmaz (yedekten geri dönüş için), 30 günden eski ve sahipsiz olan silinir.
    assert.equal(files.purge(store).rows, 2);
    assert.ok(existsSync(file), "yeni dosya korunur");
    const old = new Date(Date.now() - 40 * 86_400_000);
    utimesSync(file, old, old);
    assert.equal(files.purge(store).files, 1);
    assert.ok(!existsSync(file));
  });
});
