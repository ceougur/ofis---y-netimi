// 2.4.8 M1 + M2 — tünel durum göstergesi (server/lib/tunnel/manager.mjs) ve cloudflared günlük dosyası, SAHTE cloudflared ile (test/fixtures/sahte-cloudflared-dizi.mjs).
//
// Kaynak: CLAUDE.md "KULLANICI BULGUSU 2.4.7 CANLI" (30.10.2026 09:14 TR): ofis adresi çalışırken Yönetim → Mobil Cihazlar "Bağlanıyor — Bağlantı koptu; yeniden
// kuruluyor" dedi. Kuşku: bağlantı sayısı cloudflared çıktı satırlarından +1/−1 sayılıyor; aynı bağlantının birden çok satırı birden çok kez düşülüyor.
//
// Satırlar cloudflared 2026.10.5'in (release.mjs'teki sabit sürüm) KAYNAĞINDAN alındı (github.com/cloudflare/cloudflared, etiket 2026.10.5; zerolog konsol biçimi,
// alanlar adına göre sıralı; her satırda connIndex):
//   connection/observer.go:64      INF Registered tunnel connection connIndex=N connection=<uuid> event=0 ip=… location=… protocol=quic
//   connection/control.go:145      INF Unregistered tunnel connection connIndex=N event=0 ip=…      (denetim akışı düzgün kapanınca)
//   supervisor/tunnel.go:444       ERR Serve tunnel error error="…" connIndex=N event=0 ip=…
//   supervisor/tunnel.go:281       INF Retrying connection in up to 1s connIndex=N event=0 ip=…   (HER başarısız denemede bir kez)
//   supervisor/supervisor.go:147   ERR Connection terminated error="…" connIndex=N                 (Serve döndükçe, her denemede bir kez)
//   connection/http2.go:94         INF Lost connection with the edge connIndex=N                  (http2 protokolünde)
// Akış (supervisor/tunnel.go Serve + supervisor.go döngüsü): bir bağlantı düşünce önce "Serve tunnel error" + "Retrying connection …", bekleme sonunda
// "Connection terminated", sonra yeniden deneme; deneme de başarısızsa aynı üçlü YİNE yazılır. cloudflared'in kendi /ready sayacı (tunnelstate/conntracker.go:40–56)
// bağlantıyı connIndex başına tutar: Connected → o dizin bağlı; Disconnected / Reconnecting / Unregistering → o dizin bağlı değil (bir dizin bir kez sayılır).
//
// "Nasıl bozulur": tek bağlantı iki kez yeniden denenince sayaç 0'a iner ("koptu", tünel ayakta); bağlantı kopup dönünce sayaç her seferinde bir eksilir;
// "Unregistered" satırı (büyük/küçük harf duyarsız "Registered" içerir) bağlantı SAYILIR → dördü de düşmüşken "Bağlı"; süreç yeniden başlayınca eski sayılar kalır;
// gerçek kopuş (dördü de düşer) düzeltmeyle gizlenir; günlük dosyası yok / sınırsız büyür / belirteç yazılır.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";
import { TUNNEL_REASONS, createTunnelManager } from "../server/lib/tunnel/manager.mjs";

const FAKE = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "sahte-cloudflared-dizi.mjs");
const HOST = "oabcdefghijklmnop.destekofis.net";
const TUNNEL_ID = "12345678-1234-4234-8234-123456789abc";
const TOKEN = "sahteBelirtecDegeri-7f3a9c2e41b8d605";
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, ms, what) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return;
    await wait(20);
  }
  throw new Error(`${what} ${ms} ms içinde sağlanmadı`);
}

// cloudflared 2026.10.5 satırları (yukarıdaki kaynak satırları).
const T = "2026-10-30T06:52:01Z";
const ip = i => `198.41.192.${27 + i}`;
const kayit = i => `${T} INF Registered tunnel connection connIndex=${i} connection=6f1c2b3a-0d4e-4f5a-8b6c-7d8e9f0a1b2${i} event=0 ip=${ip(i)} location=ist0${1 + (i % 2)} protocol=quic`;
const coz = i => `${T} INF Unregistered tunnel connection connIndex=${i} event=0 ip=${ip(i)}`;
const hata = i => `${T} ERR Serve tunnel error error="timeout: no recent network activity" connIndex=${i} event=0 ip=${ip(i)}`;
const yeniden = (i, s = "1s") => `${T} INF Retrying connection in up to ${s} connIndex=${i} event=0 ip=${ip(i)}`;
const bitti = i => `${T} ERR Connection terminated error="timeout: no recent network activity" connIndex=${i}`;
const kenar = i => `${T} INF Lost connection with the edge connIndex=${i}`;
const ACILIS = [
  `${T} INF Starting tunnel tunnelID=${TUNNEL_ID}`,
  `${T} INF Version 2026.10.5 (Checksum 0000)`,
  `${T} INF Generated Connector ID: 0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d`,
  `${T} INF Initial protocol quic`,
  `${T} INF Starting metrics server on 127.0.0.1:41235/metrics`,
];
const dortBagli = [...ACILIS, kayit(0), kayit(1), kayit(2), kayit(3)];

/** Sahte cloudflared'le gerçek tünel yöneticisi (sahte depo, lisans, kapıcı; ağ yok). */
async function senaryo(adim, govde, { logMaxBytes } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "m1-tunel-durum-"));
  const root = path.join(dir, "bilesen");
  writeFileSync(path.join(dir, "dizi.json"), JSON.stringify(adim));
  const settings = new Map();
  const store = {
    setting: (key, fallback) => (settings.has(key) ? settings.get(key) : fallback),
    setSetting: (key, value) => settings.set(key, value),
    get: () => ({ n: 1 }), // eşli cihaz var → tünel istenir
  };
  const manager = createTunnelManager({
    store,
    license: { status: () => ({ writable: true }) },
    mobileRemote: { setPublicUrl() {} },
    listenRemote: async () => ({ port: 45678 }),
    gate: { provision: async () => ({ tunnelId: TUNNEL_ID, hostname: HOST, publicUrl: `https://${HOST}`, token: TOKEN }) },
    root,
    runner: { command: process.execPath, argsPrefix: [FAKE, "--sahte-dizi", path.join(dir, "dizi.json"), "--sahte-klasor", dir], identity: FAKE },
    tickMs: 50,
    firstTickMs: 10,
    stopGraceMs: 0,
    log: { warn() {}, error() {}, info() {} },
    ...(logMaxBytes ? { logMaxBytes } : {}),
  });
  manager.start();
  const ctx = {
    manager,
    root,
    // Sahte süreç "buraya kadar yazdım" dedikten sonra satırların yöneticiye ulaşması için kısa pay, sonra beklenen durum en çok 2 sn aranır; gelmezse SON durum yazılır.
    async durum(isaret, beklenen) {
      await until(() => existsSync(path.join(dir, isaret)), 15_000, `sahte cloudflared "${isaret}" işareti`);
      await wait(250);
      let son;
      const end = Date.now() + 2_000;
      do {
        const s = manager.status();
        son = { state: s.state, connections: s.connections, reason: s.reason };
        if (Object.keys(beklenen).every(k => son[k] === beklenen[k])) break;
        await wait(25);
      } while (Date.now() < end);
      return son;
    },
    ilerle: ad => writeFileSync(path.join(dir, ad), "1"),
  };
  try {
    await govde(ctx);
  } finally {
    await manager.stop();
    rmSync(dir, { recursive: true, force: true });
  }
}
const BAGLI = (n, s) => assert.deepEqual({ state: s.state, connections: s.connections }, { state: "connected", connections: n }, `beklenen: Bağlı, ${n} bağlantı; gelen: ${JSON.stringify(s)}`);

describe("2.4.8 M1 — tünel durum göstergesi bağlantıyı connIndex başına sayar (cloudflared'in kendi /ready sayacı gibi)", () => {
  test("0. dört bağlantı kurulunca Bağlı, 4 (açılış satırları sayılmaz)", async () => {
    await senaryo([...dortBagli, "@isaret:a"], async c => {
      BAGLI(4, await c.durum("a", { state: "connected", connections: 4 }));
    });
  });

  test("1. ZORLA ÜRETME: tek bağlantı (connIndex=2) iki kez yeniden denenip kurulamıyor, öbür üçü ayakta → Bağlı, 3 (\"Bağlantı koptu\" DEĞİL)", async () => {
    await senaryo([...dortBagli, hata(2), yeniden(2, "1s"), bitti(2), "@isaret:a", "@bekle:b", hata(2), yeniden(2, "2s"), bitti(2), "@isaret:c"], async c => {
      const ilk = await c.durum("a", { state: "connected", connections: 3 });
      c.ilerle("b");
      const s = await c.durum("c", { state: "connected", connections: 3 });
      // Önce kullanıcının gördüğü (ikinci başarısız denemeden sonraki) durum, sonra ara durum.
      assert.notEqual(s.reason, TUNNEL_REASONS.reconnecting, `üç bağlantı ayaktayken "${TUNNEL_REASONS.reconnecting}" yazmamalı; gelen ${JSON.stringify(s)}`);
      BAGLI(3, s);
      BAGLI(3, ilk);
    });
  });

  test("2. ZORLA ÜRETME: dört bağlantı sırayla birer kez kopup geri geliyor (kısa ağ dalgalanması) → Bağlı, 4", async () => {
    const dalga = [0, 1, 2, 3].flatMap(i => [hata(i), yeniden(i), bitti(i), kayit(i)]);
    await senaryo([...dortBagli, ...dalga, "@isaret:a"], async c => {
      BAGLI(4, await c.durum("a", { state: "connected", connections: 4 }));
    });
  });

  test("3. ZORLA ÜRETME: dört bağlantı da düzgün kapanıyor (Unregistered + Retrying), hiçbiri dönmüyor → Bağlanıyor, 0 (\"Bağlı\" DEĞİL); biri dönünce Bağlı, 1", async () => {
    const kapanis = [0, 1, 2, 3].flatMap(i => [coz(i), yeniden(i)]);
    await senaryo([...dortBagli, ...kapanis, "@isaret:a", "@bekle:b", ...[0, 1, 2, 3].map(bitti), kayit(1), "@isaret:c"], async c => {
      const s = await c.durum("a", { state: "connecting", connections: 0 });
      assert.deepEqual(s, { state: "connecting", connections: 0, reason: TUNNEL_REASONS.reconnecting }, `dört bağlantı da kapalıyken "Bağlı" yazmamalı; gelen ${JSON.stringify(s)}`);
      c.ilerle("b");
      BAGLI(1, await c.durum("c", { state: "connected", connections: 1 }));
    });
  });

  test("4. http2 yolu: \"Lost connection with the edge\" + Retrying + Connection terminated tek kopuştur → Bağlı, 3", async () => {
    await senaryo([...dortBagli, kenar(3), yeniden(3), bitti(3), "@isaret:a"], async c => {
      BAGLI(3, await c.durum("a", { state: "connected", connections: 3 }));
    });
  });

  test("5. gerçek kopuş gizlenmez: dört bağlantı da düşüp yeniden deneniyor → Bağlanıyor (Bağlantı koptu), 0; biri dönünce Bağlı, 1", async () => {
    await senaryo([...dortBagli, ...[0, 1, 2, 3].flatMap(i => [hata(i), yeniden(i)]), "@isaret:a", "@bekle:b", kayit(2), "@isaret:c"], async c => {
      assert.deepEqual(await c.durum("a", { state: "connecting" }), { state: "connecting", connections: 0, reason: TUNNEL_REASONS.reconnecting });
      c.ilerle("b");
      BAGLI(1, await c.durum("c", { state: "connected", connections: 1 }));
    });
  });

  test("6. süreç çöküp yeniden başlayınca eski bağlantılar sayılmaz: ilk süreçte 4, yenisinde 1 → Bağlı, 1", async () => {
    await senaryo([...dortBagli, "@cikIlk:ilk:1", kayit(0), "@isaret:a"], async c => {
      BAGLI(1, await c.durum("a", { state: "connected", connections: 1 }));
    });
  });
});

describe("2.4.8 M2 — cloudflared çıktısı program veri klasöründe günlük dosyasına (sınırlı, döndürmeli, gizli bilgi yok)", () => {
  test("7. satırlar <veri>/bilesenler/cloudflared/cloudflared.log'a yazılır; belirteç ve kimlik bilgisi YAZILMAZ", async () => {
    await senaryo([...dortBagli, "@belirtec", hata(1), yeniden(1), "@isaret:a"], async c => {
      await c.durum("a", { state: "connected", connections: 3 });
      const file = path.join(c.root, "cloudflared.log");
      assert.ok(existsSync(file), `günlük dosyası yok: ${file}`);
      const text = readFileSync(file, "utf8");
      for (const satir of [kayit(0), kayit(3), hata(1), yeniden(1), ACILIS[4]]) assert.ok(text.includes(satir), `günlükte satır yok: ${satir}`);
      assert.ok(!text.includes(TOKEN), "tünel belirteci günlüğe yazılmamalı");
      assert.ok(!text.includes("eyJhIjoiYWNjb3VudCIs"), "belirteç biçimli (base64 JSON) değer günlüğe yazılmamalı");
      assert.match(text, /token=\[gizli\]/, "token= değeri gizlenmeli");
      assert.match(text, /Bağlantı bileşeni başlatıldı/, "programın kendi başlatma satırı");
    });
  });

  test("8. dosya sınırı aşınca bir önceki dosyaya döner (cloudflared.log.1); en çok iki dosya, her biri sınırın altında, son satır güncel dosyada", async () => {
    const MAX = 8 * 1024;
    await senaryo([...dortBagli, "@cok:600", kayit(0), "@isaret:a"], async c => {
      await c.durum("a", { state: "connected", connections: 4 });
      const file = path.join(c.root, "cloudflared.log");
      assert.ok(existsSync(file), `günlük dosyası yok: ${file}`);
      assert.ok(existsSync(`${file}.1`), "döndürülen dosya (cloudflared.log.1) yok");
      const logs = readdirSync(c.root).filter(name => name.startsWith("cloudflared.log"));
      assert.deepEqual(logs.sort(), ["cloudflared.log", "cloudflared.log.1"], `fazla günlük dosyası: ${logs}`);
      for (const name of logs) assert.ok(statSync(path.join(c.root, name)).size <= MAX, `${name} sınırı aşmış: ${statSync(path.join(c.root, name)).size} > ${MAX}`);
      const son = readFileSync(file, "utf8").trim().split(/\r?\n/).at(-1);
      assert.ok(son.endsWith(kayit(0)), `son satır güncel dosyada olmalı: ${son}`);
      assert.ok(readFileSync(`${file}.1`, "utf8").includes("Sahte satır"), "eski satırlar önceki dosyada");
    }, { logMaxBytes: MAX });
  });
});
