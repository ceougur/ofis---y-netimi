// 2.1.0 — Aşama 2, bağımsız gözden geçirme B3/B4: şirket yedeğinden geri yüklemede banka çekirdeğinin kendi kayıtları (docs/2.1.0-KANIT.md
// "Aşama 2 — Bağımsız Gözden Geçirme").
//
// Kök neden: 001 geri yüklemesinde ortak katman (kullanıcılar, roller, lisans, "meta." ayarları) canlı dosyadan geri yüklenen dosyaya
// aktarılıyordu; "meta.bank.*" (eski satır işareti, açılış onarımı raporu, K6 günlüğü, İşlem No sayacı) da bu öneke girdiği için
// SIFIRLANMIŞ canlı dosyanın işareti geri yüklenen dosyaya yazılıyor, güncelleme öncesinin satırları "eski sürümün yeni yazdığı olaysız
// para satırı" sayılıyordu (yanlış "Hesabı Belirsiz Yeni Hareketler (n)" ve Mutabakat Testi uyarısı). 002'de aktarım yok ama İşlem No sayacı
// yedekteki değere dönüyordu: geri yüklemeden sonra aynı numara ikinci kez veriliyordu.
//
// ÇALIŞIYOR MU:
//  - 2.0.26 verisi → güncelle → Tüm Hareketleri Sil → zorunlu "sifirlama-oncesi" yedeğini 001'e geri yükle → Mutabakat Testi güncellemeden
//    sonraki gibi temiz; açılış onarımı "Hesabı Belirsiz Yeni Hareketler" yazmaz; günlüğe 'repair' ya da yeni 'baseline' girmez.
//  - İşlem No sayacı geri yüklemede canlı ile yedeğin büyüğü olur (numara hiçbir zaman yeniden verilmez) — 001 ve 002 aynı kural.
// NASIL BOZARIM: sıfırla → geri yükle (eski satır işareti); 002'de yedek → yeni hareketler → geri yükle → yeni hareket (numara tekrarı).
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { ADMIN_PASSWORD } from "./helpers.mjs";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";

const pad = n => String(n).padStart(2, "0");
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 400)}`);
  return res.data;
};
const integrity = async api => must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
const setting = (app, key) => app.store.setting(key, "");
const lastNo = app => app.store.get("SELECT no FROM fin_events ORDER BY year DESC, seq DESC LIMIT 1")?.no || "";
const seqOf = no => Number(String(no).split("-").at(-1));
const dirs = () => {
  const root = mkdtempSync(path.join(tmpdir(), "banka-210-gg-geri-"));
  return { root, dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
};

describe("B3/B4 — 001: sıfırlama öncesi yedeğine dönüş (gerçek 2.0.26 verisiyle)", { skip: !tagsAvailable(["v2.0.26"]) && "v2.0.26 etiketi yok (git fetch --tags)" }, () => {
  it("geri yüklenen dosya kendi eski satır işaretini korur: Mutabakat Testi temiz, onarım uyarısı yok; İşlem No geri gitmez", async () => {
    const where = dirs();
    let server = null;
    try {
      server = await bootVersion("v2.0.26", where);
      let api = await server.login();
      for (const amount of ["100", "200", "300"]) await must("2.0.26 Kasa", api.post("/api/workspace/cash", { kind: "in", amount, date: today(), description: `2.0.26 ${amount}` }));
      await server.close();
      server = null;

      server = await bootVersion(CURRENT, where);
      api = await server.login();
      const first = await integrity(api);
      assert.equal(first.ok, true, `güncellemeden sonra: ${JSON.stringify(first.failures)}`);
      assert.equal(JSON.parse(setting(server.app, "meta.bank.legacyMarks")).cash_entries, 3, "eski satır işareti");
      for (const amount of ["10", "20"]) await must("güncel Kasa", api.post("/api/workspace/cash", { kind: "in", amount, date: today(), description: `güncel ${amount}` }));
      const beforeReset = seqOf(lastNo(server.app));
      const reset = await must("Tüm Hareketleri Sil", api.post("/api/companies/sirket-001/reset", { mode: "movements", confirm: "001", password: ADMIN_PASSWORD }));
      assert.ok(reset.backup, "zorunlu sıfırlama öncesi yedeği");
      await must("sıfırlamadan sonra Kasa", api.post("/api/workspace/cash", { kind: "in", amount: "7", date: today(), description: "sıfırlamadan sonra" }));
      const liveSeq = seqOf(lastNo(server.app));
      assert.ok(liveSeq > beforeReset, "sıfırlama numarayı geri almaz");
      const logBefore = server.app.store.get("SELECT COUNT(*) AS n FROM integrity_log").n;
      assert.ok(logBefore >= 0);
      await must("geri yükle", api.post("/api/admin/backups/restore", { name: reset.backup, company: "sirket-001", confirm: "001", password: ADMIN_PASSWORD }));
      await server.close();
      server = null;

      server = await bootVersion(CURRENT, where);
      api = await server.login();
      assert.equal(server.app.stagedRestore?.ok, true, JSON.stringify(server.app.stagedRestore));
      assert.equal(server.app.store.get("SELECT COUNT(*) AS n FROM cash_entries").n, 5, "yedekteki 5 Kasa satırı");
      const after = await integrity(api);
      assert.equal(after.ok, true, `geri yüklemeden sonra Mutabakat Testi: ${JSON.stringify(after.failures)}`);
      const repair = JSON.parse(setting(server.app, "meta.bank.repair") || "{}");
      assert.equal(repair.unassigned || 0, 0, `Hesabı Belirsiz Yeni Hareketler olmamalı: ${JSON.stringify(repair.unassignedSample)}`);
      assert.equal(server.app.store.get("SELECT COUNT(*) AS n FROM integrity_log WHERE action = 'repair'").n, 0, "açılış onarımı kaydı olmamalı");
      assert.equal(JSON.parse(setting(server.app, "meta.bank.legacyMarks")).cash_entries, 3, "yedeğin kendi işareti");
      const created = await must("yeni Kasa", api.post("/api/workspace/cash", { kind: "in", amount: "1", date: today(), description: "geri yüklemeden sonra" }));
      const no = server.app.store.get("SELECT f.no FROM cash_entries c JOIN fin_events f ON f.id = c.event_id WHERE c.id = ?", created.id).no;
      assert.equal(seqOf(no), liveSeq + 1, `İşlem No canlının sayacından sürer (yeniden verilmez): ${no}`);
    } finally {
      await server?.close().catch(() => {});
      rmSync(where.root, { recursive: true, force: true });
    }
  });
});

describe("B4 — 002: İşlem No sayacı geri yüklemede geri gitmez (001 ile aynı kural)", () => {
  it("yedek → 3 yeni hareket → geri yükle → yeni hareketin numarası öncekilerden büyük, tekrar yok", async () => {
    const where = dirs();
    try {
      const server = await bootVersion(CURRENT, where);
      const api = await server.login();
      try {
        const second = (await must("002", api.post("/api/companies", { code: "002", name: "Şirket 2", select: true }))).company;
        for (const amount of ["10", "20"]) await must("002 Kasa", api.post("/api/workspace/cash", { kind: "in", amount, date: today(), description: `002 ${amount}` }));
        const backup = await must("yedek", api.post("/api/admin/backups", { scope: "one", companyId: second.id }));
        const name = backup.backups.find(item => item.code === "002").name;
        const seen = [];
        for (const amount of ["30", "40", "50"]) {
          const row = await must("002 Kasa", api.post("/api/workspace/cash", { kind: "in", amount, date: today(), description: `002 ${amount}` }));
          seen.push(row.id);
        }
        // 002'nin kendi veri tabanı (açık örneğin bağlantısı).
        const noOf = id => server.app.context.withCompanyDb(server.app.companies.get(second.id), db => db.prepare("SELECT f.no FROM cash_entries c JOIN fin_events f ON f.id = c.event_id WHERE c.id = ?").get(id)?.no);
        const liveNumbers = seen.map(noOf);
        assert.equal(seqOf(liveNumbers.at(-1)), 5, JSON.stringify(liveNumbers));
        await must("geri yükle", api.post("/api/admin/backups/restore", { name, company: second.id, confirm: "002", password: ADMIN_PASSWORD }));
        assert.equal((await must("Kasa", api.get("/api/workspace/cash"))).entries.length, 2, "yedekteki 2 satır");
        const created = await must("geri yüklemeden sonra Kasa", api.post("/api/workspace/cash", { kind: "in", amount: "60", date: today(), description: "002 60" }));
        const no = noOf(created.id);
        assert.ok(no, "yeni hareketin İşlem No'su");
        assert.equal(seqOf(no), 6, `yedekteki sayaç (2) değil canlının sayacı (5) + 1: ${no} (canlı: ${JSON.stringify(liveNumbers)})`);
      } finally {
        await server.close();
      }
    } finally {
      rmSync(where.root, { recursive: true, force: true });
    }
  });
});
