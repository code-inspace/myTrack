import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.mytrack.app",
  appName: "myTrack",
  webDir: "out",
  server: {
    // 127.0.0.1 ou IP LAN du Mac pour le simulateur iOS
    url: "http://127.0.0.1:3000",
    cleartext: true,
  },
  ios: {
    contentInset: "always",
    preferredContentMode: "mobile",
    scheme: "myTrack",
    allowsLinkPreview: false,
  },
};

export default config;
