import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { StorageService } from '../services/storageService';
import { supabase } from '../services/supabaseClient';
import { Logo } from '../components/Logo';

export const Auth: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLogin, setIsLogin] = useState(true);
  
  // Form State
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (location.pathname === '/signup') setIsLogin(false);
    else setIsLogin(true);
    setError(null);
  }, [location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isLogin && !acceptedTerms) {
      setError("You must accept the Terms of Service.");
      return;
    }

    if (!email || !password) {
        setError("Please enter all fields");
        return;
    }

    setIsLoading(true);

    try {
        if (isLogin) {
            // Login with Supabase
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password
            });
            if (error) throw error;
            
            // Sync profile data to local cache
            await StorageService.syncUser();
            navigate('/dashboard');
        } else {
            // Signup with Supabase
            // We include emailRedirectTo to ensure they come back to this site after clicking the email link
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { full_name: name },
                    emailRedirectTo: window.location.origin
                }
            });
            if (error) throw error;
            
            alert("Account created! Please check your email to confirm your account.");
            setIsLogin(true);
        }
    } catch (err: any) {
        setError(err.message);
    } finally {
        setIsLoading(false);
    }
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
            {isLogin ? 'Sign in to your account' : 'Create your account'}
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600">
            Or{' '}
            <button onClick={toggleMode} className="font-medium text-camel-600 hover:text-camel-500">
            {isLogin ? 'create a new account' : 'sign in to existing account'}
            </button>
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <h3 className="text-sm font-medium text-red-800">{error}</h3>
            </div>
          )}
          
          <div className="rounded-md shadow-sm -space-y-px">
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
          </div>

          {!isLogin && (
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
                I agree to the <Link to="/terms" className="text-camel-600 hover:text-camel-500">Terms</Link> and <Link to="/privacy" className="text-camel-600 hover:text-camel-500">Privacy Policy</Link>.
              </label>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${isLoading ? 'bg-slate-400' : 'bg-navy-800 hover:bg-navy-900'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-navy-500`}
            >
              {isLoading ? 'Processing...' : (isLogin ? 'Sign in' : 'Sign up')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
