// Ders 20 zorla üretme ön yüklemesi (`node --import`) — CI #1050 (12dcad12) Linux Node 22 T16 kırmızısı (06.11.2026): "imzalı bildirim istek Meta'dayken işi
// ilerletir" hücresinde satır 'delivered' yerine 'uncertain' kaldı. Ürün koduna dokunmaz; yalnız gözler ve (yavas kipinde) olay döngüsünü kilitler.
//   T16_ZORLA=olc   — yalnız ölçer: [t16-zorla] satırları (sahte Meta'ya ileti isteği geldi / sahte Meta yanıtladı / defterde teslim yazıldı / defterde deneme sonucu /
//                     iş satırına "uncertain" yazıldı — yazanın yığın satırlarıyla).
//   T16_ZORLA=yavas — ölçer + defterde teslim YAZILDIKTAN hemen sonra (imzalı bildirim uygulandı, ileti isteği henüz sonuçlanmadı) olay döngüsünü T16_ZORLA_MS
//                     (varsayılan 900) ms KİLİTLER: yüklü CI koşucusunda SQLite yazımı / CPU yüzünden duran olay döngüsü. Kilit testin 800 ms'lik istemci süre
//                     sınırını aşınca istek "yanıtsız" sayılır.
// Ön koşul (CI'deki sıra) çıktıdan okunur (test/whatsapp-t16-zorla.mjs): "defter-teslim" → "kilit-basladi" → (kilit ≥ süre sınırı) → ileti isteğinin sonucu.
import http from "node:http";
import { StatementSync } from "node:sqlite";

const mode = process.env.T16_ZORLA || "";
if (mode === "olc" || mode === "yavas") {
  const t0 = Date.now();
  const log = text => process.stderr.write(`[t16-zorla] +${Date.now() - t0} ms ${text}\n`);
  // Yazanın kim olduğu: yığındaki server/lib/whatsapp/*.mjs satırları (dosya:satır, işlev).
  const writer = () =>
    (new Error().stack || "")
      .split(/\r?\n/)
      .filter(line => /server[\\/]lib[\\/]whatsapp[\\/]/.test(line))
      .slice(0, 4)
      .map(line => line.trim().replace(/^at\s+/, "").replace(/\(?(?:file:\/\/)?[^()]*[\\/](server[\\/]lib[\\/]whatsapp[\\/][^()]+)\)?/, "$1"))
      .join(" < ");
  const emit = http.Server.prototype.emit;
  http.Server.prototype.emit = function (event, req, res) {
    if (event === "request" && req?.method === "POST" && /\/messages(\?|$)/.test(String(req.url || ""))) {
      log("sahte-meta-ileti-istegi-geldi");
      res?.on?.("finish", () => log(`sahte-meta-yanitladi ${res.statusCode}`));
    }
    return emit.apply(this, arguments);
  };
  const ms = Number(process.env.T16_ZORLA_MS || 900);
  const lock = new Int32Array(new SharedArrayBuffer(4));
  let stalled = false;
  const run = StatementSync.prototype.run;
  StatementSync.prototype.run = function (...args) {
    const result = run.apply(this, args);
    const sql = String(this.sourceSQL || "");
    if (/^INSERT OR IGNORE INTO deliveries\b/.test(sql) && result?.changes) {
      log("defter-teslim-yazildi");
      if (mode === "yavas" && !stalled) {
        stalled = true;
        setImmediate(() => {
          log(`kilit-basladi ${ms} ms`);
          Atomics.wait(lock, 0, 0, ms);
          log("kilit-bitti");
        });
      }
    } else if (/^INSERT OR IGNORE INTO outcomes\b/.test(sql)) {
      log(`defter-sonuc ${args[2]} ${result?.changes ? "yazildi" : "yok-sayildi (deneme sonucu zaten var)"} · ${writer()}`);
    } else if (/^UPDATE wa_jobs SET\b/.test(sql) && args.includes("uncertain")) {
      log(`is-satiri-uncertain · ${writer()}`);
    }
    return result;
  };
}
