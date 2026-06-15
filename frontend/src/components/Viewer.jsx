import React, { useState } from 'react';
import { Minimize2, Maximize2, RefreshCw, Layers, Box, Activity, Search, Download, Radio } from 'lucide-react';
import PatternViewer from './PatternViewer';
import GeometryViewer from './GeometryViewer';
import SWRViewer from './SWRViewer';
import MultiPolarViewer from './PolarViewer';

const Viewer = ({ networkData, isSimulating, isBuilding, wires, SelectedSourceTag, allSources, patternData, handleCalculateSWR, loadingSWR, isDirty, setIsDirty, patterns_2d, setIsMaximized, isMaximized, isDarkMode }) => {
  const [activeTab, setActiveTab] = useState('geometry');

  const tabs = [
    { id: 'geometry', label: 'Geometría 3D', icon: <Box size={14} />, color: 'border-indigo-600 dark:border-indigo-400' },
    { id: 'pattern', label: 'Patrón de Radiación', icon: <Radio size={14} />, color: 'border-emerald-600 dark:border-emerald-400' },
    { id: 'smith', label: 'SWR / Impedancia', icon: <Activity size={14} />, color: 'border-amber-600 dark:border-amber-400' },
    { id: '2D', label: 'Azimuth/Elevación', icon: <Layers size={14} />, color: 'border-emerald-600 dark:border-emerald-400' },
  ];

  // Helper para decidir qué renderizar según la pestaña activa
  const renderMainContent = () => {
    switch (activeTab) {
      case 'geometry':
        return (
          <div className="flex-1 flex flex-col relative w-full h-full min-h-[350px]">
            {isBuilding ? (
              /* ESTADO CARGA GEOMETRÍA */
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center space-y-4 bg-white/60 dark:bg-slate-950/60 backdrop-blur-sm rounded-xl">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-slate-200 dark:border-slate-800 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin"></div>
                  <Activity size={20} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600 dark:text-indigo-400 animate-pulse" />
                </div>
                <div className="text-center">
                  <p className="text-slate-600 dark:text-slate-300 font-bold text-sm">Procesando NEC-2</p>
                  <p className="text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest">Construyendo Estructura...</p>
                </div>
              </div>
            ) : wires?.length > 0 ? (
              <GeometryViewer wires={wires} selectedTag={SelectedSourceTag} allSources={allSources} isDarkMode={isDarkMode} />
            ) : (
              /* ESTADO VACÍO GEOMETRÍA */
              <div className="flex-1 flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 p-10 text-center">
                <div className="w-20 h-20 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mb-6 border border-slate-100 dark:border-slate-800 shadow-inner">
                  <Box size={40} strokeWidth={1} className="text-indigo-300 dark:text-indigo-500" />
                </div>
                <h3 className="text-slate-500 dark:text-slate-400 font-bold text-lg">Visualizador de Geometría</h3>
                <p className="text-slate-400 dark:text-slate-500 text-sm mt-2 max-w-xs leading-relaxed">
                  Aquí podrás ver la estructura de hilos y la ubicación de las fuentes en tiempo real.
                </p>
                <button className="mt-8 px-6 py-2 border-2 border-slate-200 dark:border-slate-800 rounded-full text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase hover:bg-slate-50 dark:hover:bg-slate-900 transition-all">
                  Esperando datos del motor...
                </button>
              </div>
            )}
          </div>
        );

      case 'pattern':
        return (
          <div className="flex-1 flex flex-col relative w-full h-full min-h-[350px]">
            {isSimulating ? (
              /* ESTADO CARGA GANANCIA */
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center space-y-4 bg-white/60 dark:bg-slate-950/60 backdrop-blur-sm rounded-xl">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-slate-200 dark:border-slate-800 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin"></div>
                  <Activity size={20} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600 dark:text-indigo-400 animate-pulse" />
                </div>
                <div className="text-center">
                  <p className="text-slate-600 dark:text-slate-300 font-bold text-sm">Procesando NEC-2</p>
                  <p className="text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest mt-1">Resolviendo corrientes...</p>
                </div>
              </div>
            ) : patternData ? (
              <div className="w-full h-full relative flex-1">
                <PatternViewer data={patternData} isDarkMode={isDarkMode}/>
              </div>
            ) : (
              /* ESTADO VACÍO GANANCIA */
              <div className="flex-1 flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 p-10 text-center">
                <div className="w-20 h-20 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mb-6 border border-slate-100 dark:border-slate-800 shadow-inner">
                  <Radio size={40} strokeWidth={1} className="text-emerald-300 dark:text-emerald-500" />
                </div>
                <h3 className="text-slate-500 dark:text-slate-400 font-bold text-lg">Patrón de Campo Lejano</h3>
                <p className="text-slate-400 dark:text-slate-500 text-sm mt-2 max-w-xs leading-relaxed">
                  Visualiza la ganancia y directividad en un gráfico polar de 360°.
                </p>
                <button className="mt-8 px-6 py-2 border-2 border-slate-200 dark:border-slate-800 rounded-full text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase hover:bg-slate-50 dark:hover:bg-slate-900 transition-all">
                  Esperando datos del motor...
                </button>
              </div>
            )}
          </div>
        );

      case 'smith':
        return (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 p-6 text-center w-full h-full min-h-[320px]">
            {networkData ? (
              <SWRViewer networkData={networkData} isDarkMode={isDarkMode}/>
            ) : (
              /* ESTADO VACÍO SWR */
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="w-20 h-20 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mb-6 border border-slate-100 dark:border-slate-800 shadow-inner">
                  <Activity size={40} strokeWidth={1} className="text-amber-300 dark:text-amber-500" />
                </div>
                <h3 className="text-slate-500 dark:text-slate-400 font-bold text-lg">Análisis de Red</h3>
                <p className="text-slate-400 dark:text-slate-500 text-sm mt-2 max-w-xs leading-relaxed">
                  Primero obtén la geometría y calcula la ganancia para habilitar el análisis de red.
                </p>
                <button 
                  onClick={handleCalculateSWR}
                  disabled={!patternData || loadingSWR}
                  className={`mt-8 px-6 py-2 border-2 rounded-full text-[10px] font-black uppercase transition-all ${
                    patternData && !loadingSWR
                      ? "border-emerald-500 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 cursor-pointer" 
                      : "border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600 opacity-50 cursor-not-allowed"
                  }`}
                >
                  {loadingSWR ? 'Procesando...' : patternData ? 'Calcular ROE e Impedancia' : 'Esperando motor...'}
                </button>
              </div>
            )}
          </div>
        );

      case '2D':
        return (
          <div className="flex-1 w-full h-full">
            {patterns_2d ? (
              <div className="w-full h-full overflow-y-auto p-2 md:p-4 space-y-6 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-6 max-h-[calc(100vh-180px)] md:max-h-none">
                <div className="bg-white dark:bg-slate-900 p-2 md:p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 w-full min-h-[320px] md:min-h-0">
                  <MultiPolarViewer patterns={patterns_2d} isDarkMode={isDarkMode} type="azimuth" />
                </div>
                <div className="bg-white dark:bg-slate-900 p-2 md:p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 w-full min-h-[320px] md:min-h-0">
                  <MultiPolarViewer patterns={patterns_2d} isDarkMode={isDarkMode} type="elevation" />
                </div>
              </div>
            ) : (
              /* ESTADO VACÍO PLANOS 2D */
              <div className="flex-1 flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 p-10 text-center h-full">
                <div className="w-20 h-20 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mb-6 border border-slate-100 dark:border-slate-800 shadow-inner">
                  <Layers size={40} strokeWidth={1} className="text-emerald-300 dark:text-emerald-500" />
                </div>
                <h3 className="text-slate-500 dark:text-slate-400 font-bold text-lg">Cortes de Campo Lejano</h3>
                <p className="text-slate-400 dark:text-slate-500 text-sm mt-2 max-w-xs leading-relaxed">
                  Visualiza los planos de corte bidimensionales de Azimuth y Elevación.
                </p>
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-100 dark:bg-slate-950 overflow-hidden h-full">
      {/* Tabs del Notebook */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-2 md:px-4 shadow-sm z-10 shrink-0">
        <div className="flex overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const isCurrent = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-4 md:px-6 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${
                  isCurrent 
                    ? `${tab.color} text-slate-900 dark:text-slate-100 bg-slate-50/50 dark:bg-slate-950/40` 
                    : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-950/20'
                }`}
              >
                <span className="text-xs">{tab.icon}</span>
                <span className={isCurrent ? 'inline' : 'hidden md:inline'}>{tab.label}</span>
              </button>
            );
          })}
        </div>
        
        <div className="flex gap-1 shrink-0">
          <button 
            disabled={!isDirty}
            onClick={() => {
              handleCalculateSWR();
              setIsDirty(false);
            }}
            className={`flex items-center gap-2 text-slate-400 dark:text-slate-500 rounded-lg p-2 transition-all group ${isDirty ? "hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800" : "opacity-40"}`}
            title="Recalcular"
          >
            <RefreshCw size={15} className={isDirty ? "group-hover:rotate-180 transition-transform duration-500" : ""} />
            <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">
              {isDirty ? "Recalcular" : ""}
            </span>
          </button> 
          
          <button 
            onClick={() => setIsMaximized(!isMaximized)}
            className={`hidden md:flex p-2 transition-colors rounded-lg ${
              isMaximized ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60' : 'text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400'
            }`} 
            title={isMaximized ? "Restaurar paneles" : "Maximizar área de trabajo"}
          >
            {isMaximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>
      </div>

      {/* Contenedor del Visor */}
      <div className="flex-1 p-3 md:p-6 relative overflow-hidden flex flex-col">
        <div className="w-full h-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col relative">
          
          {/* Renderizado de Contenido Dinámico */}
          {renderMainContent()}

          {/* Botón Flotante para Exportar Datos */}
          {activeTab === '2D' && patterns_2d && (
            <div className="absolute top-3 left-4 md:top-6 md:left-6 md:right-auto z-20 animate-in fade-in duration-300">
              <button 
                onClick={() => {
                  const exportData = { datos_2d: patterns_2d };
                  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `Patrones.json`;
                  link.click();
                  URL.revokeObjectURL(url);
                }}
                className="px-3 py-2 bg-slate-800 dark:bg-slate-950 hover:bg-slate-900 text-white text-[9px] font-black uppercase rounded-lg shadow-lg flex items-center gap-1.5 transition-all active:scale-95 border dark:border-slate-800"
              >
                <Download size={13} />
                <span>Exportar</span>
              </button>
            </div>
          )}

          {/* Barra de estado inferior (Se conserva oscura por contraste de diseño instrumental) */}
          <div className="bg-slate-950 px-4 py-2.5 flex justify-between items-center text-[8px] md:text-[9px] text-slate-500 uppercase tracking-[0.2em] font-black border-t border-slate-800 shrink-0">
            <div className="flex gap-4 md:flex-row items-start md:items-center">
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <div className="w-1 h-1 bg-indigo-500 rounded-full"></div>
                Vista: {activeTab === 'geometry' ? "Geometría" : (activeTab === '2D' ? "Cortes Planos" : (activeTab === 'pattern' ? "Patrón de Radiación" : "VSWR"))}
              </span>
              <span className="hidden sm:flex items-center gap-1.5">
                <div className="w-1 h-1 bg-slate-700 rounded-full"></div>
                motor: pymininec
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-500 text-right font-mono tracking-normal md:uppercase md:font-sans md:tracking-[0.2em]">
              <Search size={10}/>
              <span className="md:truncate max-w-[140px] md:max-w-none">Desarrollado por: F. Carta & K. Rodríguez</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Viewer;