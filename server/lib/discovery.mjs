// Yerel ağda sunucu keşfi (UDP).
// İstemci "HukukOfisiServerNerede" sinyalini yayınlar; sunucu kendi IP'si ve portuyla JSON yanıt verir.
// Güvenlik: yalnızca tam sinyal kabul edilir, paket boyutu sınırlıdır, gönderici başına yanıt hızı sınırlanır.
import dgram from "node:dgram";
import os from "node:os";

export const DISCOVERY_REQUEST = "HukukOfisiServerNerede";
export const DISCOVERY_REPLY_MAGIC = "HukukOfisiServerBurada";
export const DISCOVERY_PORT = 5123;

const ipToInt = ip => ip.split(".").reduce((value, part) => (value << 8) + Number(part), 0) >>> 0;

export function localIPv4Addresses() {
  const result = [];
  for (const [name, entries] of Object.entries(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family !== "IPv4" && entry.family !== 4) continue;
      if (entry.internal) continue;
      result.push({ name, address: entry.address, netmask: entry.netmask });
    }
  }
  return result;
}

// İsteği gönderen bilgisayarla aynı alt ağdaki yerel adresi seçer (VPN/sanal kartlar yanlış IP vermesin).
export function pickAddressFor(remoteAddress, addresses = localIPv4Addresses()) {
  const remote = String(remoteAddress || "").replace(/^::ffff:/, "");
  if (/^\d+\.\d+\.\d+\.\d+$/.test(remote)) {
    const target = ipToInt(remote);
    for (const item of addresses) {
      const mask = ipToInt(item.netmask || "255.255.255.0");
      if ((ipToInt(item.address) & mask) === (target & mask)) return item.address;
    }
    if (remote.startsWith("127.")) return "127.0.0.1";
  }
  return addresses[0]?.address || "127.0.0.1";
}

export function startDiscoveryResponder({ port = DISCOVERY_PORT, httpPort = 5123, getInfo = () => ({}), log, host = "0.0.0.0", maxPerSecond = 5 } = {}) {
  const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
  const buckets = new Map();
  let answered = 0;

  const allowed = address => {
    const second = Math.floor(Date.now() / 1000);
    const bucket = buckets.get(address);
    if (!bucket || bucket.second !== second) {
      buckets.set(address, { second, count: 1 });
      if (buckets.size > 1000) buckets.clear();
      return true;
    }
    bucket.count += 1;
    return bucket.count <= maxPerSecond;
  };

  socket.on("message", (message, remote) => {
    if (message.length > 512) return;
    const text = message.toString("utf8").trim();
    if (text !== DISCOVERY_REQUEST && !text.startsWith(`${DISCOVERY_REQUEST} `)) return;
    if (!allowed(remote.address)) return;
    const address = pickAddressFor(remote.address);
    const info = getInfo() || {};
    const payload = Buffer.from(
      JSON.stringify({
        magic: DISCOVERY_REPLY_MAGIC,
        service: "DestekOfis",
        v: 1,
        address,
        port: httpPort,
        url: `http://${address}:${httpPort}`,
        host: os.hostname(),
        name: info.officeName || "",
        instanceId: info.instanceId || "",
        version: info.version || "",
        state: info.state || "ready",
      }),
    );
    answered += 1;
    socket.send(payload, remote.port, remote.address, error => {
      if (error) log?.warn(`Keşif yanıtı gönderilemedi: ${error.message}`);
    });
  });
  socket.on("error", error => log?.error(`UDP keşif hatası: ${error.message}`));

  const ready = new Promise((resolve, reject) => {
    socket.once("error", reject);
    socket.bind(port, host, () => {
      socket.off("error", reject);
      try {
        socket.setBroadcast(true);
      } catch {
        // Yanıtlar tekil (unicast) gönderildiği için yayın izni zorunlu değil.
      }
      resolve(socket.address());
    });
  });
  return {
    ready,
    stats: () => ({ answered }),
    close: () => new Promise(resolve => socket.close(() => resolve())),
  };
}

// Test ve tanılama için istemci tarafı: sinyal gönderir, gelen yanıtları toplar.
export function discover({ port = DISCOVERY_PORT, timeoutMs = 1500, targets = ["255.255.255.255"] } = {}) {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket("udp4");
    const found = new Map();
    socket.on("message", (message, remote) => {
      try {
        const reply = JSON.parse(message.toString("utf8"));
        if (reply.magic !== DISCOVERY_REPLY_MAGIC) return;
        const key = reply.instanceId || `${remote.address}:${reply.port}`;
        if (!found.has(key)) found.set(key, { ...reply, from: remote.address });
      } catch {
        // Tanınmayan paketler yok sayılır.
      }
    });
    socket.on("error", reject);
    socket.bind(0, () => {
      socket.setBroadcast(true);
      const payload = Buffer.from(DISCOVERY_REQUEST);
      const send = () => targets.forEach(target => socket.send(payload, port, target));
      send();
      const again = setTimeout(send, Math.min(500, timeoutMs / 2));
      setTimeout(() => {
        clearTimeout(again);
        socket.close();
        resolve([...found.values()]);
      }, timeoutMs);
    });
  });
}
