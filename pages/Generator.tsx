import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { StorageService } from '../services/storageService';
import { GeminiService } from '../services/geminiService';
import { User, ImageRecord, PlanTier, PLANS } from '../types';

export const Generator: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State
  const [user, setUser] = useState<User>(StorageService.getUser());
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [currentImageId, setCurrentImageId] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) {
        setError("File size must be under 4MB");
        return;
      }
      setSelectedFile(file);
      setError(null);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!previewUrl || !prompt) {
      setError("Please provide an image and a prompt.");
      return;
    }

    // --- PRE-CHECK: Free vs Paid ---
    // Note: The server performs the hard check. This is just for UI feedback.
    let isFreePreview = false;

    if (user.credits <= 0 && user.plan === PlanTier.NONE) {
        if (!user.hasUsedFreeGen) {
            isFreePreview = true;
        } else {
            if (!user.isAuthenticated) {
              setError("Free preview used. Please sign up or log in to continue.");
            } else {
              setError("You have used your free preview. Please upgrade to continue generating.");
              setShowPaymentModal(true);
            }
            return;
        }
    }

    setIsGenerating(true);
    setError(null);

    try {
      // 1. CALL SERVER (Server deducts credit automatically)
      const resultBase64 = await GeminiService.transformImage(previewUrl, prompt);
      
      setGeneratedImage(resultBase64);
      StorageService.logEvent({ type: 'GENERATION_SUCCESS', timestamp: Date.now() });
      
      // 2. SYNC STATE
      // We immediately re-fetch the user profile from Supabase to get the updated credit count
      // because the server just deducted it.
      const updatedUser = await StorageService.syncUser();
      setUser(updatedUser);

      // 3. SAVE IMAGE RECORD
      // Start with a local temp record
      const tempRecord: ImageRecord = {
        id: Date.now().toString(),
        userId: user.isAuthenticated ? user.id : 'guest',
        originalImageBase64: previewUrl,
        generatedImageBase64: resultBase64,
        prompt: prompt,
        timestamp: Date.now(),
        // If they had credits (and thus server succeeded), it's unlocked.
        // If it was a free preview logic (client side override), we keep it locked/watermarked until they pay.
        isUnlocked: !isFreePreview, 
        isFreePreview: isFreePreview
      };

      const savedRecord = await StorageService.saveImage(tempRecord);
      setCurrentImageId(savedRecord.id);

      if (isFreePreview) {
          // If this was the "Free Preview", mark it used locally
          const u = StorageService.recordFreeUsage();
          setUser(u);
      }

    } catch (err: any) {
      setError(err.message || "Transformation failed. Please try a different prompt.");
      
      // Handle "Insufficient Credits" specifically
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
  const isFreePreviewMode = currentRecord?.isFreePreview && !isUnlocked;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      
      {!user.isAuthenticated && (
        <div className="bg-camel-50 border border-camel-200 p-4 rounded-lg mb-6 flex justify-between items-center">
          <div>
            <p className="text-navy-900 font-bold">Guest Mode</p>
            <p className="text-sm text-slate-600">You are using your free preview. Sign up to save your work. By generating, you agree to our Terms.</p>
          </div>
          <button onClick={() => navigate('/signup')} className="text-sm font-bold text-camel-600 hover:text-camel-800">
            Sign Up &rarr;
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        
        {/* Input Column */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <h2 className="text-lg font-medium text-navy-900 mb-4">1. Upload Source Image</h2>
            <div 
              className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${previewUrl ? 'border-camel-500 bg-tan-100' : 'border-slate-300 hover:border-slate-400 bg-white'}`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/jpeg, image/png" 
                onChange={handleFileChange}
              />
              {previewUrl ? (
                <img src={previewUrl} alt="Preview" className="max-h-64 mx-auto rounded shadow-sm" />
              ) : (
                <div className="space-y-2">
                  <svg className="mx-auto h-12 w-12 text-slate-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <p className="text-sm text-slate-600">Click to upload or drag and drop</p>
                  <p className="text-xs text-slate-500">PNG, JPG up to 4MB</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-4">
               <h2 className="text-lg font-medium text-navy-900">2. Describe Transformation</h2>
               {!user.hasUsedFreeGen && user.credits === 0 && (
                   <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded">Free Preview Available</span>
               )}
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
            disabled={isGenerating || !previewUrl || !prompt}
            className={`w-full py-4 px-6 border border-transparent rounded-md shadow-sm text-lg font-medium text-white 
              ${isGenerating || !previewUrl || !prompt ? 'bg-slate-400 cursor-not-allowed' : 'bg-camel-600 hover:bg-camel-700'}`}
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
                    {(!user.hasUsedFreeGen && user.credits === 0) ? "Generate Free Preview" : "Generate Transformation"}
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
                        {isUnlocked ? 'Image Unlocked' : (isFreePreviewMode ? 'Free Preview' : 'Preview Mode')}
                    </p>
                    <p className="text-xs text-slate-500">
                        {isUnlocked ? 'Ready for download' : (user.isAuthenticated ? 'Purchase to remove watermark' : 'Sign up to unlock')}
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
