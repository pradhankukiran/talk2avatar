"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRM } from "@pixiv/three-vrm";
import * as THREE from "three";
import { useAppStore } from "@/stores/app-store";
import { useLipSync } from "@/hooks/useLipSync";
import { lipSyncPrefix, vrmLipExpressions } from "@/lib/viseme-mapping";

type VrmModelProps = {
  onLoadStart?: () => void;
  onLoaded?: () => void;
  onLoadError?: () => void;
};

/** Apply a natural resting arm pose on normalized bones (must be called before vrm.update). */
function applyRelaxedArmsPose(vrm: VRM) {
  const h = vrm.humanoid;
  if (!h) return;

  const lUpper = h.getNormalizedBoneNode("leftUpperArm");
  const rUpper = h.getNormalizedBoneNode("rightUpperArm");
  const lLower = h.getNormalizedBoneNode("leftLowerArm");
  const rLower = h.getNormalizedBoneNode("rightLowerArm");

  if (lUpper) lUpper.rotation.z = -1.4;
  if (rUpper) rUpper.rotation.z = 1.4;
  if (lLower) lLower.rotation.z = -0.1;
  if (rLower) rLower.rotation.z = 0.1;
}

export function VrmModel({ onLoadStart, onLoaded, onLoadError }: VrmModelProps) {
  const { scene } = useThree();
  const vrmRef = useRef<VRM | null>(null);
  const currentAvatar = useAppStore((s) => s.currentAvatar);
  const blinkTimerRef = useRef(0);
  const blinkStateRef = useRef(0); // 0=open, 1=closing, 2=opening
  const lipSyncRef = useLipSync();

  useEffect(() => {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    useAppStore.getState().setModelLoaded(false);
    onLoadStart?.();

    // Clean up previous VRM
    if (vrmRef.current) {
      scene.remove(vrmRef.current.scene);
      vrmRef.current = null;
    }

    loader.load(
      currentAvatar.vrmPath,
      (gltf) => {
        const vrm = gltf.userData.vrm as VRM;
        if (!vrm) return;

        // Rotate to face camera (VRM models face +Z by default)
        vrm.scene.rotation.y = Math.PI;

        scene.add(vrm.scene);
        vrmRef.current = vrm;
        useAppStore.getState().setModelLoaded(true);
        onLoaded?.();
      },
      undefined,
      (error) => {
        console.error("Failed to load VRM:", error);
        useAppStore.getState().setModelLoaded(false);
        onLoadError?.();
        useAppStore.getState().setError("Failed to load avatar model");
      }
    );

    return () => {
      if (vrmRef.current) {
        scene.remove(vrmRef.current.scene);
        vrmRef.current = null;
      }
      useAppStore.getState().setModelLoaded(false);
      onLoadStart?.();
    };
  }, [currentAvatar.vrmPath, onLoadError, onLoaded, onLoadStart, scene]);

  useFrame((_, delta) => {
    const vrm = vrmRef.current;
    if (!vrm) return;

    // Apply arm pose on normalized bones before vrm.update() transfers them
    applyRelaxedArmsPose(vrm);

    vrm.update(delta);

    const expr = vrm.expressionManager;
    if (!expr) return;

    // --- Idle blink animation ---
    blinkTimerRef.current -= delta;
    if (blinkStateRef.current === 0 && blinkTimerRef.current <= 0) {
      blinkStateRef.current = 1;
      blinkTimerRef.current = 0.1; // blink close duration
    } else if (blinkStateRef.current === 1) {
      const blinkVal = expr.getValue("blink") ?? 0;
      const newVal = THREE.MathUtils.lerp(blinkVal, 1, 0.4);
      expr.setValue("blink", newVal);
      if (blinkTimerRef.current <= 0) {
        blinkStateRef.current = 2;
        blinkTimerRef.current = 0.1;
      }
    } else if (blinkStateRef.current === 2) {
      const blinkVal = expr.getValue("blink") ?? 0;
      const newVal = THREE.MathUtils.lerp(blinkVal, 0, 0.4);
      expr.setValue("blink", newVal);
      if (blinkTimerRef.current <= 0) {
        blinkStateRef.current = 0;
        blinkTimerRef.current = 2 + Math.random() * 4; // next blink in 2-6s
        expr.setValue("blink", 0);
      }
    }

    // --- Lip sync: apply viseme weights via VRM expression manager ---
    const avatarType = useAppStore.getState().currentAvatar.type;
    const lipSyncWeights = lipSyncRef.current;

    if (avatarType === "vroid") {
      // VRM models: use expressionManager (aa, ih, ou, ee, oh)
      for (const exprName of vrmLipExpressions) {
        const target = lipSyncWeights[exprName] ?? 0;
        const current = expr.getValue(exprName) ?? 0;
        expr.setValue(exprName, THREE.MathUtils.lerp(current, target, 0.5));
      }
    } else {
      // RPM models: direct morph target manipulation (viseme_XX)
      const prefix = lipSyncPrefix[avatarType];
      vrm.scene.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh) || !obj.morphTargetDictionary || !obj.morphTargetInfluences) return;
        const dict = obj.morphTargetDictionary;
        const influences = obj.morphTargetInfluences;

        for (const [name, targetWeight] of Object.entries(lipSyncWeights)) {
          if (name in dict) {
            const idx = dict[name];
            const current = influences[idx] ?? 0;
            influences[idx] = THREE.MathUtils.lerp(current, targetWeight, 0.5);
          }
        }

        for (const key of Object.keys(dict)) {
          if (key.startsWith(prefix) && !(key in lipSyncWeights)) {
            const idx = dict[key];
            const current = influences[idx] ?? 0;
            influences[idx] = THREE.MathUtils.lerp(current, 0, 0.5);
          }
        }
      });
    }
  });

  return null;
}
