import 'react-native-gesture-handler';
import React, { Component } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput as RNTextInput, Text as RNText, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MD3DarkTheme, PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import AppNavigator from './src/navigation/AppNavigator';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error('GO SMART APP CRASH:', error, info); }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>GO SMART</Text>
        <Text style={styles.errorText}>{this.state.error?.toString() || 'An unexpected error occurred.'}</Text>
      </View>
    );
  }
}

RNText.defaultProps = RNText.defaultProps || {};
RNText.defaultProps.style = [{ fontFamily: 'GoogleSansFlex-Regular' }, RNText.defaultProps.style];
RNTextInput.defaultProps = RNTextInput.defaultProps || {};
RNTextInput.defaultProps.style = [{ fontFamily: 'GoogleSansFlex-Regular' }, RNTextInput.defaultProps.style];

export const GO_SMART_THEME = {
  ...MD3DarkTheme,
  fonts: {
    ...MD3DarkTheme.fonts,
    displayLarge: { fontFamily: 'GoogleSansFlex-Bold' },
    displayMedium: { fontFamily: 'GoogleSansFlex-Bold' },
    displaySmall: { fontFamily: 'GoogleSansFlex-Bold' },
    headlineLarge: { fontFamily: 'GoogleSansFlex-Bold' },
    headlineMedium: { fontFamily: 'GoogleSansFlex-SemiBold' },
    headlineSmall: { fontFamily: 'GoogleSansFlex-SemiBold' },
    titleLarge: { fontFamily: 'GoogleSansFlex-SemiBold' },
    titleMedium: { fontFamily: 'GoogleSansFlex-Medium' },
    titleSmall: { fontFamily: 'GoogleSansFlex-Medium' },
    bodyLarge: { fontFamily: 'GoogleSansFlex-Regular' },
    bodyMedium: { fontFamily: 'GoogleSansFlex-Regular' },
    bodySmall: { fontFamily: 'GoogleSansFlex-Regular' },
    labelLarge: { fontFamily: 'GoogleSansFlex-Medium' },
    labelMedium: { fontFamily: 'GoogleSansFlex-Regular' },
    labelSmall: { fontFamily: 'GoogleSansFlex-Regular' },
  },
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#FFFFFF', onPrimary: '#000000', primaryContainer: '#FFFFFF', onPrimaryContainer: '#000000',
    secondary: '#FFFFFF', onSecondary: '#000000', secondaryContainer: '#111111', onSecondaryContainer: '#FFFFFF',
    tertiary: '#FFFFFF', background: '#000000', surface: '#070707', surfaceVariant: '#111111',
    onBackground: '#FFFFFF', onSurface: '#FFFFFF', onSurfaceVariant: '#A0A0A0',
    outline: '#333333', outlineVariant: '#202020', error: '#FFFFFF', onError: '#000000',
    errorContainer: '#151515', onErrorContainer: '#FFFFFF',
    elevation: { ...MD3DarkTheme.colors.elevation, level0: '#000000', level1: '#070707', level2: '#0D0D0D', level3: '#111111', level4: '#161616', level5: '#1A1A1A' },
  },
};

export default function App() {
  const [fontsLoaded] = useFonts({
    'GoogleSansFlex-Regular': require('./assets/fonts/GoogleSansFlex-Regular.ttf'),
    'GoogleSansFlex-Medium': require('./assets/fonts/GoogleSansFlex-Medium.ttf'),
    'GoogleSansFlex-SemiBold': require('./assets/fonts/GoogleSansFlex-SemiBold.ttf'),
    'GoogleSansFlex-Bold': require('./assets/fonts/GoogleSansFlex-Bold.ttf'),
  });

  if (!fontsLoaded) {
    return <View style={styles.loading}><ActivityIndicator size="large" color="#FFFFFF" /></View>;
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <PaperProvider theme={GO_SMART_THEME}>
          <StatusBar style="light" backgroundColor="#000000" translucent={false} />
          <View style={styles.root}><AppNavigator /></View>
        </PaperProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  loading: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  errorContainer: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', letterSpacing: 2, marginBottom: 12 },
  errorText: { color: '#B0B0B0', textAlign: 'center' },
});