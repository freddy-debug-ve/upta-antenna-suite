import React, { useMemo, useState, useEffect } from 'react';
import Plotly from 'plotly.js-dist-min';
import _createPlotComponent from 'react-plotly.js/factory';

const createPlotComponent = _createPlotComponent.default || _createPlotComponent;
const Plot = createPlotComponent(Plotly);

/**
 * @component PatternViewer
 * @description Visor tridimensional del patrón de radiación (ganancia dBi) de la antena.
 * Soporta escalamiento estándar o compresión logarítmica ARRL y es completamente adaptativo.
 */
const PatternViewer = ({ data, isDarkMode = typeof document !== 'undefined' && document.documentElement.classList.contains('dark') }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isARRL, setIsARRL] = useState(false);
  
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


  const activeData = useMemo(() => {
    if (!data || data.length === 0) return null;
    
    const p = data[currentIndex];
    
    const cleanR = p.r.map(row => 
      row.map(val => (val === null || isNaN(val) ? p.min_actual : val))
    );

    return { ...p, r: cleanR };
  }, [data, currentIndex]);

  const prepareCustomData = (matrixR, matrixX, matrixY, matrixZ) => {
    if (!matrixR || !matrixR.length) return [];
    return matrixR[0].map((_, j) => 
      matrixR.map((row, i) => {
        const r = matrixR[i][j];
        const x = matrixX[i][j];
        const y = matrixY[i][j];
        const z = matrixZ[i][j];

        // Azimuth: Norte en Y=0 (eje Y positivo)
        let az = Math.atan2(x, y) * (180 / Math.PI);
        if (az < 0) az += 360;

        // Elevación: Ángulo respecto al plano XY
        const distHoriz = Math.sqrt(x**2 + y**2);
        const el = Math.atan2(z, distHoriz) * (180 / Math.PI);

        return [r, az, el];
      })
    );
  };

  const formattedCustomData = useMemo(() => {
    if (!activeData) return [];
    return prepareCustomData(
      activeData.r, 
      activeData.x, 
      activeData.y, 
      activeData.z
    );
  }, [activeData]);

  // 1. GENERACIÓN DE TRACES TRIDIMENSIONALES Y ADAPTACIÓN DE COLORBAR
  const plotData = useMemo(() => {
    if (!activeData) return [];

    const textAndAxisColor = isDarkMode ? '#94a3b8' : '#475569';

    return [{
      type: 'surface',
      x: isARRL ? activeData.ARRLx : activeData.x,
      y: isARRL ? activeData.ARRLy : activeData.y,
      z: isARRL ? activeData.ARRLz : activeData.z,
      surfacecolor: activeData.r,
      customdata: formattedCustomData,
      colorscale: 'Rainbow',
      cmin: -40,
      cmax: activeData.max_gain || 15,
      hovertemplate: '<b>Ganancia:</b> %{customdata[0]:.2f} dBi<br>' +
      '<b>Azimuth:</b> %{customdata[1]:.1f}°<br>' +
      '<b>Elevación:</b> %{customdata[2]:.1f}°' +
      '<extra></extra>',
      connectgaps: false,
      
      // Ajuste paramétrico de la leyenda de escala cromática según el tema e interfaz
      colorbar: isMobile ? {
        orientation: 'h',
        title: {
          text: 'Ganancia (dBi)',
          side: 'top',
          font: { size: 10, family: 'sans-serif', weight: 'bold', color: textAndAxisColor }
        },
        thickness: 10,
        len: 0.45,
        x: 0.95,
        y: 0.95,
        xanchor: 'right',
        yanchor: 'top',
        tickfont: { size: 9, color: textAndAxisColor }
      } : {
        orientation: 'v',
        title: {
          text: 'Ganancia (dBi)',
          side: 'top',
          font: { size: 12, family: 'sans-serif', weight: 'bold', color: textAndAxisColor }
        },
        thickness: 15,
        len: 0.75,
        x: 1.02,
        y: 0.5,
        yanchor: 'middle',
        tickfont: { color: textAndAxisColor }
      },
      lighting: { ambient: 0.7, diffuse: 0.8 }
    }];
  }, [activeData, isARRL, isMobile, formattedCustomData, isDarkMode]);

  if (!data || data.length === 0) return null;

  // Paleta estructural para Plotly en base al tema global
  const gridColor = isDarkMode ? '#1e293b' : '#f1f5f9';
  const zerolineColor = isDarkMode ? '#475569' : '#cbd5e1';
  const bgCanvas = isDarkMode ? '#0f172a' : '#ffffff';

  return (
    <div className="w-full h-full relative flex flex-col bg-white dark:bg-slate-900 transition-colors duration-200">
      {/* Controles Flotantes Superiores */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 pointer-events-auto">
        
        {/* Selector de Frecuencia */}
        <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm p-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-2 w-fit transition-colors">
          <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-tighter">
            {data.length > 1 ? 'Frecuencia:' : 'Freq:'}
          </span>
          {data.length > 1 ? (
            <select 
              value={currentIndex}
              onChange={(e) => setCurrentIndex(parseInt(e.target.value))}
              className="text-[11px] font-bold bg-transparent outline-none text-indigo-600 dark:text-indigo-400 cursor-pointer"
            >
              {data.map((p, idx) => (
                <option key={idx} value={idx} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                  {p.frequency} MHz
                </option>
              ))}
            </select>
          ) : (
            <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">{data[0].frequency} MHz</span>
          )}
        </div>

        {/* Switch de Escalamiento ARRL */}
        <button 
          onClick={() => setIsARRL(!isARRL)}
          className={`flex items-center gap-2 p-2 rounded-lg border transition-all shadow-sm backdrop-blur-sm w-fit ${
            isARRL 
              ? 'bg-indigo-600 border-indigo-700 text-white dark:bg-indigo-500 dark:border-indigo-600' 
              : 'bg-white/90 border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800/90 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700'
          }`}
        >
          <div className={`w-2.5 h-2.5 rounded-full ${isARRL ? 'bg-white animate-pulse' : 'bg-slate-300 dark:bg-slate-600'}`} />
          <span className="text-[10px] font-black uppercase tracking-widest">
            Modo ARRL: {isARRL ? 'ON' : 'OFF'}
          </span>
        </button>
      </div>

      {/* Renderizado del Lienzo Plotly */}
      <div className="w-full h-full flex-1">
        <Plot
          // Forzamos actualización limpia al cambiar de tema o viewport para evitar fugas estéticas
          key={isMobile ? `plotly-pattern-mobile-${isDarkMode}` : `plotly-pattern-desktop-${isDarkMode}`}
          data={plotData}
          layout={{
            autosize: true,
            margin: isMobile 
              ? { l: 0, r: 0, b: 0, t: 40 }
              : { l: 0, r: 50, b: 0, t: 0 },
            scene: {
              aspectmode: 'data',
              xaxis: { 
                title: 'X', 
                gridcolor: gridColor,
                showticklabels: false,
                zeroline: true,
                zerolinecolor: zerolineColor
              },
              yaxis: { 
                title: 'Y', 
                gridcolor: gridColor,
                showticklabels: false,
                zeroline: true,
                zerolinecolor: zerolineColor
              },
              zaxis: { 
                title: 'Z', 
                gridcolor: gridColor,
                showticklabels: false,
                zeroline: true,
                zerolinecolor: zerolineColor
              },
              camera: isMobile 
                ? { eye: { x: 1.9, y: 1.9, z: 1.7 } } 
                : { eye: { x: 1.7, y: 1.7, z: 1.5 } }
            },
            paper_bgcolor: bgCanvas,
            plot_bgcolor: bgCanvas,
            hovermode: 'closest'
          }}
          useResizeHandler={true}
          config={{ 
            responsive: true, 
            displaylogo: false,
            modeBarButtonsToRemove: ['presetSetting'] 
          }}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  );
};

export default PatternViewer;