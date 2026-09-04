import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.mytrack.app",
  appName: "myTrack",
  webDir: "out",
  server: {
    // IP LAN du Mac pour permettre au téléphone physique et au simulateur de se connecter
    url: "http://192.168.68.105:3000",
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
