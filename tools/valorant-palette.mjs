// Política de cores dos mapas portados com as cores reais dos materiais (Calamari, Coldwater, Crown):
// paleta clara e viva como a do Valorant. Mantém o matiz de cada material (madeira continua madeira, telha continua
// telha), mas nenhum tom fica escuro: a luminosidade tem piso, a saturação ganha um pouco de vida e a água vira
// o turquesa claro das praias do Valorant em vez do cinza/roxo do CS.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function toHsl(c) {
  const r = (c >> 16 & 255) / 255, g = (c >> 8 & 255) / 255, b = (c & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function fromHsl(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r, g, b].reduce((v, q) => (v << 8) | Math.round(clamp(q + m, 0, 1) * 255), 0);
}

export const VALORANT_PALETTE = { floor: .36, lift: .3, ceiling: .86, saturation: 1.15, maxSaturation: .7 };
export const WATER = { surface: 0x7fd3d8, beneath: 0x46a9b4 };

// Clareia uma cor: L' = max(L, piso + lift·L), limitada ao teto; S' = S·saturation até maxSaturation.
export function valorantColor(c, p = VALORANT_PALETTE) {
  const [h, s, l] = toHsl(c);
  return fromHsl(h, Math.min(p.maxSaturation, s * p.saturation), clamp(Math.max(l, p.floor + p.lift * l), 0, p.ceiling));
}

// Aplica em todas as faces do mapa (mundo, displacements, modelos e objetos aproximados). As faces de água são
// marcadas na importação (face.water = 'surface' | 'beneath'), antes de o nome do material ser descartado.
export function valorantPalette(map) {
  const cache = new Map();
  let faces = 0, water = 0;
  for (const face of map.polygons) {
    if (face.water) { face.c = WATER[face.water]; face.glass = true; delete face.water; water++; continue; }
    if (face.c == null) continue;
    if (!cache.has(face.c)) cache.set(face.c, valorantColor(face.c));
    face.c = cache.get(face.c); faces++;
  }
  map.report.palette = { faces, water, colors: cache.size };
}
