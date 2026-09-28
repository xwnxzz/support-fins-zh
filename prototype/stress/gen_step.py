#!/usr/bin/env python3
"""Generate our own STEP (ISO 10303-21) fixtures for the import tests.

STEP is a B-rep format: these files describe SURFACES, not triangles. Each face here is
a PLANE plus a POLY_LOOP, and the solid is declared as a FACETED_BREP -- the canonical
faceted subset every CAD kernel reads. That is enough to exercise what the app cares
about, without shipping somebody else's test files:

  * box.step        -- 20x20x10 box on the bed (a known bounding box)
  * plate.step      -- 60x40x6 plate tilted 30 degrees: a real overhang, in millimetres
  * plate-inch.step -- the SAME part declared in INCHES. It has to import at the same mm
                       size; that is what pins the unit handling in web/step.js.
  * ball.step       -- a faceted sphere bottom: the round-rim case from
                       tests/round_validation.test.js, this time arriving through STEP.

Frame is the tool's own: Z up, millimetres, bed plane z = 0. The loader seats the part
afterwards exactly as it does for an STL.

    python prototype/stress/gen_step.py        # writes prototype/stress/step/
"""
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "step")


# ------------------------------------------------------------------ tiny STEP writer
class Step:
    """Writes a minimal AP203 file: header, units, one faceted solid, shape link."""

    def __init__(self, product, unit, schema="CONFIG_CONTROL_DESIGN"):
        self.lines = []
        self.next = 1
        self.product = product
        self.unit = unit                  # 'mm' or 'inch'
        self.schema = schema

    def add(self, text):
        i = self.next
        self.next += 1
        self.lines.append(f"#{i} = {text};")
        return i

    def point(self, p):
        return self.add(f"CARTESIAN_POINT('',({p[0]:.6f},{p[1]:.6f},{p[2]:.6f}))")

    def direction(self, d):
        return self.add(f"DIRECTION('',({d[0]:.9f},{d[1]:.9f},{d[2]:.9f}))")

    def face(self, points, normal):
        """One planar face: PLANE + POLY_LOOP, wound to agree with the outward normal."""
        pts = orient(points, normal)
        ids = [self.point(p) for p in pts]
        n = self.direction(normal)
        xref = self.direction(perp(normal))
        place = self.add(f"AXIS2_PLACEMENT_3D('',#{ids[0]},#{n},#{xref})")
        plane = self.add(f"PLANE('',#{place})")
        loop = self.add(f"POLY_LOOP('',({','.join('#' + str(i) for i in ids)}))")
        bound = self.add(f"FACE_OUTER_BOUND('',#{loop},.T.)")
        return self.add(f"ADVANCED_FACE('',(#{bound}),#{plane},.T.)")

    def length_unit(self):
        if self.unit == "inch":
            mm = self.add("( LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.) )")
            exp = self.add("DIMENSIONAL_EXPONENTS(1.,0.,0.,0.,0.,0.,0.)")
            conv = self.add(f"MEASURE_WITH_UNIT(LENGTH_MEASURE(25.4),#{mm})")
            return self.add("( CONVERSION_BASED_UNIT('INCH',"
                            f"#{conv}) LENGTH_UNIT() NAMED_UNIT(#{exp}) )")
        return self.add("( LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.) )")

    def render(self, face_ids):
        """Assemble the whole file. Entity order inside DATA is as written; STEP
        forward-references freely, so the scaffold can come first for readability."""
        app = self.add("APPLICATION_CONTEXT('configuration controlled 3d designs of "
                       "mechanical parts and assemblies')")
        self.add("APPLICATION_PROTOCOL_DEFINITION('international standard',"
                 f"'config_control_design',1994,#{app})")
        pctx = self.add(f"PRODUCT_CONTEXT('',#{app},'mechanical')")
        prod = self.add(f"PRODUCT('{self.product}','{self.product}','',(#{pctx}))")
        pdf = self.add(f"PRODUCT_DEFINITION_FORMATION('','',#{prod})")
        pdc = self.add(f"PRODUCT_DEFINITION_CONTEXT('part definition',#{app},'design')")
        pd = self.add(f"PRODUCT_DEFINITION('design','',#{pdf},#{pdc})")
        pds = self.add(f"PRODUCT_DEFINITION_SHAPE('','',#{pd})")

        length = self.length_unit()
        angle = self.add("( NAMED_UNIT(*) PLANE_ANGLE_UNIT() SI_UNIT($,.RADIAN.) )")
        sr = self.add("( NAMED_UNIT(*) SI_UNIT($,.STERADIAN.) SOLID_ANGLE_UNIT() )")
        unc = self.add(f"UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-07),#{length},"
                       "'distance_accuracy_value','')")
        ctx = self.add("( GEOMETRIC_REPRESENTATION_CONTEXT(3) "
                       f"GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#{unc})) "
                       f"GLOBAL_UNIT_ASSIGNED_CONTEXT((#{length},#{angle},#{sr})) "
                       "REPRESENTATION_CONTEXT('','') )")

        refs = ",\n  ".join(f"#{i}" for i in face_ids)
        shell = self.add(f"CLOSED_SHELL('',(\n  {refs}))")
        brep = self.add(f"FACETED_BREP('{self.product}',#{shell})")
        rep = self.add(f"FACETED_BREP_SHAPE_REPRESENTATION('{self.product}',"
                       f"(#{brep}),#{ctx})")
        self.add(f"SHAPE_DEFINITION_REPRESENTATION(#{pds},#{rep})")

        return (
            "ISO-10303-21;\n"
            "HEADER;\n"
            "FILE_DESCRIPTION((''),'2;1');\n"
            f"FILE_NAME('{self.product}.step','2026-01-01T00:00:00',(''),(''),"
            "'prototype/stress/gen_step.py','support-fins','');\n"
            f"FILE_SCHEMA(('{self.schema}'));\n"
            "ENDSEC;\n"
            "DATA;\n"
            + "\n".join(self.lines) + "\n"
            "ENDSEC;\n"
            "END-ISO-10303-21;\n")


# ------------------------------------------------------------------ geometry helpers
def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def norm(a):
    m = math.sqrt(sum(c * c for c in a)) or 1.0
    return (a[0] / m, a[1] / m, a[2] / m)


def perp(n):
    """Any unit vector perpendicular to n (used as the plane's +X reference)."""
    a = (0.0, 0.0, 1.0) if abs(n[2]) < 0.9 else (1.0, 0.0, 0.0)
    return norm(cross(n, a))


def orient(points, normal):
    """Wind `points` so their right-hand normal agrees with `normal`."""
    got = cross(sub(points[1], points[0]), sub(points[2], points[0]))
    return list(reversed(points)) if sum(g * n for g, n in zip(got, normal)) < 0 else list(points)


def flat_loop(points, normal):
    """Order a convex planar face's points into a simple loop around its centroid."""
    c = tuple(sum(p[k] for p in points) / len(points) for k in range(3))
    u = perp(normal)
    v = norm(cross(normal, u))
    return sorted(points, key=lambda p: math.atan2(
        sum((p[k] - c[k]) * v[k] for k in range(3)),
        sum((p[k] - c[k]) * u[k] for k in range(3))))


def prism_faces(corners, basis):
    """Six faces of a box whose corners are already in world space and whose
    outward normals are the given (rotated) axis directions."""
    faces = []
    for axis, sign in ((0, -1), (0, 1), (1, -1), (1, 1), (2, -1), (2, 1)):
        n = basis[axis] if sign > 0 else tuple(-c for c in basis[axis])
        proj = [sum(p[k] * n[k] for k in range(3)) for p in corners]
        target = max(proj) if sign > 0 else min(proj)
        sel = [p for p, v in zip(corners, proj) if abs(v - target) < 1e-9]
        faces.append((flat_loop(sel, n), n))
    return faces


def box(x0, y0, z0, x1, y1, z1):
    corners = [(x, y, z) for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)]
    return prism_faces(corners, [(1.0, 0.0, 0.0), (0.0, 1.0, 0.0), (0.0, 0.0, 1.0)])


def tilted_plate(w=60.0, d=40.0, t=6.0, deg=30.0):
    """A plate rotated about X so its underside is a genuine overhang."""
    a = math.radians(deg)
    ca, sa = math.cos(a), math.sin(a)

    def rot(p):
        return (p[0], p[1] * ca - p[2] * sa, p[1] * sa + p[2] * ca)

    corners = [rot((x, y, z))
               for x in (-w / 2, w / 2) for y in (-d / 2, d / 2) for z in (0.0, t)]
    dz = min(p[2] for p in corners)
    corners = [(p[0], p[1], p[2] - dz) for p in corners]
    basis = [rot((1.0, 0.0, 0.0)), rot((0.0, 1.0, 0.0)), rot((0.0, 0.0, 1.0))]
    return prism_faces(corners, basis)


def sphere_faces(r=20.0, seg=48, rings=24):
    """A faceted sphere resting on the bed (bottom pole at z = 0)."""
    def at(i, j):
        phi = (i / rings) * math.pi
        th = (j / seg) * 2 * math.pi
        return (r * math.sin(phi) * math.cos(th), r * math.sin(phi) * math.sin(th),
                r + r * math.cos(phi))

    faces = []
    for i in range(rings):
        for j in range(seg):
            if i == 0:                                  # top pole is degenerate
                tris = [[at(0, j), at(1, j + 1), at(1, j)]]
            elif i == rings - 1:                        # bottom pole is degenerate
                tris = [[at(i, j), at(i, j + 1), at(rings, j)]]
            else:
                q = [at(i, j), at(i, j + 1), at(i + 1, j + 1), at(i + 1, j)]
                tris = [[q[0], q[3], q[2]], [q[0], q[2], q[1]]]
            for t in tris:
                c = tuple(sum(p[k] for p in t) / 3 for k in range(3))
                faces.append((t, norm((c[0], c[1], c[2] - r))))     # outward from centre
    return faces


def write(name, faces, unit, product=None):
    s = Step(product or name, unit)
    ids = [s.face(pts, n) for pts, n in faces]
    text = s.render(ids)
    path = os.path.join(OUT, f"{name}.step")
    with open(path, "w", encoding="ascii", newline="\n") as fh:
        fh.write(text)
    print(f"wrote {os.path.relpath(path, HERE):32} {len(text):7} bytes  {len(faces):5} faces")


def main():
    os.makedirs(OUT, exist_ok=True)
    write("box", box(-10, -10, 0, 10, 10, 10), "mm")
    write("plate", tilted_plate(), "mm")
    write("plate-inch",
          [(tuple((p[0] / 25.4, p[1] / 25.4, p[2] / 25.4) for p in pts), n)
           for pts, n in tilted_plate()], "inch")
    write("ball", sphere_faces(), "mm")


if __name__ == "__main__":
    main()
