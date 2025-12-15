import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StorageService } from '../services/storageService';
import { User, ImageRecord, PLANS, PlanTier } from '../types';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User>(StorageService.getUser());
  const [images, setImages] = useState<ImageRecord[]>([]);
  
  // Subscription Payment State
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanTier | null>(null);

  React.useEffect(() => {
    if (!user.isAuthenticated) {
      navigate('/login');
      return;
    }
    setImages(StorageService.getImages());
  }, [user, navigate]);

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this image? This action cannot be undone.")) {
      StorageService.deleteImage(id);
      setImages(StorageService.getImages());
    }
  };

  const handleSelectPlan = (planId: PlanTier) => {
    setSelectedPlan(planId);
    setShowSubscriptionModal(true);
  };

  const handleCancelSubscription = () => {
      if (window.confirm("Are you sure you want to cancel your subscription? You will lose access to premium benefits at the end of this billing cycle.")) {
          const updatedUser = StorageService.cancelSubscription();
          setUser(updatedUser);
          alert("Subscription cancelled. Your account is now on the One-Time plan.");
      }
  };

  const handleProceedToStripe = () => {
    if (!selectedPlan) return;
    
    const plan = PLANS.find(p => p.id === selectedPlan);
    if (!plan) return;

    if (!plan.paymentLink || plan.paymentLink.includes('PASTE_YOUR')) {
        alert("Configuration Error: The payment link has not been set up in types.ts yet.");
        return;
    }
    
    // Save the pending transaction so when they return, we know what they bought
    StorageService.setPendingTransaction(selectedPlan);

    // Redirect to the Real Stripe Link
    window.location.href = plan.paymentLink;
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
            <p className="text-sm text-slate-500 uppercase tracking-wide font-semibold">Available Edit Credits</p>
            <p className="text-3xl font-bold text-camel-600">
                {user.role === 'ADMIN' ? '∞' : user.credits}
            </p>
          </div>
          <button 
            onClick={() => navigate('/generate')}
            className="bg-navy-800 text-white px-6 py-3 rounded-md font-medium hover:bg-navy-900 transition-colors"
          >
            New Generation
          </button>
        </div>
      </div>

      {/* Data Persistence Warning */}
      <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-8 rounded-r-md shadow-sm">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-bold text-amber-800">Important: Images Stored Locally</h3>
            <p className="text-sm text-amber-700 mt-1">
              Your generated images are stored in your browser's local cache. 
              <strong> Clearing your history, cache, or switching devices will delete these images permanently.</strong> 
              Please download your favorite images to your device immediately.
            </p>
          </div>
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
                  <p className="mt-2 text-sm text-slate-500">{plan.credits} Edit Credits/mo</p>
                  <ul className="mt-4 space-y-2">
                    {plan.features.slice(0, 3).map((feature, idx) => (
                      <li key={idx} className="flex items-start text-xs text-slate-600">
                        <svg className="flex-shrink-0 h-4 w-4 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-6">
                  {isCurrent ? (
                    <div className="space-y-2">
                        <button disabled className="w-full bg-slate-200 text-slate-500 px-4 py-2 rounded font-medium cursor-default">
                        Active
                        </button>
                        <button 
                            onClick={handleCancelSubscription}
                            className="w-full text-xs text-red-500 hover:text-red-700 underline"
                        >
                            Cancel Subscription
                        </button>
                    </div>
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

      {images.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-lg border border-dashed border-slate-300">
          <svg className="mx-auto h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-slate-900">No images yet</h3>
          <p className="mt-1 text-sm text-slate-500">Get started by uploading your first photo.</p>
          <div className="mt-6">
            <button
              onClick={() => navigate('/generate')}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-camel-600 hover:bg-camel-700 focus:outline-none"
            >
              Create New Image
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {images.map((img) => (
            <div key={img.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow relative group">
              <button 
                onClick={() => handleDelete(img.id)}
                className="absolute top-2 right-2 z-40 bg-white p-1 rounded-full text-slate-400 hover:text-red-600 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete Image"
              >
                 <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                 </svg>
              </button>
              <div 
                className="aspect-w-1 aspect-h-1 w-full bg-slate-100 relative"
                onContextMenu={(e) => !img.isUnlocked && e.preventDefault()}
                style={{ WebkitTouchCallout: !img.isUnlocked ? 'none' : 'default' }}
              >
                <img 
                  src={img.generatedImageBase64 || img.originalImageBase64} 
                  alt={img.prompt} 
                  draggable={img.isUnlocked}
                  className={`object-cover w-full h-64 ${!img.isUnlocked ? 'blur-[2px] pointer-events-none' : ''}`}
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
                    <span className="text-xs text-slate-400 italic">Watermarked Preview</span>
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
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowSubscriptionModal(false)}></div>
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
                        You are switching to the <strong>{PLANS.find(p => p.id === selectedPlan)?.name}</strong> plan.
                        <br/>
                        Price: <strong>${PLANS.find(p => p.id === selectedPlan)?.price}/mo</strong>
                      </p>
                      
                      <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded border border-slate-200">
                          You will be redirected to <strong>Stripe</strong> to complete your payment securely. 
                          After payment, you will be automatically returned here.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button 
                    onClick={handleProceedToStripe}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-camel-600 text-base font-medium text-white hover:bg-camel-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Proceed to Checkout
                </button>
                <button 
                    type="button" 
                    onClick={() => setShowSubscriptionModal(false)}
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