// Install @capacitor/cli before building the APK:
// npm install @capacitor/cli @capacitor/core @capacitor/android

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const config: any = {
  appId: "com.readalong.app",
  appName: "ReadAlong",
  // Static export output directory
  webDir: "out",
  server: {
    // When running on device, API calls go to the live Vercel deployment.
    // Replace with your actual Vercel URL before building the APK.
    url: "https://YOUR_APP.vercel.app",
    cleartext: false,
  },
  android: {
    backgroundColor: "#0c0a09", // stone-950 (matches dark mode bg)
  },
}

export default config
