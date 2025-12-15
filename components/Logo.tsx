import React, { useState, useEffect } from 'react';

interface LogoProps {
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ className = "h-10 w-auto" }) => {
  // State to manage which file extension we are trying
  const [currentSrc, setCurrentSrc] = useState<string>("/logo.png?v=" + Date.now());
  const [attempt, setAttempt] = useState(0);
  const [hasError, setHasError] = useState(false);

  // Robust error handling: Try png -> jpg -> jpeg -> SVG Fallback
  const handleError = () => {
    if (attempt === 0) {
      // Try JPG
      setCurrentSrc("/logo.jpg?v=" + Date.now());
      setAttempt(1);
    } else if (attempt === 1) {
      // Try JPEG
      setCurrentSrc("/logo.jpeg?v=" + Date.now());
      setAttempt(2);
    } else {
      // Give up and show SVG
      setHasError(true);
    }
  };

  if (hasError) {
    // Professional SVG Fallback (Monogram)
    return (
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
  }

  return (
    <img 
      src={currentSrc} 
      alt="Upscale Imagery AI" 
      className={`object-contain ${className}`}
      onError={handleError} 
    />
  );
};