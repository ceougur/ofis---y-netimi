// BİRLEŞİK TUR 3 mutasyon koşucusu: bt3-mut kopyasında her mutantı uygular, ilgili testi koşar, dosyayı geri yükler. Kullanım: node mutasyon.mjs <birim|e2e|hepsi>
import { readFileSync, writeFileSync, copyFileSync, appendFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/bt3-mut";
const OUT = "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/bt3-kanit/mutasyon.out";
const which = process.argv[2] || "hepsi";
const UNIT = ["node", ["--test", "--test-concurrency=1", "test/birlesik-tur3-yaris-250.test.mjs"]];
const E2E3 = ["node", ["--disable-warning=ExperimentalWarning", "test/e2e/senaryo-duzeltme-kilidi-tur3-250.mjs"]];
const E2E2 = ["node", ["--disable-warning=ExperimentalWarning", "test/e2e/senaryo-duzeltme-kilidi-250.mjs"]];
const M = [
  // sunucu
  { id: "M1 açılış: güncelleme yolunda erken sürüm denetimi yok", kind: "birim", file: "server/routes/cash.mjs", from: "    assertOpeningVersion(body, existing);\n", to: "\n" },
  { id: "M2 açılış: güncelleme yolunda işlem içi (prepare) sürüm denetimi yok", kind: "birim", file: "server/routes/cash.mjs", from: "        assertOpeningVersion(body, cashOpenings(store)[0] || null);\n        assertOpening(user, entry, existing.id);", to: "        assertOpening(user, entry, existing.id);" },
  { id: "M3 açılış: openingId (kimlik) denetimi yok", kind: "birim", file: "server/routes/cash.mjs", from: 'if (Object.hasOwn(body, "openingId") && body.openingId', to: 'if (false && Object.hasOwn(body, "openingId") && body.openingId' },
  { id: "M4 kart: sürüm isteğin başında okunan kartla (işlem içi değil)", kind: "birim", file: "server/routes/plans.mjs", from: "assertRowVersion(body, previous, PLAN_STALE);", to: "assertRowVersion(body, opened, PLAN_STALE);" },
  { id: "M5 kart: sürüm denetimi yok", kind: "birim", file: "server/routes/plans.mjs", from: "assertRowVersion(body, previous, PLAN_STALE);", to: "" },
  { id: "M6 taksit: sürüm denetimi yok", kind: "birim", file: "server/routes/plans.mjs", from: 'assertRowVersion(body, rowVersion(store, "plan_items", previous.id), ITEM_STALE);', to: "" },
  { id: "M7 taksit: kart yanıtında taksit sürümü yok", kind: "birim", file: "server/routes/plans.mjs", from: "note, updated_at AS updatedAt FROM plan_items WHERE plan_id = ? ORDER BY due_date, seq", to: "note FROM plan_items WHERE plan_id = ? ORDER BY due_date, seq" },
  { id: "M8 stok kartı: sürüm denetimi yok", kind: "birim", file: "server/routes/stock.mjs", from: "assertRowVersion(body, previous, ITEM_STALE);", to: "" },
  { id: "M9 stok kartı: sürüm isteğin başında okunan kartla", kind: "birim", file: "server/routes/stock.mjs", from: "assertRowVersion(body, previous, ITEM_STALE);", to: "assertRowVersion(body, opened, ITEM_STALE);" },
  // istemci
  { id: "C1 Açılış formu sürüm göndermez", kind: "e2e3", file: "client/assets/hof-workspace.js", from: 'const body = { ...data, openingId: current?.id || "", updatedAt: current ? current.updatedAt || "" : "" };', to: "const body = { ...data };" },
  { id: "C2 Açılış formu 409'da Kasa listesini yenilemez", kind: "e2e3", file: "client/assets/hof-workspace.js", from: 'if (error?.status === 409 && error?.data?.code === "cash-opening-stale") after?.();', to: "" },
  { id: "C3 taksit formu sürüm göndermez", kind: "e2e3", file: "client/assets/hof-plans.js", from: 'body: item ? { ...data, updatedAt: item.updatedAt || "" } : data', to: "body: data" },
  { id: "C4 taksit formu 409'da kartı yenilemez", kind: "e2e3", file: "client/assets/hof-plans.js", from: 'if (item && ((error?.status === 409 && error?.data?.code === "plan-item-stale") || error?.status === 404) && modal) loadPlan(plan.id, { quiet: true }).catch(() => null);', to: "" },
  { id: "C5 kart formu sürüm göndermez", kind: "e2e3", file: "client/assets/hof-plans.js", from: 'if (plan) payload.updatedAt = plan.updatedAt || "";', to: "" },
  { id: "C6 stok kartı formu sürüm göndermez", kind: "e2e3", file: "client/assets/hof-stock.js", from: 'body: { ...data, updatedAt: item.updatedAt || "" } }', to: "body: data }" },
  { id: "C7 stok kartı formu 409'dan sonra kendiliğinden bir kez yeniden gönderir", kind: "e2e3", file: "client/assets/hof-stock.js", from: 'loadItem(item.id, { quiet: true }).catch(() => null);\n          throw error;\n        }\n        if (!item && data.openingPay === "cash")', to: 'loadItem(item.id, { quiet: true }).catch(() => null);\n          if (item && error?.data?.code === "stock-item-stale") await HOF.api(`/api/workspace/stock/${encodeURIComponent(item.id)}`, { method: "PUT", body: { ...data, updatedAt: item.updatedAt || "" } }).catch(() => null);\n          throw error;\n        }\n        if (!item && data.openingPay === "cash")' },
  { id: "C8 eksi stok onayından sonraki 409'da kart yenilenmez (3b eski hâl)", kind: "e2e3", file: "client/assets/hof-stock.js", from: "            if (staleOrGone(again)) refreshCard();\n", to: "" },
  { id: "M-yinele (birleşik tur 2 dar kontrolü; DÜŞÜK-3): cari formu 409'dan sonra kendiliğinden bir kez yeniden gönderir", kind: "e2e2", file: "client/assets/hof-accounts.js", from: 'if (entry && ((error?.status === 409 && error?.data?.code === "account-entry-stale") || error?.status === 404) && modal && view.mode === "card" && view.id === account.id) loadAccount(account.id, { quiet: true }).catch(() => null);\n', to: 'if (entry && ((error?.status === 409 && error?.data?.code === "account-entry-stale") || error?.status === 404) && modal && view.mode === "card" && view.id === account.id) loadAccount(account.id, { quiet: true }).catch(() => null);\n          if (entry && error?.status === 409 && error?.data?.code === "account-entry-stale") await send({}).catch(() => null);\n' },
];
const env = { ...process.env, PLAYWRIGHT_BROWSERS_PATH: "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/pw-1194", TZ: "UTC", HUKUK_LICENSE_URL: "http://127.0.0.1:9" };
const log = line => {
  console.log(line);
  appendFileSync(OUT, `${line}\n`);
};
log(`--- mutasyon ${new Date().toISOString()} (${which})`);
for (const m of M) {
  if (which !== "hepsi" && !m.kind.startsWith(which)) continue;
  const file = path.join(ROOT, m.file);
  const original = path.join(ROOT, "orijinal", m.file);
  const source = readFileSync(original, "utf8");
  const count = source.split(m.from).length - 1;
  if (count !== 1) {
    log(`${m.id}: UYGULANAMADI (desen ${count} kez)`);
    continue;
  }
  writeFileSync(file, source.replace(m.from, m.to));
  const [cmd, args] = m.kind === "birim" ? UNIT : m.kind === "e2e3" ? E2E3 : E2E2;
  const run = spawnSync(cmd, args, { cwd: ROOT, env, encoding: "utf8", timeout: 900000, maxBuffer: 64 * 1024 * 1024 });
  copyFileSync(original, file);
  const text = `${run.stdout}\n${run.stderr}`;
  const fails = m.kind === "birim" ? (/# fail (\d+)/.exec(text)?.[1] ?? "?") : (/(\d+) geçti, (\d+) kaldı/.exec(text)?.[2] ?? "?");
  const first = m.kind === "birim" ? text.split("\n").filter(l => /^\s+not ok \d+ - /.test(l)).slice(0, 3).map(l => l.trim().slice(0, 140)) : text.split("\n").filter(l => l.includes("✗")).slice(0, 3).map(l => l.trim().slice(0, 160));
  log(`${m.id}: ${run.status === 0 ? "YAŞADI" : "ÖLDÜ"} (çıkış ${run.status}; kırmızı ${fails}) ${JSON.stringify(first)}`);
}
