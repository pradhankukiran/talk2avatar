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
 * For VRoid avatars: map Oculus visemes to weighted combinations
 * of lip_a / lip_i / lip_u / lip_e / lip_o morph targets.
 */
const vroidVisemeMap: Record<OculusViseme, VisemeWeights> = {
  sil: {},
  PP: { lip_u: 0.6, lip_a: 0.1 },
  FF: { lip_i: 0.6, lip_a: 0.1 },
  TH: { lip_i: 0.4, lip_o: 0.4 },
  DD: { lip_a: 0.6, lip_i: 0.3 },
  kk: { lip_a: 0.4, lip_i: 0.5 },
  CH: { lip_i: 0.8, lip_e: 0.3 },
  SS: { lip_i: 0.7, lip_e: 0.4 },
  nn: { lip_a: 0.4, lip_i: 0.3 },
  RR: { lip_o: 0.5, lip_a: 0.4 },
  aa: { lip_a: 1.0 },
  E: { lip_e: 1.0, lip_i: 0.3 },
  I: { lip_i: 1.0, lip_e: 0.3 },
  O: { lip_o: 1.0 },
  U: { lip_u: 1.0 },
};

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
