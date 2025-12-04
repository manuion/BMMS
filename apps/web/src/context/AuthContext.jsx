import { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing token on mount
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
      // Verify token is still valid
      authApi
        .getMe()
        .then((res) => {
          setUser(res.data);
          localStorage.setItem('user', JSON.stringify(res.data));
        })
        .catch(() => {
          // Token invalid, clear storage
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await authApi.login({ email, password });
    const { user: userData, token } = res.data;

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);

    return userData;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const isAdmin = user?.isAdmin || false;

  const isOrganiserInAnyCommittee = () => {
    return user?.committeeMemberships?.some((m) => m.role === 'organiser') || false;
  };

  const getOrganiserCommittees = () => {
    return (
      user?.committeeMemberships
        ?.filter((m) => m.role === 'organiser')
        .map((m) => m.committee) || []
    );
  };

  const isMemberInAnyCommittee = () => {
    return user?.committeeMemberships?.some((m) => m.role === 'member') || false;
  };

  const getMemberCommittees = () => {
    return (
      user?.committeeMemberships
        ?.filter((m) => m.role === 'member')
        .map((m) => m.committee) || []
    );
  };

  const value = {
    user,
    loading,
    login,
    logout,
    isAdmin,
    isOrganiserInAnyCommittee,
    getOrganiserCommittees,
    isMemberInAnyCommittee,
    getMemberCommittees,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
