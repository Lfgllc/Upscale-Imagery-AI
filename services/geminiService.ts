// This service communicates with the secure backend /api/generate endpoint
import { supabase } from './supabaseClient';

export const GeminiService = {
  /**
   * Generates a transformed image by calling the secure backend API.
   * Includes the User's JWT token for security and billing.
   */
  transformImage: async (
    imageBase64: string,
    userPrompt: string
  ): Promise<string> => {
    
    try {
      // 1. Get current session token to prove identity to server
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("You must be logged in to generate images.");
      }

      // 2. Call Backend
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}` // PASS TOKEN
        },
        body: JSON.stringify({
            imageBase64,
            prompt: userPrompt
        })
      });

      if (!response.ok) {
          const errorData = await response.json();
          // Pass specific error (e.g., "Insufficient credits") to UI
          throw new Error(errorData.error || `Server Error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.image) {
          return data.image;
      } else {
          throw new Error("Server returned success but no image data.");
      }

    } catch (error: any) {
      console.error("Gemini Service Error:", error);
      throw new Error(error.message || "Failed to connect to image generation server.");
    }
  }
};