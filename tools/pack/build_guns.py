# Monta assets/models/guns-pack.js a partir de tools/pack/quaternius.json (Ultimate Gun Pack by Quaternius, CC0,
# exportado com export_quaternius.py). Cada arma do jogo usa um modelo do pack: escala única, cano para -Z, gatilho no
# lugar do gatilho de antes e peças marcadas para o rig: pente ('mag'), ferrolho/alavanca ('bolt'), telha ('pump') e
# ferrolho da Deagle ('slide'). Pistolas sem pente separado ganham um pente escondido dentro do cabo (aparece na recarga).
import json, os
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
G = json.load(open(os.path.join(HERE, 'quaternius.json')))
S = .179  # AK do pack (5,42 de comprimento) com o tamanho do AK de antes (0,97 m na cena da primeira pessoa)
# Paleta: as cores do pack são escuras porque a prévia usa luz forte; aqui ficam no tom da prévia.
PAL = {'Black': 0x3a3a3d, 'Black2': 0x2a2a2c, 'DarkMetal': 0x55575a, 'Metal': 0x6e7072, 'Grey': 0x5a5c5e, 'LightMetal': 0x8f9196,
       'LightMetal2': 0xb3b5ba, 'Main': 0x3d454c, 'MainDark': 0x2c3540, 'MainLight': 0x4a535a, 'Wood': 0xa47e62, 'DarkWood': 0x7d6553,
       'Green': 0x8a977f, 'Glass': 0x1c2e40}
# arma do jogo: modelo, peças do gatilho, marcas {peça: [componentes]}, ponto do cabo de antes, acessório na boca
SPEC = {
  'rifle': ('AssaultRifle_2', [9], {'mag': [4]}, [0, -.0847, .011], None),
  'galil': ('AssaultRifle_5', [9], {'mag': [4]}, [0, -.0847, .011], None),
  'm4a4': ('AssaultRifle2_1', [7], {'mag': [4]}, [0, -.0787, .0311], None),
  'm4a1s': ('AssaultRifle2_2', [4], {'mag': [0]}, [0, -.0787, .0311], 'Silencer_1'),
  'famas': ('Bullpup_3', [10], {'mag': [0]}, [0, -.0959, -.1329], None),
  'ump': ('SubmachineGun_5', [39], {'mag': [16]}, [0, -.0861, .0112], None),
  'bucky': ('Shotgun_1', [4], {'pump': [9]}, [0, -.0795, .0532], None),
  'sniper': ('SniperRifle_3', [4], {'bolt': [3]}, [0, -.085, .02], None),
  'ssg': ('SniperRifle_2', [6], {'mag': [1], 'bolt': [5]}, [0, -.085, .02], None),
  'usps': ('Pistol_2', [3], {}, [0, -.09, .021], 'Silencer_Short'),
  'glock': ('Pistol_1', [18], {}, [0, -.0912, .0151], None),
  # Deagle: o ferrolho de cima (com miras, serrilhas e trilho) é separado para recuar no tiro; cano e armação ficam
  'pistol': ('Pistol_6', [1], {'slide': [7, 3, 4, 8, 17] + list(range(9, 17)) + list(range(18, 36))}, [0, -.09, .023], None),
}
def pts(parts): return [p['v'][i:i + 3] for p in parts for i in range(0, len(p['v']), 3)]
out, info = {}, {}
for k, (src, trig, tags, grip, acc) in SPEC.items():
    parts = G[src]; tv = pts([p for p in parts if p['comp'] in trig]); tc = [sum(v[j] for v in tv) / len(tv) for j in range(3)]
    zc = sum(v[2] for v in pts(parts)) / len(pts(parts)); target = [grip[0], grip[1] + .045, grip[2] - .035]
    # pack: cano em +x, largura em z  ->  jogo: cano em -z, largura em x (giro de 90° em y, sem espelhar)
    T = lambda v: [round((v[2] - zc) * S, 4), round((v[1] - tc[1]) * S + target[1], 4), round(-(v[0] - tc[0]) * S + target[2], 4)]
    tagof = {c: t for t, cs in tags.items() for c in cs}
    lst = []
    def add(p, tag=None, xf=T):
        V = []
        for i in range(0, len(p['v']), 3): V += xf(p['v'][i:i + 3])
        xs, ys, zs = V[0::3], V[1::3], V[2::3]
        lst.append([[min(xs), min(ys), min(zs)], [max(xs), max(ys), max(zs)], PAL.get(p['mat'], p['hex']), {'vertices': V, 'indices': p['i']}] + ([tag] if tag else []))
    for p in parts: add(p, tagof.get(p['comp']))
    allz = [v for e in lst for v in e[3]['vertices'][2::3]]; tip = min(allz)
    near = [(e[3]['vertices'][i], e[3]['vertices'][i + 1]) for e in lst if len(e) < 5 or e[4] != 'mag' for i in range(0, len(e[3]['vertices']), 3) if e[3]['vertices'][i + 2] < tip + .01]
    muzzle = [0, round(sum(v[1] for v in near) / len(near), 4), round(tip, 4)]
    if acc:  # silenciador do pack, encaixado na boca do cano (o fundo dele entra 0,1 no cano)
        A = G[acc]; ax = min(v[0] for v in pts(A)); ay = sum(v[1] for v in pts(A)) / len(pts(A))
        XA = lambda v: [round(v[2] * S, 4), round((v[1] - ay) * S + muzzle[1], 4), round(-(v[0] - ax - .1) * S + muzzle[2], 4)]
        for p in A: add(p, None, XA)
        muzzle = [0, muzzle[1], round(min(v for e in lst for v in e[3]['vertices'][2::3]), 4)]
    # cabo e guarda-mão medidos por fatias (o corpo cortado por um plano na altura da mão)
    tris = []
    for e in lst:
        if len(e) > 4: continue
        V, I = e[3]['vertices'], e[3]['indices']
        for t in range(0, len(I), 3): tris.append([V[3 * I[t + j]:3 * I[t + j] + 3] for j in range(3)])
    def cut(axis, val):
        r = []
        for tri in tris:
            for a2, b2 in ((0, 1), (1, 2), (2, 0)):
                p, q = tri[a2], tri[b2]
                if (p[axis] - val) * (q[axis] - val) < 0:
                    u = (val - p[axis]) / (q[axis] - p[axis]); r.append([p[j] + (q[j] - p[j]) * u for j in range(3)])
        return r
    def rect(ps):
        lo = [min(v[j] for v in ps) for j in range(3)]; hi = [max(v[j] for v in ps) for j in range(3)]
        return [round((lo[j] + hi[j]) / 2, 4) for j in range(3)], [round((hi[j] - lo[j]) / 2, 4) for j in range(3)], lo, hi
    ty, tz = target[1], target[2]; grips = {}
    gp = [v for v in cut(1, ty - .05) if tz - .015 < v[2] < tz + .11]
    if gp: c, h, lo, hi = rect(gp)
    if gp and h[2] > .008: grips['right'] = [[0, round(ty - .05, 4), c[2]], h[0], min(h[2], .045)]
    else:
        wp = [v for v in cut(2, tz + .07) if v[1] < ty + .04]
        if wp: c, h, lo, hi = rect(wp); grips['right'] = [[0, c[1], round(tz + .07, 4)], h[0], h[1], 'wrist']
    if not any(len(e) > 4 and e[4] == 'mag' for e in lst) and k in ('usps', 'glock', 'pistol'):
        # pente escondido dentro do cabo: do fundo do cabo até 7 cm acima, um pouco menor que o perfil do cabo
        gb = [v for v in cut(1, ty - .06) if tz - .015 < v[2] < tz + .11]
        c, h, lo, hi = rect(gb); bottom = min(v[1] for t in tris for v in t if tz - .015 < v[2] < tz + .11)
        lst.append([[-h[0] * .7, bottom + .003, c[2] - h[2] * .6], [h[0] * .7, bottom + .075, c[2] + h[2] * .6], 0x2a2a2c, None, 'mag'])
    mag = [e for e in lst if len(e) > 4 and e[4] == 'mag' and e[3]]
    if k not in ('usps', 'glock', 'pistol'):
        pump = [e for e in lst if len(e) > 4 and e[4] == 'pump']
        front = min(e[0][2] for e in mag) if mag else tz - .15
        zl = (min(e[0][2] for e in pump) + max(e[1][2] for e in pump)) / 2 if pump else front - .3 * (front - tip)
        if k in ('sniper', 'ssg'): zl = tz - .28
        hp = [v for v in cut(2, zl) if muzzle[1] - .09 < v[1] < muzzle[1] + .025]
        if pump: hp += [v for e in pump for v in (e[0], e[1])]
        if hp: c, h, lo, hi = rect(hp); grips['left'] = [[0, c[1], round(zl, 4)], h[1], h[0]]
    info[k] = {'src': src, 'muzzle': muzzle, 'acc': acc, 'grips': grips}
    out[k] = lst
js = ('// Gerado por tools/pack/build_guns.py: Ultimate Gun Pack by Quaternius (CC0), https://quaternius.com\n'
      '// Peças: [mínimo, máximo, cor, {vertices, indices}, marca do rig]; info: modelo de origem, boca do cano, pegadas.\n'
      'globalThis.PACK_GUNS = ' + json.dumps(out, separators=(',', ':')) + ';\n'
      'globalThis.PACK_GUN_INFO = ' + json.dumps(info, separators=(',', ':')) + ';\n'
      'globalThis.PACK_PAL = ' + json.dumps(PAL, separators=(',', ':')) + ';\n')
open(os.path.join(ROOT, 'assets/models/guns-pack.js'), 'w').write(js)
for k, v in info.items(): print(k, v['src'], 'muzzle', v['muzzle'], {g: [x if not isinstance(x, list) else [round(y, 3) for y in x] for x in val] for g, val in v['grips'].items()}, sum(len(e[3]['indices']) // 3 for e in out[k] if e[3]), 'tris')
print(len(js), 'bytes')
