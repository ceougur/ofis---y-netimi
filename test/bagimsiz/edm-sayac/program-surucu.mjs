// 2.4.7 E4 — PROGRAM SÜRÜCÜSÜ (kâhin karşılaştırması). kabul.json'daki olay listelerini programın GERÇEK sayaç işlevlerinden geçirir
// (server/lib/einvoice/kullanim.mjs: usageFromTransitions → usageDecision / attemptAtOf / usageKindOf / monthOf, summarizeUsage + windowMonths) ve
// kâhinin çıktı biçimini yazar (README "Çıktı biçimi"). Kâhinin koduna bakılmadı; yalnız README'deki olay sözlüğü ve çıktı biçimi.
//
// EŞLEME (olay → programın yazdığı durum ve İşlem Geçmişi; server/routes/invoices.mjs sendInvoiceOnce / e-refresh / setE / clearE / markSending'den):
//   gonder_kabul, yeniden_deneme_kabul  — belge belirsizse önce Durum Sorgula "bulunamadı" (clearE: invoice.e.status missing); sonra gönderim izi
//                                         (invoice.e.sending) + invoice.e.sent (kabul). İletilmiş / iptal edilmiş belgede program göndermez (409).
//   gonder_red                          — (belirsizse önce "bulunamadı") iz + invoice.e.send-failed {status: error}.
//   gonder_belirsiz                     — (belirsizse önce "bulunamadı") iz + invoice.e.send-failed {status: none} (Sonucu Belirsiz).
//   belirsiz_kesinlesti_kabul           — Durum Sorgula kabul: setE invoice.e.status (önceki durum neyse o; yalnız belirsizden sayılır).
//   belirsiz_kesinlesti_red             — Durum Sorgula "bulunamadı" (clearE) — yalnız belirsiz belgede.
//   zaten_gonderilmis_11048             — yeniden gönderim: (belirsizse önce "bulunamadı") iz → EDM 11048 kendi ETTN'i → durum bulunur →
//                                         setE invoice.e.duplicate (önceki durum = markSending'in belirsizi). İletilmiş belgede program göndermez.
//   durum_sorgusu                       — iletilmiş belgede setE invoice.e.status aynı durumla; belirsizde "değişmedi" = sorgu sonuçsuz (yazım yok).
//   iptal                               — iletilmiş: e-Belge iptali (durum cancelled, setE değil); belirsiz / bekleyen: belge programda iptal edilir —
//                                         program o belgeyle başka işlem yapamaz (sonraki olaylar ÜRETİLEMEZ → atlanır, sayılır ve raporlanır).
//   belge_silindi                       — iletilmemiş belge silinir (sonraki olaylar üretilemez); iletilmiş belge silinmez (program reddeder).
//   yedekten_geri_yuklendi              — şirketin belge durumları ve İşlem Geçmişi yedek anına döner; kullanım defteri DEĞİŞMEZ (S4).
//   sirket_sifirlandi                   — şirketin faturaları silinir (sonraki olaylar üretilemez); defter DEĞİŞMEZ (S4).
//   gecmis (2.4.6)                      — belge o durumda başlar; izi sayacın başlangıcından (since = ilk 2.4.7 olayı) önce.
// Saat: kâhin V1 (TR sabit UTC+3). Program sunucunun yerel saatini kullanır → sürücü TZ=Europe/Istanbul ile koşar (komut aşağıda).
// Aynı saniye sırası: README V8 (deneme → 11048 → durum → kesinleşme → iptal → silme/bakım; sınıf içinde giriş sırası).
//
// Komut: TZ=Europe/Istanbul node test/bagimsiz/edm-sayac/program-surucu.mjs test/bagimsiz/edm-sayac/kabul.json <çıktı.json> [<üretilemeyen.json>]
import { readFileSync, writeFileSync } from "node:fs";
import { SEND_INTENT } from "../../../server/lib/einvoice/iptal-suresi.mjs";
import { USAGE_KINDS, summarizeUsage, usageFromTransitions, windowMonths } from "../../../server/lib/einvoice/kullanim.mjs";
import { isoDay } from "../../../server/lib/plans.mjs";

if (process.env.TZ !== "Europe/Istanbul") {
  console.error("TZ=Europe/Istanbul ile koşun (programın 'bugün'ü sunucunun yerel günüdür; kâhin V1 TR saatidir).");
  process.exit(2);
}
const PROFILE = { efatura: "TEMELFATURA", earsiv: "EARSIVFATURA", esmm: "ESMM" };
const CLASS = { gonder_kabul: 0, gonder_red: 0, gonder_belirsiz: 0, yeniden_deneme_kabul: 0, zaten_gonderilmis_11048: 1, durum_sorgusu: 2, belirsiz_kesinlesti_kabul: 3, belirsiz_kesinlesti_red: 3, iptal: 4, belge_silindi: 5, yedekten_geri_yuklendi: 5, sirket_sifirlandi: 5 };
const toMs = value => {
  const text = String(value);
  return Date.parse(/(Z|[+-]\d{2}:\d{2})$/.test(text) ? text : `${text}+03:00`);
};
const iso = ms => new Date(ms).toISOString();
const PREVIOUS = { waiting: { eStatus: "waiting", eAdapter: "" }, uncertain: { eStatus: "none", eAdapter: "edm" }, accepted: { eStatus: "sent", eAdapter: "edm" }, error: { eStatus: "error", eAdapter: "edm" }, cancelled: { eStatus: "cancelled", eAdapter: "edm" } };

function run(scenario, refMs = Infinity) {
  const events = scenario.olaylar.map((event, index) => ({ ...event, index, ms: toMs(event.zaman) })).filter(event => event.ms <= refMs);
  events.sort((a, b) => a.ms - b.ms || CLASS[a.olay] - CLASS[b.olay] || a.index - b.index);
  const firstMs = scenario.olaylar.length ? Math.min(...scenario.olaylar.map(event => toMs(event.zaman))) : 0;
  const since = firstMs ? iso(firstMs) : "";
  const docs = new Map(); // anahtar → { company, env, kind, ettn, state, history, gone }
  const log = []; // şirket durum günlüğü (geri yükleme için): { company, ms, key, snapshot }
  const transitions = [];
  const unproducible = [];
  const keyOf = event => `${event.sirket}|${event.ortam}|${String(event.ettn).trim().toLowerCase()}`;
  const docOf = event => {
    const key = keyOf(event);
    if (!docs.has(key)) docs.set(key, { key, company: event.sirket, env: event.ortam, kind: event.tur, ettn: String(event.ettn).trim().toLowerCase(), state: "waiting", history: [], gone: false });
    return docs.get(key);
  };
  const snap = (doc, ms) => log.push({ company: doc.company, ms, key: doc.key, snapshot: { state: doc.state, history: [...doc.history], gone: doc.gone } });
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
  const write = (doc, action, status, at) => {
    transitions.push({ company: doc.company, ettn: doc.ettn, env: doc.env, profile: PROFILE[doc.kind], action, previous: PREVIOUS[doc.state], status, at, history: [...doc.history], since });
  };
  const missing = (doc, at) => {
    doc.history.push({ type: "invoice.e.status", at, payload: { status: "none", missing: true } });
    doc.state = "waiting";
  };
  for (const event of events) {
    const at = iso(event.ms);
    if (event.olay === "yedekten_geri_yuklendi") {
      const backupMs = toMs(event.yedek_zamani);
      for (const doc of docs.values()) {
        if (doc.company !== event.sirket) continue;
        const last = log.filter(entry => entry.key === doc.key && entry.ms <= backupMs).at(-1);
        Object.assign(doc, last ? { ...last.snapshot, history: [...last.snapshot.history] } : { state: "waiting", history: [], gone: true });
        snap(doc, event.ms);
      }
      continue;
    }
    if (event.olay === "sirket_sifirlandi") {
      for (const doc of docs.values()) if (doc.company === event.sirket) {
        doc.gone = true;
        snap(doc, event.ms);
      }
      continue;
    }
    const doc = docOf(event);
    if (doc.gone) {
      unproducible.push({ olay: event.olay, zaman: event.zaman, ettn: event.ettn, sirket: event.sirket, neden: "belge programda yok (iptal / silindi / sıfırlandı / yedekte yok)" });
      continue;
    }
    const sendable = !["accepted", "cancelled"].includes(doc.state);
    switch (event.olay) {
      case "gonder_kabul":
      case "yeniden_deneme_kabul":
        if (!sendable) {
          unproducible.push({ olay: event.olay, zaman: event.zaman, ettn: event.ettn, sirket: event.sirket, neden: "iletilmiş belge yeniden gönderilmez (409)" });
          break;
        }
        if (doc.state === "uncertain") missing(doc, at);
        doc.history.push({ type: SEND_INTENT, at, payload: {} });
        write(doc, "invoice.e.sent", "sent", at);
        doc.history.push({ type: "invoice.e.sent", at, payload: { status: "sent" } });
        doc.state = "accepted";
        break;
      case "gonder_red":
      case "gonder_belirsiz":
        if (!sendable) {
          unproducible.push({ olay: event.olay, zaman: event.zaman, ettn: event.ettn, sirket: event.sirket, neden: "iletilmiş belge yeniden gönderilmez (409)" });
          break;
        }
        if (doc.state === "uncertain") missing(doc, at);
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
          unproducible.push({ olay: event.olay, zaman: event.zaman, ettn: event.ettn, sirket: event.sirket, neden: "gönderilmemiş belgede Durum Sorgula yok" });
          break;
        }
        write(doc, "invoice.e.status", doc.state === "cancelled" ? "cancelled" : "sent", at);
        doc.history.push({ type: "invoice.e.status", at, payload: { status: "sent" } });
        if (doc.state !== "cancelled") doc.state = "accepted";
        break;
      case "belirsiz_kesinlesti_red":
        if (doc.state === "uncertain") missing(doc, at);
        break;
      case "zaten_gonderilmis_11048":
        if (!sendable) {
          unproducible.push({ olay: event.olay, zaman: event.zaman, ettn: event.ettn, sirket: event.sirket, neden: "iletilmiş belge yeniden gönderilmez (409)" });
          break;
        }
        if (doc.state === "uncertain") missing(doc, at);
        doc.history.push({ type: SEND_INTENT, at, payload: {} });
        doc.state = "uncertain"; // markSending: gönderim izi, istek EDM'ye giderken belge "Sonucu Belirsiz"
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
  return { rows: usageFromTransitions(transitions), unproducible };
}

const cellsOf = rows => {
  const out = {};
  for (const row of summarizeUsage(rows)) for (const kind of USAGE_KINDS) if (row[kind]) out[`${row.month}|${row.env}|${kind}`] = row[kind];
  return out;
};

const [, , inputPath, outputPath, unproduciblePath] = process.argv;
const input = JSON.parse(readFileSync(inputPath, "utf8"));
const output = {};
const notes = {};
for (const scenario of input.senaryolar) {
  const full = run(scenario);
  const usage = {};
  for (const ref of scenario.referanslar || []) {
    const refMs = toMs(ref);
    const months = windowMonths(isoDay(new Date(refMs)));
    const rows = run(scenario, refMs).rows;
    const aylik = {};
    for (const row of summarizeUsage(rows, { months })) for (const kind of USAGE_KINDS) aylik[`${row.month}|${row.env}|${kind}`] = row[kind];
    usage[ref] = { aylar: months, aylik };
  }
  output[scenario.ad] = { sayilar: cellsOf(full.rows), usage };
  if (full.unproducible.length) notes[scenario.ad] = { yapay: scenario.yapay, uretilemeyen: full.unproducible.length, ornek: full.unproducible.slice(0, 5) };
}
writeFileSync(outputPath, `${JSON.stringify(output, null, 1)}\n`);
if (unproduciblePath) writeFileSync(unproduciblePath, `${JSON.stringify(notes, null, 1)}\n`);
console.log(`${Object.keys(output).length} senaryo yazıldı → ${outputPath}; üretilemeyen olay içeren senaryo: ${Object.keys(notes).length}`);

