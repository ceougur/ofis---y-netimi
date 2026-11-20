// 2.5.0 Ç7b tur 3b (docs/erp/C7B-FATURA-TASARIM.md §17) — Kartı Kapat "Borçta Kalsın" (karar (6) 2B-S5 / S10 = A, KG-23 = A "Alacak CH'de kalır (madde yok)", S205 = A, B-11 = A).
// Sahte saat 08.10.2026 (durur; clock.set ile ileri alınır). Beklenenler kararların sözünden ELLE (kod koşulmadan):
//  T1 (6) Yeni Borç kartı 900 (3 × 300; 05.10 / 05.11 / 05.12), 05.10 tahsilat 300, 08.10 Kartı Kapat → cari bakiye 600 KALIR (eski kural 0), cari ekstresinde "kalan düşüldü" satırı
//     YOK, Mizan 120 = 600, 689 YOK; 08.10'da gecikmiş 0 (kapanış günü), 09.10'da 600 (S205: kalanın tamamı kapanışın ertesi gününden), 12.10'da 600; zil (dues) 09.10'da iki kalem
//     gecikmiş (300 + 300); Vade Takip / nakit akışı kalanı alır. Vazgeçme ayrı işlemle: Alacak Yaz 600 → bakiye 0, gecikmiş 0.
//  T2 S205 + vadesi kapanıştan ÖNCE geçmiş kalem: kart 900 (05.09 / 05.10 / 05.11), tahsilat yok, 08.10 Kartı Kapat → 08.10'da gecikmiş 600 (05.09 + 05.10 kendi vadesiyle), 09.10'da 900.
//  T3 aynı caride eski kurallı kapalı kart (göç 53'ün işareti '2.4.9': kalan düşülmüş) + yeni Borçta Kalsın kartı: K1 900 / tahsilat 300 / eski kapalı → 0; K2 500 yeni kapalı → 500;
//     bakiye 500, 689 = 600 (yalnız K1), ekstrede yalnız K1'in "kalan düşüldü" satırı. K1 Yeniden Aç → bakiye 1.100 (600 geri gelir, bugünkü), işaret ''; K1 yeniden Kapat → bakiye 1.100
//     (Borçta Kalsın), 689 YOK.
//  T4 kilit: eski kurallı kart kilitli günde kapanmışsa Yeniden Aç 409 (bugünkü); Borçta Kalsın kartı kilitli günde kapanmışsa Yeniden Aç 200 (kapanış defter olayı değil) ve kart
//     tahsilatı 200; Mutabakat Testi temiz. Kilit izi: işaret kapı dışı '' → '2.4.9' değişince lockDigestOf değişir.
//  T5 göç 53: sütunu düşürülmüş (52) dosya yeniden açılınca kapalı kart '2.4.9' (kalan düşülür → bakiye 0, 689 600), açık kart ''; göç eşgüçlü.
// NASIL BOZARIM (mutantlar, §17.4): yeni kartı eski kuralla düş; eski kartı yeni kuralla say; bir okuyucuyu yardımcıdan kopar (genel defter / cari defteri / partyTotals); gecikmeyi kalem
// vadesinden başlat (S205); vadeyi kapanış ertesi yaz (gecikmiş bir gün geç); işareti kilit izinden çıkar; Yeniden Aç'ta işareti sıfırlama.
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { apiOf, must, rawRun } from "./banka-210-ortak.mjs";
import { bootBank } from "./banka-210-hesap-ortak.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";
import { lockDigestOf } from "../server/lib/integrity.mjs";

const W = "/api/workspace";
describe("Ç7b tur 3b — Kartı Kapat 'Borçta Kalsın' (karar (6), S205)", () => {
  let ctx;
  let api;
  let n = 0;
  const acc = async () => (await must("cari", api.post(`${W}/accounts`, { name: `Tur3b Müşteri ${(n += 1)}`, type: "customer", registeredOn: "2026-08-01" }))).id;
  const card = async (accountId, total, firstDue, registeredOn = "2026-08-01") => {
    const made = await must("kart", api.post(`${W}/plans`, { accountId, name: `Tur3b Kart ${(n += 1)}`, total: String(total), registeredOn, mode: "auto", count: 3, firstDue }));
    return made.id || made.plan?.id;
  };
  const account = async id => must("cari kartı", api.get(`${W}/accounts/${id}`));
  const pay = (planId, amount, date) => must("taksit tahsilatı", api.post(`${W}/plans/${planId}/entries`, { kind: "in", amount: String(amount), date, method: "cash" }));
  const close = async planId => {
    const left = (await must("kart", api.get(`${W}/plans/${planId}`))).totals.remaining;
    return must("Kartı Kapat", api.put(`${W}/plans/${planId}`, { status: "closed", closeRemaining: left }));
  };
  const trial = async () => Object.fromEntries((await must("mizan", api.get(`${W}/ledger`))).trial.accounts.map(r => [r.code, r.balance]));
  const integrity = async label => {
    const result = await must("Mutabakat Testi", api.get(`${W}/ledger/integrity`));
    assert.equal(result.ok, true, `${label}: ${JSON.stringify(result.failures || result.checks?.filter(c => !c.ok)).slice(0, 600)}`);
  };
  const setDay = day => ctx.server.clock.set(`${day}T12:00:00+03:00`);
  // Her sınama kendi sunucusunda (saat yalnız ileri alınır — geri alınınca önceki sınamanın kaydı ileri tarihli olurdu).
  beforeEach(async () => {
    ctx = await bootBank({ now: { time: "2026-10-08T12:00:00+03:00", fixed: true } });
    api = ctx.api;
  });
  afterEach(() => ctx?.server.close());

  it("T1 (6): kalan carinin borcunda kalır, madde yok; S205 kapanışın ertesi gününden gecikmiş; zil / Vade Takip; vazgeçme Alacak Yaz ile", async () => {
    setDay("2026-10-08");
    const A = await acc();
    const p = await card(A, 900, "2026-10-05");
    await pay(p, 300, "2026-10-05");
    const before689 = (await trial())["689"] || 0;
    await close(p);
    const a = await account(A);
    assert.equal(a.totals.balance, 600, "Borçta Kalsın: bakiye 600 kalır (eski kural 0)");
    assert.ok(!a.ledger.some(line => line.kind === "plan-close"), "cari ekstresinde 'kalan düşüldü' satırı yok");
    assert.equal(ctx.store.get("SELECT close_rule AS r FROM plans WHERE id = ?", p).r, "", "işaret '' (Borçta Kalsın)");
    const t = await trial();
    assert.equal((t["689"] || 0) - before689, 0, "689 maddesi yok (KG-23)");
    assert.equal(a.totals.overdueDebt, 0, "08.10 (kapanış günü): gecikmiş 0");
    await integrity("Kartı Kapat");
    setDay("2026-10-09");
    assert.equal((await account(A)).totals.overdueDebt, 600, "09.10: kalanın tamamı gecikmiş (S205)");
    const view = await must("kart", api.get(`${W}/plans/${p}`));
    assert.equal(view.status, "closed");
    assert.deepEqual(view.items.map(i => `${i.dueDate}:${i.remaining}:${i.state}`), ["2026-10-05:0:paid", "2026-10-08:300:overdue", "2026-10-08:300:overdue"], "kart penceresi: kalan kalemler kapanış gününde vadeli, gecikti");
    assert.equal(view.totals.remaining, 600);
    const dues = (await must("zil", api.get(`${W}/dues`))).items.filter(item => item.source === "plan" && item.planId === p);
    assert.deepEqual(dues.map(item => `${item.dueDate}:${item.amount}:${item.state}`), ["2026-10-08:300:overdue", "2026-10-08:300:overdue"], "hatırlatma (zil) gider");
    setDay("2026-10-12");
    assert.equal((await account(A)).totals.overdueDebt, 600, "12.10: 600");
    await must("Alacak Yaz (vazgeçme)", api.post(`${W}/accounts/${A}/entries`, { kind: "credit", amount: "600", date: "2026-10-12", note: "Kalan alacaktan vazgeçildi" }));
    const b = await account(A);
    assert.equal(b.totals.balance, 0, "vazgeçme ayrı ve görünür işlemle");
    assert.equal(b.totals.overdueDebt, 0);
    await integrity("vazgeçme");
  });

  it("T2 S205: vadesi kapanıştan önce geçmiş kalem kendi vadesiyle gecikmiş kalır; gelmemiş kalem kapanışın ertesinden", async () => {
    setDay("2026-10-08");
    const A = await acc();
    const p = await card(A, 900, "2026-09-05");
    assert.equal((await account(A)).totals.overdueDebt, 600, "kapatmadan önce 05.09 + 05.10");
    await close(p);
    assert.equal((await account(A)).totals.balance, 900);
    assert.equal((await account(A)).totals.overdueDebt, 600, "kapanış günü: kendi vadesi geçmiş iki kalem (05.09, 05.10) — gecikmiş 0'a inmez");
    assert.equal((await account(A)).totals.overdueSince, "2026-09-05", "gecikme yaşı küçülmez (en eski vade 05.09)");
    setDay("2026-10-09");
    assert.equal((await account(A)).totals.overdueDebt, 900, "ertesi gün kalanın tamamı");
    await integrity("S205");
  });

  it("T3 eski kurallı kapalı kart + yeni Borçta Kalsın kartı aynı caride; Yeniden Aç → yeniden Kapat yeni kuralla", async () => {
    setDay("2026-10-08");
    const A = await acc();
    const k2 = await card(A, 500, "2026-11-01");
    await close(k2);
    assert.equal((await account(A)).totals.balance, 500, "yeni kart Borçta Kalsın");
    const k1 = await card(A, 900, "2026-10-01");
    await pay(k1, 300, "2026-10-01");
    await close(k1);
    // Göç 53'ün işareti (v2.4.9'da kapatılmış kart): '2.4.9' = eski kural (programın kendi işareti; kapı dışı yazım değil — göçün yazdığı değer).
    ctx.store.run("UPDATE plans SET close_rule = '2.4.9' WHERE id = ?", k1);
    const before689 = (await trial())["689"] || 0;
    const a = await account(A);
    assert.equal(a.totals.balance, 500, "eski kart kalanı düşülmüş (0) + yeni kart 500");
    assert.deepEqual(a.ledger.filter(line => line.kind === "plan-close").map(line => `${line.planId === k1 ? "K1" : "?"}:${line.credit}`), ["K1:600"], "yalnız eski kartın 'kalan düşüldü' satırı");
    assert.ok(before689 >= 600, `689 eski kartın 600'ünü taşır (${before689})`);
    await integrity("iki kural aynı caride");
    await must("Yeniden Aç", api.put(`${W}/plans/${k1}`, { status: "active" }));
    assert.equal((await account(A)).totals.balance, 1100, "Yeniden Aç: düşülen 600 geri gelir");
    assert.equal(ctx.store.get("SELECT close_rule AS r FROM plans WHERE id = ?", k1).r, "", "işaret sıfırlandı");
    assert.equal(((await trial())["689"] || 0), before689 - 600, "689'dan eski kartın 600'ü kalktı");
    await close(k1);
    assert.equal((await account(A)).totals.balance, 1100, "yeniden Kapat: Borçta Kalsın");
    assert.equal(((await trial())["689"] || 0), before689 - 600, "yeniden kapatmada 689 yok");
    await integrity("yeniden kapat");
  });

  it("T4 kilit: Borçta Kalsın kartı kilitli kapanışta Yeniden Aç / tahsilat serbest; eski kurallı kart 409; işaret kilit izinde", async () => {
    setDay("2026-10-08");
    const A = await acc();
    const kept = await card(A, 600, "2026-11-01");
    await close(kept);
    const old = await card(A, 900, "2026-11-01");
    await close(old);
    setDay("2026-10-10");
    await must("kilit", api.put("/api/admin/period-lock", { lockedUntil: "2026-10-09" }));
    // Önce Borçta Kalsın kartı (kapanış defter olayı değil): ESKİ kodda 409 "kalan alacaktan vazgeçildi" (ders 38 — kırmızının nedeni bu).
    const opened = await api.put(`${W}/plans/${kept}`, { status: "active" });
    assert.equal(opened.status, 200, `Borçta Kalsın kartı kilitli kapanışta Yeniden Aç (${JSON.stringify(opened.data).slice(0, 240)})`);
    await must("Borçta Kalsın kartına tahsilat", api.post(`${W}/plans/${kept}/entries`, { kind: "in", amount: "100", date: "2026-10-10", method: "cash" }));
    await integrity("kilitli dönem — Borçta Kalsın");
    // Eski kurallı kart (göç 53'ün işareti; kapı dışı — ham yazım, kilitli dönem): kapanış günü kilitli → Yeniden Aç 409 (bugünkü kural).
    const digest = lockDigestOf(ctx.store, "2026-10-09");
    rawRun(ctx.db, "UPDATE plans SET close_rule = '2.4.9' WHERE id = ?", old);
    assert.notEqual(lockDigestOf(ctx.store, "2026-10-09"), digest, "kural işareti kilit izinde (kapı dışı değişim görünür)");
    const blocked = await api.put(`${W}/plans/${old}`, { status: "active" });
    assert.equal(blocked.status, 409, `eski kural: kapanış günü kilitli (${JSON.stringify(blocked.data).slice(0, 200)})`);
    assert.match(String(blocked.data?.error || ""), /kalan alacaktan vazgeçildi/);
    rawRun(ctx.db, "UPDATE plans SET close_rule = '' WHERE id = ?", old);
    assert.equal(lockDigestOf(ctx.store, "2026-10-09"), digest, "işaret geri alınınca iz aynı");
  });
});

describe("Ç7b tur 3b — şüpheli alacaklı caride Kartı Kapat (şüpheli ayırıcısı = defter; lib/bank/doubtful.mjs)", () => {
  it("T6 Yeni Borç kartı 900 → Şüpheliye al 900 (01.10) → 08.10 Kartı Kapat: 128 900 KALIR (eski kuralda 689 ile 0), 120 0; şüpheli kaydının kalanı 900; Mutabakat Testi temiz", async () => {
    const ctx = await bootBank({ now: { time: "2026-10-08T12:00:00+03:00", fixed: true } });
    const { api } = ctx;
    try {
      const A = (await must("cari", api.post(`${W}/accounts`, { name: "Tur3b Şüpheli", type: "customer", registeredOn: "2026-08-01" }))).id;
      const made = await must("kart", api.post(`${W}/plans`, { accountId: A, name: "Tur3b Şüpheli Kart", total: "900", registeredOn: "2026-08-01", mode: "auto", count: 3, firstDue: "2026-09-05" }));
      const p = made.id || made.plan?.id;
      const record = await must("şüpheliye al", api.post(`${W}/accounts/${A}/doubtful`, { amount: "900", date: "2026-10-01", reason: "lawsuit" }));
      const recordId = record?.record?.id || ctx.store.get("SELECT id FROM doubtful_receivables WHERE account_id = ?", A).id;
      await must("Kartı Kapat", api.put(`${W}/plans/${p}`, { status: "closed", closeRemaining: 900 }));
      const b = { 120: 0, 128: 0, 689: 0 };
      for (const entry of ctx.app.ledger.build()) for (const line of entry.lines || []) if (line.party === A && line.account in b) b[line.account] += (line.debit - line.credit) / 100;
      for (const entry of ctx.app.ledger.build()) for (const line of entry.lines || []) if (line.account === "689" && entry.id === `plan-close:${p}`) b[689] += (line.debit - line.credit) / 100;
      assert.deepEqual(b, { 120: 0, 128: 900, 689: 0 }, "kalan şüpheli alacakta kalır (madde yok)");
      const state = ctx.app.context.bank?.doubtful?.state?.() || null;
      const remaining = state ? state.get?.(recordId)?.remaining : null;
      if (remaining !== null && remaining !== undefined) assert.equal(remaining, 90000, "şüpheli kaydının kalanı (kuruş)");
      assert.equal((await must("cari kartı", api.get(`${W}/accounts/${A}`))).totals.balance, 900);
      const result = await must("Mutabakat Testi", api.get(`${W}/ledger/integrity`));
      assert.equal(result.ok, true, JSON.stringify(result.failures || "").slice(0, 600));
    } finally {
      await ctx.server.close();
    }
  });
});

describe("Ç7b tur 3b — göç 53 (kart başına kural işareti)", () => {
  it("T5 göç öncesi (52) dosyada kapalı kart '2.4.9' (kalan düşülmüş — eski kural), açık kart ''; eşgüçlü", async () => {
    const NOW = { time: "2026-10-08T12:00:00+03:00", fixed: true };
    const first = await startTestServer({ now: NOW });
    let server = first;
    let api = apiOf(await loginAdmin(server));
    try {
      const A = (await must("cari", api.post(`${W}/accounts`, { name: "Göç53 Müşteri", type: "customer", registeredOn: "2026-08-01" }))).id;
      const idOf = made => made.id || made.plan?.id;
      const closed = idOf(await must("kart", api.post(`${W}/plans`, { accountId: A, name: "Göç53 Kapalı", total: "900", registeredOn: "2026-08-01", mode: "auto", count: 3, firstDue: "2026-10-01" })));
      const open = idOf(await must("kart", api.post(`${W}/plans`, { accountId: A, name: "Göç53 Açık", total: "300", registeredOn: "2026-08-01", mode: "auto", count: 1, firstDue: "2026-11-01" })));
      await must("tahsilat", api.post(`${W}/plans/${closed}/entries`, { kind: "in", amount: "300", date: "2026-10-01", method: "cash" }));
      await must("Kartı Kapat", api.put(`${W}/plans/${closed}`, { status: "closed", closeRemaining: 600 }));
      const file = server.app.store.get("PRAGMA database_list").file;
      await server.app.close();
      // Göç 53 öncesi dosya (52): sütun yok — eski sürümün kapattığı kart (programın yazdığı veri; yalnız şema geri alındı).
      const raw = new DatabaseSync(file);
      const has = raw.prepare("PRAGMA table_info(plans)").all().some(row => row.name === "close_rule");
      if (has) raw.exec("ALTER TABLE plans DROP COLUMN close_rule;");
      raw.exec("PRAGMA user_version = 52;");
      raw.close();
      server = await startTestServer({ dataDir: first.dataDir, backupDir: path.join(first.root, "backups"), now: NOW });
      api = apiOf(await loginAdmin(server));
      assert.equal(server.app.store.get("PRAGMA user_version").user_version >= 53, true, "göç koştu");
      const rule = id => server.app.store.get("SELECT close_rule AS r FROM plans WHERE id = ?", id).r;
      assert.equal(rule(closed), "2.4.9", "göçten önce kapatılmış kart eski kural");
      assert.equal(rule(open), "", "açık kart ''");
      const a = await must("cari kartı", api.get(`${W}/accounts/${A}`));
      assert.equal(a.totals.balance, 300, "kapalı kartın kalanı düşülmüş (eski kural) + açık kart 300");
      const t = Object.fromEntries((await must("mizan", api.get(`${W}/ledger`))).trial.accounts.map(r => [r.code, r.balance]));
      assert.equal(t["689"], 600, "689 = eski kartın kalanı");
      const result = await must("Mutabakat Testi", api.get(`${W}/ledger/integrity`));
      assert.equal(result.ok, true, JSON.stringify(result.failures || "").slice(0, 400));
      // Eşgüçlü: göç yeniden koşunca (sütun var) sonradan Borçta Kalsın ile kapatılan kart eski sayılmaz.
      await must("Yeniden Aç", api.put(`${W}/plans/${closed}`, { status: "active" }));
      await must("Kartı Kapat", api.put(`${W}/plans/${closed}`, { status: "closed", closeRemaining: 600 }));
      const { MIGRATIONS } = await import("../server/lib/migrations.mjs");
      MIGRATIONS.find(m => m.version === 53).up(server.app.store);
      assert.equal(rule(closed), "", "yeniden koşan göç işareti değiştirmez");
    } finally {
      await server.close();
      if (server !== first) await first.close().catch(() => {});
    }
  });
});
