import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import katex from 'katex';
import TransformModal from './TransformModal';
import PhysicsModal from './PhysicsModal';
import CoordinateTable from './CoordinateTable';
import OrthogonalEditor from './OrthogonalEditor';
import { GripVertical, Trash2, ChevronDown, ChevronRight, FunctionSquare, Move, Zap } from 'lucide-react';
import 'katex/dist/katex.min.css';

const ElementBox = ({ element, index, updateElement, removeElement, setBlockDrag, openModal, frequency}) => {
  const { type, params } = element;
  
  const [showPhysics, setShowPhysics] = useState(false);
  const [showTransform, setShowTransform] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(element.isCollapsed);
  const [showCoordTable, setShowCoordTable] = useState(false);
  const [showOrthogonalEditor, setShowOrthogonalEditor] = useState(false);

  // Estados locales para manejar las vistas en LaTeX y errores de SymPy devueltos por FastAPI
  const [latexViews, setLatexViews] = useState({ Expr_x: '', Expr_y: '', Expr_z: '' });
  const [errors, setErrors] = useState({ Expr_x: null, Expr_y: null, Expr_z: null });
  
  // Rastrero del campo enfocado o último enfocado (por defecto Expr_x)
  const [activeField, setActiveField] = useState('Expr_x');
  
  const MathRenderer = ({ math, block = false }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current && math) {
      try {
        katex.render(math, containerRef.current, {
          displayMode: block, // True para bloques centrados, False para inline
          throwOnError: false
        });
      } catch (error) {
        console.error("Error renderizando KaTeX:", error);
      }
    }
  }, [math, block]);

  // Usamos un elemento nativo de React controlado por useEffect
  return <span ref={containerRef} />;
};
  
  const handleChange = (field, value) => {
    updateElement(element.id, { 
      params: { ...params, [field]: value } 
    });
  };

  const handleTypeChange = (newType) => {
    updateElement(element.id, { type: newType, params: {} });
  };

  // Función interna para validar de forma asíncrona la sintaxis matemática con FastAPI
  const validateField = async (field, value) => {
    if (!value || !value.toString().trim()) {
      setLatexViews(prev => ({ ...prev, [field]: '' }));
      setErrors(prev => ({ ...prev, [field]: null }));
      return;
    }

    try {
      const response = await axios.post('api/validate-equation', { expr: value });
      
	  if (response.data.status === 'valid') {
        setLatexViews(prev => ({ ...prev, [field]: response.data.latex }));
        setErrors(prev => ({ ...prev, [field]: null }));
      }
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Error de sintaxis';
      setErrors(prev => ({ ...prev, [field]: errorMsg }));
      setLatexViews(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Debounce de 500ms para validar expresiones matemáticas sin saturar el backend de FastAPI
  useEffect(() => {
    if (type !== 'free') return;

    const timerX = setTimeout(() => validateField('Expr_x', params.Expr_x), 500);
    const timerY = setTimeout(() => validateField('Expr_y', params.Expr_y), 500);
    const timerZ = setTimeout(() => validateField('Expr_z', params.Expr_z), 500);

    return () => {
      clearTimeout(timerX);
      clearTimeout(timerY);
      clearTimeout(timerZ);
    };
  }, [params.Expr_x, params.Expr_y, params.Expr_z, type]);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm mb-3 overflow-hidden group hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors">
      {/* Header */}
      <div className="bg-slate-50 dark:bg-slate-950 p-2 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <GripVertical size={16} className="text-slate-400 dark:text-slate-600 cursor-grab active:cursor-grabbing" />
          <button onClick={() => {setIsCollapsed(!isCollapsed); element.isCollapsed=!isCollapsed;}} className="flex items-center gap-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 px-1.5 py-0.5 rounded transition-colors">
            {isCollapsed ? <ChevronRight size={14} className="text-indigo-500 dark:text-indigo-400" /> : <ChevronDown size={14} className="text-slate-400 dark:text-slate-500" />}
          </button>
          <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-tight">Elemento {index + 1}: {type === 'dipole' ? 'Hilo' : type}</span>
        </div>
        
        <div className="flex items-center gap-1">
          <button onClick={() => {openModal("transform", element.id); setBlockDrag(true);}} className="p-1 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors tooltip" title="Ajustar orientación">
            <Move size={14} />
          </button>
          
          <button 
            onClick={() => {openModal("physics", element.id); setBlockDrag(true);}} 
            className="p-1 text-slate-400 dark:text-slate-500 hover:text-amber-500 dark:hover:text-amber-400 transition-colors tooltip" 
            title="Propiedades físicas"
          >
            <Zap size={14} />
          </button>

          <button onClick={() => removeElement(element.id)} className="p-1 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="p-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Selector Global de Tipo */}
          <div className="relative">
            <select 
              value={type}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="w-full text-xs p-2 bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-200 border-none rounded appearance-none cursor-pointer focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
            >
              <option value="dipole">Hilo (Segmento)</option>
              <option value="yagi">Yagi-Uda</option>
              <option value="helical">Helicoidal</option>
              <option value="parabola">Parábola (Malla)</option>
              <option value="free">Forma Libre (Paramétrica)</option>
              <option value="manual">Modo Manual</option>
            </select>
            <ChevronDown size={12} className="absolute right-2 top-2.5 text-slate-500 dark:text-slate-400 pointer-events-none" />
          </div>

          <div className="space-y-3">
            {/* --- DIPOLO --- */}
            {type === 'dipole' && (
              <div className="grid grid-cols-2 gap-2">
                <InputSmall label="Inicio (x,y,z)" placeholder="0,0,-1" value={params.p1} onChange={(v) => handleChange('p1', v)} />
                <InputSmall label="Fin (x,y,z)" placeholder="0,0,1" value={params.p2} onChange={(v) => handleChange('p2', v)} />
                <div className="col-span-2">
                  <InputSmall label="Radio de Cable (m)" type="number" value={params.radius} onChange={(v) => handleChange('radius', v)} />
                </div>
              </div>
            )}
            
            {/* --- MANUAL --- */}
            {type === 'manual' && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button 
                  onClick={() => { openModal("table", element.id); setBlockDrag(true); }}
                  className="flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-950 hover:bg-slate-900 text-slate-200 hover:text-white border border-slate-800 dark:border-slate-700 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 shadow-sm active:scale-[0.98] group" 
                >
                  <span className="text-blue-400 group-hover:scale-110 transition-transform">📊</span>
                  Editar Tabla
                </button>
                
                <button 
                  onClick={() => { openModal("orthogonal", element.id); setBlockDrag(true); }}
                  className="flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-950 hover:bg-slate-900 text-slate-200 hover:text-white border border-slate-800 dark:border-slate-700 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 shadow-sm active:scale-[0.98] group" 
                >
                  <span className="text-emerald-400 group-hover:rotate-12 transition-transform">✏️</span>
                  Dibujar en 2D
                </button>
              </div>
            )}

            {/* --- HELICOIDAL --- */}
            {type === 'helical' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <InputSmall 
                    label="N° de Vueltas" 
                    type="number" 
                    value={params.turns || 5} 
                    onChange={(v) => handleChange('turns', parseInt(v) || 1)} 
                  />
                  <InputSmall 
                    label="Espaciado (S)" 
                    placeholder="0.25λ" 
                    value={params.spacing || 0.2} 
                    onChange={(v) => handleChange('spacing', v)} 
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <InputSmall 
                    label="Radio Hélice" 
                    placeholder="0.1" 
                    value={params.radius_h || 0.15} 
                    onChange={(v) => handleChange('radius_h', v)} 
                  />
                  <InputSmall 
                    label="Radio Hilo" 
                    placeholder="0.002" 
                    value={params.radius || 0.0025} 
                    onChange={(v) => handleChange('radius', v)} 
                  />
                </div>
                
                <div className="p-2 bg-slate-50 dark:bg-slate-950 rounded-md border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Incluir Reflector</label>
                    <input 
                      type="checkbox" 
                      checked={params.hasReflector || false} 
                      onChange={(e) => handleChange('hasReflector', e.target.checked)}
                      className="w-3 h-3 accent-indigo-600 dark:accent-indigo-400"
                    />
                  </div>
        
                  {params.hasReflector && (
                    <div className="grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-1">
                      <InputSmall 
                        label="Radio Reflector" 
                        placeholder="0.5" 
                        value={params.reflectorR || 0.5} 
                        onChange={(v) => handleChange('reflectorR', v)} 
                      />
                      <div className="flex flex-col justify-center">
                        <span className="text-[8px] text-slate-400 dark:text-slate-500 italic leading-tight">
                          * Se ubica en el inicio (Z=0) de la hélice.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="p-2 bg-amber-50/50 dark:bg-amber-950/20 rounded-md border border-amber-100 dark:border-amber-900/30">
                  <p className="text-[8px] text-amber-600 dark:text-amber-400 font-medium leading-tight">
                    Nota: La hélice se generará a lo largo del eje Y por defecto. Usa el panel de Orientación para rotarla.
                  </p>
                </div>
              </div>
            )}

            {/* --- YAGI --- */}
            {type === 'yagi' && (() => {
              const elementsData = params.elementsData || {};
              const activeKey = params.activeElem || 'ref';
              const spacing = parseFloat(params.spacing) || 0.2;
              
              if (!elementsData.ref) {
                elementsData.ref = { posA: '-0.550,0.000,0', posB: '0.550,0.000,0' };
              }
              if (!elementsData.drv) {
                const drvX = spacing.toFixed(3);
                elementsData.drv = { posA: `-0.500,${drvX},0`, posB: `0.500,${drvX},0` };
              }

              const currentData = elementsData[activeKey] || { posA: '0,0,0', posB: '0,0,0' };

              const handleYagiParamChange = (key, field, value) => {
                const newElementsData = {
                  ...elementsData,
                  [key]: {
                    ...(elementsData[key] || { posA: '0,0,0', posB: '0,0,0' }),
                    [field]: value
                  }
                };
                handleChange('elementsData', newElementsData);
              };

              const handleNumDirChange = (val) => {
                const num = parseInt(val) || 0;
                const currentSpacing = parseFloat(params.spacing) || 0.2;
                let updatedData = { ...elementsData };

                if (!updatedData.ref) updatedData.ref = { posA: '-0.550,0.000,0', posB: '0.550,0.000,0' };
                if (!updatedData.drv) {
                  const drvY = currentSpacing.toFixed(3);
                  updatedData.drv = { posA: `-0.500,${drvY},0`, posB: `0.500,${drvY},0` };
                }

                for (let i = 1; i <= num; i++) {
                  const key = `dir${i}`;
                  if (!updatedData[key]) {
                    const yPos = (currentSpacing * (i + 1)).toFixed(3);
                    updatedData[key] = { posA: `-0.450,${yPos},0`, posB: `0.450,${yPos},0` };
                  }
                }
        
                updateElement(element.id, { 
                  params: { ...params, numDir: num, elementsData: updatedData } 
                });
              };

              return (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <InputSmall 
                      label="N° Directores" 
                      type="number" 
                      value={params.numDir || 0} 
                      onChange={handleNumDirChange} 
                    />
                    <InputSmall 
                      label="Espaciado (λ)" 
                      placeholder="0.2" 
                      value={params.spacing || 0.2} 
                      onChange={(v) => {
                        const newSpacing = parseFloat(v) || 0.2;
                        let updatedData = { ...elementsData };
                        
                        updatedData.ref = { ...updatedData.ref, posA: `0.000,-0.550,0`, posB: `0.000,0.550,0` };
                        updatedData.drv = { ...updatedData.drv, posA: `${newSpacing.toFixed(3)},-0.500,0`, posB: `${newSpacing.toFixed(3)},0.500,0` };
                        
                        const numDir = params.numDir || 0;
                        for (let i = 1; i <= numDir; i++) {
                          const xPos = (newSpacing * (i + 1)).toFixed(3);
                          updatedData[`dir${i}`] = { posA: `${xPos},-0.450,0`, posB: `${xPos},0.450,0` };
                        }
                        
                        updateElement(element.id, {
                          params: { ...params, spacing: v, elementsData: updatedData }
                        });
                      }} 
                    />
                  </div>

                  <div className="p-2 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-md border border-indigo-100 dark:border-indigo-900/40">
                    <label className="text-[9px] font-bold text-indigo-500 dark:text-indigo-400 uppercase mb-1 block">
                      Configurar Sub-Elemento:
                    </label>
        
                    <select 
                      className="w-full text-[10px] p-1 border border-slate-200 dark:border-slate-800 rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 mb-2 font-medium focus:ring-1 focus:ring-indigo-400"
                      value={activeKey}
                      onChange={(e) => handleChange('activeElem', e.target.value)}
                    >
                      <option value="ref">Reflector (X: 0.0)</option>
                      <option value="drv">Excitado / Driven (X: {parseFloat(params.spacing || 0.2).toFixed(3)})</option>
                      {[...Array(params.numDir || 0)].map((_, i) => {
                        const xOffset = (parseFloat(params.spacing || 0.2) * (i + 2)).toFixed(3);
                        return (
                          <option key={i} value={`dir${i+1}`}>Director {i+1} (X: {xOffset})</option>
                        );
                      })}
                    </select>

                    <div className="grid grid-cols-2 gap-2">
                      <InputSmall 
                        label="Extremo A (x,y,z)" 
                        value={currentData.posA} 
                        onChange={(v) => handleYagiParamChange(activeKey, 'posA', v)} 
                      />
                      <InputSmall 
                        label="Extremo B (x,y,z)" 
                        value={currentData.posB} 
                        onChange={(v) => handleYagiParamChange(activeKey, 'posB', v)} 
                      />
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* --- PARÁBOLA --- */}
            {type === 'parabola' && (
              <>
                {params.radius === undefined && handleChange('radius', 0.001)}
                <div className="grid grid-cols-2 gap-2">
                  <InputSmall label="Diámetro (m)" value={params.diam} onChange={(v) => handleChange('diam', v)} />
                  <InputSmall label="Radio f/D" value={params.fd} onChange={(v) => handleChange('fd', v)} />
                  <InputSmall label="Divisiones A" type="number" value={params.divA} onChange={(v) => handleChange('divA', v)} />
                  <InputSmall label="Divisiones B" type="number" value={params.divB} onChange={(v) => handleChange('divB', v)} />
                </div>
              </>
            )}

            {/* --- FORMA LIBRE (PARAMÉTRICA) --- */}
            {type === 'free' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                  <select 
                    className="text-[10px] p-1 border border-slate-200 dark:border-slate-800 rounded bg-white dark:bg-slate-950 text-emerald-600 dark:text-emerald-400 font-mono font-bold focus:ring-1 focus:ring-emerald-500"
                    value={params.mode || 'line'}
                    onChange={(e) => handleChange('mode', e.target.value)}
                  >
                    <option value="line">Línea (u)</option>
                    <option value="surf">Superficie (u,v)</option>
                  </select>
                  <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500">
                    Variable{params.mode === 'surf' ? 's: u, v' : ': u'}
                  </span>
                </div>

                {/* --- VISOR ÚNICO SUPERIOR COMPACTO --- */}
                <div className="min-h-[34px] flex items-center px-3 py-1 rounded-md border text-[10px] transition-all bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 shadow-inner">
                  {errors[activeField] ? (
                    <span className="text-red-500 dark:text-red-400 font-medium leading-tight">
                      ⚠️ {activeField.split('_')[1].toUpperCase()}: {errors[activeField].replace('Error de sintaxis matemática en las ecuaciones del cuerpo libre:', '')}
                    </span>
                  ) : latexViews[activeField] ? (
                    <div className="text-slate-600 dark:text-slate-300 w-full flex items-center gap-1.5 overflow-x-auto scroller-mini">
                      <span className="text-[9px] text-indigo-500 dark:text-indigo-400 font-sans font-bold uppercase">
                        {activeField.split('_')[1]}
                        {params.mode === 'surf' ? '(u,v)' : '(u)'} =
                      </span>
                      <div className="scale-95 origin-left">
                        <MathRenderer math={latexViews[activeField]} block={false} />
                      </div>
                    </div>
                  ) : (
                    <span className="text-slate-400 dark:text-slate-600 italic text-[9px]">
                      Previsualizar Ecuación {activeField.split('_')[1].toUpperCase()} 
                    </span>
                  )}
                </div>

                {/* Campos de Entrada de Ecuaciones */}
                <div className="grid grid-cols-3 gap-2">
                  {['Expr_x', 'Expr_y', 'Expr_z'].map((field) => {
                    const axis = field.split('_')[1].toUpperCase();
                    const labelSuffix = params.mode === 'surf' ? '(u,v)' : '(u)';
                    
                    return (
                      <InputSmall 
                        key={field}
                        label={`${axis.toLowerCase()}${labelSuffix}`} 
                        value={params[field]} 
                        placeholder={axis === 'X' ? 'cos(u)' : axis === 'Y' ? 'sin(u)' : '0'}
                        onChange={(v) => handleChange(field, v)}
                        onFocus={() => setActiveField(field)} // Captura el foco actual
                      />
                    );
                  })}
                </div>

                {/* Límites e Intervalos de Evaluación */}
                <div className="grid grid-cols-3 gap-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <InputSmall label="u Inicial" value={params.uStart} onChange={(v) => handleChange('uStart', v)} />
                  <InputSmall label="u Final" value={params.uEnd} onChange={(v) => handleChange('uEnd', v)} />
                  <InputSmall label="u Divs" value={params.uDiv} onChange={(v) => handleChange('uDiv', v)} />
                </div>

                {params.mode === 'surf' && (
                  <div className="grid grid-cols-3 gap-1 animate-in fade-in duration-200">
                    <InputSmall label="v Inicial" value={params.vStart} onChange={(v) => handleChange('vStart', v)} />
                    <InputSmall label="v Final" value={params.vEnd} onChange={(v) => handleChange('vEnd', v)} />
                    <InputSmall label="v Divs" value={params.vDiv} onChange={(v) => handleChange('vDiv', v)} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const InputSmall = ({ label, value, onChange, onFocus, placeholder, type = "text" }) => (
  <div className="flex flex-col">
    <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tight mb-0.5 ml-0.5">
      {label}
    </label>
    <input 
      type={type}
      value={value || ''} 
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onFocus={onFocus} // Propaga el foco al componente padre
      className="w-full text-[10px] py-1 px-2 border border-slate-200 dark:border-slate-800 rounded 
                 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 
                 focus:outline-none focus:ring-1 focus:ring-indigo-400 dark:focus:ring-indigo-500 focus:border-indigo-400 dark:focus:border-indigo-500 
                 placeholder:text-slate-300 dark:placeholder:text-slate-700 transition-all shadow-sm"
    />
  </div>
);

export default ElementBox;