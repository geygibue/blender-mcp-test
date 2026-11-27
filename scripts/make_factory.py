"""Low-poly gyár (négyzet alaprajz, 10x10 m) -> assets/factory.glb + factory.blend
Futtatás: blender -b -P scripts/make_factory.py
Origó: az alaprajz közepe a talajszinten. Blenderben Z fel, a GLB exportnál Y fel.
"""
import bpy, bmesh, math, os
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets")
os.makedirs(OUT, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
col = bpy.context.scene.collection


def mat(name, color, rough=0.8, metal=0.0, emit=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = 1.5
    return m


M_WALL = mat("Wall_Brick", (0.55, 0.28, 0.20))
M_CONC = mat("Concrete", (0.45, 0.45, 0.46))
M_ROOF = mat("Roof_Metal", (0.25, 0.30, 0.35), 0.5, 0.6)
M_DOOR = mat("Door_Metal", (0.15, 0.35, 0.55), 0.5, 0.5)
M_GLASS = mat("Window_Glass", (0.35, 0.65, 0.85), 0.2, 0.0, emit=(0.3, 0.55, 0.8))
M_STACK = mat("Chimney_Brick", (0.4, 0.2, 0.15))
M_STRIPE = mat("Hazard_Yellow", (0.95, 0.75, 0.05))
M_PIPE = mat("Pipe_Steel", (0.5, 0.5, 0.55), 0.4, 0.8)


def box(name, size, loc, m):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    o.scale = size
    o.location = loc
    o.data.materials.append(m)
    col.objects.link(o)
    return o


def cyl(name, r, h, loc, m, verts=12):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=verts, radius1=r, radius2=r, depth=h)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    o.location = loc
    o.data.materials.append(m)
    col.objects.link(o)
    return o


S = 10.0          # alaprajz oldala
H = 5.0           # fal magasság
h2 = S / 2

# alap + fő épület
box("Foundation", (S + 1.0, S + 1.0, 0.3), (0, 0, 0.15), M_CONC)
box("Walls", (S, S, H), (0, 0, 0.3 + H / 2), M_WALL)
# szegély a tetőn
box("Cornice", (S + 0.4, S + 0.4, 0.3), (0, 0, 0.3 + H + 0.15), M_CONC)

# fűrészfogas tető (4 sáv, X irányban)
y0 = 0.3 + H + 0.3
n = 4
w = S / n
for i in range(n):
    cy = -h2 + w * (i + 0.5)
    me = bpy.data.meshes.new(f"RoofTooth{i}")
    bm = bmesh.new()
    L = S - 0.4
    pts = [(-L / 2, -w / 2, 0), (L / 2, -w / 2, 0), (L / 2, w / 2, 0), (-L / 2, w / 2, 0),
           (-L / 2, -w / 2, 1.8), (L / 2, -w / 2, 1.8)]
    v = [bm.verts.new(p) for p in pts]
    bm.faces.new((v[0], v[1], v[2], v[3]))      # alj
    bm.faces.new((v[0], v[4], v[5], v[1]))      # függőleges (ablakos oldal)
    bm.faces.new((v[4], v[3], v[2], v[5]))      # ferde tető
    bm.faces.new((v[0], v[3], v[4]))            # oldal
    bm.faces.new((v[1], v[5], v[2]))            # oldal
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(f"RoofTooth{i}", me)
    o.location = (0, cy, y0)
    o.data.materials.append(M_ROOF)
    col.objects.link(o)
    # ablaksáv a függőleges oldalon
    box(f"RoofGlass{i}", (S - 1.2, 0.08, 1.2), (0, cy - w / 2 - 0.02, y0 + 0.9), M_GLASS)

# kémények
for i, (x, y, hh) in enumerate([(3.2, 3.2, 5.5), (2.0, 3.2, 4.2)]):
    base = 0.3 + H
    cyl(f"Chimney{i}", 0.5 if i == 0 else 0.4, hh, (x, y, base + hh / 2), M_STACK)
    cyl(f"ChimneyCap{i}", 0.6 if i == 0 else 0.5, 0.25, (x, y, base + hh + 0.12), M_CONC)
    cyl(f"ChimneyStripe{i}", 0.52 if i == 0 else 0.42, 0.3, (x, y, base + hh - 0.6), M_STRIPE)

# előoldal = -Y : nagy ipari kapu + rámpa
box("GateFrame", (4.0, 0.2, 3.6), (0, -h2 - 0.02, 0.3 + 1.8), M_CONC)
box("Gate", (3.6, 0.15, 3.3), (0, -h2 - 0.1, 0.3 + 1.65), M_DOOR)
for k in range(5):
    box(f"GateRib{k}", (3.6, 0.05, 0.08), (0, -h2 - 0.2, 0.7 + k * 0.6), M_PIPE)
box("LoadingRamp", (5.0, 2.0, 0.3), (0, -h2 - 1.2, 0.15), M_CONC)
box("RampStripe", (5.0, 0.2, 0.32), (0, -h2 - 2.1, 0.16), M_STRIPE)

# ablakok az oldalfalakon (±X és +Y)
for sx in (-1, 1):
    for yy in (-2.5, 0, 2.5):
        box("WinX", (0.1, 1.4, 1.2), (sx * (h2 + 0.0), yy, 3.4), M_GLASS)
        box("WinFrameX", (0.14, 1.6, 1.4), (sx * (h2 - 0.01), yy, 3.4), M_CONC)
for xx in (-3, -1, 1, 3):
    box("WinY", (1.2, 0.1, 1.0), (xx, h2, 3.4), M_GLASS)

# oldalsó kis ajtó (+X, elöl)
box("SideDoor", (0.12, 1.0, 2.2), (h2 + 0.03, -3.8, 0.3 + 1.1), M_DOOR)

# csövek a hátsó falon
cyl_p = cyl("Pipe1", 0.15, H - 0.5, (-3.5, h2 + 0.25, 0.3 + (H - 0.5) / 2), M_PIPE, 8)
cyl_p2 = cyl("Pipe2", 0.15, H - 0.5, (-3.0, h2 + 0.25, 0.3 + (H - 0.5) / 2), M_PIPE, 8)
p3 = cyl("PipeH", 0.15, 3.0, (-3.25, h2 + 0.25, 0.3 + 3.8), M_PIPE, 8)
p3.rotation_euler[1] = math.radians(90)
p3.scale = (1, 1, 0.17)

# egyesítés egy objektummá anyagonként megtartva
bpy.ops.object.select_all(action="DESELECT")
objs = [o for o in col.objects if o.type == "MESH"]
for o in objs:
    o.select_set(True)
bpy.context.view_layer.objects.active = objs[0]
bpy.ops.object.join()
f = bpy.context.active_object
f.name = "Factory"
f.data.name = "Factory"
bpy.ops.object.origin_set(type="ORIGIN_CURSOR")  # kurzor = (0,0,0)
bpy.ops.object.shade_flat()

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "factory.blend"))
bpy.ops.export_scene.gltf(
    filepath=os.path.join(OUT, "factory.glb"),
    export_format="GLB",
    export_yup=True,
    export_apply=True,
)
print("DONE", len(f.data.polygons), "faces")
