import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

type PlacePickerMapProps = {
  lat: number | null;
  lng: number | null;
  onSelect: (lat: number, lng: number) => void;
};

const DEFAULT_REGION = {
  latitude: 37.5665,
  longitude: 126.978,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

export default function PlacePickerMap({ lat, lng, onSelect }: PlacePickerMapProps) {
  const mapRef = useRef<MapView | null>(null);

  useEffect(() => {
    if (!mapRef.current || lat == null || lng == null) return;
    mapRef.current.animateToRegion(
      {
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      },
      300
    );
  }, [lat, lng]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={
          lat != null && lng != null
            ? {
                latitude: lat,
                longitude: lng,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              }
            : DEFAULT_REGION
        }
        onPress={(event) => {
          const { latitude, longitude } = event.nativeEvent.coordinate;
          onSelect(latitude, longitude);
        }}
      >
        {lat != null && lng != null ? (
          <Marker coordinate={{ latitude: lat, longitude: lng }} />
        ) : null}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  map: {
    width: '100%',
    height: '100%',
  },
});
