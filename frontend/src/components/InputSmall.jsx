import React from 'react';

/**
 * @component InputSmall
 * @description Componente de entrada de datos numéricos o de texto optimizado para paneles densos.
 * Soporta decimales libres (`step="any"`) y se adapta automáticamente a entornos oscuros.
 */
const InputSmall = ({ label, value, onChange, type = "text", placeholder = "" }) => {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase ml-1 tracking-wider transition-colors">
          {label}
        </label>
      )}
      <input
        type={type}
        step="any" // Fundamental para permitir parámetros decimales de ingeniería (coordenadas, frecuencias, etc.)
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-[10px] p-1.5 border border-slate-200 rounded bg-white text-slate-600 font-medium
                   outline-none transition-all duration-150
                   focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500
                   
                   /* Variantes para Modo Oscuro */
                   dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 
                   dark:placeholder-slate-500 dark:focus:ring-indigo-400 dark:focus:border-indigo-400"
      />
    </div>
  );
};

export default InputSmall;