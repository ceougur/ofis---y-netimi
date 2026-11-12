// 2.5.0 Ç5-A tur 1e — İş 3 (dar kontrol ORTA-3, uç): göç 48'in SQL ön süzgeci kuralın (isOpeningCandidateNote) kendisiyle AYNI boşluk kümesini atar.
// Önceden (c5a1e-taban): ön süzgeç `ltrim(note, ' ' + sekme + LF + CR + NBSP) LIKE 'a%'` idi; kural String.prototype.trimStart ile (ECMAScript WhiteSpace + LineTerminator) atar →
// başında U+2003, U+FEFF, U+3000, U+2028 (ve U+000B, U+000C, U+1680, U+2000–U+200A, U+2029, U+202F, U+205F) olan "Açılış…" açıklaması ön süzgeçte elenip aday OLMUYORDU; v2.4.9
// (/^açılış/i + trim) ve kuralın kendisi onları açılış sayar → güncel kod 602 / 770'e yazıyordu (yanlış defter).
// Testler: [1] kümenin trimStart ile kod noktası kod noktası aynılığı (bütün Unicode); [2] dar kontrolün sekiz örnekli tablosu (ön süzgeç SQL'i ↔ kural ↔ v2.4.9 kuralı); [3] göç 48'in
// kendisi: v2.4.9'un GERÇEK koduyla üretilmiş veri (API açıklamanın baştaki boşluğunu JS trim ile attığı için özel boşluklu açıklama API'den DOĞAMAZ — eski sürüm / dış araç benzetimi
// olarak dosyaya ayrı bağlantıyla eklenir: EK DENETİM) güncel kodla açılır → aday kümesi = kuralın kümesi.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";
import { isOpeningCandidateNote, OPENING_TRIM_CODES } from "../server/lib/migrations.mjs";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
// Dar kontrolün tablosu (scratchpad/dk-c5a1-x9/bosluk.mjs) + kuralın kümesinin öbür üyelerinden örnekler.
const EIGHT = ["Açılış", "  Açılış", " Açılış", " Açılış", "﻿Açılış", "　Açılış", " Açılış", "AÇILIŞ"];
const MORE = ["\u000bAçılış", "\u000cAçılış", " Açılış", " açılış devri", " Açilış", " AÇILIŞ", " Açılış", " Acilis"];
const NOT = ["​Açılış", "Devir  açılış", " Devir"]; // U+200B (sıfır genişlikli boşluk) JS trim'in kümesinde DEĞİL; ortada / başka sözcük aday değil.
const v249Rule = note => /^açılış/i.test(String(note).trim());
const sqlFilter = (db, note) => db.prepare(`SELECT ltrim(?, char(${OPENING_TRIM_CODES.join(", ")})) LIKE 'a%' AS x`).get(note).x === 1;

describe("Ç5-A tur 1e — göç 48 ön süzgeci ↔ KG-16 kuralı (aynı boşluk kümesi)", () => {
  it("[1] ön süzgecin kümesi = trimStart'ın attığı karakterler (bütün Unicode, kod noktası kod noktası)", () => {
    const set = new Set(OPENING_TRIM_CODES);
    const differ = [];
    for (let cp = 0; cp <= 0x10ffff; cp += 1) {
      if (cp >= 0xd800 && cp <= 0xdfff) continue;
      const trimmed = `${String.fromCodePoint(cp)}x`.trimStart() === "x";
      if (trimmed !== set.has(cp)) differ.push(cp.toString(16));
    }
    assert.deepEqual(differ, [], "küme trimStart'tan farklı");
    // SQLite ltrim çok baytlı karakteri karakter olarak atar (UTF-8): her üye tek başına atılır.
    const db = new DatabaseSync(":memory:");
    try {
      for (const cp of OPENING_TRIM_CODES) assert.equal(db.prepare(`SELECT ltrim(?, char(${OPENING_TRIM_CODES.join(", ")})) AS v`).get(`${String.fromCodePoint(cp)}Açılış`).v, "Açılış", `U+${cp.toString(16)} atılmalı`);
    } finally {
      db.close();
    }
  });

  it("[2] dar kontrolün sekiz örneği + kümenin öbür üyeleri: ön süzgeç ⇔ kural ⇔ v2.4.9 kuralı; kümede olmayan karakter ve ortadaki 'açılış' aday değil", () => {
    const db = new DatabaseSync(":memory:");
    try {
      for (const note of [...EIGHT, ...MORE]) {
        assert.equal(isOpeningCandidateNote(note), true, `kural: ${JSON.stringify(note)}`);
        assert.equal(sqlFilter(db, note), true, `ön süzgeç kuralın kümesini atmalı: ${JSON.stringify(note)}`);
      }
      // v2.4.9 (/^açılış/i): baştaki boşluğun yedisini (trim) açılış sayar; "AÇILIŞ"ı saymaz (JS büyük / küçük harf eşleşmesi ı ↔ I'yı eşlemez) — KG-16 (S65) onu da aday yapar.
      for (const note of EIGHT.slice(0, 7)) assert.equal(v249Rule(note), true, `v2.4.9 kuralı da açılış sayar: ${JSON.stringify(note)}`);
      for (const note of NOT) assert.equal(isOpeningCandidateNote(note), false, `kural aday saymaz: ${JSON.stringify(note)}`);
    } finally {
      db.close();
    }
  });

  it("[3] göç 48: v2.4.9 verisinde başında özel boşluk olan 'Açılış…' satırları ADAY (519), aday kümesi = kuralın kümesi", { skip: !tagsAvailable(["v2.4.9"]) && "v2.4.9 etiketi yok", timeout: 180_000 }, async () => {
    const NOW = { time: "2026-10-20T12:00:00+03:00", fixed: true };
    const root = mkdtempSync(path.join(tmpdir(), "c5a1e-goc48-"));
    const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
    let server = null;
    try {
      const old = await bootVersion("v2.4.9", { ...dirs, now: NOW });
      let file;
      let account;
      try {
        const api = await old.login();
        await api.post("/api/workspace/bank/setup/dismiss", {});
        account = (await api.post("/api/workspace/accounts", { name: "Boşluk Müşteri", type: "customer", registeredOn: "2026-10-01" })).data.id;
        for (const [index, note] of [...EIGHT, ...MORE, ...NOT, "Satış"].entries()) {
          const r = await api.post(`/api/workspace/accounts/${account}/entries`, { kind: index % 2 ? "credit" : "debt", amount: String(10 + index), date: "2026-10-02", note });
          assert.equal(r.status, 200, `v2.4.9 satırı: ${r.status}`);
        }
        file = old.app.store.get("PRAGMA database_list").file;
      } finally {
        await old.close();
      }
      // v2.4.9 API'si baştaki boşluğu (JS trim — kuralın kümesi) atar: açıklamalar "Açılış…" diye saklandı. Özel boşluklu hâl eski sürüm / dış araçla yazılmış gibi geri konur
      // (EK DENETİM): girilen sırayla aynı satırlara.
      const db = new DatabaseSync(file);
      try {
        const rows = db.prepare("SELECT id FROM account_entries WHERE account_id = ? ORDER BY rowid").all(account);
        const notes = [...EIGHT, ...MORE, ...NOT, "Satış"];
        assert.equal(rows.length, notes.length);
        rows.forEach((row, index) => db.prepare("UPDATE account_entries SET note = ? WHERE id = ?").run(notes[index], row.id));
      } finally {
        db.close();
      }
      server = await bootVersion(CURRENT, { ...dirs, now: NOW, integrityScan: false });
      const rows = server.app.store.all("SELECT id, note, opening_review AS review FROM account_entries WHERE account_id = ? AND is_opening = 0 ORDER BY rowid", account).map(row => ({ ...row }));
      const wrong = rows.filter(row => (row.review === "candidate") !== isOpeningCandidateNote(row.note)).map(row => JSON.stringify(row.note));
      assert.deepEqual(wrong, [], "göç 48'in aday kümesi kuralın kümesiyle aynı olmalı");
      for (const note of EIGHT) assert.equal(rows.find(row => row.note === note)?.review, "candidate", `aday: ${JSON.stringify(note)}`);
      const entries = server.app.ledger.build();
      for (const row of rows.filter(item => item.review === "candidate")) {
        const entry = entries.find(item => item.id === `account:${row.id}`);
        assert.ok(entry?.lines.some(line => line.account === "519"), `${JSON.stringify(row.note)}: onaya kadar 519 (S47)`);
      }
    } finally {
      await server?.close().catch(() => {});
      rmSync(root, { recursive: true, force: true });
    }
  });
});
