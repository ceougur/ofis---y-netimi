// Ders 20 zorla betiği — CI #1050 (12dcad12) Linux Node 22 kırmızısı: whatsapp-t-durum-karar-tablosu-248 T16 "imzalı bildirim istek Meta'dayken işi ilerletir;
// yanıt 'Meta Kabul Etti' ezmez; tek ileti" → satır 'delivered' yerine 'uncertain' (06.11.2026). Bu bir test DEĞİLDİR (npm test toplamaz).
//
// İki kip:
//   test [deneme=3] [ms=900]  — T16'yı ön yükleme test/fixtures/t16-yaris-zorla.mjs ile N kez koşar; imzalı teslim deftere yazıldıktan HEMEN sonra olay döngüsü
//                               ms boyunca kilitlenir (yüklü CI koşucusu). Ön koşul (CI'deki sıra): defter-teslim → kilit (≥ 800 ms, eski düzenekte istemci süre
//                               sınırı) → ileti isteğinin sonucu. Yeşil/kırmızı yalnız ön koşulun oluştuğu denemelerde sayılır. 'uncertain'ı yazan yığın satırı basılır.
//   urun                      — ÜRÜN yarışının etkisi, süreye bağlı değil: ileti isteği sahte Meta'da KAPIDA tutulur, imzalı 'delivered' uygulanır, kapı istemcinin
//                               süre sınırı dolana dek bırakılmaz (yanıtı yolda kaybolan istek). Sonra satır / defter / Bu Ay / önizleme / Yine de Gönder / sonraki
//                               'read' bildirimi sayılarla basılır.
// Kullanım: node test/whatsapp-t16-zorla.mjs test [deneme] [ms]  ·  node test/whatsapp-t16-zorla.mjs urun
// Çıkış (test): 0 bütün denemeler yeşil ve ön koşul hepsinde oluştu · 1 en az bir deneme kırmızı · 2 ön koşul oluşmayan deneme var (sonuç sayılmaz).
// Çıkış (urun): 0 satır teslim bilgisini korudu · 1 satır 'Sonucu Belirsiz'e döndü (ürün yarışı var).
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const [kip = "test", ...rest] = process.argv.slice(2);
process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9"; // ders 30
const OLD_TIMEOUT_MS = 800; // test/whatsapp-248-ortak.mjs startWa varsayılanı

async function testKip() {
  const trials = Number(rest[0] || 3);
  const ms = Number(rest[1] || 900);
  console.log(`# T16 yarış denemesi: ${trials} deneme, defter-teslimden sonra olay döngüsü kilidi ${ms} ms, TZ ${process.env.TZ || "(yerel)"}, klasör ${root}`);
  let red = 0;
  let formed = 0;
  for (let n = 1; n <= trials; n += 1) {
    const run = spawnSync(
      process.execPath,
      ["--disable-warning=ExperimentalWarning", "--import", "./test/fixtures/t16-yaris-zorla.mjs", "--test", "--test-name-pattern=^T16 ", "--test-reporter=spec", "test/whatsapp-t-durum-karar-tablosu-248.test.mjs"],
      { cwd: root, env: { ...process.env, T16_ZORLA: "yavas", T16_ZORLA_MS: String(ms) }, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    );
    const out = `${run.stdout || ""}${run.stderr || ""}`;
    const at = name => {
      const hit = new RegExp(`\\[t16-zorla\\] \\+(\\d+) ms ${name}`).exec(out);
      return hit ? Number(hit[1]) : null;
    };
    const teslim = at("defter-teslim-yazildi");
    const kilit = at("kilit-basladi");
    const bitti = at("kilit-bitti");
    const sonuc = /\[t16-zorla\] \+(\d+) ms defter-sonuc (\w+) (\S+)/.exec(out);
    const sonucAn = sonuc ? Number(sonuc[1]) : null;
    // Ön koşul: kilit, imzalı teslim yazıldıktan SONRA ve ileti isteğinin defter sonucu yazılmadan ÖNCE başladı ve eski süre sınırından uzun sürdü.
    const happened = teslim !== null && kilit !== null && bitti !== null && sonucAn !== null && teslim <= kilit && kilit < sonucAn && bitti - kilit >= OLD_TIMEOUT_MS;
    const pass = /ℹ pass 1\b/.test(out) && /ℹ fail 0\b/.test(out) && run.status === 0;
    const yazan = /is-satiri-uncertain · ([^\n]+)/.exec(out)?.[1] || "";
    const reason = /actual: [^\n]+\n\s*expected: [^\n]+/.exec(out)?.[0]?.replace(/\s+/g, " ") || /AssertionError[^\n]*/.exec(out)?.[0]?.slice(0, 200) || "";
    if (happened) formed += 1;
    if (!pass) red += 1;
    console.log(
      `deneme ${n}: çıkış ${run.status} · ${pass ? "YEŞİL" : "KIRMIZI"} · teslim +${teslim ?? "?"} → kilit +${kilit ?? "?"}..+${bitti ?? "?"} → defter sonucu ${sonuc ? `${sonuc[2]} (${sonuc[3]}) +${sonucAn}` : "?"} (ön koşul ${happened ? "OLUŞTU" : "OLUŞMADI"})${reason ? ` · ${reason}` : ""}${yazan ? ` · 'uncertain'ı yazan: ${yazan}` : ""}`,
    );
  }
  console.log(`# özet: ${trials - red}/${trials} yeşil, ${red} kırmızı; ön koşul oluşan deneme ${formed}/${trials}`);
  // tools/kanit.mjs kos özeti: ön koşulu oluşmayan yeşil deneme "skipped" sayılır (sonuç sayılmaz).
  const passedFormed = Math.max(trials - red - (trials - formed), 0);
  console.log(`# tests ${trials}\n# pass ${passedFormed}\n# fail ${red}\n# cancelled 0\n# skipped ${trials - red - passedFormed}\n# todo 0`);
  return red ? 1 : formed < trials ? 2 : 0;
}

async function urunKip() {
  const { DatabaseSync } = await import("node:sqlite");
  const { PNID, URLS, startWa } = await import("./whatsapp-248-ortak.mjs");
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const ctx = await startWa({ maxCompanies: 2, now: { time: new Date(2026, 10, 3, 10, 0, 0, 0).toISOString(), fixed: true } });
  let release = () => {};
  try {
    for (const tpl of ctx.fake.state.templates) if (tpl.name.startsWith("destekofis_")) tpl.message_send_ttl_seconds = 259_200;
    const account = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
    const body = { kind: "statement", ids: [account.id], preset: "thisMonth" };
    const created = await ctx.api.post(URLS.batches, body);
    if (created.status !== 200) throw new Error(`toplu iş açılamadı: ${created.status} ${JSON.stringify(created.data)}`);
    const batchId = created.data.data.batch.id;
    const queue = ctx.server.app.context.whatsapp.queue;
    const ledger = ctx.server.app.whatsapp.ledger;
    const sql = (query, ...args) => {
      const reader = new DatabaseSync(ledger.file, { readOnly: true });
      try {
        return reader.prepare(query).all(...args);
      } finally {
        reader.close();
      }
    };
    const job = () => ctx.store.get("SELECT id, state, attempt, wamid, error_text FROM wa_jobs WHERE batch_id = ?", batchId);
    const wamid = `wamid.SAHTE${String(ctx.fake.state.sent + 1).padStart(4, "0")}`;
    ctx.fake.state.hold = { match: /^POST \/\d+\/messages$/, promise: new Promise(resolve => (release = resolve)) };
    const turn = ctx.wa.scheduler.runOnce();
    for (let i = 0; i < 2_000 && !ctx.fake.state.held; i += 1) await wait(10);
    const before = job();
    console.log(`1) ön koşul: ileti isteği sahte Meta'da kapıda (held ${ctx.fake.state.held}), satır ${before.state}, deneme ${before.attempt}`);
    if (ctx.fake.state.held !== 1 || before.state !== "sending") throw new Error("ön koşul kurulamadı");
    const applied = queue.applyStatuses([{ id: wamid, status: "delivered", timestamp: String(Math.floor(ctx.clock().getTime() / 1000)), recipient_id: "905334445566", biz_opaque_callback_data: before.id }], { phoneNumberId: PNID, signed: true });
    console.log(`2) imzalı 'delivered' (iş kimliğiyle) uygulandı: applied ${applied.applied} · satır ${job().state}`);
    // Yanıt kapıda kalır → istemcinin süre sınırı (startWa: 800 ms) dolar; ileti isteği "yanıtsız" sonuçlanır.
    await turn;
    ctx.fake.state.hold = null;
    release();
    const after = job();
    console.log(`3) ileti isteği yanıtsız sonuçlandı (zaman aşımı) → satır ${after.state} · wamid ${after.wamid || "-"} · neden "${after.error_text || ""}"`);
    const outcomes = sql("SELECT attempt, outcome FROM outcomes WHERE job_id = ? ORDER BY attempt", before.id).map(row => `${row.attempt}:${row.outcome}`).join(", ");
    const deliveries = sql("SELECT COUNT(*) AS n FROM deliveries WHERE job_id = ?", before.id)[0].n;
    console.log(`4) defter: deneme sonuçları [${outcomes}] · teslim satırı ${deliveries}`);
    const stats = await ctx.api.get(URLS.stats);
    console.log(`5) Bu Ay (teslim) ${stats.data.data.delivered}`);
    const preview = await ctx.api.post(URLS.preview, body);
    const people = preview.data.data?.people || [];
    console.log(`6) yeni ekstre önizlemesi: ${people.map(person => person.skip || "gönderilecek").join(", ")} · uncertainOpen ${preview.data.data?.uncertainOpen ?? "-"}`);
    const detail = (await ctx.api.get(`${URLS.batches}/${batchId}`)).data.data;
    console.log(`7) toplu iş ${detail.batch?.state || detail.state || "?"} · ekranda iş "${detail.jobs?.[0]?.stateLabel || detail.jobs?.[0]?.state}" · neden "${detail.jobs?.[0]?.reason || ""}"`);
    const again = await ctx.api.post(`/api/workspace/whatsapp/jobs/${before.id}/send-anyway`, { confirm: true });
    console.log(`8) Yine de Gönder (onaylı): HTTP ${again.status}${again.status === 200 ? "" : ` ${JSON.stringify(again.data).slice(0, 200)}`}`);
    if (again.status === 200) {
      await ctx.drain();
      const second = ctx.store.get("SELECT state, skip_reason FROM wa_jobs WHERE batch_id = ?", again.data.data.batch.id);
      console.log(`   yeni iş ${second?.state} ${second?.skip_reason || ""} · sahte Meta'ya giden ileti ${ctx.messages().length}`);
    }
    await ctx.wa.scheduler.maintain();
    console.log(`   bakım turundan sonra satır ${job().state}`);
    const read = queue.applyStatuses([{ id: wamid, status: "read", timestamp: String(Math.floor(ctx.clock().getTime() / 1000)), recipient_id: "905334445566" }], { phoneNumberId: PNID });
    console.log(`9) sonraki imzasız 'read' (aynı wamid): applied ${read.applied} · satır ${job().state}`);
    const verdict = after.state === "uncertain" ? 1 : 0;
    console.log(`# tests 1\n# pass ${verdict ? 0 : 1}\n# fail ${verdict}\n# cancelled 0\n# skipped 0\n# todo 0`);
    console.log(`# sonuç: ${verdict ? "ÜRÜN YARIŞI VAR — teslim bilgisi gelmiş satır zaman aşımında 'Sonucu Belirsiz'e döndü" : "satır teslim bilgisini korudu"}`);
    return verdict;
  } finally {
    ctx.fake.state.hold = null;
    release();
    await ctx.close();
  }
}

const code = kip === "urun" ? await urunKip() : await testKip();
process.exit(code);
