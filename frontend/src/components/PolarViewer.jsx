import React, { useState, useMemo } from 'react';
import Plotly from 'plotly.js-dist-min';
import _createPlotComponent from 'react-plotly.js/factory';

const createPlotComponent = _createPlotComponent.default || _createPlotComponent;
const Plot = createPlotComponent(Plotly);

/**
 * @component MultiPolarViewer
 * @description Gráfico polar interactivo para cortes de Azimut (Plano H) y Elevación (Plano E).
 * Sincroniza su fondo y retículas perfectamente con el tema global (Claro/Oscuro).
 */
const MultiPolarViewer = ({ 
  patterns, 
  type = 'azimuth', 
  isDarkMode = typeof document !== 'undefined' && document.documentElement.classList.contains('dark') 
}) => {
  const [isARRL, setIsARRL] = useState(true);
  const isAzimuth = type === 'azimuth';
  const data = isAzimuth ? patterns.azimuth_sets : patterns.elevation_sets;

  // Paleta de colores adaptativa para la infraestructura del gráfico Plotly
  const gridColor = isDarkMode ? '#1e293b' : '#e2e8f0';
  const labelColor = isDarkMode ? '#94a3b8' : '#64748b';
  const titleColor = isDarkMode ? '#e2e8f0' : '#475569';
  
  // COLOR CLAVE: Definimos el color del círculo polar explícitamente para ambos modos
  const polarCircleBg = isDarkMode ? '#0f172a' : '#ffffff';

  // 1. PROCESAMIENTO DE TRAZOS SEGÚN ESCALA
  const traces = useMemo(() => {
    return data.map((set) => {
      let displayR;
      const maxGain = Math.max(...set.gain);

      if (isARRL) {
        // Fórmula ARRL: 10^((G - Gmax) / 40) -> Rango: 0.1 (-40dB) a 1.0 (0dB)
        displayR = set.gain.map(g => {
          const relativeGain = Math.max(g - maxGain, -40);
          return Math.pow(10, relativeGain / 40);
        });
      } else {
        // Modo Lineal (dB) directo
        displayR = set.gain;
      }

      return {
        type: 'scatterpolar',
        mode: 'lines',
        name: `${set.freq} MHz`,
        r: displayR,
        theta: set.angles,
        line: { width: 2.5 },
        customdata: set.gain,
        hovertemplate: `<b>${set.freq} MHz</b><br>Ángulo: %{theta}°<br>Ganancia: %{customdata:.2f} dBi<extra></extra>`,
        visible: true 
      };
    });
  }, [data, isARRL]);

  // 2. CONFIGURACIÓN DINÁMICA DEL EJE RADIAL (ESCALAS & CONTRASTE)
  const radialAxisConfig = useMemo(() => {
    const globalMaxGain = Math.max(...data.map(set => Math.max(...set.gain)));
    
    const relativeStepsARRL = [0, -3, -6, -10, -20, -40];
    const relativeStepsLinear = [0, -10, -20, -30, -40];

    const tickTextARRL = relativeStepsARRL.map(step => 
      `${(globalMaxGain + step).toFixed(1)} dBi`
    );
    
    const tickTextLinear = relativeStepsLinear.map(step => 
      `${(globalMaxGain + step).toFixed(1)} dBi`
    );

    if (isARRL) {
      return {
        range: [0, 1.05],
        tickvals: [1.0, 0.841, 0.708, 0.562, 0.316, 0.1], // Posiciones logarítmicas ARRL
        ticktext: tickTextARRL,
        gridcolor: gridColor,
        tickfont: { size: 9, color: labelColor }
      };
    }
    
    return {
      range: [Math.min(...data[0].gain) - 10, Math.max(...data[0].gain) + 5],
      gridcolor: gridColor,
      tickfont: { size: 9, color: labelColor }
    };
  }, [data, isARRL, gridColor, labelColor]);

  // 3. GENERACIÓN MEMORIZADA DEL LAYOUT (CORRECCIÓN DE BG COLOR)
  const layout = useMemo(() => {
    return {
      title: {
        text: isAzimuth ? 'Corte de Azimut' : 'Corte de Elevación',
        font: { size: 14, color: titleColor, weight: 'bold', family: 'sans-serif' }
      },
      // Forzamos transparente el contenedor de Plotly
      paper_bgcolor: 'rgba(0,0,0,0)', 
      
      // SOLUCIÓN: plot_bgcolor debe declararse explícitamente en la raíz además de polar.bg_color
      plot_bgcolor: polarCircleBg, 
      
      polar: {
        // Aseguramos que el fondo del área circular se acople al tema
        bgcolor: polarCircleBg, 
        radialaxis: radialAxisConfig,
        angularaxis: {
          gridcolor: gridColor,
          direction: 'clockwise',
          rotation: 90,
          tickfont: { size: 10, color: labelColor }
        }
      },
      showlegend: true,
      legend: { 
        orientation: 'h', 
        y: -0.15, 
        x: 0.5, 
        xanchor: 'center',
        font: { size: 10, color: titleColor },
        bgcolor: 'rgba(0,0,0,0)'
      },
      margin: { l: 40, r: 40, t: 60, b: 40 },
      hovermode: 'closest',
      autosize: true
    };
  }, [isAzimuth, polarCircleBg, radialAxisConfig, gridColor, labelColor, titleColor]);

  return (
    <div className="w-full h-full min-h-[400px] relative flex flex-col bg-white dark:bg-slate-900 rounded-xl transition-colors duration-200">
      {/* Switch de Escala Estilizado */}
      <div className="absolute top-0 right-0 z-10">
        <button
          onClick={() => setIsARRL(!isARRL)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-[8px] font-black uppercase tracking-wider transition-all shadow-sm ${
            isARRL 
              ? 'bg-slate-800 border-slate-900 text-white dark:bg-slate-700 dark:border-slate-600' 
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700'
          }`}
        >
          <div className={`w-2 h-2 rounded-full ${isARRL ? 'bg-indigo-500 dark:bg-indigo-400 animate-pulse' : 'bg-slate-300 dark:bg-slate-600'}`} />
          Escala ARRL
        </button>
      </div>

      {/* Contenedor del Gráfico Polar */}
      <div className="w-full h-full flex-1">
        <Plot
          key={`plotly-polar-${isDarkMode}-${isARRL}`}
          data={traces}
          layout={layout}
          config={{ 
            responsive: true, 
            displaylogo: false
          }}
          style={{ width: '100%', height: '100%' }}
          useResizeHandler={true}
        />
      </div>
    </div>
  );
};

export default MultiPolarViewer;