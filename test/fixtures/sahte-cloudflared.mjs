// 2.4.7 M4 test yardımcısı: SAHTE cloudflared (gerçek ikili indirilmez, Cloudflare'e bağlanılmaz). Programın verdiği komut satırını ve yapılandırma
// dosyasını OKUR, yapılandırmadaki TEK kuralın hizmetine (uzak dinleyici) giden küçük bir ters vekil açar — tünelin yerel ucu gibi: gelen isteği
// httpHostHeader ile hizmete aktarır. Böylece test "tünelden giren istek nereye gidiyor" sorusunu gerçek yapılandırmayla sınar.
// Kullanım (argsPrefix): node sahte-cloudflared.mjs --sahte-log <dosya> --sahte-mod <bagli|coker|torun> [cloudflared argümanları …]
//   bagli: "Registered tunnel connection" yazar, açık kalır;  coker: 150 ms sonra çıkış kodu 1 (bağlanmadan çöker);
//   torun: bagli + uyuyan bir torun süreç açar (süreç AĞACI kapanıyor mu?).
// Her açılışta günlüğe bir JSON satırı: { pid, mod, port, args, tokenPresent, torun }.
import { spawn } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import http from "node:http";

const argv = process.argv.slice(2);
const opt = name => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : "";
};
const logFile = opt("--sahte-log");
const mode = opt("--sahte-mod") || "bagli";
const configFile = opt("--config");
const record = extra => logFile && appendFileSync(logFile, `${JSON.stringify({ pid: process.pid, mod: mode, args: argv, tokenPresent: Boolean(process.env.TUNNEL_TOKEN), tokenLength: String(process.env.TUNNEL_TOKEN || "").length, ...extra })}\n`);

process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));

if (mode === "coker") {
  record({});
  console.error("ERR Failed to create new tunnel connection error=\"sahte çöküş\"");
  setTimeout(() => process.exit(1), 150);
} else {
  let config = {};
  try {
    config = JSON.parse(readFileSync(configFile, "utf8"));
  } catch {
    config = {};
  }
  const rule = (config.ingress || [])[0] || {};
  const target = rule.service ? new URL(rule.service) : null;
  const hostHeader = rule.originRequest?.httpHostHeader || "";
  const proxy = http.createServer((req, res) => {
    if (!target) {
      res.writeHead(404).end();
      return;
    }
    const upstream = http.request({ host: target.hostname, port: target.port, method: req.method, path: req.url, headers: { ...req.headers, host: hostHeader || req.headers.host } }, reply => {
      res.writeHead(reply.statusCode, reply.headers);
      reply.pipe(res);
    });
    upstream.on("error", () => {
      if (!res.headersSent) res.writeHead(502);
      res.end();
    });
    req.pipe(upstream);
  });
  proxy.listen(0, "127.0.0.1", () => {
    let torun = null;
    if (mode === "torun") {
      const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });
      torun = child.pid;
    }
    record({ port: proxy.address().port, torun, service: rule.service || "", hostHeader, rules: (config.ingress || []).length });
    console.error(`INF Registered tunnel connection connIndex=0 connection=sahte event=0 ip=127.0.0.1 location=sahte protocol=quic`);
  });
}
