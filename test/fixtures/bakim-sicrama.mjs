// Ders 20 BELİRLENİMCİ zorla üretme ön yüklemesi (`node --import`; test/whatsapp-b3-buyume-zorla.mjs kullanır, bu bir test değildir). WhatsApp işçisinin ara bakımı
// GERÇEK saatle (Date.now) 60 sn'de bir koşar (server/lib/whatsapp/scheduler.mjs turn(), maintainMs). Bu dosya aynı süreçteki sahte Graph sunucusuna (test/whatsapp-sahte-graph.mjs,
// node:http) gelen ileti isteklerini (POST /<sürüm>/<id>/messages) sayar ve B3_SICRAMA_ILETI listesindeki sıra numaralı iletinin yanıtı gidince gerçek saati B3_SICRAMA_MS
// (varsayılan 61 sn) ileri atar → bir sonraki işin turunda ara bakım koşar (o turun ortası). Programın ileti isteği config.fetchImpl / net-proxy directFresh ile gider
// (globalThis.fetch değil), bu yüzden sayım sunucu tarafında. Arada gerçek saat B3_SAAT_HIZI (varsayılan 0,1) hızıyla akar → kendiliğinden ara bakım ancak 600 sn gerçek
// sürede bir; test bundan kısa sürdükçe başka tur ara bakım görmez (ölçüm satırının 6. alanı her turda gösterir; betik beklenen turlarla karşılaştırır).
// Programın sahte saati (config.now) etkilenmez. Benzetim gerçek platform değildir (ders 18).
import http from "node:http";

const jumps = new Set(String(process.env.B3_SICRAMA_ILETI || "").split(",").map(s => Number(s.trim())).filter(n => Number.isInteger(n) && n > 0));
const jumpMs = Number(process.env.B3_SICRAMA_MS || 61_000);
const rate = Math.min(1, Math.max(0, Number(process.env.B3_SAAT_HIZI ?? 0.1)));
const realNow = Date.now.bind(Date);
const t0 = realNow();
let offset = 0;
let sent = 0;
let last = t0;
Date.now = () => t0 + Math.floor((realNow() - t0) * rate) + offset;

const emit = http.Server.prototype.emit;
http.Server.prototype.emit = function patchedEmit(event, req, res, ...rest) {
  if (event === "request" && req?.method === "POST" && /\/\d+\/messages(\?|$)/.test(String(req.url || ""))) {
    res.once("finish", () => {
      sent += 1;
      if (jumps.has(sent)) {
        offset += jumpMs;
        process.stdout.write(`# B3 sıçrama: ileti ${sent} sonrası gerçek saat +${jumpMs} ms\n`);
      }
      // Tur süresi (200 ileti; gerçek saat): yavaş makinede ara bakımın hangi tura düşeceğini gösterir (≈ 60 sn / tur süresi).
      if (sent % 200 === 0) {
        const now = realNow();
        process.stdout.write(`# B3 tur süresi: ileti ${sent} · ${now - last} ms (başlangıçtan ${now - t0} ms)\n`);
        last = now;
      }
    });
  }
  return emit.call(this, event, req, res, ...rest);
};
