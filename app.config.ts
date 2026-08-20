import type { ExpoConfig } from 'expo/config';

import PRODUCT from './config/product.json';

const config: ExpoConfig = {
  name: PRODUCT.displayName,
  slug: PRODUCT.slug,
  owner: PRODUCT.expoOwner,
  version: PRODUCT.version,
  orientation: 'portrait',
  icon: './assets/images/icon-legacy.png',
  scheme: PRODUCT.scheme,
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: PRODUCT.bundleIdentifier,
    buildNumber: PRODUCT.buildNumber,
    supportsTablet: false,
    icon: './assets/images/icon-legacy.png',
    config: {
      usesNonExemptEncryption: false,
    },
    infoPlist: {
      UIFileSharingEnabled: true,
      LSSupportsOpeningDocumentsInPlace: true,
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: PRODUCT.androidPackage,
    adaptiveIcon: {
      backgroundColor: '#EEF2F1',
      foregroundImage: './assets/images/android-icon-foreground.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-document-picker',
    ['expo-sqlite', { enableFTS: true }],
    [
      'expo-splash-screen',
      {
        backgroundColor: '#0F1417',
        image: './assets/images/icon-legacy.png',
        imageWidth: 180,
        dark: {
          backgroundColor: '#0F1417',
          image: './assets/images/icon-legacy.png',
        },
      },
    ],
  ],
  updates: {
    enabled: true,
    url: `https://u.expo.dev/${PRODUCT.easProjectId}`,
    checkAutomatically: 'ON_LOAD',
    fallbackToCacheTimeout: 0,
  },
  runtimeVersion: { policy: 'appVersion' },
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    eas: {
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? PRODUCT.easProjectId,
    },
  },
};

export default config;
