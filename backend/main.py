import math
from copy import deepcopy
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
from pydantic import BaseModel
import numpy as np
from sympy import parse_expr, symbols, lambdify, latex
from sympy.parsing.sympy_parser import parse_expr, standard_transformations, implicit_multiplication_application, convert_xor
from submininec.mininec import *
from subplot_antenna.plot_antenna import (
    Gain_Plot,
    options_gain,
    options_general,
    options_geo,
    options_swr,
    process_args,
)
import uvicorn
import sys

# Constantes de conductividad eléctrica en Siemens por metro (S/m) a ~20°C
CONDUCTIVITIES = {
    # --- Conductores Excelentes (Bajas Pérdidas) ---
    "SILVER": 6.3e7,       # Plata
    "COPPER": 5.8e7,       # Cobre
    "GOLD": 4.1e7,         # Oro
    "ALUMINUM": 3.5e7,     # Aluminio
    
    # --- Metales y Aleaciones Comunes ---
    "ZINC": 1.6e7,         # Zinc 
    "BRASS": 1.5e7,        # Latón
    "BRONZE": 1.0e7,       # Bronce
    
    # --- Hierro y Aceros (Pérdidas moderadas/altas) ---
    "IRON": 1.0e7,         # Hierro puro
    "TIN": 9.1e6,          # Estaño
    "STEEL_GALVANIZED": 6.0e6, # Acero Galvanizado
    "STEEL": 1.4e6,        # Acero Inoxidable
    
    # --- Materiales Especiales / Conductores Pobres ---
    "LEAD": 4.8e6,         # Plomo
    "TITANIUM": 2.3e6,     # Titanio
    "GRAPHITE": 1.0e5      # Grafito / Carbono (Conductividad muy baja, alta atenuación)
}

app = FastAPI(
    title="Software de Antenas UPTA - API",
    description="Backend modularizado, optimizado para concurrencia multi-usuario."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Modelos de Datos (Pydantic) ---

class FrequencyConfig(BaseModel):
    mode: str  # 'single' o 'sweep'
    value: Optional[float] = 140.0
    start: Optional[float] = 140.0
    end: Optional[float] = 140.0
    steps: Optional[int] = 1

class SourceElement(BaseModel):
    id: str
    amplitude: float
    phase: float
    segment: int
    type: str
    wireIndex: int

class AntennaElement(BaseModel):
    id: str
    type: str
    params: Dict[str, Any]

class SimulationRequest(BaseModel):
    frequency: FrequencyConfig
    elements: List[AntennaElement]
    sources: List[SourceElement]


def get_arrl_data(gain_array, max_gain):
    normalized_gain = np.clip(gain_array, max_gain - 40, max_gain)
    arrl_radius = 10 ** ((normalized_gain - max_gain) / 40)
    return arrl_radius.tolist()


def transform(p, offset, theta, phi, psi=0.0):
    x, y, z = p
    th = np.radians(float(theta))
    ph = np.radians(float(phi))
    ps = np.radians(float(psi))
    
    # 1. Rotación en Theta (Inclinación / Pitch - alrededor del eje Y)
    x_new = x * np.cos(th) + z * np.sin(th)
    z_new = -x * np.sin(th) + z * np.cos(th)
    x, z = x_new, z_new
    
    # 2. Rotación en Phi (Azimuth / Yaw - alrededor del eje Z)
    x_new = x * np.cos(ph) - y * np.sin(ph)
    y_new = x * np.sin(ph) + y * np.cos(ph)
    x, y = x_new, y_new
    
    # 3. Rotación en Psi (Giro propio / Roll - alrededor del eje X)
    y_new = y * np.cos(ps) - z * np.sin(ps)
    z_new = y * np.sin(ps) + z * np.cos(ps)
    y, z = y_new, z_new
    
    # 4. Traslación (Offset global)
    return (x + float(offset[0]), y + float(offset[1]), z + float(offset[2]))


def build_geometry_container(req: SimulationRequest):
    """
    Construye de manera aislada la geometría de la antena 
    y mapea las cargas a aplicar para la sesión activa.
    """
    freq = req.frequency.value if req.frequency.value else 72.0
    geo = Geo_Container()
    load_2_add = {}
    tag = 0
    
    c = 1 / np.sqrt(1.25663706127e-6 * 8.8541878188e-12)
    wave_len = c / (freq * 1e6)
    available_tags = []
    
    for el in req.elements:
        offset = [float(el.params.get('x', 0)), float(el.params.get('y', 0)), float(el.params.get('z', 0))]
        th = float(el.params.get('theta', 0))
        ph = float(el.params.get('phi', 0))
        ps = float(el.params.get('psi', 0))
        w_r = float(el.params.get('radius', 0.001))
        
        cond = CONDUCTIVITIES.get(el.params.get("materialType", ""), None)
        has_insulation = bool(el.params.get('hasInsulation', False))
        eps_r = float(el.params.get('epsilonR', 2.1))
        insulation_thickness = float(el.params.get('insulationThickness', 1.0))
        
        start_tag = tag

        # --- DIPOLO ---
        if el.type == "dipole":
            tag += 1
            x0, y0, z0 = [float(a) for a in el.params['p1'].split(",")]
            x1, y1, z1 = [float(a) for a in el.params['p2'].split(",")]
            n_seg = max(3, int(np.ceil(10 * (math.sqrt((x1 - x0)**2 + (y1 - y0)**2 + (z1 - z0)**2) / wave_len))))
            radio = float(el.params.get("radius", w_r))
            x0, y0, z0 = transform([x0, y0, z0], offset, th, ph, ps)
            x1, y1, z1 = transform([x1, y1, z1], offset, th, ph, ps)
            geo.append(Wire(n_seg, x0, y0, z0, x1, y1, z1, radio, tag))
        
        # --- MANUAL ---
        elif el.type == 'manual':
            for wire in el.params.get('table', []):
                tag += 1
                radio = float(wire["radius"])
                x0, y0, z0 = transform([wire["x1"], wire["y1"], wire["z1"]], offset, th, ph, ps)
                x1, y1, z1 = transform([wire["x2"], wire["y2"], wire["z2"]], offset, th, ph, ps)
                n_seg = max(3, int(np.ceil(10 * (math.sqrt((x1 - x0)**2 + (y1 - y0)**2 + (z1 - z0)**2) / wave_len))))
                geo.append(Wire(n_seg, x0, y0, z0, x1, y1, z1, radio, tag))
        
        # --- PARÁBOLA ---
        elif el.type == "parabola":
            D = float(el.params['diam'])
            fd = float(el.params['fd'])
            f_dist = D * fd
            div_radial = int(1 + int(el.params['divA']) / 2)
            div_angular = int(1 + int(el.params['divB']) / 2)
            radio = float(el.params.get("radius", w_r))
            
            dx = D / (2 * div_radial)
            dz = D / (2 * div_angular)
            
            Z_grid = [-D/2 + dz * i for i in range(2 * div_angular)]
            X_grid = [-D/2 + dx * i for i in range(2 * div_radial)]
            R_max = (D**2) / 4
            
            for x in X_grid:
                x0, y0, z0 = None, None, None
                for z in Z_grid:
                    r = x**2 + z**2
                    if r > R_max:
                        continue
                    x1, y1, z1 = transform([x, -f_dist + r / (4 * f_dist), z], offset, th, ph, ps)
                    if x0 is not None:
                        tag += 1
                        geo.append(Wire(1, x0, y0, z0, x1, y1, z1, radio, tag))
                    x0, y0, z0 = x1, y1, z1
            
            for z in Z_grid:
                x0, y0, z0 = None, None, None
                for x in X_grid:
                    r = x**2 + z**2
                    if r > R_max:
                        continue
                    x1, y1, z1 = transform([x, -f_dist + r / (4 * f_dist), z], offset, th, ph, ps)
                    if x0 is not None:
                        tag += 1
                        geo.append(Wire(1, x0, y0, z0, x1, y1, z1, radio, tag))
                    x0, y0, z0 = x1, y1, z1
        
        # --- YAGI ---
        elif el.type == "yagi":
            radio = float(el.params.get("radius", w_r))
            n_seg = 4
            for key in ['drv', 'ref']:
                if key in el.params.get('elementsData', {}):
                    d = el.params['elementsData'][key]
                    x0, y0, z0 = [float(a) for a in d['posA'].split(",")]
                    x1, y1, z1 = [float(a) for a in d['posB'].split(",")]
                    x0, y0, z0 = transform([x0, y0, z0], offset, th, ph, ps)
                    x1, y1, z1 = transform([x1, y1, z1], offset, th, ph, ps)
                    tag += 1
                    geo.append(Wire(n_seg, x0, y0, z0, x1, y1, z1, radio, tag))

            num_dir = int(el.params.get('numDir', 0))
            for i in range(1, num_dir + 1):
                t_dir = f'dir{i}'
                if t_dir in el.params.get('elementsData', {}):
                    d = el.params['elementsData'][t_dir]
                    x0, y0, z0 = [float(a) for a in d['posA'].split(",")]
                    x1, y1, z1 = [float(a) for a in d['posB'].split(",")]
                    x0, y0, z0 = transform([x0, y0, z0], offset, th, ph, ps)
                    x1, y1, z1 = transform([x1, y1, z1], offset, th, ph, ps)
                    tag += 1
                    geo.append(Wire(n_seg, x0, y0, z0, x1, y1, z1, radio, tag))
        
        # --- HÉLICE ---
        elif el.type == 'helical':
            tag += 1
            turns = int(el.params.get('turns', 5))
            spacing = float(el.params.get('spacing', 0.2))
            radius_h = float(el.params.get('radius_h', 0.1))
            wire_r = float(el.params.get('radius', 0.0025))
            
            segments_per_turn = 16
            total_points = turns * segments_per_turn
            points = []
            
            for i in range(total_points + 1):
                angle = 2 * np.pi * (i / segments_per_turn)
                lx = radius_h * np.cos(angle)
                ly = spacing * (i / segments_per_turn)
                lz = radius_h * np.sin(angle)
                points.append(transform((lx, ly, lz), offset, th, ph, ps))

            for i in range(len(points) - 1):
                n_seg = max(2,int(np.ceil(10*(math.sqrt((points[i+1][0] - points[i][0])**2+(points[i+1][1] - points[i][1])**2+(points[i+1][2] - points[i][2])**2)/wave_len))))
                geo.append(Wire(n_seg, *points[i], *points[i+1], wire_r, tag))
                tag += 1
            
            if el.params.get('hasReflector', False):
                ref_r = float(el.params.get('reflectorR', 0.5))
                angulos = np.linspace(0, 2*np.pi, 13)
                p_center = transform([0, 0, 0], offset, th, ph, ps)
                for a in angulos[:-1]:
                    x1, z1 = ref_r * np.cos(a), ref_r * np.sin(a)
                    p_edge = transform([x1, 0, z1], offset, th, ph, ps)
                    geo.append(Wire(5, *p_center, *p_edge, wire_r, tag))
                    tag += 1
        
        # --- CUERPO LIBRE / PARAMÉTRICA ---
        elif el.type == "free":
            
            radio_wire = float(el.params.get("radius", w_r))
            u_sym, v_sym = symbols('u v')
            u_vals = np.linspace(float(el.params['uStart']), float(el.params['uEnd']), int(el.params['uDiv']))
            mode = el.params.get('mode', "line")
            
            # Transformaciones mágicas de SymPy: 
            # 1. convert_xor: Traduce automáticamente el operador '^' a '**'
            # 2. implicit_multiplication_application: Permite escribir '2u' en vez de '2*u'
            transformaciones = standard_transformations + (implicit_multiplication_application, convert_xor)

            try:
                # parse_expr ahora digiere ^0.5, sqrt(), sin(), cos(), etc. sin romper
                e_x = parse_expr(str(el.params.get('Expr_x', 'u')), transformations=transformaciones)
                e_y = parse_expr(str(el.params.get('Expr_y', 'v')), transformations=transformaciones)
                e_z = parse_expr(str(el.params.get('Expr_z', '0')), transformations=transformaciones)
            except Exception as expr_err:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Error de sintaxis matemática en las ecuaciones del cuerpo libre: {str(expr_err)}"
                )

            # Lambdify convierte las expresiones de SymPy en funciones nativas de NumPy ultrarrápidas
            func_x = lambdify((u_sym, v_sym), e_x, 'numpy')
            func_y = lambdify((u_sym, v_sym), e_y, 'numpy')
            func_z = lambdify((u_sym, v_sym), e_z, 'numpy')

            if mode == 'line':
                pts = []
                for u in u_vals:
                    try:
                        lx = float(func_x(u, 0))
                        ly = float(func_y(u, 0))
                        lz = float(func_z(u, 0))
                        pts.append(transform((lx, ly, lz), offset, th, ph, ps))
                    except Exception as expr_err:
                            raise HTTPException(
                                status_code=400, 
                                detail=f"Error de sintaxis matemática en las ecuaciones del cuerpo libre: {str(expr_err)}"
                            )
                
                for i in range(len(pts) - 1):
                    tag += 1
                    n_seg = max(3,int(np.ceil(10*(math.sqrt((pts[i+1][0] - pts[i][0])**2+(pts[i+1][1] - pts[i][1])**2+(pts[i+1][2] - pts[i][2])**2)/wave_len))))
                    geo.append(Wire(n_seg, *pts[i], *pts[i+1], radio_wire, tag))

            elif mode == 'surf':
                v_vals = np.linspace(float(el.params['vStart']), float(el.params['vEnd']), int(el.params['vDiv']))
                
                # Malla en U
                for v in v_vals:
                    for i in range(len(u_vals)-1):
                        try:
                            p1 = transform((float(func_x(u_vals[i], v)), float(func_y(u_vals[i], v)), float(func_z(u_vals[i], v))), offset, th, ph, ps)
                            p2 = transform((float(func_x(u_vals[i+1], v)), float(func_y(u_vals[i+1], v)), float(func_z(u_vals[i+1], v))), offset, th, ph, ps)
                            tag += 1
                            geo.append(Wire(1, *p1, *p2, radio_wire, tag))
                        except Exception as expr_err:
                            raise HTTPException(
                                status_code=400, 
                                detail=f"Error de sintaxis matemática en las ecuaciones del cuerpo libre: {str(expr_err)}"
                            )
                # Malla en V
                for u in u_vals:
                    for j in range(len(v_vals)-1):
                        try:
                            p1 = transform((float(func_x(u, v_vals[j])), float(func_y(u, v_vals[j])), float(func_z(u, v_vals[j])),), offset, th, ph, ps)
                            p2 = transform((float(func_x(u, v_vals[j+1])), float(func_y(u, v_vals[j+1])), float(func_z(u, v_vals[j+1])),), offset, th, ph, ps)
                            tag += 1
                            geo.append(Wire(1, *p1, *p2, radio_wire, tag))
                        except Exception as expr_err:
                            raise HTTPException(
                                status_code=400, 
                                detail=f"Error de sintaxis matemática en las ecuaciones del cuerpo libre: {str(expr_err)}"
                            )
        

        available_tags.append(int(tag))
        
        # Inyección local de pérdidas por efecto skin o aislamiento
        if cond is not None or has_insulation:
            for w in geo.geo[start_tag:]:
                load_2_add[str(w.tag)] = []
                if cond is not None:
                    load_2_add[str(w.tag)].append(Skin_Effect_Load(geobj=w, conductivity=cond))
                if has_insulation:
                    rad_m = w._r + (insulation_thickness / 1000.0)
                    load_2_add[str(w.tag)].append(Insulation_Load(geobj=w, radius=rad_m, epsilon_r=eps_r))

    geo.compute_tags()
    return geo, load_2_add, available_tags


def generate_nec_file(freq_val, req: SimulationRequest):
    """Genera dinámicamente un archivo estructurado en formato 4NEC2 usando datos locales."""
    lines = [
        "CM Proyecto generado por Software de Antenas UPTA",
        "CM Comparativa de validacion con 4NEC2",
        "CE"
    ]
    
    geo, _, _ = build_geometry_container(req)
    
    for w in geo.geo:
        lines.append(f"GW {w.tag} {w.n_segments} {w.p1[0]} {w.p1[1]} {w.p1[2]} {w.p2[0]} {w.p2[1]} {w.p2[2]} {w._r}")

    lines.append("GE 0")
    lines.append("EK") 

    if req.sources:
        for src in req.sources:
            real = src.amplitude * math.cos(math.radians(src.phase))
            imag = src.amplitude * math.sin(math.radians(src.phase))
            lines.append(f"EX 0 {src.wireIndex} {src.segment} 0 {real} {imag}")
    else:
        lines.append("EX 0 1 2 0 1.0 0.0")

    lines.append(f"FR 0 1 0 0 {freq_val} 0")
    lines.append("EN")
    return "\n".join(lines)


# --- Endpoints de la API FastAPI ---

@app.post("/api/simulate/geometry")
async def get_geometry_endpoint(req: SimulationRequest):
    """
    Simula de manera aislada la representación tridimensional de la geometría.
    """
    try:
        geo, _, available_tags = build_geometry_container(req)
        
        cmd = options_general()
        options_gain(cmd)
        options_swr(cmd)
        options_geo(cmd)
        args = process_args(cmd, [])
        args.filename = 'outputs/Geo3D'
        
        # Aislamiento de estados en Gain_Plot
        ff_local = {}
        gp = Gain_Plot(args, deepcopy(ff_local))
        gp.idata = {}
        gp.compute()
        pgeo = gp.new_geo(gnd=False)
        
        for geobj in geo:
            pgeo.wires.append([list(x) for x in geobj.endpoints])
            pgeo.append([])
            for n, p in enumerate(geobj.pulse_iter()):
                if n == 0:
                    pgeo[-1].append(list(p.ends[0]))
                pgeo[-1].append(list(p.ends[1]))
        pgeo.fix_wires()
        
        wires_data = []
        for w in geo.geo:
            wires_data.append({
                "tag": int(w.tag),
                "x": [float(w.p1[0]), float(w.p2[0])],
                "y": [float(w.p1[1]), float(w.p2[1])],
                "z": [float(w.p1[2]), float(w.p2[2])],
                "segments": int(w.n_segments)
            })
       
        return {"status": "success", "wires": wires_data, "tags": available_tags}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error procesando geometría: {str(e)}")


@app.post("/api/simulate/pattern")
async def get_pattern_endpoint(req: SimulationRequest):
    """
    Calcula el diagrama de radiación en 2D y 3D de manera síncrona y aislada por cliente.
    """
    try:
        geo, load_2_add, _ = build_geometry_container(req)
        
        if req.frequency.mode == "sweep":
            start = req.frequency.start
            stop = req.frequency.end + 1
            steps = req.frequency.steps
        else:
            start = req.frequency.value
            stop = req.frequency.value + 1
            steps = 1
            
        m_local = Mininec(start, geo, media=None)
        feeds = []
        
        for fuente in req.sources:
            feed_element = Excitation(cvolt=fuente.amplitude, phase=fuente.phase, geo_tag=fuente.wireIndex, geo_idx=fuente.segment)
            feeds.append(feed_element)
            m_local.register_source(feed_element, pulse=1, geo_tag=fuente.wireIndex)
            
        for key, loads in load_2_add.items():
            for load in loads:
                m_local.register_load(load, geo_tag=int(key))
        
        phi = Angle(0, 5, 73)   # A
        theta = Angle(0, 5, 37)  # B
        patterns_json = []
        r_load = 50.0
        idata_local = {}
        azimuth_list = []
        elevation_list = []

        for f in np.arange(start, stop, steps):
            m_local.f = f
            m_local.compute()
            m_local.compute_far_field(theta, phi)
            
            n_source = 1
            for fuente in feeds:
                TAG = str(n_source)
                if TAG not in idata_local:
                    idata_local[TAG] = {"f": [], "r": [], "x": [], "swr": [], "Wire": []}
                Z = fuente.impedance
                gamma = (Z - r_load) / (Z + r_load)
                rho = abs(gamma)
                swr = (1 + rho) / (1 - rho) if rho < 1 else 999.0
                
                idata_local[TAG]["f"].append(float(f))
                idata_local[TAG]["r"].append(float(Z.real))
                idata_local[TAG]["x"].append(float(Z.imag))
                idata_local[TAG]["swr"].append(float(swr))
                idata_local[TAG]["Wire"].append(int(fuente.geo_tag))
                n_source += 1
            
            theta_deg = theta.angle_deg()
            phi_deg = phi.angle_deg()

            theta_rad = np.deg2rad(theta_deg)
            phi_rad = np.deg2rad(phi_deg)
            
            gain_matrix = m_local.far_field.gain_dbi[-1]
            PHI, THETA = np.meshgrid(phi_rad, theta_rad, indexing='ij')
            
            max_g = np.max(gain_matrix)
            gain_clean = np.nan_to_num(gain_matrix, nan=-99.0, neginf=-99.0)
            R_visual = np.maximum(0, gain_clean - (max_g - 40))

            X = R_visual * np.sin(THETA) * np.cos(PHI)
            Y = R_visual * np.sin(THETA) * np.sin(PHI)
            Z = R_visual * np.cos(THETA)
            
            ARRL_Visual = 100 * np.pow(0.89126, np.max(R_visual) - R_visual)
            X_ARRL = ARRL_Visual * np.sin(THETA) * np.cos(PHI)
            Y_ARRL = ARRL_Visual * np.sin(THETA) * np.sin(PHI)
            Z_ARRL = ARRL_Visual * np.cos(THETA)
            
            piso_error = -90.0
            gain_matrix_final = np.where(gain_matrix < piso_error, piso_error, gain_matrix)
            
            idx_90 = 36
            azimuth_gain = gain_matrix_final[:, int(idx_90/2)].tolist()
            elevation_gain = gain_matrix_final[int(idx_90/2), :].tolist()
            
            elevation_back_gain = gain_matrix_final[idx_90 + int(idx_90/2), :].tolist()
            elevation_back_gain.reverse()
            elevation_back_gain.append(elevation_gain[0])
            
            phi_deg = phi_deg - 90
            
            azimuth_list.append({"freq": float(f), "gain": azimuth_gain, "angles": phi_deg.tolist()})
            elevation_list.append({"freq": float(f), "gain": elevation_gain, "angles": theta_deg.tolist()})
            
            theta_deg = theta_deg + 180
            
            elevation_list[-1]["gain"].extend(elevation_back_gain)
            elevation_list[-1]["angles"].extend(theta_deg.tolist())
            elevation_list[-1]["angles"].append(0)
            
            patterns_json.append({
                "frequency": float(f),
                "x": X.tolist(),
                "y": Y.tolist(),
                "z": Z.tolist(),
                "r": gain_matrix_final.tolist(),
                "ARRLx": X_ARRL.tolist(),
                "ARRLy": Y_ARRL.tolist(),
                "ARRLz": Z_ARRL.tolist(),
                "min_gain": float(np.min(gain_matrix_final)),
                "max_gain": float(max_g)
            })

        return {
            "status": "success", 
            "patterns": patterns_json,
            "networkData": idata_local,
            "patterns_2d": {"azimuth_sets": azimuth_list, "elevation_sets": elevation_list}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en simulación numérica: {str(e)}")


@app.post("/api/validate-equation")
async def validate_equation(payload: dict):
    """
    Valida una ecuación en caliente y regresa su representación en LaTeX 
    para que el ElementBox del frontend la renderice visualmente.
    """
    equation_str = payload.get("expr", "u")
    transformaciones = standard_transformations + (implicit_multiplication_application, convert_xor)
    
    try:
        parsed = parse_expr(equation_str, transformations=transformaciones)
        # Convierte 'sqrt(u)/2' en '\\frac{\\sqrt{u}}{2}' automáticamente
        return {"status": "valid", "latex": latex(parsed)}
    except Exception as e:
        return {"status": "invalid", "error": str(e)}


@app.post("/api/export-nec")
async def export_nec_endpoint(payload: dict):
    try:
        frequency = payload.get('freq', 140.0)
        # Reconstrucción mock del request para estructurar geometría limpia
        req_mock = SimulationRequest(
            frequency=FrequencyConfig(mode="single", value=float(frequency)),
            elements=payload.get('elements', []),
            sources=payload.get('sources', [])
        )
        nec_string = generate_nec_file(frequency, req_mock)
        return {"status": "success", "nec_file": nec_string}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error exportando archivo NEC: {str(e)}")


if getattr(sys, 'frozen', False):
    # Si es el ejecutable .exe, la raíz es donde está el binario
    BASE_DIR = os.path.dirname(sys.executable)
else:
    # Si corre como script .py normal
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Evaluamos dinámicamente dónde quedaron los archivos del frontend en el disco
dist_path = os.path.join(BASE_DIR, "dist")
assets_path = os.path.join(dist_path, "assets")
index_file = os.path.join(dist_path, "index.html")

# PLAN B: Si los archivos se copiaron sueltos directamente al lado del .exe (Como tu imagen 3)
if not os.path.exists(index_file):
    dist_path = BASE_DIR
    assets_path = os.path.join(BASE_DIR, "assets")
    index_file = os.path.join(BASE_DIR, "index.html")

# 1. Montamos la carpeta 'assets' si realmente existe en el disco
if os.path.exists(assets_path):
    app.mount("/assets", StaticFiles(directory=assets_path), name="assets")

# 2. Ruta raíz para entregar el HTML principal
@app.get("/")
async def serve_index():
    if os.path.exists(index_file):
        return FileResponse(index_file)
    # Si vuelve a fallar, este mensaje te cantará la ruta exacta que está fallando en la consola
    return {
        "status": "error",
        "message": "Frontend no encontrado",
        "ruta_buscada_index": index_file,
        "ruta_buscada_assets": assets_path
    }

# 3. Captura rutas secundarias para evitar errores de recarga (routers de React/Vue/Svelte)
@app.get("/{catchall:path}")
async def serve_frontend(catchall: str):
    if catchall.startswith("api/"):
        raise HTTPException(status_code=404, detail="Endpoint de API no encontrado")
        
    if os.path.exists(index_file):
        return FileResponse(index_file)
    raise HTTPException(status_code=404, detail="Recurso no encontrado")

if __name__ == "__main__":
    # Indicamos el archivo, el objeto app, el puerto y desactivamos el reload en producción
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False, workers=1, log_config={
            "version": 1,
            "disable_existing_loggers": True,
            "formatters": {},
            "handlers": {},
            "loggers": {},
        })