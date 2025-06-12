// src/components/maps/StreetViewMap.tsx
'use client';

import { GoogleMap, StreetViewPanorama } from '@react-google-maps/api';
import { AlertTriangle, Loader2, MapPinOff } from 'lucide-react';
import React, { useState, useEffect, memo } from 'react';
import { useGoogleMapsApi } from './GoogleMapsLoader';

interface StreetViewMapProps {
  address: string;
}

const containerStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  borderRadius: '0.5rem',
  position: 'relative',
  overflow: 'hidden',
  backgroundColor: '#e5e7eb', // A default background color
  minHeight: '200px', // Ensure it has a minimum height
};

const StatusDisplay: React.FC<{ message: string; icon: React.ReactNode }> = ({ message, icon }) => (
  <div style={containerStyle} className="flex flex-col items-center justify-center bg-content2 text-default-500 p-4">
    <div className="mb-2">{icon}</div>
    <p className="text-sm text-center">{message}</p>
  </div>
);

const StreetViewMapContent: React.FC<StreetViewMapProps> = memo(({ address }) => {
  const [position, setPosition] = useState<google.maps.LatLngLiteral | null>(null);
  const [status, setStatus] = useState<'loading' | 'error' | 'unavailable' | 'success'>('loading');

  useEffect(() => {
    if (!address) {
      setStatus('unavailable');
      return;
    }

    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address }, (results, geocoderStatus) => {
      if (geocoderStatus === 'OK' && results && results[0]) {
        const location = results[0].geometry.location;
        const latLng = { lat: location.lat(), lng: location.lng() };

        const streetViewService = new window.google.maps.StreetViewService();
        streetViewService.getPanorama({ location: latLng, radius: 50 }, (data, streetViewStatus) => {
          if (streetViewStatus === 'OK') {
            setPosition(latLng);
            setStatus('success');
          } else {
            setStatus('unavailable');
            console.warn(`Street View not available for "${address}": ${streetViewStatus}`);
          }
        });
      } else {
        setStatus('error');
        console.error(`Geocode was not successful for the following reason: ${geocoderStatus}`);
      }
    });
  }, [address]);

  const panoramaOptions: google.maps.StreetViewPanoramaOptions = {
    position,
    pov: { heading: 165, pitch: 0 },
    zoom: 1,
    addressControl: false,
    showRoadLabels: false,
    enableCloseButton: false,
    fullscreenControl: false,
  };

  const mapOptions: google.maps.MapOptions = {
    center: position || { lat: 0, lng: 0 },
    zoom: 15,
    mapTypeId: 'roadmap',
    streetViewControl: false,
    mapTypeControl: false,
    fullscreenControl: false,
    zoomControl: true,
    clickableIcons: false,
  };

  if (status === 'loading') {
    return <StatusDisplay message="Loading Street View..." icon={<Loader2 className="w-8 h-8 animate-spin" />} />;
  }

  if (status === 'error') {
    return <StatusDisplay message="Could not find address." icon={<AlertTriangle className="w-8 h-8 text-warning" />} />;
  }

  if (status === 'unavailable') {
    return <StatusDisplay message="Street View is not available for this location." icon={<MapPinOff className="w-8 h-8" />} />;
  }

  return (
    <div style={containerStyle}>
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={position || undefined}
        zoom={18}
        options={mapOptions}
      >
        <StreetViewPanorama options={panoramaOptions} />
      </GoogleMap>
    </div>
  );
});

StreetViewMapContent.displayName = 'StreetViewMapContent';

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

StreetViewMap.displayName = 'StreetViewMap';

export default StreetViewMap;