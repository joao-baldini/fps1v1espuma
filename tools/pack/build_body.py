"""Converte o low_poly_male_base.glb (wh_nerevar, CC-BY-4.0) nas peças do rig dos bonecos do jogo.

Uso: python3 tools/pack/build_body.py <low_poly_male_base.glb>  ->  assets/agents/body-base.js

- Vira o boneco para a frente do jogo (-Z) com 1,80 m e as pernas com o quadril a 0,81 m (pivô do rig).
- Separa cabeça, tronco (com pescoço), quadril, pernas inteiras e coxa/canela/pé normalizados para o passo articulado.
- Braços: o modelo vem em pose A. Cada braço é reposicionado por skinning de três ossos (tronco, braço, antebraço) com
  IK de dois ossos até o ponto da mão que segura a arma; as mãos abertas do modelo saem (o jogo põe a luva fechada).
- Cada triângulo leva uma região (pele, camisa, manga, calça, bota) que o jogo pinta com as cores do operador.
"""
import json, struct, sys, os
import numpy as np

SKIN, CLOTH, CLOTH2, PANTS, BOOT = range(5)
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'agents', 'body-base.js')


def load(path):
    f = open(path, 'rb').read()
    n = struct.unpack('<I', f[12:16])[0]; J = json.loads(f[20:20 + n]); B = f[20 + n + 8:]
    def acc(i):
        a = J['accessors'][i]; bv = J['bufferViews'][a['bufferView']]; o = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
        k = {'SCALAR': 1, 'VEC3': 3}[a['type']]; dt = {5126: np.float32, 5123: np.uint16, 5125: np.uint32}[a['componentType']]
        r = np.frombuffer(B, dtype=dt, count=a['count'] * k, offset=o); return r.reshape(-1, k) if k > 1 else r
    M = np.eye(4)
    for ni in (0, 1, 2, 3):
        if 'matrix' in J['nodes'][ni]: M = M @ np.array(J['nodes'][ni]['matrix']).reshape(4, 4).T
    pr = J['meshes'][0]['primitives'][0]
    P = acc(pr['attributes']['POSITION']).astype(float); I = acc(pr['indices']).astype(int)
    W = (np.c_[P, np.ones(len(P))] @ M.T)[:, :3]
    W -= [(W[:, 0].min() + W[:, 0].max()) / 2, W[:, 1].min(), (W[:, 2].min() + W[:, 2].max()) / 2]
    W *= 1.8 / W[:, 1].max()
    W *= [-1, 1, -1]                      # frente para -Z (giro de 180° em Y: a ordem dos vértices se mantém)
    # solda os vértices repetidos (o GLB vem sem índice compartilhado)
    key = np.round(W, 5); U, inv = np.unique(key, axis=0, return_inverse=True)
    return U, inv.reshape(-1)[I].reshape(-1, 3)


def remap_y(y):
    # pernas: virilha 0,86 -> 0,81 (pivô do quadril no rig); tronco e cabeça esticam até 1,795
    return np.where(y < .86, y * .81 / .86, .81 + (y - .86) * (1.795 - .81) / (1.8 - .86))


def rot_from_to(a, b):
    a = a / np.linalg.norm(a); b = b / np.linalg.norm(b); v = np.cross(a, b); c = a @ b
    if c < -.9999: return -np.eye(3)
    K = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3) + K + K @ K / (1 + c)


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)


def seg_param(P, A, B):
    d = B - A; t = ((P - A) @ d) / (d @ d)
    q = A + np.clip(t, 0, 1)[:, None] * d
    return t, np.linalg.norm(P - q, axis=1)


def ik(S, T, L1, L2, pole):
    d = T - S; D = np.linalg.norm(d); u = d / D
    k = 1.0
    # braço curto do modelo: estica até 18% para alcançar a pegada mantendo o cotovelo dobrado
    if D > (L1 + L2) * .93: k = min(1.18, D / ((L1 + L2) * .93)); L1 *= k; L2 *= k
    if D > (L1 + L2) * .999: T = S + u * (L1 + L2) * .999; D = (L1 + L2) * .999
    a = (L1 * L1 - L2 * L2 + D * D) / (2 * D); h = np.sqrt(max(L1 * L1 - a * a, 0))
    p = pole - S; p = p - (p @ u) * u; p /= np.linalg.norm(p)
    return S + u * a + p * h, k


def main(src):
    V, F = load(src)
    # juntas medidas no modelo (lado +X = direito do boneco); y ainda na escala original
    J = {'S': np.array([.20, 1.42, .02]), 'E': np.array([.355, 1.21, .02]), 'W': np.array([.475, 1.06, .02])}
    V0 = V.copy()
    V = V.copy(); V[:, 1] = remap_y(V[:, 1]); V[:, 2] -= .013
    for k in J: J[k] = J[k].copy(); J[k][1] = remap_y(J[k][1]); J[k][2] -= .013

    # ---------- braços: pesos (tronco / braço / antebraço) e mão ----------
    n = len(V); wU = np.zeros(n); wF = np.zeros(n); hand = np.zeros(n, bool); side = np.sign(V[:, 0])
    arms = {}
    targets = {  # mão (ponto da pegada) e cotovelo de referência da pose antiga, por lado
        1: (np.array([.165, 1.215, -.115]), np.array([.315, 1.15, -.025]), np.array([.46, 1.0, .06])),
        -1: (np.array([.105, 1.25, -.405]), np.array([-.275, 1.16, -.19]), np.array([-.3, .85, -.2])),
    }
    for sg in (1, -1):
        S, E, Wr = (J[k] * [sg, 1, 1] for k in 'SEW')
        P = V * [1, 1, 1]
        t1, d1 = seg_param(P, S, E); t2, d2 = seg_param(P, E, Wr)
        mine = side == sg
        arm = mine & (np.minimum(d1, d2) < np.where(t1 < .25, .1, .085)) & (t1 > -.25) & (np.abs(V[:, 0]) > .12)
        u = smooth(-.12, .28, t1) * arm                     # ombro: transição suave tronco -> braço
        f = smooth(-.05, .05, t2) * arm                     # cotovelo quase rígido (dobra grande demais para mistura)
        wF[mine] = (u * f)[mine]; wU[mine] = (u * (1 - f))[mine]
        # mão: tudo além do pulso perto do prolongamento do antebraço (os dedos ficam longe do segmento)
        dW = (Wr - E) / np.linalg.norm(Wr - E); q = P - Wr; along = q @ dW; perp = np.linalg.norm(q - along[:, None] * dW, axis=1)
        hand |= mine & (along > .025) & (along < .32) & (perp < .16) & (np.abs(V[:, 0]) > .3)
        grip, eref, pole = targets[sg]
        dirH = (grip - eref) / np.linalg.norm(grip - eref); wristT = grip - dirH * .05
        L1 = np.linalg.norm(E - S); L2 = np.linalg.norm(Wr - E)
        E2, k = ik(S, wristT, L1, L2, pole)
        RU = rot_from_to(E - S, E2 - S); RF = rot_from_to(Wr - E, wristT - E2)
        arms[sg] = dict(S=S, E=E, RU=RU, RF=RF, E2=E2, k=k, wrist=wristT, grip=grip, dir=dirH)
    newV = V.copy()
    for sg, a in arms.items():
        m = side == sg
        P = V[m]; S, E = a['S'], a['E']
        pu = (P - S) @ a['RU'].T * a['k'] + S                              # osso do braço (gira no ombro)
        pf = (P - E) @ a['RF'].T * a['k'] + a['E2']                        # osso do antebraço (gira no cotovelo)
        w0 = 1 - wU[m] - wF[m]
        newV[m] = P * w0[:, None] + pu * wU[m][:, None] + pf * wF[m][:, None]

    # ---------- regiões e peças ----------
    C = V0[F].mean(1)                                       # centróide na escala original (para cortar)
    yo = C[:, 1]; ax = np.abs(C[:, 0])
    tri_hand = hand[F].any(1)
    tri_arm = ((wU + wF)[F].max(1) > .5)
    tri_fore = (wF[F].mean(1) > .5)
    head = (yo > 1.545) & ~tri_arm
    neck = (V0[F][:, :, 1].min(1) > 1.47) & (yo <= 1.545) & (ax < .09) & ~tri_arm
    torso = (yo >= .95) & ~head & ~tri_hand
    pelvis = (yo >= .82) & (yo < .95) & ~tri_arm & ~tri_hand & (ax < .3)
    legs = (yo < .86) & ~tri_arm & ~tri_hand & (ax < .3)
    region = np.full(len(F), CLOTH)
    region[tri_arm & tri_fore] = CLOTH2
    region[head | neck] = SKIN
    region[pelvis | legs] = PANTS
    region[legs & (yo < .14)] = BOOT

    def pack(mask, verts, xform=lambda p: p):
        T = xform(verts[F[mask]].reshape(-1, 3)).reshape(-1, 3)
        return {'p': [int(round(v * 10000)) for v in T.reshape(-1)], 'r': [int(r) for r in region[mask]]}

    # cabeça: centrada em Z e um pouco mais larga (o rosto do modelo é estreito para o capacete e os óculos do jogo)
    hz = newV[F[head]].reshape(-1, 3)[:, 2]; hzc = (hz.min() + hz.max()) / 2
    HEAD_S = np.array([1.2, 1.0, 1.12])
    def head_x(p):
        c = np.array([0, 1.66, hzc]); return (p - c) * HEAD_S + [0, 1.66, 0]
    out = {'head': pack(head, newV, head_x), 'body': pack((torso | neck) & ~head, newV), 'hip': pack(pelvis, newV)}

    # pernas inteiras (centradas no pivô x = ±0,11; o jogo soma o deslocamento da perna)
    for name, sg in (('legL', -1), ('legR', 1)):
        m = legs & (np.sign(C[:, 0]) == sg)
        out[name] = pack(m, newV, lambda p, sg=sg: p - [sg * .11, 0, 0])
    # coxa, canela e pé do passo articulado: um só lado (o modelo é simétrico), alinhados à linha das juntas
    hipJ = np.array([.10, .81, 0]); kneeJ = np.array([.11, remap_y(.47), .02]); ankJ = np.array([.13, remap_y(.10), .03])
    def segment(lo, hi, top, bot, sxz):
        m = legs & (C[:, 0] > 0) & (newV[F][:, :, 1].max(1) > lo) & (newV[F][:, :, 1].min(1) < hi)
        def x(p):
            t = (p[:, 1] - bot[1]) / (top[1] - bot[1])
            axis = bot + t[:, None] * (top - bot)
            q = p - axis; q[:, 1] = t * .81
            return q / [sxz[0], 1, sxz[1]]
        return pack(m, newV, x)
    out['segThigh'] = segment(kneeJ[1] - .02, .86, hipJ, kneeJ, (1, 1))
    out['segShin'] = segment(ankJ[1] - .02, kneeJ[1] + .03, kneeJ, ankJ, (.86, .86))
    mfoot = legs & (C[:, 0] > 0) & (newV[F][:, :, 1].max(1) < .2)   # só o pé (até o tornozelo); a canela vai na peça dela
    ftop = newV[F[mfoot]][:, :, 1].max()
    def foot(p):
        # o jogo desenha o pé com 0,11 m de altura (escala .11/.81): o pé inteiro cabe nessa altura
        q = p - [ankJ[0], 0, ankJ[2] - .035]; q[:, 1] = q[:, 1] / ftop * .81
        return q / [1.05, 1, 1.3]
    out['segBoot'] = pack(mfoot, newV, foot)
    out['arms'] = {('R' if sg > 0 else 'L'): {'shoulder': [round(v, 4) for v in a['S']], 'elbow': [round(v, 4) for v in a['E2']],
                   'wrist': [round(v, 4) for v in a['wrist']], 'k': round(a['k'], 3), 'grip': [round(v, 4) for v in a['grip']], 'dir': [round(v, 4) for v in a['dir']]} for sg, a in arms.items()}
    out['headScale'] = [round(v, 3) for v in HEAD_S]
    tris = {k: len(v['r']) for k, v in out.items() if isinstance(v, dict) and 'r' in v}
    with open(OUT, 'w') as fh:
        fh.write('// Gerado por tools/pack/build_body.py a partir de "Low Poly Male Base" de wh_nerevar (Sketchfab), licença CC-BY-4.0:\n'
                 '// https://sketchfab.com/wh_nerevar. Posições em décimos de milímetro; r = região de cor por triângulo\n'
                 '// (0 pele, 1 camisa, 2 manga, 3 calça, 4 bota).\n')
        fh.write('globalThis.BODY_BASE = ' + json.dumps(out, separators=(',', ':')) + ';\n')
    print(tris, os.path.getsize(OUT), 'bytes')
    print(json.dumps(out['arms']))


if __name__ == '__main__':
    main(sys.argv[1])
