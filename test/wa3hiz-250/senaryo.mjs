// 2.5.0 WhatsApp tur 3 HIZ — eşdeğerlik senaryosu (docs/erp/WA-TUR3-TASARIM.md §14 "Nasıl bozulur?"; ders 47: hız düzeltmesi eşdeğerlik testiyle). Aynı TOHUMLU bildirim dizisi GERÇEK programa
// (sahte Meta, sahte saat, ölü lisans adresi — ders 13, 30) verilir; her çağrının sonucu, her çağrıdan sonra değişen iş durumları ve sonda iş / toplu iş / defter / işaret dökümü kimlikleri
// sıra etiketine çevrilmiş (UUID → U<n>) olarak döner. REFERANS: tur 3'ün bildirim-başına GERÇEK kodu (sinama-wa3 028e1b76) bu dosyayla, bu dosyanın KENDİSİ o kodun kopyasına konularak
// koşuldu (ders 23 / 51 — eski kopyaya yalnız bu yardımcı girdi); çıktısı test/fixtures/wa3hiz-250/ altında (uret.mjs). Beklenen = o kodun çıktısı (ders 5: programla aynı elden çıkan model
// DEĞİL, eski kodun kendisi). Senaryo: zincir işleri (işteki Yine de Gönder; Silme Talebi / İstemiyor ile Atlandı), J10 ("Daha Önce Gönderildi"), Meta Bekletti → 2. denemede Atlandı (eski deneme
// yolu), olağan işler, dizinin ORTASINDA açılan yeni zincirler (küme kurulduktan sonra), zincirli Başarısızları Yeniden Dene (iki katman), program açıkken BAŞKA bağlantının inherit_of yazımı,
// ikinci şirket (kendi zinciri + dizinin ortasında yeni zinciri), aynı çağrıda aynı işe iki bildirim, teslim + okundu, zincir işi + kaynağı aynı çağrıda, tanınmayan wamid, failed / sent.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { removeTestDir } from "../helpers.mjs";
import { PNID, TOKEN, URLS, WABA, startWa } from "../whatsapp-248-ortak.mjs";

const DEAD = { HUKUK_LICENSE_URL: "http://127.0.0.1:9" };
const ERASE = "/api/workspace/whatsapp/kvkk-erase";
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
// Başlangıç MUTLAK an (saat diliminden bağımsız çıktı — fikstür iki dilimde aynı; Türkiye 09:00, UTC 06:00; dizi ay içinde kalır).
const START = "2026-11-03T06:00:00.000Z";
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** mulberry32 — tohumlu, platformdan bağımsız. */
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function ok(res, label) {
  const done = await res;
  if (done.status !== 200) throw new Error(`${label}: ${done.status} ${JSON.stringify(done.data).slice(0, 300)}`);
  return done.data.data;
}

/** Kimlikleri ilk görünüş sırasıyla etiketler (UUID → U1, U2 …); çıktı ham JSON metninden bağımsız kalıcı biçim. */
export function normalize(value) {
  const labels = new Map();
  return JSON.parse(JSON.stringify(value).replace(UUID, id => {
    const key = id.toLowerCase();
    if (!labels.has(key)) labels.set(key, `U${labels.size + 1}`);
    return labels.get(key);
  }));
}

const dumpDb = (file, tables) => {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const out = {};
    for (const table of tables) out[table] = db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all().map(row => ({ ...row }));
    return out;
  } finally {
    db.close();
  }
};
const ledgerTables = file => {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    return db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row => row.name);
  } finally {
    db.close();
  }
};

/**
 * Senaryoyu koşar; dönüş { seed, steps, final } (normalize edilmiş). opts.mutate(ctx) yalnız mutasyon betiği için değil — yok.
 */
export async function runScenario({ seed, steps: stepCount = 45 }) {
  const random = prng(seed);
  const pick = list => list[Math.floor(random() * list.length)];
  const root = mkdtempSync(path.join(tmpdir(), "destekofis-wa3hiz-"));
  const dataDir = path.join(root, "data");
  const ctx = await startWa({ env: DEAD, dataDir, maxCompanies: 2, now: { time: START, fixed: true } });
  const log = [];
  try {
    const queues = new Map();
    const sch = ctx.server.app.whatsapp.scheduler;
    const reg = sch.register.bind(sch);
    sch.register = (key, queue) => {
      queues.set(String(key), queue);
      return reg(key, queue);
    };
    const created = await ok(ctx.api.post("/api/companies", { name: "Deneme Şirketi", select: false }), "ikinci şirket");
    const second = created.company || created;
    const q2 = `hofCompany=${encodeURIComponent(second.id)}`;
    await ok(ctx.api.put(`${URLS.conn}?${q2}`, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN }), "002 bağlantı");
    await ok(ctx.api.put(`${URLS.ack}?${q2}`, { ack: true }), "002 onay");
    const db001 = ctx.server.app.config.dbPath;
    const db002 = path.join(dataDir, "sirketler", String(second.code || "002"), "destekofis.sqlite");
    const ledgerFile = path.join(dataDir, "whatsapp-gonderim.sqlite");
    const co = {
      "001": { q: "", file: db001, queue: () => ctx.server.app.context.whatsapp.queue },
      "002": { q: `?${q2}`, file: db002, queue: () => queues.get(String(second.id)) },
    };
    const url = (c, p) => `${p}${co[c].q}`;
    const account = async (c, name, phone) => ok(ctx.api.post(url(c, "/api/workspace/accounts"), { name, phone, openingBalance: "500" }), `cari ${name}`);
    const setCard = async (c, id, patch) => ok(ctx.api.put(url(c, `/api/workspace/accounts/${id}`), { ...(await ok(ctx.api.get(url(c, `/api/workspace/accounts/${id}`)), "kart")), ...patch }), "kart güncelle");
    const batch = async (c, ids) => ok(ctx.api.post(url(c, URLS.batches), { kind: "statement", ids, preset: "thisMonth" }), "toplu iş");
    const action = (c, id, what) => ctx.api.post(url(c, `${URLS.batches}/${id}/${what}`), {});
    const anyway = (c, jobId) => ctx.api.post(url(c, `/api/workspace/whatsapp/jobs/${jobId}/send-anyway`), { confirm: true });
    const jobsOf = c => {
      const db = new DatabaseSync(co[c].file, { readOnly: true });
      try {
        return db.prepare("SELECT id, batch_id, account_id, account_name, state, attempt, wamid, inherit_of, skip_reason FROM wa_jobs ORDER BY rowid").all().map(row => ({ ...row }));
      } finally {
        db.close();
      }
    };
    const jobByName = (c, name, n = 0) => jobsOf(c).filter(job => job.account_name === name)[n];
    const ts = () => String(Math.floor(ctx.clock.ms() / 1000));
    let gec = 0;
    const statesOf = c => Object.fromEntries(jobsOf(c).map(job => [job.id, `${job.state}${job.skip_reason ? `|${job.skip_reason}` : ""}`]));
    const last = { "001": statesOf("001"), "002": statesOf("002") };
    /** Tek çağrı: sonuç + bu çağrıdan sonra DEĞİŞEN iş durumları kaydedilir (her iki şirket). */
    const call = (c, list, options, label) => {
      let result;
      try {
        result = co[c].queue().applyStatuses(list, { phoneNumberId: PNID, ...options });
      } catch (error) {
        result = { error: String(error?.code || error?.message || error) };
      }
      const changed = {};
      for (const k of ["001", "002"]) {
        const now = statesOf(k);
        for (const [id, value] of Object.entries(now)) if (last[k][id] !== value) changed[`${k}:${id}`] = value;
        last[k] = now;
      }
      log.push({ label, c, list: list.map(item => `${item.id}:${item.status}${item.biz_opaque_callback_data ? `@${item.biz_opaque_callback_data}` : ""}`), options, result, changed });
      return result;
    };
    const step = async (label, fn) => {
      let note = "ok";
      try {
        await fn();
      } catch (error) {
        note = String(error?.message || error).slice(0, 200);
      }
      const changed = {};
      for (const k of ["001", "002"]) {
        const now = statesOf(k);
        for (const [id, value] of Object.entries(now)) if (last[k][id] !== value) changed[`${k}:${id}`] = value;
        last[k] = now;
      }
      log.push({ label, note, changed });
    };
    const late = (jobId, value) => ({ id: `wamid.GEC-${(gec += 1)}`, status: value, timestamp: ts(), recipient_id: "905000000000", biz_opaque_callback_data: jobId });
    const own = (job, value) => ({
      id: job.wamid,
      status: value,
      timestamp: ts(),
      recipient_id: "905000000000",
      ...(value === "failed" ? { errors: [{ code: 131026, title: "Message undeliverable" }] } : {}),
    });

    // ---- KURULUM (001) ----
    // H: Meta Bekletti → 2. deneme anında İstemiyor ile Atlandı (eski deneme yolu — W3T-70a düzeni). Gün atlaması en başta (öbür işler etkilenmesin).
    const h = await account("001", "Hasan Bekler", "0545 100 00 01");
    await batch("001", [h.id]);
    await ctx.drain();
    await step("H 131049", async () => {
      const job = jobByName("001", "Hasan Bekler");
      call("001", [{ ...own(job, "failed"), errors: [{ code: 131049, title: "ecosystem" }] }], {}, "H Meta Bekletti");
      await setCard("001", h.id, { waOptOut: true });
      ctx.clock.advance(DAY + MIN);
      await ctx.drain();
    });
    // Sonucu Belirsiz kaynaklar: Z1–Z3 (kurulumda zincir), R1–R2 (dizinin ortasında zincir), D (dış yazım), T (zincirli yeniden dene), J (J10).
    const names = ["Zafer Silme", "Zuhal İstemez", "Zeki İstemez", "Rana Sonra", "Rıza Sonra", "Deniz Dış", "Tamer Tekrar", "Jale Çift", "Mert Aynı"];
    const acc = {};
    for (const [i, name] of names.entries()) acc[name] = await account("001", name, `0545 2${String(i).padStart(2, "0")} 00 0${i}`);
    // Her kaynak kendi toplu işinde (art arda yanıtsız istek toplu işi duraklatır — tek toplu işte sondakiler Duraklatıldı kalırdı).
    ctx.fake.state.hang = /messages/;
    for (const name of names) {
      await batch("001", [acc[name].id]);
      await ctx.drain();
    }
    ctx.fake.state.hang = null;
    const src = name => jobByName("001", name, 0);
    // Olağan işler (zincirsiz; ölçümün yolu).
    const plain = ["Pelin Olağan", "Polat Olağan", "Pınar Olağan", "Poyraz Olağan"];
    for (const [i, name] of plain.entries()) acc[name] = await account("001", name, `0545 3${String(i).padStart(2, "0")} 00 0${i}`);
    await batch("001", plain.map(name => acc[name].id));
    await ctx.drain();
    // Z zincirleri: işteki Yine de Gönder → duraklat → Z1 silme talebi, Z2 / Z3 İstemiyor → Devam Et → Atlandı. M (Mert Aynı) da aynı düzen; kaynağı dizide AYNI çağrıda teslim + okundu alır.
    const chainBatch = {};
    await step("Z zincirleri", async () => {
      for (const name of ["Zafer Silme", "Zuhal İstemez", "Zeki İstemez", "Mert Aynı"]) {
        const made = await ok(anyway("001", src(name).id), `Yine de Gönder ${name}`);
        await ok(action("001", made.batch.id, "pause"), "duraklat");
        chainBatch[name] = made.batch.id;
      }
      await ok(ctx.api.post(ERASE, { accountId: acc["Zafer Silme"].id, confirm: true }), "silme talebi");
      await setCard("001", acc["Zuhal İstemez"].id, { waOptOut: true });
      await setCard("001", acc["Zeki İstemez"].id, { waOptOut: true });
      await setCard("001", acc["Mert Aynı"].id, { waOptOut: true });
      for (const name of ["Zafer Silme", "Zuhal İstemez", "Zeki İstemez", "Mert Aynı"]) await ok(action("001", chainBatch[name], "resume"), "Devam Et");
      await ctx.drain();
    });
    // J10: iki Sonucu Belirsiz deneme; 2. Yine de Gönder duraklatılır; ilk kaynağın imzalı geç teslimi (küme BURADA kurulur) → Devam Et → Atlandı — Daha Önce Gönderildi.
    await step("J10", async () => {
      ctx.fake.state.hang = /messages/;
      const y1 = await ok(anyway("001", src("Jale Çift").id), "J 1. Yine de Gönder");
      await ctx.drain();
      ctx.fake.state.hang = null;
      const j1 = jobsOf("001").find(job => job.batch_id === y1.batch.id);
      const y2 = await ok(anyway("001", j1.id), "J 2. Yine de Gönder");
      await ok(action("001", y2.batch.id, "pause"), "duraklat");
      ctx.clock.advance(HOUR);
      call("001", [late(src("Jale Çift").id, "delivered")], { signed: true }, "J0 geç teslim");
      await ok(action("001", y2.batch.id, "resume"), "Devam Et");
      await ctx.drain();
    });
    // T: zincir işi GÖNDERİLİR (Meta Kabul Etti) → failed (131026) → Başarısızları Yeniden Dene (dizinin ortasında, zincirli) — burada yalnız ilk katman.
    let tChainBatch = null;
    await step("T zinciri", async () => {
      const made = await ok(anyway("001", src("Tamer Tekrar").id), "T Yine de Gönder");
      tChainBatch = made.batch.id;
      await ctx.drain();
      const job = jobsOf("001").find(item => item.batch_id === tChainBatch);
      call("001", [own(job, "failed")], {}, "T zincir işi failed");
      // Kaynak da kesin Başarısız (imzalı, iş kimliğiyle) — yoksa kaynak "Sonucu Belirsiz" kalır ve yeniden deneme kişiyi eler.
      call("001", [{ ...late(src("Tamer Tekrar").id, "failed"), errors: [{ code: 131026, title: "Message undeliverable" }] }], { signed: true }, "T kaynağı failed");
    });
    // D: aynı carinin ayrı (Atlandı) işi — kaynağı yok; dizinin ortasında BAŞKA bağlantı inherit_of yazar.
    let dSkipped = null;
    acc["Dilek Yeni"] = await account("001", "Dilek Yeni", "0545 500 00 01");
    await step("D atlanan iş", async () => {
      await setCard("001", acc["Deniz Dış"].id, { waOptOut: true });
      await batch("001", [acc["Deniz Dış"].id, acc["Dilek Yeni"].id]);
      await ctx.drain();
      dSkipped = jobsOf("001").filter(job => job.account_name === "Deniz Dış").at(-1);
    });

    // ---- KURULUM (002) ----
    const q = await account("002", "Kemal İkinci", "0545 400 00 01");
    const q2b = await account("002", "Kerem İkinci", "0545 400 00 02");
    const qPlain = await account("002", "Kader İkinci", "0545 400 00 03");
    ctx.fake.state.hang = /messages/;
    for (const id of [q.id, q2b.id]) {
      await batch("002", [id]);
      await ctx.drain();
    }
    ctx.fake.state.hang = null;
    await batch("002", [qPlain.id]);
    await ctx.drain();
    let qChain = null;
    await step("002 zinciri", async () => {
      const made = await ok(anyway("002", jobByName("002", "Kemal İkinci").id), "002 Yine de Gönder");
      qChain = made.batch.id;
      await ok(action("002", made.batch.id, "pause"), "duraklat");
      await setCard("002", q.id, { waOptOut: true });
      await ok(action("002", made.batch.id, "resume"), "Devam Et");
      await ctx.drain();
    });

    // ---- TOHUMLU DİZİ ----
    // Havuz cari kimliğiyle (silme talebi carinin adını işten siler). Ayrılanlar kendi adımına dek dizide yok (önce teslim alırlarsa adımın ön koşulu kalmaz).
    const reserved = new Set([acc["Rana Sonra"].id, acc["Rıza Sonra"].id, q2b.id, acc["Tamer Tekrar"].id, acc["Deniz Dış"].id, acc["Mert Aynı"].id]);
    const interesting = new Set([...["Zafer Silme", "Zuhal İstemez", "Zeki İstemez", "Jale Çift", "Tamer Tekrar", "Deniz Dış"].map(name => acc[name].id), h.id, q.id]);
    const at = { r1: 8 + Math.floor(random() * 6), ext: 16 + Math.floor(random() * 4), t2: 20 + Math.floor(random() * 4), q2: 24 + Math.floor(random() * 4), r2: 28 + Math.floor(random() * 6), same: 3 + Math.floor(random() * 4) };
    const newChain = async (c, name, accId) => {
      reserved.delete(accId);
      interesting.add(accId);
      const source = jobByName(c, name, 0);
      const made = await ok(anyway(c, source.id), `Yine de Gönder ${name}`);
      await ok(action(c, made.batch.id, "pause"), "duraklat");
      await setCard(c, accId, { waOptOut: true });
      await ok(action(c, made.batch.id, "resume"), "Devam Et");
      await ctx.drain();
    };
    for (let n = 0; n < stepCount; n += 1) {
      ctx.clock.advance(MIN * (1 + Math.floor(random() * 30)));
      if (n === at.same) {
        // Nasıl bozulur 1 / 7: AYNI çağrıda kaynağa geç teslim (wamid öğrenilir) + aynı wamid'e okundu — ikinci bildirim birincinin zincir işine yazdığını görmeli (Atlandı → Teslim Edildi → Okundu).
        reserved.delete(acc["Mert Aynı"].id);
        interesting.add(acc["Mert Aynı"].id);
        const first = late(src("Mert Aynı").id, "delivered");
        call("001", [first, { id: first.id, status: "read", timestamp: ts(), recipient_id: "905000000000" }], { signed: true }, `M aynı çağrıda teslim + okundu (${n})`);
      }
      if (n === at.r1) await step(`yeni zincir R1 (${n})`, () => newChain("001", "Rana Sonra", acc["Rana Sonra"].id));
      if (n === at.r2) await step(`yeni zincir R2 (${n})`, () => newChain("001", "Rıza Sonra", acc["Rıza Sonra"].id));
      if (n === at.q2) await step(`002 yeni zincir (${n})`, () => newChain("002", "Kerem İkinci", q2b.id));
      if (n === at.t2) {
        await step(`zincirli Başarısızları Yeniden Dene (${n})`, async () => {
          reserved.delete(acc["Tamer Tekrar"].id);
          const made = await ok(action("001", tChainBatch, "retry-failed"), "yeniden dene");
          await ok(action("001", made.batch.id, "pause"), "duraklat");
          await setCard("001", acc["Tamer Tekrar"].id, { waOptOut: true });
          await ok(action("001", made.batch.id, "resume"), "Devam Et");
          await ctx.drain();
        });
      }
      if (n === at.ext) {
        await step(`başka bağlantı inherit_of (${n})`, async () => {
          reserved.delete(acc["Deniz Dış"].id);
          const db = new DatabaseSync(db001);
          try {
            db.exec("PRAGMA busy_timeout = 5000");
            db.prepare("UPDATE wa_jobs SET inherit_of = ? WHERE id = ?").run(src("Deniz Dış").id, dSkipped.id);
          } finally {
            db.close();
          }
        });
        // Nasıl bozulur 4: dış yazımdan HEMEN sonra (arada küme düşüren işlem yok) kaynağın geç teslimi — küme data_version'la yeniden kurulmalı.
        call("001", [late(src("Deniz Dış").id, "delivered")], { signed: true }, `D kaynağı geç teslim (${n})`);
      }
      const c = random() < 0.85 ? "001" : "002";
      const jobs = jobsOf(c).filter(job => !reserved.has(job.account_id));
      const pool = random() < 0.6 ? jobs.filter(job => interesting.has(job.account_id)) : jobs;
      const list = [];
      const size = 1 + Math.floor(random() * 3);
      for (let k = 0; k < size; k += 1) {
        const r = random();
        if (r < 0.05) {
          list.push({ id: `wamid.TANINMAYAN-${n}-${k}`, status: "delivered", timestamp: ts(), recipient_id: "905000000000" });
          continue;
        }
        const job = pick(pool.length ? pool : jobs);
        const value = pick(["delivered", "delivered", "read", "read", "sent", "failed"]);
        if (job.wamid && random() < 0.5) list.push(own(job, value));
        else list.push(late(job.id, value === "failed" || value === "sent" ? "delivered" : value));
        // Aynı çağrıda aynı işe ikinci bildirim (teslim + okundu / yinelenen teslim).
        if (random() < 0.25) list.push(late(job.id, pick(["delivered", "read"])));
      }
      const options = { signed: random() < 0.8 };
      const via = pick([undefined, undefined, "manual", "embedded", ""]);
      if (via !== undefined) options.via = via;
      call(c, list, options, `adım ${n}`);
    }

    // ---- SON DÖKÜM ----
    const final = {};
    for (const c of ["001", "002"]) {
      const dump = dumpDb(co[c].file, ["wa_jobs", "wa_batches"]);
      const sdb = new DatabaseSync(co[c].file, { readOnly: true });
      try {
        dump.settings = sdb.prepare("SELECT key, value FROM settings WHERE key LIKE 'whatsapp.hook%' ORDER BY key").all().map(row => ({ ...row }));
      } finally {
        sdb.close();
      }
      dump.buAy = (await ok(ctx.api.get(url(c, URLS.stats)), "Bu Ay"));
      final[c] = dump;
    }
    final.ledger = dumpDb(ledgerFile, ledgerTables(ledgerFile));
    final.messages = ctx.messageRequests().length;
    return normalize({ seed, steps: log, final });
  } finally {
    await ctx.close();
    removeTestDir(root);
  }
}
