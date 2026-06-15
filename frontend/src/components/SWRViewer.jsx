import React, { useState, useMemo } from 'react';
import Plotly from 'plotly.js-dist-min';
import _createPlotComponent from 'react-plotly.js/factory';

const createPlotComponent = _createPlotComponent.default || _createPlotComponent;
const Plot = createPlotComponent(Plotly);

/**
 * @component SWRViewer
 * @description Visor analítico para parámetros de red (SWR, Resistencia R y Reactancia X).
 * Adapta su lógica visual de forma automática ante un análisis monorrecuente o un barrido de frecuencias.
 */
const SWRViewer = ({ networkData, isDarkMode = typeof document !== 'undefined' && document.documentElement.classList.contains('dark') }) => {
  const [sourceKey, setSourceKey] = useState(Object.keys(networkData)[0] || "1");
  const activeData = networkData[sourceKey];


  // Ajustes estructurales de color según el tema activo de la aplicación
  const gridColor = isDarkMode ? '#1e293b' : '#f1f5f9';
  const textAndAxisColor = isDarkMode ? '#94a3b8' : '#475569';
  const zerolineColor = isDarkMode ? '#334155' : '#cbd5e1';

  if (!activeData) {
    return (
      <div className="p-4 text-xs italic font-medium text-slate-400 dark:text-slate-500">
        Sin datos de red disponibles...
      </div>
    );
  }

  // VERIFICACIÓN: ¿Es una sola frecuencia o un barrido de banda?
  const isSingleFrequency = Array.isArray(activeData.f) ? activeData.f.length === 1 : true;

  // 1. CONFIGURACIÓN COMPLETA DEL LAYOUT ADAPTATIVO MEDIANTE MEMORIZACIÓN
  const layoutConfig = useMemo(() => {
    return {
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      autosize: true,
      margin: { l: 50, r: 50, t: 20, b: 40 },
      showlegend: true,
      legend: { 
        orientation: 'h', 
        x: 0.5, 
        xanchor: 'center', 
        y: -0.3,
        font: { color: textAndAxisColor, size: 11 }
      },
      xaxis: {
        title: { text: 'Frecuencia (MHz)', font: { color: textAndAxisColor } },
        gridcolor: gridColor,
        linecolor: zerolineColor,
        tickfont: { color: textAndAxisColor },
        automargin: true,
        ...(isSingleFrequency ? {
          type: 'category', // Trata la muestra puntual como etiqueta discreta para evitar interpolaciones
          tickvals: [activeData.f[0].toString()],
          range: [-1, 1]
        } : {
          type: 'linear'
        })
      },
      yaxis: {
        title: { text: 'SWR', font: { color: textAndAxisColor } },
        gridcolor: gridColor,
        linecolor: isDarkMode ? '#10b981' : '#059669', // Adaptación de la línea de SWR (Verde óptico)
        tickfont: { color: textAndAxisColor },
        range: [0, 10],
        dtick: 1,
      },
      yaxis2: {
        title: { text: 'Impedancia (Ω)', font: { color: textAndAxisColor } },
        overlaying: 'y',
        side: 'right',
        gridcolor: 'transparent',
        linecolor: '#3b82f6',
        tickfont: { color: textAndAxisColor },
        zeroline: true,
        zerolinecolor: zerolineColor,
      },
      hovermode: 'x unified',
    };
  }, [isSingleFrequency, activeData, isDarkMode, gridColor, textAndAxisColor, zerolineColor]);

  // 2. PREPARACIÓN E INYECCIÓN DE TRAZOS VECTORIALES
  const plotData = useMemo(() => {
    const xData = isSingleFrequency ? [activeData.f[0]] : activeData.f;

    return [
      {
        x: xData,
        y: isSingleFrequency ? [activeData.swr[0]] : activeData.swr,
        name: 'SWR',
        type: isSingleFrequency ? 'bar' : 'scatter',
        width: isSingleFrequency ? 0.1 : null,
        yaxis: 'y1',
        marker: { color: '#10b981' },
        line: { color: '#10b981', width: 3 }
      },
      {
        x: xData,
        y: isSingleFrequency ? [activeData.r[0]] : activeData.r,
        name: 'Resistencia (Ω)',
        type: isSingleFrequency ? 'bar' : 'scatter',
        width: isSingleFrequency ? 0.1 : null,
        yaxis: 'y2',
        marker: { color: '#3b82f6' },
        line: { color: '#3b82f6', dash: 'dash', width: 2 }
      },
      {
        x: xData,
        y: isSingleFrequency ? [activeData.x[0]] : activeData.x,
        name: 'Reactancia (jΩ)',
        type: isSingleFrequency ? 'bar' : 'scatter',
        width: isSingleFrequency ? 0.1 : null,
        yaxis: 'y2',
        marker: { color: '#f43f5e' },
        line: { color: '#f43f5e', dash: 'dot', width: 2 }
      }
    ];
  }, [activeData, isSingleFrequency]);

  return (
    <div className="flex flex-col h-full w-full bg-white dark:bg-slate-900 rounded-xl transition-colors duration-200">
      {/* Pestañas de Conmutación de Fuentes RF */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-none">
        {Object.keys(networkData).map((key) => (
          <button
            key={key}
            onClick={() => setSourceKey(key)}
            className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border ${
              sourceKey === key 
                ? 'bg-emerald-500 border-emerald-600 text-white shadow-sm dark:bg-emerald-600 dark:border-emerald-700' 
                : 'bg-slate-100 border-slate-200 text-slate-400 hover:bg-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-500 dark:hover:bg-slate-700'
            }`}
          >
            {networkData[key].name || `Fuente ${key}`}
          </button>
        ))}
      </div>

      {/* Cuadro Clínico de Mediciones: Resumen si es frecuencia fija */}
      {isSingleFrequency && (
        <div className="grid grid-cols-3 gap-2 mb-4 text-center">
          <div className="bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded-lg border border-emerald-100 dark:border-emerald-900/50 transition-colors">
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-tight">SWR</p>
            <p className="text-xl font-black text-emerald-700 dark:text-emerald-400">{activeData.swr[0].toFixed(2)}</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-950/30 p-2 rounded-lg border border-blue-100 dark:border-blue-900/50 transition-colors">
            <p className="text-[10px] text-blue-600 dark:text-blue-400 font-black uppercase tracking-tight">Resistencia</p>
            <p className="text-xl font-black text-blue-700 dark:text-blue-400">{activeData.r[0].toFixed(1)} Ω</p>
          </div>
          <div className="bg-rose-50 dark:bg-rose-950/30 p-2 rounded-lg border border-rose-100 dark:border-rose-900/50 transition-colors">
            <p className="text-[10px] text-rose-600 dark:text-rose-400 font-black uppercase tracking-tight">Reactancia</p>
            <p className="text-xl font-black text-rose-700 dark:text-rose-400">{activeData.x[0].toFixed(1)} jΩ</p>
          </div>
        </div>
      )}
    
      {/* Contenedor Gráfico Activo */}
      <div className="flex-1 min-h-[300px]">
        <Plot 
          // Forzamos reseteo del canvas de Plotly al alternar temas para limpiar trazos remanentes
          key={`plotly-swr-${isDarkMode}-${sourceKey}`}
          data={plotData} 
          layout={layoutConfig} 
          style={{ width: '100%', height: '100%' }} 
          config={{ responsive: true, displaylogo: false }}
          useResizeHandler={true}
        />
      </div>
    </div>
  );
};

export default SWRViewer;