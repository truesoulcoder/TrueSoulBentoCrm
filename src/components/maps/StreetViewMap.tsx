// src/components/maps/StreetViewMap.tsx
'use client';

import { Map, AdvancedMarker, ColorScheme, RenderingType, useApiIsLoaded } from '@vis.gl/react-google-maps';
import { AlertTriangle, Loader2 } from 'lucide-react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@heroui/react';
import { Icon } from '@iconify/react';

interface StreetViewMapProps {
  apiKey: string;
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

const StreetViewMapContent: React.FC<StreetViewMapProps> = ({ apiKey, address }) => {
  const [position, setPosition] = useState<google.maps.LatLngLiteral | null>(null);
  const [status, setStatus] = useState<'loading' | 'error' | 'unavailable' | 'success'>('loading');
  const [hasStreetView, setHasStreetView] = useState(false);
  const [showStreetView, setShowStreetView] = useState(true);

  const panoramaRef = useRef<HTMLDivElement>(null);
  const panoramaInstanceRef = useRef<google.maps.StreetViewPanorama | null>(null);

  const isApiLoaded = useApiIsLoaded();

  const geocodeAddress = useCallback(() => {
    // This function is now only called when `isApiLoaded` is true.
    const geocoder = new window.google.maps.Geocoder();
    const streetViewService = new window.google.maps.StreetViewService();

    if (!address || !address.trim()) {
      setStatus('unavailable');
      setHasStreetView(false);
      return;
    }

    setStatus('loading');
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
        setHasStreetView(false);
        console.error(`Geocode was not successful for the following reason: ${geocoderStatus}`);
      }
    });
  }, [address]);

  useEffect(() => {
    if (isApiLoaded) {
      const handler = setTimeout(() => geocodeAddress(), 500);
      return () => clearTimeout(handler);
    }
  }, [isApiLoaded, geocodeAddress]);

  useEffect(() => {
    if (isApiLoaded && panoramaRef.current && hasStreetView && position) {
      if (showStreetView) {
        if (!panoramaInstanceRef.current) {
          panoramaInstanceRef.current = new window.google.maps.StreetViewPanorama(
            panoramaRef.current,
            {
              position: position,
              pov: { heading: 165, pitch: 0 },
              zoom: 1,
              addressControl: false,
              showRoadLabels: false,
              enableCloseButton: false,
              fullscreenControl: false,
              visible: true,
            }
          );
        } else {
          panoramaInstanceRef.current.setPosition(position);
          panoramaInstanceRef.current.setVisible(true);
        }
      } else if (panoramaInstanceRef.current) {
        panoramaInstanceRef.current.setVisible(false);
      }
    }
  }, [position, hasStreetView, showStreetView, isApiLoaded]);

  if (!isApiLoaded) {
    return <StatusDisplay message="Loading Google Maps..." icon={<Loader2 className="w-8 h-8 animate-spin" />} />;
  }

  if (status === 'loading') {
    return <StatusDisplay message="Finding location..." icon={<Loader2 className="w-8 h-8 animate-spin" />} />;
  }

  if (status === 'error') {
    return <StatusDisplay message="Could not find address." icon={<AlertTriangle className="w-8 h-8 text-warning" />} />;
  }
  
  if (status === 'unavailable' || !position) { 
    return <StatusDisplay message="Address not provided or invalid." icon={<AlertTriangle className="w-8 h-8 text-info" />} />;
  }

  const mapOptions: google.maps.MapOptions = {
    center: position || { lat: 0, lng: 0 },
    zoom: 14,
    mapId: process.env.NEXT_PUBLIC_Maps_MAP_ID,
    disableDefaultUI: true,
    gestureHandling: "greedy",
  };

  return (
    <div style={containerStyle}>
      {hasStreetView && (
        <Button
          isIconOnly
          size="sm"
          variant="flat"
          className="absolute top-2 right-2 z-20 bg-background/60 backdrop-blur-sm"
          onPress={() => setShowStreetView(prev => !prev)}
          aria-label={showStreetView ? "Switch to Map View" : "Switch to Street View"}
        >
          {showStreetView ? <Icon icon="lucide:map" /> : <Icon icon="lucide:eye" />}
        </Button>
      )}

      {showStreetView && hasStreetView ? (
        <div ref={panoramaRef} style={{ width: '100%', height: '100%', borderRadius: '0.5rem' }} />
      ) : (
        <div style={{ width: '100%', height: '100%', borderRadius: '0.5rem', overflow: 'hidden' }}>
          <Map
            mapId={process.env.NEXT_PUBLIC_Maps_MAP_ID}
            colorScheme={ColorScheme.LIGHT}
            renderingType={RenderingType.VECTOR}
          >
            <AdvancedMarker position={position} />
          </Map>
        </div>
      )}
      
      {status === 'success' && !hasStreetView && (
        <div className="absolute bottom-2 left-2 bg-background/70 p-1.5 rounded text-xs text-foreground z-10">
          Street View not available for this location.
        </div>
      )}
    </div>
  );
};

const StreetViewMap: React.FC<StreetViewMapProps> = (props) => {
  return <StreetViewMapContent {...props} />;
};

export default StreetViewMap;