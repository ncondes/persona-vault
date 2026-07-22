import type { NextConfig } from "next";

// The backend owns /api, /interaction and /oidc. Proxying them from this origin
// keeps cookies first-party; the paths must not be renamed (oidc-provider sets
// path-scoped cookies on /interaction/:uid).
const API_URL = process.env.API_URL ?? "http://localhost:4400";

const nextConfig: NextConfig = {
  turbopack: { root: __dirname },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API_URL}/api/:path*` },
      { source: "/interaction/:path*", destination: `${API_URL}/interaction/:path*` },
      { source: "/oidc/:path*", destination: `${API_URL}/oidc/:path*` },
    ];
  },
};

export default nextConfig;
