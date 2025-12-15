import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PLANS, PlanTier } from '../types';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [imgErrors, setImgErrors] = useState({
    beforeAfter: false,
    creator: false
  });

  return (
    <div className="bg-slate-50">
      {/* Hero Section */}
      <div className="relative bg-navy-900 overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[url('https://picsum.photos/1920/1080')] bg-cover bg-center mix-blend-overlay"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 relative z-10">
          <div className="text-center">
            <h1 className="text-4xl tracking-tight font-extrabold text-white sm:text-5xl md:text-6xl">
              <span className="block">Transform Your Look</span>
              <span className="block text-camel-500">Keep Your Identity</span>
            </h1>
            <p className="mt-3 max-w-md mx-auto text-base text-slate-300 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
              Professional headshots, wardrobe changes, and style upgrades using advanced AI. 
              We strictly preserve your facial features while transforming everything else.
            </p>
            <div className="mt-10 max-w-sm mx-auto sm:max-w-none sm:flex sm:justify-center gap-4">
              <button 
                onClick={() => navigate('/signup')}
                className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-camel-600 hover:bg-camel-700 md:py-4 md:text-lg md:px-10 transition-all shadow-lg hover:shadow-camel-500/20"
              >
                Get Started
              </button>
              <button 
                onClick={() => navigate('/login')}
                className="w-full flex items-center justify-center px-8 py-3 border border-slate-500 text-base font-medium rounded-md text-slate-200 hover:bg-navy-800 md:py-4 md:text-lg md:px-10 transition-all"
              >
                Login
              </button>
            </div>
             <p className="mt-4 text-xs text-slate-400">Join thousands of professionals upgrading their image today.</p>
          </div>
        </div>
      </div>

      {/* Free Generation Promo */}
      <div className="bg-camel-50 border-b border-camel-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <span className="inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium bg-camel-100 text-camel-800 mb-2">
              New Users Only
            </span>
            <h2 className="text-2xl font-extrabold text-navy-900">Generate Your First Image Free</h2>
            <p className="mt-2 text-slate-600 max-w-xl">
              Try one AI-generated preview to see how Upscale Imagery AI works. 
              <br/>
              <span className="text-xs italic text-slate-500">* Free generations include a watermark and are for preview only. No login required.</span>
            </p>
          </div>
          <button 
            onClick={() => navigate('/generate')}
            className="flex-shrink-0 bg-navy-900 text-white px-6 py-3 rounded-md font-bold hover:bg-navy-800 transition-colors shadow-md"
          >
            Generate Free Preview
          </button>
        </div>
      </div>

      {/* Feature Section */}
      <div className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:text-center mb-16">
            <h2 className="text-base text-camel-600 font-semibold tracking-wide uppercase">Why Upscale?</h2>
            <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-navy-900 sm:text-4xl">
              Professional Results, Zero Hassle
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              { title: "Identity Protection", desc: "Our AI is tuned to lock onto facial features, ensuring you still look like you." },
              { title: "Strict Safety", desc: "Enterprise-grade filters prevent misuse, deepfakes, and NSFW content generation." },
              { title: "High Resolution", desc: "Download crisp, professional-grade images suitable for LinkedIn, websites, and print." }
            ].map((feature, idx) => (
              <div key={idx} className="p-6 bg-tan-100 rounded-xl border border-tan-200">
                <h3 className="text-lg font-bold text-navy-800 mb-2">{feature.title}</h3>
                <p className="text-slate-600">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Before & After Section */}
      <div className="py-16 bg-slate-50 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-extrabold text-navy-900 mb-8">See the Transformation</h2>
          
          <div className="relative rounded-xl overflow-hidden shadow-2xl border-4 border-white max-w-5xl mx-auto bg-slate-200 min-h-[300px]">
            {!imgErrors.beforeAfter ? (
                <img 
                  src="/before-after.jpg" 
                  alt="Before and After Transformation" 
                  className="w-full h-auto object-cover"
                  onError={() => setImgErrors(prev => ({...prev, beforeAfter: true}))}
                />
            ) : (
                <div className="flex flex-col items-center justify-center h-64 bg-slate-200 text-slate-500 p-8">
                    <svg className="h-12 w-12 mb-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="font-bold">Image Not Found</p>
                    <p className="text-sm mt-2">
                        Please upload <code>before-after.jpg</code> to your project's <strong>public/</strong> folder and redeploy.
                    </p>
                </div>
            )}
          </div>
          <p className="mt-4 text-slate-500 italic">Actual results generated by Upscale Imagery AI</p>
        </div>
      </div>

      {/* Message From Creator Section */}
      <div className="py-20 bg-white border-t border-slate-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center">
            
            {/* Image Container */}
            <div className="relative mb-10 group">
              {/* Backglow adjusted for square shape */}
              <div className="absolute -inset-4 bg-camel-200 rounded-2xl blur-2xl opacity-40 group-hover:opacity-60 transition-opacity duration-500"></div>
              
              {!imgErrors.creator ? (
                  <img 
                    src="/creator.jpg"
                    alt="Chasity Willis" 
                    className="relative w-72 h-72 sm:w-96 sm:h-96 aspect-square rounded-lg object-cover shadow-2xl border-4 border-white z-10"
                    onError={() => setImgErrors(prev => ({...prev, creator: true}))}
                  />
              ) : (
                   <div className="relative w-72 h-72 sm:w-96 sm:h-96 aspect-square rounded-lg bg-navy-900 border-4 border-white z-10 flex flex-col items-center justify-center text-center p-6 shadow-2xl">
                        <div className="w-20 h-20 bg-camel-500 rounded-full flex items-center justify-center text-3xl font-bold text-white mb-4">CW</div>
                        <p className="text-white font-bold">Chasity Willis</p>
                        <p className="text-camel-200 text-xs mt-2">Creator</p>
                   </div>
              )}
            </div>

            {/* Message Card */}
            <div className="relative bg-tan-100/30 rounded-2xl p-8 md:p-12 shadow-sm border border-tan-200 text-center">
              <div className="absolute top-0 left-0 -mt-6 -ml-4 text-6xl text-camel-300 opacity-50 font-serif">"</div>
              
              <h2 className="text-2xl font-bold text-navy-900 mb-8 font-serif tracking-wide">A Message from the Creator</h2>
              
              <div className="space-y-6 text-lg text-slate-700 leading-relaxed font-light">
                <p>Upscale Imagery AI was created for entrepreneurs who show up online and want to do so with confidence and professionalism without feeling artificial or misrepresented.</p>
                <p>I know firsthand how difficult it can be to find tools you actually feel comfortable using, especially when it comes to something as personal as your image. I needed a way to look polished and credible without the time, cost, or pressure of traditional photo shoots and without it feeling unnatural.</p>
                <p>This platform started as something I built for myself. As I continued working on it, I realized I was not alone. There are entrepreneurs and business owners who want images that reflect their credibility and authority but still feel real and aligned with their brand.</p>
                <p>The heart behind Upscale Imagery AI is simple: to create something honest, accessible, and genuinely helpful. A tool that allows you to show up as yourself, just presented in a more professional and elevated way.</p>
                <p>This site was built with intention for people who care about showing up confidently and authentically.</p>
              </div>

              <div className="mt-10 flex flex-col items-center justify-center">
                <div className="w-16 h-1 bg-camel-500 rounded-full mb-4"></div>
                <span className="text-xl font-bold text-navy-900 font-serif italic">- Chasity @itschasnicole</span>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div className="py-16 bg-slate-50" id="pricing">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-navy-900">Simple, Transparent Pricing</h2>
            <p className="mt-4 text-lg text-slate-500">Choose a subscription or pay as you go to unlock high-res downloads.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Free Tier Card */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 hover:border-camel-500 transition-colors flex flex-col overflow-hidden opacity-80">
                <div className="p-6 flex-grow">
                  <h3 className="text-xl font-bold text-slate-600">Free Preview</h3>
                  <div className="mt-4 flex items-baseline">
                    <span className="text-3xl font-extrabold text-slate-900">$0</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-500 font-medium">Try before you buy</p>
                  <ul className="mt-6 space-y-4">
                    <li className="flex items-start">
                        <svg className="flex-shrink-0 h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        <span className="ml-3 text-sm text-slate-600">1 Generated Image</span>
                    </li>
                    <li className="flex items-start">
                        <svg className="flex-shrink-0 h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        <span className="ml-3 text-sm text-slate-600">Watermarked</span>
                    </li>
                    <li className="flex items-start">
                        <svg className="flex-shrink-0 h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        <span className="ml-3 text-sm text-slate-600">No Download</span>
                    </li>
                  </ul>
                </div>
            </div>

            {PLANS.map((plan) => (
              <div key={plan.id} className="bg-white rounded-lg shadow-sm border border-slate-200 hover:border-camel-500 transition-colors flex flex-col overflow-hidden relative">
                 {plan.id === PlanTier.PRO && (
                    <div className="absolute top-0 right-0 bg-camel-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">POPULAR</div>
                 )}
                <div className="p-6 flex-grow">
                  <h3 className="text-xl font-bold text-navy-900">{plan.name}</h3>
                  <div className="mt-4 flex items-baseline">
                    <span className="text-3xl font-extrabold text-navy-900">${plan.price}</span>
                    {plan.isSubscription && <span className="ml-1 text-slate-500">/mo</span>}
                  </div>
                  <p className="mt-2 text-sm text-camel-600 font-medium">
                    {plan.id === PlanTier.NONE ? 'One-time payment' : `${plan.credits} Edit Credits/mo`}
                  </p>
                  <ul className="mt-6 space-y-4">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start">
                        <svg className="flex-shrink-0 h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="ml-3 text-sm text-slate-600">{feature}</span>
                      </li>
                    ))}
                    <li className="flex items-start">
                        <svg className="flex-shrink-0 h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        <span className="ml-3 text-sm text-slate-600 font-bold">No Watermark</span>
                    </li>
                  </ul>
                </div>
                <div className="p-6 bg-slate-50 border-t border-slate-100">
                  <button 
                    onClick={() => navigate('/signup')}
                    className="w-full bg-navy-800 text-white px-4 py-2 rounded hover:bg-navy-900 transition-colors font-medium"
                  >
                    Select Plan
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};