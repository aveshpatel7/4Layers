import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { MD3DarkTheme, PaperProvider } from 'react-native-paper';
import AppNavigator from './src/navigation/AppNavigator';

// Polyfill global window and localStorage for paho-mqtt and native runtime stability
if (typeof window === 'undefined') {
  global.window = global;
}
if (!global.window.localStorage) {
  global.window.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
}

// Custom Material Design 3 Dark Theme for a premium modern Black + Green aesthetic
const theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#22C55E',          // Brand Dark Emerald Green (#22C55E)
    secondary: '#15803D',        // Secondary Darker Green
    background: '#0E0E0E',       // Image 1 Obsidian Dark Black
    surface: '#1C1B1B',          // Image 1 Glass Card Surface
    onSurface: '#E5E2E1',        // Image 1 Warm Off-White text
    onSurfaceVariant: '#9CA3AF',   // Muted gray text
    outline: '#262626',          // Muted border
    outlineVariant: '#333333',    // Dark border
    error: '#EF4444',            // Error Red
    errorContainer: '#7F1D1D',   // Dark red container
    onErrorContainer: '#FCA5A5', // Soft red text
    elevation: {
      ...MD3DarkTheme.colors.elevation,
      level1: '#1C1B1B',         // Card level 1
      level2: '#262626',         // Active state card overlay
    }
  },
};

export default function App() {
  return (
    <PaperProvider theme={theme}>
      {/* Light status bar icons for dark background */}
      <StatusBar style="light" backgroundColor="#0D0D0D" />
      <AppNavigator />
    </PaperProvider>
  );
}
