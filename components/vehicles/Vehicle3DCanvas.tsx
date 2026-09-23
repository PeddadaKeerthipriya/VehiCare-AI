"use client";

import React, { useRef, useMemo, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, Environment, ContactShadows, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { VehicleModelConfig } from "@/lib/vehicleModels";

interface Vehicle3DCanvasProps {
  config: VehicleModelConfig;
  isAutoRotate: boolean;
  onLoaded?: () => void;
  onError?: (err: Error) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  controlsRef: React.MutableRefObject<any>;
  selectedColor?: string | null;
}

function VehicleModelInner({
  config,
  onLoaded,
  selectedColor,
  controlsRef,
}: {
  config: VehicleModelConfig;
  onLoaded?: () => void;
  selectedColor?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  controlsRef: React.MutableRefObject<any>;
}) {
  const { scene } = useGLTF(config.modelPath);
  const modelRef = useRef<THREE.Group>(null);

  // Clone scene on load to avoid mutating cached GLTF across component mounts
  const clonedScene = useMemo(() => scene.clone(true), [scene]);

  // Track cloned exterior body materials specifically for color customization
  const bodyMaterialsRef = useRef<THREE.MeshStandardMaterial[]>([]);

  // Compute bounding box, center, and frame model & camera dynamically
  useMemo(() => {
    if (!clonedScene) return;

    // 1. Compute initial bounding box of raw scene
    const box = new THREE.Box3().setFromObject(clonedScene);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    // 2. Center mesh geometry at X=0, Z=0 and place bottom flush on Y=0
    clonedScene.position.x = -center.x;
    clonedScene.position.z = -center.z;
    clonedScene.position.y = -box.min.y;

    // 3. Traversal to locate configured body materials for color switching
    const bodyMatNames = new Set(config.bodyMaterialNames || []);
    const found: THREE.MeshStandardMaterial[] = [];

    clonedScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((mat) => {
            if (mat && bodyMatNames.has(mat.name)) {
              const cloned = mat.clone() as THREE.MeshStandardMaterial;
              found.push(cloned);
              return cloned;
            }
            return mat;
          });
        } else if (mesh.material && bodyMatNames.has(mesh.material.name)) {
          const cloned = mesh.material.clone() as THREE.MeshStandardMaterial;
          mesh.material = cloned;
          found.push(cloned);
        }
      }
    });

    bodyMaterialsRef.current = found;

    // 4. Dynamic camera framing calculation based on model bounding box
    const maxDim = Math.max(size.x, size.y, size.z);
    const targetY = size.y * 0.48;
    const fov = config.fov || 34;
    const fovRad = (fov * Math.PI) / 180;
    const multiplier = config.framingMultiplier || 1.02;

    const distance = (maxDim / (2 * Math.tan(fovRad / 2))) * multiplier;

    // Set controls target and framed camera position
    if (controlsRef && controlsRef.current) {
      const controls = controlsRef.current;
      const camera = controls.object as THREE.PerspectiveCamera;

      if (camera) {
        camera.fov = fov;
        // Set near clipping plane very small relative to maxDim (0.2mm) to prevent zoom clipping
        camera.near = Math.min(maxDim * 0.005, 0.0002);
        camera.far = Math.max(distance * 30.0, 10.0);
        camera.updateProjectionMatrix();
      }

      controls.target.set(0, targetY, 0);

      // Hero 3/4 perspective angle showing front grille, side profile, and wheels
      const cameraDir = new THREE.Vector3(1.1, 0.42, 1.25).normalize();
      const cameraPos = new THREE.Vector3(0, targetY, 0).add(cameraDir.multiplyScalar(distance));

      controls.object.position.copy(cameraPos);
      
      // Allow close-up inspection without clipping or going inside geometry
      controls.minDistance = Math.max(maxDim * 0.16, 0.007);
      // Prevent vehicle from shrinking into a tiny distant dot on zoom out
      controls.maxDistance = Math.max(distance * 2.2, 0.16);
      
      controls.update();
      controls.saveState();
    }
  }, [clonedScene, config, controlsRef]);

  // Update body color in-memory when selectedColor changes without reloading GLB
  useEffect(() => {
    if (selectedColor && bodyMaterialsRef.current.length > 0) {
      const color = new THREE.Color(selectedColor);
      bodyMaterialsRef.current.forEach((mat) => {
        mat.color.copy(color);
        mat.needsUpdate = true;
      });
    }
  }, [selectedColor]);

  useEffect(() => {
    if (clonedScene && onLoaded) {
      onLoaded();
    }
  }, [clonedScene, onLoaded]);

  return <primitive ref={modelRef} object={clonedScene} />;
}

export default function Vehicle3DCanvas({
  config,
  isAutoRotate,
  onLoaded,
  controlsRef,
  selectedColor,
}: Vehicle3DCanvasProps) {
  return (
    <div className="w-full h-full relative">
      <Canvas
        gl={{
          antialias: true,
          alpha: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
          powerPreference: "high-performance",
        }}
        className="w-full h-full bg-transparent"
        style={{ width: "100%", height: "100%", outline: "none" }}
      >
        <PerspectiveCamera makeDefault position={[0.08, 0.04, 0.08]} fov={34} near={0.0002} far={10} />

        {/* Studio Lighting Setup for Premium Vehicle Presentation */}
        <ambientLight intensity={0.8} />
        <directionalLight
          position={[10, 14, 8]}
          intensity={1.8}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-bias={-0.0001}
        />
        <directionalLight position={[-10, 10, -8]} intensity={0.7} />
        <directionalLight position={[0, 8, 10]} intensity={0.6} />

        {/* Environmental HDRI Reflection for Metallic Car Paint */}
        <Environment preset="city" environmentIntensity={0.85} />

        {/* 3D Vehicle Model */}
        <React.Suspense fallback={null}>
          <VehicleModelInner
            config={config}
            onLoaded={onLoaded}
            selectedColor={selectedColor}
            controlsRef={controlsRef}
          />
        </React.Suspense>

        {/* Soft Ground Contact Shadow */}
        <ContactShadows
          position={[0, 0, 0]}
          opacity={0.65}
          scale={0.2}
          blur={1.6}
          far={0.2}
          resolution={1024}
          color="#000000"
        />

        {/* 360 Degree Orbit Interaction */}
        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          enableZoom={true}
          autoRotate={isAutoRotate}
          autoRotateSpeed={1.4}
          rotateSpeed={0.75}
          zoomSpeed={0.7}
          dampingFactor={0.07}
          makeDefault
        />
      </Canvas>
    </div>
  );
}
