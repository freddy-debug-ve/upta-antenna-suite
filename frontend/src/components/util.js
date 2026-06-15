export const snapToGrid = (val, grid) => Math.round(val / grid) * grid;

export const getWorldCoords = (e, svgRef, scale, offset, planeId) => {
  const svg = svgRef.current;
  const rect = svg.getBoundingClientRect();
  
  // Posición del mouse relativa al SVG
  const pxX = e.clientX - rect.left;
  const pxY = e.clientY - rect.top;

  // Convertir a metros (suponiendo que el centro del SVG es 0,0)
  const worldH = (pxX - rect.width / 2) / scale;
  const worldV = ((rect.height / 2) - pxY) / scale; // Invertir Y para que arriba sea positivo

  // Retornar según el plano
  if (planeId === 'xy') return { x: worldH, y: worldV, z: offset.z };
  if (planeId === 'xz') return { x: worldH, y: offset.y, z: worldV };
  if (planeId === 'yz') return { x: offset.x, y: worldH, z: worldV };
};