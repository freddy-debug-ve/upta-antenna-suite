import React, { useState } from 'react';
import { MousePointer, Pencil, Eraser, Layers, Maximize2, Check, X } from 'lucide-react';
import Viewport2D from './Viewport2D';
import Viewport3DPreview from './Viewport3DPreview';

/**
 * @component OrthogonalEditor
 * @description Entorno CAD multi-plano (XY, XZ, YZ) para el modelado ortogonal y síntesis geométrica de hilos.
 * Incluye proyección de perspectiva 3D en tiempo real y soporte responsivo adaptado a dispositivos móviles.
 */
const OrthogonalEditor = ({ isOpen, onClose, wires: initialWires, onSave, setBlockDrag }) => {
  if (!isOpen) return null;

  const [wires, setWires] = useState(initialWires);
  const [activeTool, setActiveTool] = useState('select'); // 'select' | 'draw' | 'erase'
  const [gridSize, setGridSize] = useState(0.1); 
  const [zoomScale, setZoomScale] = useState(100);

  // Control de sub-vistas indexadas para layouts móviles
  const [activeMobileTab, setActiveMobileTab] = useState('xy');
  const [planePosition, setPlanePosition] = useState({ x: 0, y: 0, z: 0 });

  const planes = [
    { id: 'xy', name: 'Vista Superior (X / Y)', axisX: 'X', axisY: 'Y', targetAxis: 'z', label: 'Altura Z' },
    { id: 'xz', name: 'Vista Lateral (X / Z)', axisX: 'X', axisY: 'Z', targetAxis: 'y', label: 'Profundidad Y' },
    { id: 'yz', name: 'Vista Frontal (Y / Z)', axisX: 'Y', axisY: 'Z', targetAxis: 'x', label: 'Corte X' },
  ];

  const handlePlanePosChange = (axis, val) => {
    setPlanePosition(prev => ({ ...prev, [axis]: parseFloat(val) || 0 }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans select-none transition-colors">
      
      {/* 1. BARRA DE HERRAMIENTAS SUPERIOR (CONTROL CAD) */}
      <header className="min-h-14 py-2 md:py-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between px-4 md:px-6 gap-3 shadow-sm">
        
        {/* Contenedor Izquierdo: Herramientas vectoriales y rejilla */}
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 md:gap-6 w-full md:w-auto">
          <h2 className="text-xs md:text-sm font-black text-indigo-600 dark:text-indigo-400 tracking-wider uppercase text-center md:text-left">
            Editor CAD <span className="hidden sm:inline">Geométrico</span>
          </h2>
          
          {/* Caja de Herramientas Dinámicas */}
          <div className="flex bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-1 gap-1">
            <button 
              onClick={() => setActiveTool('select')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTool === 'select' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
              title="Seleccionar / Mover"
            >
              <MousePointer size={12} />
              <span className="hidden sm:inline">Seleccionar</span>
            </button>
            <button 
              onClick={() => setActiveTool('draw')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTool === 'draw' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
              title="Dibujar Hilo"
            >
              <Pencil size={12} />
              <span className="hidden sm:inline">Dibujar</span>
            </button>
            <button 
              onClick={() => setActiveTool('erase')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTool === 'erase' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
              title="Borrar Elementos"
            >
              <Eraser size={12} />
              <span className="hidden sm:inline">Borrar</span>
            </button>
          </div>

          {/* Selectores de Rejilla y Zoom */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
              <span>Grid:</span>
              <select 
                value={gridSize} 
                onChange={(e) => setGridSize(parseFloat(e.target.value))}
                className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg p-1 text-slate-700 dark:text-slate-200 text-[11px] font-medium outline-none cursor-pointer focus:ring-1 focus:ring-indigo-500"
              >
                <option value="1.0">1 m</option>
                <option value="0.5">50 cm</option>
                <option value="0.1">10 cm</option>
                <option value="0.05">5 cm</option>
                <option value="0.02">2 cm</option>
              </select>
            </div>
            
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
              <span>Zoom:</span>
              <select 
                value={zoomScale} 
                onChange={(e) => setZoomScale(parseInt(e.target.value))} 
                className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg p-1 text-slate-700 dark:text-slate-200 text-[11px] font-mono outline-none cursor-pointer focus:ring-1 focus:ring-indigo-500"
              >
                <option value="50">50%</option>
                <option value="100">100%</option>
                <option value="200">200%</option>
                <option value="400">400%</option>
              </select>
            </div>
          </div>
        </div>

        {/* Acciones de Persistencia */}
        <div className="flex items-center justify-center gap-2 w-full md:w-auto border-t md:border-t-0 border-slate-100 dark:border-slate-850 pt-2 md:pt-0">
          <button 
            onClick={onClose}
            className="flex-1 md:flex-initial px-4 py-1.5 text-xs font-bold text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-200 text-center transition-colors flex items-center justify-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-xl"
          >
            <X size={14} /> Cancelar
          </button>
          <button 
            onClick={() => onSave(wires)}
            className="flex-1 md:flex-initial px-5 py-1.5 bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 text-white rounded-xl text-xs font-bold text-center transition-all whitespace-nowrap shadow-md flex items-center justify-center gap-1.5"
          >
            <Check size={14} /> Guardar Antena
          </button>
        </div>
      </header>

      {/* SUB-HEADER: SELECTOR DE VISTAS (LAYOUT RESPONSIVO MÓVIL) */}
      <div className="sm:hidden flex bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[10px] font-black p-1 gap-1">
        {['xy', 'xz', 'yz', '3d'].map((tabId) => (
          <button 
            key={tabId}
            onClick={() => setActiveMobileTab(tabId)}
            className={`flex-1 py-2 text-center rounded-lg uppercase tracking-wider transition-all ${activeMobileTab === tabId ? 'bg-slate-100 dark:bg-slate-950 text-indigo-600 dark:text-indigo-400 font-black' : 'text-slate-400 dark:text-slate-500'}`}
          >
            {tabId === '3d' ? 'Vista 3D' : `${tabId.toUpperCase()}`}
          </button>
        ))}
      </div>

      {/* 2. PLANOS DE RENDERIZADO (ESPACIO MATRICIAL) */}
      <main className="flex-1 grid grid-cols-1 sm:grid-cols-2 sm:grid-rows-2 p-2 gap-2 bg-slate-100 dark:bg-slate-950 overflow-hidden">
        
        {/* Renderizado Dinámico de Vistas 2D */}
        {planes.map((plane) => {
          const isVisible = activeMobileTab === plane.id;

          return (
            <div 
              key={plane.id} 
              className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-2xl flex flex-col overflow-hidden relative group h-full w-full shadow-sm
                ${isVisible ? 'flex' : 'hidden sm:flex'}
              `}
            >
              {/* Overlay Flotante de Control de Altura/Corte */}
              <div className="absolute top-3 left-3 z-10 bg-white/90 dark:bg-slate-950/80 backdrop-blur-md px-2.5 py-1.5 rounded-xl text-[10px] font-bold text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-850 flex items-center gap-2 shadow-sm">
                <Layers size={11} className="text-indigo-500" />
                <span className="font-bold">{plane.name}</span>
                <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-800 pl-2">
                  <label className="text-indigo-600 dark:text-indigo-400 font-mono">{plane.label}:</label>
                  <input 
                    type="number" 
                    step="any"
                    value={planePosition[plane.targetAxis]} 
                    onChange={(e) => handlePlanePosChange(plane.targetAxis, e.target.value)}
                    className="w-14 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-center font-mono text-slate-800 dark:text-white text-[10px] outline-none focus:ring-1 focus:ring-indigo-400 transition-all"
                  />
                  <span className="text-slate-400 dark:text-slate-500">m</span>
                </div>
              </div>

              {/* Lienzo con Patrón Reticular (Grid CAD) */}
              <div className="flex-1 w-full h-full flex items-center justify-center relative bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]">
                <div className="absolute bottom-3 left-3 text-[9px] font-mono text-slate-400 dark:text-slate-600 uppercase tracking-widest hidden sm:block">
                  H: {plane.axisX} │ V: {plane.axisY}
                </div>
                
                <Viewport2D 
                  plane={plane} 
                  wires={wires} 
                  activeTool={activeTool} 
                  scale={zoomScale}
                  gridSize={gridSize}
                  planePosition={planePosition}
                  onUpdateWires={(newW) => setWires(newW)}
                />
              </div>
            </div>
          );
        })}

        {/* 4to Cuadrante: Isométrica / Preview Proyectiva 3D */}
        <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-2xl flex flex-col overflow-hidden relative h-full w-full shadow-sm
          ${activeMobileTab === '3d' ? 'flex' : 'hidden sm:flex'}
        `}>
          <div className="absolute top-3 left-3 z-10 bg-indigo-50/90 dark:bg-indigo-950/80 backdrop-blur-md px-2.5 py-1.5 rounded-xl text-[10px] font-black text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40 pointer-events-none shadow-sm flex items-center gap-1.5">
            <Maximize2 size={11} />
            VISTA PREVIA 3D (PERSPECTIVA)
          </div>
  
          <div className="flex-1 w-full h-full bg-slate-50/50 dark:bg-slate-950/20">
            <Viewport3DPreview wires={wires} />
          </div>
        </div>

      </main>
    </div>
  );
};

export default OrthogonalEditor;