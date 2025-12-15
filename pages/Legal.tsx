import React from 'react';

const LegalLayout: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="max-w-4xl mx-auto px-4 py-12">
    <h1 className="text-3xl font-bold text-navy-900 mb-8">{title}</h1>
    <div className="prose prose-slate max-w-none text-slate-700 space-y-4">
      {children}
    </div>
  </div>
);

export const Terms: React.FC = () => (
  <LegalLayout title="Terms of Service">
    <p>Last Updated: {new Date().toLocaleDateString()}</p>
    <h3>1. Acceptance of Terms</h3>
    <p>By accessing Upscale Imagery AI, you agree to these Terms. If you do not agree, do not use our services.</p>
    
    <h3>2. Image Ownership & Rights</h3>
    <p>You retain full ownership of the images you upload. By uploading, you grant us a temporary license to process the image for the purpose of generating your requested transformation. We do not use your images to train our models without explicit consent.</p>
    
    <h3>3. User Conduct</h3>
    <p>You verify that you own the rights to any image you upload. You agree not to upload illegal, offensive, or non-consensual imagery.</p>
    
    <h3>4. Refunds</h3>
    <p>Refunds are only issued for system errors where credit was deducted but no image was generated. Disliking the aesthetic style of an AI generation does not qualify for a refund.</p>
  </LegalLayout>
);

export const Privacy: React.FC = () => (
  <LegalLayout title="Privacy Policy">
    <p>Last Updated: {new Date().toLocaleDateString()}</p>
    <h3>1. Data Collection</h3>
    <p>We collect your email and name for account management. We store uploaded images temporarily to perform transformations.</p>
    
    <h3>2. Data Retention</h3>
    <p>Generated images are stored in your dashboard until you delete them. You may delete your images at any time.</p>
    
    <h3>3. Third Parties</h3>
    <p>We use secure payment processors (Stripe/PayPal) and AI providers (Google Gemini). We do not sell your personal data.</p>
  </LegalLayout>
);

export const Disclaimer: React.FC = () => (
  <LegalLayout title="AI Use & Disclaimer">
    <p>Upscale Imagery AI uses artificial intelligence to transform images. While we strive for realism:</p>
    <ul className="list-disc ml-5">
      <li>AI outputs may vary in accuracy.</li>
      <li>Minor artifacts may appear in generated images.</li>
      <li>We strictly prohibit the creation of deepfakes or misleading content involving public figures.</li>
    </ul>
  </LegalLayout>
);