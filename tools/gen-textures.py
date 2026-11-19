#!/usr/bin/env python3
"""Texturas pintadas dos mapas convertidos (estilo cartunesco perto do realismo).

Gera 16 texturas próprias, sem imagens de terceiros: cada uma é desenhada aqui com formas limpas (tijolos,
tábuas, pedras, telhas...), relevo pintado (luz do alto à esquerda, sombra embaixo), oclusão nas juntas e pouco
ruído. Saída: assets/maps/textures.js com o atlas em WebP (data URL) e a cor média de cada textura, usada pelo jogo
para manter a cor real de cada material do mapa original.

Uso: python3 tools/gen-textures.py   (precisa de numpy, scipy e Pillow)
"""
import base64, io, json, os
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter
from scipy.spatial import cKDTree

N = 512          # tamanho de cada textura (repetível)
PAD = 16         # borda repetida em volta de cada textura no atlas (evita costuras no mipmap)
CELL = N + 2 * PAD
rng = np.random.default_rng(7)
yy, xx = np.mgrid[0:N, 0:N] / N


def noise(scale, seed=0):
    """Ruído suave e repetível (filtro gaussiano periódico sobre ruído branco), em 0..1."""
    r = np.random.default_rng(seed).standard_normal((N, N))
    f = np.fft.fft2(r)
    ky = np.fft.fftfreq(N)[:, None]; kx = np.fft.fftfreq(N)[None, :]
    f *= np.exp(-(kx ** 2 + ky ** 2) * (N / scale) ** 2 * 2)
    v = np.real(np.fft.ifft2(f)); v -= v.min(); v /= v.max() + 1e-9
    return v


def fbm(seed, scales=(64, 24, 8), weights=(.55, .3, .15)):
    return sum(w * noise(s, seed + i) for i, (s, w) in enumerate(zip(scales, weights)))


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)


def shade(albedo, height, strength=2.2, ao=0.45, light=(-0.55, -0.65, 0.52)):
    """Relevo pintado: normal pelo gradiente da altura (repetível), luz do alto à esquerda e oclusão nas juntas."""
    gx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * N / 2 * strength / 64
    gy = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * N / 2 * strength / 64
    n = np.stack([-gx, -gy, np.ones_like(gx)], -1); n /= np.linalg.norm(n, axis=-1, keepdims=True)
    l = np.array(light); l = l / np.linalg.norm(l)
    lam = np.clip((n * l).sum(-1), 0, 1)
    flat = l[2]
    s = 0.78 + 0.42 * (lam - flat)
    blur = gaussian_filter(height, 6, mode='wrap')
    occl = 1 - ao * np.clip(blur - height, 0, 1) * 4
    return np.clip(albedo * (s * occl)[..., None], 0, 1)


def col(hexv):
    return np.array([int(hexv[i:i + 2], 16) / 255 for i in (1, 3, 5)])


def rows_bond(rows, cols, offset=.5, jitter=0.0, seed=0):
    """Grade de tijolos/blocos em amarração: índice do bloco e distância à borda (em fração do bloco)."""
    r = rng if seed == 0 else np.random.default_rng(seed)
    y = yy * rows; row = np.floor(y).astype(int)
    x = xx * cols + (row % 2) * offset; colx = np.floor(x).astype(int) % cols
    fx = x - np.floor(x); fy = y - row
    ids = row * cols + colx
    edge = np.minimum(np.minimum(fx, 1 - fx) * (N / cols), np.minimum(fy, 1 - fy) * (N / rows))
    return ids, edge, fx, fy


def per_id(ids, values):
    return values[ids % len(values)]


# ---------- texturas ----------

def t_plain():
    a = np.ones((N, N, 3)) * col('#d8d4cc')[None, None]
    v = fbm(1, (128, 40), (.7, .3))
    a *= (0.95 + 0.07 * v)[..., None]
    return shade(a, v * .15, 1)


def t_brick():
    ids, edge, fx, fy = rows_bond(16, 4)
    tone = rng.uniform(.82, 1.12, 4096)
    hue = rng.uniform(-.04, .04, 4096)
    base = col('#b4583a')
    mortar = col('#cfc3ad')
    brick = base[None, None] * per_id(ids, tone)[..., None]
    brick[..., 0] += per_id(ids, hue); brick[..., 2] -= per_id(ids, hue) * .5
    v = fbm(2, (40, 10), (.6, .4))
    brick *= (0.9 + 0.16 * v)[..., None]
    m = smooth(3.5, 6.5, edge)  # 1 no tijolo, 0 na argamassa
    # quinas gastas
    chip = (noise(14, 21) > .78) & (edge < 12)
    m = np.where(chip, m * .4, m)
    a = brick * m[..., None] + mortar[None, None] * (1 - m[..., None]) * (0.9 + 0.1 * v[..., None])
    h = m * (0.8 + 0.2 * v)
    return shade(a, h, 2.4, .5)


def t_tiles():
    ids, edge, fx, fy = rows_bond(4, 4, 0)
    tone = rng.uniform(.9, 1.08, 64)
    v = fbm(3, (60, 12), (.6, .4))
    base = col('#c9c3b6') * per_id(ids, tone)[..., None] * (0.92 + 0.12 * v)[..., None]
    m = smooth(2, 5, edge)
    a = base * m[..., None] + col('#7d776c')[None, None] * (1 - m[..., None])
    return shade(a, m * .9 + v * .1, 2.0)


def t_planks(vertical=False):
    rows = 8
    y = (xx if vertical else yy) * rows; row = np.floor(y).astype(int); fy = y - row
    along = (yy if vertical else xx)
    off = per_id(row, rng.uniform(0, 1, 64))
    seg = (along + off) * 2; segi = np.floor(seg).astype(int); fs = seg - segi
    ids = row * 7 + segi
    tone = rng.uniform(.82, 1.1, 1024)
    grain = noise(6, 31) if not vertical else noise(6, 32)
    gx = np.sin((along * 40 + grain * 6 + per_id(ids, rng.uniform(0, 6, 1024))) * np.pi) * .5 + .5
    base = col('#a4744a') * per_id(ids, tone)[..., None]
    base = base * (0.88 + 0.12 * gx)[..., None]
    edge = np.minimum(np.minimum(fy, 1 - fy) * (N / rows), np.minimum(fs, 1 - fs) * (N / 2))
    m = smooth(1.5, 4, edge)
    a = base * (0.55 + 0.45 * m)[..., None]
    # pregos
    nail = ((np.abs(fs - .06) < .012) | (np.abs(fs - .94) < .012)) & (np.abs(fy - .5) < .06)
    a[nail] = col('#4a4038')
    return shade(a, m * .8 + gx * .1, 2.0, .4)


def t_plaster():
    v = fbm(5, (90, 30, 8), (.5, .35, .15))
    patches = smooth(.55, .62, noise(70, 51))
    base = col('#d9c9a8')
    a = base[None, None] * (0.9 + 0.14 * v)[..., None]
    a = a * (1 - 0.08 * patches[..., None])
    # reboco caído mostrando tijolos em manchas pequenas
    hole = smooth(.78, .8, noise(160, 52)) * smooth(.3, .6, noise(40, 53))
    ids, edge, *_ = rows_bond(24, 6)
    br = col('#a35a3d')[None, None] * (0.85 + 0.15 * smooth(2, 4, edge))[..., None]
    a = a * (1 - hole[..., None]) + br * hole[..., None]
    h = v * .08 + (1 - hole) * .7
    return shade(a, h, 1.2, .3)


def t_metal():
    ribs = (np.sin(xx * 2 * np.pi * 10) * .5 + .5)
    v = fbm(6, (80, 20), (.6, .4))
    a = col('#a6adb3')[None, None] * (0.85 + 0.15 * ribs)[..., None] * (0.92 + 0.1 * v)[..., None]
    rust = smooth(.7, .8, noise(30, 61)) * smooth(.6, 1, yy)
    a = a * (1 - .5 * rust[..., None]) + col('#8a5434')[None, None] * .5 * rust[..., None]
    return shade(a, ribs * .6 + v * .1, 2.2, .3)


def t_ground():
    v = fbm(7, (60, 20, 6), (.5, .3, .2))
    a = col('#8a7458')[None, None] * (0.8 + 0.3 * v)[..., None]
    pts = rng.uniform(0, 1, (220, 2))
    d, _ = cKDTree(pts * N, boxsize=N).query(np.stack([yy.ravel() * N, xx.ravel() * N], -1))
    peb = (d.reshape(N, N) < rng.uniform(3, 6)) * 1.0
    a = a * (1 - peb[..., None] * .2) + col('#b8a58a')[None, None] * peb[..., None] * .2
    return shade(a, v * .5 + peb * .3, 1.8, .4)


def voronoi(npts, seed, jitter=1.0):
    r = np.random.default_rng(seed)
    g = int(np.sqrt(npts)); pts = []
    for i in range(g):
        for j in range(g):
            pts.append(((i + .5 + (r.random() - .5) * jitter) / g, (j + .5 + (r.random() - .5) * jitter) / g))
    pts = np.array(pts) % 1
    tree = cKDTree(pts * N, boxsize=N)
    d, idx = tree.query(np.stack([yy.ravel() * N, xx.ravel() * N], -1), k=2)
    return (d[:, 1] - d[:, 0]).reshape(N, N), idx[:, 0].reshape(N, N)


def t_stone():
    # Cantaria: blocos de tamanhos diferentes, chanfrados.
    ids, edge, fx, fy = rows_bond(6, 3, .37)
    tone = rng.uniform(.84, 1.1, 256)
    v = fbm(8, (40, 12, 5), (.5, .3, .2))
    a = col('#b8ae9c')[None, None] * per_id(ids, tone)[..., None] * (0.88 + 0.16 * v)[..., None]
    bevel = smooth(3, 14, edge)
    m = smooth(2.5, 4.5, edge)
    a = a * m[..., None] + col('#6e675c')[None, None] * (1 - m[..., None])
    return shade(a, bevel * .9 + v * .15, 2.4, .5)


def t_asphalt():
    v = fbm(9, (50, 10, 3), (.4, .35, .25))
    a = col('#5e5e60')[None, None] * (0.86 + 0.24 * v)[..., None]
    crack = smooth(.0, .02, np.abs(noise(40, 91) - .5)) < .5
    a[crack] *= .7
    return shade(a, v * .3, 1.2, .2)


def t_roof():
    # Telhas de barro em fileiras: cada telha arredondada embaixo.
    rows, cols = 8, 6
    y = yy * rows; row = np.floor(y).astype(int); fy = y - row
    x = xx * cols + (row % 2) * .5; fx = x - np.floor(x); ids = row * cols + (np.floor(x).astype(int) % cols)
    curve = np.sin(fx * np.pi)
    tone = rng.uniform(.82, 1.12, 512)
    base = col('#b5532f') * per_id(ids, tone)[..., None]
    lip = fy > 0.72 + 0.18 * (1 - curve)
    h = curve * .6 + fy * .35
    a = base * (0.75 + 0.35 * curve)[..., None]
    a[lip] *= 0.6
    v = fbm(10, (30, 8), (.6, .4))
    a *= (0.92 + 0.12 * v)[..., None]
    return shade(a, h, 2.2, .45)


def t_foliage():
    v = fbm(11, (24, 8), (.6, .4))
    d, idx = voronoi(144, 111)
    blob = smooth(0, 18, d)
    tone = per_id(idx, rng.uniform(.75, 1.15, 512))
    a = col('#5f8a3a')[None, None] * tone[..., None] * (0.75 + 0.35 * blob)[..., None] * (0.9 + 0.15 * v)[..., None]
    return shade(a, blob * .8 + v * .2, 2.0, .5)


def t_crate():
    # Face de caixote: moldura clara e grossa, tábuas internas mais escuras, travessa diagonal e estêncil.
    planks = t_planks()
    base = planks * np.array([.86, .78, .66])
    fr = 0.13
    frame = (xx < fr) | (xx > 1 - fr) | (yy < fr) | (yy > 1 - fr)
    diag = np.abs((xx - yy)) < 0.075
    board = frame | diag
    h = np.where(board, 1.0, 0.35)
    a = base.copy()
    grain = noise(5, 77)
    light = col('#d2b07a')[None, None] * (0.88 + 0.12 * grain)[..., None]
    a[board] = light[board]
    # estêncil: duas setas e um retângulo
    st = (np.abs(xx - .5) < .18) & (np.abs(yy - .3) < .05) & ~board
    a[st] = a[st] * .55
    edge = np.minimum.reduce([np.abs(xx - fr), np.abs(1 - fr - xx), np.abs(yy - fr), np.abs(1 - fr - yy)])
    a *= (1 - .25 * (edge < .01))[..., None]
    return shade(a, gaussian_filter(h, 2, mode='wrap'), 2.6, .5)


def t_barrel():
    staves = 10
    fx = (xx * staves) % 1
    curve = np.sin(fx * np.pi)
    tone = per_id(np.floor(xx * staves).astype(int), rng.uniform(.85, 1.08, 16))
    a = col('#8a5a34')[None, None] * tone[..., None] * (0.8 + 0.25 * curve)[..., None]
    grain = noise(5, 121)
    a *= (0.92 + 0.1 * np.sin((yy * 30 + grain * 4) * np.pi) * .5 + .05)[..., None]
    hoop = (np.abs(yy - .2) < .035) | (np.abs(yy - .8) < .035)
    a[hoop] = col('#3c3c40') * (0.8 + 0.3 * curve[hoop])[:, None]
    h = curve * .6 + hoop * .4
    return shade(a, h, 2.0, .4)


def t_lantern():
    # Papel da lanterna aceso: laranja quente, nervuras verticais e faixas escuras no alto e embaixo.
    ribs = np.abs(((xx * 8) % 1) - .5) * 2
    glow = 0.75 + 0.25 * np.sin(yy * np.pi)
    a = col('#ffb35c')[None, None] * glow[..., None]
    a *= (0.85 + 0.15 * ribs)[..., None]
    band = (yy < .1) | (yy > .9)
    a[band] = col('#5a1d14')
    mark = (np.abs(xx - .5) < .08) & (np.abs(yy - .5) < .14)
    a[mark] = col('#c4462a')
    return np.clip(a, 0, 1)


def t_wainscot():
    # Parede de madeira com painéis em relevo (corredor das lanternas).
    pw, ph = 2, 2
    fx = (xx * pw) % 1; fy = (yy * ph) % 1
    edge = np.minimum(np.minimum(fx, 1 - fx), np.minimum(fy, 1 - fy))
    raised = smooth(.08, .14, edge)
    planks = t_planks(vertical=True) * np.array([1.1, .9, .85])
    a = planks * (0.8 + 0.25 * raised)[..., None]
    groove = (edge > .06) & (edge < .08)
    a[groove] *= .6
    return shade(a, raised * .8, 2.2, .45)


def t_cobble():
    d, idx = voronoi(196, 141, .8)
    stone = smooth(1.5, 9, d)
    tone = per_id(idx, rng.uniform(.8, 1.12, 512))
    v = fbm(14, (30, 8), (.6, .4))
    a = col('#a39a8c')[None, None] * tone[..., None] * (0.88 + 0.16 * v)[..., None]
    a = a * (0.45 + 0.55 * stone)[..., None]
    return shade(a, stone * .9 + v * .1, 2.4, .55)


TILES = [t_plain, t_brick, t_tiles, t_planks, t_plaster, t_metal, t_ground, t_stone, t_asphalt, t_roof, t_foliage,
         t_crate, t_barrel, t_lantern, t_wainscot, t_cobble]


def main():
    atlas = np.zeros((CELL * 4, CELL * 4, 3))
    means = []
    for i, fn in enumerate(TILES):
        tex = fn()
        means.append([round(float(v), 4) for v in tex.reshape(-1, 3).mean(0)])
        big = np.tile(tex, (3, 3, 1))[N - PAD:2 * N + PAD, N - PAD:2 * N + PAD]
        r, c = divmod(i, 4)
        atlas[r * CELL:(r + 1) * CELL, c * CELL:(c + 1) * CELL] = big
    img = Image.fromarray((np.clip(atlas, 0, 1) ** (1 / 1.0) * 255).astype(np.uint8))
    out = os.path.join(os.path.dirname(__file__), '..', 'assets', 'maps')
    buf = io.BytesIO(); img.save(buf, 'WEBP', quality=88, method=6)
    data = base64.b64encode(buf.getvalue()).decode()
    with open(os.path.join(out, 'textures.js'), 'w') as f:
        f.write('// Gerado por tools/gen-textures.py: texturas pintadas próprias (sem imagens de terceiros).\n')
        f.write('globalThis.MAP_TEXTURES=' + json.dumps({'cell': CELL, 'size': N, 'pad': PAD, 'grid': 4, 'means': means,
                                                       'image': 'data:image/webp;base64,' + data}) + ';\n')
    img.save(os.path.join(os.environ.get('PREVIEW_DIR', '/tmp'), 'atlas_preview.png'))
    print('atlas', img.size, len(buf.getvalue()) // 1024, 'KiB')


if __name__ == '__main__':
    main()
