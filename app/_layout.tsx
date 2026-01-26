import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import { PlacesProvider } from '@/contexts/PlacesContext';
import 'react-native-reanimated';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PlacesProvider>
        <StatusBar 
          style="dark" 
          translucent={false}
          backgroundColor="#ffffff"
        />
        <ThemeProvider value={DefaultTheme}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { 
                paddingTop: Platform.OS === 'android' ? 0 : 0 
              }
            }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="course" />
            <Stack.Screen name="upload" />
            <Stack.Screen name="record" />
            <Stack.Screen name="records" />
          </Stack>
        </ThemeProvider>
      </PlacesProvider>
    </SafeAreaProvider>
  );
}
