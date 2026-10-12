// v2.2.0 — İz 2.9 (kullanıcı kararı 12.10.2026: "kart ifadesi 'Kredi Kartı' olsun, programda"): kullanıcıya görünen HER metinde
// "Kurumsal Kart" / "Kurumsal Kredi Kartı" yerine "Kredi Kartı". Satışta kartla tahsilat "POS"tur (önceki karar, değişmez); bizim kartımızla ödeme
// "Kredi Kartı". Kod yorumları, değişken adları, API alan/kod değerleri (kind 'card', hata kodları) DEĞİŞMEZ — denetim yalnız metne bakar.
//
// NASIL BOZARIM: (1) yeni bir ekran, hata ya da açıklama metnine "kurumsal kart" yazılır; (2) hesap türü listesinde eski ad kalır; (3) sunucunun
// hata metni eski adla döner; (4) kılavuzda eski ad kalır. Test kaynakta ve kılavuzda sözcüğü arar (yorumlar ayıklanır); ayrıca sunucunun
// kullanıcıya döndürdüğü tür adları ve hata metni çalışan sunucudan okunur.
// Sınır: yorum ayıklama basittir ("://" dışındaki "//" sonrası ve /* … */ blokları atılır); dize içindeki "//" sonrası metin denetlenmez.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import { BANK, bootBank, expectStatus, must, openAccount } from "./banka-210-hesap-ortak.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PATTERN = /kurumsal\s+(kredi\s+)?kart/i;

/** Yorumları ayıklar: /* … *\/ blokları ve "://" olmayan "//" satır yorumları. */
function code(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, block => block.replace(/[^\n]/g, " "))
    .split("\n")
    .map(line => line.replace(/(^|[^:])\/\/.*$/, "$1"));
}
function files(dir, test) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...files(full, test));
    else if (test(name)) out.push(full);
  }
  return out;
}
function hits(file) {
  return code(readFileSync(file, "utf8"))
    .map((line, index) => (PATTERN.test(line) ? `${path.relative(ROOT, file)}:${index + 1}: ${line.trim().slice(0, 160)}` : ""))
    .filter(Boolean);
}

describe("2.2.0 İz 2.9: görünen metinde \"Kurumsal Kart\" yok, \"Kredi Kartı\"", () => {
  it("istemci kaynağı (client/assets/hof-*.js, admin.js): yorum dışında \"kurumsal kart\" geçmez", () => {
    const list = files(path.join(ROOT, "client", "assets"), name => /^(hof-.*|admin)\.js$/.test(name));
    assert.ok(list.length > 20, `taranan istemci dosyası ${list.length}`);
    assert.deepEqual(list.flatMap(hits), []);
  });
  it("sunucu kaynağı (server/**/*.mjs): yorum dışında \"kurumsal kart\" geçmez (hata ve açıklama metinleri, hesap türü adı, 309 adı)", () => {
    const list = files(path.join(ROOT, "server"), name => name.endsWith(".mjs"));
    assert.ok(list.length > 50, `taranan sunucu dosyası ${list.length}`);
    assert.deepEqual(list.flatMap(hits), []);
  });
  it("kullanım kılavuzu (docs/kilavuz/DestekOfis-Kullanim-Kilavuzu.html): \"Kurumsal Kart\" / \"Kurumsal Kredi Kartı\" yok", () => {
    const text = readFileSync(path.join(ROOT, "docs", "kilavuz", "DestekOfis-Kullanim-Kilavuzu.html"), "utf8").replace(/<[^>]+>/g, " ");
    assert.equal(PATTERN.test(text), false, (text.match(new RegExp(`.{0,60}${PATTERN.source}.{0,60}`, "i")) || [""])[0]);
  });

  describe("çalışan sunucu: kullanıcıya dönen adlar ve hata metni", () => {
    let ctx;
    before(async () => {
      ctx = await bootBank();
    });
    after(async () => {
      await ctx?.server.close();
    });
    it("kart hesabının tür adı \"Kredi Kartı\"; kart yolunda kart seçilmeden ödeme → 400 \"Kredi Kartı seçin\"; 309 adı \"Diğer Mali Borçlar (Kredi Kartları)\"", async () => {
      const api = ctx.api;
      const bank = await openAccount(api, { bankName: "Ziraat Bankası", name: "Ana TL", kind: "demand", opening: { date: "2026-10-01", amount: "1.000", confirmed: true } });
      const first = await openAccount(api, { kind: "card", parentId: bank.id, name: "World", opening: { date: "2026-10-01", amount: "0", confirmed: true } });
      await openAccount(api, { kind: "card", parentId: bank.id, name: "Bonus", opening: { date: "2026-10-01", amount: "0", confirmed: true } });
      assert.equal(first.kindLabel, "Kredi Kartı");
      const party = await must("cari", api.post("/api/workspace/accounts", { name: "Tedarikçi 229", type: "supplier", registeredOn: "2026-01-01" }));
      const res = await api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "out", amount: "10", method: "card", date: "2026-10-08" });
      expectStatus(res, 400, "bank-account-required", "iki kartta kart seçilmeden");
      assert.match(res.error, /^Kredi Kartı seçin: kartla ödeme hangi kredi kartından yapıldı/);
      assert.equal(PATTERN.test(res.error), false, res.error);
      const settings = await must("ayarlar", api.get(`${BANK}/settings`));
      assert.equal(settings.chart?.["309"], "Diğer Mali Borçlar (Kredi Kartları)");
      assert.equal(PATTERN.test(JSON.stringify(settings)), false, "Banka Ayarları metinlerinde eski ad yok");
    });
  });
});
