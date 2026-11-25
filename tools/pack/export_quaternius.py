# Exporta as armas do Ultimate Gun Pack (Quaternius, CC0) para JSON: por arma, peças = partes soltas da malha
# (cada pedaço fechado: pente, ferrolho, telha...) separadas por material, com cores sRGB e Y para cima.
# Uso: python (com bpy 4.2) export_quaternius.py -- <pasta Blends> <saida.json>
import bpy, bmesh, sys, os, json, glob
src, dst = sys.argv[-2], sys.argv[-1]
def srgb(v): return round(255 * ((12.92 * v) if v <= 0.0031308 else (1.055 * v ** (1 / 2.4) - .055)))
out = {}
for path in sorted(glob.glob(os.path.join(src, '*.blend')) + glob.glob(os.path.join(src, 'Accessories', '*.blend'))):
    bpy.ops.wm.open_mainfile(filepath=path)
    name = os.path.splitext(os.path.basename(path))[0]; parts = []
    for o in bpy.data.objects:
        if o.type != 'MESH': continue
        M = o.matrix_world; bm = bmesh.new(); bm.from_mesh(o.data); bmesh.ops.triangulate(bm, faces=bm.faces[:])
        bm.faces.ensure_lookup_table(); comp = {}; cid = 0
        for f in bm.faces:
            if f.index in comp: continue
            stack = [f]; comp[f.index] = cid
            while stack:
                g = stack.pop()
                for e in g.edges:
                    for h in e.link_faces:
                        if h.index not in comp: comp[h.index] = cid; stack.append(h)
            cid += 1
        cols = []
        for m in o.data.materials:
            b = m.node_tree.nodes.get('Principled BSDF') if m and m.use_nodes else None
            c = b.inputs['Base Color'].default_value if b else (m.diffuse_color if m else (.5, .5, .5, 1))
            cols.append((srgb(c[0]) << 16) | (srgb(c[1]) << 8) | srgb(c[2]))
        groups = {}
        for f in bm.faces: groups.setdefault((comp[f.index], f.material_index), []).append(f)
        for (c, mi), fs in groups.items():
            V, I, idx = [], [], {}
            for f in fs:
                for v in f.verts:
                    if v.index not in idx:
                        idx[v.index] = len(idx); w = M @ v.co; V += [round(w.x, 5), round(w.z, 5), round(-w.y, 5)]
                    I.append(idx[v.index])
            parts.append({'comp': c, 'hex': cols[mi] if cols else 0x808080, 'mat': o.data.materials[mi].name if o.data.materials else '', 'v': V, 'i': I})
        bm.free()
    out[name] = parts
json.dump(out, open(dst, 'w'))
for k, ps in out.items():
    xs = [v for p in ps for v in p['v'][0::3]]; ys = [v for p in ps for v in p['v'][1::3]]; zs = [v for p in ps for v in p['v'][2::3]]
    print(k, 'comps', len({p['comp'] for p in ps}), 'tris', sum(len(p['i']) // 3 for p in ps), 'x', round(min(xs), 2), round(max(xs), 2), 'y', round(min(ys), 2), round(max(ys), 2), 'z', round(min(zs), 2), round(max(zs), 2))
