import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { Platform, StyleSheet, View } from 'react-native';
import RootNavigator from './src/navigation/RootNavigator';
import { ClinicProvider } from './src/contexts/ClinicContexts';

export default function App() {
  return (
    <ClinicProvider>
      <View style={styles.viewport}>
        <View style={styles.appSurface}>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </View>
      </View>
    </ClinicProvider>
  );
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    backgroundColor: '#EEF2F7',
  },
  appSurface: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: '#F8F9FA',
    ...(Platform.OS === 'web'
      ? {
          maxWidth: '100%',
          minHeight: '100%',
        }
      : {}),
  },
});