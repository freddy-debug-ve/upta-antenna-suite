import React, { useMemo, useState, useEffect } from 'react';
import Plotly from 'plotly.js-dist-min';
import _createPlotComponent from 'react-plotly.js/factory';

const createPlotComponent = _createPlotComponent.default || _createPlotComponent;
const Plot = createPlotComponent(Plotly);

/**
 * @component GeometryViewer
 * @description Visor tridimensional basado en Plotly.js para la validación geométrica de antenas.
 * Renderiza de forma interactiva la estructura de hilos, el elemento excitado y los puntos de alimentación.
 */
const GeometryViewer = ({ wires, selectedTag, allSources, isDarkMode= typeof document !== 'undefined' && document.documentElement.classList.contains('dark') }) => {
  // --- CONTROL DE RESPONSIVIDAD PARA EL VIEWPORT ---
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkViewport = () => {
      setIsMobile(window.innerWidth < 768); // Ruptura basada en el breakpoint 'md' de Tailwind
    };
    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  // 1. GENERACIÓN DE LOS TRACES VECTORIALES INTERACTIVOS
  const plotData = useMemo(() => {
    if (!wires || wires.length === 0) return [];
    
    const legendRepresentativeIndex = wires.findIndex(w => w.tag !== selectedTag - 1);
    const finalLegendIndex = legendRepresentativeIndex !== -1 ? legendRepresentativeIndex : 1;

    // Trazado de segmentos conductores (hilos)
    const wireTraces = wires.map((w, index) => {
      const isSelected = w.tag === parseInt(selectedTag);
      
      // Ajuste cromático según el tema: Verde flúor / Índigo para la estructura base
      const wireBaseColor = isDarkMode ? '#a3e635' : '#4f46e5';

      return {
        type: 'scatter3d',
        mode: 'lines',
        x: w.x,
        y: w.y,
        z: w.z,
        name: ((wires.length === 1) ? (isSelected ? 'Elemento Excitado' : "Estructura") : ("Estructura")), 
        legendgroup: 'geometría',
        showlegend: (index === finalLegendIndex + 1 || wires.length === 1),
        hoverinfo: 'name',
        line: {
          color: isSelected ? '#ef4444' : wireBaseColor,
          width: isSelected ? 8 : 4,
        },
      };
    });

    // Trazado de marcadores geométricos para las fuentes de tensión/corriente
    const sourceMarkers = allSources.map((src, idx) => {
      const wire = wires.find(w => w.tag === parseInt(src.wireIndex));
      if (!wire) return null;

      const isSelected = parseInt(src.wireIndex) === selectedTag;

      return {
        type: 'scatter3d',
        mode: 'markers',
        x: [(wire.x[0] + wire.x[1]) / 2],
        y: [(wire.y[0] + wire.y[1]) / 2],
        z: [(wire.z[0] + wire.z[1]) / 2],
        name: isSelected ? 'Alimentación Activa' : 'Fuente',
        legendgroup: 'fuente',
        showlegend: idx === 0,
        marker: {
          size: isSelected ? 10 : 7,
          color: '#f97316', // Tono naranja brillante para la alimentación para contrastar en claro y oscuro
          symbol: 'diamond',
          line: { color: isDarkMode ? '#0f172a' : '#ffffff', width: isSelected ? 2 : 1 }
        }
      };
    }).filter(Boolean);

    return [...wireTraces, ...sourceMarkers];
  }, [wires, selectedTag, allSources, isDarkMode]);

  // 2. CÁLCULO DE LÍMITES SEGUROS DE ESCALA PARA LOS EJES CARTESIANOS
  const axisRanges = useMemo(() => {
    if (!wires || wires.length === 0) return null;

    const allX = wires.flatMap(w => w.x);
    const allY = wires.flatMap(w => w.y);
    const allZ = wires.flatMap(w => w.z);

    const getSafeRange = (arr) => {
      let min = Math.min(...arr);
      let max = Math.max(...arr);
      
      if (Math.abs(max - min) < 0.1) {
        const center = (max + min) / 2;
        min = center - 0.5;
        max = center + 0.5;
      } else {
        const padding = (max - min) * 0.15;
        min -= padding;
        max += padding;
      }
      return [min, max];
    };

    return {
      x: getSafeRange(allX),
      y: getSafeRange(allY),
      z: getSafeRange(allZ),
    };
  }, [wires]);

  // 3. CONFIGURACIÓN COMPLETA DEL LAYOUT ADAPTATIVO (TEMAS & VIEWPORT)
  const layout = useMemo(() => {
    const isPlaneStructure = axisRanges ? (
      (axisRanges.x[1] - axisRanges.x[0] <= 1.1 && Math.abs(Math.min(...wires.flatMap(w => w.x)) - Math.max(...wires.flatMap(w => w.x))) < 0.001) ||
      (axisRanges.y[1] - axisRanges.y[0] <= 1.1 && Math.abs(Math.min(...wires.flatMap(w => w.y)) - Math.max(...wires.flatMap(w => w.y))) < 0.001) ||
      (axisRanges.z[1] - axisRanges.z[0] <= 1.1 && Math.abs(Math.min(...wires.flatMap(w => w.z)) - Math.max(...wires.flatMap(w => w.z))) < 0.001)
    ) : false;

    // Paleta de colores para ingeniería según iluminación de la UI
    const gridColor = isDarkMode ? '#1e293b' : '#e2e8f0';
    const textAndAxisColor = isDarkMode ? '#94a3b8' : '#475569';
    const bgCanvas = isDarkMode ? '#0f172a' : '#ffffff';
  
    return {
      autosize: true,
      scene: {
        aspectmode: isPlaneStructure ? 'cube' : 'data',
        xaxis: { 
          title: { text: 'X (m)', font: { color: textAndAxisColor } }, 
          gridcolor: gridColor, 
          zerolinecolor: textAndAxisColor,
          tickfont: { color: textAndAxisColor },
          range: axisRanges ? axisRanges.x : undefined
        },
        yaxis: { 
          title: { text: 'Y (m)', font: { color: textAndAxisColor } }, 
          gridcolor: gridColor, 
          zerolinecolor: textAndAxisColor,
          tickfont: { color: textAndAxisColor },
          range: axisRanges ? axisRanges.y : undefined
        },
        zaxis: { 
          title: { text: 'Z (m)', font: { color: textAndAxisColor } }, 
          gridcolor: gridColor, 
          zerolinecolor: textAndAxisColor,
          tickfont: { color: textAndAxisColor },
          range: axisRanges ? axisRanges.z : undefined
        },
        camera: isMobile 
          ? { eye: { x: 2.3, y: 2.3, z: 2.0 } }
          : { eye: { x: 2.0, y: 2.0, z: 1.8 } }
      },
      margin: isMobile
        ? { l: 10, r: 10, b: 60, t: 10 }
        : { l: 20, r: 20, b: 20, t: 20 },
      showlegend: true,
      
      // Estilización paramétrica de la Leyenda
      legend: isMobile ? {
        orientation: 'h',
        x: 0.5,
        y: -0.05,
        xanchor: 'center',
        yanchor: 'top',
        font: { size: 10, family: 'sans-serif', color: textAndAxisColor },
        bgcolor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : 'rgba(255, 255, 255, 0.8)'
      } : {
        orientation: 'v',
        x: 1.02,
        y: 0.5,
        xanchor: 'left',
        yanchor: 'middle',
        font: { size: 11, family: 'sans-serif', color: textAndAxisColor }
      },
      
      paper_bgcolor: bgCanvas,
      plot_bgcolor: bgCanvas,
    };
  }, [axisRanges, isMobile, wires, isDarkMode]);

  // Renderizado para estado de datos vacío
  if (!wires || wires.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50 dark:bg-slate-900/40 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl transition-colors">
        <p className="text-slate-400 dark:text-slate-500 text-xs italic font-medium">
          Renderiza la geometría para visualizar la antena
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full rounded-xl overflow-hidden shadow-inner border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors">
      <Plot
        // La inclusión de isDarkMode en la key fuerza la actualización limpia del lienzo al alternar el tema
        key={isMobile ? `plotly-geo-mobile-${isDarkMode}` : `plotly-geo-desktop-${isDarkMode}`}
        data={plotData}
        layout={layout}
        config={{ 
          responsive: true, 
          displaylogo: false,
          modeBarButtonsToRemove: ['lasso2d', 'select2d', 'presetSetting'] 
        }}
        style={{ width: '100%', height: '100%' }}
        useResizeHandler={true}
      />
    </div>
  );
};

export default GeometryViewer;