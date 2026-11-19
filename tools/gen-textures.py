#!/usr/bin/env python3
"""Texturas pintadas dos mapas convertidos (estilo VALORANT: estilizado, limpo e legível).

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


# ---------- texturas (estilo VALORANT: formas grandes, pouco contraste, bordas chanfradas claras) ----------
# Regras tiradas do artigo "The Art of VALORANT Map Environments" (Riot) e das imagens dele:
# - superfícies grandes quase lisas, com variação de tom suave e larga (sem ruído miúdo);
# - materiais de valor parecido, claros, sem juntas escuras: a junta é só um pouco mais clara/acinzentada;
# - o detalhe está na forma: cada bloco/tábua/painel tem um filete claro na borda de cima/esquerda (chanfro pegando
#   luz) e uma sombra leve embaixo/direita; desgaste só nas quinas, em lascas claras e poucas;
# - cor por blocos (color blocking), sem textura fotográfica.

def voronoi(npts, seed, jitter=1.0):
    r = np.random.default_rng(seed)
    g = int(np.sqrt(npts)); pts = []
    for i in range(g):
        for j in range(g):
            pts.append(((i + .5 + (r.random() - .5) * jitter) / g, (j + .5 + (r.random() - .5) * jitter) / g))
    pts = np.array(pts) % 1
    d, idx = cKDTree(pts * N, boxsize=N).query(np.stack([yy.ravel() * N, xx.ravel() * N], -1), k=2)
    return (d[:, 1] - d[:, 0]).reshape(N, N), idx[:, 0].reshape(N, N)


def painted_blocks(rows, cols, base, offset=.5, joint=3.0, bevel=5.0, tone=.05, grad=.05, seed=1, joint_mix=.35,
                   chips=.0, ids_out=False):
    r = np.random.default_rng(seed)
    y = yy * rows; row = np.floor(y).astype(int)
    x = xx * cols + (row % 2) * offset; cx = np.floor(x).astype(int); fx = x - cx; fy = y - row
    ids = (row % rows) * cols + (cx % cols)
    bw, bh = N / cols, N / rows
    dl, dr, dt, db = fx * bw, (1 - fx) * bw, fy * bh, (1 - fy) * bh
    edge = np.minimum.reduce([dl, dr, dt, db])
    nb = rows * cols + cols
    t = r.uniform(1 - tone, 1 + tone, nb)
    ang = r.uniform(0, 2 * np.pi, nb)
    g = (np.cos(per_id(ids, ang)) * (fx - .5) + np.sin(per_id(ids, ang)) * (fy - .5)) * 2 * grad
    a = base[None, None] * (per_id(ids, t) + g)[..., None]
    lo = noise(140, seed + 50); a *= (0.97 + 0.06 * lo)[..., None]
    # chanfro: filete claro em cima/esquerda, sombra suave embaixo/direita
    hi = smooth(bevel, 0, np.minimum(dt, dl)) * (edge > joint * .5)
    sh = smooth(bevel, 0, np.minimum(db, dr)) * (edge > joint * .5)
    a = a * (1 + .13 * hi - .10 * sh)[..., None]
    if chips:
        ch = (noise(10, seed + 9) > 1 - chips) & (edge < bevel * 2.2) & (edge > joint)
        a[ch] = a[ch] * 1.12 + .03
    jc = base * 0.97 * (1 - joint_mix * .6) + np.array([.74, .72, .68]) * joint_mix * .6
    jm = smooth(joint * .55, joint, edge)
    a = a * jm[..., None] + jc[None, None] * (1 - jm[..., None])
    a = np.clip(a, 0, 1)
    return (a, ids, fx, fy, edge) if ids_out else a


def soft_surface(base, var=.06, seed=1, scale=160):
    v = noise(scale, seed) * .7 + noise(scale / 3, seed + 1) * .3
    return np.clip(base[None, None] * (1 - var + 2 * var * v)[..., None], 0, 1)


def t_plain():
    return soft_surface(col('#dcd8d0'), .03, 1)


def t_brick():
    return painted_blocks(10, 4, col('#c06a48'), joint=3.5, bevel=6, tone=.06, grad=.05, seed=2, chips=.05)


def t_tiles():
    return painted_blocks(4, 4, col('#cfc9bd'), offset=0, joint=3, bevel=6, tone=.035, grad=.04, seed=3, joint_mix=.25)


def t_planks(vertical=False):
    a, ids, fx, fy, edge = painted_blocks(6, 2, col('#b07d52'), offset=.37, joint=3, bevel=5, tone=.07, grad=.04, seed=4,
                                          joint_mix=.15, ids_out=True)
    # veio: faixas longas e suaves ao longo da tábua, sem linhas finas
    # veio: faixas longas e suaves ao longo da tábua (horizontais), sem linhas finas
    grain = np.sin((fy * 3.2 + noise(90, 41) * 2.2 + per_id(ids, rng.uniform(0, 6, 256))) * np.pi * 2) * .5 + .5
    knots = smooth(.86, .9, noise(30, 43)) * .5
    a = a * (0.92 + 0.11 * grain - .08 * knots)[..., None]
    if vertical:
        a = np.transpose(a, (1, 0, 2))
    return np.clip(a, 0, 1)


def t_plaster():
    # reboco: quase liso, manchas largas e uma leve marca de desgaste; sem pontos
    a = soft_surface(col('#e2d2b2'), .05, 5, 180)
    patch = smooth(.62, .7, noise(200, 52))
    return np.clip(a * (1 - .05 * patch)[..., None], 0, 1)


def t_metal():
    # painel metálico com nervuras largas e chanfradas
    a = painted_blocks(1, 6, col('#aeb6bc'), offset=0, joint=2, bevel=10, tone=.02, grad=.06, seed=6, joint_mix=.4)
    return a


def t_ground():
    return soft_surface(col('#9c8466'), .08, 7, 120)


def t_stone():
    return painted_blocks(5, 3, col('#c4baa7'), offset=.37, joint=4, bevel=9, tone=.05, grad=.06, seed=8)


def t_asphalt():
    return soft_surface(col('#6a6b6e'), .05, 9, 140)


def t_roof():
    # telhas: fileiras com a curva da telha em degradê suave e borda inferior clara
    rows, cols = 6, 5
    y = yy * rows; row = np.floor(y).astype(int); fy = y - row
    x = xx * cols + (row % 2) * .5; fx = x - np.floor(x); ids = row * cols + (np.floor(x).astype(int) % cols)
    curve = np.sin(fx * np.pi) ** .6
    tone = rng.uniform(.95, 1.05, 256)
    a = col('#c4613a')[None, None] * per_id(ids, tone)[..., None] * (0.86 + 0.18 * curve)[..., None]
    a *= (0.92 + 0.1 * fy)[..., None]
    lip = smooth(.9, .97, fy); a = a * (1 + .14 * lip)[..., None]
    gap = smooth(.0, .06, np.minimum(fx, 1 - fx)); a = a * (0.88 + .12 * gap)[..., None]
    return np.clip(a, 0, 1)


def t_foliage():
    # folhagem em massas grandes com luz no alto de cada massa
    d, idx = voronoi(36, 111)
    blob = smooth(0, 40, d)
    a = col('#6f9a42')[None, None] * per_id(idx, rng.uniform(.9, 1.1, 128))[..., None] * (0.82 + 0.25 * blob)[..., None]
    return np.clip(a * (0.96 + .08 * noise(90, 12))[..., None], 0, 1)


def t_crate():
    base = t_planks() * np.array([.92, .88, .82])
    fr = .12
    frame = (xx < fr) | (xx > 1 - fr) | (yy < fr) | (yy > 1 - fr) | (np.abs(xx - yy) < .07)
    a = base.copy()
    light = soft_surface(col('#d9b67e'), .04, 77)
    a[frame] = light[frame]
    e = np.minimum.reduce([np.abs(xx - fr), np.abs(1 - fr - xx), np.abs(yy - fr), np.abs(1 - fr - yy)]) * N
    a *= (1 - .18 * smooth(3, 0, e) * ~frame)[..., None]
    outer = np.minimum.reduce([xx, 1 - xx, yy, 1 - yy]) * N
    a *= (1 + .12 * smooth(5, 0, outer))[..., None]
    st = (np.abs(xx - .5) < .2) & (np.abs(yy - .32) < .04) & ~frame
    a[st] = a[st] * .62
    return np.clip(a, 0, 1)


def t_barrel():
    staves = 8
    fx = (xx * staves) % 1
    curve = np.sin(fx * np.pi) ** .5
    a = col('#9a6640')[None, None] * per_id(np.floor(xx * staves).astype(int), rng.uniform(.94, 1.06, 16))[..., None]
    a = a * (0.85 + 0.18 * curve)[..., None]
    hoop = (np.abs(yy - .2) < .04) | (np.abs(yy - .8) < .04)
    a[hoop] = col('#55575c') * (0.85 + .2 * curve[hoop])[:, None]
    return np.clip(a, 0, 1)


def t_lantern():
    ribs = np.abs(((xx * 8) % 1) - .5) * 2
    a = col('#ffbf6e')[None, None] * (0.8 + .2 * np.sin(yy * np.pi))[..., None] * (0.9 + 0.1 * ribs)[..., None]
    band = (yy < .1) | (yy > .9); a[band] = col('#7a2a1c')
    mark = (np.abs(xx - .5) < .08) & (np.abs(yy - .5) < .14); a[mark] = col('#d0543a')
    return np.clip(a, 0, 1)


def t_wainscot():
    a, ids, fx, fy, edge = painted_blocks(2, 2, col('#a8724c'), offset=0, joint=4, bevel=14, tone=.03, grad=.05, seed=15,
                                          joint_mix=.1, ids_out=True)
    inner = smooth(40, 46, edge)
    a = a * (0.94 + 0.06 * inner)[..., None]
    return np.clip(a, 0, 1)


def t_cobble():
    d, idx = voronoi(100, 141, .8)
    stone = smooth(2, 7, d)
    a = col('#b3aa9c')[None, None] * per_id(idx, rng.uniform(.93, 1.07, 256))[..., None]
    rim = smooth(14, 4, d) * stone
    a = a * (1 + .1 * rim)[..., None]
    jc = col('#a49b8c')
    a = a * stone[..., None] + jc[None, None] * (1 - stone[..., None])
    return np.clip(a, 0, 1)


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
