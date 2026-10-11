// Bağımlılıksız ZIP yazma/okuma (deflate). Dağıtım paketleri ve güncelleme paketleri için kullanılır.
// Güvenlik: okurken "zip-slip" (../, mutlak yol) girişleri reddedilir, CRC ve boyut doğrulanır.
import { crc32, deflateRawSync, inflateRawSync } from "node:zlib";

const utf8 = value => Buffer.from(value, "utf8");

function dosDateTime(date) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

// entries: [{ name: "server/app.mjs", data: Buffer, date?: Date }]
export function createZip(entries, { level = 9 } = {}) {
  if (entries.length > 65_000) throw new Error("ZIP en fazla 65.000 dosya içerebilir.");
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const entry of entries) {
    const name = utf8(entry.name.replace(/\\/g, "/"));
    const raw = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data);
    const compressed = deflateRawSync(raw, { level });
    const useDeflate = compressed.length < raw.length;
    const body = useDeflate ? compressed : raw;
    if (body.length >= 0xffffffff || raw.length >= 0xffffffff) throw new Error(`Dosya çok büyük: ${entry.name}`);
    const checksum = crc32(raw) >>> 0;
    const { time, date } = dosDateTime(entry.date || new Date());
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(useDeflate ? 8 : 0, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, body);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(useDeflate ? 8 : 0, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += local.length + name.length + body.length;
  }
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

export function safeEntryName(name) {
  const normalized = String(name).replace(/\\/g, "/");
  if (!normalized || normalized.includes("\0")) return null;
  if (normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized)) return null;
  const parts = normalized.split("/");
  if (parts.some(part => part === "..")) return null;
  return parts.filter(part => part && part !== ".").join("/");
}

// Dönüş: [{ name, data: Buffer, directory: boolean }]
export function readZip(buffer, { maxTotalBytes = 1024 * 1024 * 1024 } = {}) {
  const minEnd = Math.max(0, buffer.length - 65_557);
  let endOffset = -1;
  for (let index = buffer.length - 22; index >= minEnd; index -= 1) {
    if (buffer.readUInt32LE(index) === 0x06054b50) {
      endOffset = index;
      break;
    }
  }
  if (endOffset < 0) throw new Error("Geçerli bir ZIP dosyası değil.");
  const count = buffer.readUInt16LE(endOffset + 10);
  const centralOffset = buffer.readUInt32LE(endOffset + 16);
  const entries = [];
  let pointer = centralOffset;
  let total = 0;
  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(pointer) !== 0x02014b50) throw new Error("ZIP merkez dizini bozuk.");
    const flags = buffer.readUInt16LE(pointer + 8);
    const method = buffer.readUInt16LE(pointer + 10);
    const checksum = buffer.readUInt32LE(pointer + 16);
    const compressedSize = buffer.readUInt32LE(pointer + 20);
    const size = buffer.readUInt32LE(pointer + 24);
    const nameLength = buffer.readUInt16LE(pointer + 28);
    const extraLength = buffer.readUInt16LE(pointer + 30);
    const commentLength = buffer.readUInt16LE(pointer + 32);
    const localOffset = buffer.readUInt32LE(pointer + 42);
    const rawName = buffer.subarray(pointer + 46, pointer + 46 + nameLength).toString(flags & 0x0800 ? "utf8" : "latin1");
    pointer += 46 + nameLength + extraLength + commentLength;
    if (flags & 0x0001) throw new Error("Şifreli ZIP desteklenmiyor.");
    const name = safeEntryName(rawName);
    if (name === null) throw new Error(`Güvensiz ZIP girdisi reddedildi: ${rawName}`);
    const directory = rawName.endsWith("/");
    if (directory) {
      entries.push({ name, data: Buffer.alloc(0), directory: true });
      continue;
    }
    total += size;
    if (total > maxTotalBytes) throw new Error("ZIP içeriği izin verilen boyutu aşıyor.");
    if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("ZIP yerel başlığı bozuk.");
    const dataStart = localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28);
    const body = buffer.subarray(dataStart, dataStart + compressedSize);
    let data;
    if (method === 0) data = Buffer.from(body);
    else if (method === 8) data = inflateRawSync(body, { maxOutputLength: size + 1 });
    else throw new Error(`Desteklenmeyen sıkıştırma yöntemi (${method}): ${rawName}`);
    if (data.length !== size || (crc32(data) >>> 0) !== checksum) throw new Error(`ZIP girdisi doğrulanamadı: ${rawName}`);
    entries.push({ name, data, directory: false });
  }
  return entries;
}
