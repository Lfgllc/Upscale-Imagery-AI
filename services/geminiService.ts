import { GoogleGenAI } from "@google/genai";

// We use the Gemini 2.5 Flash Image model for transformations
// or Gemini 3 Pro Image Preview if high fidelity is needed, but Flash Image is standard.
const MODEL_NAME = 'gemini-2.5-flash-image';

export const GeminiService = {
  /**
   * Generates a transformed image based on the input image and prompt.
   * Enforces strict safety and identity preservation.
   */
  transformImage: async (
    imageBase64: string,
    userPrompt: string
  ): Promise<string> => {
    // API Key is strictly from process.env.API_KEY
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Clean the base64 string if it contains metadata
    const cleanBase64 = imageBase64.split(',')[1] || imageBase64;

    const systemPrompt = `
      TASK: You are a professional photo editor for a high-end SaaS platform.
      
      INPUT: An image of a person and a user request.
      
      STRICT GUIDELINES:
      1. PRESERVE IDENTITY: The face, facial structure, and recognizable features of the person in the input image MUST remain exactly the same. Do not generate a new random person.
      2. MODIFICATION: Only modify the hairstyle, clothing, background, or lighting as requested.
      3. REALISM: The output must be photorealistic, high-quality, and professional.
      4. SAFETY: Do NOT generate nudity, NSFW content, body distortions, gore, or illegal content. If the request implies this, return a polite refusal in the image or a neutral image.
      5. STYLE: Keep it premium, clean, and flattering.
      
      USER REQUEST: ${userPrompt}
    `;

    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: {
            parts: [
                { text: systemPrompt },
                {
                    inlineData: {
                        mimeType: 'image/jpeg',
                        data: cleanBase64
                    }
                }
            ]
        }
      });

      // Extract image from response
      // Gemini returns generated images in the response parts
      const parts = response.candidates?.[0]?.content?.parts;
      
      if (!parts) throw new Error("No content generated");

      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:image/jpeg;base64,${part.inlineData.data}`;
        }
      }
      
      throw new Error("No image data found in response. The model might have refused the request due to safety policies.");

    } catch (error: any) {
      console.error("Gemini Generation Error:", error);
      throw new Error(error.message || "Failed to generate image");
    }
  }
};