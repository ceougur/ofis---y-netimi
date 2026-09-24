// Güncelleme testleri için yardımcılar: test anahtarı, sürüm klasörü üretimi, sahte GitHub Releases sunucusu.
import { generateKeyPairSync } from "node:crypto";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectAppFiles } from "../tools/lib/app-files.mjs";
import { buildUpdatePackage } from "../tools/lib/update-package.mjs";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function makeKeys(keyId = "test-1") {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicB64 = publicKey.export({ format: "der", type: "spki" }).toString("base64");
  return { keyId, privateKeyPem: privateKey.export({ format: "pem", type: "pkcs8" }), publicB64, trusted: { [keyId]: publicB64 } };
}

// Depodaki uygulamayı verilen sürüm numarasıyla bir klasöre kopyalar (app\<sürüm> gibi).
export function makeVersion(target, version, { serverSource, serverPrefix } = {}) {
  for (const file of collectAppFiles(root)) {
    mkdirSync(path.dirname(path.join(target, file.relative)), { recursive: true });
    cpSync(file.full, path.join(target, file.relative));
  }
  const pkg = JSON.parse(readFileSync(path.join(target, "package.json"), "utf8"));
  writeFileSync(path.join(target, "package.json"), `${JSON.stringify({ ...pkg, version }, null, 2)}\n`);
  writeFileSync(path.join(target, "CHANGELOG.md"), `# Değişiklik günlüğü\n\n## ${version} — Test sürümü\n\n- Otomatik güncelleme denemesi.\n`);
  const serverFile = path.join(target, "server", "server.mjs");
  if (serverSource) writeFileSync(serverFile, serverSource);
  if (serverPrefix) writeFileSync(serverFile, `${serverPrefix}\n${readFileSync(serverFile, "utf8")}`);
  return target;
}

export function buildRelease(versionDir, outDir, keys, options = {}) {
  return buildUpdatePackage({ root: versionDir, outDir, privateKeyPem: keys.privateKeyPem, keyId: keys.keyId, trustedKeys: keys.trusted, ...options });
}

// releases: [{ tag, prerelease?, draft?, files: { "<ad>": "<yerel dosya yolu>" | Buffer }, sizes?: { "<ad>": sayı } }]
export async function startMockGithub(initial = [], { packageDelayMs = 0 } = {}) {
  let releases = initial;
  const hits = { list: 0, downloads: [] };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/repos/test/repo/releases") {
      hits.list += 1;
      const base = `http://127.0.0.1:${server.address().port}`;
      const body = releases.map(release => ({
        tag_name: release.tag,
        draft: Boolean(release.draft),
        prerelease: Boolean(release.prerelease),
        html_url: `${base}/releases/${release.tag}`,
        assets: Object.entries(release.files).map(([name, source]) => ({
          name,
          size: release.sizes?.[name] ?? (Buffer.isBuffer(source) ? source.length : readFileSync(source).length),
          browser_download_url: `${base}/download/${release.tag}/${encodeURIComponent(name)}`,
        })),
      }));
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
      return;
    }
    const download = /^\/download\/([^/]+)\/([^/]+)$/.exec(url.pathname);
    if (download) {
      // GitHub gibi: indirme adresi başka bir adrese yönlendirir.
      res.writeHead(302, { location: `/objects/${download[1]}/${download[2]}` });
      res.end();
      return;
    }
    const object = /^\/objects\/([^/]+)\/([^/]+)$/.exec(url.pathname);
    if (object) {
      const release = releases.find(item => item.tag === object[1]);
      const name = decodeURIComponent(object[2]);
      const source = release?.files[name];
      if (!source) {
        res.writeHead(404);
        res.end();
        return;
      }
      hits.downloads.push(name);
      const data = Buffer.isBuffer(source) ? source : readFileSync(source);
      const send = () => {
        res.writeHead(200, { "content-type": "application/octet-stream", "content-length": data.length });
        res.end(data);
      };
      if (packageDelayMs && name.endsWith(".zip")) setTimeout(send, packageDelayMs);
      else send();
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ message: "Not Found" }));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    hits,
    setReleases(next) {
      releases = next;
    },
    close: () => new Promise(resolve => server.close(resolve)),
  };
}

export const releaseFiles = built => ({ [path.basename(built.zipPath)]: built.zipPath, "destekofis-guncelleme.json": built.manifestPath });
