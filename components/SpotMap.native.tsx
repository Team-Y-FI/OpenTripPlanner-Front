import { useRef, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { Marker, MapMarker } from 'react-native-maps';

type SpotMapProps = {
  lat: number;
  lng: number;
  name: string;
  address?: string;
};

export default function SpotMap({ lat, lng, name, address }: SpotMapProps) {
  const markerRef = useRef<MapMarker | null>(null);

  const onMapReady = useCallback(() => {
    setTimeout(() => {
      markerRef.current?.showCallout();
    }, 500);
  }, []);

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }}
        onMapReady={onMapReady}
      >
        <Marker
          ref={markerRef}
          coordinate={{ latitude: lat, longitude: lng }}
          title={name}
          description={address || undefined}
        />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
  },
  map: {
    width: '100%',
    height: '100%',
  },
});
