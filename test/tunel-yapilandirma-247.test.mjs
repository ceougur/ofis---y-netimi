// 2.4.7 M4 — cloudflared yapılandırması (server/lib/tunnel/config.mjs; docs/mobil/M4-TASARIM.md §4): tünel YALNIZ uzak dinleyiciye (127.0.0.1:<uzak port>)
// bağlanır; ofis ağının ana portu, 0.0.0.0, başka bilgisayar, ek kural ya da 404 dışı son kural yapılandırmaya giremez; belirteç komut satırında yok.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { assertSafeIngress, buildIngress, cloudflaredArgs, ingressYaml } from "../server/lib/tunnel/config.mjs";

const HOST = "oabcdefghijklmnop.destekofis.net";
const ID = "12345678-1234-4234-8234-123456789abc";

describe("M4 tünel yapılandırması", () => {
  test("tek kural: ofis adı → http://127.0.0.1:<uzak port>, Host ofis adı; sonra 404", () => {
    const config = buildIngress({ hostname: HOST, tunnelId: ID, remotePort: 43211, forbiddenPorts: [5123, 5124] });
    assert.deepEqual(config.ingress.map(rule => [rule.hostname || "", rule.service]), [[HOST, "http://127.0.0.1:43211"], ["", "http_status:404"]]);
    assert.equal(config.ingress[0].originRequest.httpHostHeader, HOST);
    assert.equal(config.tunnel, ID);
    assert.deepEqual(JSON.parse(ingressYaml(config)), config, "yazılan dosya aynı yapı (JSON ⊂ YAML)");
    assert.equal(assertSafeIngress(config, { remotePort: 43211, forbiddenPorts: [5123] }), true);
  });

  test("ana port (ofis ağı) asla: uzak port ana porta eşitse yapılandırma kurulmaz", () => {
    assert.throws(() => buildIngress({ hostname: HOST, tunnelId: ID, remotePort: 5123, forbiddenPorts: [5123] }), { code: "config" });
    assert.throws(() => assertSafeIngress(buildIngress({ hostname: HOST, tunnelId: ID, remotePort: 5123 }), { remotePort: 5123, forbiddenPorts: [5123] }), { code: "config" });
  });

  test("bozuk girdiler reddedilir: ad, tünel kimliği, port", () => {
    for (const hostname of ["", "kotu ad", "a..b", "-x.destekofis.net", "localhost"]) assert.throws(() => buildIngress({ hostname, tunnelId: ID, remotePort: 4000 }), { code: "config" }, hostname);
    assert.throws(() => buildIngress({ hostname: HOST, tunnelId: "x", remotePort: 4000 }), { code: "config" });
    for (const remotePort of [0, -1, 70000, 1.5, "4000"]) assert.throws(() => buildIngress({ hostname: HOST, tunnelId: ID, remotePort }), { code: "config" }, String(remotePort));
  });

  test("elle bozulmuş yapılandırma (ek kural, başka hizmet, 0.0.0.0, son kural 404 değil) açılış öncesi denetimde reddedilir", () => {
    const base = buildIngress({ hostname: HOST, tunnelId: ID, remotePort: 4000 });
    const extra = { ...base, ingress: [base.ingress[0], { hostname: "x.destekofis.net", service: "http://127.0.0.1:5123" }, base.ingress[1]] };
    const other = { ...base, ingress: [{ ...base.ingress[0], service: "http://0.0.0.0:4000" }, base.ingress[1]] };
    const lan = { ...base, ingress: [{ ...base.ingress[0], service: "http://192.168.1.10:4000" }, base.ingress[1]] };
    const open = { ...base, ingress: [base.ingress[0], { service: "http://127.0.0.1:5123" }] };
    for (const config of [extra, other, lan, open]) assert.throws(() => assertSafeIngress(config, { remotePort: 4000, forbiddenPorts: [5123] }), { code: "config" });
  });

  test("komut satırı: kendiliğinden güncelleme kapalı, belirteç YOK (ortam değişkeninde), ölçüm yalnız yerel döngüde", () => {
    const args = cloudflaredArgs({ configFile: "C:\\veri\\tunel.yml" });
    assert.ok(args.includes("--no-autoupdate"));
    assert.equal(args.at(-1), "run");
    assert.ok(!args.includes("--token"));
    assert.equal(args[args.indexOf("--metrics") + 1], "127.0.0.1:0");
    assert.equal(args[args.indexOf("--config") + 1], "C:\\veri\\tunel.yml");
  });
});
