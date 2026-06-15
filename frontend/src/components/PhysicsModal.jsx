import React from 'react';
import { Zap, Shield, X } from 'lucide-react';

/**
 * @constant MATERIALS
 * @description Diccionario de materiales preconfigurados con sus conductividades sigma en [S/m].
 * Un valor de conductividad nulo (null) mapea directamente a un Conductor Eléctrico Perfecto (PEC).
 */
const MATERIALS = {
  PEC: { name: "Conductor Perfecto (Ideal)", cond: null },
  COPPER: { name: "Cobre", cond: 5.8e7 },
  GOLD: { name: "Oro", cond: 4.1e7 },
  ALUMINUM: { name: "Aluminio", cond: 3.5e7 },
  STEEL: { name: "Acero Inoxidable", cond: 1.4e6 },
  ZINC: { name: "Zinc", cond: 1.6e7 },
  BRASS: { name: "Latón", cond: 1.5e7 },
  BRONZE: { name: "Bronce", cond: 1.0e7 },
  IRON: { name: "Hierro", cond: 1.0e7 },
  TIN: { name: "Estaño", cond: 9.1e6 },
  STEEL_GALVANIZED: { name: "Acero Galvanizado", cond: 6.0e6 },
  LEAD: { name: "Plomo", cond: 4.8e6 },
  TITANIUM: { name: "Titanio", cond: 2.3e6 },
  GRAPHITE: { name: "Grafito", cond: 1.0e5 }
}; 

/**
 * @component PhysicsModal
 * @description Modal flotante para la inyección de propiedades electromagnéticas de hilos y conductores.
 * Integra un canal aislado de eventos de teclado para neutralizar colisiones con gestores de arrastre (Dnd-Kit).
 */
const PhysicsModal = ({ isOpen, onClose, params, onUpdate }) => {
  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onClose();
  };

  /**
   * @function handleKeyDown
   * @description Intercepta el flujo del teclado en el árbol DOM del modal.
   * Evita la propagación de eventos que activen listeners globales de ordenamiento por arrastre (ej: barra espaciadora en dnd-kit).
   */
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') return; 
    e.stopPropagation();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
      onKeyDown={handleKeyDown}
      onClick={(e) => e.stopPropagation()} 
    >
      <form 
        onSubmit={handleSubmit}
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-80 overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="bg-slate-50 dark:bg-slate-950 p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-amber-500 fill-amber-500" />
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Propiedades Físicas</h3>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-6">
          {/* Radio de los Hilos */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase ml-1">Radio de los Hilos (mm)</label>
            <input 
              type="number"
              value={1000 * params.radius || 1.0}
              onChange={(e) => onUpdate('radius', parseFloat(e.target.value) / 1000)}
              className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm"
              step="0.1"
            />
          </div>

          {/* Material del Conductor */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase ml-1">Material del Conductor</label>
            <select 
              value={params.materialType || 'PEC'}
              onChange={(e) => onUpdate('materialType', e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500 dark:focus:ring-indigo-400 transition-all cursor-pointer shadow-sm"
            >
              {Object.entries(MATERIALS).map(([id, mat]) => (
                <option key={id} value={id} className="dark:bg-slate-950">{mat.name}</option>
              ))}
            </select>
          </div>

          {/* Sección de Aislamiento Dielectrónico */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div className="relative inline-flex items-center">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={params.hasInsulation || false}
                    onChange={(e) => onUpdate('hasInsulation', e.target.checked)}
                  />
                  <div className="w-9 h-5 bg-slate-200 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 dark:after:border-slate-600 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 dark:peer-checked:bg-indigo-500"></div>
                </div>
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">Aislamiento</span>
              </label>
              <Shield size={16} className={params.hasInsulation ? "text-indigo-500 dark:text-indigo-400" : "text-slate-300 dark:text-slate-700"} />
            </div>

            {params.hasInsulation && (
              <div className="grid grid-cols-2 gap-3 animate-in slide-in-from-top-2 duration-150">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase ml-1">Grosor (mm)</label>
                  <input 
                    type="number"
                    value={params.insulationThickness || 1.0}
                    onChange={(e) => onUpdate('insulationThickness', parseFloat(e.target.value))}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    step="0.1"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase ml-1">Epsilon (εr)</label>
                  <input 
                    type="number"
                    value={params.epsilonR || 2.1}
                    onChange={(e) => onUpdate('epsilonR', parseFloat(e.target.value))}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    step="0.1"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 p-3 space-y-2.5">
          <p className="text-[9px] text-slate-500 dark:text-slate-500 leading-relaxed italic px-1">
            * Estos valores afectan la eficiencia radiante y la velocidad de propagación en los hilos de este elemento.
          </p>
          <button
            type="submit"
            className="w-full bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 text-white text-xs font-bold py-2 rounded-xl transition-all shadow-md active:scale-[0.98]"
          >
            Aceptar
          </button>
        </div>
      </form>
    </div>
  );
};

export default PhysicsModal;