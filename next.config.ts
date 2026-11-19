import type { NextConfig } from "next";

// The site is plain static files, so it can be hosted anywhere.
// On GitHub Pages it lives under /<repository-name>, which the deploy workflow passes in.
const nextConfig: NextConfig = {
  output: "export",
  basePath: process.env.PAGES_BASE_PATH || "",
};

export default nextConfig;
