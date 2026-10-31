import React from 'react';
import { View, Image, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize } from '../styles/theme';

interface CircularImageProps {
  uri?: string | null;
  size?: number;
  onPress?: () => void;
  placeholder?: any; // require() image
  showEditButton?: boolean;
  loading?: boolean;
  style?: any;
}

export default function CircularImage({ 
  uri, 
  size = 120, 
  onPress, 
  placeholder,
  showEditButton = false,
  loading = false,
  style 
}: CircularImageProps) {
  const imageStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  const content = (
    <View style={[styles.container, imageStyle, style]}>
      <Image
        source={uri ? { uri } : (placeholder || require('../../assets/appstore.png'))}
        style={[styles.image, imageStyle]}
        resizeMode="contain"
      />
      
      {loading && (
        <View style={[styles.loadingOverlay, imageStyle]}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}
      
      {showEditButton && (
        <View style={[styles.editButton, { bottom: size * 0.1, right: size * 0.1 }]}>
          <Ionicons name="camera" size={13} color={colors.onPrimary} />
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButton: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});