// src/components/maps/GoogleMapsLoader.tsx
'use client';

import { useJsApiLoader, Libraries } from '@react-google-maps/api';
import React, { memo, createContext, useContext } from 'react';

// Define the libraries array with the correct type
const libraries: Libraries = ['places', 'geocoding', 'streetView'];

interface GoogleMapsApiContextType {
  isLoaded: boolean;
  loadError?: Error;
}

export const GoogleMapsApiContext = createContext<GoogleMapsApiContextType | undefined>(undefined);

export const useGoogleMapsApi = () => {
  const context = useContext(GoogleMapsApiContext);
  if (context === undefined) {
    throw new Error('useGoogleMapsApi must be used within a GoogleMapsLoader');
  }
  return context;
};

interface GoogleMapsLoaderProps {
  children: React.ReactNode;
}

const GoogleMapsLoader: React.FC<GoogleMapsLoaderProps> = memo(({ children }) => {
  const apiKey = process.env.NEXT_PUBLIC_Maps_API_KEY;

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-maps-script-main-loader',
    googleMapsApiKey: apiKey || '',
    libraries,
    preventGoogleFontsLoading: true,
  });

  if (!apiKey) {
    console.error('Google Maps API key is not set. NEXT_PUBLIC_Maps_API_KEY is missing from environment variables.');
    return (
        <div style={{ padding: '20px', textAlign: 'center', color: 'red', backgroundColor: '#fffbe6', border: '1px solid #fccf4f', borderRadius: '8px' }}>
            <strong>Configuration Error:</strong> Google Maps API key is not configured. Mapping features will be unavailable.
        </div>
    );
  }
  
  return (
    <GoogleMapsApiContext.Provider value={{ isLoaded, loadError }}>
      {children}
    </GoogleMapsApiContext.Provider>
  );
});

GoogleMapsLoader.displayName = 'GoogleMapsLoader';

export default GoogleMapsLoader;