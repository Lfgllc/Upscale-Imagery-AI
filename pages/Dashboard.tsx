import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StorageService } from '../services/storageService';
import { User, ImageRecord, PLANS, PlanTier } from '../types';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User>(StorageService.getUser());
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [loadingImages, setLoadingImages] = useState(true);
  
  // Subscription Payment State
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanTier | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    // Check if user is authenticated locally first
    const currentUser = StorageService.getUser();
    if (!currentUser.isAuthenticated) {
      navigate('/login');
      return;
    }
    setUser(currentUser);

    // Fetch images from Supabase
    const loadData = async () => {
        setLoadingImages(true);
        try {
            // Also sync user details to get latest credits
            const updatedUser = await StorageService.syncUser();
            setUser(updatedUser);
            
            const fetchedImages = await StorageService.fetchImages();
            setImages(fetchedImages);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingImages(false);
        }
    };
    loadData();
  }, [navigate]);

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this image?")) {
      await StorageService.deleteImage(id);
      setImages(prev => prev.filter(img => img.id !== id));
    }
  };

  const handleSelectPlan = (planId: PlanTier) => {
    setSelectedPlan(planId);
    setShowSubscriptionModal(true);
  };

  const handleCancelSubscription = () => {
      if (window.confirm("Cancel subscription?")) {
          // Mock cancel for now
          alert("Please contact support to cancel subscription.");
      }
  };

  const handleProceedToStripe = () => {
    if (!selectedPlan) return;
    const plan = PLANS.find(p => p.id === selectedPlan);
    if (!plan || !plan.paymentLink) return;
    
    setIsRedirecting(true);
    StorageService.setPendingTransaction(selectedPlan);

    // Redirect to Stripe with prefilled email and client tracking
    const separator = plan.paymentLink.includes('?') ? '&' : '?';
    const params = new URLSearchParams();
    params.append('prefilled_email', user.email);
    params.append('client_reference_id', user.id); // Track which user is subscribing

    const finalLink = `${plan.paymentLink}${separator}${params.toString()}`;
    
    window.location.href = finalLink;
  };

  const currentPlanDetails = PLANS.find(p => p.id === user.plan);
  const subscriptionPlans = PLANS.filter(p => p.isSubscription);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Welcome back, {user.name}</h1>
          <p className="text-slate-500">Manage your generations and subscription.</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex items-center gap-6">
          <div>
            <p className="text-sm text-slate-500 uppercase tracking-wide font-semibold">Credits</p>
            <p className="text-3xl font-bold text-camel-600">{user.credits}</p>
          </div>
          <button 
            onClick={() => navigate('/generate')}
            className="bg-navy-800 text-white px-6 py-3 rounded-md font-medium hover:bg-navy-900 transition-colors"
          >
            New Generation
          </button>
        </div>
      </div>

      {/* Subscription Section */}
      <div className="mb-12">
        <h2 className="text-xl font-bold text-navy-800 mb-6 border-b border-slate-200 pb-2">Manage Subscription</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {subscriptionPlans.map((plan) => {
            const isCurrent = user.plan === plan.id;
            return (
              <div 
                key={plan.id} 
                className={`relative rounded-lg border ${isCurrent ? 'border-camel-500 bg-camel-50 ring-1 ring-camel-500' : 'border-slate-200 bg-white'} p-6 shadow-sm flex flex-col`}
              >
                {isCurrent && (
                  <div className="absolute top-0 right-0 bg-camel-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                    CURRENT PLAN
                  </div>
                )}
                <div className="flex-grow">
                  <h3 className="text-lg font-bold text-navy-900">{plan.name}</h3>
                  <div className="mt-2 flex items-baseline">
                    <span className="text-2xl font-extrabold text-navy-900">${plan.price}</span>
                    <span className="ml-1 text-slate-500">/mo</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">{plan.credits} Credits/mo</p>
                </div>
                <div className="mt-6">
                  {isCurrent ? (
                    <button disabled className="w-full bg-slate-200 text-slate-500 px-4 py-2 rounded font-medium cursor-default">
                        Active
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleSelectPlan(plan.id)}
                      className="w-full bg-white border border-navy-800 text-navy-800 hover:bg-navy-50 px-4 py-2 rounded font-medium transition-colors"
                    >
                      {plan.price > (currentPlanDetails?.price || 0) ? 'Upgrade' : 'Downgrade'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <h2 className="text-xl font-bold text-navy-800 mb-6 border-b border-slate-200 pb-2">Recent Transformations</h2>

      {loadingImages ? (
          <div className="flex justify-center py-10">
              <svg className="animate-spin h-8 w-8 text-navy-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
          </div>
      ) : images.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-lg border border-dashed border-slate-300">
          <p className="text-slate-500">No images found. Create your first one!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {images.map((img) => (
            <div key={img.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm relative group">
              <button 
                onClick={() => handleDelete(img.id)}
                className="absolute top-2 right-2 z-40 bg-white p-1 rounded-full text-slate-400 hover:text-red-600 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Delete image"
              >
                 <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                 </svg>
              </button>
              
              {/* Image Container with Aspect Ratio Optimization */}
              <div className="aspect-square w-full bg-slate-100 relative overflow-hidden">
                <img 
                  src={img.generatedImageBase64 || img.originalImageBase64} 
                  alt={img.prompt || "Generated Image"} 
                  loading="lazy"
                  decoding="async"
                  className={`absolute inset-0 w-full h-full object-cover transition-all duration-300 ${!img.isUnlocked ? 'blur-[2px]' : ''}`}
                />
                {!img.isUnlocked && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/10 watermarked-grid watermarked select-none z-20">
                    <span className="bg-white/90 text-navy-900 px-3 py-1 rounded text-xs font-bold shadow-sm z-30">LOCKED</span>
                  </div>
                )}
              </div>
              
              <div className="p-4">
                <p className="text-xs text-slate-500 mb-1">{new Date(img.timestamp).toLocaleDateString()}</p>
                <p className="text-sm font-medium text-navy-900 line-clamp-2" title={img.prompt}>{img.prompt}</p>
                <div className="mt-4 flex justify-between items-center">
                  {img.isUnlocked ? (
                     <a 
                       href={img.generatedImageBase64 || '#'} 
                       download={`upscale-ai-${img.id}.jpg`}
                       className="text-camel-600 text-sm font-medium hover:text-camel-700"
                     >
                       Download HD
                     </a>
                  ) : (
                    <span className="text-xs text-slate-400 italic">Watermarked</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Subscription Redirect Modal */}
      {showSubscriptionModal && selectedPlan && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => !isRedirecting && setShowSubscriptionModal(false)}></div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg font-bold">Secure Checkout</h3>
                  <p className="mt-2 text-sm text-gray-500">Redirecting to Stripe...</p>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button 
                    onClick={handleProceedToStripe}
                    disabled={isRedirecting}
                    className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-camel-600 text-base font-medium text-white hover:bg-camel-700 sm:ml-3 sm:w-auto sm:text-sm ${isRedirecting ? 'opacity-75 cursor-wait' : ''}`}
                >
                  {isRedirecting ? 'Redirecting...' : 'Proceed'}
                </button>
                <button 
                    onClick={() => setShowSubscriptionModal(false)}
                    disabled={isRedirecting}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
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