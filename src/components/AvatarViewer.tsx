"use client";

import { useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { VrmModel } from "./VrmModel";
import { useAppStore } from "@/stores/app-store";

/** Sweeps the camera from behind the model to the front over ~2.5s, waits for model to load first. */
function CameraReveal({ onComplete }: { onComplete: () => void }) {
  const elapsed = useRef(0);
  const done = useRef(false);

  useFrame(({ camera }, delta) => {
    if (done.current) return;

    // Wait for model to be loaded before starting the sweep
    const modelLoaded = useAppStore.getState().modelLoaded;
    if (!modelLoaded) {
      // Keep camera at starting position (back view) while waiting
      camera.position.set(0, 1.2, 1.8);
      camera.lookAt(0, 1.2, 0);
      return;
    }

    elapsed.current += delta;
    const duration = 2.5;
    const t = Math.min(elapsed.current / duration, 1);
    // ease-out cubic for a smooth deceleration
    const ease = 1 - Math.pow(1 - t, 3);

    // Sweep from angle 0 (+Z, back) to PI (-Z, front)
    const angle = Math.PI * ease;
    const radius = 1.8;

    camera.position.x = radius * Math.sin(angle);
    camera.position.y = 1.2;
    camera.position.z = radius * Math.cos(angle);
    camera.lookAt(0, 1.2, 0);

    if (t >= 1 && !done.current) {
      done.current = true;
      onComplete();
    }
  });

  return null;
}

export function AvatarViewer() {
  const [orbitEnabled, setOrbitEnabled] = useState(false);

  return (
    <div className="relative h-full w-full">
      <Canvas
        camera={{ position: [0, 1.2, 1.8], fov: 30 }}
        gl={{ antialias: true }}
        style={{ background: "linear-gradient(160deg, #f5f2ec 0%, #ebe7de 40%, #e8e4db 100%)" }}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[2, 3, 2]} intensity={0.9} color="#fff8f0" />
        <directionalLight position={[-2, 2, -1]} intensity={0.4} color="#f0f0ff" />
        <hemisphereLight args={["#fef8f0", "#e8e4db", 0.3]} />
        <VrmModel />
        {orbitEnabled ? (
          <OrbitControls
            target={[0, 1.2, 0]}
            minDistance={0.5}
            maxDistance={2.5}
            enablePan={false}
            maxPolarAngle={Math.PI / 1.8}
            minPolarAngle={Math.PI / 4}
          />
        ) : (
          <CameraReveal onComplete={() => setOrbitEnabled(true)} />
        )}
      </Canvas>
    </div>
  );
}
