"use client";

import { ConvexReactClient } from "convex/react";
import { ReactNode, useEffect, useState, useCallback } from "react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ClerkProvider, useAuth, useUser } from "@clerk/nextjs";
import { FullScreenLoader } from "./FullScreenLoader";

// Initialize Convex client with the URL
const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function AuthProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useUser();
  const { getToken } = useAuth();
  const [isReady, setIsReady] = useState(false);
  
  // Debug logs for authentication state
  useEffect(() => {
    console.log('Auth state updated:', { isLoaded, isSignedIn, isReady });
  }, [isLoaded, isSignedIn, isReady]);

  // Memoize the token fetcher to prevent unnecessary re-renders
  const fetchToken = useCallback(async () => {
    if (!isLoaded) {
      console.log('Clerk not loaded yet, returning empty token');
      return "";
    }
    
    try {
      console.log('Attempting to get token from Clerk with template "convex"');
      // Get the token with the 'convex' template
      const token = await getToken({ template: "convex" });
      
      if (!token) {
        console.error('No token received from Clerk');
        return "";
      }
      
      // Log token information (safely)
      console.log('Successfully got token from Clerk');
      console.log('Token starts with:', token.substring(0, 10) + '...');
      
      // Try to decode the token to see what's in it
      try {
        const tokenParts = token.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(atob(tokenParts[1]));
          console.log('Token payload:', payload);
        }
      } catch (decodeError) {
        console.error('Error decoding token:', decodeError);
      }
      
      return token;
    } catch (error) {
      console.error("Error getting auth token:", error);
      return "";
    }
  }, [getToken, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;

    const setupAuth = async () => {
      try {
        if (isSignedIn) {
          // Set up the token fetcher
          await convex.setAuth(fetchToken);
          
          // Force a token refresh
          await fetchToken();
          
          // Mark as ready after successful auth setup
          setIsReady(true);
        } else {
          // Clear auth when user signs out
          await convex.clearAuth();
          setIsReady(false);
        }
      } catch (error) {
        console.error("Error in Convex auth setup:", error);
        setIsReady(false);
      }
    };

    setupAuth();
  }, [isLoaded, isSignedIn, fetchToken]);

  if (!isLoaded || !isReady) {
    return <FullScreenLoader label="Loading authentication..." />;
  }

  return <>{children}</>;
}

export function ConvexClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  // Ensure we have the required environment variables
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  
  console.log('Initializing ConvexClientProvider');
  console.log('Convex URL available:', !!convexUrl);
  console.log('Clerk key available:', !!clerkKey);
  
  if (!clerkKey || !convexUrl) {
    console.error('Missing required environment variables');
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="p-4 bg-white rounded shadow">
          <h1 className="text-red-500 font-bold text-xl mb-2">Configuration Error</h1>
          <p>Missing required environment variables. Check your .env.local file.</p>
        </div>
      </div>
    );
  }
  
  return (
    <ClerkProvider publishableKey={clerkKey}>
      <AuthProvider>
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          {children}
        </ConvexProviderWithClerk>
      </AuthProvider>
    </ClerkProvider>
  );
}