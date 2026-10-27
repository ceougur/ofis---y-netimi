// 2.4.7 E4 — PROGRAM SÜRÜCÜSÜ (kâhin karşılaştırması). kabul.json'daki olay listelerini programın GERÇEK sayaç işlevlerinden geçirir
// (server/lib/einvoice/kullanim.mjs: usageDecision → attemptAtOf, usageKindOf, monthOf; summarizeUsage + windowMonths) ve kâhinin çıktı biçimini yazar
// (README "Çıktı biçimi"). Kâhinin koduna bakılmadı; yalnız README'deki olay sözlüğü ve çıktı biçimi.
//
// PROGRAMIN DURUMU (benzetim; server/routes/invoices.mjs, server/app.mjs, server/lib/backup.mjs, server/lib/einvoice/kullanim-defteri.mjs'ten):
//   belge durumu + İşlem Geçmişi (şirket dosyası) · şirket İZİ (edoc_usage, şirket dosyası) · kurulum DEFTERİ (e-belge-kullanim.sqlite, PK şirket+ETTN+ortam).
//   Sayılan yazım hem ize hem deftere eklenir (INSERT OR IGNORE). Açılışta / okumada her şirketin izi deftere aktarılır.
// EŞLEME (olay → programın yazdığı durum ve İşlem Geçmişi):
//   gonder_kabul, yeniden_deneme_kabul  — belge belirsizse program önce Durum Sorgula yapar: liste "bulunamadı" demeden belirsiz belge yeniden gönderilmez
//                                         (olay dizisinde durum_bulunamadi yoksa sürücü onu ekler ve "örtük bulunamadı" olarak sayar); gönderim izi
//                                         (invoice.e.sending) + invoice.e.sent. İletilmiş / iptal edilmiş belgede program göndermez (409, üretilemez).
//   gonder_red / gonder_belirsiz        — (belirsizse önce bulunamadı) iz + invoice.e.send-failed {status: error | none}.
//   belirsiz_kesinlesti_kabul           — Durum Sorgula kabul: setE invoice.e.status (önceki durumdan: belirsiz → sayılır; Hata → F2 sayılır).
//   belirsiz_kesinlesti_red             — Durum Sorgula: EDM'de bulundu, EDM reddetmiş → setE invoice.e.status {status: error} (Hata; sayılmaz).
//   durum_bulunamadi                    — clearE: invoice.e.status {missing}; belge bekleyen (yeniden gönderilebilir).
//   zaten_gonderilmis_11048             — yeniden gönderim: (belirsizse önce bulunamadı) iz → 11048 kendi ETTN'i → durum bulunur → setE invoice.e.duplicate
//                                         (önceki durum = markSending'in belirsizi). İletilmiş belgede program göndermez.
//   durum_sorgusu                       — iletilmiş belgede setE invoice.e.status aynı durumla; belirsizde sorgu sonuçsuz (yazım yok).
//   iptal                               — iletilmiş: e-Belge iptali (setE değil); başka durumda belge programda iptal edilir (sonraki olaylar üretilemez).
//   belge_silindi                       — iletilmemiş belge silinir (sonraki olaylar üretilemez); iletilmiş belge silinmez.
//   yedek_alindi                        — şirketin dosyası (belgeler, İşlem Geçmişi, iz) + defterin TAMAMI (V15) yedeğe.
//   yedekten_geri_yuklendi              — eşleşen yedek varsa şirketin dosyası yedektekine döner ve yedekteki defter kopyası + iz deftere BİRLEŞTİRİLİR;
//                                         yoksa (2.4.7 öncesi yedek) belgeler o ana kadarki günlükten geri kurulur, iz boşalır, defter değişmez.
//   sirket_sifirlandi                   — şirketin faturaları silinir (sonraki olaylar üretilemez); iz ve defter DEĞİŞMEZ (sıfırlama listelerinde yok).
//   sayac_defteri_kayboldu              — defter dosyası yok (yeni kurulum / taşıma, şirket dosyaları duruyor): program açılırken bütün şirketlerin izini
//                                         deftere aktarır (app.mjs syncUsageAll).
//   gecmis (2.4.6)                      — belge o durumda başlar; izi sayacın başlangıcından (since = ilk 2.4.7 olayı) önce.
// Saat: kâhin V1 (TR sabit UTC+3). Program sunucunun yerel saatini kullanır → sürücü TZ=Europe/Istanbul ile koşar.
// Aynı saniye sırası: README V8 (deneme → 11048 → durum → kesinleşme → iptal → silme/bakım; sınıf içinde giriş sırası).
//
// Komut: TZ=Europe/Istanbul node test/bagimsiz/edm-sayac/program-surucu.mjs test/bagimsiz/edm-sayac/kabul.json <çıktı.json> [<üretilemeyen.json>]
import { readFileSync, writeFileSync } from "node:fs";
import { SEND_INTENT } from "../../../server/lib/einvoice/iptal-suresi.mjs";
import { USAGE_KINDS, monthOf, summarizeUsage, usageDecision, usageKindOf, windowMonths } from "../../../server/lib/einvoice/kullanim.mjs";
import { isoDay } from "../../../server/lib/plans.mjs";

if (process.env.TZ !== "Europe/Istanbul") {
  console.error("TZ=Europe/Istanbul ile koşun (programın 'bugün'ü sunucunun yerel günüdür; kâhin V1 TR saatidir).");
  process.exit(2);
}
const PROFILE = { efatura: "TEMELFATURA", earsiv: "EARSIVFATURA", esmm: "ESMM" };
const CLASS = { gonder_kabul: 0, gonder_red: 0, gonder_belirsiz: 0, yeniden_deneme_kabul: 0, zaten_gonderilmis_11048: 1, durum_sorgusu: 2, durum_bulunamadi: 2, belirsiz_kesinlesti_kabul: 3, belirsiz_kesinlesti_red: 3, iptal: 4, belge_silindi: 5, yedek_alindi: 5, yedekten_geri_yuklendi: 5, sirket_sifirlandi: 5, sayac_defteri_kayboldu: 5 };
const toMs = value => {
  const text = String(value);
  return Date.parse(/(Z|[+-]\d{2}:\d{2})$/.test(text) ? text : `${text}+03:00`);
};
const iso = ms => new Date(ms).toISOString();
const PREVIOUS = { waiting: { eStatus: "waiting", eAdapter: "" }, uncertain: { eStatus: "none", eAdapter: "edm" }, accepted: { eStatus: "sent", eAdapter: "edm" }, error: { eStatus: "error", eAdapter: "edm" }, cancelled: { eStatus: "cancelled", eAdapter: "edm" } };
const clone = value => JSON.parse(JSON.stringify(value));

function run(scenario, refMs = Infinity) {
  const events = scenario.olaylar.map((event, index) => ({ ...event, index, ms: toMs(event.zaman) })).filter(event => event.ms <= refMs);
  events.sort((a, b) => a.ms - b.ms || CLASS[a.olay] - CLASS[b.olay] || a.index - b.index);
  const firstMs = scenario.olaylar.length ? Math.min(...scenario.olaylar.map(event => toMs(event.zaman))) : 0;
  const since = firstMs ? iso(firstMs) : "";
  const docs = new Map(); // anahtar → { key, company, env, kind, ettn, state, history, gone }
  const journal = new Map(); // şirket → Map(anahtar → satır)
  const ledger = new Map(); // anahtar → satır
  const backups = new Map(); // `${şirket}|${ms}` → { docs, journal, ledger }
  const log = []; // belge günlüğü (2.4.7 öncesi yedeğin geri yüklenmesi için): { key, ms, snapshot }
  const notes = [];
  const keyOf = (company, env, ettn) => `${company}|${env}|${String(ettn).trim().toLowerCase()}`;
  const docOf = event => {
    const key = keyOf(event.sirket, event.ortam, event.ettn);
    if (!docs.has(key)) docs.set(key, { key, company: event.sirket, env: event.ortam, kind: event.tur, ettn: String(event.ettn).trim().toLowerCase(), state: "waiting", history: [], gone: false });
    return docs.get(key);
  };
  const journalOf = company => {
    if (!journal.has(company)) journal.set(company, new Map());
    return journal.get(company);
  };
  const snap = (doc, ms) => log.push({ key: doc.key, ms, snapshot: { state: doc.state, history: clone(doc.history), gone: doc.gone } });
  const note = (event, why) => notes.push({ olay: event.olay, zaman: event.zaman, ettn: event.ettn, sirket: event.sirket, neden: why });
  for (const past of scenario.gecmis || []) {
    const doc = docOf(past);
    const at = iso(toMs(past.zaman));
    doc.history.push({ type: SEND_INTENT, at, payload: {} });
    if (past.durum === "kabul") {
      doc.history.push({ type: "invoice.e.sent", at, payload: { status: "sent" } });
      doc.state = "accepted";
    } else if (past.durum === "belirsiz") {
      doc.history.push({ type: "invoice.e.send-failed", at, payload: { status: "none", code: "integrator-uncertain" } });
      doc.state = "uncertain";
    } else if (past.durum === "red") {
      doc.history.push({ type: "invoice.e.send-failed", at, payload: { status: "error", code: "integrator-rejected" } });
      doc.state = "error";
    }
    snap(doc, toMs(past.zaman));
  }
  // setE: durum yazımı + (sayılırsa) iz ve defter (routes/invoices.mjs setE → countUsage → recordUsage; edocUsage.add).
  const write = (doc, action, status, at) => {
    const decision = usageDecision({ action, previous: PREVIOUS[doc.state], status, at, history: doc.history, since });
    if (!decision.count) return;
    const kind = usageKindOf(PROFILE[doc.kind]);
    const row = { company: doc.company, env: doc.env, kind, month: monthOf(decision.at), ettn: doc.ettn };
    const key = keyOf(doc.company, doc.env, doc.ettn);
    const own = journalOf(doc.company);
    if (own.has(key)) return; // iz tablosunun birincil anahtarı: ikinci kez yazılmaz (deftere de gitmez)
    own.set(key, row);
    if (!ledger.has(key)) ledger.set(key, row);
  };
  const missing = (doc, at) => {
    doc.history.push({ type: "invoice.e.status", at, payload: { status: "none", missing: true } });
    doc.state = "waiting";
  };
  const resendGuard = (doc, event, at) => {
    if (doc.state !== "uncertain") return;
    note(event, "örtük bulunamadı: program belirsiz belgeyi yeniden göndermeden önce durum sorar (olay dizisinde durum_bulunamadi yok)");
    missing(doc, at);
  };
  for (const event of events) {
    const at = iso(event.ms);
    if (event.olay === "yedek_alindi") {
      const company = event.sirket;
      backups.set(`${company}|${event.ms}`, {
        docs: clone([...docs.values()].filter(doc => doc.company === company)),
        journal: clone([...journalOf(company).entries()]),
        ledger: clone([...ledger.entries()]),
      });
      continue;
    }
    if (event.olay === "yedekten_geri_yuklendi") {
      const company = event.sirket;
      const backupMs = toMs(event.yedek_zamani);
      const backup = backups.get(`${company}|${backupMs}`);
      if (backup) {
        for (const key of [...docs.keys()]) if (docs.get(key).company === company) docs.delete(key);
        for (const doc of clone(backup.docs)) docs.set(doc.key, doc);
        journal.set(company, new Map(clone(backup.journal)));
        for (const [key, row] of backup.ledger) if (!ledger.has(key)) ledger.set(key, row);
        for (const [key, row] of journal.get(company)) if (!ledger.has(key)) ledger.set(key, row);
      } else {
        note(event, "2.4.7 öncesi yedek (eşleşen yedek_alindi yok): belgeler günlükten, iz boş, defter değişmez");
        for (const doc of docs.values()) {
          if (doc.company !== company) continue;
          const last = log.filter(entry => entry.key === doc.key && entry.ms <= backupMs).at(-1);
          Object.assign(doc, last ? clone(last.snapshot) : { state: "waiting", history: [], gone: true });
        }
        journal.set(company, new Map());
      }
      for (const doc of docs.values()) if (doc.company === company) snap(doc, event.ms);
      continue;
    }
    if (event.olay === "sirket_sifirlandi") {
      for (const doc of docs.values()) if (doc.company === event.sirket) {
        doc.gone = true;
        snap(doc, event.ms);
      }
      continue;
    }
    if (event.olay === "sayac_defteri_kayboldu") {
      ledger.clear();
      for (const own of journal.values()) for (const [key, row] of own) if (!ledger.has(key)) ledger.set(key, row);
      continue;
    }
    const doc = docOf(event);
    if (doc.gone) {
      note(event, "üretilemez: belge programda yok (iptal / silindi / sıfırlandı / yedekte yok)");
      continue;
    }
    const sendable = !["accepted", "cancelled"].includes(doc.state);
    switch (event.olay) {
      case "gonder_kabul":
      case "yeniden_deneme_kabul":
        if (!sendable) {
          note(event, "üretilemez: iletilmiş belge yeniden gönderilmez (409)");
          break;
        }
        resendGuard(doc, event, at);
        doc.history.push({ type: SEND_INTENT, at, payload: {} });
        write(doc, "invoice.e.sent", "sent", at);
        doc.history.push({ type: "invoice.e.sent", at, payload: { status: "sent" } });
        doc.state = "accepted";
        break;
      case "gonder_red":
      case "gonder_belirsiz":
        if (!sendable) {
          note(event, "üretilemez: iletilmiş belge yeniden gönderilmez (409)");
          break;
        }
        resendGuard(doc, event, at);
        doc.history.push({ type: SEND_INTENT, at, payload: {} });
        if (event.olay === "gonder_red") {
          doc.history.push({ type: "invoice.e.send-failed", at, payload: { status: "error", code: "integrator-rejected" } });
          doc.state = "error";
        } else {
          doc.history.push({ type: "invoice.e.send-failed", at, payload: { status: "none", code: "integrator-uncertain" } });
          doc.state = "uncertain";
        }
        break;
      case "belirsiz_kesinlesti_kabul":
        if (doc.state === "waiting") {
          note(event, "üretilemez: gönderilmemiş belgede Durum Sorgula yok");
          break;
        }
        write(doc, "invoice.e.status", doc.state === "cancelled" ? "cancelled" : "sent", at);
        doc.history.push({ type: "invoice.e.status", at, payload: { status: "sent" } });
        if (doc.state !== "cancelled") doc.state = "accepted";
        break;
      case "belirsiz_kesinlesti_red":
        if (doc.state === "waiting") {
          note(event, "üretilemez: gönderilmemiş belgede Durum Sorgula yok");
          break;
        }
        if (doc.state === "uncertain" || doc.state === "error") {
          write(doc, "invoice.e.status", "error", at);
          doc.history.push({ type: "invoice.e.status", at, payload: { status: "error" } });
          doc.state = "error";
        }
        break;
      case "durum_bulunamadi":
        if (doc.state === "uncertain" || doc.state === "error") missing(doc, at);
        else note(event, `üretilemez: ${doc.state} belgede "bulunamadı" programda durumu değiştirmez`);
        break;
      case "zaten_gonderilmis_11048":
        if (!sendable) {
          note(event, "üretilemez: iletilmiş belge yeniden gönderilmez (409)");
          break;
        }
        resendGuard(doc, event, at);
        doc.history.push({ type: SEND_INTENT, at, payload: {} });
        doc.state = "uncertain"; // markSending: istek EDM'ye giderken belge "Sonucu Belirsiz"
        write(doc, "invoice.e.duplicate", "sent", at);
        doc.history.push({ type: "invoice.e.duplicate", at, payload: { status: "sent", code: "11048" } });
        doc.state = "accepted";
        break;
      case "durum_sorgusu":
        if (doc.state === "accepted" || doc.state === "cancelled") write(doc, "invoice.e.status", doc.state === "cancelled" ? "cancelled" : "sent", at);
        break;
      case "iptal":
        if (doc.state === "accepted") doc.state = "cancelled";
        else doc.gone = true;
        break;
      case "belge_silindi":
        if (doc.state !== "accepted" && doc.state !== "cancelled") doc.gone = true;
        break;
      default:
        throw new Error(`bilinmeyen olay: ${event.olay}`);
    }
    snap(doc, event.ms);
  }
  return { rows: [...ledger.values()], notes };
}

const cellsOf = rows => {
  const out = {};
  for (const row of summarizeUsage(rows)) for (const kind of USAGE_KINDS) if (row[kind]) out[`${row.month}|${row.env}|${kind}`] = row[kind];
  return out;
};

const [, , inputPath, outputPath, notesPath] = process.argv;
const input = JSON.parse(readFileSync(inputPath, "utf8"));
const output = {};
const allNotes = {};
for (const scenario of input.senaryolar) {
  const full = run(scenario);
  const usage = {};
  for (const ref of scenario.referanslar || []) {
    const refMs = toMs(ref);
    const months = windowMonths(isoDay(new Date(refMs)));
    const aylik = {};
    for (const row of summarizeUsage(run(scenario, refMs).rows, { months })) for (const kind of USAGE_KINDS) aylik[`${row.month}|${row.env}|${kind}`] = row[kind];
    usage[ref] = { aylar: months, aylik };
  }
  output[scenario.ad] = { sayilar: cellsOf(full.rows), usage };
  if (full.notes.length) allNotes[scenario.ad] = { yapay: scenario.yapay, not_sayisi: full.notes.length, ornek: full.notes.slice(0, 6) };
}
writeFileSync(outputPath, `${JSON.stringify(output, null, 1)}\n`);
if (notesPath) writeFileSync(notesPath, `${JSON.stringify(allNotes, null, 1)}\n`);
console.log(`${Object.keys(output).length} senaryo yazıldı → ${outputPath}; not içeren senaryo: ${Object.keys(allNotes).length}`);
