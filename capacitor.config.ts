import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.mytrack.app",
  appName: "myTrack",
  webDir: "out",
  server: {
    // URL de production pour fonctionner en 4G/5G déconnecté du Mac
    url: "https://mytrack-nine.vercel.app",
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
