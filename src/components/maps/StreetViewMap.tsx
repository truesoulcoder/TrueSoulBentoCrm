// src/components/maps/StreetViewMap.tsx
'use client';

import { Map, AdvancedMarker, ColorScheme, RenderingType } from '@vis.gl/react-google-maps';
import { AlertTriangle, Loader2 } from 'lucide-react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  const [showStreetView, setShowStreetView] = useState(true); // Default to showing Street View if available

  const panoramaRef = useRef<HTMLDivElement>(null);
  const panoramaInstanceRef = useRef<google.maps.StreetViewPanorama | null>(null);

  const geocodeAddress = useCallback(() => { // Removed geocoder and streetViewService from params, will get from window.google.maps
    if (!window.google?.maps) {
      // Google Maps API not loaded yet
      setStatus('loading'); // Or some other appropriate status
      return;
    }
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
            setShowStreetView(true); // Show street view by default if available
            setStatus('success');
          } else {
            setHasStreetView(false);
            setShowStreetView(false); // Don't attempt to show street view if not available
            setStatus('success'); // Still success in geocoding, just no street view
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
    // Debounce the call slightly to avoid rapid-firing API requests
    const handler = setTimeout(() => geocodeAddress(), 500);
    return () => clearTimeout(handler);
  }, [geocodeAddress]);

  // Effect to create/update panorama
  useEffect(() => {
    if (window.google?.maps && panoramaRef.current && hasStreetView && position) {
      if (showStreetView) {
        if (!panoramaInstanceRef.current) {
          // Create panorama instance
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
              visible: true, // Make it visible when created
            }
          );
        } else {
          // Update existing panorama
          panoramaInstanceRef.current.setPosition(position);
          panoramaInstanceRef.current.setVisible(true);
        }
        // If map instance is available via useMap(), you could link it:
        // const map = useMap(); // Assuming useMap() hook from @vis.gl/react-google-maps
        // if (map && panoramaInstanceRef.current) map.setStreetView(panoramaInstanceRef.current);
      } else {
        // Hide Street View
        if (panoramaInstanceRef.current) {
          panoramaInstanceRef.current.setVisible(false);
        }
      }
    }
  }, [position, hasStreetView, showStreetView]);


  if (status === 'loading') {
    return <StatusDisplay message="Finding location..." icon={<Loader2 className="w-8 h-8 animate-spin" />} />;
  }

  if (status === 'error') { // Removed !position check as geocodeAddress sets it or errors out
    return <StatusDisplay message="Could not find address." icon={<AlertTriangle className="w-8 h-8 text-warning" />} />;
  }
  
  if (status === 'unavailable') {
    return <StatusDisplay message="Address not provided or invalid." icon={<AlertTriangle className="w-8 h-8 text-info" />} />;
  }

  // This is for the fallback map when Street View is not shown or not available
  const mapOptions: google.maps.MapOptions = {
    center: position, // position will be non-null here due to checks above
    zoom: 17,
    streetViewControl: false, // We have custom control
    mapTypeControl: false,
    fullscreenControl: false,
    zoomControl: true,
  };

  return (
    <div style={containerStyle}>
      {hasStreetView && (
        <Button
          isIconOnly
          size="sm"
          variant="flat"
          className="absolute top-2 right-2 z-20 bg-background/60 backdrop-blur-sm" // Ensure z-index is high enough
          onPress={() => setShowStreetView(prev => !prev)}
          aria-label={showStreetView ? "Switch to Map View" : "Switch to Street View"}
        >
          {showStreetView ? <Icon icon="lucide:map" /> : <Icon icon="lucide:eye" />}
        </Button>
      )}

      <div
        ref={panoramaRef}
        style={{
          width: '100%',
          height: '100%',
          display: showStreetView && hasStreetView ? 'block' : 'none',
          borderRadius: '0.5rem',
        }}
      />

      {(!showStreetView || !hasStreetView) && position && ( // Show map if not showing street view OR street view not available but position is
        <div style={{ width: '100%', height: '100%', display: (showStreetView && hasStreetView) ? 'none': 'block', borderRadius: '0.5rem', overflow: 'hidden' }}>
          <Map
            {...mapOptions}
            mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID}
            colorScheme={ColorScheme.LIGHT}
            renderingType={RenderingType.VECTOR}
          >
            <AdvancedMarker position={position} />
          </Map>
        </div>
      )}
      
      {!hasStreetView && status === 'success' && ( // Only show if geocoding was successful but no street view
        <div className="absolute bottom-2 left-2 bg-background/70 p-1.5 rounded text-xs text-foreground z-10">
          Street View not available for this location.
        </div>
      )}
    </div>
  );
};

// Keep StreetViewMap wrapper component as is
const StreetViewMap: React.FC<StreetViewMapProps> = (props) => {
  // Potentially, if APIProvider is not high enough, it might be needed here,
  // but GoogleMapsLoader.tsx should handle that.
  return <StreetViewMapContent {...props} />;
};

export default StreetViewMap;