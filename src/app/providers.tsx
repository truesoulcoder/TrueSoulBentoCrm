// src/app/providers.tsx
'use client';

import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes';
import { HeroUIProvider } from '@heroui/system';
import { useEffect, useState } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';

// Component to handle theme application timing
function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const { theme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    const root = window.document.documentElement;
    
    // Clear existing classes and attributes
    root.classList.remove('light', 'dark');
    root.removeAttribute('data-theme');
    
    // Determine current theme
    const currentTheme = theme === 'system' ? systemTheme : theme;
    if (!currentTheme) return;
    
    // Apply theme consistently
    root.classList.add(currentTheme);
    root.setAttribute('data-theme', currentTheme === 'dark' ? 'night-heroui' : 'light');
    root.style.colorScheme = currentTheme === 'dark' ? 'dark' : 'light';
    
    // Set transition
    document.body.style.transition = 'background-color 0.3s ease';
    
    return () => {
      document.body.style.transition = '';
    };
  }, [theme, systemTheme, mounted]);

  // Don't render until mounted to avoid hydration mismatch
  if (!mounted) {
    return null;
  }

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider 
      attribute="class" 
      defaultTheme="light" 
      enableSystem
      disableTransitionOnChange={false}
    >
      <ThemeWrapper>
        <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
          <HeroUIProvider>
            {children as React.ReactNode}
          </HeroUIProvider>
        </APIProvider>
      </ThemeWrapper>
    </NextThemesProvider>
  );
}