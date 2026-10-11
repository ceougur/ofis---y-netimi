// Küçük, bağımlılıksız XML okuyucu (v2.0.15): SOAP yanıtları ve gelen UBL-TR faturaları için. Ad alanı önekleri atılır
// (yerel adla erişilir), öznitelikler ve metin korunur. DOCTYPE/varlık tanımı kabul edilmez (XXE yok); CDATA ve
// yorumlar desteklenir. Büyük belgede de doğrusal çalışır.
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = text =>
  String(text).replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_, code) => {
    if (code[0] !== "#") return ENTITIES[code];
    const value = code[1] === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return Number.isFinite(value) ? String.fromCodePoint(value) : "";
  });
const local = name => {
  const at = name.indexOf(":");
  return at >= 0 ? name.slice(at + 1) : name;
};

const prefixOf = name => {
  const at = name.indexOf(":");
  return at >= 0 ? name.slice(0, at) : "";
};

// Her düğüm: name (yerel ad), prefix, ns (çözülmüş ad alanı URI'si), nsmap (kapsamdaki önek → URI; WSDL/XSD'deki
// "tns:LoginRequest" gibi nitelikli adları çözmek için), attrs (xmlns bildirimleri hariç), children, text.
export function parseXml(xml) {
  const source = String(xml ?? "");
  if (/<!DOCTYPE/i.test(source)) throw new Error("XML belgesinde DOCTYPE kabul edilmez.");
  const root = { name: "#root", prefix: "", ns: "", nsmap: { xml: "http://www.w3.org/XML/1998/namespace" }, attrs: {}, children: [], text: "" };
  const stack = [root];
  const pattern = /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<\?[\s\S]*?\?>|<\/([^\s>]+)\s*>|<([^\s/>]+)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  let match;
  while ((match = pattern.exec(source))) {
    const top = stack[stack.length - 1];
    if (match[1] !== undefined) top.text += match[1];
    else if (match[2]) {
      if (stack.length > 1) stack.pop();
    } else if (match[3]) {
      const node = { name: local(match[3]), prefix: prefixOf(match[3]), ns: "", nsmap: top.nsmap, attrs: {}, children: [], text: "" };
      let scoped = null;
      for (const attr of match[4].matchAll(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
        const value = decode(attr[2] ?? attr[3] ?? "");
        if (attr[1] === "xmlns" || attr[1].startsWith("xmlns:")) {
          scoped ||= { ...top.nsmap };
          scoped[attr[1] === "xmlns" ? "" : attr[1].slice(6)] = value;
        } else node.attrs[local(attr[1])] = value;
      }
      if (scoped) node.nsmap = scoped;
      node.ns = node.nsmap[node.prefix] || "";
      top.children.push(node);
      if (!match[5]) stack.push(node);
    } else if (match[6] !== undefined) top.text += decode(match[6]);
  }
  return root;
}

/** Nitelikli adı ("tns:LoginRequest") düğümün kapsamındaki ad alanıyla çözer → { ns, name }. */
export function resolveQName(node, qname) {
  const value = String(qname || "");
  const at = value.indexOf(":");
  const prefix = at >= 0 ? value.slice(0, at) : "";
  return { ns: node?.nsmap?.[prefix] || "", name: at >= 0 ? value.slice(at + 1) : value };
}

/** Yoldaki ilk düğüm: find(node, "Body/LoginResponse/SESSION_ID"). Her adım herhangi bir derinlikte değil, doğrudan çocuk. */
export function child(node, name) {
  return node?.children?.find(item => item.name === name) || null;
}
export function children(node, name) {
  return (node?.children || []).filter(item => item.name === name);
}
export function find(node, path) {
  let current = node;
  for (const part of path.split("/").filter(Boolean)) {
    current = child(current, part);
    if (!current) return null;
  }
  return current;
}
/** Ağacın herhangi bir yerindeki ilk düğüm (derinlik öncelikli). */
export function deep(node, name) {
  if (!node) return null;
  for (const item of node.children || []) {
    if (item.name === name) return item;
    const found = deep(item, name);
    if (found) return found;
  }
  return null;
}
export function deepAll(node, name, out = []) {
  for (const item of node?.children || []) {
    if (item.name === name) out.push(item);
    deepAll(item, name, out);
  }
  return out;
}
export const textOf = node => String(node?.text ?? "").trim();
export const escapeXml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]);
