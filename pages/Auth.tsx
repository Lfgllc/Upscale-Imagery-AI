import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { StorageService } from '../services/storageService';
import { Logo } from '../components/Logo';

export const Auth: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Verification State
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');

  useEffect(() => {
    // Determine mode based on URL path
    if (location.pathname === '/signup') {
        setIsLogin(false);
    } else {
        setIsLogin(true);
    }
    setError(null);
    setIsVerifying(false);
    setVerificationCode('');
  }, [location]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // If we are in verifying mode, this is the code submission
    if (isVerifying) {
        try {
            StorageService.verifyEmail(email, verificationCode);
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.message);
        }
        return;
    }

    // Normal Auth Flow
    if (!isLogin && !acceptedTerms) {
      setError("You must accept the Terms of Service and Privacy Policy to create an account.");
      return;
    }

    if (email && password) {
      if (!isLogin) {
          // Signup Flow
          if (!name) {
             setError("Please enter your name");
             return;
          }
          try {
              StorageService.signup(email, name);
              setIsVerifying(true);
          } catch(err: any) {
              setError(err.message);
          }
      } else {
          // Login Flow
          try {
            StorageService.login(email);
            navigate('/dashboard');
          } catch (err: any) {
            if (err.message === "Email not verified") {
                setIsVerifying(true);
                // Trigger resend implicitly if needed or just let them input
                StorageService.resendVerification(email); 
                setError("Email not verified. We've resent your code.");
            } else {
                setError(err.message);
            }
          }
      }
    }
  };

  const handleResend = () => {
      StorageService.resendVerification(email);
      alert("Verification code resent to console (check dev tools).");
  };

  const toggleMode = () => {
      if (isLogin) navigate('/signup');
      else navigate('/login');
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto flex justify-center">
             <Logo className="h-24 w-auto" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-navy-900">
            {isVerifying ? 'Verify your email' : (isLogin ? 'Sign in to your account' : 'Create your account')}
          </h2>
          {!isVerifying && (
            <p className="mt-2 text-center text-sm text-slate-600">
                Or{' '}
                <button onClick={toggleMode} className="font-medium text-camel-600 hover:text-camel-500">
                {isLogin ? 'start your free trial' : 'sign in to existing account'}
                </button>
            </p>
          )}
          {isVerifying && (
              <p className="mt-2 text-center text-sm text-slate-600">
                  Please enter the code sent to <strong>{email}</strong>.
                  <br/>
                  <span className="text-xs text-slate-400">(Check developer console for code: 123456)</span>
              </p>
          )}
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">{error}</h3>
                </div>
              </div>
            </div>
          )}
          
          <div className="rounded-md shadow-sm -space-y-px">
            
            {isVerifying ? (
                <div>
                    <label htmlFor="code" className="sr-only">Verification Code</label>
                    <input
                        id="code"
                        name="code"
                        type="text"
                        required
                        className="appearance-none rounded-md relative block w-full px-3 py-2 border border-slate-300 placeholder-slate-500 text-slate-900 bg-white focus:outline-none focus:ring-camel-500 focus:border-camel-500 focus:z-10 sm:text-sm text-center tracking-widest text-xl"
                        placeholder="123456"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                    />
                </div>
            ) : (
                <>
                    {!isLogin && (
                        <div>
                        <label htmlFor="name" className="sr-only">Full Name</label>
                        <input
                            id="name"
                            name="name"
                            type="text"
                            required
                            className="appearance-none rounded-none relative block w-full px-3 py-2 border border-slate-300 placeholder-slate-500 text-slate-900 bg-white rounded-t-md focus:outline-none focus:ring-camel-500 focus:border-camel-500 focus:z-10 sm:text-sm"
                            placeholder="Full Name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                        </div>
                    )}

                    <div>
                    <label htmlFor="email-address" className="sr-only">Email address</label>
                    <input
                        id="email-address"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        className={`appearance-none rounded-none relative block w-full px-3 py-2 border border-slate-300 placeholder-slate-500 text-slate-900 bg-white ${isLogin ? 'rounded-t-md' : ''} focus:outline-none focus:ring-camel-500 focus:border-camel-500 focus:z-10 sm:text-sm`}
                        placeholder="Email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    </div>
                    <div>
                    <label htmlFor="password" className="sr-only">Password</label>
                    <input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        required
                        className="appearance-none rounded-none relative block w-full px-3 py-2 border border-slate-300 placeholder-slate-500 text-slate-900 bg-white rounded-b-md focus:outline-none focus:ring-camel-500 focus:border-camel-500 focus:z-10 sm:text-sm"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    </div>
                </>
            )}
          </div>

          {!isLogin && !isVerifying && (
            <div className="flex items-center">
              <input
                id="terms"
                name="terms"
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="h-4 w-4 text-camel-600 focus:ring-camel-500 border-gray-300 rounded bg-white"
              />
              <label htmlFor="terms" className="ml-2 block text-sm text-slate-900">
                I agree to the <Link to="/terms" className="text-camel-600 hover:text-camel-500">Terms</Link> and <Link to="/privacy" className="text-camel-600 hover:text-camel-500">Privacy Policy</Link>. I confirm I have rights to the images I upload.
              </label>
            </div>
          )}

          {isLogin && !isVerifying && (
             <div className="flex items-center justify-end">
                <div className="text-sm">
                  <a href="#" className="font-medium text-camel-600 hover:text-camel-500" onClick={(e) => { e.preventDefault(); alert("Password reset link sent to your email."); }}>
                    Forgot your password?
                  </a>
                </div>
             </div>
          )}

          {isVerifying && (
             <div className="flex items-center justify-end">
                <button type="button" onClick={handleResend} className="text-sm font-medium text-camel-600 hover:text-camel-500">
                    Resend Code
                </button>
             </div>
          )}

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-navy-800 hover:bg-navy-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-navy-500"
            >
              {isVerifying ? 'Verify & Login' : (isLogin ? 'Sign in' : 'Sign up')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};