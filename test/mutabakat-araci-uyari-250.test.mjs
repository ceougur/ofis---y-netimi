// 2.5.0 birleşik tur 6 — operatörün komut satırı mutabakat aracı (tools/mutabakat.mjs; npm run mutabakat) Kasa açılış UYARISINI sapma saymaz
// (BAŞ MİMAR KARARI 10.11 18:00 "D2 TUR 3 + Ç5-K TUR 2" (3); Ç5-K tur 2 sunum kararı S20 = A "Mutabakat Testi uyarı verir" — ekranda sarı, Defter Mutabakatı "Tutarlı").
// Önceden: uyarı "✗ 1 denetimde sapma" altında listeleniyor, çıkış kodu 1 (sapma var) — operatör veride bozukluk sanıyordu.
// Şimdi: ayrı "⚠ Uyarı" başlığı; sapma yokken çıkış 0, JSON'da ok true + notices; gerçek sapma + uyarı birlikteyken çıkış 1, sapma listesi uyarıyı içermez.
// Veri programın API'sinden (Silinenler'den geri alınan açılış öncesi Kasa hareketi — Z9 yolu); gerçek sapma store dışı yazımla (tanınmayan ödeme yolu; inceleme-226 G4).
// Araç ayrı süreçte; lisans servisi yok (ders 30). Veri dosyası araçtan önce / sonra aynı (salt okunur kopya).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { resolveDbPath } from "../server/lib/db-path.mjs";
import { loginAdmin, removeTestDir, startTestServer } from "./helpers.mjs";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOOL = path.join(ROOT, "tools", "mutabakat.mjs");
const NAME = "Kasa Açılışından Önce Tarihli Hareket";
const run = (dataDir, args = []) => {
  const result = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", TOOL, ...args], { cwd: ROOT, env: { ...process.env, HUKUK_DATA_DIR: dataDir, HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, encoding: "utf8", timeout: 300_000 });
  return { code: result.status, out: result.stdout, err: result.stderr };
};
const sha = file => createHash("sha256").update(readFileSync(file)).digest("hex");
const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data?.ok === true ? res.data.data : res.data;
};

describe("mutabakat aracı: Kasa açılış uyarısı 'Uyarı' başlığında, sapma değil", () => {
  const root = mkdtempSync(path.join(tmpdir(), "b6-mutabakat-araci-"));
  const dataDir = path.join(root, "data");
  before(async () => {
    const server = await startTestServer({ dataDir, backupDir: path.join(root, "backups"), now: { time: "2026-03-20T12:00:00", fixed: true } });
    try {
      const api = await loginAdmin(server);
      await api.post("/api/workspace/bank/setup/dismiss", {});
      const early = await must("Kasa Giriş (açılış yokken)", api.post("/api/workspace/cash", { kind: "in", amount: "100", date: "2026-03-05", description: "eski giriş", method: "cash" }));
      await must("sil", api.del(`/api/workspace/cash/${early.id}`));
      await must("Kasa açılışı", api.post("/api/workspace/cash/opening", { amount: "5.000", date: "2026-03-10" }));
      const listed = await must("Silinenler", api.get("/api/admin/trash"));
      const item = (Array.isArray(listed) ? listed : listed.items || []).find(row => row.ref === early.id);
      await must("geri yükle", api.post("/api/admin/trash/restore", { id: item?.id }));
    } finally {
      await server.close();
    }
  });
  after(() => removeTestDir(root));

  it("yalnız uyarı: çıkış 0; '✓ … tutarlı' + '⚠ Uyarı' başlığında uyarının adı, sayısı ve ne yapılacağı; 'sapma' listesi yok; JSON ok true, notices; dosya değişmez", () => {
    const file = resolveDbPath(dataDir);
    const before_ = sha(file);
    const text = run(dataDir);
    const json = run(dataDir, ["--json"]);
    const parsed = JSON.parse(json.out);
    assert.deepEqual(
      {
        cikis: text.code,
        tutarli: /✓ Ana defter ile Kasa, Cari, Stok ve Taksit alt defterleri kuruşu kuruşuna tutarlı\./.test(text.out),
        sapmaBasligi: /denetimde sapma/.test(text.out),
        uyari: text.out.includes(`⚠ Uyarı (sapma değil; yeni işlemleri engellemez) — 1 denetim:\n  ⚠ ${NAME} · 1 kayıt`),
        ipucu: /Kasa → Açılış Bakiyesi'nin tarihini öne alır; uyarı kalkar\./.test(text.out),
        json: { cikis: json.code, ok: parsed.ok, notices: parsed.notices },
        dosya: sha(file) === before_,
      },
      { cikis: 0, tutarli: true, sapmaBasligi: false, uyari: true, ipucu: true, json: { cikis: 0, ok: true, notices: ["cash:before-opening"] }, dosya: true },
      text.out.slice(-1500),
    );
  });

  it("gerçek sapma + uyarı: çıkış 1; sapma listesinde yalnız gerçek sapmalar (uyarı YOK), uyarı ayrı başlıkta", () => {
    const db = new DatabaseSync(resolveDbPath(dataDir));
    db.prepare("INSERT INTO cash_entries (id, kind, amount, date, description, method, created_by, created_at) VALUES ('b6-arac-yol', 'in', 10, '2026-03-11', 'x', 'bitcoin', 'x', ?)").run(new Date().toISOString());
    db.close();
    const text = run(dataDir);
    const drifts = text.out.split(/\r?\n/).slice(text.out.split(/\r?\n/).findIndex(line => /denetimde sapma:/.test(line)) + 1);
    const driftPart = drifts.slice(0, drifts.findIndex(line => /^Veri değiştirilmedi/.test(line))).join("\n");
    assert.equal(text.code, 1, text.out.slice(-1500));
    assert.match(driftPart, /Tanınmayan ödeme yolu/);
    assert.doesNotMatch(driftPart, new RegExp(NAME), "uyarı sapma listesinde değil");
    assert.ok(text.out.includes(`⚠ ${NAME} · 1 kayıt`), "uyarı ayrı başlıkta");
  });
});
