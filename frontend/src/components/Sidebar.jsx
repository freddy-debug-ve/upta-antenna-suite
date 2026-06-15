import React, { useState, useEffect } from 'react';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis, restrictToWindowEdges } from '@dnd-kit/modifiers';
import { Plus, Zap, Box, Download, Upload, Info, Layers, Radio, ArrowLeft, SatelliteDish, Menu, X, Sun, Moon } from 'lucide-react';
import ElementBox from './ElementBox';
import SourceBox from './SourceBox';
import InputSmall from './InputSmall';

// --- Wrapper para hacer cada ElementBox "arrastrable" ---
const SortableItem = (props) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: props.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  
  if (props.block) {
    return (
      <div>
        <ElementBox {...props} />
      </div>
    );
  }
  
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ElementBox {...props} />
    </div>
  );
};

const Sidebar = ({ 
  elements, 
  setElements, 
  loadSimulation, 
  saveSimulation, 
  addElement, 
  sources, 
  setSources, 
  addSource, 
  removeElement, 
  updateElement, 
  onSimulate, 
  geometryOk, 
  frequency, 
  setFrequency, 
  freqMode, 
  setFreqMode, 
  freqStart, 
  setFreqStart, 
  freqSteps, 
  setFreqSteps, 
  freqEnd, 
  setFreqEnd, 
  wires, 
  availableTags, 
  setSelectedSourceTag, 
  isDirty, 
  setIsMaximized, 
  openModal, 
  blockDrag, 
  setBlockDrag,
  setShowInfo, 
  isDarkMode, 
  setIsDarkMode}) => {
  
  // --- ESTADOS DE ADAPTABILIDAD Y TEMA ---
  const [isOpenMobile, setIsOpenMobile] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleExportNEC = async () => {
    const payload = { freq : parseFloat(frequency) };
    try {
      // CORRECCIÓN NGINX: Cambiado de IP fija a ruta relativa compatible con el proxy inverso
      const response = await fetch('/api/export-nec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        const blob = new Blob([data.nec_text], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `UPTA_Validation_${frequency}MHz.nec`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert("Error al generar el archivo .NEC");
      }
    } catch (error) {
      console.error("Error de conexión:", error);
      alert("No se pudo conectar con el servidor para exportar.");
    }
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setElements((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const [activeTab, setActiveTab] = useState('geometry');

  return (
    <>
      {/* Botón flotante disparador exclusivo para pantallas móviles */}
      <button 
        onClick={() => setIsOpenMobile(!isOpenMobile)}
        className="md:hidden fixed bottom-4 right-4 z-40 bg-indigo-600 dark:bg-indigo-500 text-white p-3 rounded-full shadow-xl transition-transform active:scale-95"
      >
        {isOpenMobile ? <X size={22} /> : <Menu size={22} />}
      </button>

      {/* Capa de desenfoque de fondo al desplegar menú móvil */}
      {isOpenMobile && (
        <div 
          onClick={() => setIsOpenMobile(false)}
          className="md:hidden fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-30 animate-in fade-in duration-150"
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-30 w-80 sm:w-96 bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 h-full flex flex-col shadow-inner transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0 md:z-10
        ${isOpenMobile ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Header Fijo */}
        <div className="p-4 bg-slate-900 dark:bg-slate-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SatelliteDish className="text-emerald-400" size={20} />
            <h1 className="font-bold tracking-tight uppercase text-xs sm:text-sm">RF Designer UPT Aragua</h1>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Botón Guardar */}
            <button 
              onClick={saveSimulation} 
              className="p-1.5 text-slate-400 hover:text-indigo-400 transition-colors"
              title="Descargar Proyecto"
            >
              <Download size={16} />
            </button>
    
            {/* Botón Cargar */}
            <label className="p-1.5 text-slate-400 hover:text-indigo-400 cursor-pointer transition-colors">
              <Upload size={16}/>
              <input
                title='Cargar Proyecto'      
                type="file" 
                className="hidden" 
                accept=".json" 
                onChange={loadSimulation}
              />
            </label>

            <button 
              onClick={() => setShowInfo(true)}
              className="p-1.5 text-slate-400 hover:text-emerald-400 transition-colors"
              title="Información del Sistema"
            >
              <Info size={16} />
            </button>
            
            <button 
              onClick={() => {
                setIsOpenMobile(false);
                setIsMaximized(true);
              }}
              className="hidden md:flex p-1.5 ml-1 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-600 hover:text-white rounded-md transition-all items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2"
              title="Ocultar"
            >
              <ArrowLeft size={12} />
            </button>
          </div>
        </div>

        {/* Botonera Principal de Navegación de Tabs */}
        <div className="flex bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
          <button 
            onClick={() => setActiveTab('geometry')} 
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'geometry' ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400 bg-indigo-50/30 dark:bg-indigo-950/20' : 'text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900'}`}
          >
            <Layers size={14} /> Geometría ({elements.length})
          </button>
          <button 
            onClick={() => setActiveTab('sources')} 
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'sources' ? 'text-amber-600 dark:text-amber-500 border-b-2 border-amber-500 bg-amber-50/30 dark:bg-amber-950/10' : 'text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900'}`}
          >
            <Zap size={14} /> Fuentes ({sources.length})
          </button>
        </div>

        {/* Área de Parámetros Scrolleable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeTab === 'geometry' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {/* PASO 1: RENDERIZAR GEOMETRÍA */}
                <button 
                  disabled={elements.length === 0}
                  onClick={() => onSimulate('geometry')} 
                  className={`flex items-center justify-center gap-2 py-2 rounded text-[10px] font-bold transition-all shadow-sm active:scale-95
                  ${elements.length > 0
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer' 
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-60'}`}
                >
                  <Box size={14} /> 1. OBTENER GEOMETRÍA
                </button>

                {/* PASO 2: CALCULAR GANANCIA */}
                <button 
                  disabled={!geometryOk || isDirty}
                  onClick={() => onSimulate('pattern')} 
                  className={`flex items-center justify-center gap-2 py-2 rounded text-[10px] font-bold transition-all shadow-md active:scale-95 
                  ${geometryOk && !isDirty
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer' 
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-60'}`}
                >
                  <Zap size={14} /> 2. CALCULAR GANANCIA
                </button>
                
                <button 
                  onClick={addElement} 
                  className="col-span-2 flex items-center justify-center gap-2 bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 text-white py-2 rounded text-xs font-semibold transition-all shadow-md active:scale-95"
                >
                  <Plus size={14} /> Nuevo Elemento
                </button>
              </div>

              {!geometryOk && (
                <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center italic">
                  Renderiza la geometría para habilitar el cálculo de ganancia.
                </p>
              )}
			  
			  <hr className="border-slate-300 dark:border-slate-800" />
              
              <div>
                <div className="flex items-baseline gap-2">
				  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 block">
					Geometría de Hilos
				  </span>

				  <span className="text-slate-400 dark:text-slate-600">|</span>

				  <span className="text-[9px] font-normal normal-case text-slate-500 dark:text-slate-400 italic">
					Considerando f={frequency} MHz en la construcción.
				  </span>
				</div>
                
                <DndContext sensors={sensors} modifiers={[restrictToVerticalAxis, restrictToWindowEdges]} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={elements.map(el => el.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-1.5">
                      {elements.map((el, index) => (
                        <SortableItem
                          key={el.id} 
                          id={el.id} 
                          element={el}
                          index={index}
                          updateElement={updateElement}
                          removeElement={removeElement}
                          setBlockDrag={setBlockDrag}
                          block={blockDrag}
                          openModal={openModal}
						  frequency={frequency}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>

                {elements.length === 0 && (
                  <div className="p-8 text-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-slate-400 dark:text-slate-500 text-xs italic bg-white dark:bg-slate-950">
                    Agregue un elemento para comenzar el diseño
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Ajustado fondo adaptivo del contenedor de fuentes */
            <div className="bg-white dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Radio size={14} className="text-emerald-500" /> Excitación (Fuentes)
                </label>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={handleExportNEC} 
                    className="text-[9px] bg-slate-50 dark:bg-slate-900 hover:bg-amber-100 dark:hover:bg-amber-950/40 text-amber-600 px-2 py-0.5 rounded font-bold border border-amber-200 dark:border-amber-900/60 transition-colors flex items-center gap-1"
                    title="Exportar para 4NEC2"
                  >
                    .NEC
                  </button>
                  <button onClick={addSource} className="text-[9px] bg-slate-50 dark:bg-slate-900 hover:bg-indigo-100 dark:hover:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded font-bold border border-indigo-200 dark:border-indigo-900/60 transition-colors">
                    + AÑADIR
                  </button>
                </div>
              </div>

              {/* SECCIÓN DE FRECUENCIA */}
              <div className="p-2 bg-slate-100 dark:bg-slate-900/50 rounded-md border border-slate-200 dark:border-slate-800/60 space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase">Frecuencia (MHz)</span>
                  <select 
                    value={freqMode} 
                    onChange={(e) => setFreqMode(e.target.value)}
                    className="text-[9px] bg-transparent font-bold text-indigo-600 dark:text-indigo-400 outline-none cursor-pointer"
                  >
                    <option value="single" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">Única</option>
                    <option value="sweep" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">Barrido</option>
                  </select>
                </div>

                {freqMode === 'single' ? (
                  <InputSmall 
                    label="Frecuencia Central" 
                    value={frequency || 140} 
                    onChange={(v) => setFrequency(v)} 
                  />
                ) : (
                  <div className="grid grid-cols-3 gap-1">
                    <InputSmall label="Inicio" value={freqStart} onChange={setFreqStart} />
                    <InputSmall label="Fin" value={freqEnd} onChange={setFreqEnd} />
                    <InputSmall label="Pasos" value={freqSteps} onChange={setFreqSteps} />
                  </div>
                )}
              </div>

              <hr className="border-slate-200 dark:border-slate-800" />

              <div className="overflow-y-auto pr-1 space-y-4">
                {sources.map((src, index) => (
                  <SourceBox 
                    key={src.id}
                    source={src}
                    index={index}
                    onRemove={(id) => setSources(sources.filter(s => s.id !== id))}
                    onUpdate={(id, newData) => setSources(sources.map(s => s.id === id ? newData : s))}
                    availableTags={availableTags}
                    wires={wires}
                    setSelectedSourceTag={setSelectedSourceTag}
                    onFocus={() => setSelectedSourceTag(src.wireIndex)}
                    onBlur={() => setSelectedSourceTag(null)}
                  />
                ))}
        
                {sources.length === 0 && (
                  <div className="text-center py-4 text-[10px] text-slate-400 dark:text-slate-600 italic bg-slate-50 dark:bg-slate-900/30 rounded border border-dashed border-slate-200 dark:border-slate-800">
                    Sin fuentes de alimentación
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* Footer / Barra de estado con Switch Dark/Light Mode */}
        <div className="p-2 bg-slate-200 dark:bg-slate-950 text-[9px] text-slate-500 dark:text-slate-400 flex justify-between items-center uppercase font-medium border-t border-slate-300 dark:border-slate-800">
          <div className="flex gap-3">
            <span>Elementos: {elements.length}</span>
            <span>Motor: pymininec</span>
          </div>
          
          {/* Toggle de Interfaz Claro/Oscuro */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-300/60 hover:bg-slate-300 dark:bg-slate-900 dark:hover:bg-slate-800 transition-colors border border-slate-400/30 dark:border-slate-700/50 text-slate-700 dark:text-slate-300"
            title={isDarkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          >
            {isDarkMode ? (
              <>
                <Sun size={10} className="text-amber-400 fill-amber-400" />
                <span className="text-[8px] font-bold">Claro</span>
              </>
            ) : (
              <>
                <Moon size={10} className="text-indigo-600 dark:text-indigo-400" />
                <span className="text-[8px] font-bold">Oscuro</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;