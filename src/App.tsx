import { useState, useEffect } from 'react';
import Auth from './components/Auth';
import AppLayout from './components/Layout';
import { User } from './utils';

export default function App() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('novafit_user');
    if (!savedUser) return;
    try {
      setUser(JSON.parse(savedUser));
    } catch (error) {
      console.error('Invalid stored user, clearing local storage.', error);
      localStorage.removeItem('novafit_user');
    }
  }, []);

  const handleLogin = (userData: User) => {
    setUser(userData);
    localStorage.setItem('novafit_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('novafit_user');
  };

  if (!user) {
    return <Auth onLogin={handleLogin} />;
  }

  return <AppLayout user={user} onLogout={handleLogout} />;
}
