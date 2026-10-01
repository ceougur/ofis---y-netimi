// Vergi kimlik doğrulaması (v2.0.15) — e-Fatura / e-Arşiv için alıcı ve satıcı kimliği.
//   VKN   : 10 hane, Gelir İdaresi'nin denetim algoritması (tüzel kişi ve şahıs şirketi).
//   TCKN  : 11 hane, ilk hane 0 olamaz; 10. ve 11. haneler denetim hanesi (gerçek kişi).
//   MERSİS: 16 hane (Merkezî Sicil Kayıt Sistemi numarası; tüzel kişide faturada yazılır).
// GİB, e-Arşiv'de kimliği bilinmeyen nihai tüketici için 11111111111 kullanılmasına izin verir.
export const ANONYMOUS_TCKN = "11111111111";
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
export function partyProblems(party, { profile = "KAGIT", role = "buyer" } = {}) {
  const who = role === "seller" ? "Firma bilgisi (satıcı)" : "Cari (alıcı)";
  const problems = [];
  const id = classifyTaxId(party.taxNo, { allowAnonymous: role === "buyer" && profile === "EARSIV" });
  if (party.taxNo && !id.ok) problems.push(`${who}: vergi kimlik numarası geçersiz (${id.value.length === 10 ? "VKN denetim hanesi tutmuyor" : id.value.length === 11 ? "TCKN denetim hanesi tutmuyor" : "VKN 10, TCKN 11 hane olmalı"}).`);
  if (party.partyKind === "company" && party.taxNo && id.kind === "tckn" && id.value !== ANONYMOUS_TCKN) problems.push(`${who}: tüzel kişide vergi kimlik numarası (VKN, 10 hane) yazılır.`);
  if (party.partyKind === "person" && party.taxNo && id.kind === "vkn") problems.push(`${who}: gerçek kişide TC kimlik numarası (TCKN, 11 hane) yazılır.`);
  if (party.mersisNo && !isValidMersis(party.mersisNo)) problems.push(`${who}: MERSİS numarası 16 haneli olmalı.`);
  if (profile === "KAGIT") return problems;
  if (!party.taxNo) problems.push(`${who}: e-${profile === "EFATURA" ? "Fatura" : "Arşiv"} için VKN ya da TCKN zorunludur${role === "buyer" && profile === "EARSIV" ? " (kimliği bilinmeyen nihai tüketicide 11111111111)" : ""}.`);
  if (!String(party.name || "").trim()) problems.push(`${who}: unvan / ad soyad zorunludur.`);
  if (!String(party.city || "").trim()) problems.push(`${who}: il zorunludur (adres).`);
  if (role === "seller" && !String(party.taxOffice || "").trim()) problems.push(`${who}: vergi dairesi zorunludur.`);
  if (role === "buyer" && profile === "EFATURA" && id.kind === "vkn" && !String(party.taxOffice || "").trim()) problems.push(`${who}: e-Fatura'da tüzel alıcının vergi dairesi zorunludur.`);
  return problems;
}
