import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Store, User, ArrowRight, Loader2, KeyRound } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';

const Login = () => {
  const [activeTab, setActiveTab] = useState<'user' | 'shop'>('user');
  
  // Shop State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useContext(AuthContext)!;
  const navigate = useNavigate();

  // Helper for safe redirect
  const handleRedirect = () => {
     const params = new URLSearchParams(window.location.search);
     const shopId = params.get('shopId');
     if (shopId) {
        navigate(`/user/dashboard?shopId=${shopId}`);
     } else {
        navigate(activeTab === 'user' ? '/user/dashboard' : '/shop/dashboard');
     }
  };

  const requestLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => {}, // Success - do nothing, just wanted permission
        (err) => { console.log("Location access denied/error", err); }
      );
    }
  };

  // --- 1. Shop Login (Email/Pass) ---
  const handleShopLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const { data } = await api.post('/auth/login', { email, password });
      login(data, data.token);
      toast.success(`Welcome back, ${data.name}!`);
      requestLocation(); // Trigger location permission
      
      if (data.role === 'OWNER' || data.role === 'EMPLOYEE') {
         navigate('/shop/dashboard');
      } else {
         handleRedirect();
      }

    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // --- 2. User Login (Real Google Auth) ---
  const handleGoogleSuccess = async (credentialResponse: any) => {
    setLoading(true);
    try {
      const { credential } = credentialResponse;
      
      const { data } = await api.post('/auth/google', { credential });
      
      login(data, data.token);
      toast.success(`Welcome, ${data.name}!`);
      requestLocation(); // Trigger location permission
      handleRedirect();

    } catch (error: any) {
      console.error("Google Backend Error:", error);
      toast.error('Authentication Failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
      {/* Left: Branding */}
      <div className="bg-secondary hidden md:flex flex-col justify-between p-12 text-white relative overflow-hidden">
        <div className="z-10">
          <h1 className="text-4xl font-bold flex items-center gap-3">
            <Store className="text-primary" size={40} />
            XeroxSaaS
          </h1>
          <p className="mt-4 text-slate-400 text-lg">
            The modern way to print. <br/> No queues, no USB drives.
          </p>
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px]" />
        <div className="z-10"><p className="text-sm text-slate-500">© 2026 XeroxSaaS Inc.</p></div>
      </div>

      {/* Right: Form */}
      <div className="flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-slate-900">Welcome Back</h2>
            <p className="mt-2 text-slate-500">Please choose your login method</p>
          </div>

          {/* Role Tabs */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl mb-8">
            <button
              onClick={() => setActiveTab('user')}
              className={`flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all
                ${activeTab === 'user' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}
              `}
            >
              <User size={18}/> User
            </button>
            <button 
              onClick={() => setActiveTab('shop')}
              className={`flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all
                ${activeTab === 'shop' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}
              `}
            >
              <Store size={18}/> Shop Owner
            </button>
          </div>

          {activeTab === 'user' ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-center">
                <p className="text-blue-800 font-medium">Users login exclusively via Google.</p>
                <p className="text-blue-600 text-sm mt-1">No password required.</p>
              </div>

              <div className="flex justify-center py-4">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => toast.error('Google Sign In Failed')}
                  useOneTap
                  theme="filled_blue"
                  size="large"
                  text="continue_with"
                  shape="pill"
                />
              </div>
              
              <p className="text-center text-xs text-slate-400">
                 Secure authentication provided by Google Identity Services.
              </p>
            </div>
          ) : (
            <form onSubmit={handleShopLogin} className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Shop Email</label>
                <input 
                  type="email" 
                  required
                  className="input-field"
                  placeholder="shop@xerox.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <div className="relative">
                   <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                   <input 
                    type="password" 
                    required
                    className="input-field pl-10"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full btn btn-primary font-bold"
              >
                {loading ? <Loader2 className="animate-spin" /> : 'Login to Shop'}
                {!loading && <ArrowRight size={20} />}
              </button>
              
              <div className="text-center pt-4 border-t border-slate-100">
                <Link to="/register-shop" className="text-sm text-secondary font-semibold hover:underline">
                  New Shop? Register here
                </Link>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};

export default Login;