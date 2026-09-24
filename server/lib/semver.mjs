// Küçük ve bağımlılıksız anlamsal sürüm (semver) yardımcıları: "1.3.0", "v1.3.0", "1.4.0-beta.2".
const PATTERN = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

export function parseVersion(value) {
  const match = PATTERN.exec(String(value ?? "").trim());
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), prerelease: match[4] ? match[4].split(".") : [] };
}

export const isVersion = value => parseVersion(value) !== null;

export const normalizeVersion = value => {
  const parsed = parseVersion(value);
  if (!parsed) return null;
  return `${parsed.major}.${parsed.minor}.${parsed.patch}${parsed.prerelease.length ? `-${parsed.prerelease.join(".")}` : ""}`;
};

function comparePrerelease(a, b) {
  if (!a.length && !b.length) return 0;
  if (!a.length) return 1; // 1.0.0 > 1.0.0-beta
  if (!b.length) return -1;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    if (a[index] === undefined) return -1;
    if (b[index] === undefined) return 1;
    const [x, y] = [a[index], b[index]];
    const [nx, ny] = [/^\d+$/.test(x), /^\d+$/.test(y)];
    if (nx && ny) {
      if (Number(x) !== Number(y)) return Number(x) - Number(y);
    } else if (nx !== ny) return nx ? -1 : 1;
    else if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

// a > b ise pozitif, eşitse 0, küçükse negatif. Geçersiz sürüm her zaman en küçük sayılır.
export function compareVersions(a, b) {
  const [x, y] = [parseVersion(a), parseVersion(b)];
  if (!x || !y) return x ? 1 : y ? -1 : 0;
  for (const key of ["major", "minor", "patch"]) if (x[key] !== y[key]) return x[key] - y[key];
  return comparePrerelease(x.prerelease, y.prerelease);
}

export const isPrerelease = value => Boolean(parseVersion(value)?.prerelease.length);
