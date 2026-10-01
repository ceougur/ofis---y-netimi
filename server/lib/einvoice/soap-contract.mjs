// SOAP sözleşme okuyucu (v2.0.15). Entegratörün kendi sunucusundaki WSDL'i (WCF: ?singleWsdl) okur ve isteği o
// sözleşmeye göre biçimler: işlem adı → SOAPAction, istek kök öğesinin ad alanı, SOAP sürümü (1.1 / 1.2), çocuk
// öğelerin sırası (xs:sequence) ve nitelikli/niteliksiz olması (elementFormDefault). Böylece program, entegratörün
// belgesindeki örneği ezberlemek yerine sunucunun o gün yayımladığı sözleşmeye uyar; sözleşmede olmayan bir alan
// gönderilmez ve raporlanır. WSDL alınamazsa çağıran varsayılan sözleşmeyle çalışır.
import { child, children, deepAll, escapeXml, parseXml, resolveQName } from "./xml-lite.mjs";

const XSD = "http://www.w3.org/2001/XMLSchema";
const WSDL_SOAP11 = "http://schemas.xmlsoap.org/wsdl/soap/";
const WSDL_SOAP12 = "http://schemas.xmlsoap.org/wsdl/soap12/";
export const SOAP11_ENV = "http://schemas.xmlsoap.org/soap/envelope/";
export const SOAP12_ENV = "http://www.w3.org/2003/05/soap-envelope";
const key = (ns, name) => `${ns}|${name}`;

/**
 * @returns {{ targetNamespace: string, version: "1.1"|"1.2", addressing: boolean, location: string,
 *   operations: Record<string, { action: string, input: { ns: string, name: string } | null }>,
 *   elements: Map, types: Map }}
 */
export function readWsdl(text) {
  const root = parseXml(text);
  const defs = root.children.find(node => node.name === "definitions");
  if (!defs) throw new Error("Yanıt bir WSDL belgesi değil.");
  const elements = new Map();
  const types = new Map();
  for (const schema of deepAll(defs, "schema").filter(node => node.ns === XSD)) {
    const target = schema.attrs.targetNamespace || "";
    const info = { target, qualified: schema.attrs.elementFormDefault === "qualified" };
    for (const item of schema.children) {
      if (item.ns !== XSD || !item.attrs.name) continue;
      if (item.name === "element") elements.set(key(target, item.attrs.name), { node: item, ...info });
      else if (item.name === "complexType") types.set(key(target, item.attrs.name), { node: item, ...info });
    }
  }
  const messages = new Map();
  for (const message of children(defs, "message")) {
    const part = children(message, "part")[0];
    messages.set(message.attrs.name, part?.attrs.element ? resolveQName(part, part.attrs.element) : null);
  }
  const inputs = new Map();
  for (const portType of children(defs, "portType")) {
    for (const operation of children(portType, "operation")) {
      const input = child(operation, "input");
      inputs.set(key(portType.attrs.name, operation.attrs.name), input?.attrs.message ? messages.get(resolveQName(input, input.attrs.message).name) || null : null);
    }
  }
  const bindings = children(defs, "binding")
    .map(binding => {
      const soap = binding.children.find(node => node.name === "binding" && (node.ns === WSDL_SOAP11 || node.ns === WSDL_SOAP12));
      if (!soap) return null;
      const portType = resolveQName(binding, binding.attrs.type).name;
      const operations = {};
      for (const operation of children(binding, "operation")) {
        const soapOp = operation.children.find(node => node.name === "operation" && (node.ns === WSDL_SOAP11 || node.ns === WSDL_SOAP12));
        operations[operation.attrs.name] = { action: soapOp?.attrs.soapAction ?? "", input: inputs.get(key(portType, operation.attrs.name)) || null };
      }
      return { name: binding.attrs.name, version: soap.ns === WSDL_SOAP12 ? "1.2" : "1.1", operations };
    })
    .filter(Boolean);
  if (!bindings.length) throw new Error("WSDL'de SOAP bağlaması bulunamadı.");
  // SOAP 1.1 (WCF basicHttpBinding) öncelikli: WS-Addressing başlığı istemez.
  const chosen = bindings.find(binding => binding.version === "1.1") || bindings[0];
  let location = "";
  for (const service of children(defs, "service")) {
    for (const port of children(service, "port")) {
      if (resolveQName(port, port.attrs.binding).name !== chosen.name) continue;
      location = port.children.find(node => node.name === "address")?.attrs.location || location;
    }
  }
  return {
    targetNamespace: defs.attrs.targetNamespace || "",
    version: chosen.version,
    addressing: chosen.version === "1.2" && /UsingAddressing|Addressing\b/.test(text),
    location,
    operations: chosen.operations,
    elements,
    types,
  };
}

// ---------- Şema: bir öğenin çocukları (sıra, ad alanı, tür) ----------
function particles(contract, node, info, out = [], depth = 0) {
  if (depth > 40) return out;
  for (const item of node.children || []) {
    if (item.ns !== XSD) continue;
    if (item.name === "sequence" || item.name === "choice" || item.name === "all") particles(contract, item, info, out, depth + 1);
    else if (item.name === "element") {
      if (item.attrs.ref) {
        const ref = resolveQName(item, item.attrs.ref);
        const global = contract.elements.get(key(ref.ns, ref.name));
        out.push({ name: ref.name, ns: ref.ns, decl: global ? { node: global.node, info: global } : null });
      } else {
        const qualified = item.attrs.form ? item.attrs.form === "qualified" : info.qualified;
        out.push({ name: item.attrs.name, ns: qualified ? info.target : "", decl: { node: item, info } });
      }
    } else if (item.name === "complexContent" || item.name === "simpleContent") {
      const ext = item.children.find(sub => sub.ns === XSD && (sub.name === "extension" || sub.name === "restriction"));
      if (!ext) continue;
      if (ext.name === "extension" && ext.attrs.base) {
        const base = resolveQName(ext, ext.attrs.base);
        const type = contract.types.get(key(base.ns, base.name));
        if (type) particles(contract, type.node, type, out, depth + 1);
      }
      particles(contract, ext, info, out, depth + 1);
    } else if (item.name === "group" && item.attrs.ref) continue;
  }
  return out;
}
/** Bir öğe bildiriminin (xs:element) karmaşık türünü bulur → çocuk listesi. */
function childList(contract, decl) {
  if (!decl) return null;
  const { node, info } = decl;
  const inline = node.children.find(item => item.ns === XSD && item.name === "complexType");
  if (inline) return particles(contract, inline, info);
  if (!node.attrs.type) return null;
  const type = resolveQName(node, node.attrs.type);
  if (type.ns === XSD) return null;
  const named = contract.types.get(key(type.ns, type.name));
  return named ? particles(contract, named.node, named) : null;
}
export function rootDecl(contract, operation) {
  const input = contract?.operations?.[operation]?.input;
  if (!input) return null;
  const global = contract.elements.get(key(input.ns, input.name));
  return global ? { name: input.name, ns: input.ns, decl: { node: global.node, info: global } } : { name: input.name, ns: input.ns, decl: null };
}
/** Sözleşmedeki alan adları (rapor ve "bu alan var mı" sorusu için): ["REQUEST_HEADER", "SENDER", "INVOICE/HEADER/EARCHIVE", …] */
export function fieldPaths(contract, operation, limit = 400) {
  const root = rootDecl(contract, operation);
  const out = [];
  const walk = (decl, prefix, depth) => {
    if (depth > 6 || out.length > limit) return;
    for (const item of childList(contract, decl) || []) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      out.push(path);
      walk(item.decl, path, depth + 1);
    }
  };
  if (root?.decl) walk(root.decl, "", 0);
  return out;
}

// ---------- İstek ağacı ----------
// E("INVOICE", [E("CONTENT", base64)], { UUID }) — boş metinli ve boş çocuklu öğe atlanır (opsiyonel alanlar).
// optional: true → sözleşmede yoksa ya da sözleşme alınamadıysa sessizce düşer (yalnız sözleşme izin verirse gider).
export const E = (name, content, attrs = {}, { optional = false } = {}) => ({ name, attrs, optional, children: Array.isArray(content) ? content.filter(Boolean) : null, text: Array.isArray(content) ? "" : content === undefined || content === null ? "" : String(content) });
const isEmpty = node => !node.children?.length && node.text === "" && !Object.values(node.attrs).some(value => value !== undefined && value !== null && value !== "");

/**
 * Ağacı sözleşmeye uydurur: sıra, ad alanı, bilinmeyen alanlar. Sözleşme yoksa: kök defaultNs'te, çocuklar niteliksiz,
 * opsiyonel alanlar düşer.
 * @returns {{ tree, warnings: string[] }}
 */
export function shape(contract, operation, tree, { defaultNs }) {
  const warnings = [];
  const root = contract ? rootDecl(contract, operation) : null;
  const clean = node => ({ ...node, attrs: Object.fromEntries(Object.entries(node.attrs).filter(([, value]) => value !== undefined && value !== null && value !== "")) });
  const fallback = (node, ns) => {
    const out = { ...clean(node), ns, children: node.children ? node.children.filter(item => !item.optional && !isEmpty(item)).map(item => fallback(item, "")) : null };
    return out;
  };
  if (!root?.decl) return { tree: fallback(tree, root?.ns || defaultNs), warnings, contracted: false };
  const walk = (node, ns, decl, path) => {
    const out = { ...clean(node), ns, children: null };
    if (!node.children) return out;
    const list = childList(contract, decl);
    const kids = node.children.filter(item => !isEmpty(item));
    if (!list) {
      out.children = kids.filter(item => !item.optional).map(item => walk(item, "", null, `${path}/${item.name}`));
      return out;
    }
    const placed = [];
    for (const item of kids) {
      const index = list.findIndex(entry => entry.name === item.name);
      if (index < 0) {
        if (!item.optional) warnings.push(`${path}/${item.name}`);
        continue;
      }
      const walked = walk(item, list[index].ns, list[index].decl, `${path}/${item.name}`);
      // Opsiyonel kap öğe, içindeki opsiyonel alanların hepsi düştüyse boş gönderilmez.
      if (item.optional && walked.children && !walked.children.length && !Object.keys(walked.attrs).length) continue;
      placed.push({ index, order: placed.length, node: walked });
    }
    out.children = placed.sort((a, b) => a.index - b.index || a.order - b.order).map(entry => entry.node);
    return out;
  };
  return { tree: walk(tree, root.ns, root.decl, root.name), warnings, contracted: true };
}

/** Biçimlenmiş ağacı XML'e çevirir; her ad alanı kökte bir önekle bildirilir, niteliksiz öğe öneksiz yazılır. */
export function renderTree(tree) {
  const prefixes = new Map();
  const collect = node => {
    if (node.ns && !prefixes.has(node.ns)) prefixes.set(node.ns, `n${prefixes.size + 1}`);
    for (const item of node.children || []) collect(item);
  };
  collect(tree);
  const write = (node, isRoot) => {
    const name = node.ns ? `${prefixes.get(node.ns)}:${node.name}` : node.name;
    const declare = isRoot ? [...prefixes].map(([ns, prefix]) => ` xmlns:${prefix}="${escapeXml(ns)}"`).join("") : "";
    const attrs = Object.entries(node.attrs).map(([attr, value]) => ` ${attr}="${escapeXml(value)}"`).join("");
    const inner = node.children ? node.children.map(item => write(item, false)).join("") : escapeXml(node.text);
    return inner === "" ? `<${name}${declare}${attrs}/>` : `<${name}${declare}${attrs}>${inner}</${name}>`;
  };
  return write(tree, true);
}

/** SOAP zarfı + HTTP başlıkları. SOAP 1.2'de eylem içerik türündedir; WS-Addressing isteyen bağlamada başlığa yazılır. */
export function soapRequest({ version = "1.1", action = "", body, addressing = false, to = "" }) {
  if (version === "1.2") {
    const head = addressing ? `<s:Header><a:Action s:mustUnderstand="1">${escapeXml(action)}</a:Action><a:To s:mustUnderstand="1">${escapeXml(to)}</a:To></s:Header>` : "";
    return {
      xml: `<?xml version="1.0" encoding="UTF-8"?><s:Envelope xmlns:s="${SOAP12_ENV}"${addressing ? ' xmlns:a="http://www.w3.org/2005/08/addressing"' : ""}>${head}<s:Body>${body}</s:Body></s:Envelope>`,
      headers: { "content-type": `application/soap+xml; charset=utf-8; action="${action}"` },
    };
  }
  return {
    xml: `<?xml version="1.0" encoding="UTF-8"?><s:Envelope xmlns:s="${SOAP11_ENV}"><s:Body>${body}</s:Body></s:Envelope>`,
    headers: { "content-type": "text/xml; charset=utf-8", SOAPAction: `"${action}"` },
  };
}
