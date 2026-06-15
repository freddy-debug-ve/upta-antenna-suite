import React, { useState } from 'react';
import { X, Trash2, Plus } from 'lucide-react';

/**
 * @component CoordinateTable
 * @description Modal de edición matricial para la inyección masiva de hilos mediante coordenadas.
 * Soporta la deserialización directa de estructuras tabulares (TSV/CSV) provenientes de Excel/Matlab.
 */
const CoordinateTable = ({ isOpen, onClose, onSave, initialData = [] }) => {
  if (!isOpen) return null;
  
  const [wires, setWires] = useState(initialData);

  /**
   * @function handlePaste
   * @description Intercepta el evento del portapapeles, parseando filas y columnas mediante expresiones
   * regulares que aíslan tabuladores, comas y espacios. Sanitiza los valores a flotantes nativos.
   */
  const handlePaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text');
    const rows = pasteData.trim().split(/\r?\n/);
    
    const newWires = rows.map(row => {
      const cols = row.split(/\t|,| /).filter(c => c !== "");
      if (cols.length >= 6) {
        return {
          x1: parseFloat(cols[0]), y1: parseFloat(cols[1]), z1: parseFloat(cols[2]),
          x2: parseFloat(cols[3]), y2: parseFloat(cols[4]), z2: parseFloat(cols[5]),
          radius: cols[6] ? parseFloat(cols[6]) : 0.001
        };
      }
      return null;
    }).filter(w => w !== null);

    setWires([...wires, ...newWires]);
  };

  const updateWire = (index, field, value) => {
    const updated = [...wires];
    updated[index][field] = parseFloat(value) || 0;
    setWires(updated);
  };

  const removeWire = (index) => {
    const updated = wires.filter((_, i) => i !== index);
    setWires(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      {/* Contenedor Adaptativo de Geometría */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Editor de Coordenadas Manual
            </h3>
            <button 
              onClick={onClose} 
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X size={20} />
            </button>
          </div>

          {/* Bloque Informativo de Parseo */}
          <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 mb-4 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-indigo-500 dark:text-indigo-400 font-bold uppercase tracking-wider text-[10px] mr-1">Tip:</span> 
            Puedes copiar celdas de Excel, Matlab o archivos .NEC y pegarlas aquí directamente. El orden secuencial por fila debe ser: <code className="font-mono bg-slate-200 dark:bg-slate-800 px-1 rounded text-slate-700 dark:text-slate-300">X1, Y1, Z1, X2, Y2, Z2, Radio</code>.
          </p>
          
          {/* Contenedor Matricial */}
          <div 
            onPaste={handlePaste}
            className="max-h-[50vh] overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/40 custom-scrollbar"
          >
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 dark:bg-slate-950 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  {['X1', 'Y1', 'Z1', 'X2', 'Y2', 'Z2', 'Radio (mm)'].map((h) => (
                    <th key={h} className="p-2.5 text-center font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[9px]">
                      {h}
                    </th>
                  ))}
                  <th className="p-2.5 text-center font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[9px]">Acción</th>
                </tr>
              </thead>
              <tbody>
                {wires.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="p-12 text-center text-slate-400 dark:text-slate-600 italic text-xs">
                      Ningún segmento cargado en la matriz. Pega registros o añade uno nuevo.
                    </td>
                  </tr>
                ) : (
                  wires.map((w, i) => (
                    <tr key={i} className="border-b border-slate-100 dark:border-slate-850 hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-colors">
                      {['x1', 'y1', 'z1', 'x2', 'y2', 'z2', 'radius'].map(field => (
                        <td key={field} className="p-1">
                          <input
                            type="number"
                            step="any"
                            value={w[field]}
                            onChange={(e) => updateWire(i, field, e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-1.5 text-center text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:focus:ring-indigo-400 font-mono transition-all"
                          />
                        </td>
                      ))}
                      <td className="p-1 text-center">
                        <button
                          onClick={() => removeWire(i)}
                          className="p-2 text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-all"
                          title="Eliminar segmento"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer del Editor */}
          <div className="flex justify-between items-center mt-6">
            <button 
              onClick={() => setWires([...wires, {x1: 0, y1: 0, z1: 0, x2: 0, y2: 1, z2: 0, radius: 0.001}])}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 dark:bg-emerald-500 hover:bg-emerald-700 dark:hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-95"
            >
              <Plus size={14} /> Agregar Hilo
            </button>
            
            <div className="flex gap-2">
              <button 
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={() => { onSave(wires); onClose(); }}
                className="px-5 py-2 bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-95"
              >
                Aplicar Geometría
              </button>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default CoordinateTable;