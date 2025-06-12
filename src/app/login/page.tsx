// src/app/login/page.tsx
'use client';

import React from 'react';
import Image from 'next/image';
import { Button } from '@heroui/react';
import { Icon } from '@iconify/react';

const LoginPage = () => {
  const handleGoogleLogin = () => {
    // Redirects to the Google auth handler you already created
    window.location.href = '/api/auth/google';
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
      <div className="flex flex-col items-center gap-8 p-10">
        <Image
          src="https://lefvtgqockzqkasylzwb.supabase.co/storage/v1/object/public/media//logo.png"
          alt="True Soul CRM Logo"
          width={200}
          height={200}
          priority
        />
        <Button
          color="primary"
          size="lg"
          onPress={handleGoogleLogin}
          startContent={<Icon icon="flat-color-icons:google" className="w-6 h-6" />}
          className="bg-white text-gray-800 hover:bg-gray-200"
        >
          Login with Google
        </Button>
      </div>
    </div>
  );
};

export default LoginPage;