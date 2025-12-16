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
      // SAFARI FIX: Ensure token is trimmed to prevent "The string did not match the expected pattern" in Headers
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

      // SAFARI FIX: Check Content-Type before parsing JSON. 
      // Vercel may return HTML (413/500) which causes JSON.parse to throw "The string did not match the expected pattern" in Safari.
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          
          if (!response.ok) {
              throw new Error(data.error || `Server Error: ${response.status}`);
          }

          if (data.success && data.image) {
              return data.image;
          } else {
              throw new Error("Server returned success but no image data.");
          }
      } else {
          // Handle non-JSON response (e.g. HTML 500/413 error page)
          const text = await response.text();
          // Log the raw text for debugging but throw a clean error
          console.error("Non-JSON Response:", text);
          throw new Error(`Server returned unexpected format (${response.status}). Please try a smaller image.`);
      }

    } catch (error: any) {
      console.error("Gemini Service Error:", error);
      throw new Error(error.message || "Failed to connect to image generation server.");
    }
  }
};