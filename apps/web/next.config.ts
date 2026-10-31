import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  // Opening the dev server as 127.0.0.1 is a different origin from localhost.
  // Without this, the HMR socket returns a bare "Unauthorized" and the page never hydrates.
  allowedDevOrigins: ["127.0.0.1"],
  transpilePackages: ["@alphatape/shared"],
  outputFileTracingRoot: path.join(path.dirname(fileURLToPath(import.meta.url)), "../.."),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
