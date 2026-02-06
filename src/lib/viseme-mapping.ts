import type { OculusViseme, VisemeWeights } from "@/types";

/**
 * For RPM avatars: direct 1:1 mapping to morph target names.
 * RPM avatars have morph targets named `viseme_XX` that correspond
 * directly to Oculus viseme IDs.
 */
const rpmVisemeMap: Record<OculusViseme, VisemeWeights> = {
  sil: { viseme_sil: 1.0 },
  PP: { viseme_PP: 1.0 },
  FF: { viseme_FF: 1.0 },
  TH: { viseme_TH: 1.0 },
  DD: { viseme_DD: 1.0 },
  kk: { viseme_kk: 1.0 },
  CH: { viseme_CH: 1.0 },
  SS: { viseme_SS: 1.0 },
  nn: { viseme_nn: 1.0 },
  RR: { viseme_RR: 1.0 },
  aa: { viseme_aa: 1.0 },
  E: { viseme_E: 1.0 },
  I: { viseme_I: 1.0 },
  O: { viseme_O: 1.0 },
  U: { viseme_U: 1.0 },
};

/**
 * For VRoid / VRM avatars: map Oculus visemes to weighted combinations
 * of VRM expression names (aa, ih, ou, ee, oh).
 * These are applied via vrm.expressionManager.setValue(), not direct morph targets.
 */
const vroidVisemeMap: Record<OculusViseme, VisemeWeights> = {
  sil: {},
  PP: { ou: 0.6, aa: 0.1 },
  FF: { ih: 0.6, aa: 0.1 },
  TH: { ih: 0.4, oh: 0.4 },
  DD: { aa: 0.6, ih: 0.3 },
  kk: { aa: 0.4, ih: 0.5 },
  CH: { ih: 0.8, ee: 0.3 },
  SS: { ih: 0.7, ee: 0.4 },
  nn: { aa: 0.4, ih: 0.3 },
  RR: { oh: 0.5, aa: 0.4 },
  aa: { aa: 1.0 },
  E: { ee: 1.0, ih: 0.3 },
  I: { ih: 1.0, ee: 0.3 },
  O: { oh: 1.0 },
  U: { ou: 1.0 },
};

/** VRM expression names used for lip sync. */
export const vrmLipExpressions = ["aa", "ih", "ou", "ee", "oh"] as const;

/** Morph target prefixes used for lip sync, per avatar type. */
export const lipSyncPrefix: Record<"rpm" | "vroid", string> = {
  rpm: "viseme_",
  vroid: "lip_",
};

/**
 * Returns morph-target blend shape weights for a given viseme.
 */
export function getVisemeWeights(
  viseme: OculusViseme,
  avatarType: "rpm" | "vroid"
): VisemeWeights {
  const map = avatarType === "rpm" ? rpmVisemeMap : vroidVisemeMap;
  return map[viseme] ?? {};
}
