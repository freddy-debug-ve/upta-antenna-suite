import React from 'react';
import { Trash2 } from 'lucide-react';

const SourceBox = ({ 
  source, 
  index, 
  onUpdate, 
  onRemove, 
  wires = [], 
  availableTags = [], // Lista con los tags finales de cada elemento (ej: [1, 4, 15])
  setSelectedSourceTag 
}) => {
  
  const update = (field, value) => onUpdate(source.id, { ...source, [field]: value });

  const currentTag = parseInt(source.wireIndex, 10);
  const currentWire = wires.find(w => w.tag === currentTag);
  const maxSegments = currentWire ? currentWire.segments : 1;

  const handleWireChange = (newTagValue) => {
    const newTagInt = parseInt(newTagValue, 10) || "";
    
    const targetWire = wires.find(w => w.tag === newTagInt);
    const targetMax = targetWire ? targetWire.segments : 1;
    const validatedSegment = source.segment > targetMax ? targetMax : source.segment;

    onUpdate(source.id, { 
      ...source, 
      wireIndex: newTagInt,
      segment: validatedSegment 
    });
    
    setSelectedSourceTag(newTagInt);
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-2 mb-2 relative group transition-colors">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[9px] font-black text-indigo-500 dark:text-indigo-400 uppercase italic">Fuente #{index + 1}</span>
        <button 
          onClick={() => onRemove(source.id)} 
          className="text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
        >
          <Trash2 size={12} />
        </button>
      </div>
      
      <div className="grid grid-cols-2 gap-x-2 gap-y-1">
        <div className="col-span-1">
          <label className="text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase">Ubicación (Hilo:Seg)</label>
          <div className="flex gap-1">
            <input 
              type="number" 
              value={source.wireIndex} 
              onChange={(e) => handleWireChange(e.target.value)} 
              className="w-full text-[10px] p-1 border border-slate-200 dark:border-slate-800 rounded bg-slate-100/50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-400" 
              placeholder="Hilo" 
            />
            <input 
              type="number" 
              min="1"
              max={maxSegments}
              value={source.segment} 
              onChange={(e) => {
                let val = parseInt(e.target.value, 10) || 1;
                if (val > maxSegments) val = maxSegments;
                if (val < 1) val = 1;
                update('segment', val);
              }} 
              className="w-full text-[10px] p-1 border border-slate-200 dark:border-slate-800 rounded bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-400" 
              placeholder="Seg" 
            />
          </div>
        </div>

        {/* Selector con separadores automáticos */}
        <div className="col-span-1 flex flex-col justify-end">
          <select 
            value={source.wireIndex || ""} 
            onChange={(e) => handleWireChange(e.target.value)}
            onFocus={() => setSelectedSourceTag(source.wireIndex)}
            className="text-[10px] p-1 border border-slate-200 dark:border-slate-800 rounded bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 w-full h-[26px] font-medium focus:outline-none focus:ring-1 focus:ring-indigo-400"
          >
            <option value="" className="dark:bg-slate-950">Seleccionar Tag</option>
            
            {wires.map((w, idx) => {
              // Verificamos si este hilo específico coincide con un cierre de elemento
              const isElementEnd = availableTags.includes(w.tag);

              return (
                <React.Fragment key={w.tag}>
                  <option value={w.tag} className="dark:bg-slate-950">
                    Hilo {w.tag} ({w.segments} segs)
                  </option>
                  
                  {/* Si es el último hilo de un elemento, metemos un separador visual limpio */}
                  {isElementEnd && idx !== wires.length - 1 && (
                    <option disabled className="text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-900 text-center text-[9px] tracking-widest">
                      ─────── Fin de Elemento ───────
                    </option>
                  )}
                </React.Fragment>
              );
            })}
          </select>
        </div>

        <div className="col-span-1">
          <label className="text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase">Amplitud (V/A)</label>
          <input 
            type="number" 
            value={source.amplitude} 
            onChange={(e) => update('amplitude', parseFloat(e.target.value) || 0)} 
            className="w-full text-[10px] p-1 border border-slate-200 dark:border-slate-800 rounded bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-400" 
          />
        </div>

        <div className="col-span-1">
          <label className="text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase">Fase (Deg)</label>
          <input 
            type="number" 
            value={source.phase} 
            onChange={(e) => update('phase', parseFloat(e.target.value) || 0)} 
            className="w-full text-[10px] p-1 border border-slate-200 dark:border-slate-800 rounded bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-400" 
          />
        </div>
      </div>
    </div>
  );
};

export default SourceBox;