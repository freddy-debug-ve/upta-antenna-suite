import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Viewer from './components/Viewer';

// Importamos los modales directamente en App.jsx
import TransformModal from './components/TransformModal';
import PhysicsModal from './components/PhysicsModal';
import CoordinateTable from './components/CoordinateTable';
import OrthogonalEditor from './components/OrthogonalEditor';
import { SatelliteDish, X } from 'lucide-react';

function App() {
  const [elements, setElements] = useState([]);
  const [sources, setSources] = useState([{ id: 'src-1', type: 'Voltaje', wireIndex: 1, segment: 2, amplitude: 1.0, phase: 0 }]);
  const [isMaximized, setIsMaximized] = useState(false);
  const [availableTags, setAvailableTags] = useState([]);
  const [infoTab, setInfoTab] = useState('intro');
  
  const [isSimulating, setIsSimulating] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [LoadingSWR, setLoadingSWR] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const [antennaData, setAntennaData] = useState([]);
  const [selectedSourceTag, setSelectedSourceTag] = useState(null);

  const [patternData, setPatternData] = useState(null);
  const [patterns_2d, setPatterns_2d] = useState(null);

  const [freq, setFrequency] = useState(72);
  const [freqMode, setFreqMode] = useState('single');
  const [freqStart, setFreqStart] = useState(65);
  const [freqSteps, setFreqSteps] = useState(2);
  const [freqEnd, setFreqEnd] = useState(75);
  
  const [results, setResults] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [geometryOk, setGeometryOk] = useState(false);
  
  const [activeElementId, setActiveElementId] = useState(null); // ID del elemento editándose
  const [activeModal, setActiveModal] = useState(null);
  const [blockDrag, setBlockDrag] = useState(false);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark') || 
             localStorage.getItem('theme') === 'dark';
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const openModalId = (modalType, elementId) => {
    setBlockDrag(true);
    setActiveElementId(elementId);
    setActiveModal(modalType);
  };

  const closeModalGlobal = () => {
    setActiveModal(null);
    setActiveElementId(null);
    setBlockDrag(false);
  };

  const currentEditingElement = elements.find(el => el.id === activeElementId);
  const currentParams = currentEditingElement?.params || {};

  const handleModalParamChange = (field, value) => {
    if (!activeElementId) return;
    const updatedParams = { ...currentParams, [field]: value };
    updateElement(activeElementId, { params: updatedParams });
  };


  useEffect(() => {
    if (results) {
      setIsDirty(true);
    }
  }, [elements, sources]);

  const addElement = () => {
    const newId = `el-${Date.now()}`;
    const newElement = {
      id: newId,
      type: 'dipole',
      params: { p1: '0,0,-1', p2: '0,0,1', radius: '0.001' },
      isCollapsed: false
    };
    setElements([...elements, newElement]);
  };

  const removeElement = (id) => {
    setElements(elements.filter(el => el.id !== id));
  };

  const updateElement = (id, data) => {
    setElements(elements.map(el => el.id === id ? { ...el, ...data } : el));
  };

  const addSource = () => {
    const newSrc = { 
      id: `src-${Date.now()}`, 
      type: 'Voltaje', 
      wireIndex: 1, 
      segment: 1, 
      amplitude: 1.0, 
      phase: 0 
    };
    setSources([...sources, newSrc]);
  };

  const handleCalculateSWR = async () => {
    setLoadingSWR(true);
    const frequencyConfig = {
      mode: freqMode,
      value: parseFloat(freq),
      start: parseFloat(freqStart),
      end: parseFloat(freqEnd),
      steps: parseInt(freqSteps)
    };

    const payload = {
      frequency: frequencyConfig, 
      elements: elements,
      sources: sources
    };

    try {
      const response = await fetch('/api/calculate-network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (response.ok && data.status === "success"){
        setResults(data.networkData);
      }
    } catch (error) {
      console.error("Error al calcular red:", error);
    } finally {
      setLoadingSWR(false);
    }
  };

  const runSimulation = async (type = 'geometry') => {
    if (type === 'geometry') setIsBuilding(true);
    if (type === 'pattern') {
      setIsSimulating(true); 
      setLoadingSWR(true);
    }

    const frequencyConfig = {
      mode: freqMode,
      value: parseFloat(freq),
      start: parseFloat(freqStart),
      end: parseFloat(freqEnd),
      steps: parseInt(freqSteps)
    };

    const payload = {
      frequency: frequencyConfig, 
      elements: elements,
      sources: sources
    };

    try {
      const response = await fetch(`/api/simulate/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok && data.status === "success") {
        if (type === 'pattern') {
          setPatternData(data.patterns);
          setResults(data.networkData);
          setPatterns_2d(data.patterns_2d);
          setGeometryOk(false);
        }
        if (type === 'geometry') {
          setGeometryOk(true);
          setAvailableTags(data.tags);
          setAntennaData(data.wires);
          setIsDirty(false);
        }
      } else {
        alert("Error en el motor NEC: " + data.detail);
      }
    } catch (error) {
      alert("Error de conexión con el Backend");
    } finally {
      setIsBuilding(false);
      setIsSimulating(false);
      setLoadingSWR(false);
    }
  };

  const saveSimulation = () => {
    const projectData = {
      metadata: {
        name: "Proyecto Antena UPTA",
        date: new Date().toISOString(),
      },
      isDirty,
      frequencyConfig: { freq, freqMode, freqStart, freqEnd, freqSteps },
      elements,
      sources,
      results,
      patternData,
      patterns_2d,
      availableTags,
      antennaData,
      selectedSourceTag,
      geometryOk,
    };

    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Antena_${freqMode === 'single' ? freq : 'Sweep'}_MHz.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const loadSimulation = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        
        if (data.frequencyConfig) {
          setFrequency(data.frequencyConfig.freq);
          setFreqMode(data.frequencyConfig.freqMode);
          setFreqStart(data.frequencyConfig.freqStart);
          setFreqEnd(data.frequencyConfig.freqEnd);
          setFreqSteps(data.frequencyConfig.freqSteps);
        }
        
        if (data.elements) setElements(data.elements);
        if (data.sources) setSources(data.sources);
        if (data.results) setResults(data.results);
        if (data.patternData) setPatternData(data.patternData);
        if (data.patterns_2d) setPatterns_2d(data.patterns_2d);
        if (data.availableTags) setAvailableTags(data.availableTags); // Corregido typo 'avaibleTags'
        if (data.antennaData) setAntennaData(data.antennaData);
        if (data.selectedSourceTag) setSelectedSourceTag(data.selectedSourceTag);
        if (data.geometryOk) setGeometryOk(data.geometryOk);
        if (data.isDirty !== undefined) setIsDirty(data.isDirty);
        
        alert("Diseño cargado. Recuerda 'Construir Geometría' para visualizar.");
      } catch (err) {
        console.error("Error en carga:", err);
        alert("El archivo no es un proyecto válido para este aplicativo.");
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 dark:bg-slate-950 overflow-hidden text-slate-800 dark:text-slate-100 transition-colors duration-200">
      
      {!isMaximized && (
        <Sidebar 
          elements={elements}
          sources={sources}
          setElements={setElements}
          setSources={setSources}
          loadSimulation={loadSimulation}
          saveSimulation={saveSimulation}
          addElement={addElement}
          geometryOk={geometryOk}
          addSource={addSource}
          removeElement={removeElement}
          updateElement={updateElement}
          onSimulate={runSimulation}
          frequency={freq} 
          setFrequency={setFrequency}
          freqMode={freqMode}
          setFreqMode={setFreqMode}
          freqStart={freqStart}
          setFreqStart={setFreqStart}
          freqSteps={freqSteps}
          setFreqSteps={setFreqSteps}
          freqEnd={freqEnd}
          setFreqEnd={setFreqEnd}
          availableTags={availableTags}
          wires={antennaData}
          setSelectedSourceTag={setSelectedSourceTag}
          isDirty={isDirty}
          setIsMaximized={setIsMaximized}
          isMaximized={isMaximized}
          setShowInfo={setShowInfo}
          openModal={openModalId}
          blockDrag={blockDrag}
          setBlockDrag={setBlockDrag}
		  isDarkMode={isDarkMode}
		  setIsDarkMode={setIsDarkMode}
        />
      )}

      <Viewer 
        isSimulating={isSimulating}
        isBuilding={isBuilding}
        networkData={results}
        wires={antennaData}
        SelectedSourceTag={selectedSourceTag}
        allSources={sources}
        patternData={patternData}
        handleCalculateSWR={handleCalculateSWR}
        loadingSWR={LoadingSWR}
        isDirty={isDirty}
        setIsDirty={setIsDirty}
        patterns_2d={patterns_2d}
        setIsMaximized={setIsMaximized}
        isMaximized={isMaximized}
		isDarkMode={isDarkMode}
      />
      
      <TransformModal 
        isOpen={activeModal === 'transform'} 
        onClose={closeModalGlobal}
        params={currentParams}
        onUpdate={handleModalParamChange}
      />

      <PhysicsModal 
        isOpen={activeModal === 'physics'} 
        onClose={closeModalGlobal}
        params={currentParams}
        onUpdate={handleModalParamChange}
      />

      <CoordinateTable
        isOpen={activeModal === 'table'} 
        onClose={closeModalGlobal}
        initialData={currentParams.table || [{"0" : {"x1":0,"y1":0,"z1":1,"x2":0,"y2":0,"z2":-1,"radius": 0.001}}]}
        onSave={(value) => handleModalParamChange("table", value)}
      />

      <OrthogonalEditor 
        isOpen={activeModal === 'orthogonal'}
        onClose={closeModalGlobal}
        wires={currentParams.table || []}
        onSave={(updatedWires) => {
          handleModalParamChange('table', updatedWires);
          closeModalGlobal();
        }}
        setBlockDrag={setBlockDrag}
      />

      {/* Modal Informativo */}
      {showInfo && (
		  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
			<div className="bg-white dark:bg-slate-900 w-full max-w-4xl h-[85vh] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
			  
			  {/* Header del Modal */}
			  <div className="bg-slate-50 dark:bg-slate-950 p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
				<div className="flex items-center gap-2.5">
				  <SatelliteDish className="text-indigo-600 dark:text-indigo-400 animate-pulse" size={20} />
				  <div>
					<h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
					  Guía de Operación e Ingeniería de Software
					</h3>
					<p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
					  Flujo de trabajo para el motor de cálculo PyMininec
					</p>
				  </div>
				</div>
				<button 
				  onClick={() => setShowInfo(false)}
				  className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full transition-colors"
				>
				  <X size={16} />
				</button>
			  </div>

			  {/* Cuerpo Modular Interactivo */}
			  <div className="flex-1 flex overflow-hidden">
				
				{/* Pestañas de Navegación Lateral */}
				<div className="w-48 bg-slate-50/50 dark:bg-slate-950/20 border-r border-slate-100 dark:border-slate-850 p-2 flex flex-col gap-1 shrink-0">
				  {[
					{ id: 'intro', label: '1. Introducción' },
					{ id: 'geometry', label: '2. Geometría (Estructura)' },
					{ id: 'sources', label: '3. Fuentes de Excitación' },
					{ id: 'simulation', label: '4. Ejecución y Motor' },
					{ id: 'results', label: '5. Análisis de Gráficos' }
				  ].map((tab) => (
					<button
					  key={tab.id}
					  onClick={() => setInfoTab(tab.id)} // Necesitas inicializar const [infoTab, setInfoTab] = useState('intro') arriba en App()
					  className={`w-full text-left px-3 py-2.5 rounded-xl text-[11px] font-bold tracking-wide transition-all ${
						(infoTab || 'intro') === tab.id
						  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/10 dark:shadow-none'
						  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
					  }`}
					>
					  {tab.label}
					</button>
				  ))}
				</div>

				<div className="flex-1 p-6 overflow-y-auto bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 space-y-4 text-xs">
				  
				  {/* TAB 1: INTRODUCCIÓN */}
				  {(!infoTab || infoTab === 'intro') && (
					<div className="animate-in fade-in slide-in-from-left-2 duration-200 space-y-3">
					  <h4 className="text-sm font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-tight">RF Designer UPT Aragua</h4>
					  <p className="leading-relaxed text-slate-600 dark:text-slate-400">
						Este entorno académico digital permite el modelado radiante, análisis de acoplamiento de impedancias y optimización de antenas mediante la resolución matricial de momentos electromagnéticos.
					  </p>
					  <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-xl">
						<span className="font-bold text-indigo-700 dark:text-indigo-400 block mb-1">💡 Flujo General Obligatorio:</span>
						<p className="text-[11px] text-slate-500 dark:text-slate-400">
						  Para obtener datos coherentes, siga rigurosamente el orden numérico de la barra de navegación lateral izquierda: configure la forma física, asigne una fuente de voltaje en un segmento real, valide la geometría y finalmente procese la ganancia.
						</p>
					  </div>
					</div>
				  )}
				  
				  {/* TAB 2: GEOMETRÍA */}
				  {infoTab === 'geometry' && (
				  <div className="animate-in fade-in slide-in-from-left-2 duration-200 space-y-3">
					<h4 className="text-sm font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-tight">
					  Sistemas de Modelado y Geometría Radiante
					</h4>
					<p className="text-slate-600 dark:text-slate-400 leading-relaxed">
					  Al presionar <span className="font-bold text-purple-600 dark:text-purple-400">+ Nuevo Elemento</span>, el software despliega <strong>6 metodologías de diseño</strong> clasificadas en tres familias operativas:
					</p>
					
					<div className="space-y-2">
					  {/* 1. Prediseñados */}
					  <div className="p-2.5 border border-slate-100 dark:border-slate-850 rounded-xl bg-slate-50/50 dark:bg-slate-950/30">
						<span className="font-black text-[10px] text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block mb-0.5">
						  📦 Plantillas Paramétricas Prediseñadas (4 Modos)
						</span>
						<p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
						  Generación geométrica automatizada para estructuras clásicas: <strong className="text-slate-700 dark:text-slate-300">Hilo Solo</strong>, arreglos directivos <strong className="text-slate-700 dark:text-slate-300">Yagi-Uda</strong>, reflectores de malla <strong className="text-slate-700 dark:text-slate-300">Parábola</strong> y bobinas irradiantes <strong className="text-slate-700 dark:text-slate-300">Helicoidales</strong> basados en dimensiones de radio, paso y turnos.
						</p>
					  </div>

					  {/* 2. Forma Libre */}
					  <div className="p-2.5 border border-slate-100 dark:border-slate-850 rounded-xl bg-slate-50/50 dark:bg-slate-950/30">
						<span className="font-black text-[10px] text-purple-600 dark:text-purple-400 uppercase tracking-wider block mb-0.5">
						  📐 Modo Forma Libre (FREE)
						</span>
						<p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
						  Diseño avanzado mediante <strong className="text-slate-700 dark:text-slate-300">expresiones paramétricas</strong>. Permite ingresar funciones matemáticas analíticas variables que el backend procesa algebraicamente con SymPy para sintetizar geometrías complejas no convencionales.
						</p>
					  </div>

					  {/* 3. Modo Manual */}
					  <div className="p-2.5 border border-slate-100 dark:border-slate-850 rounded-xl bg-slate-50/50 dark:bg-slate-950/30">
						<span className="font-black text-[10px] text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-0.5">
						  ✏️ Modo de Síntesis Manual (MANUAL)
						</span>
						<p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mb-1.5">
						  Es el único modo vinculado directamente a los entornos de edición vectorial y matricial:
						</p>
						<div className="grid grid-cols-2 gap-2 text-[10px] bg-white dark:bg-slate-950 p-2 rounded-lg border border-slate-100 dark:border-slate-900 font-medium">
						  <div>
							<strong className="text-slate-700 dark:text-slate-300 block mb-0.5">Visor Ortogonal CAD 2D:</strong>
							Establece nodos interactivos y dibuja segmentos arrastrando el puntero en los planos coordenados <span className="font-mono text-slate-400">XY, XZ, YZ</span>.
						  </div>
						  <div>
							<strong className="text-slate-700 dark:text-slate-300 block mb-0.5">Tabla de Coordenadas:</strong>
							Permite la inyección directa de matrices numéricas mediante filas <span className="font-mono text-slate-400">[X1 Y1 Z1 X2 Y2 Z2 Rad Seg]</span> copiadas desde Excel o Matlab.
						  </div>
						</div>
					  </div>
					</div>
				  </div>
				)}

				{/* TAB 3: FUENTES */}
				{infoTab === 'sources' && (
				  <div className="animate-in fade-in slide-in-from-left-2 duration-200 space-y-3">
					<h4 className="text-sm font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-tight">
					  Excitación de la Red (Fuentes)
					</h4>
					<p className="text-slate-600 dark:text-slate-400 leading-relaxed">
					  Una antena sin fuente de alimentación actúa únicamente como un reflector pasivo. En este panel debe indicarle al backend en qué punto exacto se inyectará la energía de RF (Amplitud en Voltios/Amperios y Fase en Grados).
					</p>
					
					<div className="p-3 bg-amber-50/60 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/30 rounded-xl space-y-1.5">
					  <span className="font-bold text-amber-800 dark:text-amber-400 block text-[11px]">
						⚠️ Regla Crítica de Segmentación:
					  </span>
					  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
						El campo <span className="font-mono bg-amber-100/50 dark:bg-amber-950 px-1 rounded font-bold">UBICACIÓN (HILO:SEG)</span> requiere que el segmento ingresado exista dentro de la discretización del hilo. Por ejemplo, si el Hilo 1 se configuró con 9 segmentos, colocar la fuente en el segmento 5 la ubicará en su centro geométrico.
					  </p>
					</div>

					<div className="p-3 bg-blue-50/50 dark:bg-slate-950/60 border border-blue-100 dark:border-blue-900/40 rounded-xl">
					  <span className="font-black text-[10px] text-blue-600 dark:text-blue-400 uppercase tracking-wider block mb-1">
						🛠️ Guía de Diagnóstico Técnico (Si la simulación falla):
					  </span>
					  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
						Si el motor matemático arroja un error numérico, de convergencia matricial o desborde al calcular, realice las siguientes comprobaciones de ingeniería:
					  </p>
					  <ul className="text-[10px] text-slate-500 dark:text-slate-400 list-disc list-inside mt-1.5 space-y-1 pl-1">
						<li>Modifique la <span className="font-bold text-slate-700 dark:text-slate-300">segmentación o resolución</span> de los hilos (segmentos demasiado cortos o excesivamente largos respecto a la longitud de onda alteran el cálculo).</li>
						<li>Ajuste el <span className="font-bold text-slate-700 dark:text-slate-300">radio del hilo</span> (el motor puede fallar si el radio del conductor es muy grande en comparación con la longitud física del segmento).</li>
						<li>Reubique la fuente de alimentación colocándola en <span className="font-bold text-slate-700 dark:text-slate-300">otro hilo o segmento activo</span>, asegurándose de que no coincida exactamente con un nodo de cruce de hilos en cortocircuito abierto.</li>
					  </ul>
					</div>
				  </div>
				)}

				  {/* TAB 4: SIMULACIÓN */}
				  {infoTab === 'simulation' && (
					<div className="animate-in fade-in slide-in-from-left-2 duration-200 space-y-3">
					  <h4 className="text-sm font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-tight">Procesamiento y Pasos de los Botones</h4>
					  <p className="text-slate-600 dark:text-slate-400">
						La barra lateral cuenta con dos botones de acción secuenciales vinculados al servidor ASGI:
					  </p>
					  <div className="space-y-2.5">
						<div className="flex gap-3 items-start">
						  <div className="bg-emerald-500 text-white font-black text-[10px] px-2 py-0.5 rounded-md mt-0.5 shrink-0">BOTÓN 1</div>
						  <div>
							<span className="font-bold text-slate-800 dark:text-slate-200">OBTENER GEOMETRÍA:</span>
							<p className="text-[11px] text-slate-500 dark:text-slate-400">Envía los arrays matriciales en formato JSON para compilar y validar la estructura matemática en el visor de cables. No genera cálculos de radiofrecuencia.</p>
						  </div>
						</div>
						<div className="flex gap-3 items-start">
						  <div className="bg-indigo-500 text-white font-black text-[10px] px-2 py-0.5 rounded-md mt-0.5 shrink-0">BOTÓN 2</div>
						  <div>
							<span className="font-bold text-slate-800 dark:text-slate-200">CALCULAR GANANCIA:</span>
							<p className="text-[11px] text-slate-500 dark:text-slate-400">Despierta el núcleo numérico de PyMininec. Calcula la matriz de impedancias mutuas, distribuciones de corriente inducida, ganancias directivas en dBi y ondas estacionarias.</p>
						  </div>
						</div>
					  </div>
					</div>
				  )}

				  {/* TAB 5: RESULTADOS */}
				  {infoTab === 'results' && (
					<div className="animate-in fade-in slide-in-from-left-2 duration-200 space-y-3">
					  <h4 className="text-sm font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-tight">Interpretación de Instrumentos</h4>
					  <p className="text-slate-600 dark:text-slate-400">
						Una vez completada la simulación, navegue libremente por las pestañas del panel de visualización central:
					  </p>
					  <ul className="space-y-2 text-[11px] text-slate-500 dark:text-slate-400 list-none pl-0">
						<li className="p-2 border border-slate-100 dark:border-slate-850 rounded-lg"><strong className="text-slate-700 dark:text-slate-200 block mb-0.5">🌐 Patrón de Radiación:</strong> Gráfico de burbuja tridimensional. Active la <em>Escala ARRL</em> para atenuar logarítmicamente el lóbulo principal y auditar con precisión los lóbulos traseros o espurios.</li>
						<li className="p-2 border border-slate-100 dark:border-slate-850 rounded-lg"><strong className="text-slate-700 dark:text-slate-200 block mb-0.5">📈 SWR / Impedancia:</strong> Curvas de respuesta de red. Busque que el SWR caiga por debajo de 1.5 en su frecuencia de interés, garantizando que la parte imaginaria de la impedancia (jΩ) tienda a cero.</li>
						<li className="p-2 border border-slate-100 dark:border-slate-850 rounded-lg"><strong className="text-slate-700 dark:text-slate-200 block mb-0.5">📐 Azimuth / Elevación:</strong> Cortes ortogonales bipolares en 2D. Ideales para medir los anchos de haz a mitad de potencia (-3dB) y los ángulos de elevación (tilt) para enlaces terrestres.</li>
					  </ul>
					</div>
				  )}

				</div>
			  </div>

			  {/* Footer del Modal */}
			  <div className="bg-slate-50 dark:bg-slate-950 px-6 py-3 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0">
				<button 
				  onClick={() => setShowInfo(false)}
				  className="px-5 py-2 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-95"
				>
				  Entendido
				</button>
			  </div>

			</div>
		  </div>
      )}
    </div>
  );
}

export default App;