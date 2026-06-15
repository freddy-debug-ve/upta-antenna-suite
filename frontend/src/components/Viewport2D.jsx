import React, { useRef, useState } from 'react';
import { getWorldCoords, snapToGrid } from './util';

/**
 * @component Viewport2D
 * @description Lienzo SVG bidimensional interactivo para la proyección ortogonal y manipulación de hilos.
 * Implementa Pointer Capture para garantizar el rastreo ininterrumpido de vectores en pantallas táctiles.
 */
const Viewport2D = ({ plane, wires, activeTool, scale, gridSize, planePosition, onUpdateWires }) => {
  const svgRef = useRef();
  const [drawingLine, setDrawingLine] = useState(null);
  const [draggingNode, setDraggingNode] = useState(null); // { wireIndex: int, nodeNum: 1|2 }
  
  const width = 400;
  const height = 400;

  // Proyección de espacio euclidiano 3D (metros) a coordenadas del lienzo SVG (píxeles)
  const project = (x, y, z) => {
    let h, v;
    if (plane.id === 'xy') { h = x; v = y; }
    if (plane.id === 'xz') { h = x; v = z; }
    if (plane.id === 'yz') { h = y; v = z; }
    return {
      cx: width / 2 + (h * scale),
      cy: height / 2 - (v * scale)
    };
  };

  /**
   * @function renderGrid
   * @description Calcula y dibuja la matriz reticular del plano según el zoom y el paso del Grid.
   * Modula dinámicamente los colores de los ejes de simetría centrales basados en el entorno de luz.
   */
  const renderGrid = () => {
    const lines = [];
    const maxMetersH = (width / 2) / scale; 
    const maxMetersV = (height / 2) / scale;

    // Inyección de color estructural adaptativo para vectores SVG
    const isDarkMode = document.documentElement.classList.contains('dark');
    const colorCenter = isDarkMode ? '#475569' : '#cbd5e1'; // Ejes principales (X=0, Y=0, Z=0)
    const colorGrid = isDarkMode ? '#1e293b' : '#f1f5f9';   // Líneas de división secundarias

    // Generación de vectores verticales de la rejilla
    for (let h = -snapToGrid(maxMetersH, gridSize); h <= maxMetersH; h += gridSize) {
      let pStart, pEnd;
      if (plane.id === 'xy') {
        pStart = project(h, maxMetersV, 0);
        pEnd   = project(h, -maxMetersV, 0);
      } else if (plane.id === 'xz') {
        pStart = project(h, 0, maxMetersV);
        pEnd   = project(h, 0, -maxMetersV);
      } else if (plane.id === 'yz') {
        pStart = project(0, h, maxMetersV);
        pEnd   = project(0, h, -maxMetersV);
      }

      const isCenter = Math.abs(h) < 0.001; 
      lines.push(
        <line 
          key={`v-${h}`} 
          x1={pStart.cx} y1={pStart.cy} x2={pEnd.cx} y2={pEnd.cy} 
          stroke={isCenter ? colorCenter : colorGrid} 
          strokeWidth={isCenter ? '1.5' : '1'}
        />
      );
    }

    // Generación de vectores horizontales de la rejilla
    for (let v = -snapToGrid(maxMetersV, gridSize); v <= maxMetersV; v += gridSize) {
      let pStart, pEnd;
      if (plane.id === 'xy') {
        pStart = project(-maxMetersH, v, 0);
        pEnd   = project(maxMetersH, v, 0);
      } else if (plane.id === 'xz') {
        pStart = project(-maxMetersH, 0, v);
        pEnd   = project(maxMetersH, 0, v);
      } else if (plane.id === 'yz') {
        pStart = project(0, -maxMetersH, v);
        pEnd   = project(0, maxMetersH, v);
      }

      const isCenter = Math.abs(v) < 0.001;
      lines.push(
        <line 
          key={`h-${v}`} 
          x1={pStart.cx} y1={pStart.cy} x2={pEnd.cx} y2={pEnd.cy} 
          stroke={isCenter ? colorCenter : colorGrid} 
          strokeWidth={isCenter ? '1.5' : '1'}
        />
      );
    }
    return lines;
  };

  const handlePointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);

    if (activeTool === 'draw') {
      const coords = getWorldCoords(e, svgRef, scale, planePosition, plane.id);
      const snapped = {
        x: snapToGrid(coords.x, gridSize),
        y: snapToGrid(coords.y, gridSize),
        z: snapToGrid(coords.z, gridSize)
      };
      setDrawingLine({ start: snapped, end: snapped });
    }
  };

  const handlePointerMove = (e) => {
    if (!drawingLine && !draggingNode) return;

    const coords = getWorldCoords(e, svgRef, scale, planePosition, plane.id);
    const snapped = {
      x: snapToGrid(coords.x, gridSize),
      y: snapToGrid(coords.y, gridSize),
      z: snapToGrid(coords.z, gridSize)
    };

    if (drawingLine) {
      setDrawingLine(prev => ({ ...prev, end: snapped }));
    }

    if (draggingNode && activeTool === 'select') {
      const { wireIndex, nodeNum } = draggingNode;
      const updatedWires = [...wires];
      
      if (plane.id === 'xy') {
        updatedWires[wireIndex][`x${nodeNum}`] = snapped.x;
        updatedWires[wireIndex][`y${nodeNum}`] = snapped.y;
      } else if (plane.id === 'xz') {
        updatedWires[wireIndex][`x${nodeNum}`] = snapped.x;
        updatedWires[wireIndex][`z${nodeNum}`] = snapped.z;
      } else if (plane.id === 'yz') {
        updatedWires[wireIndex][`y${nodeNum}`] = snapped.y;
        updatedWires[wireIndex][`z${nodeNum}`] = snapped.z;
      }

      onUpdateWires(updatedWires);
    }
  };

  const handlePointerUp = (e) => {
    e.currentTarget.releasePointerCapture(e.pointerId);

    if (drawingLine && activeTool === 'draw') {
      const hasLength = 
        drawingLine.start.x !== drawingLine.end.x ||
        drawingLine.start.y !== drawingLine.end.y ||
        drawingLine.start.z !== drawingLine.end.z;

      if (hasLength) {
        onUpdateWires([...wires, {
          x1: drawingLine.start.x, y1: drawingLine.start.y, z1: drawingLine.start.z,
          x2: drawingLine.end.x, y2: drawingLine.end.y, z2: drawingLine.end.z,
          radius: 0.001
        }]);
      }
      setDrawingLine(null);
    }
    setDraggingNode(null);
  };

  const handleWireClick = (index, e) => {
    e.stopPropagation(); 
    if (activeTool === 'erase') {
      const filtered = wires.filter((_, i) => i !== index);
      onUpdateWires(filtered);
    }
  };

  // Mapeo adaptativo para color base del elemento irradiante
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const wireNormalColor = isDark ? '#deff9a' : '#4f46e5'; // Verde flúor en oscuro, Indigo-600 en claro

  return (
    <svg 
      ref={svgRef}
      viewBox="0 0 400 400"
      className="w-full h-full bg-white dark:bg-slate-900 cursor-crosshair touch-none select-none transition-colors duration-200"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {renderGrid()}
      
      {/* Estructura geométrica de los hilos cargados */}
      {wires.map((w, i) => {
        const p1 = project(w.x1, w.y1, w.z1);
        const p2 = project(w.x2, w.y2, w.z2);
        
        return (
          <g key={i}>
            {/* Capa de colisión invisible (grosor ensanchado para entradas táctiles ásperas) */}
            <line 
              x1={p1.cx} y1={p1.cy} x2={p2.cx} y2={p2.cy} 
              stroke="transparent" strokeWidth="12" className="cursor-pointer"
              onPointerDown={(e) => handleWireClick(i, e)}
            />
            {/* Trazo visual del hilo conductor */}
            <line 
              x1={p1.cx} y1={p1.cy} x2={p2.cx} y2={p2.cy} 
              stroke={activeTool === 'erase' ? '#f43f5e' : wireNormalColor} 
              strokeWidth="2" 
            />

            {/* Manipuladores de nodo flotantes (Modo: Selección) */}
            {activeTool === 'select' && (
              <>
                <circle 
                  cx={p1.cx} cy={p1.cy} r="5" 
                  fill="#2563eb" className="cursor-move"
                  onPointerDown={(e) => { e.stopPropagation(); setDraggingNode({ wireIndex: i, nodeNum: 1 }); }}
                />
                <circle 
                  cx={p2.cx} cy={p2.cy} r="5" 
                  fill="#2563eb" className="cursor-move"
                  onPointerDown={(e) => { e.stopPropagation(); setDraggingNode({ wireIndex: i, nodeNum: 2 }); }}
                />
              </>
            )}
          </g>
        );
      })}

      {/* Vector Fantasma (Pre-renderizado elástico de dibujo) */}
      {drawingLine && (
        <line 
          x1={project(drawingLine.start.x, drawingLine.start.y, drawingLine.start.z).cx}
          y1={project(drawingLine.start.x, drawingLine.start.y, drawingLine.start.z).cy}
          x2={project(drawingLine.end.x, drawingLine.end.y, drawingLine.end.z).cx}
          y2={project(drawingLine.end.x, drawingLine.end.y, drawingLine.end.z).cy}
          stroke="#2563eb" strokeWidth="1.5" strokeDasharray="4"
        />
      )}
    </svg>
  );
};

export default Viewport2D;