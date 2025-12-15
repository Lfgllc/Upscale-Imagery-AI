import React, { useState } from 'react';

interface LogoProps {
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ className = "h-10 w-auto" }) => {
  const [hasError, setHasError] = useState(false);

  // SVG Fallback (Monogram)
  const fallback = (
      <svg 
        viewBox="0 0 100 100" 
        className={className} 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Upscale Imagery AI Logo"
      >
        <rect width="100" height="100" rx="20" fill="#0a192f" />
        <path d="M35 30V60C35 65.5228 39.4772 70 45 70C50.5228 70 55 65.5228 55 60V30" stroke="#c19a6b" strokeWidth="8" strokeLinecap="round"/>
        <path d="M65 30V60" stroke="#c19a6b" strokeWidth="8" strokeLinecap="round"/>
        <circle cx="65" cy="25" r="5" fill="#c19a6b"/>
      </svg>
  );

  if (hasError) {
    return fallback;
  }

  return (
    <img 
      src="/logo.png" 
      alt="Upscale Imagery AI" 
      className={`object-contain ${className}`}
      onError={() => setHasError(true)} 
    />
  );
};