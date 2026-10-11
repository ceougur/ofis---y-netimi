// 2.1.0 — liste kapısı (HOF.listGate, client/assets/hof-core.js) ve "Daha Fazla Göster" ile arka plan yenilemesinin yarışı (bağımsız inceleme H4,
// 11.10.2026; docs/kanit/2026-10-11/hiz-inceleme). Kapı tarayıcı kodudur; burada kaynak dosyadaki işlev olduğu gibi (metinden) yüklenir ve
// sıralar ELLE kurulur (yanıtlar ertelenmiş sözlerle tutulur — ders 20: yarışın ön koşulu zorla). Gerçek tarayıcıda aynı yarış:
// test/e2e/banka-210-daha-fazla-yaris.mjs.
// ÇALIŞIYOR MU: yanıtlar hangi sırayla gelirse gelsin ekrandaki liste = sunucunun ilk N satırı (eksik, çift, fazla yok); Daha Fazla ile açılan
//   satırlar arka plan yenilemesiyle geri alınmaz; kullanıcının yeni araması eski yanıtları ve Daha Fazla'yı geçersiz sayar (v2.0.22 kuralı).
// NASIL BOZARIM: Daha Fazla'nın yanıtını tut → başka kişi kayıt girer → arka plan yenilemesi taze ilk sayfayı yazar → Daha Fazla'yı bırak
//   (önceden eski listenin devamı yeni listeye ekleniyordu: sayfa sınırındaki satır ekranda hiç görünmüyordu). Tersi: arka plan yenilemesini
//   tut → Daha Fazla yaz → bırak (önceden yenileme düşüyordu; yeni satır bir sonraki olaya kadar görünmüyordu).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import vm from "node:vm";

function loadGate() {
  const src = readFileSync(new URL("../client/assets/hof-core.js", import.meta.url), "utf8");
  const start = src.indexOf("HOF.listGate = () => {");
  const end = src.indexOf("HOF.listPending =", start);
  assert.ok(start > 0 && end > start, "HOF.listGate kaynağı bulunamadı");
  const HOF = {};
  vm.runInNewContext(src.slice(start, end), { HOF });
  return HOF;
}
const deferred = () => {
  let resolve;
  const promise = new Promise(done => (resolve = done));
  return { promise, resolve };
};
const tick = () => new Promise(resolve => setImmediate(resolve));

// Banka → Hareketler'in yükleyicisinin (hof-bank.js loadMovesOnce) yalın modeli: imleçli Daha Fazla, arka plan yenilemesi yüklü satır sayısını
// korur. Sunucu: en yeni üstte; yanıtlar istek anındaki listeden hazırlanır ve testin istediği ana dek tutulabilir.
function bankModel(HOF, server, PAGE = 3) {
  const state = { rows: [], cursor: null, gate: HOF.listGate() };
  const holds = [];
  const respond = (kind, payload) => {
    const hold = holds.find(item => item.kind === kind && !item.taken);
    if (!hold) return Promise.resolve(payload);
    hold.taken = true;
    hold.arrived.resolve();
    return hold.release.promise.then(() => payload);
  };
  const fetchPage = ({ cursor, limit }) => {
    const from = cursor ? server.indexOf(cursor) + 1 : 0;
    const rows = server.slice(from, from + limit);
    return { rows, nextCursor: rows.at(-1) ?? null };
  };
  const retry = HOF.listRetry || (async load => void (await load()));
  async function once({ more = false, quiet = false } = {}) {
    const run = state.gate.start({ quiet, more });
    if (!run) return false;
    try {
      const limit = quiet && state.rows.length > PAGE ? state.rows.length : PAGE;
      const data = await respond(more ? "more" : quiet ? "quiet" : "user", fetchPage(more ? { cursor: state.cursor, limit: PAGE } : { limit }));
      if (!run.current()) return run.retry ? run.retry() : false;
      run.applied();
      state.rows = more ? [...state.rows, ...data.rows] : data.rows;
      state.cursor = data.nextCursor;
      return false;
    } finally {
      run.done();
    }
  }
  return {
    state,
    load: options => retry(() => once(options)),
    hold(kind) {
      const item = { kind, arrived: deferred(), release: deferred() };
      holds.push(item);
      return item;
    },
  };
}
const firstN = (server, n) => server.slice(0, n);

describe("liste kapısı: Daha Fazla ↔ arka plan yenilemesi (H4)", () => {
  it("Daha Fazla tutulurken başka kayıt + arka plan yenilemesi: Daha Fazla yeni listenin sonundan yinelenir; liste = sunucunun ilk 6'sı", async () => {
    const HOF = loadGate();
    const server = ["h9", "h8", "h7", "h6", "h5", "h4", "h3", "h2", "h1"];
    const model = bankModel(HOF, server);
    await model.load();
    assert.deepEqual(model.state.rows, ["h9", "h8", "h7"]);
    const held = model.hold("more");
    const more = model.load({ more: true });
    await held.arrived.promise; // Daha Fazla'nın yanıtı (eski listenin devamı: h6 h5 h4) hazır, tutuluyor
    server.unshift("h10"); // başka oturum kayıt girdi
    await model.load({ quiet: true }); // arka plan yenilemesi: taze ilk sayfa (h10 h9 h8)
    assert.deepEqual(model.state.rows, ["h10", "h9", "h8"]);
    held.release.resolve();
    await more;
    const truth = firstN(server, model.state.rows.length);
    assert.deepEqual(model.state.rows, truth, `ekrandaki liste sunucunun ilk ${truth.length} satırı olmalı (eksik: ${truth.filter(id => !model.state.rows.includes(id))})`);
    assert.equal(model.state.rows.length, 6, "Daha Fazla bir sayfa ekledi");
  });

  it("arka plan yenilemesi tutulurken Daha Fazla yazıldı: yenileme yeni uzunlukla yinelenir (satırlar geri alınmaz, yeni kayıt görünür)", async () => {
    const HOF = loadGate();
    const server = ["h9", "h8", "h7", "h6", "h5", "h4", "h3", "h2", "h1"];
    const model = bankModel(HOF, server);
    await model.load();
    server.unshift("h10");
    const held = model.hold("quiet");
    const quiet = model.load({ quiet: true });
    await held.arrived.promise; // yenilemenin yanıtı (h10 h9 h8) tutuluyor
    await model.load({ more: true }); // Daha Fazla (eski listeden: h6 h5 h4)
    assert.equal(model.state.rows.length, 6);
    held.release.resolve();
    await quiet;
    await tick();
    assert.deepEqual(model.state.rows, firstN(server, 6), `liste taze ve 6 satır olmalı: ${model.state.rows}`);
  });

  it("aynı sırada iki yenileme: sonra başlayan yazılır, önceki düşer (v2.0.22 kuralı); kullanıcı araması Daha Fazla'yı ve eski yenilemeyi geçersiz sayar", () => {
    const HOF = loadGate();
    const gate = HOF.listGate();
    const q1 = gate.start({ quiet: true });
    const q2 = gate.start({ quiet: true });
    assert.equal(q2.current(), true);
    q2.applied();
    assert.equal(q1.current(), false, "önce başlayan, sonra başlayanın ardından yazılmaz");
    assert.equal(q1.retry?.() ?? false, false, "yinelenmez (daha taze yanıt zaten yazıldı)");
    const more = gate.start({ more: true });
    const quiet = gate.start({ quiet: true });
    const user = gate.start({});
    assert.equal(gate.start({ more: true }), null, "kullanıcı yüklemesi sürerken Daha Fazla başlamaz (çağıran sıraya alır)");
    for (const [label, run] of [["Daha Fazla", more], ["arka plan", quiet]]) {
      assert.equal(run.current(), false, `${label}: kullanıcının yeni araması geçersiz sayar`);
      assert.equal(run.retry?.() ?? false, false, `${label}: yinelenmez`);
    }
    assert.equal(user.current(), true);
    user.applied();
    user.done();
    assert.ok(gate.start({ more: true }), "yükleme bitince Daha Fazla başlar");
  });

  it("rastgele sıralar (tohumlu, 300 tur): her sonuçta liste = sunucunun ilk N satırı, Daha Fazla geri alınmaz", async () => {
    const HOF = loadGate();
    let seed = 7;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    let bad = 0;
    const samples = [];
    for (let round = 0; round < 300; round += 1) {
      const server = Array.from({ length: 30 }, (_, i) => `h${30 - i}`);
      let next = 31;
      const model = bankModel(HOF, server);
      await model.load();
      const ops = [];
      const holds = [];
      for (let step = 0; step < 4; step += 1) {
        const pick = rand();
        if (pick < 0.35) {
          if (rand() < 0.5) holds.push(model.hold("more"));
          ops.push(model.load({ more: true }));
        } else if (pick < 0.7) {
          if (rand() < 0.5) holds.push(model.hold("quiet"));
          ops.push(model.load({ quiet: true }));
        } else server.unshift(`h${next++}`);
        await tick();
      }
      // Tutulan yanıtlar rastgele sırayla bırakılır; sonra son bir yenileme (gerçek ekranda: sıradaki olay) beklenmez.
      for (const hold of holds.sort(() => rand() - 0.5)) {
        hold.release.resolve();
        await tick();
      }
      await Promise.all(ops);
      const rows = model.state.rows;
      // Liste sunucunun BİTİŞİK bir dilimi olmalı (atlanan ya da iki kez görünen satır yok). Son yazılan yanıttan sonra girilen kayıt üstte
      // eksik olabilir (gerçek ekranda sıradaki olayın yenilemesi getirir); arada boşluk olamaz.
      const at = server.indexOf(rows[0]);
      const ok = at >= 0 && JSON.stringify(rows) === JSON.stringify(server.slice(at, at + rows.length));
      if (!ok) {
        bad += 1;
        if (samples.length < 3) samples.push({ round, rows, server: server.slice(0, rows.length + 2) });
      }
    }
    assert.equal(bad, 0, `bitişik olmayan (atlanmış/çift satırlı) liste: ${bad} tur; örnek ${JSON.stringify(samples)}`);
  });
});
