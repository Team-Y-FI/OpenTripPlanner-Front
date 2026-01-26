import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface Place {
  id: string;
  filename: string;
  placeName: string;
  placeAddress: string;
  category: string;
  timestamp: string;
  lat?: number;
  lng?: number;
}

interface PlacesContextType {
  selectedPlaces: Place[];
  setSelectedPlaces: (places: Place[]) => void;
  addPlace: (place: Place) => void;
  removePlace: (id: string) => void;
  clearPlaces: () => void;
}

const PlacesContext = createContext<PlacesContextType | undefined>(undefined);

export function PlacesProvider({ children }: { children: ReactNode }) {
  const [selectedPlaces, setSelectedPlaces] = useState<Place[]>([]);

  const addPlace = (place: Place) => {
    setSelectedPlaces(prev => [...prev, place]);
  };

  const removePlace = (id: string) => {
    setSelectedPlaces(prev => prev.filter(p => p.id !== id));
  };

  const clearPlaces = () => {
    setSelectedPlaces([]);
  };

  return (
    <PlacesContext.Provider value={{ selectedPlaces, setSelectedPlaces, addPlace, removePlace, clearPlaces }}>
      {children}
    </PlacesContext.Provider>
  );
}

export function usePlaces() {
  const context = useContext(PlacesContext);
  if (context === undefined) {
    throw new Error('usePlaces must be used within a PlacesProvider');
  }
  return context;
}
