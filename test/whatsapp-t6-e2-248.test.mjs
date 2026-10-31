// 2.4.8 T6-E2 (BAŞ MİMAR KARARI; T6 arıza testi test/t6-248/de-meta-internet.mjs e2 "reminder" — wt-t6-248 — süreç içinde kalıcılaştırıldı): ödeme hatırlatmasında (ilk
// istek ileti isteği) iki ileti ARASINDAKİ internet kesintisi, HTTP havuzundaki eski (kesintide ölmüş) soket yüzünden kişiyi "Bağlantı Bekleniyor" yerine "Sonucu
// Belirsiz" yapıyordu — ileti Meta'ya HİÇ ulaşmamıştı, kendiliğinden de gönderilmiyordu (R1'e aykırı; kişi ileti almıyor).
// Beklenen: ileti isteği (POST /messages) havuzdaki soketi kullanmaz — her ileti isteği yeni bağlantı; bağlantı kurulamazsa "gönderilmedi" (R1, Bağlantı Bekleniyor,
// bağlantı dönünce kendiliğinden gider, çift 0); bağlantı kurulduktan sonraki kopma "Sonucu Belirsiz" kalır (§7a 10 güvenli yön).
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5) önünde yerel TCP ara sunucusu. Gerçek kesintide (kablo, Wi-Fi) eski soket FIN/RST
// almaz: "kara delik" kipinde açık soketler AÇIK kalır ama veri iletilmez, yeni bağlantılar reddedilir. Kesinti ilk iletiden HEMEN sonra (havuzdaki soket canlıyken)
// zorla oluşturulur (ders 20). Sahte saat (ders 13).
// Havuz: programın gerçek dış istek katmanı (lib/net-proxy.mjs createProxyFetch) BELİRLENİMCİ bir keep-alive havuzu (node:http Agent, keepAlive) üzerine kurulur —
// Node'un yerleşik fetch havuzu bu süreç içi düzende boşta soketi kimi koşuda kendisi kapatıyor / yeniden kullanmıyor (ön koşul kendiliğinden oluşmuyor; T6 gerçek
// süreç koşusunda oluştu). Ön koşul doğrudan denetlenir: kesinti anında havuzda boşta, canlı soket VAR.
import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import { Readable } from "node:stream";
import { describe, it } from "node:test";
import { createProxyFetch } from "../server/lib/net-proxy.mjs";
import { MetaGraphError, createMetaGraph, neverReachedMeta } from "../server/lib/whatsapp/meta-graph.mjs";
import { PNID, PROGRAM_TEMPLATES, TOKEN, WABA, startWa } from "./whatsapp-248-ortak.mjs";
import { startFakeGraph } from "./whatsapp-sahte-graph.mjs";

/** fetch imzalı, keep-alive havuzlu (agent) basit istemci — yalnız bu testin taban fetch'i. */
function pooledFetch(agent) {
  return (url, init = {}) =>
    new Promise((resolve, reject) => {
      const target = new URL(url);
      const body = init.body === undefined || init.body === null ? null : Buffer.from(String(init.body));
      const headers = Object.fromEntries(Object.entries(init.headers || {}).map(([key, value]) => [key.toLowerCase(), String(value)]));
      if (body) headers["content-length"] = String(body.length);
      const request = http.request({ host: target.hostname, port: target.port, method: init.method || "GET", path: `${target.pathname}${target.search}`, headers, agent });
      const onAbort = () => request.destroy(Object.assign(new Error("aborted"), { name: "AbortError" }));
      init.signal?.addEventListener("abort", onAbort, { once: true });
      request.once("response", response => {
        const out = new Headers();
        for (const [key, value] of Object.entries(response.headers)) for (const item of [].concat(value)) out.append(key, String(item));
        resolve(new Response(Readable.toWeb(response), { status: response.statusCode, headers: out }));
      });
      request.once("error", reject);
      if (body) request.write(body);
      request.end();
    });
}

function startProxy(targetPort) {
  const pairs = new Set();
  let mode = "normal";
  let server = null;
  let port = 0;
  const onConn = client => {
    if (mode !== "normal") return client.destroy();
    const upstream = net.connect(targetPort, "127.0.0.1");
    const pair = { client, upstream };
    pairs.add(pair);
    client.on("data", data => mode === "normal" && upstream.write(data));
    upstream.on("data", data => mode === "normal" && client.write(data));
    client.on("close", () => {
      upstream.destroy();
      pairs.delete(pair);
    });
    upstream.on("close", () => mode === "normal" && client.destroy());
    client.on("error", () => {});
    upstream.on("error", () => {});
  };
  const listen = () =>
    new Promise(resolve => {
      server = net.createServer(onConn);
      server.listen(port, "127.0.0.1", () => {
        port = server.address().port;
        resolve();
      });
    });
  return {
    listen,
    get url() {
      return `http://127.0.0.1:${port}`;
    },
    live: () => [...pairs].filter(pair => !pair.client.destroyed).length,
    /** Kara delik: dinleyici kapanır (yeni bağlantı reddedilir), açık soketler açık kalır, veri iletilmez. (close'un geri çağrısı açık soketler kapanınca gelir —
     *  beklenmez; dinleyici hemen kapanır.) */
    blackhole: () => {
      mode = "blackhole";
      for (const pair of pairs) pair.upstream.destroy();
      server.close();
    },
    async restore() {
      for (const pair of pairs) pair.client.destroy();
      mode = "normal";
      await listen();
    },
    close: () =>
      new Promise(resolve => {
        for (const pair of pairs) pair.client.destroy();
        server.close(() => resolve());
      }),
  };
}

describe("2.4.8 T6-E2 — ileti isteği havuzdaki eski soketi kullanmaz; bağlantı kurulamayan istek 'gönderilmedi' (R1)", () => {
  it("ödeme hatırlatması: kesinti iki ileti ARASINDA (havuzdaki soket canlıyken) → Bağlantı Bekleniyor, Sonucu Belirsiz yok; dönünce kendiliğinden gider, çift 0", { timeout: 60_000 }, async () => {
    const real = await startFakeGraph({ token: TOKEN, phoneNumberId: PNID, wabaId: WABA });
    real.state.templates.push(...PROGRAM_TEMPLATES());
    const proxy = startProxy(Number(new URL(real.url).port));
    await proxy.listen();
    let ctx = null;
    const agent = new http.Agent({ keepAlive: true, maxSockets: 4 });
    const idle = () => Object.values(agent.freeSockets).flat().length;
    try {
      ctx = await startWa({ fake: { ...real, url: proxy.url }, whatsappTimeoutMs: 1500, fetchImpl: createProxyFetch({ resolve: () => ({ proxy: null, bypass: [] }), baseFetch: pooledFetch(agent) }) });
      const ids = [];
      for (let i = 0; i < 3; i += 1) {
        const a = await ctx.account(`Arada Hatırlatma ${i}`, `0532 820 00 0${i}`);
        const plan = await ctx.api.post("/api/workspace/plans", { accountId: a.id, name: "Taksit", total: "900", count: 3, firstDue: "2026-11-05", startDate: "2026-11-03" });
        assert.equal(plan.status, 200, JSON.stringify(plan.data).slice(0, 300));
        ids.push(a.id);
      }
      ctx.clock.advance(17 * 24 * 3_600_000); // ilk taksitin vadesi (05.11) geçti
      const created = await ctx.batch({ kind: "reminder", ids });
      assert.equal(created.status, 200, JSON.stringify(created.data));
      const id = created.data.data.batch.id;
      await ctx.wa.scheduler.runOnce();
      assert.equal(real.state.messages.length, 1, "ön koşul: ilk ileti gitti");
      // Yanıt programa ulaşsın, soket HTTP havuzuna dönsün (gerçek zaman; havuzdaki soketin ömrü ~4 sn) — kesinti havuzda canlı soket VARKEN gelir (ders 20).
      await new Promise(resolve => setTimeout(resolve, 50));
      assert.ok(idle() >= 1 && proxy.live() >= 1, `ön koşul: havuzda boşta canlı soket var (havuz ${idle()}, ara sunucu ${proxy.live()})`);
      proxy.blackhole();
      await ctx.wa.scheduler.runOnce();
      const during = await ctx.detail(id);
      const states = during.jobs.map(job => job.state);
      assert.equal(states.filter(state => state === "uncertain").length, 0, `Meta'ya hiç ulaşmayan ileti 'Sonucu Belirsiz' olmamalı (işler ${states.join(", ")})`);
      assert.equal(during.pauseCode, "offline", `toplu iş 'Bağlantı Bekleniyor' olmalı (geldi ${during.pauseCode || "—"}: ${during.pauseReason || ""})`);
      assert.equal(states.filter(state => state === "failed").length, 0);
      await proxy.restore();
      ctx.clock.advance(61_000);
      await ctx.drain();
      const done = await ctx.detail(id);
      assert.deepEqual(done.jobs.map(job => job.state), ["accepted", "accepted", "accepted"], `dönünce herkes gitmeli (işler ${done.jobs.map(job => job.state).join(", ")})`);
      const per = {};
      for (const item of real.state.messages) per[item.to] = (per[item.to] || 0) + 1;
      assert.deepEqual(Object.values(per), [1, 1, 1], `kişi başına bir ileti (${JSON.stringify(per)})`);
    } finally {
      await ctx?.close();
      agent.destroy();
      await proxy.close();
      await real.close();
    }
  });

  it("bağlantı kurulamadan süre doldu (sunucu TCP'yi kabul eder, TLS hiç kurulmaz) → 'Meta'ya hiç ulaşmadı'; bağlantı kurulduktan sonra yanıtsızlık → belirsiz", async () => {
    const sockets = new Set();
    const silent = net.createServer(socket => {
      sockets.add(socket);
      socket.on("error", () => {});
    });
    await new Promise(resolve => silent.listen(0, "127.0.0.1", resolve));
    const port = silent.address().port;
    const fetchImpl = createProxyFetch({ resolve: () => ({ proxy: null, bypass: [] }) });
    try {
      const graph = createMetaGraph({ baseUrl: `https://127.0.0.1:${port}`, fetchImpl, openToken: () => TOKEN, timeoutMs: 600 });
      const error = await graph.sendTemplate(PNID, { to: "+905321112233", name: "destekofis_ekstre", language: "tr", components: [] }).then(
        () => null,
        caught => caught,
      );
      assert.ok(error instanceof MetaGraphError, String(error));
      assert.equal(neverReachedMeta(error), true, `TLS kurulmadan düşen ileti isteği 'hiç ulaşmadı' sayılmalı (${error.reason}: ${error.title} / ${error.details || ""})`);
    } finally {
      for (const socket of sockets) socket.destroy();
      await new Promise(resolve => silent.close(resolve));
    }
    // Bağlantı kurulduktan sonra yanıt gelmez (HTTP sunucusu isteği alır, yanıt vermez): ileti Meta'ya ulaşmış olabilir → BELİRSİZ kalır (§7a 10).
    const held = [];
    const mute = net.createServer(socket => {
      held.push(socket);
      socket.on("error", () => {});
      socket.on("data", () => {});
    });
    await new Promise(resolve => mute.listen(0, "127.0.0.1", resolve));
    try {
      const graph = createMetaGraph({ baseUrl: `http://127.0.0.1:${mute.address().port}`, fetchImpl, openToken: () => TOKEN, timeoutMs: 600 });
      const error = await graph.sendTemplate(PNID, { to: "+905321112233", name: "destekofis_ekstre", language: "tr", components: [] }).then(
        () => null,
        caught => caught,
      );
      assert.ok(error instanceof MetaGraphError, String(error));
      assert.equal(error.reason, "timeout");
      assert.equal(neverReachedMeta(error), false, "bağlantı kurulduktan sonraki yanıtsızlık belirsiz kalmalı");
    } finally {
      for (const socket of held) socket.destroy();
      await new Promise(resolve => mute.close(resolve));
    }
  });
});

