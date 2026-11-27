"""Low-poly erőmű (négyzet alaprajz, 10x10 m) -> assets/powerplant.glb + powerplant.blend
Futtatás: blender -b -P scripts/make_powerplant.py
Origó: az alaprajz közepe a talajszinten (mint a factory.glb). Blenderben Z fel, a GLB exportnál Y fel.
"""
import bpy, bmesh, math, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets")
os.makedirs(OUT, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
col = bpy.context.scene.collection


def mat(name, color, rough=0.8, metal=0.0, emit=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = 1.5
    return m


M_CONC = mat("Concrete", (0.45, 0.45, 0.46))
M_HALL = mat("Hall_Panel", (0.62, 0.64, 0.68), 0.6, 0.3)
M_BOILER = mat("Boiler_Steel", (0.35, 0.38, 0.42), 0.5, 0.6)
M_TOWER = mat("Cooling_Concrete", (0.72, 0.72, 0.70), 0.9)
M_STACK = mat("Stack_Concrete", (0.6, 0.58, 0.55))
M_RED = mat("Stack_Red", (0.75, 0.12, 0.10))
M_GLASS = mat("Window_Glass", (0.35, 0.65, 0.85), 0.2, 0.0, emit=(0.3, 0.55, 0.8))
M_PIPE = mat("Pipe_Steel", (0.5, 0.5, 0.55), 0.4, 0.8)
M_STRIPE = mat("Hazard_Yellow", (0.95, 0.75, 0.05))
M_DOOR = mat("Door_Metal", (0.15, 0.35, 0.55), 0.5, 0.5)
M_TRAFO = mat("Transformer", (0.2, 0.45, 0.25), 0.6, 0.4)


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


def cyl(name, r, h, loc, m, verts=12, r2=None):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=verts, radius1=r, radius2=r if r2 is None else r2, depth=h)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    o.location = loc
    o.data.materials.append(m)
    col.objects.link(o)
    return o


def tower(name, profile, loc, m, seg=16):
    """Forgástest: profile = [(sugár, z), ...] alulról felfelé, nyitott felső szájjal."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    rings = []
    for r, z in profile:
        rings.append([bm.verts.new((r * math.cos(2 * math.pi * i / seg), r * math.sin(2 * math.pi * i / seg), z))
                      for i in range(seg)])
    for a, b in zip(rings, rings[1:]):
        for i in range(seg):
            j = (i + 1) % seg
            bm.faces.new((a[i], a[j], b[j], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    o.location = loc
    o.data.materials.append(m)
    col.objects.link(o)
    return o


S = 10.0
h2 = S / 2
B = 0.3  # alap magassága

# alap
box("Foundation", (S + 1.0, S + 1.0, B), (0, 0, B / 2), M_CONC)

# turbinacsarnok (előoldal, -Y)
HALL_H = 4.5
box("TurbineHall", (9.6, 4.0, HALL_H), (0, -2.9, B + HALL_H / 2), M_HALL)
box("HallRoof", (9.8, 4.2, 0.25), (0, -2.9, B + HALL_H + 0.12), M_BOILER)
for xx in (-3.6, -1.2, 1.2, 3.6):
    box("HallWindow", (1.4, 0.08, 1.0), (xx, -4.92, B + 3.2), M_GLASS)
box("HallGate", (2.6, 0.12, 2.8), (0, -4.94, B + 1.4), M_DOOR)
box("HallGateStripe", (2.8, 0.14, 0.2), (0, -4.95, B + 2.9), M_STRIPE)

# kazánház (hátul balra)
BOIL_H = 9.0
box("BoilerHouse", (4.5, 4.5, BOIL_H), (-2.5, 2.4, B + BOIL_H / 2), M_BOILER)
for k in range(3):
    box("BoilerBand", (4.6, 4.6, 0.25), (-2.5, 2.4, B + 2.2 + k * 2.6), M_CONC)
box("BoilerWindowL", (0.08, 2.0, 1.0), (-4.78, 2.4, B + 6.5), M_GLASS)

# magas kémény a kazánház tetején, piros sávokkal
STACK_H = 8.0
sb = B + BOIL_H
cyl("Stack", 0.55, STACK_H, (-2.5, 2.4, sb + STACK_H / 2), M_STACK, 12, r2=0.4)
for k in range(2):
    cyl("StackBand", 0.5 - k * 0.04, 0.8, (-2.5, 2.4, sb + STACK_H - 1.0 - k * 2.0), M_RED, 12)
cyl("StackCap", 0.5, 0.2, (-2.5, 2.4, sb + STACK_H + 0.1), M_CONC, 12)

# hűtőtorony (hátul jobbra): hiperboloid profil
TOWER_H = 8.0
prof = []
n = 9
for i in range(n + 1):
    t = i / n
    r = 2.1 - 0.9 * math.sin(math.pi * t * 0.85) + 0.15 * t * t
    prof.append((r, t * TOWER_H))
tower("CoolingTower", prof, (2.75, 2.6, B), M_TOWER)
cyl("TowerRim", prof[-1][0] + 0.05, 0.2, (2.75, 2.6, B + TOWER_H - 0.1), M_CONC, 16)

# csővezeték a kazán és a csarnok között, plusz a hűtőtoronyhoz
p1 = cyl("PipeV", 0.22, 4.0, (-1.2, 0.2, B + 3.3), M_PIPE, 8)
p2 = cyl("PipeH", 0.22, 4.2, (0.9, 0.2, B + 1.3), M_PIPE, 8)
p2.rotation_euler[1] = math.radians(90)
cyl("PipeToTower", 0.22, 2.8, (0.6, 1.8, B + 0.5), M_PIPE, 8).rotation_euler[0] = math.radians(90)

# transzformátorok az oldalon
for yy in (-1.6, -3.6):
    box("Transformer", (1.2, 1.4, 1.6), (4.3, yy, B + 0.8), M_TRAFO)
    box("TrafoTop", (1.0, 1.2, 0.25), (4.3, yy, B + 1.7), M_PIPE)

# egyesítés
bpy.ops.object.select_all(action="DESELECT")
objs = [o for o in col.objects if o.type == "MESH"]
for o in objs:
    o.select_set(True)
bpy.context.view_layer.objects.active = objs[0]
bpy.ops.object.join()
f = bpy.context.active_object
f.name = "PowerPlant"
f.data.name = "PowerPlant"
bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
bpy.ops.object.shade_flat()

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "powerplant.blend"))
bpy.ops.export_scene.gltf(
    filepath=os.path.join(OUT, "powerplant.glb"),
    export_format="GLB",
    export_yup=True,
    export_apply=True,
)
print("DONE", len(f.data.polygons), "faces", [round(x, 2) for x in f.dimensions])
