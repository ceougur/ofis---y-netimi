// 2.4.7 mobil özet ölçümü (kullanıcı 29.10.2026 "hız testi falan yaptık mı?"; docs/2.4.7-IS-LISTESI.md "MOBİL ÖZET ÖLÇÜMÜ"): 100.000 para satırlı ofiste
// M-H1 /api/mobil/cash masaüstü Kasa listesini aynen döndürüyordu (bütün hareketler, 13 MB) — telefon yalnız bakiyeyi gösterir; özet 3 kullanıcıda kapıcının 8 MB
// sınırını aşıp 413 alıyordu. M-H2 özetin iç istekleri arasında olay döngüsüne sıra verilmiyordu → masaüstü istekleri özet bitene dek (~10 sn) bekliyordu.
// GERÇEK program + yerel kapıcı (test/mobil-gg247-ortak.mjs; dış istek yok, ders 30); saat sahte ve sabit (ders 13). M-H2 ölçüsü oran (en uzun kesintisiz
// çalışma / yüklemenin toplam süresi) — makinenin hızından bağımsız.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createUser } from "./helpers.mjs";
import { kurulum } from "./mobil-gg247-ortak.mjs";

const veriOf = async (ctx, tel) => {
  const oku = await tel.phone.readSummary({ now: ctx.gercek.ms() });
  assert.equal(oku.status, 200, `özet okunamadı: ${oku.status} ${oku.code || ""}`);
  assert.ok(oku.veri, "özet bu cihazın anahtarıyla açılmalı");
  return oku.veri;
};

describe("mobil Kasa: hareket listesi telefona ve özete gitmez (M-H1)", () => {
  let ctx;
  let tel;
  before(async () => {
    ctx = await kurulum({ licenseId: "LIS-OZET-KASA" });
    for (let i = 0; i < 60; i += 1) {
      const r = await ctx.admin.post("/api/workspace/cash", { kind: i % 3 === 2 ? "out" : "in", amount: String(i % 3 === 2 ? 5 : 10 + i), description: `Kasa hareketi ${i + 1}` });
      assert.equal(r.status, 200, JSON.stringify(r.data));
    }
    tel = await ctx.yeniTelefon();
    assert.equal(tel.login.status, 200, JSON.stringify(tel.login.data));
  });
  after(async () => {
    await ctx?.close();
  });

  it("masaüstü Kasa listesi aynen; mobil yanıt yalnız toplamları taşır, bakiye aynı", async () => {
    const masa = await ctx.admin.get("/api/workspace/cash");
    assert.equal(masa.status, 200);
    assert.equal(masa.data.data.entries.length, 60, "ön koşul: masaüstü 60 hareketi listeler");
    const mobil = await ctx.admin.get("/api/mobil/cash");
    assert.equal(mobil.status, 200);
    assert.equal(mobil.data.data.entries, undefined, "mobil Kasa yanıtı hareket listesini taşımamalı");
    assert.equal(mobil.data.data.totals.balance, masa.data.data.totals.balance);
    const canli = await tel.phone.get("/api/mobil/cash", { headers: { accept: "application/json", "x-requested-with": "DestekOfisMobile" } });
    assert.equal(canli.status, 200, JSON.stringify(canli.data));
    assert.equal(canli.data.data.entries, undefined, "telefonun canlı Kasa yanıtı hareket listesini taşımamalı");
    assert.equal(canli.data.data.totals.balance, masa.data.data.totals.balance);
  });

  it("özetin Kasa bölümü hareket listesi taşımaz; bakiye masaüstüyle aynı", async () => {
    const r = await ctx.sync.uploadNow("elle");
    assert.equal(r.ok, true, JSON.stringify(r));
    const veri = await veriOf(ctx, tel);
    const bolumler = Object.values(veri.sirketler);
    assert.equal(bolumler.length, 1);
    const kasa = bolumler[0]["/cash"];
    assert.ok(kasa, "özette Kasa bölümü olmalı");
    assert.equal(kasa.entries, undefined, "özetin Kasa bölümü hareket listesini taşımamalı");
    assert.equal(kasa.totals.balance, (await ctx.admin.get("/api/workspace/cash")).data.data.totals.balance);
  });
});

describe("mobil özet hazırlanırken olay döngüsüne sıra verilir (M-H2)", () => {
  let ctx;
  let tel;
  before(async () => {
    ctx = await kurulum({ licenseId: "LIS-OZET-SIRA" });
    for (let i = 0; i < 60; i += 1) {
      const r = await ctx.admin.post("/api/workspace/accounts", { name: `Sıra Carisi ${String(i + 1).padStart(2, "0")}` });
      assert.equal(r.status, 200, JSON.stringify(r.data));
    }
    tel = await ctx.yeniTelefon();
    assert.equal(tel.login.status, 200, JSON.stringify(tel.login.data));
    // Üç eşli kullanıcı (sınır 3 cihaz): özet kullanıcı başına ayrı hazırlanır → iç istek sayısı üçe katlanır, oran makinenin anlık duraklamalarından etkilenmez.
    for (const username of ["sira1", "sira2"]) {
      await createUser(ctx.server, ctx.admin, { username, role: "muhasebe", password: "Sira-Personel-2026!" });
      const ek = await ctx.yeniTelefon(username, "Sira-Personel-2026!");
      assert.equal(ek.login.status, 200, JSON.stringify(ek.login.data));
    }
    await ctx.sync.idle();
  });
  after(async () => {
    await ctx?.close();
  });

  it("en uzun kesintisiz çalışma yüklemenin toplam süresinin küçük bir parçası (iç istekler arasında masaüstüne sıra)", async t => {
    const bosluklar = [];
    let son = performance.now();
    let dur = false;
    const tik = () => {
      const t = performance.now();
      bosluklar.push(t - son);
      son = t;
      if (!dur) setImmediate(tik);
    };
    setImmediate(tik);
    const t0 = performance.now();
    const r = await ctx.sync.uploadNow("elle");
    const toplam = performance.now() - t0;
    dur = true;
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.data.kullanici, 3, "ön koşul: üç kullanıcının özeti");
    const veri = await veriOf(ctx, tel);
    const ayrinti = Object.keys(Object.values(veri.sirketler)[0]).filter(key => key.startsWith("/accounts/")).length;
    assert.ok(ayrinti >= 50, `ön koşul: özet 50 cari kartı içermeli (${ayrinti})`);
    const enUzun = Math.max(...bosluklar);
    t.diagnostic(`en uzun kesintisiz ${Math.round(enUzun)} ms / yükleme ${Math.round(toplam)} ms (oran ${(enUzun / toplam).toFixed(2)}; sınır 0,35)`);
    assert.ok(enUzun < toplam * 0.35, `özet sırasında olay döngüsü ${Math.round(enUzun)} ms kesintisiz meşgul (yükleme toplam ${Math.round(toplam)} ms); iç istekler arasında sıra verilmeli`);
  });
});
