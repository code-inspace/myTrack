import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Autoriser le simulateur iOS et les appareils mobiles locaux à charger les chunks JS
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "127.0.0.1:3000",
    "localhost:3000",
    "192.168.68.105",
    "192.168.68.105:3000",
    "capacitor://localhost",
    "ionic://localhost",
  ],
};

export default nextConfig;
