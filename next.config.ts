import type { NextConfig } from "next";

// Files needed by the HeadTTS worker thread at runtime.
// The worker dynamically imports @huggingface/transformers which has static
// ESM imports for onnxruntime-common, onnxruntime-node, and sharp — all three
// must be resolvable or the entire module fails to load.
const ttsTracingIncludes = [
  // HeadTTS worker + dictionaries
  "./node_modules/@met4citizen/headtts/modules/**/*",
  "./node_modules/@met4citizen/headtts/dictionaries/**/*",
  // Transformers (webpack-bundled, externals resolved at runtime)
  "./node_modules/@huggingface/transformers/dist/**/*",
  // ONNX Runtime — package.json + entry points + native bindings
  "./node_modules/onnxruntime-common/**/*",
  "./node_modules/onnxruntime-node/**/*",
  // Sharp — static ESM import in transformers.node.mjs (+ transitive deps)
  "./node_modules/sharp/**/*",
  "./node_modules/@img/sharp-linux-x64/**/*",
  "./node_modules/@img/sharp-libvips-linux-x64/**/*",
  "./node_modules/@img/colour/**/*",
  "./node_modules/detect-libc/**/*",
  "./node_modules/semver/**/*",
  // Public assets read by the worker at runtime
  "./public/headtts/modules/**/*",
  "./public/headtts/dictionaries/**/*",
  "./public/headtts/voices/**/*",
];

const ttsTracingExcludes = [
  "./node_modules/onnxruntime-node/bin/napi-v3/linux/**/libonnxruntime_providers_cuda.so",
  "./node_modules/onnxruntime-node/bin/napi-v3/linux/**/libonnxruntime_providers_tensorrt.so",
  "./node_modules/onnxruntime-node/bin/napi-v3/darwin/**/*",
  "./node_modules/onnxruntime-node/bin/napi-v3/win32/**/*",
];

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
    "/api/tts": ttsTracingIncludes,
    "/api/tts/route": ttsTracingIncludes,
  },
  outputFileTracingExcludes: {
    "/api/tts": ttsTracingExcludes,
    "/api/tts/route": ttsTracingExcludes,
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
