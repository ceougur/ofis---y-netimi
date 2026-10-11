// Ofisin kendi oluşturduğu sektörler (v2.0.2). Aranan sektör listede yoksa yönetici kendi sektörünü tanımlar:
// adı, kayıtlara ne dendiği (tekil/çoğul), uzman rolü, kenar çubuğu alt başlığı, ek modüller (tahsilat, haciz) ve
// isteğe bağlı tanıtıcı kolon başlıkları. Yerleşik sektörlerle aynı biçimdedir (sectors.mjs → customSector):
// seçicide "Kendi sektörleriniz" grubunda görünür, seçilince arayüzün dili değişir, tanıtıcı başlıklar sonraki
// Excel/Sheets yüklemelerinde bu sektörün önerilmesini sağlar. Ofis genelidir (tüm veri oturumlarında seçilebilir).
import { HttpError, parseJson } from "./http.mjs";
import { SECTORS, customSector } from "./insight/sectors.mjs";
import { foldText } from "./insight/validators.mjs";

const KEY = "sectors.custom";
export const CUSTOM_LIMITS = Object.freeze({ count: 50, name: 60, word: 30, expert: 40, subtitle: 60, headers: 30, header: 60 });

const clean = (value, max) => String(value ?? "").replace(/[\u0000-\u001F\u007F<>]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const slug = text =>
  foldText(text)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "sektor";

// Türkçe çoğul: son ünlü kalın (a, ı, o, u) ise -lar, ince ise -ler. "öğrenci" → "öğrenciler", "tekne" → "tekneler".
export function pluralOf(word) {
  const text = clean(word, CUSTOM_LIMITS.word);
  if (!text) return "";
  const vowels = text.toLocaleLowerCase("tr-TR").match(/[aıoueiöü]/g);
  const last = vowels ? vowels[vowels.length - 1] : "e";
  return `${text}${"aıou".includes(last) ? "lar" : "ler"}`;
}

export function createCustomSectors({ store, audit }) {
  const read = () => {
    const list = parseJson(store.setting(KEY, ""), []);
    return Array.isArray(list) ? list.filter(item => item && typeof item.id === "string" && item.id.startsWith("ozel-")) : [];
  };
  const write = (list, user) => store.setSetting(KEY, JSON.stringify(list), user?.id);
  let cache = { raw: null, sectors: [] };
  const all = () => {
    const raw = store.setting(KEY, "") || "";
    if (cache.raw !== raw) cache = { raw, sectors: read().map(customSector) };
    return cache.sectors;
  };
  const get = id => all().find(sector => sector.id === String(id || "")) || null;

  function validate(input, { except = null } = {}) {
    const name = clean(input?.name, CUSTOM_LIMITS.name);
    if (name.length < 2) throw new HttpError(400, "Sektör adı en az 2 harf olmalı.");
    const taken = fold => [...SECTORS.map(sector => sector.name), ...read().filter(item => item.id !== except).map(item => item.name)].some(other => foldText(other) === fold);
    if (taken(foldText(name))) throw new HttpError(409, `“${name}” adında bir sektör zaten var. Listeden seçin ya da farklı bir ad yazın.`);
    const record = clean(input?.record, CUSTOM_LIMITS.word).toLocaleLowerCase("tr-TR");
    if (record.length < 2) throw new HttpError(400, "Kayıtlara ne dendiğini yazın (ör. öğrenci, hasta, tekne).");
    const records = clean(input?.records, CUSTOM_LIMITS.word).toLocaleLowerCase("tr-TR") || pluralOf(record);
    const expert = clean(input?.expert, CUSTOM_LIMITS.expert) || "Sorumlu";
    const subtitle = clean(input?.subtitle, CUSTOM_LIMITS.subtitle) || `${name} yönetimi`;
    const headers = [];
    const seen = new Set();
    for (const item of (Array.isArray(input?.headers) ? input.headers : String(input?.headers || "").split(/[\n,;]+/)).slice(0, CUSTOM_LIMITS.headers)) {
      const header = clean(item, CUSTOM_LIMITS.header);
      if (header.length < 2 || seen.has(foldText(header))) continue;
      seen.add(foldText(header));
      headers.push(header);
    }
    const modules = { tahsilat: input?.modules?.tahsilat !== false, haciz: input?.modules?.haciz === true };
    return { name, record, records, expert, subtitle, headers, modules };
  }

  function create(user, input) {
    const list = read();
    if (list.length >= CUSTOM_LIMITS.count) throw new HttpError(400, `En fazla ${CUSTOM_LIMITS.count} sektör oluşturulabilir. Kullanmadığınız bir sektörü silin.`);
    const value = validate(input);
    const base = `ozel-${slug(value.name)}`;
    let id = base;
    for (let n = 2; list.some(item => item.id === id); n += 1) id = `${base}-${n}`;
    const entry = { id, ...value, createdBy: user.id, createdByName: user.display_name, createdAt: new Date().toISOString() };
    write([...list, entry], user);
    audit?.(user, "profile.sector.custom.created", id, { name: value.name });
    return get(id);
  }

  function update(user, id, input) {
    const list = read();
    const index = list.findIndex(item => item.id === id);
    if (index < 0) throw new HttpError(404, "Sektör bulunamadı.");
    const value = validate(input, { except: id });
    list[index] = { ...list[index], ...value, updatedBy: user.id, updatedAt: new Date().toISOString() };
    write(list, user);
    audit?.(user, "profile.sector.custom.updated", id, { name: value.name });
    return get(id);
  }

  // Silinen sektörü kullanan oturumlar "Genel" görünüme döner (profile.mjs); veriye dokunulmaz.
  function remove(user, id) {
    const list = read();
    const entry = list.find(item => item.id === id);
    if (!entry) throw new HttpError(404, "Sektör bulunamadı.");
    write(list.filter(item => item.id !== id), user);
    audit?.(user, "profile.sector.custom.deleted", id, { name: entry.name });
    return { id };
  }

  // Seçici ve Ayarlar için: yerleşik listeyle aynı sade biçim + düzenleme için alanlar.
  const catalogGroup = () => {
    const list = read();
    if (!list.length) return null;
    return {
      id: "ozel",
      name: "Kendi sektörleriniz",
      custom: true,
      sectors: list.map(item => ({ id: item.id, name: item.name, record: item.records, expert: item.expert, keys: [item.name, ...(item.headers || [])], custom: true, fields: { name: item.name, record: item.record, records: item.records, expert: item.expert, subtitle: item.subtitle, headers: item.headers || [], modules: item.modules }, createdByName: item.createdByName || "" })),
    };
  };

  return { all, get, create, update, remove, catalogGroup };
}
