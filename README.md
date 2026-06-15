# 📡 UPTA Antenna Suite

> **Software de ingeniería de antenas y planificación de radioenlaces**  
> Simulación numérica de patrones de radiación (MiniNEC) + Análisis de cobertura RF con modelos de terreno real.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Docker-lightgrey)
![Python](https://img.shields.io/badge/python-3.10%2B-green)
![License](https://img.shields.io/badge/license-MIT-orange)

---

## 📋 Tabla de Contenidos

- [Descripción General](#-descripción-general)
- [Arquitectura del Proyecto](#-arquitectura-del-proyecto)
- [Capturas de Pantalla](#-capturas-de-pantalla)
- [Instalación — Ejecutable Windows](#-instalación--ejecutable-windows)
- [Instalación — Código Fuente](#-instalación--código-fuente)
- [Instalación — Docker](#-instalación--docker)
- [Documentación de la API](#-documentación-de-la-api)
- [Estructura del Repositorio](#-estructura-del-repositorio)
- [Contribuir](#-contribuir)

---

## 🔭 Descripción General

**UPTA Antenna Suite** está compuesto por dos herramientas complementarias:

| Herramienta | Tecnología | Descripción |
|---|---|---|
| **Simulador de Antenas** | FastAPI + React | Motor numérico MiniNEC para calcular patrones de radiación 3D, impedancias y SWR. Diseño CAD de geometrías de antena. |
| **Planificador RF** | Streamlit | Análisis de radioenlaces PTP, mapas de cobertura con elevación real de terreno (SRTM/HGT), balance de enlace y zonas de Fresnel. |

### Funcionalidades principales

- 🧮 **Simulación numérica MiniNEC** — patrones 3D, ARRL, cortes azimuth/elevación
- 📊 **SWR e Impedancia** — barrido en frecuencia con gráficas de red
- 🗺️ **Mapas de cobertura RF** — integración con datos de elevación SRTM
- 📡 **Balance de enlace PTP** — FSPL, Fresnel, EIRP, margen de desvanecimiento
- 📐 **Editor CAD 3D** — diseño de dipolo, Yagi, parábola, helicoidal y geometría libre
- 🌍 **Exportación KML** — visualización en Google Earth
- 🐳 **Despliegue Docker** — entorno reproducible multiplataforma

---

## 🏗️ Arquitectura del Proyecto

```
UPTA-Antenna-Suite/
│
├── streamlit/                  # Planificador RF
│   ├── app.py                  # Aplicación principal Streamlit
│   ├── pyhigh/                 # Módulo de elevación de terreno (SRTM)
│   └── hgtdata/                # Datos de elevación HGT (no incluidos en repo)
│
├── backend/                    # API del Simulador de Antenas
│   ├── main.py                 # FastAPI + uvicorn
│   ├── submininec/             # Motor numérico MiniNEC (Python)
│   └── subplot_antenna/        # Utilidades de visualización de patrones
│
├── frontend/                   # Interfaz CAD del Simulador
│   ├── src/
│   │   ├── App.jsx             # Componente raíz
│   │   └── components/         # Sidebar, Viewer, modales, visores
│   ├── package.json
│   └── tailwind.config.js
│
└── docker/                     # Archivos de contenedorización
    ├── docker-compose.yml
    ├── Dockerfile.backend
    └── Dockerfile.streamlit
```

**Flujo de datos:**

```
Usuario (Browser/Streamlit)
       │
       ▼
  Frontend React  ──POST /api/simulate──►  FastAPI Backend
       │                                        │
       │◄──────── JSON (patrones, SWR) ─────────┤
       │                                   submininec
       ▼                                  (Motor MiniNEC)
  Viewer 3D / Gráficas Plotly
```

---

## 📸 Capturas de Pantalla

> **Nota:** Añade capturas reales en la carpeta `docs/screenshots/` y actualiza los paths abajo.

| Simulador de Antenas | Planificador RF |
|:---:|:---:|
| ![Simulador](docs/screenshots/simulator.png) | ![Planificador](docs/screenshots/planner.png) |
| *Editor CAD + Patrón 3D* | *Mapa de cobertura con RSSI* |

| Corte Azimuth / Elevación | Balance de Enlace PTP |
|:---:|:---:|
| ![2D](docs/screenshots/2d_pattern.png) | ![PTP](docs/screenshots/ptp_link.png) |
| *Patrones 2D polares* | *Perfil de Fresnel y balance* |

---

## 🪟 Instalación — Ejecutable Windows

La forma más rápida de usar UPTA Antenna Suite sin instalar nada.

### Requisitos previos
- Windows 10 / 11 (64-bit)
- Sin dependencias adicionales — todo incluido en el ejecutable

### Pasos

1. **Descarga el ejecutable** desde la página de [Releases](https://github.com/freddy-debug-ve/upta-antenna-suite/releases/latest):
   - `UPTA_Simulator_v1.0.0_win64.exe` — Simulador de Antenas
   - `UPTA_Planner_v1.0.0_win64.exe` — Planificador RF

2. **Ejecuta el Simulador de Antenas:**
   ```
   Doble clic en UPTA_Simulator_v1.0.0_win64.exe
   ```
   Se abre automáticamente el navegador en `http://localhost:8000`

3. **Ejecuta el Planificador RF:**
   ```
   Doble clic en UPTA_Planner_v1.0.0_win64.exe
   ```
   Se abre automáticamente en `http://localhost:8501`

> ⚠️ **Windows Defender SmartScreen** puede mostrar una advertencia la primera vez. Haz clic en *"Más información" → "Ejecutar de todas formas"*. Los ejecutables están generados con PyInstaller desde el código fuente de este repositorio.

### Datos de elevación (Planificador RF)

Los datos HGT no están incluidos en el ejecutable por su tamaño. Descárgalos desde:
- [SRTM Data — USGS EarthExplorer](https://earthexplorer.usgs.gov/)
- [ViewFinderPanoramas](http://www.viewfinderpanoramas.org/dem3.html)

Coloca los archivos `.hgt.zip` en la carpeta `hgtdata/` junto al ejecutable.

---

## 🐍 Instalación — Código Fuente

### Requisitos previos

- Python 3.10 o superior
- Node.js 18+ y npm
- Git

### 1. Clonar el repositorio

```bash
git clone https://github.com/freddy-debug-ve/upta-antenna-suite.git
cd upta-antenna-suite
```

### 2. Backend — Simulador de Antenas

```bash
cd backend

# Crear entorno virtual
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Linux/macOS

# Instalar dependencias
pip install -r requirements.txt

# Iniciar el servidor
python main.py
# API disponible en http://localhost:8000
```

### 3. Frontend — Simulador de Antenas

```bash
cd frontend

# Instalar dependencias
npm install

# Modo desarrollo
npm run dev
# Interfaz en http://localhost:5173

# Build de producción (sirve desde el backend)
npm run build
# Los archivos se generan en frontend/dist/
```

### 4. Planificador RF (Streamlit)

```bash
cd streamlit

# Crear entorno virtual (puede compartirse con backend)
python -m venv venv
venv\Scripts\activate

pip install -r requirements.txt

# Iniciar
streamlit run app.py
# Disponible en http://localhost:8501
```

### Requirements

**`backend/requirements.txt`**
```
fastapi
uvicorn[standard]
numpy
sympy
pydantic
```

**`streamlit/requirements.txt`**
```
streamlit
folium
streamlit-folium
numpy
pandas
plotly
pydeck
shapely
geopy
simplekml
matplotlib
branca
Pillow
```

---

## 🐳 Instalación — Docker

La opción recomendada para entornos de producción o despliegue en servidor.

### Requisitos previos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/Linux/macOS)
- Docker Compose v2+

### Inicio rápido

```bash
git clone https://github.com/freddy-debug-ve/upta-antenna-suite.git
cd upta-antenna-suite

# Construir y levantar todos los servicios
docker compose up --build
```

| Servicio | URL | Descripción |
|---|---|---|
| Simulador (Frontend + API) | http://localhost:8000 | React + FastAPI |
| Planificador RF | http://localhost:8501 | Streamlit |

### Detener los servicios

```bash
docker compose down
```

### Estructura Docker

```yaml
# docker-compose.yml (resumen)
services:
  backend:
    build: ./docker/Dockerfile.backend
    ports: ["8000:8000"]
    volumes:
      - ./backend:/app
      - ./frontend/dist:/app/dist   # Build del frontend

  streamlit:
    build: ./docker/Dockerfile.streamlit
    ports: ["8501:8501"]
    volumes:
      - ./streamlit:/app
      - ./streamlit/hgtdata:/app/hgtdata
```

### Variables de entorno

Crea un archivo `.env` en la raíz si necesitas personalizar:

```env
# Puerto del simulador
BACKEND_PORT=8000

# Puerto del planificador
STREAMLIT_PORT=8501

# Ruta a datos HGT (dentro del contenedor)
HGT_DATA_PATH=/app/hgtdata
```

---

## 📖 Documentación de la API

El backend FastAPI genera documentación interactiva automáticamente.

Una vez iniciado el backend, accede a:
- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

### Endpoints principales

---

#### `POST /api/simulate`

Ejecuta la simulación numérica completa: geometría → MiniNEC → patrones de radiación.

**Request Body:**
```json
{
  "frequency": {
    "mode": "single",
    "value": 144.0,
    "start": 140.0,
    "end": 148.0,
    "steps": 2
  },
  "elements": [
    {
      "id": "el-001",
      "type": "dipole",
      "params": {
        "p1": "0,0,-0.5",
        "p2": "0,0,0.5",
        "radius": "0.001",
        "x": 0, "y": 0, "z": 0,
        "theta": 0, "phi": 0, "psi": 0
      }
    }
  ],
  "sources": [
    {
      "id": "src-1",
      "type": "Voltaje",
      "wireIndex": 1,
      "segment": 5,
      "amplitude": 1.0,
      "phase": 0
    }
  ]
}
```

**Response:**
```json
{
  "status": "success",
  "patterns": [
    {
      "frequency": 144.0,
      "x": [[...]], "y": [[...]], "z": [[...]],
      "r": [[...]],
      "max_gain": 2.14,
      "min_gain": -38.5
    }
  ],
  "networkData": {
    "1": {
      "f": [144.0],
      "r": [73.1],
      "x": [-0.5],
      "swr": [1.03]
    }
  },
  "patterns_2d": {
    "azimuth_sets": [...],
    "elevation_sets": [...]
  }
}
```

---

#### `POST /api/build-geometry`

Valida y construye la geometría sin ejecutar el cálculo de campo lejano. Útil para previsualización rápida.

**Request Body:** Igual que `/api/simulate`

**Response:**
```json
{
  "status": "success",
  "wires": [
    {
      "tag": 1,
      "segments": 9,
      "points": [[0,0,-0.5], [...], [0,0,0.5]]
    }
  ]
}
```

---

#### `POST /api/calculate-network`

Calcula únicamente datos de red (impedancia y SWR) en barrido de frecuencia, sin calcular patrones 3D.

**Request Body:** Igual que `/api/simulate`

**Response:**
```json
{
  "status": "success",
  "networkData": {
    "1": {
      "f": [140.0, 142.0, 144.0],
      "r": [55.2, 68.4, 73.1],
      "x": [-22.3, -8.1, -0.5],
      "swr": [1.52, 1.14, 1.03],
      "Wire": [1, 1, 1]
    }
  }
}
```

---

#### `POST /api/validate-equation`

Valida una expresión matemática simbólica y retorna su representación LaTeX. Usado en el modo de geometría paramétrica libre.

**Request Body:**
```json
{
  "expr": "sin(u)*cos(u^2)/2"
}
```

**Response:**
```json
{
  "status": "valid",
  "latex": "\\frac{\\sin{\\left(u \\right)} \\cos{\\left(u^{2} \\right)}}{2}"
}
```

---

#### `POST /api/export-nec`

Genera el archivo de texto en formato NEC2 compatible con otros simuladores (4nec2, EZNEC, etc.).

**Request Body:**
```json
{
  "freq": 144.0,
  "elements": [...],
  "sources": [...]
}
```

**Response:**
```json
{
  "status": "success",
  "nec_file": "CM UPTA Antenna Suite Export\nCE\nGW 1 9 0 0 -0.5 0 0 0.5 0.001\n..."
}
```

### Tipos de Elementos Soportados

| `type` | Descripción | Parámetros clave |
|---|---|---|
| `dipole` | Dipolo simple punto a punto | `p1`, `p2`, `radius` |
| `manual` | Geometría libre por tabla de hilos | `table[]` con `x1,y1,z1,x2,y2,z2,radius` |
| `parabola` | Reflector parabólico | `diam`, `fd`, `divA`, `divB` |
| `helix` | Antena helicoidal | `turns`, `pitch`, `radius`, `wire_r` |
| `yagi` | Arreglo Yagi-Uda | `boom_len`, `elements[]` |
| `free` | Geometría paramétrica (SymPy) | `expr_x`, `expr_y`, `expr_z`, `n_points` |

### Materiales disponibles (conductividad eléctrica)

| Clave | Material | Conductividad (S/m) |
|---|---|---|
| `COPPER` | Cobre | 5.8 × 10⁷ |
| `SILVER` | Plata | 6.3 × 10⁷ |
| `ALUMINUM` | Aluminio | 3.5 × 10⁷ |
| `STEEL` | Acero inoxidable | 1.4 × 10⁶ |
| `STEEL_GALVANIZED` | Acero galvanizado | 6.0 × 10⁶ |
| `BRASS` | Latón | 1.5 × 10⁷ |

---

## 📁 Estructura del Repositorio

```
.
├── backend/
│   ├── main.py                     # Punto de entrada FastAPI
│   ├── requirements.txt
│   ├── submininec/                 # Motor MiniNEC
│   │   ├── mininec.py
│   │   ├── pulse.py
│   │   ├── segment.py
│   │   └── ...
│   └── subplot_antenna/            # Utilidades de plot
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── Sidebar.jsx         # Panel de control
│   │   │   ├── Viewer.jsx          # Visor principal
│   │   │   ├── PatternViewer.jsx   # Patrón 3D
│   │   │   ├── PolarViewer.jsx     # Cortes 2D
│   │   │   ├── SWRViewer.jsx       # Red / SWR
│   │   │   ├── OrthogonalEditor.jsx # CAD 2D
│   │   │   ├── CoordinateTable.jsx  # Tabla de hilos
│   │   │   └── ...
│   ├── package.json
│   └── tailwind.config.js
│
├── streamlit/
│   ├── app.py                      # Planificador RF
│   ├── requirements.txt
│   ├── pyhigh/                     # Elevación SRTM
│   └── hgtdata/                    # Archivos .hgt (no en repo)
│
├── docker/
│   ├── docker-compose.yml
│   ├── Dockerfile.backend
│   └── Dockerfile.streamlit
│
├── docs/
│   └── screenshots/
│
├── .gitignore
└── README.md
```

---

## 🤝 Contribuir

1. Haz fork del repositorio
2. Crea una rama: `git checkout -b feature/nueva-funcionalidad`
3. Realiza tus cambios y haz commit: `git commit -m "feat: descripción"`
4. Push a tu fork: `git push origin feature/nueva-funcionalidad`
5. Abre un Pull Request

### Convención de commits

```
feat:     Nueva funcionalidad
fix:      Corrección de bug
docs:     Cambios en documentación
refactor: Refactorización sin cambio de comportamiento
chore:    Tareas de mantenimiento
```

---

## 📄 Licencia

Este proyecto está bajo la licencia MIT. Ver el archivo [LICENSE](LICENSE) para más detalles.

---

<div align="center">
  <strong>UPTA Antenna Suite</strong> — Desarrollado en la Universidad Politécnica Territorial de Aragua<br>
  <sub>Motor numérico basado en MiniNEC · Datos de terreno SRTM/HGT · Exportación NEC2/KML</sub>
</div>
