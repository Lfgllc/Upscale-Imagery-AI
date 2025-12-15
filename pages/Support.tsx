import React, { useState } from 'react';
import { StorageService } from '../services/storageService';
import { PlanTier } from '../types';

export const Support: React.FC = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    tier: 'GUEST',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);

  // Auto-fill if user logged in
  React.useEffect(() => {
    const user = StorageService.getUser();
    if (user.isAuthenticated) {
      setFormData(prev => ({
        ...prev,
        firstName: user.name.split(' ')[0],
        lastName: user.name.split(' ')[1] || '',
        email: user.email,
        tier: user.plan
      }));
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const user = StorageService.getUser();
    
    // Create Ticket
    StorageService.createTicket({
      userId: user.isAuthenticated ? user.id : null,
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      tier: formData.tier as PlanTier | 'GUEST',
      message: formData.message
    });

    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-slate-50 px-4">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-navy-900 mb-2">Message Received</h2>
          <p className="text-slate-600 mb-6">Thanks for contacting Upscale Imagery AI. Our support team will get back to you shortly at {formData.email}.</p>
          <button 
            onClick={() => setSubmitted(false)}
            className="text-camel-600 font-medium hover:text-camel-700 underline"
          >
            Send another message
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6 bg-navy-900">
          <h3 className="text-lg leading-6 font-medium text-white">Contact Support</h3>
          <p className="mt-1 max-w-2xl text-sm text-slate-300">We're here to help with your generated images and account.</p>
        </div>
        <div className="border-t border-slate-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700">First Name</label>
                <input
                  type="text"
                  name="firstName"
                  required
                  value={formData.firstName}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-camel-500 focus:border-camel-500 sm:text-sm bg-white text-slate-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Last Name</label>
                <input
                  type="text"
                  name="lastName"
                  required
                  value={formData.lastName}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-camel-500 focus:border-camel-500 sm:text-sm bg-white text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700">Email Address</label>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-camel-500 focus:border-camel-500 sm:text-sm bg-white text-slate-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Subscription Tier</label>
                <select
                  name="tier"
                  value={formData.tier}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-camel-500 focus:border-camel-500 sm:text-sm bg-white text-slate-900"
                >
                  <option value="GUEST">None / Guest</option>
                  <option value="NONE">One-Time User</option>
                  <option value="BASIC">Basic</option>
                  <option value="PRO">Pro</option>
                  <option value="ELITE">Elite</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Message</label>
              <textarea
                name="message"
                rows={4}
                required
                value={formData.message}
                onChange={handleChange}
                className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-camel-500 focus:border-camel-500 sm:text-sm bg-white text-slate-900"
                placeholder="How can we help you?"
              ></textarea>
            </div>

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-camel-600 hover:bg-camel-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-camel-500"
              >
                Submit Request
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};