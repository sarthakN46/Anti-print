import { createContext, useState, useEffect, type ReactNode, useMemo } from 'react';

interface User {
  _id: string;
  name: string;
  email: string;
  role: 'USER' | 'OWNER' | 'EMPLOYEE';
}

interface AuthContextType {
  user: User | null;
  login: (userData: User, token: string) => void;
  logout: () => void;
  isLoading: boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check session storage on load (did they refresh the page?)
    const storedUser = sessionStorage.getItem('user');
    const token = sessionStorage.getItem('token');
    
    console.log('[AuthContext] Init. Token:', !!token, 'User:', storedUser);

    if (storedUser && token) {
      try {
        setUser(JSON.parse(storedUser));
        console.log('[AuthContext] User restored');
      } catch (e) {
        console.error('[AuthContext] Failed to parse user', e);
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('token');
      }
    }
    setIsLoading(false);
  }, []);

  const login = (userData: User, token: string) => {
    setUser(userData);
    sessionStorage.setItem('user', JSON.stringify(userData));
    sessionStorage.setItem('token', token);
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
  };

  const contextValue = useMemo(() => ({
    user, login, logout, isLoading
  }), [user, isLoading]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};