// Vergi kimlik doğrulaması (v2.0.15) — e-Fatura / e-Arşiv için alıcı ve satıcı kimliği.
//   VKN   : 10 hane, Gelir İdaresi'nin denetim algoritması (tüzel kişi ve şahıs şirketi).
//   TCKN  : 11 hane, ilk hane 0 olamaz; 10. ve 11. haneler denetim hanesi (gerçek kişi).
//   MERSİS: 16 hane (Merkezî Sicil Kayıt Sistemi numarası; tüzel kişide faturada yazılır).
// GİB, e-Arşiv'de kimliği bilinmeyen nihai tüketici için 11111111111 kullanılmasına izin verir.
export const ANONYMOUS_TCKN = "11111111111";
// 2.4.4 (31f U1): faturadaki "Nihai Tüketici" hızlı seçeneğinin carisi bu adı taşır. Adı belli bir kişinin carisi (11111111111 yazılmış olsa da)
// kimliği bilinmeyen alıcı yerine ASLA seçilmez; ad karşılaştırması büyük/küçük harf ve fazla boşluk gözetmez (istemcide hof-accounts.js aynı kural).
export const RETAIL_NAME = "Nihai Tüketici";
export const isRetailName = name => String(name ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR") === RETAIL_NAME.toLocaleLowerCase("tr-TR");
const digits = value => String(value ?? "").replace(/\s+/g, "");

export function isValidVkn(value) {
  const v = digits(value);
  if (!/^\d{10}$/.test(v)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    const tmp = (Number(v[i]) + 9 - i) % 10;
    let part = (tmp * 2 ** (9 - i)) % 9;
    if (tmp !== 0 && part === 0) part = 9;
    sum += part;
  }
  return (10 - (sum % 10)) % 10 === Number(v[9]);
}

export function isValidTckn(value, { allowAnonymous = false } = {}) {
  const v = digits(value);
  if (allowAnonymous && v === ANONYMOUS_TCKN) return true;
  if (!/^[1-9]\d{10}$/.test(v)) return false;
  const d = [...v].map(Number);
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  const tenth = (((odd * 7 - even) % 10) + 10) % 10;
  if (tenth !== d[9]) return false;
  return d.slice(0, 10).reduce((a, b) => a + b, 0) % 10 === d[10];
}

export const isValidMersis = value => /^\d{16}$/.test(digits(value));

/** Kimliğin türü ve geçerliliği: { kind: 'vkn' | 'tckn' | '', ok, value }. */
export function classifyTaxId(value, options = {}) {
  const v = digits(value);
  if (v.length === 10) return { kind: "vkn", ok: isValidVkn(v), value: v };
  if (v.length === 11) return { kind: "tckn", ok: isValidTckn(v, options), value: v };
  return { kind: "", ok: false, value: v };
}

/**
 * e-Belge için taraf denetimi. party: { name, taxNo, taxOffice, mersisNo, partyKind ('company' | 'person'), city, district,
 * address, country }. profile: 'EFATURA' | 'EARSIV' | 'KAGIT'. role: 'buyer' | 'seller'. Dönüş: sorun listesi (boşsa geçerli).
 */
// e-Arşiv'de kimliği bilinmeyen nihai tüketiciye (11111111111) kesilebilecek en yüksek tutar (KDV dahil, 2026: 30.000 TL);
// üstünde alıcının gerçek TCKN'si, adı soyadı ve adresi zorunludur (GİB e-Arşiv uygulaması).
export const ANONYMOUS_LIMIT = 30_000;
// 2.4.4 (uzman UX9): her sorun hangi cari alanından doğduğunu da söyler (field: cari kartındaki alan adı) — fatura formu "Cariyi Düzenle" ile
// o alanları zorunlu işaretleyip ilkine odaklanır. Kural ve metinler TEK yerde (partyProblems = partyIssues'un metinleri; gönderim denetimi aynı).
export function partyIssues(party, { profile = "KAGIT", role = "buyer", payable = 0 } = {}) {
  const who = role === "seller" ? "Firma bilgisi (satıcı)" : "Cari (alıcı)";
  const issues = [];
  const add = (field, text) => issues.push({ field, text });
  const id = classifyTaxId(party.taxNo, { allowAnonymous: role === "buyer" && profile === "EARSIV" });
  if (party.taxNo && !id.ok) add("taxNo", `${who}: vergi kimlik numarası geçersiz (${id.value.length === 10 ? "VKN denetim hanesi tutmuyor" : id.value.length === 11 ? "TCKN denetim hanesi tutmuyor" : "VKN 10, TCKN 11 hane olmalı"}).`);
  if (party.partyKind === "company" && party.taxNo && id.kind === "tckn" && id.value !== ANONYMOUS_TCKN) add("taxNo", `${who}: tüzel kişide vergi kimlik numarası (VKN, 10 hane) yazılır.`);
  if (party.partyKind === "person" && party.taxNo && id.kind === "vkn") add("taxNo", `${who}: gerçek kişide TC kimlik numarası (TCKN, 11 hane) yazılır.`);
  if (party.mersisNo && !isValidMersis(party.mersisNo)) add("mersisNo", `${who}: MERSİS numarası 16 haneli olmalı.`);
  if (profile === "KAGIT") return issues;
  if (!party.taxNo) add("taxNo", `${who}: e-${profile === "EFATURA" ? "Fatura" : "Arşiv"} için VKN ya da TCKN zorunludur${role === "buyer" && profile === "EARSIV" ? " (kimliği bilinmeyen nihai tüketicide 11111111111)" : ""}.`);
  if (!String(party.name || "").trim()) add("name", `${who}: unvan / ad soyad zorunludur.`);
  if (!String(party.city || "").trim()) add("city", `${who}: il zorunludur (adres).`);
  if (role === "seller" && !String(party.taxOffice || "").trim()) add("taxOffice", `${who}: vergi dairesi zorunludur.`);
  if (role === "buyer" && profile === "EARSIV" && id.value === ANONYMOUS_TCKN && Number(payable) > ANONYMOUS_LIMIT) add("taxNo", `${who}: ${ANONYMOUS_LIMIT.toLocaleString("tr-TR")} TL üstü e-Arşiv faturada nihai tüketicinin gerçek TC kimlik numarası, adı soyadı ve adresi zorunludur (11111111111 yazılamaz).`);
  if (role === "buyer" && profile === "EARSIV" && id.value === ANONYMOUS_TCKN && Number(payable) > ANONYMOUS_LIMIT && !String(party.address || "").trim()) add("address", `${who}: adres zorunludur.`);
  if (role === "buyer" && profile === "EFATURA" && id.kind === "vkn" && !String(party.taxOffice || "").trim()) add("taxOffice", `${who}: e-Fatura'da tüzel alıcının vergi dairesi zorunludur.`);
  return issues;
}
export function partyProblems(party, options = {}) {
  return partyIssues(party, options).map(issue => issue.text);
}

// IBAN (ISO 13616): ülke kodu + 2 denetim hanesi + hesap; mod 97 = 1. Türkiye'de 26 karakter (TR + 24 hane).
export const normalizeIban = value => String(value ?? "").replace(/\s+/g, "").toUpperCase();
export function isValidIban(value) {
  const v = normalizeIban(value);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(v)) return false;
  if (v.startsWith("TR") && !/^TR\d{24}$/.test(v)) return false;
  const moved = `${v.slice(4)}${v.slice(0, 4)}`.replace(/[A-Z]/g, letter => String(letter.charCodeAt(0) - 55));
  let rest = 0;
  for (const digit of moved) rest = (rest * 10 + Number(digit)) % 97;
  return rest === 1;
}
export const ibanText = value => normalizeIban(value).replace(/(.{4})/g, "$1 ").trim();

// Gerçek kişinin adı ve soyadı (e-Belgede Person/FirstName, FamilyName): kartta ayrı yazılmadıysa tam addan çıkarılır —
// son sözcük soyadı, öncekiler ad ("Ayşe Nur Kaya" → "Ayşe Nur" + "Kaya").
export function splitPersonName(name) {
  const words = String(name ?? "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (words.length < 2) return { firstName: words[0] || "", familyName: "" };
  return { firstName: words.slice(0, -1).join(" "), familyName: words[words.length - 1] };
}
