"""Converte props do pack URBAN (.glb com textura) em geometria low poly com cor por triângulo para os mapas.

Uso: python3 tools/pack/build_urban.py <pasta URBAN>  ->  assets/maps/urban-props.js

Cada triângulo leva a cor da textura no centro dele (média de 4 amostras nos cantos e no centro do UV), então o
prop fica com o mesmo visual facetado do resto do jogo e entra na malha única do mapa (sem texturas extras).
Saída por prop: p = posições em milímetros (3 vértices por triângulo, base no chão, centrado em X/Z), c = cor RGB
por triângulo, b = caixa [x0, y0, z0, x1, y1, z1] em metros (para a colisão).
"""
import json, struct, sys, os, io
import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'maps', 'urban-props.js')
PICK = {  # nome no jogo: arquivo do pack
    'dumpsterRed': 'dumpster_lid_closed_red', 'dumpsterBlue': 'dumpster_lid_closed_blue', 'dumpsterOpen': 'dumpster_full_lid_open_red',
    'jersey': 'Jersey_barrier', 'jerseyDirty': 'Jersey_barrier_dirty', 'jerseyBroken': 'Jersey_barrier_broken_edge',
    'cone': 'Traffic_cone_round', 'coneTall': 'Construction_cone',
    'trashCan': 'trash_can_full', 'metalCan': 'metaltrashcan_closed', 'metalCanFull': 'metaltrashcan_overflowing',
    'bag': 'trashbag_1', 'bagBlue': 'trashbag_2_blue', 'trashPile': 'trashpile_2',
    'bollard': 'square_bollard', 'bollardRetro': 'concrete_retro_bollard',
    'barrier3': 'Type_3_barrier_2_planks', 'barrier2': 'Type_2_barrier_top_bottom',
    'streetLight': 'street_light', 'trafficLight': 'traffic_light_pole',
    'busStop': 'busstop_clean_bench',
    'pipe': 'pipe', 'duct': 'duct_long', 'ductCorner': 'duct_corner_rounded',
    'fenceWood': 'wooden_fence_closed', 'drystone': 'drystone_wall_capped',
}


def load(path):
    f = open(path, 'rb').read(); n = struct.unpack('<I', f[12:16])[0]; J = json.loads(f[20:20 + n]); B = f[20 + n + 8:]
    def view(i):
        bv = J['bufferViews'][i]; o = bv.get('byteOffset', 0); return B[o:o + bv['byteLength']]
    def acc(i):
        a = J['accessors'][i]; bv = J['bufferViews'][a['bufferView']]; o = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
        k = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]; dt = {5126: np.float32, 5123: np.uint16, 5125: np.uint32, 5121: np.uint8}[a['componentType']]
        st = bv.get('byteStride')
        if st and st != k * np.dtype(dt).itemsize:
            raw = np.frombuffer(B, dtype=np.uint8, count=st * a['count'], offset=o).reshape(-1, st)[:, :k * np.dtype(dt).itemsize]
            return np.frombuffer(raw.tobytes(), dtype=dt).reshape(-1, k)
        r = np.frombuffer(B, dtype=dt, count=a['count'] * k, offset=o); return r.reshape(-1, k) if k > 1 else r
    imgs = {}
    def tex(mi):
        m = J['materials'][mi]; pb = m.get('pbrMetallicRoughness', {}); f = np.array(pb.get('baseColorFactor', [1, 1, 1, 1])[:3])
        t = pb.get('baseColorTexture')
        if not t: return None, f
        src = J['textures'][t['index']]['source']
        if src not in imgs: imgs[src] = np.asarray(Image.open(io.BytesIO(view(J['images'][src]['bufferView']))).convert('RGB'), dtype=float) / 255
        return imgs[src], f
    def mat(node):
        M = np.eye(4)
        if 'matrix' in node: return np.array(node['matrix']).reshape(4, 4).T
        T = np.eye(4); T[:3, 3] = node.get('translation', [0, 0, 0])
        x, y, z, w = node.get('rotation', [0, 0, 0, 1])
        R = np.eye(4); R[:3, :3] = [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]
        S = np.diag(list(node.get('scale', [1, 1, 1])) + [1]); return T @ R @ S
    tris, cols = [], []
    def walk(ni, P):
        node = J['nodes'][ni]; M = P @ mat(node)
        if 'mesh' in node:
            for pr in J['meshes'][node['mesh']]['primitives']:
                V = acc(pr['attributes']['POSITION']).astype(float); V = (np.c_[V, np.ones(len(V))] @ M.T)[:, :3]
                I = acc(pr['indices']).astype(int).reshape(-1, 3) if 'indices' in pr else np.arange(len(V)).reshape(-1, 3)
                UV = acc(pr['attributes']['TEXCOORD_0']).astype(float) if 'TEXCOORD_0' in pr['attributes'] else None
                img, fac = tex(pr['material']) if 'material' in pr else (None, np.ones(3))
                for t in I:
                    tris.append(V[t])
                    if img is None or UV is None: cols.append(fac); continue
                    h, w = img.shape[:2]; uv = UV[t]; c = uv.mean(0)
                    smp = [c] + [c + (u - c) * .7 for u in uv]
                    acc_c = np.mean([img[int((v % 1) * (h - 1)) if v != 1 else h - 1, int((u % 1) * (w - 1))] for u, v in smp], axis=0)
                    cols.append(acc_c * fac)
        for c in node.get('children', []): walk(c, M)
    for ni in J['scenes'][J.get('scene', 0)]['nodes']: walk(ni, np.eye(4))
    return np.array(tris), np.array(cols)


def main(root):
    files = {}
    for dp, _, fs in os.walk(root):
        for f in fs:
            if f.endswith('.glb'): files.setdefault(f[:-4], os.path.join(dp, f))
    out = {}
    for key, name in PICK.items():
        T, C = load(files[name])
        lo, hi = T.reshape(-1, 3).min(0), T.reshape(-1, 3).max(0)
        T = T - [(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2]
        lo, hi = T.reshape(-1, 3).min(0), T.reshape(-1, 3).max(0)
        C = np.clip(C, 0, 1) ** (1 / 2.2) if False else np.clip(C, 0, 1)
        out[key] = {'p': [int(round(v * 1000)) for v in T.reshape(-1)], 'c': [int(round(c[0] * 255)) << 16 | int(round(c[1] * 255)) << 8 | int(round(c[2] * 255)) for c in C],
                    'b': [round(float(v), 3) for v in list(lo) + list(hi)]}
        if key in ('streetLight', 'trafficLight'):   # base do poste (a colisão fica só nela)
            base = T.reshape(-1, 3); base = base[base[:, 1] < .3]
            out[key]['pole'] = [round(float(base[:, 0].mean()), 3), round(float(base[:, 2].mean()), 3)]
        print(f'{key:14s} {name:34s} tris={len(C):5d} size={np.round(hi - lo, 2)}')
    with open(OUT, 'w') as fh:
        fh.write('// Gerado por tools/pack/build_urban.py a partir do pack URBAN (props urbanos low poly). Posições em mm,\n'
                 '// cor RGB por triângulo (amostrada da textura do pack), caixa em metros.\n')
        fh.write('globalThis.URBAN_PROPS = ' + json.dumps(out, separators=(',', ':')) + ';\n')
    print(os.path.getsize(OUT), 'bytes')


if __name__ == '__main__':
    main(sys.argv[1])
