// Ders 20 zorla üretme ön yüklemesi (`node --import`) — CI #959 (0ecc90de) Windows Node 22 T35r kırmızısı (03.11.2026): "istek Meta'dayken yedek + geri
// yükleme" ön koşulu, Meta yanıtı geri yükleme bitip şirket yeniden açılmadan ÖNCE gelince bozulur (yavaş makine). Ürün koduna dokunmaz.
//   T35R_ZORLA=olc   — yalnız ölçer: [t35r-zorla] satırları (ileti isteği Meta'ya geldi / Meta yanıtladı / yedek / geri yükleme bitti / iş okundu, ms).
//   T35R_ZORLA=yavas — ölçer + geri yüklemenin dosya kopyasını (prepareRestoreFile: <veri>.geri-yukleme) T35R_ZORLA_MS (varsayılan 3500) ms boyunca
//                      olay döngüsünü KİLİTLEYEREK yavaşlatır: Windows'taki yavaş disk / yüklü koşucu. Geri yükleme, testin eski 2,5 sn'lik sahte Meta
//                      gecikmesinden uzun sürer — CI'deki sıranın ön koşulu.
// Ön koşulun oluştuğu çıktıdan okunur (test/whatsapp-t35r-yaris-zorla.mjs): "ileti isteği → geri yükleme bitti" süresi > 2500 ms.
import fs from "node:fs";
import http from "node:http";
import { syncBuiltinESMExports } from "node:module";

const mode = process.env.T35R_ZORLA || "";
if (mode === "olc" || mode === "yavas") {
  const t0 = Date.now();
  const log = text => process.stderr.write(`[t35r-zorla] +${Date.now() - t0} ms ${text}\n`);
  const emit = http.Server.prototype.emit;
  http.Server.prototype.emit = function (event, req, res) {
    if (event === "request" && req?.url) {
      const url = String(req.url);
      if (req.method === "POST" && /\/messages(\?|$)/.test(url)) log("ileti-istegi-meta-da");
      if (req.method === "POST" && /^\/api\/admin\/backups\/restore/.test(url)) log("geri-yukleme-basladi");
      res?.on?.("finish", () => {
        if (req.method === "POST" && /\/messages(\?|$)/.test(url)) log(`meta-yaniti-gonderildi ${res.statusCode}`);
        else if (req.method === "POST" && /^\/api\/admin\/backups\/restore/.test(url)) log(`geri-yukleme-bitti ${res.statusCode}`);
        else if (req.method === "POST" && /^\/api\/admin\/backups(\?|$)/.test(url)) log(`yedek-bitti ${res.statusCode}`);
        else if (req.method === "GET" && /^\/api\/workspace\/whatsapp\/batches\/[^/?]+/.test(url)) log(`is-okundu ${res.statusCode}`);
      });
    }
    return emit.apply(this, arguments);
  };
  if (mode === "yavas") {
    const ms = Number(process.env.T35R_ZORLA_MS || 3500);
    const copy = fs.copyFileSync;
    const lock = new Int32Array(new SharedArrayBuffer(4));
    fs.copyFileSync = function (source, target, ...rest) {
      if (/\.geri-yukleme$/.test(String(target))) {
        log(`yavaslatma ${ms} ms (geri yükleme kopyası)`);
        Atomics.wait(lock, 0, 0, ms);
      }
      return copy.call(this, source, target, ...rest);
    };
    syncBuiltinESMExports();
  }
}
