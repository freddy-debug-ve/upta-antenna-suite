import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';

/**
 * @component AntennaWire
 * @description Renderiza de manera reactiva un segmento tridimensional de antena (cilindro orientado).
 * Muta su respuesta lumínica y cromática en base al tema activo del sistema.
 */
const AntennaWire = ({ w, isDarkMode }) => {
  // Ajuste de mapeo posicional: Se mapean las coordenadas para consistencia del motor WebGL
  const p1 = useMemo(() => new THREE.Vector3(w.x1, w.z1, w.y1), [w.x1, w.z1, w.y1]);
  const p2 = useMemo(() => new THREE.Vector3(w.x2, w.z2, w.y2), [w.x2, w.z2, w.y2]);
  
  const distance = useMemo(() => p1.distanceTo(p2), [p1, p2]);
  if (distance < 0.001) return null; // Ignorar hilos infinitesimales o sin longitud

  // Cálculo de transformaciones euclidianas (Posición central y rotación mediante cuaterniones)
  const { position, quaternion } = useMemo(() => {
    const pos = p1.clone().add(p2).multiplyScalar(0.5);
    const direction = new THREE.Vector3().subVectors(p2, p1).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const quat = new THREE.Quaternion().setFromUnitVectors(up, direction);
    return { position: pos, quaternion: quat };
  }, [p1, p2]);

  // Grosor estandarizado del elemento irradiante en el visor
  const radius = 0.015;

  // Ajuste cromático según entorno: Verde flúor en modo oscuro, Cobre/Índigo técnico en modo claro
  const wireColor = isDarkMode ? '#deff9a' : '#4f46e5';

  return (
    <mesh position={position} quaternion={quaternion}>
      <cylinderGeometry args={[radius, radius, distance, 8]} />
      <meshStandardMaterial 
        color={wireColor} 
        roughness={isDarkMode ? 0.3 : 0.2} 
        metalness={isDarkMode ? 0.5 : 0.8} 
      />
    </mesh>
  );
};

/**
 * @component Viewport3DPreview
 * @description Entorno WebGL proyectivo en tiempo real para la verificación espacial de la geometría.
 * Adapta dinámicamente el fondo de escena, mallas reticulares de ingeniería e iluminación según el tema.
 */
const Viewport3DPreview = ({ wires = [] }) => {
  // Verificación dinámica de estado del tema en el DOM
  const isDarkMode = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  // Configuración estructural de la retícula adaptativa
  const gridConfig = useMemo(() => {
    return {
      cellColor: isDarkMode ? '#334155' : '#cbd5e1',     // Líneas secundarias de la rejilla
      sectionColor: isDarkMode ? '#3b82f6' : '#6366f1',  // Ejes y bloques principales (1m)
    };
  }, [isDarkMode]);

  return (
    <div className="w-full h-full relative bg-white dark:bg-slate-950 transition-colors duration-200">
      <Canvas
        camera={{ position: [3, 3, 5], fov: 45 }}
        style={{ width: '100%', height: '100%' }}
      >
        {/* Esquema de iluminación adaptativo para balancear contrastes */}
        <ambientLight intensity={isDarkMode ? 0.7 : 0.9} />
        <directionalLight position={[10, 15, 10]} intensity={isDarkMode ? 0.9 : 1.2} />
        <pointLight position={[-10, -10, -10]} intensity={isDarkMode ? 0.5 : 0.3} />

        {/* Grupo interactivo de hilos irradiantes */}
        <group>
          {wires.map((w, index) => (
            <AntennaWire key={index} w={w} isDarkMode={isDarkMode} />
          ))}
        </group>

        {/* Helper de Ejes de Referencia Estándar (X=Rojo, Y=Verde, Z=Azul) */}
        <primitive object={new THREE.AxesHelper(1.5)} />

        {/* Retícula Técnica Espacial */}
        <Grid
          renderOrder={-1}
          position={[0, -0.001, 0]} // Leve desfase negativo para evitar Z-fighting con los ejes base
          args={[10, 10]}
          cellSize={0.1}
          cellThickness={0.5}
          cellColor={gridConfig.cellColor}
          sectionSize={1}
          sectionThickness={1}
          sectionColor={gridConfig.sectionColor}
          fadeDistance={20}
        />

        {/* Amortiguación cinemática de órbita (OrbitControls) */}
        <OrbitControls 
          enableDamping 
          dampingFactor={0.05}
          makeDefault 
        />
      </Canvas>
    </div>
  );
};

export default Viewport3DPreview;