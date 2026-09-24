/* DestekOfis — Excel hücrelerini Excel'de göründüğü gibi, Türkçe düzende metne çevirir (Worker ve testler kullanır).
 * - Tarih: gg.aa.yyyy, saat varsa "gg.aa.yyyy ss:dd" (biçimde saniye varsa ss:dd:sn).
 * - Sayı: biçim kodundaki ondalık basamak, binlik ayraç, para birimi ve metinler korunur; ayraçlar Türkçe
 *   (40.000,00 TL gibi). "Genel" biçimdeki tam sayılar gruplanmaz (dosya no, telefon, yıl bozulmasın).
 * SheetJS 0.18.5'in kendi biçimlendiricisi "dd.mm.yyyy" gibi biçimlerde seri sayı döndürüp sayıları ABD
 * düzeninde (40,000.00) yazdığı için kullanılmaz. */
const pad = value => String(value).padStart(2, "0");

// Biçim kodunu parçalara ayırır: metin (tırnaklı, kaçışlı, para birimi), sayı yer tutucuları, yüzde.
function tokenize(section) {
  const out = [];
  for (let index = 0; index < section.length; ) {
    const char = section[index];
    if (char === '"') {
      const end = section.indexOf('"', index + 1);
      out.push({ type: "text", text: section.slice(index + 1, end < 0 ? undefined : end) });
      index = end < 0 ? section.length : end + 1;
    } else if (char === "[") {
      const end = section.indexOf("]", index);
      const currency = /^\$([^-]*)/.exec(section.slice(index + 1, end < 0 ? undefined : end));
      if (currency) out.push({ type: "text", text: currency[1] });
      index = end < 0 ? section.length : end + 1;
    } else if (char === "\\") {
      out.push({ type: "text", text: section[index + 1] || "" });
      index += 2;
    } else if (char === "_" || char === "*") {
      index += 2; // hizalama boşluğu / doldurma karakteri
    } else if ("#0?,.".includes(char)) {
      let end = index;
      while (end < section.length && "#0?,.".includes(section[end])) end += 1;
      out.push({ type: "number", text: section.slice(index, end) });
      index = end;
    } else if (char === "%") {
      out.push({ type: "percent" });
      index += 1;
    } else {
      out.push({ type: "text", text: char });
      index += 1;
    }
  }
  return out;
}

export function formatNumber(value, format) {
  const sections = String(format || "General").split(";");
  const negativeSection = value < 0 && sections.length > 1 && sections[1].trim() !== "";
  const section = negativeSection ? sections[1] : sections[0];
  const plainGeneral = !section.trim() || /^general$/i.test(section.trim());
  if (plainGeneral || /@|E[+-]|\//i.test(section.replace(/"[^"]*"/g, ""))) {
    return Number.isInteger(value) ? String(value) : String(value).replace(".", ",");
  }
  const parts = tokenize(section);
  const first = parts.findIndex(part => part.type === "number");
  if (first < 0) return String(value);
  let last = first;
  parts.forEach((part, index) => {
    if (part.type === "number") last = index;
  });
  const pattern = parts.slice(first, last + 1).filter(part => part.type === "number").map(part => part.text).join("");
  const [integer, fraction = ""] = pattern.split(".");
  const percent = parts.some(part => part.type === "percent");
  const body = new Intl.NumberFormat("tr-TR", {
    minimumIntegerDigits: Math.min(21, Math.max(1, (integer.match(/0/g) || []).length)),
    minimumFractionDigits: (fraction.match(/0/g) || []).length,
    maximumFractionDigits: fraction.replace(/[^0#?]/g, "").length,
    useGrouping: integer.includes(","),
  }).format(Math.abs(value) * (percent ? 100 : 1));
  const text = list => list.map(part => (part.type === "percent" ? "%" : part.type === "text" ? part.text : "")).join("");
  const prefix = text(parts.slice(0, first));
  const suffix = text(parts.slice(last + 1));
  return `${value < 0 && !negativeSection ? "-" : ""}${prefix}${body}${suffix}`.trim();
}

export function formatDate(parts, format) {
  const plain = String(format || "").replace(/"[^"]*"/g, "").replace(/\[[^\]]*\]/g, "").toLowerCase();
  const hasTimeToken = /[hs]/.test(plain);
  const hasDate = /[dy]/.test(plain) || (/m/.test(plain) && !hasTimeToken) || !plain;
  const hasTime = hasTimeToken || (hasDate && parts.H + parts.M + parts.S > 0);
  const date = `${pad(parts.d)}.${pad(parts.m)}.${parts.y}`;
  const time = `${pad(parts.H)}:${pad(parts.M)}${/s/.test(plain) ? `:${pad(parts.S)}` : ""}`;
  if (hasDate && hasTime) return `${date} ${time}`;
  return hasTime ? time : date;
}

// SheetJS hücresi → metin. XLSX: SheetJS modülü (SSF.is_date, SSF.parse_date_code için).
export function cellText(XLSX, cell, date1904 = false) {
  if (!cell || cell.v == null) return "";
  if (cell.t === "s" || cell.t === "str") return String(cell.v).trim();
  if (cell.t === "b") return cell.v ? "DOĞRU" : "YANLIŞ";
  if (cell.t === "e") return String(cell.w || "").trim();
  if (cell.t === "d") {
    const date = new Date(cell.v);
    return Number.isNaN(date.getTime()) ? String(cell.v) : `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
  }
  if (cell.t === "n") {
    try {
      if (cell.z && XLSX.SSF.is_date(cell.z)) {
        const parts = XLSX.SSF.parse_date_code(cell.v, { date1904 });
        if (parts) return formatDate(parts, cell.z);
      }
      return formatNumber(cell.v, cell.z);
    } catch {
      return String(cell.w ?? cell.v).trim();
    }
  }
  return String(cell.w ?? cell.v).trim();
}

export function sheetMatrix(XLSX, sheet, date1904 = false) {
  if (!sheet || !sheet["!ref"]) return [];
  const range = XLSX.utils.decode_range(sheet["!ref"]);
  const rows = [];
  for (let r = range.s.r; r <= range.e.r; r += 1) {
    const cells = [];
    for (let c = range.s.c; c <= range.e.c; c += 1) cells.push(cellText(XLSX, sheet[XLSX.utils.encode_cell({ r, c })], date1904));
    while (cells.length && !cells[cells.length - 1]) cells.pop();
    if (cells.length) rows.push(cells);
  }
  return rows;
}

// CSV baytlarını metne çevirir: önce UTF-8 (BOM'lu/BOM'suz), olmazsa Türkçe Windows kodlaması (Excel'in TR CSV'si).
export function decodeCsv(buffer) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer).replace(/^\uFEFF/, "");
  } catch {
    return new TextDecoder("windows-1254").decode(buffer);
  }
}
