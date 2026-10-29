// 2.4.7 M2 test yardımcısı: uzaktan erişim dinleyicisine (app.listenRemote) giden "telefon". Ham yol gönderir (node:http; fetch "../" ve "%2e%2e"yi
// normalleştirip sınamayı boşa çıkarırdı), çerezleri (hof_device, hof_mobil) kendisi tutar, cihaz anahtarını Node WebCrypto eşdeğeriyle (ECDSA P-256) üretir
// ve girişte meydan okumayı imzalar. Eski kodda (listenRemote yok) ana dinleyiciye bağlanır: tünelin doğrudan programın portuna bağlandığı saf düzen —
// kırmızı kanıt (ders 7/38) bu düzende "uzak istek yerel sayıldı / yasak yol açık" iletisini verir.
import { generateKeyPairSync, sign } from "node:crypto";
import http from "node:http";

const PROOF = (deviceId, nonce) => `DestekOfis-mobil-giris\n${deviceId}\n${nonce}`;

/** Uzak taban adres: yeni kodda ayrı uzak dinleyici; eski kodda ana dinleyici (saf tünel). */
export async function remoteBase(server) {
  if (typeof server.app.listenRemote !== "function") return { base: server.base, legacy: true };
  const address = await server.app.listenRemote(0, "127.0.0.1");
  return { base: `http://127.0.0.1:${address.port}`, legacy: false };
}

export function rawRequest(base, method, path, { headers = {}, body } = {}) {
  const url = new URL(base);
  const payload = body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = http.request({ host: url.hostname, port: url.port, method, path, headers: { ...(payload !== undefined ? { "content-type": "application/json", "content-length": Buffer.byteLength(payload) } : {}), ...headers } }, res => {
      const chunks = [];
      res.on("data", chunk => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        let data = null;
        try {
          data = JSON.parse(text);
        } catch {
          data = null;
        }
        resolve({ status: res.statusCode, headers: res.headers, text, data, code: data?.code || data?.error?.code || "" });
      });
    });
    req.on("error", reject);
    if (payload !== undefined) req.write(payload);
    req.end();
  });
}

/** Bir telefon/tablet/uzak tarayıcı: anahtar çifti + çerez kavanozu. */
export function createPhone(base, { name = "Test Telefonu", kind = "telefon" } = {}) {
  const keys = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const jar = new Map();
  const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  const absorb = headers => {
    for (const line of [].concat(headers["set-cookie"] || [])) {
      const [pair] = line.split(";");
      const index = pair.indexOf("=");
      const key = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      if (value) jar.set(key, value);
      else jar.delete(key);
    }
  };
  const phone = {
    base,
    name,
    kind,
    jar,
    deviceId: "",
    async request(method, path, { body, headers = {} } = {}) {
      const cookie = cookieHeader();
      const response = await rawRequest(phone.base, method, path, { body, headers: { ...(cookie ? { cookie } : {}), ...headers } });
      absorb(response.headers);
      return response;
    },
    get: (path, options) => phone.request("GET", path, options),
    post: (path, body, options = {}) => phone.request("POST", path, { ...options, body }),
    publicJwk() {
      const jwk = keys.publicKey.export({ format: "jwk" });
      return { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y };
    },
    async pair(code) {
      const response = await phone.post("/api/mobil/eslesme", { kod: code, ad: name, tur: kind, anahtar: phone.publicJwk() });
      if (response.status === 200) phone.deviceId = response.data.data.device.id;
      return response;
    },
    async login(username, password, { proof = true, headers = {} } = {}) {
      let extra = {};
      if (proof) {
        const challenge = await phone.get("/api/mobil/session/challenge", { headers });
        if (challenge.status !== 200) return challenge;
        const { nonce, device } = challenge.data.data;
        extra = { nonce, signature: sign("sha256", Buffer.from(PROOF(device, nonce)), { key: keys.privateKey, dsaEncoding: "ieee-p1363" }).toString("base64url") };
      }
      return phone.post("/api/mobil/session/login", { username, password, ...extra }, { headers });
    },
    sign: (deviceId, nonce) => sign("sha256", Buffer.from(PROOF(deviceId, nonce)), { key: keys.privateKey, dsaEncoding: "ieee-p1363" }).toString("base64url"),
    forget: name2 => jar.delete(name2),
  };
  return phone;
}
