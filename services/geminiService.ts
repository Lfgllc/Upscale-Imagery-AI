import { supabase } from './supabaseClient';

export const GeminiService = {
  /**
   * Generates a transformed image by calling the secure backend API.
   * Works for both Authenticated Users and Guests.
   */
  transformImage: async (
    imageBase64: string,
    userPrompt: string
  ): Promise<string> => {
    
    try {
      // 1. Try to get current session token
      const { data: { session } } = await supabase.auth.getSession();
      
      const headers: any = {
        'Content-Type': 'application/json'
      };

      // Only attach token if logged in
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token.trim()}`;
      }

      // 2. Call Backend
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
            imageBase64,
            prompt: userPrompt
        })
      });

      // 3. Robust Response Handling
      // We attempt to parse JSON regardless of status code to get the error message
      let data: any = null;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        try {
            data = await response.json();
        } catch (e) {
            console.warn("Failed to parse JSON error response", e);
        }
      } else {
        // Handle HTML responses (often Vercel 500/504 pages)
        const text = await response.text();
        console.error("Non-JSON response from server:", text);
        
        if (response.status === 413) throw new Error("Image too large (Server Limit).");
        if (response.status === 504) throw new Error("Server timeout. Try a smaller image.");
        if (response.status === 500) throw new Error("Internal Server Error (Infrastructure).");
        throw new Error(`Server returned unexpected format: ${response.status}`);
      }

      if (!response.ok) {
        // Throw the specific error message from the server if available
        const errorMessage = data?.error || `Request failed with status ${response.status}`;
        throw new Error(errorMessage);
      }

      if (data && data.success && data.image) {
          return data.image;
      } else {
          throw new Error("Server returned success but missing image data.");
      }

    } catch (error: any) {
      console.error("Gemini Service Error:", error);
      // Ensure the error message is clean for the UI
      throw new Error(error.message || "Failed to connect to image generation server.");
    }
  }
};