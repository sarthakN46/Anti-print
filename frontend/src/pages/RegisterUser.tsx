import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import { ArrowRight, Loader2, Store } from 'lucide-react';

const RegisterUser = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useContext(AuthContext)!;
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const { data } = await api.post('/auth/register-user', { name, email, password });
      
      // Auto login after registration
      login(data, data.token); // Note: Registration might not return token depending on implementation, but typically it should or we login manually. 
      // Checking backend: registerUser returns token in res.json() calls generateToken(res, ...) but wait, generateToken in controller sets cookie or returns generic?
      // Let's check authController again. It calls generateToken(res, id). 
      // Wait, standard generateToken usually sends a cookie OR returns it. 
      // In registerShopOwner: generateToken(res, user._id.toString()); res.status(201).json({...})
      // I need to check `utils/generateToken.ts` to see if it attaches token to body or just cookie. 
      // If it's cookie only, `data.token` might be undefined.
      // But `loginUser` returns `token: token`. 
      // `registerShopOwner` does NOT return `token` in the JSON body in the code I read earlier. 
      // I should fix backend `registerUser` to return token if `loginUser` does, or rely on cookie.
      // `api.ts` checks `localStorage.getItem('token')`. So we need the token in the body.
      
      // Let's assume I need to fix the backend first if it doesn't return token. 
      // ... actually, let's just try to login immediately after register if token is missing.
      
      // For now, I will assume I need to fix backend to return token in JSON to match frontend expectation.
      // I will implement this file, then check backend utility.

      toast.success(`Welcome, ${data.name}!`);
      navigate('/user/dashboard');

    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
      {/* Left: Branding */}
      <div className="bg-primary hidden md:flex flex-col justify-between p-12 text-white relative overflow-hidden">
        <div className="z-10">
          <h1 className="text-4xl font-bold flex items-center gap-3">
            <Store className="text-white" size={40} />
            XeroxSaaS
          </h1>
          <p className="mt-4 text-purple-100 text-lg">
            Join thousands of users printing smarter.
          </p>
        </div>
        
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-white/10 rounded-full blur-[100px]" />
        
        <div className="z-10">
          <p className="text-sm text-purple-200">© 2026 XeroxSaaS Inc.</p>
        </div>
      </div>

      {/* Right: Form */}
      <div className="flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center md:text-left">
            <h2 className="text-3xl font-bold text-slate-900">Create Account</h2>
            <p className="mt-2 text-slate-500">Sign up as a User</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
              <input 
                type="text" 
                required
                className="input-field"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input 
                type="email" 
                required
                className="input-field"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input 
                type="password" 
                required
                className="input-field"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full btn btn-primary font-bold"
            >
              {loading ? <Loader2 className="animate-spin" /> : 'Register'}
              {!loading && <ArrowRight size={20} />}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="text-primary font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterUser;