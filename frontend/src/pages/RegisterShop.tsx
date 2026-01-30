import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Store, ArrowLeft, Loader2 } from 'lucide-react';

const RegisterShop = () => {
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { login } = useContext(AuthContext)!;
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Register the User (Owner)
      await api.post('/auth/register-shop', formData);
      
      // 2. Auto Login
      // Note: The backend register endpoint usually returns the user info but maybe not the token immediately
      // depending on implementation. If your backend returns token, use it.
      // If not, we might need to hit login. 
      // *Correction*: Your backend AuthController returns only user info, not token on register.
      // Let's quickly fix that flow by logging them in automatically.
      
      const loginRes = await api.post('/auth/login', { 
        email: formData.email, 
        password: formData.password 
      });

      login(loginRes.data, loginRes.data.token);
      toast.success('Account created! Now setup your shop.');
      navigate('/shop/setup'); // Next step: Create Shop Profile

    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg p-8 rounded-2xl shadow-xl border border-slate-100">
        <Link to="/login" className="inline-flex items-center text-slate-500 hover:text-slate-800 mb-6 text-sm">
          <ArrowLeft size={16} className="mr-2" /> Back to Login
        </Link>
        
        <div className="mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Store className="text-primary" />
            Partner Registration
          </h1>
          <p className="text-slate-500 mt-2">Create an owner account to manage your print shop.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
            <input 
              className="input-field" 
              placeholder="John Doe"
              required
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Work Email</label>
            <input 
              type="email"
              className="input-field" 
              placeholder="owner@copycenter.com"
              required
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input 
              type="password"
              className="input-field" 
              placeholder="Min. 6 characters"
              required
              value={formData.password}
              onChange={e => setFormData({...formData, password: e.target.value})}
            />
          </div>

          <button disabled={loading} className="w-full btn btn-primary font-bold mt-6">
            {loading ? <Loader2 className="animate-spin" /> : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default RegisterShop;