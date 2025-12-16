import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { StorageService } from '../services/storageService';
import { GeminiService } from '../services/geminiService';
import { User, ImageRecord, PlanTier, PLANS } from '../types';
import heic2any from 'heic2any';

export const Generator: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State
  const [user, setUser] = useState<User>(StorageService.getUser());
  const [selectedFile, setSelectedFile] = useState<File | null>(null); // Kept for reference
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); // Processing state for compression
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [currentImageId, setCurrentImageId] = useState<string | null>(null);

  // --- CLIENT-SIDE IMAGE PROCESSING ---
  const processImage = async (file: File): Promise<string> => {
    // 1. Handle HEIC/HEIF Conversion
    let sourceFile = file;
    if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
      try {
        const convertedBlob = await heic2any({
          blob: file,
          toType: 'image/jpeg',
          quality: 0.8
        });
        const blobToUse = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
        sourceFile = new File([blobToUse], file.name.replace(/\.heic$/i, '.jpg'), { type: 'image/jpeg' });
      } catch (e) {
        console.warn('HEIC conversion failed, attempting legacy upload', e);
      }
    }

    return new Promise((resolve, reject) => {
      // 2. Read the file
      const reader = new FileReader();
      reader.readAsDataURL(sourceFile);
      
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        
        img.onload = () => {
          // 3. Calculate new dimensions (Max 1024x1024)
          // This ensures the Payload is < 4.5MB (Vercel Limit)
          const MAX_WIDTH = 1024;
          const MAX_HEIGHT = 1024;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          // 4. Create Canvas and Draw
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error("Browser does not support image processing."));
            return;
          }
          
          // Fill white background to handle transparency (PNG -> JPEG conversion)
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          
          // 5. Export compressed JPEG (0.8 quality)
          // This dramatically reduces file size while keeping visual quality high for AI
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          resolve(dataUrl);
        };
        
        img.onerror = () => reject(new Error("Failed to load image structure."));
      };
      
      reader.onerror = () => reject(new Error("Failed to read file."));
    });
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Reset State
      setError(null);
      setPreviewUrl(null);
      setSelectedFile(file);
      setIsProcessing(true);

      try {
        // Run Client-Side Resizing
        console.log(`Original file size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
        const optimizedBase64 = await processImage(file);
        
        // Debug: Log approximate new size
        const approximateSize = (optimizedBase64.length * 3) / 4 / 1024 / 1024;
        console.log(`Optimized size: ${approximateSize.toFixed(2)} MB`);
        
        setPreviewUrl(optimizedBase64);
      } catch (err: any) {
        console.error("Image processing error:", err);
        setError("Failed to process image. Please try a valid JPEG, PNG, or HEIC file.");
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleGenerate = async () => {
    if (!previewUrl || !prompt) {
      setError("Please provide an image and a prompt.");
      return;
    }

    // --- CHECK: Free vs Paid ---
    let isFreePreview = false;

    if (!user.isAuthenticated) {
        isFreePreview = true;
    } else if (user.credits <= 0 && user.plan === PlanTier.NONE) {
        setError("You have 0 credits. Please purchase a pack to generate.");
        setShowPaymentModal(true);
        return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // 1. CALL SERVER with Optimized Image
      const resultBase64 = await GeminiService.transformImage(previewUrl, prompt);
      
      setGeneratedImage(resultBase64);
      StorageService.logEvent({ type: 'GENERATION_SUCCESS', timestamp: Date.now() });
      
      // 2. SYNC STATE (Only if logged in)
      if (user.isAuthenticated) {
        const updatedUser = await StorageService.syncUser();
        setUser(updatedUser);
      }

      // 3. SAVE IMAGE RECORD
      const tempRecord: ImageRecord = {
        id: Date.now().toString(),
        userId: user.isAuthenticated ? user.id : 'guest',
        originalImageBase64: previewUrl,
        generatedImageBase64: resultBase64,
        prompt: prompt,
        timestamp: Date.now(),
        isUnlocked: !isFreePreview, 
        isFreePreview: isFreePreview
      };

      const savedRecord = await StorageService.saveImage(tempRecord);
      setCurrentImageId(savedRecord.id);

      if (isFreePreview) {
          const u = StorageService.recordFreeUsage();
          setUser(u);
      }

    } catch (err: any) {
      setError(err.message || "Transformation failed. Please try a different prompt.");
      if (err.message.includes("Insufficient credits")) {
          setShowPaymentModal(true);
      }
      StorageService.logEvent({ type: 'GENERATION_FAILURE', timestamp: Date.now(), details: err.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUnlockRedirect = () => {
    if (!user.isAuthenticated) {
        navigate('/signup');
        return;
    }
    if (!currentImageId) return;

    const plan = PLANS.find(p => p.id === PlanTier.NONE);
    if (!plan || !plan.paymentLink) return;

    StorageService.setPendingTransaction(PlanTier.NONE, currentImageId);
    window.location.href = plan.paymentLink;
  };

  const getCurrentRecord = () => {
      const images = StorageService.getImages();
      return images.find(i => i.id === currentImageId);
  };

  const currentRecord = getCurrentRecord();
  const isUnlocked = currentRecord?.isUnlocked || false;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      
      {!user.isAuthenticated && (
        <div className="bg-camel-50 border border-camel-200 p-4 rounded-lg mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <p className="text-navy-900 font-bold">Try for Free</p>
            <p className="text-sm text-slate-600">Generate unlimited previews. Sign up and pay to download the high-resolution, watermark-free versions.</p>
          </div>
          <button onClick={() => navigate('/signup')} className="whitespace-nowrap bg-navy-800 text-white px-4 py-2 rounded text-sm font-medium hover:bg-navy-900">
            Sign Up to Save
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        
        {/* Input Column */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <h2 className="text-lg font-medium text-navy-900 mb-4">1. Upload Source Image</h2>
            <div 
              className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors relative ${previewUrl ? 'border-camel-500 bg-tan-100' : 'border-slate-300 hover:border-slate-400 bg-white'}`}
              onClick={() => !isProcessing && fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/jpeg, image/png, image/webp, image/heic" 
                onChange={handleFileChange}
              />
              
              {isProcessing ? (
                <div className="py-10 flex flex-col items-center">
                    <svg className="animate-spin h-8 w-8 text-camel-600 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-sm text-slate-500">Optimizing image...</p>
                </div>
              ) : previewUrl ? (
                <img src={previewUrl} alt="Preview" className="max-h-64 mx-auto rounded shadow-sm" />
              ) : (
                <div className="space-y-2">
                  <svg className="mx-auto h-12 w-12 text-slate-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <p className="text-sm text-slate-600">Click to upload or drag and drop</p>
                  <p className="text-xs text-slate-500">JPG, PNG, HEIC (Auto-optimized)</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-4">
               <h2 className="text-lg font-medium text-navy-900">2. Describe Transformation</h2>
            </div>
            
            <textarea
              className="w-full border border-slate-300 rounded-md p-3 focus:ring-camel-500 focus:border-camel-500 h-32 bg-white text-navy-900"
              placeholder="E.g., Change the background to a modern office, make the lighting warmer, change the shirt to a navy blazer..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            ></textarea>
            <p className="text-xs text-slate-500 mt-2">
              Tip: Be specific about clothing and background. Facial features will be preserved automatically.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
              <strong className="font-bold">Error: </strong>
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={isGenerating || isProcessing || !previewUrl || !prompt}
            className={`w-full py-4 px-6 border border-transparent rounded-md shadow-sm text-lg font-medium text-white 
              ${isGenerating || isProcessing || !previewUrl || !prompt ? 'bg-slate-400 cursor-not-allowed' : 'bg-camel-600 hover:bg-camel-700'}`}
          >
            {isGenerating ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing Image...
              </span>
            ) : (
                <span>
                    {!user.isAuthenticated ? "Generate Free Preview (Watermarked)" : "Generate Transformation"}
                </span>
            )}
          </button>
        </div>

        {/* Output Column */}
        <div className="bg-slate-100 rounded-lg border border-slate-200 p-6 flex items-center justify-center min-h-[500px]">
          {!generatedImage ? (
            <div className="text-center text-slate-400">
              <p className="text-lg font-medium">Result will appear here</p>
              <p className="text-sm">Ready to generate</p>
            </div>
          ) : (
            <div className="w-full space-y-4">
              <div 
                className={`relative w-full rounded-lg overflow-hidden shadow-lg ${!isUnlocked ? 'watermarked watermarked-grid' : ''}`}
                onContextMenu={(e) => !isUnlocked && e.preventDefault()}
                style={{ WebkitTouchCallout: !isUnlocked ? 'none' : 'default' }}
              >
                 <img 
                   src={generatedImage} 
                   alt="Result" 
                   draggable={isUnlocked}
                   className={`w-full h-auto ${!isUnlocked ? 'pointer-events-none' : ''}`}
                 />
                 {!isUnlocked && (
                    <div className="absolute inset-0 bg-black/10 z-20"></div>
                 )}
              </div>
              
              <div className="flex justify-between items-center bg-white p-4 rounded border border-slate-200">
                <div>
                    <p className="text-sm font-bold text-navy-900">
                        {isUnlocked ? 'Image Unlocked' : 'Free Preview Mode'}
                    </p>
                    <p className="text-xs text-slate-500">
                        {isUnlocked ? 'Ready for download' : (user.isAuthenticated ? 'Purchase to remove watermark' : 'Log in & Pay to download')}
                    </p>
                </div>
                {isUnlocked ? (
                    <a 
                      href={generatedImage} 
                      download={`upscale-img-${Date.now()}.jpg`}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
                    >
                      Download HD
                    </a>
                ) : (
                    <button 
                      onClick={!user.isAuthenticated ? () => navigate('/signup') : () => setShowPaymentModal(true)}
                      className="bg-navy-800 hover:bg-navy-900 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
                    >
                      {!user.isAuthenticated ? 'Sign Up to Unlock' : 'Unlock ($3.99)'}
                    </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payment Redirect Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowPaymentModal(false)}></div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-camel-100 sm:mx-0 sm:h-10 sm:w-10">
                    <svg className="h-6 w-6 text-camel-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                      Proceed to Secure Checkout
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500 mb-4">
                        Unlock this image without watermarks and get 5 credits.
                      </p>
                      <div className="bg-slate-50 p-3 rounded mb-4 border border-slate-200">
                          <div className="flex justify-between mb-1">
                            <span className="text-sm text-navy-900 font-medium">Single Image Pack</span>
                            <span className="text-sm text-navy-900 font-bold">$3.99</span>
                          </div>
                      </div>
                      <p className="text-sm text-slate-600">
                          You will be redirected to <strong>Stripe</strong> to complete your payment securely. 
                          After payment, you will be automatically returned here to download your image.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button 
                    onClick={handleUnlockRedirect}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-navy-800 text-base font-medium text-white hover:bg-navy-900 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Pay & Unlock
                </button>
                <button 
                    type="button" 
                    onClick={() => setShowPaymentModal(false)}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};