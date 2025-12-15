import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { StorageService } from '../services/storageService';
import { User, UserRole } from '../types';
import { Logo } from './Logo';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = React.useState<User>(StorageService.getUser());
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  // Refresh user state on location change
  React.useEffect(() => {
    setUser(StorageService.getUser());
  }, [location]);

  const handleLogout = () => {
    StorageService.logout();
    setUser(StorageService.getUser());
    navigate('/');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Navigation */}
      <nav className="bg-navy-900 text-white sticky top-0 z-50 border-b border-navy-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center cursor-pointer" onClick={() => navigate('/')}>
              <div className="flex-shrink-0 flex items-center gap-3">
                {/* Logo Container: Added white bg to make blue logo visible on dark header */}
                <div className="bg-white p-1.5 rounded-md flex items-center justify-center shadow-sm">
                    <Logo className="h-8 w-auto" />
                </div>
                <span className="font-bold text-xl tracking-tight">Upscale Imagery AI</span>
              </div>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-6">
              <button 
                onClick={() => navigate('/support')} 
                className={`${isActive('/support') ? 'text-camel-500' : 'text-slate-300'} hover:text-white transition-colors text-sm font-medium`}
              >
                Support
              </button>

              {!user.isAuthenticated ? (
                <>
                  <button onClick={() => navigate('/login')} className="text-slate-300 hover:text-white transition-colors font-medium">Log In</button>
                  <button 
                    onClick={() => navigate('/signup')}
                    className="bg-camel-500 hover:bg-camel-600 text-white px-5 py-2 rounded-md font-medium transition-colors shadow-lg shadow-camel-500/20"
                  >
                    Get Started / Sign Up
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => navigate('/dashboard')} 
                    className={`${isActive('/dashboard') ? 'text-camel-500' : 'text-slate-300'} hover:text-white transition-colors`}
                  >
                    Dashboard
                  </button>
                  <button 
                    onClick={() => navigate('/generate')} 
                    className={`${isActive('/generate') ? 'text-camel-500' : 'text-slate-300'} hover:text-white transition-colors`}
                  >
                    Generate
                  </button>
                  
                  {/* Admin Link */}
                  {user.role === UserRole.ADMIN && (
                    <button 
                      onClick={() => navigate('/admin')} 
                      className={`${isActive('/admin') ? 'text-red-400' : 'text-slate-300'} hover:text-white transition-colors font-bold`}
                    >
                      Admin
                    </button>
                  )}

                  <div className="flex items-center gap-4 ml-4 border-l border-navy-700 pl-4">
                    <div className="text-right">
                      <p className="text-sm font-medium text-white">{user.name}</p>
                      <p className="text-xs text-camel-500">{user.credits} Credits</p>
                    </div>
                    <button 
                      onClick={handleLogout}
                      className="text-xs border border-slate-600 px-3 py-1 rounded hover:bg-slate-800 transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
            
            {/* Mobile menu button */}
            <div className="flex items-center md:hidden">
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-slate-300 hover:text-white p-2">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {isMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-navy-800 pb-4 px-4">
            <div className="flex flex-col space-y-3 pt-4">
              <button onClick={() => { navigate('/support'); setIsMenuOpen(false); }} className="text-left text-white py-2">Support</button>
              {!user.isAuthenticated ? (
                <>
                  <button onClick={() => { navigate('/login'); setIsMenuOpen(false); }} className="text-left text-white py-2">Log In</button>
                  <button onClick={() => { navigate('/signup'); setIsMenuOpen(false); }} className="text-left text-camel-400 font-bold py-2">Sign Up</button>
                </>
              ) : (
                <>
                  <button onClick={() => { navigate('/dashboard'); setIsMenuOpen(false); }} className="text-left text-white py-2">Dashboard</button>
                  <button onClick={() => { navigate('/generate'); setIsMenuOpen(false); }} className="text-left text-white py-2">Generate Image</button>
                  {user.role === UserRole.ADMIN && (
                     <button onClick={() => { navigate('/admin'); setIsMenuOpen(false); }} className="text-left text-red-400 py-2">Admin Panel</button>
                  )}
                  <button onClick={() => { handleLogout(); setIsMenuOpen(false); }} className="text-left text-slate-400 py-2">Sign Out</button>
                </>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="flex-grow">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-auto">
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center flex-col md:flex-row gap-4">
            <p className="text-slate-500 text-sm">© 2024 Upscale Imagery AI. All rights reserved.</p>
            <div className="flex space-x-6 flex-wrap justify-center">
               <button onClick={() => navigate('/support')} className="text-slate-400 hover:text-camel-500 text-sm">Contact Support</button>
              <button onClick={() => navigate('/terms')} className="text-slate-400 hover:text-camel-500 text-sm">Terms of Service</button>
              <button onClick={() => navigate('/privacy')} className="text-slate-400 hover:text-camel-500 text-sm">Privacy Policy</button>
              <button onClick={() => navigate('/disclaimer')} className="text-slate-400 hover:text-camel-500 text-sm">AI Disclaimer</button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};