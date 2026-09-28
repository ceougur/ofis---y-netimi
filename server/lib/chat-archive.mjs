// Sohbet arşivi (v2.0.2). 30 günden eski mesajlar programdan silinir; silinmeden önce sunucu bilgisayarındaki veri
// klasörüne, yazışma başına bir klasörde ay ay düz metin dosyası olarak yazılır (Not Defteri ile açılır):
//   <veri klasörü>/mesaj-arsivi/Ofis geneli/2026-08 Ağustos.txt
//   <veri klasörü>/mesaj-arsivi/Ali Veli - Selin Kaya [3f2a]/2026-08 Ağustos.txt
// Kişi kendi yazışmasının arşivini sohbet penceresinden de indirebilir; özel yazışmanın arşivini yalnız iki taraf
// indirir (sohbetteki gizlilik kuralı).
// Güvenlik: önce dosya yazılır (geçici dosya + yeniden adlandırma), sonra mesajlar silinir. Dosyanın ilk satırı o aya
// kadar arşivlenen son mesajın zamanını taşır; iş yarıda kesilirse aynı mesaj ikinci kez yazılmaz.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

export const ARCHIVE_DAYS = 30;
const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const BOM = "﻿";
const EOL = "\r\n";
const HEADER = /^﻿?DestekOfis mesaj arşivi · .* · son: (\S+)\r?$/;

const safeName = value =>
  String(value || "")
    .replace(/[\u0000-\u001F\u007F<>:"/\\|?*]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim()
    .slice(0, 80) || "Yazışma";
const pad = value => String(value).padStart(2, "0");
const localStamp = iso => {
  const date = new Date(iso);
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
const monthKey = iso => {
  const date = new Date(iso);
  return { key: `${date.getFullYear()}-${pad(date.getMonth() + 1)}`, label: `${MONTHS[date.getMonth()]} ${date.getFullYear()}`, file: `${date.getFullYear()}-${pad(date.getMonth() + 1)} ${MONTHS[date.getMonth()]}.txt` };
};

export function createChatArchive({ store, dir, log, now = () => Date.now(), days = ARCHIVE_DAYS }) {
  const root = dir;
  const tag = id => createHash("sha1").update(String(id)).digest("hex").slice(0, 4);
  const userName = id => store.get("SELECT display_name AS name FROM users WHERE id = ?", id)?.name || "Kullanıcı";

  // Yazışmanın klasörü: ofis kanalı sabit adla; özel yazışma iki kişinin adıyla ve değişmeyen kısa bir etiketle
  // (adlar sonradan değişse de aynı klasör kullanılır).
  function folderOf(conversation) {
    if (conversation.kind === "office") return path.join(root, "Ofis geneli");
    const suffix = `[${tag(conversation.id)}]`;
    if (existsSync(root)) {
      const found = readdirSync(root).find(name => name.endsWith(suffix));
      if (found) return path.join(root, found);
    }
    const names = store.all("SELECT user_id FROM chat_members WHERE conversation_id = ?", conversation.id).map(row => userName(row.user_id)).sort((a, b) => a.localeCompare(b, "tr"));
    return path.join(root, `${safeName(names.join(" - "))} ${suffix}`);
  }
  const titleOf = conversation => (conversation.kind === "office" ? "Ofis geneli" : path.basename(folderOf(conversation)).replace(/\s*\[[0-9a-f]{4}\]$/, ""));

  function readMonth(file) {
    if (!existsSync(file)) return { last: "", body: "" };
    const text = readFileSync(file, "utf8");
    const newline = text.indexOf("\n");
    const first = newline >= 0 ? text.slice(0, newline) : text;
    const match = HEADER.exec(first);
    return match ? { last: match[1], body: newline >= 0 ? text.slice(newline + 1) : "" } : { last: "", body: text.replace(/^﻿/, "") };
  }

  function writeMonth(file, conversation, month, body, last) {
    mkdirSync(path.dirname(file), { recursive: true });
    const header = `${BOM}DestekOfis mesaj arşivi · ${titleOf(conversation)} · ${month.label} · son: ${last}${EOL}`;
    const temp = `${file}.${process.pid}.tmp`;
    writeFileSync(temp, header + body);
    renameSync(temp, file);
  }

  /** 30 günden eski mesajları dosyaya yazar ve siler. */
  function run() {
    const cutoff = new Date(now() - days * 86_400_000).toISOString();
    const rows = store.all(
      `SELECT m.id, m.conversation_id, m.sender_id, m.body, m.case_key, m.created_at, u.display_name AS sender_name
       FROM chat_messages m LEFT JOIN users u ON u.id = m.sender_id WHERE m.created_at < ? ORDER BY m.conversation_id, m.created_at, m.id`,
      cutoff,
    );
    if (!rows.length) return { archived: 0, files: 0 };
    const groups = new Map();
    for (const row of rows) {
      const month = monthKey(row.created_at);
      const key = `${row.conversation_id}\u0000${month.key}`;
      if (!groups.has(key)) groups.set(key, { conversationId: row.conversation_id, month, rows: [] });
      groups.get(key).rows.push(row);
    }
    let archived = 0;
    let files = 0;
    for (const group of groups.values()) {
      const conversation = store.get("SELECT * FROM chat_conversations WHERE id = ?", group.conversationId) || { id: group.conversationId, kind: "direct" };
      const file = path.join(folderOf(conversation), group.month.file);
      try {
        const current = readMonth(file);
        const fresh = group.rows.filter(row => !current.last || row.created_at > current.last);
        if (fresh.length) {
          const lines = fresh.map(row => `${localStamp(row.created_at)} · ${row.sender_name || "Kullanıcı"}: ${String(row.body).replace(/\r?\n/g, `${EOL}    `)}${row.case_key && !String(row.body).includes(row.case_key) ? ` [kayıt: ${row.case_key}]` : ""}${EOL}`);
          writeMonth(file, conversation, group.month, current.body + lines.join(""), fresh[fresh.length - 1].created_at);
          files += 1;
        }
        // Dosyada olan (bu turda ya da yarıda kalan önceki turda yazılan) mesajlar silinir.
        const last = fresh.length ? fresh[fresh.length - 1].created_at : current.last;
        const ids = group.rows.filter(row => row.created_at <= last).map(row => row.id);
        store.tx(() => {
          for (const id of ids) store.run("DELETE FROM chat_messages WHERE id = ?", id);
        });
        archived += ids.length;
      } catch (error) {
        log?.error?.("Mesaj arşivi yazılamadı; mesajlar programda kaldı", error);
      }
    }
    if (archived) log?.info?.(`${archived} eski mesaj arşive taşındı (${root}).`);
    return { archived, files };
  }

  // Bir yazışmanın arşiv dosyaları (eskiden yeniye).
  function monthsOf(conversation) {
    const folder = folderOf(conversation);
    if (!existsSync(folder)) return [];
    return readdirSync(folder)
      .filter(name => /^\d{4}-\d{2} .+\.txt$/.test(name))
      .sort()
      .map(name => path.join(folder, name));
  }

  /** Kişinin indirdiği arşiv: tüm aylar tek metinde. */
  function download(conversation) {
    const months = monthsOf(conversation);
    if (!months.length) return null;
    const parts = months.map(file => {
      const { body } = readMonth(file);
      return `==== ${path.basename(file, ".txt").slice(8)} ====${EOL}${body}`;
    });
    return { name: `Mesaj arşivi - ${titleOf(conversation)}.txt`, body: Buffer.from(`${BOM}DestekOfis mesaj arşivi · ${titleOf(conversation)}${EOL}${EOL}${parts.join(EOL)}`, "utf8") };
  }

  // Yönetim paneli için: klasör, yazışma ve dosya sayısı, toplam boyut.
  function info() {
    const out = { dir: root, days, conversations: 0, files: 0, bytes: 0 };
    if (!existsSync(root)) return out;
    for (const name of readdirSync(root)) {
      const folder = path.join(root, name);
      if (!statSync(folder).isDirectory()) continue;
      out.conversations += 1;
      for (const file of readdirSync(folder)) {
        if (!file.endsWith(".txt")) continue;
        out.files += 1;
        out.bytes += statSync(path.join(folder, file)).size;
      }
    }
    return out;
  }

  return { run, months: conversation => monthsOf(conversation).length, download, info };
}
