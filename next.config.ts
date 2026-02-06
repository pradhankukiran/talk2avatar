import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use webpack for build (Turbopack doesn't support asyncWebAssembly yet)
  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    return config;
  },
  outputFileTracingIncludes: {
    "/api/tts": [
      "./node_modules/@met4citizen/headtts/modules/**/*",
      "./node_modules/@met4citizen/headtts/dictionaries/**/*",
      "./node_modules/@huggingface/transformers/dist/**/*",
      "./node_modules/onnxruntime-node/dist/**/*",
      "./node_modules/onnxruntime-node/lib/**/*",
      "./node_modules/onnxruntime-node/bin/napi-v3/linux/**/*",
      "./public/headtts/dictionaries/**/*",
      "./public/headtts/voices/**/*",
    ],
    "/api/tts/route": [
      "./node_modules/@met4citizen/headtts/modules/**/*",
      "./node_modules/@met4citizen/headtts/dictionaries/**/*",
      "./node_modules/@huggingface/transformers/dist/**/*",
      "./node_modules/onnxruntime-node/dist/**/*",
      "./node_modules/onnxruntime-node/lib/**/*",
      "./node_modules/onnxruntime-node/bin/napi-v3/linux/**/*",
      "./public/headtts/dictionaries/**/*",
      "./public/headtts/voices/**/*",
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },
};

export default nextConfig;
