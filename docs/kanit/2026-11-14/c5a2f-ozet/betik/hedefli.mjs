// Hedefli vakalar (her biri şablonun kendi kopyasında; gün değişince program YENİDEN açılır). KOD=<kod> node hedefli.mjs <şablon> [A|B|C]
import { cpSync, readFileSync, mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { yil, NB, cur, must, rid, lt, integ, short, sums, view, vshort, lockTo, OR, URL, ROOT } from "./ortak.mjs";
const [tpl, only = ""] = process.argv.slice(2);
const ids = JSON.parse(readFileSync(path.join(tpl, "ids.json"), "utf8"));
const copy = tag => {
  const root = mkdtempSync(path.join(NB, `h-${tag}-`));
  cpSync(tpl, root, { recursive: true });
  return { root, dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), cleanup: () => rmSync(root, { recursive: true, force: true }) };
};
const books = app => `2026 ${JSON.stringify(yil(app, 2026, ["500", "519", "602", "671", "681"]))} · 2027 ${JSON.stringify(yil(app, 2027, ["500", "519", "602", "671", "681"]))}`;
const rowText = async api => {
  const r = await integ(api);
  return r.item ? `ok=${r.item.ok} ${r.item.name} kalan=${(r.item.correction?.remainderMinor ?? "-") / 100} fazla=${r.item.correction?.over ?? "-"} kendi-yılı=${r.item.correction?.ownYearMinor ? `${r.item.correction.ownYear.join(",")} ${r.item.correction.ownYearMinor / 100}` : "-"} ipucu="${(r.item.hint || "").slice(-200)}"` : "(kural farkı satırı yok)";
};
console.log(`KOD ${ROOT} TZ ${process.env.TZ}`);

if (!only || only === "A") {
  // A — 2027 fişinden sonra kilit 2026'ya GERİ alınır (kilit geri alma; K-c'nin gözlenebilir farkı)
  for (const [how, back, today] of [["dogrudan", "2026-11-30", "2027-01-10"], ["once-kaldir", "2026-11-30", "2027-01-10"], ["dogrudan", "2026-12-30", "2027-01-01"], ["once-kaldir", "2026-12-30", "2027-01-01"]]) {
    const d = copy(`A-${how}`);
    try {
      const c = await cur(d, today);
      console.log(`[A ${how}] --- geri ${back}, bugün ${today}`);
      await must("r2 onay", c.api.post(`${OR}/${ids.r2}`, { decision: "confirm" }));
      await must("r3 onay", c.api.post(`${OR}/${ids.r3}`, { decision: "confirm" }));
      await must("r1 ret", c.api.post(`${OR}/${ids.r1}`, { decision: "reject" }));
      await lockTo(c, "2026-12-31");
      const v1 = await view(c.api);
      console.log(`[A ${how}] kilit 31.12.2026 ön izleme: ${vshort(v1)}`);
      const p1 = await must("fiş", c.api.post(URL, { requestId: rid(), digest: v1.digest, confirm: true }));
      console.log(`[A ${how}] fiş ${p1.voucher.noText} ${p1.voucher.date} ${lt(p1.voucher.lines)} | satır: ${await rowText(c.api)}`);
      if (how === "once-kaldir") await lockTo(c, "");
      const backed = await c.api.put("/api/admin/period-lock", { lockedUntil: back });
      await c.app.ledger.snapshots.runPending();
      console.log(`[A ${how}] kilit ${back}'ya geri: ${backed.status} ${backed.data?.code || ""} örtü ${c.app.ledger.snapshots.coverage()}`);
      const v2 = await view(c.api);
      console.log(`[A ${how}] ön izleme: ${vshort(v2)} | satır: ${await rowText(c.api)}`);
      if (!v2.disabled) {
        const p2 = await c.api.post(URL, { requestId: rid(), digest: v2.digest, confirm: true });
        console.log(`[A ${how}] öneri kaydedildi: ${p2.status} ${p2.data?.voucher?.noText} ${p2.data?.voucher?.date} ${lt(p2.data?.voucher?.lines)} | satır: ${await rowText(c.api)}`);
      }
      console.log(`[A ${how}] ön izleme nedeni: ${v2.reason}`);
      if (v2.code === "rule-diff-own-year") {
        const rv = await c.api.post(`/api/admin/ledger/vouchers/${p1.voucher.id}/reverse`, { requestId: rid() });
        console.log(`[A ${how}] ekranın tarihsiz Ters Kaydet'i: ${rv.status} ${rv.data?.code || ""} ${rv.data?.voucher?.noText || ""} ${rv.data?.voucher?.date || ""} | sonra ön izleme ${vshort(await view(c.api))} | satır: ${await rowText(c.api)}`);
      }
      console.log(`[A ${how}] defter: ${books(c.app)}`);
      await c.server.close();
    } finally {
      d.cleanup();
    }
  }
}

if (!only || only === "B") {
  // B — 2026'da yazılmış fiş yıl sonundan sonra FAZLA olur (kilit kaldır → yeniden kilitle); ipucu 'ters kaydedin' ↔ ön izleme B 681 / A 500: iki çare, iki defter
  for (const how of ["ters-kayit", "onizleme-fisi"]) {
    const d = copy(`B-${how}`);
    try {
      let c = await cur(d, "2026-12-30");
      await must("r2 onay", c.api.post(`${OR}/${ids.r2}`, { decision: "confirm" }));
      await must("r3 onay", c.api.post(`${OR}/${ids.r3}`, { decision: "confirm" }));
      await must("r1 ret", c.api.post(`${OR}/${ids.r1}`, { decision: "reject" }));
      const v1 = await view(c.api);
      const p1 = await must("fiş", c.api.post(URL, { requestId: rid(), digest: v1.digest, confirm: true }));
      console.log(`[B ${how}] fiş ${p1.voucher.noText} ${p1.voucher.date} ${lt(p1.voucher.lines)} | satır: ${await rowText(c.api)}`);
      await c.server.close();
      c = await cur(d, "2027-01-10");
      await lockTo(c, "");
      await lockTo(c, "2026-12-31");
      const v2 = await view(c.api);
      console.log(`[B ${how}] kilit kaldır → 31.12.2026: ön izleme ${vshort(v2)} | satır: ${await rowText(c.api)}`);
      if (how === "ters-kayit") {
        const rv = await c.api.post(`/api/admin/ledger/vouchers/${p1.voucher.id}/reverse`, { requestId: rid() });
        console.log(`[B ${how}] tarihsiz ters kayıt: ${rv.status} ${rv.data?.code || ""} ${rv.data?.voucher?.date || ""}`);
        if (rv.status !== 200) {
          const rv2 = await c.api.post(`/api/admin/ledger/vouchers/${p1.voucher.id}/reverse`, { requestId: rid(), date: "2027-01-10" });
          console.log(`[B ${how}] 10.01.2027 ters kayıt: ${rv2.status} ${rv2.data?.voucher?.noText || ""} ${lt(rv2.data?.voucher?.lines)}`);
        }
      } else {
        const p2 = await c.api.post(URL, { requestId: rid(), digest: v2.digest, confirm: true });
        console.log(`[B ${how}] ön izleme fişi: ${p2.status} ${p2.data?.voucher?.noText || ""} ${lt(p2.data?.voucher?.lines)}`);
      }
      const v3 = await view(c.api);
      console.log(`[B ${how}] sonra: ön izleme ${vshort(v3)} | satır: ${await rowText(c.api)}`);
      console.log(`[B ${how}] defter: ${books(c.app)}`);
      await c.server.close();
    } finally {
      d.cleanup();
    }
  }
}

if (!only || only === "D") {
  // D — 2025'in farkı 2026 fişinde 671'e düzeltildi; 2027'de fiş FAZLA olur (kilit kaldır → yeniden kilitle): fazla önerisi 671'i mi ters çevirir, 681 mi (K-a ile tutarlılık)?
  const { old249, dirs } = await import("./ortak.mjs");
  for (const kind of ["onceki-yil-671", "ayni-yil-602"]) {
    const d = dirs(`D-${kind}`);
    try {
      const entryDate = kind === "onceki-yil-671" ? "2025-10-02" : "2026-03-02";
      const oldLock = kind === "onceki-yil-671" ? "2025-12-31" : "2026-03-05";
      const id = await old249(d, "2026-03-10", async (o, app) => {
        const a = await must("cari", o.post("/api/workspace/accounts", { name: "Üç Yıl Müşteri", type: "customer", registeredOn: "2025-09-01" }));
        await must("açılış", o.post(`/api/workspace/accounts/${a.id}/entries`, { kind: "debt", amount: "700", date: entryDate, note: "Açılış bakiyesi" }));
        await must("kilit", o.put("/api/admin/period-lock", { lockedUntil: oldLock }));
        return app.store.get("SELECT id FROM account_entries WHERE account_id = ?", a.id).id;
      });
      let c = await cur(d, "2026-03-10");
      await must("ret", c.api.post(`${OR}/${id}`, { decision: "reject" }));
      const v1 = await view(c.api);
      const p1 = await must("fiş", c.api.post(URL, { requestId: rid(), digest: v1.digest, confirm: true }));
      console.log(`[D ${kind}] fiş ${p1.voucher.noText} ${p1.voucher.date} ${lt(p1.voucher.lines)} | satır: ${await rowText(c.api)}`);
      await c.server.close();
      c = await cur(d, "2027-01-10");
      await lockTo(c, "");
      await lockTo(c, "2026-12-31");
      const v2 = await view(c.api);
      console.log(`[D ${kind}] 2027, kilit kaldır → 31.12.2026: ön izleme ${vshort(v2)} | satır: ${await rowText(c.api)}`);
      if (!v2.disabled) {
        const p2 = await c.api.post(URL, { requestId: rid(), digest: v2.digest, confirm: true });
        console.log(`[D ${kind}] fazla önerisi kaydedildi: ${p2.status} ${lt(p2.data?.voucher?.lines)} | sonra ${(await view(c.api)).code} | satır: ${await rowText(c.api)}`);
      }
      console.log(`[D ${kind}] defter: 2025 ${JSON.stringify(yil(c.app, 2025, ["500", "519", "602", "671", "681"]))} · ${books(c.app)}`);
      await c.server.close();
    } finally {
      d.cleanup();
    }
  }
}

if (!only || only === "C") {
  // C — kilit / bugün sınırı: yalnız r1 ret (r2, r3 onay), kilit L, bugün T → ön izleme tarihi / kodu / satırları
  for (const [L, T] of [["2026-12-30", "2026-12-31"], ["2026-12-31", "2026-12-31"], ["2026-12-31", "2027-01-01"], ["2027-01-01", "2027-01-01"], ["2027-01-01", "2027-01-10"], ["2026-12-30", "2027-01-10"], ["2026-12-29", "2026-12-30"]]) {
    const d = copy(`C`);
    try {
      const c = await cur(d, T);
      await must("r2 onay", c.api.post(`${OR}/${ids.r2}`, { decision: "confirm" }));
      await must("r3 onay", c.api.post(`${OR}/${ids.r3}`, { decision: "confirm" }));
      await must("r1 ret", c.api.post(`${OR}/${ids.r1}`, { decision: "reject" }));
      const lk = await c.api.put("/api/admin/period-lock", { lockedUntil: L });
      await c.app.ledger.snapshots.runPending();
      const v = await view(c.api);
      let post = "";
      if (!v.disabled) {
        const p = await c.api.post(URL, { requestId: rid(), digest: v.digest, confirm: true });
        post = ` → kayıt ${p.status} ${p.data?.voucher?.noText || ""}; sonra ${(await view(c.api)).code}; satır ${await rowText(c.api)}`;
      }
      console.log(`[C] kilit ${L} (${lk.status}) bugün ${T}: ${vshort(v)}${post}`);
      await c.server.close();
    } finally {
      d.cleanup();
    }
  }
}
