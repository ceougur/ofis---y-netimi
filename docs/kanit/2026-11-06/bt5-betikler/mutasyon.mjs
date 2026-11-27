// BT5 mutasyon koşucusu (ders 7, 38): bt5-mut kopyasında (taban 578c12d4 + bu ajanın değişiklikleri) her mutantı uygular, verilen testleri koşar, dosyayı ajanın worktree'sindeki
// asıl dosyadan geri yükler. Kullanım: node mutasyon.mjs <küme: db|kart|bt4|ah|we|hepsi> [kimlik önekleri,virgüllü]
import { appendFileSync, copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const S = "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad";
const ROOT = path.join(S, "bt5-mut");
const ORIG = "/home/user/ofis---y-netimi/.claude/worktrees/agent-a731f6dec73e0177c";
const OUT = path.join(S, "bt5-kanit", "mutasyon.out");
const set = process.argv[2] || "hepsi";
const only = process.argv[3] || "";
const DB = "server/lib/db.mjs";
const AC = "server/lib/accounts.mjs";
const P = "server/routes/plans.mjs";
const K = "server/routes/stock.mjs";
const R = "server/lib/row-version.mjs";
const INV = "server/routes/invoices.mjs";
const CB = "server/lib/company-backups.mjs";
const AW = "server/lib/whatsapp/app-webhook.mjs";
const T_DB = ["test/db-tx-kayip-250.test.mjs"];
const T_KART = ["test/kapali-kart-ekstre-tarihi-250.test.mjs"];
const T_BT4 = ["test/birlesik-tur4-degisiklik-yok-250.test.mjs"];
const T_AH = ["test/acilis-onarimi-savunma-250.test.mjs"];
const T_WE = ["test/whatsapp-we-webhook-bilgisi-250.test.mjs"];
// BT4 dar kontrolünün mutantları (dk-bt4-betik/mutasyon.mjs; aynı desenler, bağımsız uygulama değil — yeterlilik onların mutantlarıyla istendi).
const PT = '["name", "phone", "note", "refNo", "registeredOn", "caseKey", "caseSource", "caseTitle", "groupId", "subgroupId"]';
const ST = '["kind", "code", "name", "unit", "category", "vatRate", "note"]';
const SN = '["minQty", "unitPrice", "salePrice"]';
const drop = (list, key) => list.replace(`"${key}", `, "").replace(`, "${key}"`, "");
const M = [
  // ---- madde 1: db.mjs ----
  { set: "db", id: "D1 exec: assertLive yok", file: DB, from: "    exec: sql => {\n      assertLive();\n", to: "    exec: sql => {\n", tests: T_DB },
  { set: "db", id: "D2 get / all: yazım denetimi yok", file: DB, from: "    if (depth > 0 && mayWrite(sql)) assertLive();\n", to: "", tests: T_DB },
  { set: "db", id: "D3 get / all: ilk hata kaydı yok", file: DB, from: "      return prepare(sql)[method](...args);\n    } catch (error) {\n      noteLost(error);\n", to: "      return prepare(sql)[method](...args);\n    } catch (error) {\n", tests: T_DB },
  { set: "db", id: "D4 exec: ilk hata kaydı yok", file: DB, from: "        return db.exec(sql);\n      } catch (error) {\n        noteLost(error);\n", to: "        return db.exec(sql);\n      } catch (error) {\n", tests: T_DB },
  { set: "db", id: "D5 setting: korumasız okuma (eski yol)", file: DB, from: 'const row = query("get", "SELECT value FROM settings WHERE key = ?", [key]);', to: 'const row = prepare("SELECT value FROM settings WHERE key = ?").get(key);', tests: T_DB },
  { set: "db", id: "D6 WITH okuma sayılır", file: DB, from: "const READ_SQL = /^\\s*(?:SELECT|VALUES|EXPLAIN)\\b", to: "const READ_SQL = /^\\s*(?:SELECT|VALUES|EXPLAIN|WITH)\\b", tests: T_DB },
  { set: "db", id: "D7 RETURNING'li her deyim okuma sayılır (yalnız INSERT/UPDATE/DELETE başı yazım)", file: DB, from: "      kind = !READ_SQL.test(sql);\n", to: "      kind = /^\\s*(?:INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER)\\b/i.test(sql) && !/\\bRETURNING\\b/i.test(sql);\n", tests: T_DB },
  // ---- madde 4: kapalı kart tarihi ----
  { set: "kart", id: "A1 closed_at yerine updated_at (karşı mutant)", file: AC, from: 'const closedOn = plan.closedAt || String(plan.updatedAt || "").slice(0, 10);', to: 'const closedOn = String(plan.updatedAt || "").slice(0, 10);', tests: T_KART },
  { set: "kart", id: "A2 Kayıt Tarihi alt sınırı yok", file: AC, from: "date: closedOn && closedOn > opened ? closedOn : opened,", to: "date: closedOn || opened,", tests: T_KART },
  { set: "kart", id: "A3 PLAN_SQL closedAt seçmiyor (cari başına yol)", file: P, from: "p.covers_balance AS coversBalance, p.closed_at AS closedAt,", to: "p.covers_balance AS coversBalance,", tests: T_KART },
  { set: "kart", id: "A4 ledgerPlansByAccount closedAt seçmiyor (toplu yol)", file: P, from: "updated_at AS updatedAt, closed_at AS closedAt FROM plans WHERE deleted_at IS NULL AND account_id <> ''", to: "updated_at AS updatedAt FROM plans WHERE deleted_at IS NULL AND account_id <> ''", tests: T_KART },
  // ---- madde 3: BT4 alan alan (dar kontrolün mutantları) ----
  { set: "bt4", id: "K1 taksit: kısa yol sürüm denetiminden SONRA", file: P, from: '      if (sameFields(previous, input, { texts: ["dueDate", "note"], numbers: ["amount"] })) return false;\n      assertRowVersion(body, rowVersion(store, "plan_items", previous.id), ITEM_STALE);\n', to: '      assertRowVersion(body, rowVersion(store, "plan_items", previous.id), ITEM_STALE);\n      if (sameFields(previous, input, { texts: ["dueDate", "note"], numbers: ["amount"] })) return false;\n', tests: T_BT4 },
  { set: "bt4", id: "K5 kart: kısa yol isteğin başında okunan kartla", file: P, from: `sameFields(previous, input, { texts: ${PT}`, to: `sameFields(opened, input, { texts: ${PT}`, tests: T_BT4 },
  { set: "bt4", id: "K7 taksit: açıklama karşılaştırılmaz", file: P, from: 'texts: ["dueDate", "note"]', to: 'texts: ["dueDate"]', tests: T_BT4 },
  { set: "bt4", id: "K9 stok: KDV oranı karşılaştırılmaz", file: K, from: `texts: ${ST}`, to: `texts: ${drop(ST, "vatRate")}`, tests: T_BT4 },
  { set: "bt4", id: "K11 kart: carisiz eski kart da kısa yola", file: P, from: "const sameAccount = Boolean(previous.accountId) && ", to: "const sameAccount = ", tests: T_BT4 },
  { set: "bt4", id: "K12 kart: durum karşılaştırılmaz", file: P, from: "if (sameAccount && status === previous.status && sameFields", to: "if (sameAccount && sameFields", tests: T_BT4 },
  { set: "bt4", id: "Y1 kart: Kayıt Tarihi karşılaştırılmaz", file: P, from: `texts: ${PT}`, to: `texts: ${drop(PT, "registeredOn")}`, tests: T_BT4 },
  { set: "bt4", id: "Y2 kart: grup karşılaştırılmaz", file: P, from: `texts: ${PT}`, to: `texts: ${drop(PT, "groupId")}`, tests: T_BT4 },
  { set: "bt4", id: "Y3 kart: alt grup karşılaştırılmaz", file: P, from: `texts: ${PT}`, to: `texts: ${drop(PT, "subgroupId")}`, tests: T_BT4 },
  { set: "bt4", id: "Y4 kart: kayıt bağı (caseKey) karşılaştırılmaz", file: P, from: `texts: ${PT}`, to: `texts: ${drop(PT, "caseKey")}`, tests: T_BT4 },
  { set: "bt4", id: "Y5 kart: Sıra No karşılaştırılmaz", file: P, from: `texts: ${PT}`, to: `texts: ${drop(PT, "refNo")}`, tests: T_BT4 },
  { set: "bt4", id: "Y6 kart: ad karşılaştırılmaz", file: P, from: `texts: ${PT}`, to: `texts: ${drop(PT, "name")}`, tests: T_BT4 },
  { set: "bt4", id: "Y7 kart: toplam karşılaştırılmaz", file: P, from: 'numbers: ["total"] })) return detail', to: "numbers: [] })) return detail", tests: T_BT4 },
  { set: "bt4", id: "Y8 kart: cari değişikliği karşılaştırılmaz", file: P, from: "const sameAccount = Boolean(previous.accountId) && (input.accountId || previous.accountId) === previous.accountId;", to: "const sameAccount = Boolean(previous.accountId);", tests: T_BT4 },
  { set: "bt4", id: "Y9 stok: tür karşılaştırılmaz", file: K, from: `texts: ${ST}`, to: `texts: ${drop(ST, "kind")}`, tests: T_BT4 },
  { set: "bt4", id: "Y10 stok: Stok Kodu karşılaştırılmaz", file: K, from: `texts: ${ST}`, to: `texts: ${drop(ST, "code")}`, tests: T_BT4 },
  { set: "bt4", id: "Y11 stok: ad karşılaştırılmaz", file: K, from: `texts: ${ST}`, to: `texts: ${drop(ST, "name")}`, tests: T_BT4 },
  { set: "bt4", id: "Y12 stok: birim karşılaştırılmaz", file: K, from: `texts: ${ST}`, to: `texts: ${drop(ST, "unit")}`, tests: T_BT4 },
  { set: "bt4", id: "Y13 stok: kategori karşılaştırılmaz", file: K, from: `texts: ${ST}`, to: `texts: ${drop(ST, "category")}`, tests: T_BT4 },
  { set: "bt4", id: "Y14 stok: kritik seviye karşılaştırılmaz", file: K, from: `numbers: ${SN}`, to: `numbers: ${drop(SN, "minQty")}`, tests: T_BT4 },
  { set: "bt4", id: "Y15 stok: Satış Fiyatı karşılaştırılmaz", file: K, from: `numbers: ${SN}`, to: `numbers: ${drop(SN, "salePrice")}`, tests: T_BT4 },
  { set: "bt4", id: "Y16 taksit: vade karşılaştırılmaz", file: P, from: 'texts: ["dueDate", "note"]', to: 'texts: ["note"]', tests: T_BT4 },
  { set: "bt4", id: "Y17 taksit: tutar karşılaştırılmaz", file: P, from: 'numbers: ["amount"] })) return false', to: "numbers: [] })) return false", tests: T_BT4 },
  { set: "bt4", id: "Y18 sameFields: metin büyük / küçük harf duyarsız", file: R, from: 'if (String(current[key] ?? "") !== String(next[key] ?? "")) return false;', to: 'if (String(current[key] ?? "").toLocaleLowerCase("tr-TR") !== String(next[key] ?? "").toLocaleLowerCase("tr-TR")) return false;', tests: T_BT4 },
  { set: "bt4", id: "Y19 sameFields: sayı toleransı 1 kuruş (0,011)", file: R, from: "< 1e-9)) return false;", to: "< 0.011)) return false;", tests: T_BT4 },
  { set: "bt4", id: "Y20 sameFields: boş değerler hep 'aynı'", file: R, from: 'if (String(current[key] ?? "") !== String(next[key] ?? "")) return false;', to: 'if (current[key] != null && next[key] != null && String(current[key]) !== String(next[key])) return false;', tests: T_BT4 },
  { set: "bt4", id: "Y21 kart: kısa yolda yazım yok ama kanal yayını yapılır", file: P, from: "    if (wrote) {\n      changed(user, { planId: opened.id });", to: "    if (true) {\n      changed(user, { planId: opened.id });", tests: T_BT4 },
  { set: "bt4", id: "Y22 stok: Alış Fiyatı karşılaştırılmaz (bu turun eki)", file: K, from: `numbers: ${SN}`, to: `numbers: ${drop(SN, "unitPrice")}`, tests: T_BT4 },
  { set: "bt4", id: "Y23 kart: telefon karşılaştırılmaz (bu turun eki)", file: P, from: `texts: ${PT}`, to: `texts: ${drop(PT, "phone")}`, tests: T_BT4 },
  { set: "bt4", id: "Y24 kart: not karşılaştırılmaz (bu turun eki)", file: P, from: `texts: ${PT}`, to: `texts: ${drop(PT, "note")}`, tests: T_BT4 },
  { set: "bt4", id: "Y25 kart: caseSource karşılaştırılmaz (bu turun eki)", file: P, from: `texts: ${PT}`, to: `texts: ${drop(PT, "caseSource")}`, tests: T_BT4 },
  { set: "bt4", id: "Y26 kart: caseTitle karşılaştırılmaz (bu turun eki)", file: P, from: `texts: ${PT}`, to: `texts: ${drop(PT, "caseTitle")}`, tests: T_BT4 },
  { set: "bt4", id: "Y27 stok: not karşılaştırılmaz (bu turun eki)", file: K, from: `texts: ${ST}`, to: `texts: ${drop(ST, "note")}`, tests: T_BT4 },
  // ---- madde 2: AH savunma kuralları (dk-ah/betik/mutant.py desenleri AYNEN) ----
  { set: "ah", id: "M5 kirli işareti hiç konmaz", file: INV, from: '          dirty.add(store.get("SELECT account_id AS accountId FROM plans WHERE id = ?", row.planId)?.accountId || "");', to: "          void 0;", tests: T_AH },
  { set: "ah", id: "M5b kirli işaretinin iki satırı da kalkar (bu turun eki)", file: INV, from: '          dirty.add(store.get("SELECT account_id AS accountId FROM plans WHERE id = ?", row.planId)?.accountId || "");\n          for (const owner of store.all("SELECT DISTINCT account_id AS accountId FROM invoices WHERE plan_id = ?", row.planId)) dirty.add(owner.accountId || "");', to: "          void 0;", tests: T_AH },
  { set: "ah", id: "M5c yalnız kartı taşıyan faturaların carisi satırı kalkar (bu turun eki)", file: INV, from: '          for (const owner of store.all("SELECT DISTINCT account_id AS accountId FROM invoices WHERE plan_id = ?", row.planId)) dirty.add(owner.accountId || "");', to: "          void 0;", tests: T_AH },
  { set: "ah", id: "M6 üst sınır iki yerde de kalkar", file: INV, from: "      if (!(left > target + 0.005) || left > before + 0.005) continue;\n      if (!exact) {", to: "      if (!(left > target + 0.005)) continue;\n      if (!exact) {", tests: T_AH },
  { set: "ah", id: "M6b yalnız yeniden okumadan sonraki üst sınır kalkar (EŞDEĞER beklenir)", file: INV, from: "        if (!(left > target + 0.005) || left > before + 0.005) continue;\n      }", to: "        if (!(left > target + 0.005)) continue;\n      }", tests: T_AH },
  { set: "ah", id: "M9 yeniden okuma kalkar (karar toplu durumla)", file: INV, from: "      if (!exact) {\n        // Onarım kararı: eski kodun okumasıyla (cari başına yol) yeniden verilir.", to: "      if (false) {\n        // Onarım kararı: eski kodun okumasıyla (cari başına yol) yeniden verilir.", tests: T_AH },
  { set: "ah", id: "M10 elemede açık yerine ödenen okunur", file: INV, from: "if (found) state = { open: Number(found.open) || 0, excess: Number(found.excess) || 0 };", to: "if (found) state = { open: Number(found.paid) || 0, excess: Number(found.excess) || 0 };", tests: T_AH },
  // ---- madde 5: geri yüklemede webhook çifti ----
  { set: "we", id: "W1 yeni koşul kalkar (eski kod)", file: CB, from: " AND NOT (key = 'whatsapp.appWebhook' AND NOT EXISTS (SELECT 1 FROM live.settings WHERE key = 'whatsapp.appWebhook'))", to: "", tests: T_WE },
  { set: "we", id: "W2 ters koşul (canlıda VARSA yedeğinki)", file: CB, from: "AND NOT EXISTS (SELECT 1 FROM live.settings WHERE key = 'whatsapp.appWebhook'))", to: "AND EXISTS (SELECT 1 FROM live.settings WHERE key = 'whatsapp.appWebhook'))", tests: T_WE },
  // ---- madde 7: salt okunur lisans ----
  { set: "we", id: "R1 salt okunur denetimi kalkar", file: AW, from: '      if (writable === false) return { ready: false, callbackUrl: "", verifyToken: "", reason: APP_WEBHOOK_READ_ONLY };\n', to: "", tests: T_WE },
  { set: "we", id: "R2 denetim yalnız satır yokken (açılamayan çift yeniden üretilir)", file: AW, from: "      if (writable === false) return", to: "      if (writable === false && !row) return", tests: T_WE },
];
const env = { ...process.env, TZ: process.env.TZ || "UTC", HUKUK_LICENSE_URL: "http://127.0.0.1:9", GIT_DIR: "/home/user/ofis---y-netimi/.git/worktrees/agent-a731f6dec73e0177c" };
const log = line => {
  console.log(line);
  appendFileSync(OUT, `${line}\n`);
};
log(`--- bt5 mutasyon ${new Date().toISOString()} (küme ${set}${only ? ` ${only}` : ""}; TZ ${env.TZ})`);
let dead = 0;
let alive = 0;
for (const m of M) {
  if (set !== "hepsi" && m.set !== set) continue;
  if (only && !only.split(",").some(prefix => m.id.startsWith(`${prefix} `))) continue;
  const file = path.join(ROOT, m.file);
  const original = path.join(ORIG, m.file);
  const source = readFileSync(original, "utf8");
  const count = source.split(m.from).length - 1;
  if (count !== 1) {
    log(`${m.id}: UYGULANAMADI (desen ${count} kez)`);
    alive += 1;
    continue;
  }
  writeFileSync(file, source.replace(m.from, m.to));
  const run = spawnSync("node", ["--disable-warning=ExperimentalWarning", "--test", "--test-concurrency=1", ...m.tests], { cwd: ROOT, env, encoding: "utf8", timeout: 1800000, maxBuffer: 256 * 1024 * 1024 });
  copyFileSync(original, file);
  const text = `${run.stdout}\n${run.stderr}`;
  const fails = /# fail (\d+)/.exec(text)?.[1] ?? "?";
  const tests = /# tests (\d+)/.exec(text)?.[1] ?? "?";
  const first = text.split("\n").filter(l => /^\s*not ok \d+ - /.test(l) && !/subtests failed/.test(l) && !/^not ok/.test(l)).slice(0, 4).map(l => l.trim().slice(0, 110));
  if (run.status === 0) alive += 1;
  else dead += 1;
  log(`${m.id}: ${run.status === 0 ? "YAŞADI" : "ÖLDÜ"} (çıkış ${run.status}; testler ${tests}, kırmızı ${fails}) ${JSON.stringify(first)}`);
}
// Bütün dosyalar asıla döndü mü?
const files = [...new Set(M.map(m => m.file))];
const differ = files.filter(f => readFileSync(path.join(ROOT, f), "utf8") !== readFileSync(path.join(ORIG, f), "utf8"));
log(`=== küme ${set}${only ? ` ${only}` : ""}: ÖLDÜ ${dead}, YAŞADI / UYGULANAMADI ${alive}; asıla dönmeyen dosya: ${differ.length ? differ.join(", ") : "yok"}`);
