// 2.4.9 B3 (docs/2.4.9-tasarim/B3-B4.md §B3-3 A, §B3-5; ANA OTURUM ONAYI 03.11.2026): dondurulmuş WhatsApp PDF'i ayrı tabloda (wa_job_pdfs, göç v45). Davranış AYNEN:
// içerik ilk hazırlıkta donar, her yeniden deneme aynı baytları gönderir; PDF yalnız iş açıkken tutulur, kesinleşince bakım siler. Bu dosya:
//   T2  eşdeğerlik — 131056, Bağlantı Bekleniyor, Duraklat → 31 gün → Devam Et (+ arada bakım turları): Meta'ya yüklenen PDF'ler bayt bayt aynı, ileti ilk hazırlığın değişkenleriyle
//   T2b yaşam döngüsü eşdeğerliği — açık (Bekliyor / Duraklatıldı) işte PDF durur; Başarısız / kabul / İptal'de bakım siler (eski kodda pdf_blob ile AYNI sayılar)
//   T5  Tüm Hareketleri Sil / Tümünü Sıfırla (açık iş varken) → wa_job_pdfs boş (bakımdan ÖNCE)
//   T6  yarıda kesilme — PDF yazımı düşerse işin satırı da geri alınır (prepared_at boş), sonraki tur temiz hazırlar
//   T7  bakımın PDF silmesi kilide takılınca tur bırakılır (İş N / O1), defter değişmez; sonraki bakım siler
//   T8  kaynak tarama — pdf_blob yalnız göç dosyasında (CRLF bilen; ders 27)
//   T9  iki şirket — 001'in açık işinin PDF'i 002'nin bakımından etkilenmez; her şirketin kendi tablosu
//   T10 iki cari, iki açık iş — PDF iş kimliğiyle aranır: 31 gün sonra her iş KENDİ ilk PDF'ini yeniden yükler (yanlış aramada başkasının ekstresi giderdi; KVKK)
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5) + sahte saat (ders 13). Beklenen bakiye / bayt eşitliği testin girdiği veriden.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { pdfText } from "./banka-210-ortak.mjs";
import { ADMIN_PASSWORD } from "./helpers.mjs";
import { PNID, TOKEN, URLS, WABA, startWa } from "./whatsapp-248-ortak.mjs";
import { isoDay } from "../server/lib/plans.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const sha = data => createHash("sha256").update(Buffer.from(data)).digest("hex");
const metaError = (code, message = "hata") => ({ error: { message, type: "OAuthException", code, error_data: { messaging_product: "whatsapp", details: message }, fbtrace_id: "Abc" } });
// Meta'ya yüklenen PDF baytları (yükleme sırasıyla). Bakım kesinleşen işin medyasını Meta'dan siler (sahte Graph kaydı da gider) → baytlar her okumada önbelleğe alınır;
// testler drain'lerden sonra çağırır.
const seenBytes = new WeakMap();
const uploads = ctx => {
  const seen = seenBytes.get(ctx) || new Map();
  seenBytes.set(ctx, seen);
  for (const item of ctx.fake.requests) {
    if (item.method === "POST" && /\/media$/.test(item.path) && item.media && !seen.has(item.media.id)) seen.set(item.media.id, ctx.fake.state.media.get(item.media.id)?.data ?? null);
  }
  return [...seen.values()];
};
// Program "bugün"ü yerel günle hesaplar (period.mjs today, plans.mjs isoDay); UTC günü yerel günden ayrışınca (İstanbul 00:00–03:00) yanlış gün olur (ders 13, 22).
const today = ctx => isoDay(ctx.clock());
const hasTable = (store, name) => Boolean(store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = ?", name));
// Dondurulmuş PDF'in DURDUĞU yerden bağımsız sayım (eşdeğerlik testleri eski kodda da koşar): yeni kodda wa_job_pdfs, eski kodda wa_jobs.pdf_blob.
const frozenOf = store => {
  const out = new Map(store.all("SELECT id, pdf_blob FROM wa_jobs WHERE pdf_blob IS NOT NULL").map(row => [row.id, sha(row.pdf_blob)]));
  if (hasTable(store, "wa_job_pdfs")) for (const row of store.all("SELECT job_id, pdf FROM wa_job_pdfs")) out.set(row.job_id, sha(row.pdf));
  return out;
};
const pdfRows = store => (hasTable(store, "wa_job_pdfs") ? store.get("SELECT COUNT(*) AS n FROM wa_job_pdfs").n : null);
async function pay(ctx, id, amount, q = "") {
  const res = await ctx.api.post(`/api/workspace/accounts/${id}/entries${q}`, { kind: "in", amount: String(amount), date: today(ctx), note: "Tahsilat" });
  assert.equal(res.status, 200, JSON.stringify(res.data));
}
const ok = async (promise, label) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 400)}`);
  return res.data.data;
};
const jobRowOf = (store, batchId, name) => store.get("SELECT * FROM wa_jobs WHERE batch_id = ? AND account_name = ?", batchId, name);

describe("2.4.9 B3 — dondurulmuş PDF ayrı tabloda: davranış aynı, iş satırında boşluk yok", () => {
  it("T2 eşdeğerlik: 131056 → Bağlantı Bekleniyor → Duraklat → 31 gün → Devam Et (arada bakım turları, tahsilat): PDF iki kez yüklenir, BAYT BAYT aynı; ileti ilk hazırlığın bakiyesiyle", async () => {
    const ctx = await startWa();
    try {
      const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
      ctx.fake.state.failQueue.push({ match: /\/messages$/, status: 400, body: metaError(131056, "Pair rate limit") });
      const id = (await ctx.batch({ kind: "statement", ids: [a.id], preset: "thisMonth" })).data.data.batch.id;
      await ctx.drain();
      assert.equal((await ctx.jobs(id))[0].state, "pending", "ön koşul: 131056 → Bekliyor");
      assert.equal(uploads(ctx).length, 1);
      // Bakiye değişir: içerik yeniden üretilseydi 1.000,00 olurdu.
      await pay(ctx, a.id, 250);
      // Bağlantı yok: ileti isteği Meta'ya ULAŞMAZ → Bağlantı Bekleniyor (iş Bekliyor, PDF'i durur). Arada bakım turu.
      ctx.fake.state.closeConnections = true;
      await ctx.fake.offline();
      try {
        ctx.clock.advance(61_000);
        await ctx.drain();
        assert.equal((await ctx.detail(id)).stateLabel, "Bağlantı Bekleniyor", "ön koşul: Bağlantı Bekleniyor");
        await ctx.wa.scheduler.maintain();
      } finally {
        await ctx.fake.online();
      }
      // Duraklat → 31 gün (Meta'daki kopyanın süresi doldu) → bakım → Devam Et.
      await ok(ctx.api.post(`${URLS.batches}/${id}/pause`, {}), "duraklat");
      ctx.clock.advance(31 * DAY);
      await ctx.wa.scheduler.maintain();
      await ok(ctx.api.post(`${URLS.batches}/${id}/resume`, {}), "devam");
      await ctx.drain();
      const job = (await ctx.jobs(id))[0];
      assert.equal(job.state, "accepted", JSON.stringify(job));
      const sent = uploads(ctx);
      assert.equal(sent.length, 2, "süresi dolan kopya bir kez yeniden yüklendi");
      assert.equal(sha(sent[1]), sha(sent[0]), "yeniden yüklenen PDF ilk hazırlıktakiyle BAYT BAYT aynı (dondurulmuş)");
      const message = ctx.messages().at(-1);
      assert.equal(message.params[3], "1.250,00 TL (Borçlu)", `ileti ilk hazırlığın bakiyesiyle (geldi ${message.params[3]})`);
      const text = (await pdfText(sent[1])).replace(/\s+/g, " ");
      assert.ok(text.includes("1.250,00") && !text.includes("1.000,00"), "PDF de 1.250,00 (aynı anlık görüntü)");
      assert.equal(ctx.messages().length, 1, "kabul edilen tek ileti");
    } finally {
      await ctx.close();
    }
  });

  it("T2b yaşam döngüsü: A 131056 (Bekliyor), B 131026 (Başarısız), C kabul → bakım yalnız A'nınkini tutar; Duraklat'ta durur; İptal Et → bakım siler (eski kodla aynı sayılar)", async () => {
    const ctx = await startWa();
    try {
      const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
      const b = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const c = await ctx.account("Cem Demir", "0535 777 88 99", 500);
      ctx.fake.state.failQueue.push({ match: /\/messages$/, status: 400, body: metaError(131056, "Pair rate limit") }, { match: /\/messages$/, status: 400, body: metaError(131026, "Message undeliverable") });
      const id = (await ctx.batch({ kind: "statement", ids: [a.id, b.id, c.id], preset: "thisMonth" })).data.data.batch.id;
      await ctx.drain({ maintain: false });
      const states = Object.fromEntries((await ctx.jobs(id)).map(job => [job.accountName, job.state]));
      assert.deepEqual(states, { "Ayşe Yılmaz": "pending", "Burak Kaya": "failed", "Cem Demir": "accepted" }, "ön koşul");
      const ids = Object.fromEntries(["Ayşe Yılmaz", "Burak Kaya", "Cem Demir"].map(name => [name, jobRowOf(ctx.store, id, name).id]));
      assert.deepEqual([...frozenOf(ctx.store).keys()].sort(), Object.values(ids).sort(), "bakımdan önce üçünün PDF'i durur");
      await ctx.wa.scheduler.maintain();
      assert.deepEqual([...frozenOf(ctx.store).keys()], [ids["Ayşe Yılmaz"]], "bakım: Başarısız (B) ve kabul (C) silindi, açık A kaldı");
      await ok(ctx.api.post(`${URLS.batches}/${id}/pause`, {}), "duraklat");
      await ctx.wa.scheduler.maintain();
      assert.deepEqual([...frozenOf(ctx.store).keys()], [ids["Ayşe Yılmaz"]], "Duraklatıldı: PDF durur");
      await ok(ctx.api.post(`${URLS.batches}/${id}/cancel`, {}), "iptal");
      assert.equal(jobRowOf(ctx.store, id, "Ayşe Yılmaz").state, "canceled", "ön koşul: İptal");
      await ctx.wa.scheduler.maintain();
      assert.equal(frozenOf(ctx.store).size, 0, "İptal: bakım sildi");
    } finally {
      await ctx.close();
    }
  });

  for (const mode of ["movements", "all"]) {
    it(`T5 Şirket Verisini Sıfırla (${mode === "movements" ? "Tüm Hareketleri Sil" : "Tümünü Sıfırla"}), açık iş varken: wa_job_pdfs bakımdan ÖNCE boşalır`, async () => {
      const ctx = await startWa();
      try {
        const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
        ctx.fake.state.failQueue.push({ match: /\/messages$/, status: 400, body: metaError(131056, "Pair rate limit") });
        await ctx.batch({ kind: "statement", ids: [a.id], preset: "thisMonth" });
        await ctx.drain();
        assert.notEqual(pdfRows(ctx.store), null, "wa_job_pdfs tablosu yok");
        assert.equal(pdfRows(ctx.store), 1, "ön koşul: açık işin PDF'i tabloda");
        const reset = await ctx.api.post("/api/companies/sirket-001/reset", { mode, confirm: "001", password: ADMIN_PASSWORD });
        assert.equal(reset.status, 200, JSON.stringify(reset.data).slice(0, 300));
        assert.equal(pdfRows(ctx.store), 0, "sıfırlama PDF'i de sildi (bakım beklenmeden)");
        assert.equal(reset.data.data.counts.wa_job_pdfs, 1, "silinen sayısı sıfırlama kaydında");
      } finally {
        await ctx.close();
      }
    });
  }

  it("T6 yarıda kesilme: PDF yazımı (disk dolu) düşerse işin satırı da geri alınır — prepared_at boş, değişken yok; sonraki tur temiz hazırlar, PDF bir kez gider", async () => {
    const ctx = await startWa();
    const run = ctx.store.run;
    let fired = 0;
    try {
      const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
      ctx.store.run = (sql, ...args) => {
        if (/INTO wa_job_pdfs/.test(sql) && fired === 0) {
          fired += 1;
          throw Object.assign(new Error("database or disk is full (test kesintisi)"), { code: "ENOSPC" });
        }
        return run.call(ctx.store, sql, ...args);
      };
      const id = (await ctx.batch({ kind: "statement", ids: [a.id], preset: "thisMonth" })).data.data.batch.id;
      await ctx.drain({ maintain: false });
      assert.equal(fired, 1, "kesinti noktası (wa_job_pdfs yazımı) çalışmadı — PDF ayrı tabloya yazılmıyor");
      const row = jobRowOf(ctx.store, id, "Ayşe Yılmaz");
      assert.equal(row.state, "pending", "iş Bekliyor'a döndü");
      assert.equal(row.prepared_at, null, "işin satırı da geri alındı (yarım dondurma yok)");
      assert.deepEqual(JSON.parse(row.params_json), [], "değişkenler yazılmadı");
      assert.equal(pdfRows(ctx.store), 0);
      assert.equal(uploads(ctx).length, 0, "Meta'ya PDF gitmedi");
      ctx.store.run = run;
      await pay(ctx, a.id, 250);
      ctx.clock.advance(20 * MIN);
      await ctx.drain();
      const job = (await ctx.jobs(id))[0];
      assert.equal(job.state, "accepted", JSON.stringify(job));
      assert.equal(uploads(ctx).length, 1);
      assert.equal(ctx.messages().at(-1).params[3], "1.000,00 TL (Borçlu)", "ilk tam hazırlık (tahsilattan sonra) — metin ve PDF aynı anlık görüntü");
      assert.ok((await pdfText(uploads(ctx)[0])).replace(/\s+/g, " ").includes("1.000,00"));
    } finally {
      ctx.store.run = run;
      await ctx.close();
    }
  });

  it("T7 kilit: bakımın PDF silmesi kilide takılınca tur bırakılır (İş N / O1), iş ve defter değişmez; kilit kalkınca sonraki bakım siler", async () => {
    // Kilit işaretinin süresi 0 (test/whatsapp-dk12-kilit-bakim-sayac-248.test.mjs kalıbı): üretimde 30 sn sonra, burada hemen sonraki bakım yeniden dener.
    const ctx = await startWa({ __testWriteLockProbe: false, __testWriteLockBackoffMs: 0 });
    const run = ctx.store.run;
    let fired = 0;
    try {
      const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
      const id = (await ctx.batch({ kind: "statement", ids: [a.id], preset: "thisMonth" })).data.data.batch.id;
      await ctx.drain({ maintain: false });
      const row = jobRowOf(ctx.store, id, "Ayşe Yılmaz");
      assert.equal(row.state, "accepted", "ön koşul: kabul");
      const ledgerBefore = JSON.stringify(ctx.wa.ledger.attempts(row.id));
      ctx.store.run = (sql, ...args) => {
        if (/^DELETE FROM wa_job_pdfs WHERE NOT EXISTS/.test(sql)) {
          fired += 1;
          throw Object.assign(new Error("database is locked"), { code: "ERR_SQLITE_ERROR", errcode: 5 });
        }
        return run.call(ctx.store, sql, ...args);
      };
      const locked = await ctx.wa.scheduler.maintain();
      assert.equal(fired, 1, "bakımın PDF silmesi (DELETE FROM wa_job_pdfs) çalışmadı");
      assert.ok(locked.has("sirket-001"), "kilitli şirket bu turda iş yürütmez (İş N)");
      assert.equal(pdfRows(ctx.store), 1, "PDF bu turda silinmedi");
      assert.equal(jobRowOf(ctx.store, id, "Ayşe Yılmaz").state, "accepted");
      assert.equal(JSON.stringify(ctx.wa.ledger.attempts(row.id)), ledgerBefore, "defter değişmedi");
      ctx.store.run = run;
      await ctx.wa.scheduler.maintain();
      assert.equal(pdfRows(ctx.store), 0, "kilit kalkınca sonraki bakım sildi");
    } finally {
      ctx.store.run = run;
      await ctx.close();
    }
  });

  it("T8 kaynak tarama: wa_jobs.pdf_blob yalnız göç dosyasında anılır (yazım da okuma da yok; CRLF bilen)", () => {
    const hits = [];
    const walk = dir => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!["node_modules", "vendor"].includes(entry.name)) walk(full);
        } else if (/\.(mjs|js|cjs)$/.test(entry.name)) {
          const rel = path.relative(ROOT, full).split(path.sep).join("/");
          if (rel === "server/lib/migrations.mjs") continue;
          readFileSync(full, "utf8").split(/\r?\n/).forEach((line, i) => {
            if (/pdf_blob/.test(line)) hits.push(`${rel}:${i + 1}`);
          });
        }
      }
    };
    for (const dir of ["server", "client", "bulut"]) walk(path.join(ROOT, dir));
    assert.deepEqual(hits, [], `pdf_blob göç dışında anılıyor (PDF wa_job_pdfs'te durur): ${hits.join(", ")}`);
    const migrations = readFileSync(path.join(ROOT, "server/lib/migrations.mjs"), "utf8");
    assert.match(migrations, /version: 45,[\s\S]*?wa_job_pdfs[\s\S]*?UPDATE wa_jobs SET pdf_blob = NULL/, "göç v45 PDF'i taşır ve sütunu boşaltır");
  });

  // B3 dar kontrol DÜŞÜK-2 (03.11.2026): PDF iş kimliğiyle aranır (queue.mjs prepare: wa_job_pdfs WHERE job_id = ?). Mutasyon "iş kimliği yok sayılır" (ilk satır) bütün WhatsApp
  // testlerinden sağ çıkıyordu — tek açık işli testlerde ilk satır zaten o işin PDF'i. Burada İKİ açık iş: yanlış aramada B'ye A'nın ekstresi gider (KVKK).
  it("T10 iki cari, iki açık iş: 131056 → Duraklat → 31 gün → Devam Et; her yeniden yükleme O İŞİN ilk PDF'iyle bayt bayt aynı, iki PDF farklı, dosya adı ve PDF'teki ad kişinin", async () => {
    const ctx = await startWa();
    try {
      const people = [
        { name: "Burak Kaya", phone: "0533 444 55 66", digits: "5334445566", opening: 800, other: "Cem Demir" },
        { name: "Cem Demir", phone: "0535 777 88 99", digits: "5357778899", opening: 500, other: "Burak Kaya" },
      ];
      for (const person of people) person.id = (await ctx.account(person.name, person.phone, person.opening)).id;
      // Meta'ya yüklenen her PDF (yükleme kimliği → dosya adı + baytlar); bakım kesinleşen işin medyasını sahte Graph'tan siler → her okumada önbelleğe alınır.
      const media = new Map();
      const collect = () => {
        for (const item of ctx.fake.requests) {
          if (item.method === "POST" && /\/media$/.test(item.path) && item.media && !media.has(item.media.id)) {
            const data = ctx.fake.state.media.get(item.media.id)?.data;
            assert.ok(data, `yüklenen PDF ${item.media.id} okunamadı (ders 4)`);
            media.set(item.media.id, { filename: item.media.filename, data: Buffer.from(data) });
          }
        }
      };
      // İleti isteği (kabul ya da 131056) → kişi + belgedeki medya kimliği; Meta'ya giden her ileti isteği sırayla.
      const docRequests = () =>
        ctx.messageRequests().map(item => {
          const doc = item.body?.template?.components?.find(c => c.type === "header")?.parameters?.find(p => p.type === "document")?.document;
          const person = people.find(p => String(item.body?.to || "").endsWith(p.digits));
          assert.ok(person && doc?.id, `ileti isteği kişiyle / belgeyle eşleşmedi: ${JSON.stringify(item.body).slice(0, 300)}`);
          return { person: person.name, mediaId: String(doc.id), filename: doc.filename };
        });
      ctx.fake.state.failQueue.push({ match: /\/messages$/, status: 400, body: metaError(131056, "Pair rate limit") }, { match: /\/messages$/, status: 400, body: metaError(131056, "Pair rate limit") });
      const id = (await ctx.batch({ kind: "statement", ids: people.map(p => p.id), preset: "thisMonth" })).data.data.batch.id;
      await ctx.drain({ maintain: false });
      collect();
      const states = Object.fromEntries((await ctx.jobs(id)).map(job => [job.accountName, job.state]));
      assert.deepEqual(states, { "Burak Kaya": "pending", "Cem Demir": "pending" }, "ön koşul: ikisi de 131056 → Bekliyor");
      const firstRequests = docRequests();
      assert.equal(firstRequests.length, 2, "ön koşul: iki ileti isteği (ikisi de 131056)");
      assert.equal(media.size, 2, "ön koşul: iki ilk yükleme");
      const first = {};
      for (const req of firstRequests) {
        assert.equal(first[req.person], undefined, `${req.person} için iki ilk istek`);
        first[req.person] = { sha: sha(media.get(req.mediaId).data), mediaId: req.mediaId };
      }
      assert.notEqual(first["Burak Kaya"].sha, first["Cem Demir"].sha, "ön koşul: iki kişinin ekstresi farklı baytlar");
      // Dondurulmuş PDF'ler tabloda iş kimliğiyle, her biri kendi ilk yüklemesi.
      const frozen = frozenOf(ctx.store);
      for (const person of people) assert.equal(frozen.get(jobRowOf(ctx.store, id, person.name).id), first[person.name].sha, `${person.name}: dondurulmuş PDF ilk yüklemesi`);

      await ok(ctx.api.post(`${URLS.batches}/${id}/pause`, {}), "duraklat");
      ctx.clock.advance(31 * DAY);
      await ctx.wa.scheduler.maintain();
      assert.equal(pdfRows(ctx.store), 2, "Duraklatıldı + bakım: iki açık işin PDF'i durur");
      await ok(ctx.api.post(`${URLS.batches}/${id}/resume`, {}), "devam");
      await ctx.drain({ maintain: false });
      collect();
      const after = Object.fromEntries((await ctx.jobs(id)).map(job => [job.accountName, job.state]));
      assert.deepEqual(after, { "Burak Kaya": "accepted", "Cem Demir": "accepted" }, "Devam Et → ikisi de kabul");
      assert.equal(media.size, 4, "süresi dolan iki kopya birer kez yeniden yüklendi");
      const second = docRequests().slice(2);
      assert.equal(second.length, 2, "Devam Et sonrası iki ileti isteği");
      for (const req of second) {
        const person = people.find(p => p.name === req.person);
        assert.notEqual(req.mediaId, first[req.person].mediaId, `${req.person}: süresi dolan medya yeniden kullanılmadı`);
        const upload = media.get(req.mediaId);
        const got = sha(upload.data);
        const whose = Object.entries(first).find(([, item]) => item.sha === got)?.[0] || "hiçbirinin";
        assert.equal(got, first[req.person].sha, `${req.person}: yeniden yüklenen PDF o işin ilk PDF'i DEĞİL (${whose} ilk PDF'i gitti)`);
        assert.ok(upload.filename.includes(req.person) && req.filename.includes(req.person), `${req.person}: dosya adı kişinin değil (yükleme "${upload.filename}", ileti "${req.filename}")`);
        const text = (await pdfText(upload.data)).replace(/\s+/g, " ");
        assert.ok(text.includes(req.person) && !text.includes(person.other), `${req.person}: PDF'teki ad kişinin değil`);
      }
      assert.deepEqual(ctx.messages().map(m => people.find(p => m.to.endsWith(p.digits))?.name).sort(), ["Burak Kaya", "Cem Demir"], "kabul edilen iki ileti, kişi başına bir");
    } finally {
      await ctx.close();
    }
  });

  it("T9 iki şirket: 001'in Duraklatıldı işinin PDF'i 002'nin gönderimi + bakımından etkilenmez; 002'nin PDF'i kendi dosyasında, kabulden sonra silinir; 31 gün sonra 001 AYNI baytları gönderir", async () => {
    const ctx = await startWa({ maxCompanies: 2 });
    try {
      const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
      ctx.fake.state.failQueue.push({ match: /\/messages$/, status: 400, body: metaError(131056, "Pair rate limit") });
      const id1 = (await ctx.batch({ kind: "statement", ids: [a.id], preset: "thisMonth" })).data.data.batch.id;
      await ctx.drain();
      uploads(ctx);
      await ok(ctx.api.post(`${URLS.batches}/${id1}/pause`, {}), "001 duraklat");
      const first = frozenOf(ctx.store);
      assert.equal(first.size, 1, "ön koşul: 001'de açık işin PDF'i");
      assert.equal(pdfRows(ctx.store), 1, "wa_job_pdfs tablosu yok ya da boş");
      const created = await ok(ctx.api.post("/api/companies", { name: "İkinci Şirket", select: false }), "ikinci şirket");
      const second = created.company || created;
      const q = `?hofCompany=${encodeURIComponent(second.id)}`;
      await ok(ctx.api.put(`${URLS.conn}${q}`, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN }), "002 bağlantı");
      await ok(ctx.api.put(`${URLS.ack}${q}`, { ack: true }), "002 onay");
      const b = await ok(ctx.api.post(`/api/workspace/accounts${q}`, { name: "Burak Kaya", phone: "0533 444 55 66", openingBalance: "800" }), "002 cari");
      const id2 = (await ok(ctx.api.post(`${URLS.batches}${q}`, { kind: "statement", ids: [b.id], preset: "thisMonth" }), "002 gönderim")).batch.id;
      await ctx.drain({ maintain: false });
      uploads(ctx);
      const dir = readdirSync(path.join(ctx.server.app.config.dataDir, "sirketler"))[0];
      const file2 = path.join(ctx.server.app.config.dataDir, "sirketler", dir, "destekofis.sqlite");
      const read2 = () => {
        const db = new DatabaseSync(file2, { readOnly: true });
        try {
          return { rows: db.prepare("SELECT COUNT(*) AS n FROM wa_job_pdfs").get().n, state: db.prepare("SELECT state FROM wa_jobs WHERE batch_id = ?").get(id2).state };
        } finally {
          db.close();
        }
      };
      assert.deepEqual(read2(), { rows: 1, state: "accepted" }, "002: PDF kendi dosyasında (bakımdan önce)");
      await ctx.wa.scheduler.maintain();
      assert.deepEqual(read2(), { rows: 0, state: "accepted" }, "002: bakım kendi PDF'ini sildi");
      assert.deepEqual(frozenOf(ctx.store), first, "001'in açık işinin PDF'i etkilenmedi");
      await pay(ctx, a.id, 250);
      ctx.clock.advance(31 * DAY);
      await ok(ctx.api.post(`${URLS.batches}/${id1}/resume`, {}), "001 devam");
      await ctx.drain();
      assert.equal((await ctx.jobs(id1))[0].state, "accepted");
      const sent = uploads(ctx);
      assert.equal(sent.length, 3, "001 ilk + 002 + 001 yeniden yükleme");
      assert.equal(sha(sent[2]), [...first.values()][0], "001 dondurulmuş baytları gönderdi");
      assert.equal(sha(sent[2]), sha(sent[0]));
      assert.equal(pdfRows(ctx.store), 0, "001: kabulden sonra bakım sildi");
    } finally {
      await ctx.close();
    }
  });
});
