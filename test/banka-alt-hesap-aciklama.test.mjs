// 2.2.0 (bağımsız doğrulama senet-bozma-1 T1-F1) — Alt Hesap Mizanı'nın açıklaması gösterdiği alt hesapları anar.
//
// Plan §3.11 madde 5 ve §3.11a: Alt Hesap Mizanı evrak alt hesaplarını da (101.01 / 101.02 çek, 121.01 / 121.02 senet) ve POS'ları (108) gösterir.
// Rapor bu satırları gösteriyordu, ama Rapor Merkezi açıklaması ve Banka penceresindeki not yalnız banka hesaplarını (102, 309, 300, 102.00 / 108.00)
// anıyordu: kullanıcı 121.02 satırının neden bankanın mizanında olduğunu açıklamadan öğrenemiyordu.
//
// NASIL BOZARIM: açıklama yeni ana hesap eklenince güncellenmez (4.1 101'i, 4.2 121'i ekledi; açıklama ikisinde de kaldı) → açıklama, raporun o anda
// gösterdiği her alt hesap kodunu ve adını anmalı; ekran notu da (kaynak taraması; satır bölme yok, dosya bütün okunur — ders 27).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, it } from "node:test";
import { TODAY, ZIRAAT_IBAN, bootBank, must, openAccount } from "./banka-210-hesap-ortak.mjs";

const RC = "/api/workspace/report-center";
const DOCUMENT_SUBS = { "101.01": "Portföydeki Çekler", "101.02": "Tahsile Verilen Çekler", "121.01": "Portföydeki Senetler", "121.02": "Tahsile Verilen Senetler" };

describe("Alt Hesap Mizanı açıklaması evrak alt hesaplarını anar (plan §3.11a)", () => {
  let ctx;
  before(async () => {
    ctx = await bootBank();
  });
  after(() => ctx.server.close());

  it("çek ve senet tahsile verilince rapor 101.0x / 121.0x satırlarını gösterir; açıklama hepsini kodu ve adıyla anar", async () => {
    const { api } = ctx;
    const ziraat = await openAccount(api, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", iban: ZIRAAT_IBAN, useCheque: true, useNote: true, opening: { date: "2026-10-01", amount: "100.000", confirmed: true } });
    const buyer = await must("müşteri", api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-09-01" }));
    const docs = [];
    for (const [instrument, amount, serialNo] of [["cheque", "500", "Ç-1"], ["cheque", "300", "Ç-2"], ["note", "640", "S-1"], ["note", "200", "S-2"]]) {
      docs.push(await must(`evrak ${serialNo}`, api.post("/api/workspace/cheques", { direction: "in", instrument, amount, issueDate: TODAY, dueDate: "2026-11-30", accountId: buyer.id, serialNo, bankName: "Halkbank" })));
    }
    // Birer çek ve senet tahsile verilir; ötekiler portföyde kalır → dört evrak alt hesabının dördü de satır olur.
    for (const doc of [docs[0], docs[2]]) await must("tahsile ver", api.post(`/api/workspace/cheques/${doc.id}/actions`, { action: "bank-deposit", date: TODAY, bankAccountId: ziraat.id }));

    const data = await must("rapor", api.get(`${RC}/alt-hesap-mizani?from=2026-01-01&to=2026-12-31`));
    const subs = data.rows.map(row => row[0]);
    for (const sub of Object.keys(DOCUMENT_SUBS)) assert.ok(subs.includes(sub), `rapor ${sub} satırını göstermeli (satırlar ${JSON.stringify(subs)})`);

    const list = await must("rapor listesi", api.get(RC));
    const reports = Array.isArray(list) ? list : list.reports;
    const meta = reports.find(report => report.id === "alt-hesap-mizani");
    assert.ok(meta, "Alt Hesap Mizanı katalogda");
    for (const [sub, name] of Object.entries(DOCUMENT_SUBS)) {
      assert.ok(meta.description.includes(sub), `açıklama ${sub} alt hesabını anmalı: ${meta.description}`);
      assert.ok(meta.description.includes(name), `açıklama "${name}" adını anmalı: ${meta.description}`);
    }
    assert.match(meta.description, /POS 108/, "açıklama POS alt hesaplarını (108) anmalı");
  });

  it("Banka penceresindeki Alt Hesap Mizanı notu evrak alt hesaplarını anar", () => {
    const source = readFileSync(new URL("../client/assets/hof-bank.js", import.meta.url), "utf8");
    const start = source.indexOf("async function openSubTrial");
    assert.ok(start >= 0, "openSubTrial bulundu");
    const body = source.slice(start, source.indexOf("catch (error)", start));
    const note = body.match(/<p class="hof-rep-note">([^<]*)<\/p>/);
    assert.ok(note, "Alt Hesap Mizanı notu bulundu");
    for (const sub of ["101.01", "101.02", "121.01", "121.02", "102.00", "108.00"]) assert.ok(note[1].includes(sub), `not ${sub} alt hesabını anmalı: ${note[1]}`);
  });
});
