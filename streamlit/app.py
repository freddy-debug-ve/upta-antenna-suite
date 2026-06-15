import streamlit as st
import numpy as np
import json
import folium
from folium.plugins import HeatMap
from streamlit_folium import st_folium
import math
from pyhigh import get_elevation, get_elevation_batch
import pandas as pd
from folium.plugins import MeasureControl, Draw, HeatMap
import streamlit as st
import simplekml # Para generar el archivo de Google Earth
import streamlit.components.v1 as components
from geopy.distance import geodesic
from shapely.geometry import Point, Polygon
import plotly.graph_objects as go
import pydeck as pdk
from PIL import Image
import os
import sys
import matplotlib.pyplot as plt
from folium.raster_layers import ImageOverlay
import branca.colormap as cm


if getattr(sys, 'frozen', False):
    BASE_DIR = sys._MEIPASS
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

PATH_HGT = os.path.join(BASE_DIR, "hgtdata")


@st.fragment
def renderizar_solo_mapa():
    global col1

    with col1:
        m = folium.Map(location=st.session_state['map_center'], 
                       zoom_start=st.session_state['map_zoom'],
                       tiles=None, width="20%")
        
        folium.TileLayer(tiles='OpenStreetMap', name='OpenStreet', control=True).add_to(m)
        folium.TileLayer(
            tiles='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            attr='Esri, DigitalGlobe...', name='Vista Satelital', control=True
        ).add_to(m)
        folium.TileLayer(tiles='cartodbdark_matter', name='Mapa Oscuro', control=True).add_to(m)
        folium.TileLayer(tiles='cartodbpositron', name='Mapa Claro', control=True).add_to(m)
        
        layers = folium.LayerControl(position='topleft', collapsed=True)
        fg_markers = folium.FeatureGroup(name="Antenas")
        
        for ant in antenas:
            folium.Marker(
                [ant['lat'], ant['lon']],
                tooltip=f"Antena {ant['id']}",
                icon=folium.Icon(icon='tower-broadcast', prefix='fa', color='blue')
            ).add_to(fg_markers)
        
        Features = [fg_markers]
        
        if modo_estudio == "Mapa de Cobertura" and len(st.session_state['antenas']) >= 1:
            if 'cobertura_raster' in st.session_state and st.session_state['cobertura_raster'] is not None:
                rssi_matrix = st.session_state['cobertura_raster']
                bounds = st.session_state['raster_bounds']
                sensibilidad = st.session_state['config_radio'].get('Sensibilidad', -95)
                val_max = -45
                
                norm = plt.Normalize(vmin=sensibilidad, vmax=val_max)
                cmap = plt.get_cmap('turbo') 
                color_rgba = cmap(norm(rssi_matrix))
                color_rgba[np.isnan(rssi_matrix), 3] = 0.0
                
                pasos_rssi = np.linspace(sensibilidad, val_max, 6)
                colores_leyenda = [plt.cm.colors.to_hex(cmap(norm(val))) for val in pasos_rssi]
                
                # Creamos el mapa de colores lineal de Branca
                leyenda_colores = cm.LinearColormap(
                    colors=colores_leyenda,
                    vmin=sensibilidad,
                    vmax=val_max,
                    caption="Nivel de Señal (RSSI en dBm)"
                )
                
                leyenda_colores.target_name = "leyenda_cobertura"
        
                # Inyectamos el CSS para sobreescribir la posición por defecto
                # Colocamos bottom: 50px (para que no tape los controles del mapa) y left: 20px
                codigo_css = """
                <style>
                    /* Configuración estándar para pantallas de computadora */
                    .legend {
                        position: fixed !important;
                        top: auto !important;
                        bottom: 45px !important;
                        left: 10px !important;
                        right: auto !important;
                        background-color: rgba(255, 255, 255, 0.9) !important;
                        padding: 10px !important;
                        border-radius: 6px !important;
                        box-shadow: 0 0 15px rgba(0,0,0,0.2) !important;
                        z-index: 9999 !important;
                        transform-origin: bottom left !important;
                        transition: transform 0.2s ease !important;
                    }
                    
                    /* Ajustes automáticos estrictos para pantallas pequeñas */
                    @media (max-width: 768px) {
                        .legend {
                            bottom: 15px !important;   
                            left: 10px !important;
                            padding: 6px !important;     
                            
                            /* COMPRESIÓN REAL: Escalamos toda la leyenda al 60% de su tamaño original */
                            transform: scale(0.6) !important; 
                        }
                        
                        /* Aseguramos que el SVG interno mantenga su flujo y no se corte */
                        .legend svg {
                            display: block !important;
                            max-width: 100% !important;
                        }
                        
                        /* Opcional: Resaltamos un poco el grosor del texto para mantener legibilidad al encogerse */
                        .legend text, .legend .legend-title {
                            font-weight: bold !important;
                        }
                    }
                </style>
                """
                # Añadimos el estilo al HTML de la leyenda
                m.get_root().header.add_child(folium.Element(codigo_css))
                        
                fg_cobertura = folium.FeatureGroup(name="Imagen de Cobertura", show=True)
                
                ImageOverlay(
                    image=color_rgba,
                    bounds=bounds,
                    opacity=0.6,          # Transparencia para ver las calles abajo
                    interactive=False,
                    cross_origin=False
                ).add_to(fg_cobertura)
                
                Features.append(fg_cobertura)
                m.add_child(leyenda_colores)
            
            if 'current_geojson_cobertura' in st.session_state and st.session_state['current_geojson_cobertura'] is not None:
        
                geojson_data = st.session_state['current_geojson_cobertura']
                
                fg_mosaico_preciso = folium.FeatureGroup(name="Cobertura de Radio (RSSI)", show=True)
                
                folium.GeoJson(
                    geojson_data,
                    marker=folium.CircleMarker(),  # Forzamos renderizado geométrico rápido de círculos
                    style_function=lambda feature: {
                        "radius": 5,
                        "fill": True,                        # Tamaño del punto en píxeles (ajústalo si quedan huecos)
                        "fillColor": feature["properties"]["color"], # Color dinámico de tu función
                        "color": feature["properties"]["color"],     # Borde del mismo color para fundirlos homogéneamente
                        "weight": 0,                                 # Quita las líneas de separación
                        "fillOpacity": 0.4                          # Opacidad baja
                    },
                    # Tooltip interactivo flotante al pasar el mouse por la cobertura
                    tooltip=folium.GeoJsonTooltip(
                        fields=["rssi", "dist"],
                        aliases=["Señal (dBm):", "Distancia (km):"],
                        localize=True,
                        sticky=True
                    )
                ).add_to(fg_mosaico_preciso)
                
                Features.append(fg_mosaico_preciso)

        if modo_estudio == "Punto a Punto (PTP)" and len(st.session_state['antenas']) >= 2:
            idx_a = int(antena_a.split()[-1]) - 1
            idx_b = int(antena_b.split()[-1]) - 1
            p1 = [st.session_state['antenas'][idx_a]['lat'], st.session_state['antenas'][idx_a]['lon']]
            p2 = [st.session_state['antenas'][idx_b]['lat'], st.session_state['antenas'][idx_b]['lon']]
            folium.PolyLine([p1, p2], color="red", weight=2.5, opacity=0.8).add_to(m)
        
        draw = Draw(
            export=True, filename='data.geojson',
            draw_options={'polyline': False, 'rectangle': True, 'polygon': True, 'circle': False, 'marker': True, 'circlemarker': False}
        )
        draw.add_to(m)
        
        for i, poly in enumerate(st.session_state['poligonos']):
            coords_raw = poly['geometry']['coordinates'][0]
            coords_folium = [[c[1], c[0]] for c in coords_raw]
            folium.Polygon(
                locations=coords_folium, color="orange", fill=True, fill_color="orange", fill_opacity=0.4,
                tooltip=f"Obstáculo {i+1}: {poly['altura']}m"
            ).add_to(m)
        
        # Guardamos el output en el session_state para poder leerlo desde fuera del fragmento
        st.session_state['map_output'] = st_folium(m, width=1000, height=450, key=map_key, feature_group_to_add=Features, layer_control=layers)


def generar_grafico_vista_aerea_real(antena_tx, antena_rx, az_sug, tipo_app="Enlaces"):
    """
    Genera la vista aérea (X, Y) proyectando la posición de RX en base al Azimut sugerido (az_sug)
    y orientando los patrones de radiación según el azimut manual fijado por el usuario.
    """
    fig = go.Figure()
    distancia_visual = 100  # Radio visual de separación en el gráfico
    
    try: patron_h_tx = antena_tx["patron"]["h"]
    except: patron_h_tx = None
    try: patron_h_rx = antena_rx["patron"]["h"]
    except: patron_h_rx = None
    
    # --- ANTENA 1 (TX) en el origen (0,0) ---
    if patron_h_tx is not None:
        gain_tx = np.array(patron_h_tx)
        angulos_base_tx = antena_tx.get("patron", {}).get("angulos_h")
        if angulos_base_tx is None:
            angulos_base_tx = np.arange(len(gain_tx)) * (360.0 / len(gain_tx))
        else:
            angulos_base_tx = np.array(angulos_base_tx)
    else:
        gain_tx = np.zeros(360)
        angulos_base_tx = np.arange(360)
        
    r_tx = np.array([10 ** (db / 20) if db > -30 else 0.03 for db in gain_tx])
    r_tx = (r_tx / np.max(r_tx)) * 30  # Escala del lóbulo (radio máximo 30)
    
    # El Azimut del usuario se resta de los ángulos (Ajustado para que 0° sea el Norte en sentido horario)
    az_user_tx = float(antena_tx.get("azimuth", 0.0))
    angulos_tx_rad = np.radians(90 - angulos_base_tx - az_user_tx)
    
    x_tx = r_tx * np.cos(angulos_tx_rad)
    y_tx = r_tx * np.sin(angulos_tx_rad)
    
    fig.add_trace(go.Scatter(x=x_tx, y=y_tx, mode='lines', fill='toself', name='Patrón TX (Horizontal)', line=dict(color='indigo')))
    fig.add_trace(go.Scatter(x=[0], y=[0], mode='markers+text', text=["TX (Punto A)"], textposition="bottom center", marker=dict(color='black', size=8), showlegend=False))

    if tipo_app == "Enlaces":
        # --- CALCULAR POSICIÓN GEOGRÁFICA DE RX ---
        # az_sug es el rumbo geográfico real de TX hacia RX (0° Norte, 90° Este...)
        az_sug_rad = np.radians(90 - float(az_sug))
        x_rx_centro = distancia_visual * np.cos(az_sug_rad)
        y_rx_centro = distancia_visual * np.sin(az_sug_rad)
        
        # --- ANTENA 2 (RX) ---
        if patron_h_rx is not None:
            gain_rx = np.array(patron_h_rx)
            angulos_base_rx = antena_rx.get("patron", {}).get("angulos_h")
            if angulos_base_rx is None:
                angulos_base_rx = np.arange(len(gain_rx)) * (360.0 / len(gain_rx))
            else:
                angulos_base_rx = np.array(angulos_base_rx)
        else:
            gain_rx = np.zeros(360)
            angulos_base_rx = np.arange(360)
            
        r_rx = np.array([10 ** (db / 20) if db > -30 else 0.03 for db in gain_rx])
        r_rx = (r_rx / np.max(r_rx)) * 30
        
        # Orientación del lóbulo de RX usando el azimut definido por el usuario para la Antena B
        az_user_rx = float(antena_rx.get("azimuth", 0.0))
        angulos_rx_rad = np.radians(90 - angulos_base_rx - az_user_rx)
        
        x_rx = x_rx_centro + r_rx * np.cos(angulos_rx_rad)
        y_rx = y_rx_centro + r_rx * np.sin(angulos_rx_rad)
        
        fig.add_trace(go.Scatter(x=x_rx, y=y_rx, mode='lines', fill='toself', name='Patrón RX (Horizontal)', line=dict(color='darkred')))
        fig.add_trace(go.Scatter(x=[x_rx_centro], y=[y_rx_centro], mode='markers+text', text=["RX (Punto B)"], textposition="top center", marker=dict(color='black', size=8), showlegend=False))
        
        # Línea de Vista Real orientada de forma exacta
        fig.add_trace(go.Scatter(x=[0, x_rx_centro], y=[0, y_rx_centro], mode='lines', name='Línea de Vista (LoS)', line=dict(color='green', dash='dash')))

    fig.update_layout(
        title="Vista Aérea Proyectada (Orientación Geográfica Real)",
        xaxis=dict(title="Oeste <-> Este", showgrid=True, zeroline=True, scaleanchor="y", scaleratio=1),
        yaxis=dict(title="Sur <-> Norte", showgrid=True, zeroline=True),
        template="plotly_white" if st.session_state.get('theme') != 'dark' else 'plotly_dark',
        height=450,
        legend=dict(
            orientation="h",        # Orientación horizontal (en fila)
            yanchor="top",          # El punto de anclaje vertical es la parte superior de la leyenda
            y=-0.2,                 # Coloca la leyenda justo abajo del eje X (ajusta si se solapa con el título del eje)
            xanchor="center",       # Anclaje horizontal en el centro
            x=0.5                   # Centrado exactamente a la mitad del gráfico
        )
    )
    return fig
    

def generar_grafico_vista_perfil_real(antena_tx, antena_rx, altura_tx, altura_rx, el_sug, distancia_km, tipo_app="Enlaces"):
    """
    Genera la vista de perfil (Altura vs Distancia) trabajando todo estrictamente en METROS
    para evitar deformaciones geométricas por escala angular.
    """
    fig = go.Figure()
    
    # Convertimos la distancia total del enlace a metros
    dist_rx_centro = float(distancia_km) * 1000.0
    
    # El tamaño visual del lóbulo ahora se define directamente en metros
    escala_visual_metros = 0.25*np.sqrt(dist_rx_centro**2 + (altura_tx - altura_rx)**2)
    
    try: patron_v_tx = antena_tx["patron"]["v"]
    except: patron_v_tx = None
    try: patron_v_rx = antena_rx["patron"]["v"]
    except: patron_v_rx = None
    
    if patron_v_tx is not None:
    # --- ANTENA 1 (TX - Lado Izquierdo, apunta a la DERECHA) ---
        gain_tx = np.array(patron_v_tx)
        angulos_base_tx = antena_tx.get("patron", {}).get("angulos_v")
        if angulos_base_tx is None:
            angulos_base_tx = np.arange(len(gain_tx)) * (360.0 / len(gain_tx))
        else:
            angulos_base_tx = np.array(angulos_base_tx)
    else:
        gain_tx = np.zeros(360)
        angulos_base_tx = np.arange(360)
        
    r_tx = np.array([10 ** (db / 20) if db > -30 else 0.03 for db in gain_tx])
    r_tx = (r_tx / np.max(r_tx)) * escala_visual_metros
    
    # 0° es el horizonte horizontal. El tilt inclina el lóbulo.
    tilt_user_tx = float(antena_tx.get("elevation", 0.0))
    angulos_tx_rad = np.radians(angulos_base_tx - 90 + tilt_user_tx)
    
    # Proyección pura en metros sin factores de distorsión
    dist_tx = r_tx * np.cos(angulos_tx_rad)
    alt_tx = altura_tx + r_tx * np.sin(angulos_tx_rad)
    
    fig.add_trace(go.Scatter(x=dist_tx, y=2*altura_tx-alt_tx, mode='lines', fill='toself', name='Lóbulo Vertical TX', line=dict(color='indigo')))
    fig.add_trace(go.Scatter(x=[0], y=[altura_tx], mode='markers+text', text=[f"TX ({altura_tx}m)"], textposition="bottom left", marker=dict(color='black', size=8), showlegend=False))

    if tipo_app == "Enlaces" and antena_rx:
        # --- ANTENA 2 (RX - Lado Derecho, apunta a la IZQUIERDA) ---
        if patron_v_rx is not None:
            gain_rx = np.array(patron_v_rx)
            angulos_base_rx = antena_rx.get("patron", {}).get("angulos_v")
            if angulos_base_rx is None:
                angulos_base_rx = np.arange(len(gain_rx)) * (360.0 / len(gain_rx))
            else:
                angulos_base_rx = np.array(angulos_base_rx)
        else:
            gain_rx = np.zeros(360)
            angulos_base_rx = np.arange(360)
            
        r_rx = np.array([10 ** (db / 20) if db > -30 else 0.03 for db in gain_rx])
        r_rx = (r_rx / np.max(r_rx)) * escala_visual_metros
        
        tilt_user_rx = float(antena_rx.get("elevation", 0.0))
        angulos_rx_rad = np.radians(angulos_base_rx + 90 + tilt_user_rx)
        
        # Desplazamos el centro del lóbulo RX a la posición real en metros
        dist_rx = dist_rx_centro + r_rx * np.cos(angulos_rx_rad)
        alt_rx = altura_rx + r_rx * np.sin(angulos_rx_rad)
        
        fig.add_trace(go.Scatter(x=dist_rx, y=alt_rx, mode='lines', fill='toself', name='Lóbulo Vertical RX', line=dict(color='darkred')))
        fig.add_trace(go.Scatter(x=[dist_rx_centro], y=[altura_rx], mode='markers+text', text=[f"RX ({altura_rx}m)"], textposition="bottom right", marker=dict(color='black', size=8), showlegend=False))
        
        # Línea de vista real uniendo ambos puntos en metros
        fig.add_trace(go.Scatter(x=[0, dist_rx_centro], y=[altura_tx, altura_rx], mode='lines', name=f'LoS Ideal (Elevación: {el_sug:.2f}°)', line=dict(color='green', dash='dash')))

    fig.update_layout(
        title="Vista de Perfil Geométrica (Unidades Uniformes en Metros)",
        # scaleanchor="y" obliga a que 1 metro en X se vea igual a 1 metro en Y en la pantalla
        xaxis=dict(title="Distancia en el Eje de Enlace (metros)", showgrid=True, zeroline=True, scaleanchor="y", scaleratio=1),
        yaxis=dict(title="Altura Terreno / Estructura (metros)", showgrid=True, zeroline=True),
        template="plotly_white" if st.session_state.get('theme') != 'dark' else 'plotly_dark',
        height=500,
        legend=dict(
            orientation="h",        # Orientación horizontal (en fila)
            yanchor="top",          # El punto de anclaje vertical es la parte superior de la leyenda
            y=-0.2,                 # Coloca la leyenda justo abajo del eje X (ajusta si se solapa con el título del eje)
            xanchor="center",       # Anclaje horizontal en el centro
            x=0.5                   # Centrado exactamente a la mitad del gráfico
        )
    )
    return fig
    
    
def inicializar_estados():
    """Inicializa todos los componentes del st.session_state si no existen."""
    # --- Datos de Elementos ---
    if 'antenas' not in st.session_state:
        st.session_state['antenas'] = []
    if 'poligonos' not in st.session_state:
        st.session_state['poligonos'] = []
    if 'next_id' not in st.session_state:
        st.session_state['next_id'] = 1 # Evita IDs duplicados al borrar
    if 'ejecutar_calculo' not in st.session_state:
        st.session_state['ejecutar_calculo'] = False
        
    # --- Configuración del Mapa ---
    if 'map_center' not in st.session_state:
        st.session_state['map_center'] = [10.27, -67.55] # Maracay
    if 'map_zoom' not in st.session_state:
        st.session_state['map_zoom'] = 13
        
    # --- Parámetros de Radio y Simulación ---
    if 'config_radio' not in st.session_state:
        
        st.session_state['config_radio'] = {
            'frecuencia_mhz': 450,
            'Potencia': 27.0,
            'Altura_TX': 15.0,
            'Altura_RX': 10.0,
            'Ganancia_TX': 3.0,
            'Ganancia_RX': 3.0,
            'Sensibilidad': -75.0,
            'Loss_RX': 2.0,
            'Loss_TX': 2.0,
            'modelo_propagacion': 'Okumura-Hata' # Basado en tus implementaciones previas
        }
    
    # --- Almacenamiento de Resultados ---
    if 'last_result' not in st.session_state:
        st.session_state['last_result'] = None


def sincronizar_mapa(output):
    if output:
        
        if output.get("center"):
            st.session_state['map_center'] = [output["center"]["lat"], output["center"]["lng"]]
        if output.get("zoom"):
            st.session_state['map_zoom'] = output["zoom"]
    
        if output.get("all_drawings"):
            
            # Extraer puntos del dibujo actual
            puntos_dibujados = [d['geometry']['coordinates'] for d in output["all_drawings"] if d['geometry']['type'] == 'Point']
            
            # Si hay puntos nuevos dibujados que no están en nuestra lista persistente
            for coords in puntos_dibujados:
                lat, lon = coords[1], coords[0]
                # Evitar duplicados exactos (basado en cercanía mínima)
                if not any(abs(a['lat'] - lat) < 0.0001 and abs(a['lon'] - lon) < 0.0001 for a in antenas):
                    nueva_id = len(antenas) + 1
                    if len(antenas)>0:
                        while nueva_id==antenas[-1]['id']:
                            nueva_id += 1
                    st.session_state['antenas'].append({'id': nueva_id, 'lat': lat, 'lon': lon})
                    antenas.append({'id': nueva_id, 'lat': lat, 'lon': lon})
            
            # Actualizar polígonos (estos sí suelen ser más volátiles, los reemplazamos)
            nuevos_polis = [d for d in output["all_drawings"] if d['geometry']['type'] in ['Polygon', 'Rectangle']]
            for poly in nuevos_polis:
                # Creamos un identificador único basado en las coordenadas para evitar duplicados
                signature = str(poly['geometry']['coordinates'])
                if not any(str(p['geometry']['coordinates']) == signature for p in st.session_state['poligonos']):
                    # Añadir altura por defecto al nuevo polígono
                    poly['altura'] = 10.0 
                    st.session_state['poligonos'].append(poly)


def guardar_proyecto(nombre_archivo="proyecto_radiolink.json"):
    """Empaqueta el estado actual en un archivo JSON."""
    datos_proyecto = {
        'antenas': st.session_state['antenas'],
        'poligonos': st.session_state['poligonos'],
        'config_radio': st.session_state['config_radio'],
        'map_center': st.session_state['map_center']
    }
    
    try:
        with open(nombre_archivo, 'w') as f:
            json.dump(datos_proyecto, f, indent=4)
        st.success(f"✅ Proyecto guardado como {nombre_archivo}")
    except Exception as e:
        st.error(f"❌ Error al guardar: {e}")


def cargar_proyecto(archivo_subido):
    """Lee un archivo JSON y restaura el st.session_state."""
    if archivo_subido is not None:
        try:
            datos = json.load(archivo_subido)
            
            # Restauración selectiva
            st.session_state['antenas'] = datos.get('antenas', [])
            st.session_state['poligonos'] = datos.get('poligonos', [])
            st.session_state['config_radio'] = datos.get('config_radio', {})
            st.session_state['map_center'] = datos.get('map_center', [10.27, -67.55])
            
            st.success("📂 Proyecto cargado correctamente.")
            st.rerun() # Forzar actualización de la interfaz
        except Exception as e:
            st.error(f"❌ Error al cargar el archivo: {e}")


def cost231_hata_loss(f_mhz, d_km, hb_m, hm_m, environment='Urbano/Suburbano'):
    """
    Calcular el Path Loss usando el Modelo Hata COST-231.
    f_mhz: 1500 - 2000 MHz
    d_km: 1 - 20 km
    hb_m: 30 - 200 m
    hm_m: 1 - 10 m
    """
    # Correction factor a(hm) for urban areas
    a_hm = 3.2 * (np.log10(11.75 * hm_m))**2 - 4.97
    
    # Environment constant C
    C = 3 if environment == 'Urbano Denso (Centro de la Ciudad)' else 0
    
    # Standard formula
    L = (46.3 + 33.9 * np.log10(f_mhz) - 13.82 * np.log10(hb_m) - a_hm + 
         (44.9 - 6.55 * np.log10(hb_m)) * np.log10(d_km) + C)
    
    return L


def okumura_hata(f, hte, hre, d, area_type='Urbano/Suburbano', city_size='Pequeña'):
    """
    Calcula la pérdida de trayectoria (path loss) usando Okumura-Hata.
    f: Frecuencia en MHz (150 - 1500)
    hte: Altura antena transmisora (30 - 200 m)
    hre: Altura antena receptora (1 - 10 m)
    d: Distancia en km (1 - 20 km)
    area_type: 'urban', 'suburban', 'open'
    city_size: 'small', 'large' (solo relevante si area_type es 'urban')
    """
    # 1. Corrección de altura del receptor (a(hre))
    if f <= 200:
        a_hre = (1.1 * math.log10(f) - 0.7) * hre - (1.56 * math.log10(f) - 0.8)
    else:
        a_hre = 3.2 * (math.log10(11.75 * hre))**2 - 4.97

    # 2. Pérdida básica en zona urbana (L_urban)
    L_urban = 69.55 + 26.16 * math.log10(f) - 13.82 * math.log10(hte) - a_hre + \
              (44.9 - 6.55 * math.log10(hte)) * math.log10(d)

    # 3. Ajuste por tipo de zona
    if area_type == 'Urbano Denso (Centro de la Ciudad)':
        if city_size == 'Grande' and f > 200:
            L_urban += 3.2 * (math.log10(11.75 * hre))**2 - 4.97 # Corrección Ciudad Grande
        return L_urban
    elif area_type == 'Urbano/Suburbano':
        return L_urban - 2 * (math.log10(f/28))**2 - 5.4
    elif area_type == 'Rural':
        return L_urban - 4.78 * (math.log10(f))**2 + 18.33 * math.log10(f) - 40.94
    else:
        return L_urban


def calcular_perdida_hata(f, h_tx, h_rx, d, zona):
    # Ecuación base urbana
    
    d = max(d, 0.01) 
    
    if f <= 1500:
        # Usar Okumura-Hata para frecuencias bajas (FM, 800/900 MHz)
        L = okumura_hata(f, h_tx, h_rx, d, area_type=zona)
    else:
        # Usar COST-231 para frecuencias altas (1800/1900 MHz, 2.1 GHz)
        L = cost231_hata_loss(f, d, h_tx, h_rx, environment=zona)
    
    return L


def calcular_bearing(lat1, lon1, lat2, lon2):
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_lon = math.radians(lon2 - lon1)
    
    y = math.sin(d_lon) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - \
        math.sin(phi1) * math.cos(phi2) * math.cos(d_lon)
    
    bearing = math.atan2(y, x)
    return math.degrees(bearing)


def calcular_distancia(lat1, lon1, lat2, lon2):
    # Radio de la Tierra en kilómetros
    R = 6371.0
    
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    
    a = math.sin(dphi / 2)**2 + \
        math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2)**2
    
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def distancia_punto_a_segmento(px, py, x1, y1, x2, y2):
    """
    Calcula la distancia mínima entre un punto (px, py) y un segmento (x1, y1) a (x2, y2).
    Útil para medir la invasión lateral al eje del enlace.
    """
    dx, dy = x2 - x1, y2 - y1
    if dx == 0 and dy == 0:
        return math.sqrt((px - x1)**2 + (py - y1)**2)

    # Proyección del punto en la línea
    t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)
    
    if t < 0:
        nearest_x, nearest_y = x1, y1
    elif t > 1:
        nearest_x, nearest_y = x2, y2
    else:
        nearest_x, nearest_y = x1 + t * dx, y1 + t * dy

    dist_grados = math.sqrt((px - nearest_x)**2 + (py - nearest_y)**2)
    # Convertir grados a metros aproximadamente (1 grado ~ 111,320 metros)
    return dist_grados * 111320


def analizar_obstrucciones_laterales(enlace_coords, h_tx_abs, h_rx_abs, obstaculos_poligonos, frecuencia_mhz):
    """
    Revisa si los polígonos (edificios) invaden el radio de Fresnel lateralmente.
    """
    lat1, lon1 = enlace_coords[0]
    lat2, lon2 = enlace_coords[1]
    
    dist_total_km = calcular_distancia(lat1, lon1, lat2, lon2)
    conflictos_laterales = []
    f_ghz = frecuencia_mhz / 1000

    for poly in poligonos:
        coords = poly['geometry']['coordinates'][0]
        h_obstaculo_msnm = poly.get('altura', 10.0) # Altura del edificio sobre el nivel del mar
        for lon_p, lat_p in coords:
            # 1. Distancia lateral al eje central (ancho)
            d_lat = distancia_punto_a_segmento(lon_p, lat_p, lon1, lat1, lon2, lat2)
            h_p = get_elevation(lat_p, lon_p, path=PATH_HGT)
            # 2. Calcular en qué punto del enlace (0 a 1) se encuentra este vértice
            # Reutilizamos la lógica de proyección para saber a qué distancia de la antena TX está
            dx, dy = lon2 - lon1, lat2 - lat1
            t = ((lon_p - lon1) * dx + (lat_p - lat1) * dy) / (dx**2 + dy**2)
            t = max(0, min(1, t))
            
            d1 = t * dist_total
            d2 = dist_total - d1
            
            # 3. Radio de Fresnel Teórico (R) y Altura del rayo (h_LOS) en ese punto
            r_f = 17.32 * math.sqrt((d1 * d2) / (f_ghz * dist_total)) if dist_total > 0 else 0
            h_los_punto = h_tx_abs + t * (h_rx_abs - h_tx_abs)
            
            # 4. LÓGICA 3D: ¿A qué altura empieza el elipsoide en esta desviación lateral?
            # Si d_lat > r_f, el punto está fuera del ancho del elipsoide por completo.
            if d_lat < r_f:
                # El ancho disponible del elipsoide a esa distancia lateral es:
                # h_disponible = sqrt(R^2 - d_lat^2)
                h_fresnel_relativa = math.sqrt(r_f**2 - d_lat**2)
                cota_inferior_fresnel = h_los_punto - h_fresnel_relativa
                
                if h_obstaculo_msnm + h_p > (h_los_punto - 0.6 * h_fresnel_relativa):
                    conflictos_laterales.append({
                        "tipo": "LATERAL_3D",
                        "dist_eje": d_lat,
                        "h_invadida": h_obstaculo_msnm - cota_inferior_fresnel
                    })
                
    return conflictos_laterales


def mostrar_tabla_absorcion():
    datos = {
        "Frecuencia (GHz)": [1, 10, 23, 26, 38, 60, 80],
        "Absorción (dB/km)": [0.003, 0.01, 0.15, 0.12, 0.35, 15.0, 0.40],
        "Fenómeno Principal": [
            "Mínima atenuación", 
            "Casi despreciable", 
            "Pico de Vapor de Agua", 
            "Ventana de propagación", 
            "Atenuación moderada", 
            "Pico de absorción de Oxígeno", 
            "Banda E (Ondas milimétricas)"
        ]
    }
    return pd.DataFrame(datos)


def obtener_color_por_rssi(rssi):
    try:
        # Recuperamos las fronteras definidas por el usuario en la interfaz
        um_exc, um_ace, um_deb = st.session_state['umbrales_rssi']
    except (KeyError, ValueError):
        # Valores por defecto de fábrica por si acaso
        um_exc, um_ace, um_deb, um_mal, um_pes = -51, -57, -63, -70, -75
        
    if rssi >= um_exc: return "#FF0000"  # Rojo
    if rssi >= um_ace: return "#FF8700"  # Naranja
    if rssi >= um_deb: return "#FFFF00"  # Amarillo
    if rssi >= um_mal: return "#30FF30"  # Verde
    if rssi >= um_pes: return "#0020FF"  # Azul
    return "#9600C6"


def generar_kml_ptp(punto_a, punto_b, h_TX, h_RX, obstaculos, freq_mhz, nombre_tx='Estación A', nombre_rx='Estación B'):
    kml = simplekml.Kml()

    # 1. Dibujar la línea del enlace (PTP)
    lin = kml.newlinestring(name="Enlace PTP")
    lin.coords = [
        (punto_a['lon'], punto_a['lat'], h_TX),
        (punto_b['lon'], punto_b['lat'], h_RX)
    ]
    lin.altitudemode = simplekml.AltitudeMode.absolute
    lin.style.linestyle.color = simplekml.Color.green
    lin.style.linestyle.width = 3
    freq_ghz = freq_mhz / 1000
    lon1, lat1, alt1 = punto_a['lon'], punto_a['lat'], h_TX
    lon2, lat2, alt2 = punto_b['lon'], punto_b['lat'], h_RX
    
    dist_total_km = calcular_distancia(lat1, lon1, lat2, lon2)
    num_segmentos = 50
    puntos_por_anillo = 12

    # 2. Agregar Obstáculos Artificiales como polígonos 3D (Extruidos)
    for i, obs in enumerate(obstaculos):
        pol = kml.newpolygon(name=f"Obstáculo {i+1}")
        # Extraemos coordenadas del GeoJSON de tu mapa
        coords = obs['geometry']['coordinates'][0]
        altura = obs.get('altura', 50) # Altura definida por el usuario
        pol.outerboundaryis = [(c[0], c[1], altura) for c in coords]
        pol.altitudemode = simplekml.AltitudeMode.relativetoground
        pol.extrude = 1 # Esto hace que el polígono suba desde el suelo
        pol.style.polystyle.color = simplekml.Color.changealphaint(150, simplekml.Color.red)
    
        
    anillos = []
    for i in range(num_segmentos + 1):
        f = i / num_segmentos
        d1 = f * dist_total_km
        d2 = (1 - f) * dist_total_km
        r_f = 17.32 * math.sqrt((d1 * d2) / (freq_ghz * dist_total_km)) if d1*d2 > 0 else 0
            
        c_lat = lat1 + f * (lat2 - lat1)
        c_lon = lon1 + f * (lon2 - lon1)
        c_alt = alt1 + f * (alt2 - alt1)
                
        puntos = []
        for j in range(puntos_por_anillo):
            ang = 2 * math.pi * j / puntos_por_anillo
            z = c_alt + r_f * math.sin(ang)
            lat_off = (r_f * math.cos(ang)) / 111320
            puntos.append((c_lon, c_lat + lat_off, z))
        anillos.append(puntos)
            
            
    for i in range(len(anillos) - 1):
        for j in range(puntos_por_anillo):
            p1_anillo = anillos[i][j]
            p2_anillo = anillos[i][(j+1)%puntos_por_anillo]
            p3_anillo = anillos[i+1][(j+1)%puntos_por_anillo]
            p4_anillo = anillos[i+1][j]
                    
            pol = kml.newpolygon(name=f"Fresnel_Segmento_{i}_{j}")
            pol.outerboundaryis = [p1_anillo, p2_anillo, p3_anillo, p4_anillo, p1_anillo]
            pol.altitudemode = simplekml.AltitudeMode.absolute
            # Color Cyan translúcido (50% opacidad)
            pol.style.polystyle.color = '7f00ffff' 
            pol.style.linestyle.width = 0
    
    # 1. El Mástil (Tubo Gris)
    # Lo simulamos con una línea gruesa extruida o un polígono pequeño
    mastil1 = kml.newpoint(name=f"{nombre_tx}", coords=[(lon1, lat1, alt1)])
    mastil1.altitudemode = simplekml.AltitudeMode.absolute
    mastil1.extrude = 1 # Crea la línea hacia el suelo
    mastil1.style.linestyle.width = 5
    mastil1.style.linestyle.color = 'ff808080' # Gris
    
    # 2. El Panel (Rectángulo Blanco)
    # Calculamos hacia dónde debe mirar
    angulo = calcular_bearing(lat1, lon1, lat2, lon2)
    theta = math.radians(angulo)
    # Creamos un rectángulo pequeño (ej. 1 metro de ancho)
    # Ajustamos las coordenadas para que rote según el ángulo
    dist_panel = 0.00001 # Unos pocos metros en grados
    
    # Coordenadas simplificadas para el panel frontal
    p1 = (lon1 - dist_panel*math.cos(theta), lat1 + dist_panel*math.sin(theta), h_TX + 1)
    p2 = (lon1 + dist_panel*math.cos(theta), lat1 - dist_panel*math.sin(theta), h_TX + 1)
    p3 = (lon1 + dist_panel*math.cos(theta), lat1 - dist_panel*math.sin(theta), h_TX - 1)
    p4 = (lon1 - dist_panel*math.cos(theta), lat1 + dist_panel*math.sin(theta), h_TX - 1)
    
    panel1 = kml.newpolygon(name=f"Panel A")
    panel1.outerboundaryis = [p1, p2, p3, p4, p1]
    panel1.altitudemode = simplekml.AltitudeMode.absolute
    panel1.style.polystyle.color = 'ffffffff' # Blanco sólido
    panel1.style.polystyle.fill = 1
    
    # 1. El Mástil (Tubo Gris)
    # Lo simulamos con una línea gruesa extruida o un polígono pequeño
    mastil2 = kml.newpoint(name=f"{nombre_rx}", coords=[(lon2, lat2, alt2)])
    mastil2.altitudemode = simplekml.AltitudeMode.absolute
    mastil2.extrude = 1 # Crea la línea hacia el suelo
    mastil2.style.linestyle.width = 5
    mastil2.style.linestyle.color = 'ff808080' # Gris
    
    # 2. El Panel (Rectángulo Blanco)
    # Calculamos hacia dónde debe mirar
    angulo = calcular_bearing(lat2, lon2, lat1, lon1)
    theta = math.radians(angulo)
    # Coordenadas simplificadas para el panel frontal
    p12 = (lon2 - dist_panel*math.cos(theta), lat2 + dist_panel*math.sin(theta), h_RX + 1)
    p22 = (lon2 + dist_panel*math.cos(theta), lat2 - dist_panel*math.sin(theta), h_RX + 1)
    p32 = (lon2 + dist_panel*math.cos(theta), lat2 - dist_panel*math.sin(theta), h_RX - 1)
    p42 = (lon2 - dist_panel*math.cos(theta), lat2 + dist_panel*math.sin(theta), h_RX - 1)
    
    panel2 = kml.newpolygon(name=f"Panel B")
    panel2.outerboundaryis = [p12, p22, p32, p42, p12]
    panel2.altitudemode = simplekml.AltitudeMode.absolute
    panel2.style.polystyle.color = 'ffffffff' # Blanco sólido
    panel2.style.polystyle.fill = 1

    return kml.kml()


def generar_kml_cobertura(resultados_simulacion, p_antena, h, obstaculos, nombre_estacion='Estación'):
    kml = simplekml.Kml()
    
    fol = kml.newfolder(name="Cobertura de Radio (dBm)")
    
    # Dibujar los Obstáculos Artificiales (Edificios/Polígonos)
    for i, obs in enumerate(obstaculos):
        pol = kml.newpolygon(name=f"Obstáculo {i+1}")
        coords = obs['geometry']['coordinates'][0]
        altura = obs.get('altura', 10.0) # Ajustado a un estándar de 10m por si acaso
        pol.outerboundaryis = [(c[0], c[1], altura) for c in coords]
        pol.altitudemode = simplekml.AltitudeMode.relativetoground
        pol.extrude = 1 
        # Pintamos los edificios de color gris translúcido para que luzcan profesionales
        pol.style.polystyle.color = '99808080' 
    
    # 2. Dibujar la Antena Base como punto de referencia absoluto
    alt_suelo_base = get_elevation(p_antena['lat'], p_antena['lon'], path=PATH_HGT)
    mastil1 = kml.newpoint(
        name=f"{nombre_estacion}", 
        coords=[(p_antena['lon'], p_antena['lat'], h + alt_suelo_base)]
    )
    mastil1.altitudemode = simplekml.AltitudeMode.absolute
    mastil1.extrude = 1 
    mastil1.style.linestyle.width = 4
    mastil1.style.linestyle.color = 'ff0000ff' # Línea roja hacia el mástil

    # 3. Iterar sobre el diccionario GeoJSON o lista de resultados de los radiales
    sensibilidad = st.session_state['config_radio'].get('Sensibilidad', -95)

    # Datos estructurados en GeoJSON (mosaico de características)
    puntos = [
            (f["geometry"]["coordinates"][1], 
            f["geometry"]["coordinates"][0], 
            f["properties"]["rssi"], 
            f["properties"]["dist"], 
            f["properties"]["color"])
            for f in resultados_simulacion["features"]
        ]

    for lat, lon, rssi, dist, color in puntos:
        # Omitir señales que caigan por debajo de la sensibilidad configurada
        if rssi < sensibilidad: 
            continue 
        
        # Crear marcador pequeño en el suelo de Google Earth
        pnt = fol.newpoint(name="", coords=[(lon, lat, 1.5)]) # A la altura promedio de un receptor (1.5m)
        pnt.altitudemode = simplekml.AltitudeMode.relativetoground
        
        # --- PASO CLAVE: Consistencia de Color ---
        # Obtenemos el color hexadecimal y lo convertimos al formato inverso ABGR que lee Google Earth
        color_kml = hex_to_kml_color(color, alpha_hex="e6") # "e6" da un 90% de opacidad para que no opaque el relieve
        
        # Estilo del punto: Usamos un icono de círculo liso sin bordes
        pnt.style.iconstyle.icon.href = 'http://maps.google.com/mapfiles/kml/shapes/shaded_dot.png'
        pnt.style.iconstyle.color = color_kml
        pnt.style.iconstyle.scale = 0.45  # Tamaño compacto para que se pisen y luzcan homogéneos
        
        # Información técnica en el cuadro descriptivo al hacer clic en Google Earth
        pnt.description = f"<b>Nivel de Señal:</b> {rssi} dBm\n<b>Distancia a Base:</b> {dist} km"

    return kml.kml()


def hex_to_kml_color(hex_str, alpha_hex="ff"):
        # Limpiamos el '#' si viene en el string
        hex_clean = hex_str.lstrip('#')
        if len(hex_clean) == 6:
            r, g, b = hex_clean[0:2], hex_clean[2:4], hex_clean[4:6]
            # Google Earth usa: Alfa + Azul + Verde + Rojo
            return f"{alpha_hex}{b}{g}{r}"
        return "ff0000ff" # Rojo por defecto si hay error


def generar_cobertura_raster(lat_base, lon_base, config_radio, patron=None, zona="Urbano/Suburbano", l_cable_tx=0, loss_atm=0, resolucion=300):
    """
    Calcula la cobertura con la precisión exacta del disparo de radiales (Shadowing real),
    pero mapea el resultado a una matriz NumPy para un renderizado homogéneo ultra rápido.
    """
    radio_km = config_radio['radio_km']
    rssi_min = -100
    features = []
    
    # 1. Definir los límites geográficos exactos del recuadro (Bounding Box)
    delta_lat = radio_km / 111.32
    delta_lon = radio_km / (111.32 * math.cos(math.radians(lat_base)))
    
    lat_min, lat_max = lat_base - delta_lat, lat_base + delta_lat
    lon_min, lon_max = lon_base - delta_lon, lon_base + delta_lon
    
    # 2. Inicializar la matriz NumPy con NaNs (Zonas sin señal o fuera de rango)
    # Una resolución de 200x200 o 300x300 da una definición excelente
    rssi_matrix = np.full((resolucion, resolucion), np.nan)
    
    # Alturas de la base
    alt_suelo_base = get_elevation_batch([[lat_base, lon_base]], path=PATH_HGT)[0]
    alt_abs_tx = alt_suelo_base + config_radio['h_antena']
    
    # Pre-cargar polígonos para optimizar la búsqueda de obstáculos artificiales
    poligonos_lista = []
    for poly in st.session_state.get('poligonos', []):
        shape = Polygon(poly['geometry']['coordinates'][0])
        altura = poly.get('altura', 10.0)
        poligonos_lista.append((shape, altura))

    # --- PASO CRÍTICO DE OPTIMIZACIÓN EN LOTE (Batch) ---
    # Para no perder velocidad, calcularemos de antemano todas las coordenadas que tocarán los radiales
    coordenadas_radiales = []
    paso_angulo = st.session_state.get('paso_angulo', 3)
    paso_dist = st.session_state.get('paso_distancia', 0.15)
    
    lista_angulos = list(range(0, 360, paso_angulo))
    lista_distancias = list(np.arange(0.1, radio_km + paso_dist, paso_dist))
    
    for angulo in lista_angulos:
        for dist in lista_distancias:
            lat_d = lat_base + (dist * math.cos(math.radians(angulo))) / 111.32
            lon_d = lon_base + (dist * math.sin(math.radians(angulo))) / (111.32 * math.cos(math.radians(lat_base)))
            coordenadas_radiales.append((lat_d, lon_d))
            
    # Consultamos TODAS las elevaciones del relieve de una sola vez
    with st.spinner("Consultando relieve topográfico masivo..."):
        elevaciones_radiales = get_elevation_batch(coordenadas_radiales, path=PATH_HGT)
    
    # --- EJECUCIÓN DEL ALGORITMO CON PRECISIÓN DE RADIALES ---
    idx_elevacion = 0
    
    for angulo in lista_angulos:
        max_angulo_vista = -90.0  # Volvemos a inicializar el Shadowing real por cada radial
        
        for dist in lista_distancias:
            lat_d, lon_d = coordenadas_radiales[idx_elevacion]
            alt_suelo_dest = elevaciones_radiales[idx_elevacion]
            idx_elevacion += 1
            
            # --- BLOQUE DE OBSTÁCULOS ARTIFICIALES PRECIOS ---
            p_actual = Point(lon_d, lat_d)
            for shape, altura in poligonos_lista:
                if shape.contains(p_actual):
                    alt_suelo_dest += altura
                    break
            
            # Ángulo de elevación hacia el punto actual
            dif_h = alt_suelo_dest - alt_abs_tx
            angulo_hacia_punto = math.degrees(math.atan2(dif_h, dist * 1000))
            
            # --- SHADOWING CHECK ESTRICTO (Igual a tu código original) ---
            if angulo_hacia_punto > max_angulo_vista:
                max_angulo_vista = angulo_hacia_punto
                
                # Cálculo de pérdidas y balance de enlace
                g_total = obtener_ganancia_con_patron(patron, angulo, angulo_hacia_punto, config_radio['g_max'])
                Lp = calcular_perdida_hata(config_radio['frec'], config_radio['h_antena'], 1.5 + alt_suelo_dest, dist, zona)
                rssi = config_radio['p_tx'] + g_total - Lp - float(l_cable_tx) - float(loss_atm)
                
                if rssi >= rssi_min:
                    
                    feature = {
                        "type": "Feature",
                        "geometry": {
                            "type": "Point",
                            "coordinates": [lon_d, lat_d]  # [Longitud, Latitud] para GeoJSON
                        },
                        "properties": {
                            "rssi": round(rssi, 2),
                            "dist": round(dist, 2),
                            "color": obtener_color_por_rssi(rssi)
                        }
                    }
                    features.append(feature)
                    
                    # --- MAPEO GEOGRÁFICO DIRECTO A LA MATRIZ DE LA IMAGEN ---
                    # Convertimos la coordenada (lat_d, lon_d) en los índices de fila (y) y columna (x) de la matriz
                    y_idx = int((lat_max - lat_d) / (lat_max - lat_min) * (resolucion - 1))
                    x_idx = int((lon_d - lon_min) / (lon_max - lon_min) * (resolucion - 1))
                    
                    # Nos aseguramos de que no desborde la matriz por redondeo
                    if 0 <= y_idx < resolucion and 0 <= x_idx < resolucion:
                        # Si varios radiales tocan el mismo píxel, conservamos la señal más fuerte
                        if np.isnan(rssi_matrix[y_idx, x_idx]) or rssi > rssi_matrix[y_idx, x_idx]:
                            rssi_matrix[y_idx, x_idx] = rssi
            else:
                # ZONA DE SOMBRA REAL: El obstáculo bloquea la señal, no se asigna RSSI (queda como NaN)
                continue
                
    bounds = [[float(lat_min), float(lon_min)], [float(lat_max), float(lon_max)]]
    return rssi_matrix, bounds, {"type": "FeatureCollection", "features": features}


def preparar_estudio_cobertura():
    if st.session_state.get("json_patron_cobertura"):
        # Leer y normalizar el JSON que subiste
        raw_data = json.load(st.session_state["json_patron_cobertura"])
        p_az, p_el = procesar_patron_json(raw_data) 
        
        config_estudio = {
            "usar_patron": True,
            "patron_az": p_az,
            "patron_el": p_el,
            "orientacion": {
                "azimuth": st.session_state["az_cob"],
                "elevation": st.session_state["el_cob"],
                "ganancia_max": st.session_state["g_max"] # El valor de dBi del sidebar
            }
        }
    else:
        config_estudio = {"usar_patron": False}
        
    return config_estudio


def procesar_patron_json(file_data, indice_frecuencia=0):
    """
    Procesa un archivo .json de patrones, normaliza a 0 dB y extrae los
    arreglos de ganancia para Azimuth (H) y Elevación (V).
    """
    try:
        data_json = json.loads(file_data.getvalue().decode("utf-8"))
        
        if 'datos_2d' not in data_json:
            st.error("El JSON no contiene la estructura raíz 'datos_2d'.")
            return None, None
            
        datos_2d = data_json['datos_2d']
        
        # Procesar Azimuth (Horizontal)
        p_horiz = None
        if 'azimuth_sets' in datos_2d and len(datos_2d['azimuth_sets']) > indice_frecuencia:
            az_set = datos_2d['azimuth_sets'][indice_frecuencia]
            gain_az = np.array(az_set['gain'])
            # Normalización (El pico máximo se convierte en 0 dB)
            p_horiz = (gain_az - np.max(gain_az)).tolist()
            
        # Procesar Elevación (Vertical)
        p_vert = None
        if 'elevation_sets' in datos_2d and len(datos_2d['elevation_sets']) > indice_frecuencia:
            el_set = datos_2d['elevation_sets'][indice_frecuencia]
            gain_el = np.array(el_set['gain'])
            # Normalización
            p_vert = (gain_el - np.max(gain_el)).tolist()
            
        return p_horiz, p_vert
        
    except Exception as e:
        st.error(f"Error al procesar el archivo JSON: {e}")
        return None, None


def obtener_ganancia_con_patron(config, angulo_real, elevacion_real, ganancia_max):
    if config["tipo"] == "Omnidireccional (Ideal)" or config["patron"] is None:
        return ganancia_max
    
    patron = config["patron"]
    
    # -------------------------------------------------------------
    # CASO 1: ARCHIVOS JSON (Resolución variable: 1°, 5°, etc.)
    # -------------------------------------------------------------
    if "angulos_h" in patron and "angulos_v" in patron:
        # 1. Calcular el azimuth relativo de 0 a 360°
        target_h = (float(angulo_real) - float(config["azimuth"])) % 360
        
        # CORRECCIÓN DE RANGO: Si el JSON maneja formato de -180 a 180, convertimos los ángulos mapeados
        angulos_h = np.array(patron["angulos_h"])
        if angulos_h.min() < 0: # Detecta automáticamente si el JSON usa ángulos negativos
            if target_h > 270:
                target_h -= 360  # Transforma por ejemplo 315° en -45°
        
        # Encontrar el índice del ángulo más cercano para Horizontal
        idx_h = np.abs(angulos_h - target_h).argmin()
        atenuacion_h = patron["h"][idx_h]
        
        # 2. Calcular la elevación relativa (Dejamos la lógica original pero limpia)
        target_v = (90.0 + (float(elevacion_real) - float(config["elevation"]))) % 360
        
        angulos_v = np.array(patron["angulos_v"])
        # Aplicamos la misma validación por si el plano vertical del JSON también usa rango negativo
        if angulos_v.min() < 0 and target_v > 270:
            target_v -= 360
            
        idx_v = np.abs(angulos_v - target_v).argmin()
        atenuacion_v = patron["v"][idx_v]
        
    # -------------------------------------------------------------
    # CASO 2: ARCHIVOS .ANT CLÁSICOS (Puntos fijos indexados de 1° en 1°)
    # -------------------------------------------------------------
    else:
        # Azimuth relativo (Horizontal)
        off_h = int(float(angulo_real)-float(config["azimuth"])) % 360
        
        # Elevación relativa (Vertical): el archivo clásico .ant empieza en +90° (índice 0)
        off_v = int(90 + (float(elevacion_real)-float(config["elevation"]))) % 360
        
        atenuacion_h = patron["h"][off_h]
        atenuacion_v = patron["v"][off_v]
    
    # Retornar la ganancia neta combinada
    return ganancia_max + atenuacion_h + atenuacion_v


def calcular_orientacion_geografica(lat1, lon1, lat2, lon2, alt1, alt2):
    """Calcula Azimuth y Elevación recomendados."""
    # Azimuth usando math.atan2
    dLon = math.radians(lon2 - lon1)
    y = math.sin(dLon) * math.cos(math.radians(lat2))
    x = math.cos(math.radians(lat1)) * math.sin(math.radians(lat2)) - \
        math.sin(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.cos(dLon)
    azimuth = (math.degrees(math.atan2(y, x)) + 360) % 360
    
    # Elevación (Tilt)
    dist_m = geodesic((lat1, lon1), (lat2, lon2)).meters
    diff_alt = alt1 - alt2
    tilt = math.degrees(math.atan2(diff_alt, dist_m))
    
    return round(azimuth, 2), round(tilt, 2)


def calcular_curvatura_tierra(dist_km, r_tierra=6371):
    """Calcula la caída por curvatura terrestre (modelo k=4/3 para radio estándar)."""
    k = 4/3
    return (dist_km**2) / (2 * k * r_tierra) * 1000 # Retorna en metros


def calcular_fresnel(dist_total, dist_d1, frecuencia_mhz):
    """Calcula el radio de la 1era zona de Fresnel en metros."""
    # f en GHz para la fórmula estándar
    f_ghz = frecuencia_mhz / 1000
    d2 = dist_total - dist_d1
    if dist_total == 0: return 0
    return 17.32 * math.sqrt((dist_d1 * d2) / (f_ghz * dist_total))


def analizar_obstrucciones_completo(distancias, elevaciones, los_line, radios_fresnel):
    puntos_conflicto = []
    bloqueo_total = False
    max_invasion_fresnel = 0

    for i in range(len(elevaciones)):
        # Altura del terreno + obstáculo en ese punto
        h_terreno = elevaciones[i]
        h_los = los_line[i]
        r_f = radios_fresnel[i]
        
        # 1. Verificar Bloqueo Total (Corta la línea azul)
        if h_terreno >= h_los:
            bloqueo_total = True
            puntos_conflicto.append({'dist': distancias[i], 'tipo': 'TOTAL'})
        
        # 2. Verificar Invasión de Fresnel (Entra en la zona verde)
        # Se considera obstrucción si invade más del 60% (norma ITU-R)
        h_critica = h_los - (0.6 * r_f)
        if h_terreno > h_critica and h_terreno < h_los:
            puntos_conflicto.append({'dist': distancias[i], 'tipo': 'PARCIAL'})
            
    return bloqueo_total, puntos_conflicto


def calcular_balance_enlace(dist_km, freq_mhz, p_tx_dbm, g_tx_dbi, g_rx_dbi, l_cable_tx, l_cable_rx, loss_atm, bloq_tot, conflictos, conflictos_lat):
    """Calcula el nivel de señal recibida (RSSI) en dBm."""
    # 1. Pérdidas en Espacio Libre (FSPL)
    # Fórmula: FSPL = 20log10(d) + 20log10(f) + 32.44
    
    if dist_km <= 0: return 0
    
    atenuacion_obstaculos = 0
    

    if bloq_tot:
        atenuacion_obstaculos = 100 # Penalización masiva (Enlace caído)
        estado_enlace = "❌ BLOQUEADO"
    else:
        # Contamos cuántas áreas distintas de conflicto hay
        # (Agrupamos puntos cercanos para no contar el mismo cerro varias veces)
        num_obstaculos = len(set([round(p['dist'], 2) for p in conflictos]))
        
        if num_obstaculos > 0:
            # 6dB por el primero (Knife-edge básico) + 3dB por cada extra
            atenuacion_obstaculos = 6 + (num_obstaculos - 1) * 3
            estado_enlace = f"⚠️ DESPEJADO PARCIAL ({num_obstaculos} roces)"
        else:
            atenuacion_obstaculos = 0
            estado_enlace = "✅ DESPEJADO TOTAL"
    
    fspl = 20 * math.log10(dist_km) + 20 * math.log10(freq_mhz) + 32.44
    
    eirp = p_tx_dbm - l_cable_tx + g_tx_dbi
    
    l_atm = loss_atm * dist_km
    net_path_loss = fspl + l_atm
    
    # 2. RSSI Teórico = Potencia + Ganancias - Pérdidas
    rssi = eirp - net_path_loss + g_rx_dbi - l_cable_rx - atenuacion_obstaculos
    
    if conflictos_lat:
        atenuacion_extra_lat = 3.0 * len(conflictos_lat) # Penalización estimada
        st.warning(f"⚠️ **Alerta de Despejamiento Lateral:** Se detectaron {len(conflictos_lat)} puntos donde estructuras invaden el elipsoide lateral.")
        st.info("Esto puede causar desvanecimiento por difracción de borde vertical (edificios cercanos).")
        # Restar al RSSI final
        rssi -= atenuacion_extra_lat
    
    # 3. Penalización por obstrucción (Aproximación simple)
    # Si el terreno toca la zona de Fresnel, restamos un margen de seguridad
        
    return round(rssi, 2), round(fspl, 2), round(eirp, 2), round(net_path_loss, 2), estado_enlace, atenuacion_obstaculos


def procesar_patron_ant(file_data):
    """Procesa un archivo .ant de 720 líneas (360 Horiz + 360 Vert)"""
    try:
        # Leer el contenido del archivo subido
        content = file_data.getvalue().decode("utf-8")
        lineas = [float(l.strip()) for l in content.split('\n') if l.strip()]
            
        if len(lineas) >= 720:
            p_horiz = lineas[:360]
            p_vert = lineas[360:720]
            return p_horiz, p_vert
        else:
            st.error("El archivo no contiene las 720 líneas requeridas.")
            return None, None
    except Exception as e:
        st.error(f"Error al procesar el patrón: {e}")
        return None, None


def configurar_antena(label, key_suffix):
    st.markdown(f"**Configuración de directividad {label}**")
        
    tipo_patron = st.radio(
        f"Patrón de Radiación ({label})",
        ["Omnidireccional (Ideal)", "Cargar Archivo (.ant)", "Cargar Archivo (.json)"],
        key=f"tipo_patron_{key_suffix}"
    )
        
    patron_parsed = None
    frecuencia_seleccionada = None
    
    # CASO 1: Archivo clásico .ant
    if tipo_patron == "Cargar Archivo (.ant)":
        archivo = st.file_uploader(f"Subir patrón {label} (.ant)", type=["ant", "txt"], key=f"file_ant_{key_suffix}")
        if archivo:
            p_h, p_v = procesar_patron_ant(archivo)
            if p_h and p_v:
                st.success(f"Patrón de {label} (.ant) cargado correctamente.")
                patron_parsed = {"h": p_h, "v": p_v}

    # CASO 2: Archivo moderno .json con múltiples frecuencias
    elif tipo_patron == "Cargar Archivo (.json)":
        archivo = st.file_uploader(f"Subir patrón {label} (.json)", type=["json"], key=f"file_json_{key_suffix}")
        if archivo:
            try:
                # Leemos temporalmente el JSON para descubrir qué frecuencias contiene
                raw_data = json.loads(archivo.getvalue().decode("utf-8"))
                sets_frecuencias = raw_data.get('datos_2d', {}).get('azimuth_sets', [])
                lista_freqs = [f.get('freq') for f in sets_frecuencias if 'freq' in f]
                
                if lista_freqs:
                    # Desplegar selector de frecuencia dinámico
                    freq_elegida = st.selectbox(
                        "Selecciona el patrón a utilizar:",
                        options=lista_freqs,
                        format_func=lambda x: f"{x} MHz",
                        key=f"freq_select_{key_suffix}"
                    )
                    idx_freq = lista_freqs.index(freq_elegida)
                    frecuencia_seleccionada = freq_elegida
                else:
                    idx_freq = 0
                
                # Procesamos usando el índice de la frecuencia seleccionada
                p_h, p_v = procesar_patron_json(archivo, indice_frecuencia=idx_freq)
                
                if p_h and p_v:
                    st.success(f"Patrón de {label} (.json) cargado con éxito.")
                    # Extraemos el vector original de ángulos directamente del JSON para pasárselo a Plotly
                    archivo.seek(0) # Reiniciar lectura
                    raw_json = json.loads(archivo.getvalue().decode("utf-8"))
                    
                    # Obtenemos las listas de ángulos reales (los 73 elementos)
                    angulos_h = raw_json['datos_2d']['azimuth_sets'][idx_freq]['angles']
                    angulos_v = raw_json['datos_2d']['elevation_sets'][idx_freq]['angles']
                    
                    patron_parsed = {
                        "h": p_h, 
                        "v": p_v,
                        "angulos_h": angulos_h,
                        "angulos_v": angulos_v
                    }
                    
            except Exception:
                st.error("El archivo JSON no tiene un formato válido.")

    col_az, col_el = st.columns(2)
    azimuth = col_az.number_input(f"Azimuth (0-360°)", value=0.0, step=1.0, key=f"az_{key_suffix}")
    elevation = col_el.number_input(f"Elevación (-90/90°)", value=0.0, step=0.1, key=f"el_{key_suffix}")

    return {
        "tipo": tipo_patron, 
        "patron": patron_parsed, 
        "azimuth": azimuth, 
        "elevation": elevation,
        "frecuencia_patron": frecuencia_seleccionada
    }


components.html(
    """
    <script>
    const STORAGE_KEY = 'streamlit_scroll_persistence';
    
    // Función para aplicar el scroll guardado
    const restoreScroll = () => {
        const savedPos = sessionStorage.getItem(STORAGE_KEY);
        if (savedPos) {
            window.parent.scrollTo({
                top: parseInt(savedPos),
                behavior: 'instant'
            });
        }
    };

    // Guardar posición continuamente mientras el usuario scrollea
    window.parent.addEventListener('scroll', () => {
        sessionStorage.setItem(STORAGE_KEY, window.parent.scrollY);
    });

    // Ejecutar restauración al cargar y tras pequeños cambios de renderizado
    restoreScroll();
    setTimeout(restoreScroll, 100); // Doble verificación por delay de renderizado
    </script>
    """,
    height=0,
)

# --- 1. Configuración de Página y Estilo ---
icon = Image.open("logo-upt-aragua.png")
st.set_page_config(page_title="RadioLink Designer - UPT Aragua", page_icon=icon, layout="wide")


st.markdown("""
    <style>
    .main { background-color: #f5f7f9; }
    .stButton>button { width: 100%; border-radius: 5px; height: 3em; background-color: #007bff; color: white; }
    /* Reduce el espacio superior (padding) del contenedor principal */
        .block-container {
            padding-top: 1rem !important;
            padding-bottom: 0rem !important;
            max-width: 95% !important;
        }
        
        /* Elimina el espacio vacío que deja la barra de menú superior de Streamlit */
        stHeader {
            background-color: transparent !important;
            height: 2.5rem !important;
        }
    /* Hace que las etiquetas (labels) de st.metric permitan saltos de línea y achiquen la letra si es necesario */
        [data-testid="stMetricLabel"] {
            font-size: 0.85rem !important; /* Un poco más pequeña para que quepa */
            white-space: normal !important; /* Permite que el texto baje a una segunda línea si no cabe */
            word-break: break-word !important;
            line-height: 1.2 !important;
            min-height: 2.4rem; /* Mantiene alineadas las métricas aunque una ocupe 2 líneas */
        }
        /* Ajusta el tamaño del valor principal de la métrica por si los km o dBm se cortan */
        [data-testid="stMetricValue"] {
            font-size: 1.6rem !important;
        }
    </style>
    """, unsafe_allow_html=True)

st.markdown("<div id='seccion_mapa'></div>", unsafe_allow_html=True)

# --- 2. Título e Instrucciones ---
st.title("📡 RadioLink Designer UPT Aragua")


# --- INICIALIZACIÓN DE ESTADOS ---
#inicializar_estados()
if 'antenas' not in st.session_state:
    st.session_state['antenas'] = [] # Lista de diccionarios {id, lat, lon}
    antenas = []
else:
    antenas = list(st.session_state['antenas'])
if 'poligonos' not in st.session_state:
    st.session_state['poligonos'] = []
    poligonos = []
else:
    poligonos = list(st.session_state['poligonos'])
if 'ejecutar_calculo' not in st.session_state:
    st.session_state['ejecutar_calculo'] = False
if 'enlace' not in st.session_state:
    st.session_state['enlace'] = {}
if 'map_center' not in st.session_state:
    st.session_state['map_center'] = [10.2717, -67.5563] # Coordenada inicial
if 'map_zoom' not in st.session_state:
    st.session_state['map_zoom'] = 13
if 'config_radio' not in st.session_state:
    st.session_state['config_radio'] = {
            'frecuencia_mhz': 450,
            'Potencia': 27.0,
            'Altura_TX': 15.0,
            'Altura_RX': 10.0,
            'Ganancia_TX': 3.0,
            'Ganancia_RX': 3.0,
            'Sensibilidad': -75.0,
            'Loss_RX': 2.0,
            'Loss_TX': 2.0,
            'modelo_propagacion': 'Okumura-Hata'
    }

if 'current_geojson_cobertura' in st.session_state and st.session_state['current_geojson_cobertura']:
    # Usamos la longitud de los datos para cambiar el key si el tamaño varía
    map_key = f"mapa_cobertura_{len(st.session_state['current_geojson_cobertura'])}"
else:
    map_key = "mapa_cobertura_vacio"

# --- 3. Sidebar: Parámetros Técnicos ---
with st.sidebar:
    st.title("📡 Gestión de Estaciones")
    
    with st.container(border=True):
        st.markdown("### 🗺️ Configuración General")
        modo_estudio = st.radio("Modo de Análisis", ["Mapa de Cobertura", "Punto a Punto (PTP)"], key="selector_modo")
        
        frecuencia = st.number_input("Frecuencia (MHz)", value=st.session_state['config_radio']['frecuencia_mhz'], step=100)
        st.session_state['config_radio']['frecuencia_mhz'] = frecuencia
    
    with st.container(border=True):
        if modo_estudio == "Punto a Punto (PTP)":
            if len(st.session_state['antenas']) >= 2:            
                with st.expander("🛠️ Parámetros de Enlace", expanded=True):
                    
                    st.markdown("### Estaciones:")
                    
                    nombres = [f"Antena {a['id']}" for a in st.session_state['antenas']]
                    antena_a = st.selectbox("Estación Origen (TX)", nombres, index=0)
                    antena_b = st.selectbox("Estación Destino (RX)", nombres, index=1)

                    
                    if st.session_state['enlace']!={} :
                        if antena_a == st.session_state['enlace']['A'] and antena_b == st.session_state['enlace']['B']:
                            st.success(f"##### Enlace actual: {antena_a} ↔ {antena_b}")
                        
                        else:
                            st.success(f"##### Enlace nuevo: {antena_a} ↔ {antena_b}")
                            if st.button("Procesar", type="primary", width='stretch'):
                                # Validamos si la distancia es ridículamente grande para alertar al usuario
                                id_tx = int(antena_a.split()[-1]) - 1
                                id_rx = int(antena_b.split()[-1]) - 1
                                tx_data = st.session_state['antenas'][id_tx]
                                rx_data =st.session_state['antenas'][id_rx]
                                    
                                distancia_estimada = calcular_distancia(tx_data['lat'], tx_data['lon'], rx_data['lat'], rx_data['lon'])
                                st.session_state['ejecutar_calculo'] = True
                        
                        if st.session_state['ejecutar_calculo'] and distancia_estimada > 40.0:
                            st.warning(f"⚠️ Enlace muy largo ({distancia_estimada:.1f} km). El cálculo con terreno real puede tardar unos segundos.")
                                

                with st.expander("📡 Parámetros de Antena TX"):
                    h_tx = st.number_input("Altura TX (m)", value=st.session_state['config_radio']['Altura_TX'])
                    potencia_tx = st.number_input("Potencia Radio (dBm)", value=st.session_state['config_radio']['Potencia'], step=1.0)
                    g_tx = st.number_input("Ganancia Antena TX (dBi)", value=st.session_state['config_radio']['Ganancia_TX'], step=0.1)
                    l_cable_tx = st.number_input("Pérdidas de Cable/Conector TX (dB)", value=st.session_state['config_radio']['Loss_TX'], step=0.1)
                    st.session_state['config_radio']['Altura_TX'] = h_tx
                    st.session_state['config_radio']['Potencia'] = potencia_tx
                    st.session_state['config_radio']['Ganancia_TX'] = g_tx
                    st.session_state['config_radio']['Loss_TX'] = l_cable_tx
            
                with st.expander("📡 Parámetros de Antena RX"):
                    h_rx = st.number_input("Altura RX (m)", value=st.session_state['config_radio']['Altura_RX'])
                    sensibilidad = st.number_input("Sensibilidad del Receptor (dBm)", value=st.session_state['config_radio']['Sensibilidad'])
                    g_rx = st.number_input("Ganancia Antena (dBi)", value=st.session_state['config_radio']['Ganancia_RX'], step=0.1)
                    l_cable_rx = st.number_input("Pérdidas de Cable/Conector RX (dB)", value=st.session_state['config_radio']['Loss_RX'], step=0.1)
                    st.session_state['config_radio']['Altura_RX'] = h_rx
                    st.session_state['config_radio']['Sensibilidad'] = sensibilidad
                    st.session_state['config_radio']['Ganancia_RX'] =  g_rx
                    st.session_state['config_radio']['Loss_RX'] = l_cable_rx
                
                with st.expander("🌍 Factores Ambientales"):
                    def sugerir_absorcion(freq_mhz):
                        f_ghz = freq_mhz / 1000
                        if f_ghz < 10: return 0.01
                        elif 20 <= f_ghz <= 24: return 0.15 # Pico de agua
                        elif 50 <= f_ghz <= 70: return 15.0 # Bloqueo por oxígeno
                        else: return 0.12 # Valor base para microondas altas
                    
                    valor_sugerido = sugerir_absorcion(frecuencia)
                    
                    abs_atm = st.number_input("Absorción Atmosférica (dB/km)", value=valor_sugerido, step=0.01, 
                                              help="Puedes Consultar Una Tabla")
                    with st.expander("📚 Referencia de Absorción Atmosférica"):
                        st.write("Valores típicos según la norma ITU-R P.676:")
                        df_abs = mostrar_tabla_absorcion()
                        st.table(df_abs)
                        st.caption("Nota: Los valores pueden variar según la humedad relativa y la temperatura.")
                
                with st.expander(f"Configurar {antena_a}", expanded=False):
                    config_tx = configurar_antena("TX", "tx")
                    st.session_state['config_radio']['config_TX']=config_tx
                
                with st.expander(f"Configurar {antena_b}", expanded=False):
                    config_rx = configurar_antena("RX", "rx")
                    st.session_state['config_radio']['config_RX']=config_rx
                
                if st.session_state['ejecutar_calculo'] or st.session_state['enlace']=={}:
                    idx_a = int(antena_a.split()[-1]) - 1
                    idx_b = int(antena_b.split()[-1]) - 1
                    ant_a_data = st.session_state['antenas'][idx_a]
                    ant_b_data = st.session_state['antenas'][idx_b]
                    visual_a = antena_a
                    visual_b = antena_b
                    st.session_state['enlace'] = {"ant_a": ant_a_data, "ant_b": ant_b_data, "A": antena_a, "B": antena_b}
                    st.session_state['ejecutar_calculo'] = False
                else:
                   ant_a_data = st.session_state['enlace']["ant_a"]
                   ant_b_data = st.session_state['enlace']["ant_b"]
                   visual_a = st.session_state['enlace']["A"]
                   visual_b = st.session_state['enlace']["B"]
                
                elevacion_tx = get_elevation(ant_a_data['lat'], ant_a_data['lon'], path=PATH_HGT)
                elevacion_rx = get_elevation(ant_b_data['lat'], ant_b_data['lon'], path=PATH_HGT)
                
                alt_abs_tx = elevacion_tx + h_tx
                alt_abs_rx = elevacion_rx + h_rx
                
                az_sug, el_sug = calcular_orientacion_geografica(
                    ant_a_data['lat'], ant_a_data['lon'], ant_b_data['lat'], ant_b_data['lon'], alt_abs_tx, alt_abs_rx)
                az2_sug, el2_sug = calcular_orientacion_geografica(
                    ant_b_data['lat'], ant_b_data['lon'], ant_a_data['lat'], ant_a_data['lon'], alt_abs_rx, alt_abs_tx)
                
                st.info(f"✨ **Sugerencias:**\n* **{antena_a}**: Az: {az_sug}° | Tilt: {el_sug}°\n* **{antena_b}**: Az: {az2_sug}° | Tilt: {el2_sug}°")
                
            else:
                st.warning("Coloca 2 antenas para PTP")
        
        else:
            st.markdown("### 🛠️ Parámetros de Estación")
            if len(st.session_state['antenas']) >= 1:
                nombres = [f"Antena {a['id']}" for a in st.session_state['antenas']]
                ant_base = st.selectbox("Antena Base", nombres)
                potencia_tx = st.number_input("Potencia Radio (dBm)", value=st.session_state['config_radio']['Potencia'], step=1.0)
                radio_km = st.slider("Radio de Cobertura (km)", 1, 50, 5)
                h_base = st.number_input("Altura Antena Base (m)", value=st.session_state['config_radio']['Altura_TX'])
                g_max_base = st.number_input(
                    "Ganancia de la Antena Base (dBi)", 
                    value=st.session_state['config_radio']['Ganancia_TX'],
                    step=0.5,
                    key="g_max_base_input"
                )
                sensibilidad = st.number_input("Sensibilidad RX (dBm)", value=st.session_state['config_radio']['Sensibilidad'])
                
                st.session_state['config_radio']['Sensibilidad'] = sensibilidad
                st.session_state['config_radio']['Potencia'] = potencia_tx
                st.session_state['config_radio']['Ganancia_TX'] = g_max_base
                st.session_state['config_radio']['Altura_TX'] = h_base
                
                id_seleccionado = int(ant_base.split(" ")[1])

                # 3. Asignamos a 'data_base' los datos de esa antena específica
                data_base = next(a for a in st.session_state['antenas'] if a['id'] == id_seleccionado)
                
                tipo_entorno = st.selectbox(
                    "Tipo de Entorno Urbano",
                    ["Urbano Denso (Centro de la Ciudad)", "Urbano/Suburbano", "Rural"],
                    index=1
                )
                
                elevacion_st = get_elevation(data_base['lat'], data_base['lon'], path=PATH_HGT)
                
                alt_abs_st = elevacion_st + h_base
                
                patron_data_config = configurar_antena("TX", "st")
                az_manual = patron_data_config["azimuth"]
                el_manual = patron_data_config["elevation"]
                
                with st.expander("⚙️ Configuración de la Simulación", expanded=False):

                    # Creamos un selectbox para que el usuario elija de forma amigable
                    opcion_resolucion = st.selectbox(
                        "Resolución del Mapa de Cobertura",
                        options=["Baja (Rápida)", "Media (Recomendada)", "Alta (Detallada)"],
                        index=1 
                    )

                    # Mapeamos la opción amigable a los valores numéricos que usará tu algoritmo
                    if opcion_resolucion == "Baja (Rápida)":
                        st.session_state['paso_angulo'] = 6     # Cada 6 grados (60 radiales)
                        st.session_state['paso_distancia'] = 0.30 # Cada 300 metros
                    elif opcion_resolucion == "Media (Recomendada)":
                        st.session_state['paso_angulo'] = 3     # Cada 3 grados (120 radiales)
                        st.session_state['paso_distancia'] = 0.15 # Cada 150 metros
                    else: # Alta
                        st.session_state['paso_angulo'] = 1     # Cada 1 grado (360 radiales - Más pesado)
                        st.session_state['paso_distancia'] = 0.08 # Cada 80 metros
            
                with st.expander("Umbrales de Cobertura", expanded=False):
                    st.markdown("**Niveles de Señal para Folium (dBm):**")
                    # Control para el Mapa Web (Folium usa RSSI directo)
                    um_excelente = st.slider("Excelente (Rojo) si es ≥", -100, -30, -51, step=5)
                    um_aceptable = st.slider("Aceptable (Naranja) si es ≥", -100, -30, -63, step=5)
                    um_debil = st.slider("Débil (Amarillo) si es ≥", -100, -30, -67, step=5)
                    um_mala = st.slider("Mala (Verde) si es ≥", -100, -30, -70, step=5)
                    um_pesima = st.slider("Pésima (Azul) si es ≥", -100, -30, -75, step=5)
                    # Lo que esté por debajo de um_debil será Rojo de forma automática.
                    
                    # Pasamos las variables al session_state para que las funciones las puedan leer desde cualquier parte
                    st.session_state['umbrales_rssi'] = [um_excelente, um_aceptable, um_debil, um_mala, um_pesima]
                
            else:
                st.warning("Coloca una antena base")
    
    # --- SECCIÓN 3: OBSTÁCULOS ARTIFICIALES ---
    with st.expander("🏢 Obstáculos Artificiales", expanded=False):
        if st.session_state['poligonos']:
            st.caption(f"Detectados: {len(st.session_state['poligonos'])} elementos")
            for i, poly in enumerate(st.session_state['poligonos']):
                with st.container(border=True):
                    nueva_alt = st.number_input(
                        f"Altura Obstáculo #{i+1} (m)", 
                        min_value=0.0, 
                        value=float(poly.get('altura', 10.0)),
                        key=f"sidebar_h_poly_{i}"
                    )
                    st.session_state['poligonos'][i]['altura'] = nueva_alt
                    
                    if st.button(f"🗑️ Eliminar #{i+1}", key=f"del_poly_{i}", width='stretch'):
                        st.session_state['poligonos'].pop(i)
                        st.rerun()
        else:
            st.info("No hay obstáculos. Utiliza las herramientas de dibujo del mapa.")

    # --- SECCIÓN 4: GESTIÓN DE ARCHIVOS ---
    with st.expander("📁 Archivos y Proyecto", expanded=False):
        nombre = st.text_input("Nombre del archivo", "mi_red.json")
        if st.button("💾 Guardar Proyecto", width='stretch'):
            guardar_proyecto(nombre)
            
        st.markdown("---")
        archivo_input = st.file_uploader("Cargar Proyecto (.json)", type=["json"])
        if archivo_input:
            if st.button("📂 Confirmar Carga", width='stretch'):
                cargar_proyecto(archivo_input)
                
        st.markdown("---")
        if st.button("🗑️ Reiniciar Todo", type="secondary", width='stretch'):
            st.session_state['antenas'] = []
            st.session_state['poligonos'] = []
            st.session_state['map_center'] = [10.2717, -67.5563]
            st.session_state['map_zoom'] = 13
            st.rerun()
    

# --- 4. Cuerpo Principal: Mapa y Entradas de Ubicación ---
if (modo_estudio == "Punto a Punto (PTP)" and len(st.session_state['antenas']) >= 2) or (modo_estudio == "Mapa de Cobertura" and len(st.session_state['antenas']) >= 1):
    tab_mapa, tab_perfil, tab_patrones, tab_3d_preview = st.tabs(["🗺️ Mapa Interactivo", "⛰️ Perfil de Elevación 2D", "🌐 Visualización de Patrones", "🧊 Vista 3D (KML)"])
else:
    tab_mapa, tab_perfil, tab_3d_preview = st.tabs(["🗺️ Mapa Interactivo", "⛰️ Perfil de Elevación 2D", "🧊 Vista 3D (KML)"])


with tab_mapa:
    col1, col2 = st.columns([3, 1])

    with col2:
        st.markdown("##### 📍 Coordenadas")
        if modo_estudio == "Punto a Punto (PTP)": 
            if len(st.session_state['antenas']) >= 2:
                # Extraer datos de las seleccionadas en el sidebar
                idx_a = int(antena_a.split()[-1]) - 1
                idx_b = int(antena_b.split()[-1]) - 1
                ant_tx_data = st.session_state['antenas'][idx_a]
                ant_rx_data = st.session_state['antenas'][idx_b]
                
                st.text_input("Latitud TX", value=f"{ant_tx_data['lat']:.6f}", disabled=True)
                st.text_input("Longitud TX", value=f"{ant_tx_data['lon']:.6f}", disabled=True)
                st.text_input("Latitud RX", value=f"{ant_rx_data['lat']:.6f}", disabled=True)
                st.text_input("Longitud RX", value=f"{ant_rx_data['lon']:.6f}", disabled=True)
            else:
                st.info("Selecciona antenas en el panel izquierdo")
        elif modo_estudio == "Mapa de Cobertura" and len(st.session_state['antenas']) >= 1:
            idx_a = int(ant_base.split()[-1]) - 1
            ant_a_data = st.session_state['antenas'][idx_a]
            st.text_input("Latitud TX", value=f"{ant_a_data['lat']:.6f}", disabled=True)
            st.text_input("Longitud TX", value=f"{ant_a_data['lon']:.6f}", disabled=True)
        else:
            st.info("Selecciona antenas en el panel izquierdo")

    renderizar_solo_mapa()
    
    with col1:
        st.info("Use el marcador para posicionar una antena o estación, utilice el panel izquierdo para configurar los parámetros de evaluación")
    
    with col2:
        if modo_estudio == "Mapa de Cobertura" and len(st.session_state['antenas']) >= 1:
            if st.button("Calcular Cobertura"):
                config = {
                    'frec': frecuencia,
                    'p_tx': potencia_tx,
                    'g_max': g_max_base,
                    'radio_km': radio_km,
                    'az_orient': az_manual,
                    'el_orient': el_manual,
                    'h_antena': h_base
                }
                with st.spinner("Calculando matriz de cobertura..."):
                    # Llamamos a la nueva función optimizada (Ej: Resolución de 150x150 píxeles)
                    rssi_matrix, bounds, geojson_points = generar_cobertura_raster(
                        lat_base=data_base['lat'],
                        lon_base=data_base['lon'],
                        config_radio=config,
                        patron=patron_data_config,
                        zona=tipo_entorno
                    )
                    
                    # Guardamos en la sesión para que el mapa la lea
                    st.session_state['cobertura_raster'] = rssi_matrix
                    st.session_state['raster_bounds'] = bounds
                    st.session_state['current_geojson_cobertura'] = geojson_points
                    
                    st.success("¡Cálculo completado!")
                    st.rerun()

        if st.button("📍 Confirmar Elementos"):
            sincronizar_mapa(st.session_state['map_output'])
            st.rerun()

        
with tab_perfil:
    if modo_estudio == "Punto a Punto (PTP)" and len(st.session_state['antenas']) >= 2:
        st.subheader(f"Análisis: {visual_a} ↔ {visual_b}")
        
        # 1. Generar puntos intermedios (Muestreo)
        num_muestras = 200
        lats = np.linspace(ant_a_data['lat'], ant_b_data['lat'], num_muestras)
        lons = np.linspace(ant_a_data['lon'], ant_b_data['lon'], num_muestras)
        puntos_muestreo = list(zip(lats, lons))
        
        # 2. Obtener Elevaciones del Terreno
        with st.spinner("Consultando archivos HGT..."):
            elevaciones_suelo = get_elevation_batch(puntos_muestreo, path=PATH_HGT)
        
        # 3. Calcular Distancias
        dist_total = geodesic((ant_a_data['lat'], ant_a_data['lon']), (ant_b_data['lat'], ant_b_data['lon'])).km
        eje_x = np.linspace(0, dist_total, num_muestras)
        
        # 4. Calcular Línea de Vista (LoS) y Fresnel
        # Altura absoluta inicial y final (Suelo + Antena)
        alt_abs_tx = elevaciones_suelo[0] + h_tx
        alt_abs_rx = elevaciones_suelo[-1] + h_rx
        
        linea_vista = np.linspace(alt_abs_tx, alt_abs_rx, num_muestras)
        fresnel_top = []
        fresnel_bottom = []
        radios_fresnel = []
        
        for i, d in enumerate(eje_x):
            r_f = calcular_fresnel(dist_total, d, frecuencia)
            radios_fresnel.append(r_f)
            fresnel_top.append(linea_vista[i] + r_f)
            fresnel_bottom.append(linea_vista[i] - r_f)
            
        # 5. INTEGRACIÓN DE OBSTÁCULOS (Tu requerimiento especial)
        # Por cada punto, chequear si cae dentro de un polígono
        elevacion_con_obstaculos = elevaciones_suelo.copy()
        
        
        
        for i, (lat, lon) in enumerate(puntos_muestreo):
            p = Point(lon, lat) # GeoJSON usa (lon, lat)
            for poly in st.session_state['poligonos']:
                shape = Polygon(poly['geometry']['coordinates'][0])
                if shape.contains(p):
                    elevacion_con_obstaculos[i] += poly.get('altura', 10.0)

        # 6. Graficar con Plotly (Para que sea interactivo)
        
        
        y_min = min(np.min(elevacion_con_obstaculos), np.min(fresnel_bottom))
        y_max = max(np.max(elevacion_con_obstaculos), np.max(fresnel_top))
        
        bloqueo_total, conflictos = analizar_obstrucciones_completo(eje_x, elevacion_con_obstaculos, linea_vista, radios_fresnel)
        
        # Añadimos un margen del 10% para que el gráfico "respire"
        margen = (y_max - y_min) * 0.1
        
        fig = go.Figure()
        
        # Dibujar Terreno
        fig.add_trace(go.Scatter(x=eje_x, y=elevacion_con_obstaculos, fill='tozeroy', name='Terreno + Obstáculos', line=dict(color='brown')))
        # Dibujar Zona de Fresnel
        fig.add_trace(go.Scatter(x=eje_x, y=fresnel_top, line=dict(width=0), showlegend=False))
        fig.add_trace(go.Scatter(x=eje_x, y=fresnel_bottom, fill='tonexty', name='1era Zona Fresnel', line=dict(color='rgba(0, 255, 0, 0.2)')))
        # Dibujar Línea de Vista
        fig.add_trace(go.Scatter(x=eje_x, y=linea_vista, name='Línea de Vista (LoS)', line=dict(color='blue', dash='dash')))
        
        fig.update_layout(
            xaxis_title="Distancia (km)",
            yaxis_title="Altitud (msnm)",
            height=500,
            # Ajustamos el rango del eje Y dinámicamente
            yaxis=dict(
                range=[y_min - margen, y_max + margen],
                zeroline=False,
                gridcolor='lightgrey'
            ),
            xaxis=dict(gridcolor='lightgrey'),
            plot_bgcolor='white',
            hovermode="x unified",
            legend=dict(
                orientation="h", 
                yanchor="top",
                y=-0.15,       
                xanchor="center",
                x=0.5
            )
        )
        
        st.plotly_chart(fig, width="stretch")
        
        # 7. Verificación de Obstrucción
        obstruccion = any(elevacion_con_obstaculos > fresnel_bottom)
        #if obstruccion:
        #    st.error("⚠️ Alerta: La Zona de Fresnel está obstruida por el terreno u obstáculos.")
        #else:
        #    st.success("✅ Despejado: Línea de vista y Fresnel libres.")

    else:
        st.info("Defina dos antenas del Mapa en Modo PTP para generar gráfico")


if (modo_estudio == "Punto a Punto (PTP)" and len(st.session_state['antenas']) >= 2) or (modo_estudio == "Mapa de Cobertura" and len(st.session_state['antenas']) >= 1):
    with tab_patrones:
        es_enlace = True if modo_estudio == "Punto a Punto (PTP)" else False 
        tipo_modo = "Enlaces" if es_enlace else "Cobertura"
        

        ant_tx = config_tx if es_enlace else (patron_data_config if patron_data_config else None)
        ant_rx = config_rx if es_enlace else None
            
        # Si las alturas están guardadas en variables numéricas en tu app.py:
        pat_h_tx = alt_abs_tx if es_enlace else alt_abs_st
        pat_h_rx = alt_abs_rx if es_enlace else 0.0

        # Renderizado en dos columnas paralelas muy estéticas
        vista_seleccionada = st.radio(
            "Selecciona el plano de visualización:",
            ["Vista Aérea (Plano Horizontal)", "Vista de Perfil (Plano Vertical / Tilt)"],
            index=0,
            horizontal=True
        )
        
        st.markdown("---") # Una línea sutil de separación
            
        if vista_seleccionada == "Vista Aérea (Plano Horizontal)":
            if es_enlace:
                fig_aerea = generar_grafico_vista_aerea_real(ant_tx, ant_rx, az_sug=az_sug, tipo_app=tipo_modo)
            else: 
                fig_aerea = generar_grafico_vista_aerea_real(ant_tx, ant_rx, az_sug=az_manual, tipo_app=tipo_modo)
            
            # Al estar solo, aprovecha todo el ancho disponible sin encogerse
            st.plotly_chart(fig_aerea, width='stretch')
            st.info("💡 **Vista Aérea:** Muestra cómo interactúan los diagramas horizontales. Asegúrate de que los lóbulos apunten directamente a lo largo de la línea verde de vista.")
            
        elif vista_seleccionada == "Vista de Perfil (Plano Vertical / Tilt)":
            if es_enlace:
                fig_perfil = generar_grafico_vista_perfil_real(ant_tx, ant_rx, pat_h_tx, pat_h_rx, el_sug, dist_total, tipo_app=tipo_modo)
            else:
                fig_perfil = generar_grafico_vista_perfil_real(ant_tx, ant_rx, pat_h_tx, pat_h_rx, el_manual, radio_km, tipo_app=tipo_modo)
            
            # Al usar subplots con el ancho completo, el detalle de TX y RX se verá enorme y claro
            st.plotly_chart(fig_perfil, width='stretch')
            st.info("💡 **Vista de Perfil:** Muestra la inclinación (Tilt) vertical. Útil para verificar si la energía de la antena no se está disparando al cielo o apuntando demasiado al suelo.")


with tab_3d_preview:
    if modo_estudio == "Punto a Punto (PTP)" and len(st.session_state['antenas']) >= 2:
        
        default_name_a = str(antena_a)
        default_name_b = str(antena_b)
        
        col_names_a, col_names_b = st.columns(2)
        with col_names_a:
            nombre_a_kml = st.text_input("Nombre Estación Origen (TX)", value=default_name_a, key="kml_name_tx")
        with col_names_b:
            nombre_b_kml = st.text_input("Nombre Estación Destino (RX)", value=default_name_b, key="kml_name_rx")
        
        if st.button("🌍 Exportar Escena a Google Earth"):
            datos_kml = generar_kml_ptp(ant_a_data, ant_b_data, alt_abs_tx, alt_abs_rx, st.session_state['poligonos'], frecuencia, nombre_a_kml, nombre_b_kml)
            
            file_ptp = f"Enlace_{nombre_a_kml.replace(' ', '_')}_to_{nombre_b_kml.replace(' ', '_')}.kml"
            
            st.download_button(
                label="Descargar archivo .KML",
                data=datos_kml,
                file_name=file_ptp,
                mime="application/vnd.google-earth.kml+xml"
            )
    
    elif modo_estudio == "Mapa de Cobertura" and 'current_geojson_cobertura' in st.session_state:
        default_name_base = str(ant_base)

        nombre_base_kml = st.text_input("Nombre de la Estación Transmisora", value=default_name_base, key="kml_name_base")
        
        if st.button("🌍 Exportar Cobertura a Google Earth"):
            # Usamos la ubicación de la antena actual
            kml_data = generar_kml_cobertura(
                st.session_state['current_geojson_cobertura'], 
                data_base,
                h_base,
                st.session_state['poligonos'],
                nombre_base_kml
            )
            
            file_cob = f"Cobertura_{nombre_base_kml.replace(' ', '_')}.kml"
            
            st.download_button(
                label="📥 Descargar Cobertura.kml",
                data=kml_data,
                file_name=file_cob,
                mime="application/vnd.google-earth.kml+xml"
            )
    
    else:
        st.info("Inicie una simulación o genere un radioenlace para activar esta función")


if modo_estudio == "Punto a Punto (PTP)" and len(st.session_state['antenas']) >= 2:
    conflictos_lat = analizar_obstrucciones_laterales(
        [(ant_a_data['lat'], ant_a_data['lon']), (ant_b_data['lat'], ant_b_data['lon'])], 
        alt_abs_tx,
        alt_abs_rx,
        st.session_state['poligonos'], 
        frecuencia
    )
    
    # Llamamos a la función de balance
    # Nota: 'obstruccion' es el booleano que calculamos en el gráfico de Plotly
    GF_TX = obtener_ganancia_con_patron(config_tx, az_sug, el_sug, g_tx)
    GF_RX = obtener_ganancia_con_patron(config_rx, az2_sug, el2_sug, g_rx)
    
    
    
    rssi_final, perdidas_aire, EIRP, NPL, link_state, atenuacion_obstaculos = calcular_balance_enlace(
        dist_total, frecuencia, potencia_tx, GF_TX, GF_RX, l_cable_tx, l_cable_rx, abs_atm, bloqueo_total, conflictos, conflictos_lat
    )
    
    # Calculamos el Margen de Desvanecimiento (Fade Margin)
    # Asumiendo una sensibilidad estándar de -90dBm
    margen = round(rssi_final - sensibilidad, 2)

    # --- RENDERIZADO DE MÉTRICAS ---
    st.divider()
    
    if "❌" in link_state:
        st.error(f"**Estado del Enlace:** {link_state}")
        st.write("La señal recibida es insuficiente debido a obstrucciones físicas en la trayectoria.")
    elif "⚠️" in link_state:
        st.warning(f"**Estado del Enlace:** {link_state}")
        st.write(f"Se ha aplicado una penalización de {atenuacion_obstaculos} dB por invasión de Fresnel.")
    else:
        if obstruccion:
            link_state = link_state.replace('TOTAL', 'MAS DEL 60% DE LA PRIMERA ZONA DE FRESNEL')
        st.success(f"**Estado del Enlace:** {link_state}")
    
    st.subheader("📊 Resultados del Balance de Enlace")
    res_col1, res_col2, res_col3, res_col4, res_col5 = st.columns([0.9, 1.1, 1.0, 1.6, 1.4])
    
    res_col1.metric("Distancia Total", f"{dist_total:.2f} km")
    res_col2.metric("EIRP", f"{EIRP:.2f} dBm")
    res_col3.metric("Pérdida (FSPL)", f"{perdidas_aire} dB")
    
    # Color dinámico para el RSSI
    color_rssi = "normal" if rssi_final > -75 else "inverse" # Verde si es > -75dBm
    res_col4.metric("Señal Recibida (RSSI)", f"{rssi_final} dBm", delta_color=color_rssi)
    
    # Margen de Desvanecimiento
    res_col5.metric("Margen de Sistema", f"{margen} dB", 
                   delta=f"{margen} dB" if margen > 15 else "Bajo",
                   delta_color="normal" if margen > 15 else "inverse")

    if margen < 10:
        st.warning("⚠️ El margen de desvanecimiento es muy bajo. El enlace podría caerse con lluvia o interferencias.")
    
    
if modo_estudio == "Mapa de Cobertura" and len(st.session_state['antenas']) >= 1:
    
    st.divider()
    st.subheader(" ")
