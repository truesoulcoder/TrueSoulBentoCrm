// src/components/maps/StreetViewMap.tsx
'use client';

import { GoogleMap, StreetViewPanorama, Marker } from '@react-google-maps/api';
import { AlertTriangle, Loader2 } from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';
import { useGoogleMapsApi } from './GoogleMapsLoader';
import { Button } from '@heroui/react';
import { Icon } from '@iconify/react';

interface StreetViewMapProps {
  address: string;
}

const containerStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  borderRadius: '0.5rem',
  position: 'relative',
  overflow: 'hidden',
  backgroundColor: '#e5e7eb',
};

const StatusDisplay: React.FC<{ message: string; icon: React.ReactNode }> = ({ message, icon }) => (
  <div style={containerStyle} className="flex flex-col items-center justify-center bg-content2 text-default-500 p-4">
    <div className="mb-2">{icon}</div>
    <p className="text-sm text-center">{message}</p>
  </div>
);

const StreetViewMapContent: React.FC<StreetViewMapProps> = ({ address }) => {
  const [position, setPosition] = useState<google.maps.LatLngLiteral | null>(null);
  const [status, setStatus] = useState<'loading' | 'error' | 'unavailable' | 'success'>('loading');
  const [hasStreetView, setHasStreetView] = useState(false);
  const [showStreetView, setShowStreetView] = useState(true);

  const geocodeAddress = useCallback((geocoder: google.maps.Geocoder, streetViewService: google.maps.StreetViewService) => {
    if (!address || !address.trim()) {
      setStatus('unavailable');
      return;
    }

    geocoder.geocode({ address }, (results, geocoderStatus) => {
      if (geocoderStatus === 'OK' && results && results[0]) {
        const location = results[0].geometry.location;
        const latLng = { lat: location.lat(), lng: location.lng() };
        setPosition(latLng);

        streetViewService.getPanorama({ location: latLng, radius: 50 }, (data, streetViewStatus) => {
          if (streetViewStatus === 'OK') {
            setHasStreetView(true);
            setShowStreetView(true);
            setStatus('success');
          } else {
            setHasStreetView(false);
            setShowStreetView(false);
            setStatus('success');
          }
        });
      } else {
        setStatus('error');
        console.error(`Geocode was not successful for the following reason: ${geocoderStatus}`);
      }
    });
  }, [address]);

  useEffect(() => {
    if (window.google?.maps) {
      const geocoder = new window.google.maps.Geocoder();
      const streetViewService = new window.google.maps.StreetViewService();
      // Debounce the call slightly to avoid rapid-firing API requests
      const handler = setTimeout(() => geocodeAddress(geocoder, streetViewService), 500);
      return () => clearTimeout(handler);
    }
  }, [address, geocodeAddress]);

  if (status === 'loading') {
    return <StatusDisplay message="Finding location..." icon={<Loader2 className="w-8 h-8 animate-spin" />} />;
  }

  if (status === 'error' || !position) {
    return <StatusDisplay message="Could not find address." icon={<AlertTriangle className="w-8 h-8 text-warning" />} />;
  }
  
  const mapOptions: google.maps.MapOptions = {
    center: position,
    zoom: 17,
    streetViewControl: false,
    mapTypeControl: false,
    fullscreenControl: false,
    zoomControl: true,
    mapId: process.env.NEXT_PUBLIC_Maps_MAP_ID, // Use the Map ID from environment variables
  };
  
  const panoramaOptions = {
    position,
    pov: { heading: 165, pitch: 0 },
    zoom: 1,
    addressControl: false,
    showRoadLabels: false,
    enableCloseButton: false,
    fullscreenControl: false,
  };

  return (
    <div style={containerStyle}>
      <GoogleMap mapContainerStyle={{ width: '100%', height: '100%' }} options={mapOptions}>
        {hasStreetView && (
          <Button
            isIconOnly
            size="sm"
            variant="flat"
            className="absolute top-2 right-2 z-10 bg-background/60 backdrop-blur-sm"
            onPress={() => setShowStreetView(prev => !prev)}
            aria-label={showStreetView ? "Switch to Map View" : "Switch to Street View"}
          >
            {showStreetView ? <Icon icon="lucide:map" /> : <Icon icon="lucide:eye" />}
          </Button>
        )}
        {showStreetView && hasStreetView ? (
          <StreetViewPanorama options={panoramaOptions} />
        ) : (
          <Marker position={position} />
        )}
        {!hasStreetView && (
          <div className="absolute bottom-2 left-2 bg-background/70 p-1.5 rounded text-xs text-foreground">
            Street View not available for this location.
          </div>
        )}
      </GoogleMap>
    </div>
  );
};

const StreetViewMap: React.FC<StreetViewMapProps> = (props) => {
  const { isLoaded, loadError } = useGoogleMapsApi();

  if (loadError) {
    return <StatusDisplay message="Error loading Google Maps." icon={<AlertTriangle className="w-8 h-8 text-danger" />} />;
  }

  if (!isLoaded) {
    return <StatusDisplay message="Initializing map..." icon={<Loader2 className="w-8 h-8 animate-spin" />} />;
  }
  
  return <StreetViewMapContent {...props} />;
};

export default StreetViewMap;