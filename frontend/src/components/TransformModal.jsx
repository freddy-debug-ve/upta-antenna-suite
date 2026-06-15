import React from 'react';
import { X, Move, RotateCcw } from 'lucide-react';

const TransformModal = ({ isOpen, onClose, params, onUpdate }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-80 border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in duration-200">
        
        {/* Header */}
        <div className="bg-slate-50 dark:bg-slate-950 p-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Move size={14} className="text-indigo-500 dark:text-indigo-400" /> Orientación Espacial
          </span>
          <button 
            onClick={onClose} 
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X size={16} className="text-slate-400 dark:text-slate-500" />
          </button>
        </div>

        {/* Contenido */}
        <div className="p-4 space-y-4">
          {/* Traslación */}
          <div>
            <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-2 block">
              Posición Global (x, y, z)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['x', 'y', 'z'].map((axis) => (
                <div key={axis}>
                  <span className="text-[8px] text-slate-400 dark:text-slate-500 ml-1 italic">{axis.toUpperCase()}</span>
                  <input 
                    type="number" 
                    step="any"
                    value={params[axis] || 0} 
                    onChange={(e) => onUpdate(axis, e.target.value)}
                    className="w-full text-xs p-1.5 border border-slate-200 dark:border-slate-800 rounded bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 dark:focus:border-indigo-500 transition-all shadow-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Rotación (3 Grados de Libertad) */}
          <div>
            <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-2 block flex items-center gap-1">
              <RotateCcw size={10} /> Rotación (Grados)
            </label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-[8px] text-slate-400 dark:text-slate-500 ml-1 italic">Theta (180°)</span>
                <input 
                  type="number" 
                  step="any"
                  value={params.theta || 0} 
                  onChange={(e) => onUpdate('theta', e.target.value)}
                  className="w-full text-xs p-1.5 border border-slate-200 dark:border-slate-800 rounded bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 dark:focus:border-indigo-500 transition-all shadow-sm"
                />
              </div>
              <div>
                <span className="text-[8px] text-slate-400 dark:text-slate-500 ml-1 italic">Phi (360°)</span>
                <input 
                  type="number" 
                  step="any"
                  value={params.phi || 0} 
                  onChange={(e) => onUpdate('phi', e.target.value)}
                  className="w-full text-xs p-1.5 border border-slate-200 dark:border-slate-800 rounded bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 dark:focus:border-indigo-500 transition-all shadow-sm"
                />
              </div>
              <div>
                <span className="text-[8px] text-slate-400 dark:text-slate-500 ml-1 italic">Psi / Roll</span>
                <input 
                  type="number" 
                  step="any"
                  value={params.psi || 0} 
                  onChange={(e) => onUpdate('psi', e.target.value)}
                  className="w-full text-xs p-1.5 border border-slate-200 dark:border-slate-800 rounded bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 dark:focus:border-indigo-500 transition-all shadow-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button 
            onClick={onClose}
            className="bg-indigo-600 dark:bg-indigo-500 text-white text-[10px] font-bold px-4 py-1.5 rounded hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-all shadow-md active:scale-95"
          >
            LISTO
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransformModal;