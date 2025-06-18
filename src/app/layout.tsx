// src/app/layout.tsx
"use client"
import { Providers } from './providers'
import './globals.css'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        {/* FIX: Update favicon URL to Supabase storage bucket */}
        <link id="favicon" rel="icon" href="https://lefvtgqockzqkasylzwb.supabase.co/storage/v1/object/public/media//favicon.ico" type="image/x-icon" />
      </head>
      <body className="h-full">
        <Providers>
          <div className="min-h-full">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}