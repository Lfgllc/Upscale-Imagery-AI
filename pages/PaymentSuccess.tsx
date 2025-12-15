import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StorageService } from '../services/storageService';
import { PLANS } from '../types';

export const PaymentSuccess: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'PROCESSING' | 'SUCCESS' | 'ERROR'>('PROCESSING');

  useEffect(() => {
    const processPaymentReturn = async () => {
      // Logic: Retrieve the pending transaction that was saved before leaving
      const pendingTxn = StorageService.getPendingTransaction();

      if (!pendingTxn) {
        // If they just navigated here manually without buying
        setStatus('ERROR');
        return;
      }

      try {
        // Create a record of the transaction
        const plan = PLANS.find(p => p.id === pendingTxn.planId);
        
        if (plan) {
            const transaction = {
                id: `txn_stripe_${Date.now()}`,
                date: Date.now(),
                amount: plan.price,
                description: plan.isSubscription ? `Subscription: ${plan.name}` : `One-Time: ${plan.name}`,
                status: 'SUCCESS' as const,
                paymentMethod: 'Stripe Checkout'
            };

            // Update User
            StorageService.finalizePurchase(transaction, pendingTxn.planId);
            
            // If this was an image unlock
            if (pendingTxn.imageId) {
                StorageService.updateImage(pendingTxn.imageId, { isUnlocked: true });
            }
        }

        setStatus('SUCCESS');
        
        // Clean up
        StorageService.clearPendingTransaction();
        
        // Redirect after delay
        setTimeout(() => {
            navigate('/dashboard');
        }, 3000);

      } catch (error) {
        console.error(error);
        setStatus('ERROR');
      }
    };

    processPaymentReturn();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-lg text-center">
        {status === 'PROCESSING' && (
          <>
             <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-6">
                <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
             </div>
             <h2 className="text-2xl font-bold text-navy-900 mb-2">Finalizing Payment...</h2>
             <p className="text-slate-500">Please wait while we confirm your transaction.</p>
          </>
        )}

        {status === 'SUCCESS' && (
          <>
             <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
                <svg className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
             </div>
             <h2 className="text-2xl font-bold text-navy-900 mb-2">Payment Successful!</h2>
             <p className="text-slate-500 mb-6">Your credits have been added and your plan updated.</p>
             <button onClick={() => navigate('/dashboard')} className="w-full bg-navy-800 text-white py-3 rounded font-medium hover:bg-navy-900">
                 Go to Dashboard
             </button>
          </>
        )}

        {status === 'ERROR' && (
          <>
             <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-6">
                <svg className="h-10 w-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
             </div>
             <h2 className="text-2xl font-bold text-navy-900 mb-2">Action Required</h2>
             <p className="text-slate-500 mb-6">We couldn't find a pending transaction. If you just paid, check your dashboard or contact support.</p>
             <button onClick={() => navigate('/dashboard')} className="w-full border border-navy-800 text-navy-800 py-3 rounded font-medium hover:bg-slate-50">
                 Return to Dashboard
             </button>
          </>
        )}
      </div>
    </div>
  );
};