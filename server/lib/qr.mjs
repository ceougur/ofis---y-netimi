// QR karekod üreticisi (ISO/IEC 18004; bayt kipi, hata düzeltme M, sürüm 1–40, en düşük cezalı maske). Dış bağımlılık yok: program çalışma
// zamanında hiç npm paketi taşımaz. e-Belge karekodu (GİB Karekod Standardı Kılavuzu V.1.2) için yazıldı (lib/einvoice/karekod.mjs); kâhin,
// programdan bağımsız bir çözücüdür (test/karekod.test.mjs: jsQR). Yapı, herkese açık başvuru uygulamasının (Project Nayuki, "QR Code generator
// library", MIT) adımlarını izler: veri bitleri → Reed-Solomon (GF(256), 0x11D) → bloklara bölüp serpiştirme → işlev desenleri → zikzak yerleşim →
// 8 maske içinden ISO ceza puanı en düşük olan.

// Sürüm başına (1–40) M düzeyi blok başına hata düzeltme kod sözcüğü ve blok sayısı (ISO/IEC 18004 Tablo 9).
const ECC_PER_BLOCK_M = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28];
const BLOCKS_M = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49];
const FORMAT_M = 0; // biçim bitlerindeki düzey kodu: L 1, M 0, Q 3, H 2

const bit = (value, index) => ((value >>> index) & 1) !== 0;

function rawModules(version) {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const align = Math.floor(version / 7) + 2;
    result -= (25 * align - 10) * align - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}
const dataCodewords = version => Math.floor(rawModules(version) / 8) - ECC_PER_BLOCK_M[version] * BLOCKS_M[version];

function gfMultiply(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i -= 1) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}
function rsDivisor(degree) {
  const result = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < result.length; j += 1) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}
function rsRemainder(data, divisor) {
  const result = new Array(divisor.length).fill(0);
  for (const value of data) {
    const factor = value ^ result.shift();
    result.push(0);
    divisor.forEach((coefficient, index) => {
      result[index] ^= gfMultiply(coefficient, factor);
    });
  }
  return result;
}

function alignmentPositions(version, size) {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
  const result = [6];
  for (let pos = size - 7; result.length < count; pos -= step) result.splice(1, 0, pos);
  return result;
}

/** Metni (UTF-8) karekoda çevirir: { size, modules: boolean[satır][sütun] } (true = koyu). */
export function encodeQr(text) {
  const bytes = [...Buffer.from(String(text), "utf8")];
  let version = 1;
  for (; version <= 40; version += 1) {
    const countBits = version <= 9 ? 8 : 16;
    if (4 + countBits + bytes.length * 8 <= dataCodewords(version) * 8) break;
  }
  if (version > 40) throw new Error("Karekoda sığmayacak kadar uzun metin.");
  // Veri bitleri: kip (bayt 0100), uzunluk, baytlar, sonlandırıcı, bayta tamamlama, dolgu (0xEC, 0x11).
  const bits = [];
  const push = (value, length) => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, version <= 9 ? 8 : 16);
  for (const value of bytes) push(value, 8);
  const capacity = dataCodewords(version) * 8;
  push(0, Math.min(4, capacity - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) push(pad, 8);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((sum, value) => (sum << 1) | value, 0));

  // Reed-Solomon ve serpiştirme.
  const blockCount = BLOCKS_M[version];
  const eccLength = ECC_PER_BLOCK_M[version];
  const raw = Math.floor(rawModules(version) / 8);
  const shortBlocks = blockCount - (raw % blockCount);
  const shortLength = Math.floor(raw / blockCount);
  const divisor = rsDivisor(eccLength);
  const blocks = [];
  for (let i = 0, k = 0; i < blockCount; i += 1) {
    const chunk = data.slice(k, k + shortLength - eccLength + (i < shortBlocks ? 0 : 1));
    k += chunk.length;
    const ecc = rsRemainder(chunk, divisor);
    if (i < shortBlocks) chunk.push(0);
    blocks.push(chunk.concat(ecc));
  }
  const codewords = [];
  for (let i = 0; i < blocks[0].length; i += 1) {
    blocks.forEach((block, j) => {
      if (i !== shortLength - eccLength || j >= shortBlocks) codewords.push(block[i]);
    });
  }

  // İşlev desenleri.
  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () => new Array(size).fill(false));
  const isFunction = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, dark) => {
    modules[y][x] = dark;
    isFunction[y][x] = true;
  };
  for (let i = 0; i < size; i += 1) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  for (const [cx, cy] of [
    [3, 3],
    [size - 4, 3],
    [3, size - 4],
  ]) {
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        const x = cx + dx;
        const y = cy + dy;
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, distance !== 2 && distance !== 4);
      }
    }
  }
  const positions = alignmentPositions(version, size);
  positions.forEach((py, i) =>
    positions.forEach((px, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === positions.length - 1) || (i === positions.length - 1 && j === 0)) return;
      for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) set(px + dx, py + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }),
  );
  const drawFormat = mask => {
    const value = (FORMAT_M << 3) | mask;
    let rem = value;
    for (let i = 0; i < 10; i += 1) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const format = ((value << 10) | rem) ^ 0x5412;
    for (let i = 0; i <= 5; i += 1) set(8, i, bit(format, i));
    set(8, 7, bit(format, 6));
    set(8, 8, bit(format, 7));
    set(7, 8, bit(format, 8));
    for (let i = 9; i < 15; i += 1) set(14 - i, 8, bit(format, i));
    for (let i = 0; i < 8; i += 1) set(size - 1 - i, 8, bit(format, i));
    for (let i = 8; i < 15; i += 1) set(8, size - 15 + i, bit(format, i));
    set(8, size - 8, true);
  };
  drawFormat(0);
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i += 1) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const value = (version << 12) | rem;
    for (let i = 0; i < 18; i += 1) {
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(a, b, bit(value, i));
      set(b, a, bit(value, i));
    }
  }

  // Veri yerleşimi (sağdan sola, ikişer sütun, zikzak).
  let index = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vertical = 0; vertical < size; vertical += 1) {
      for (let j = 0; j < 2; j += 1) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vertical : vertical;
        if (!isFunction[y][x] && index < codewords.length * 8) {
          modules[y][x] = bit(codewords[index >>> 3], 7 - (index & 7));
          index += 1;
        }
      }
    }
  }

  // Maske: 8 desenin ceza puanı en düşük olanı.
  const MASKS = [
    (x, y) => (x + y) % 2 === 0,
    (x, y) => y % 2 === 0,
    x => x % 3 === 0,
    (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
    (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
  ];
  const applyMask = mask => {
    for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) if (!isFunction[y][x] && MASKS[mask](x, y)) modules[y][x] = !modules[y][x];
  };
  let best = 0;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask += 1) {
    applyMask(mask);
    drawFormat(mask);
    const score = penalty(modules, size);
    if (score < bestScore) {
      bestScore = score;
      best = mask;
    }
    applyMask(mask); // geri al (xor)
  }
  applyMask(best);
  drawFormat(best);
  return { version, size, mask: best, modules };
}

// ISO/IEC 18004 §7.8.3 ceza puanı: art arda 5+ aynı renk (N1 = 3 + fazlası), 2×2 aynı renk blok (N2 = 3), bulucuya benzeyen 1:1:3:1:1 desen
// (N3 = 40), koyu oranının %50'den sapması (N4 = 10 / %5).
function penalty(modules, size) {
  let score = 0;
  const line = get => {
    let run = 1;
    for (let i = 1; i <= size; i += 1) {
      if (i < size && get(i) === get(i - 1)) run += 1;
      else {
        if (run >= 5) score += 3 + (run - 5);
        run = 1;
      }
    }
    const pattern = [true, false, true, true, true, false, true];
    for (let i = 0; i + 7 <= size; i += 1) {
      if (!pattern.every((value, k) => get(i + k) === value)) continue;
      const lightBefore = [1, 2, 3, 4].every(k => i - k < 0 || !get(i - k));
      const lightAfter = [0, 1, 2, 3].every(k => i + 7 + k >= size || !get(i + 7 + k));
      if (lightBefore || lightAfter) score += 40;
    }
  };
  for (let y = 0; y < size; y += 1) line(x => modules[y][x]);
  for (let x = 0; x < size; x += 1) line(y => modules[y][x]);
  let dark = 0;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (modules[y][x]) dark += 1;
      if (y + 1 < size && x + 1 < size) {
        const value = modules[y][x];
        if (modules[y][x + 1] === value && modules[y + 1][x] === value && modules[y + 1][x + 1] === value) score += 3;
      }
    }
  }
  score += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
  return score;
}

/** Karekodu SVG'ye çevirir (4 modül sessiz bölge; koyu modüller tek yol). */
export function qrSvg(text, { scale = 4, quiet = 4 } = {}) {
  const { size, modules } = encodeQr(text);
  const full = size + quiet * 2;
  const path = [];
  modules.forEach((row, y) => {
    for (let x = 0; x < size; ) {
      if (!row[x]) {
        x += 1;
        continue;
      }
      let end = x;
      while (end < size && row[end]) end += 1;
      path.push(`M${x + quiet} ${y + quiet}h${end - x}v1h${x - end}z`);
      x = end;
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${full * scale}" height="${full * scale}" viewBox="0 0 ${full} ${full}" shape-rendering="crispEdges"><rect width="${full}" height="${full}" fill="#fff"/><path d="${path.join("")}" fill="#000"/></svg>`;
}
