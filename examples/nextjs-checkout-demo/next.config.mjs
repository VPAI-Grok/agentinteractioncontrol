import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: new URL("../../", import.meta.url).pathname,
  webpack(config) {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "@aic/spec": path.resolve(__dirname, "../../packages/spec/dist/index.js"),
      "@aic/runtime": path.resolve(__dirname, "../../packages/runtime/dist/runtime/src/index.js"),
      "@aic/sdk-react": path.resolve(
        __dirname,
        "../../packages/sdk-react/dist/sdk-react/src/index.js"
      )
    };

    return config;
  }
};

export default nextConfig;
