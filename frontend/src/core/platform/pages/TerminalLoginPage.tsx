import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../../@shared/services/api';
import { useAuthStore } from '../../../@shared/hooks/useAuth';

export default function TerminalLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const setUser = useAuthStore((s) => s.setUser);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('tenantId');
    localStorage.removeItem('authUser');

    try {
      const { data } = await api.post(
        '/auth/login',
        { email: email.trim(), password },
        { headers: { 'X-Tenant-Id': 'platform' } },
      );
      localStorage.setItem('accessToken', data.data.accessToken);
      localStorage.setItem('refreshToken', data.data.refreshToken);
      const tokenPayload = JSON.parse(atob(data.data.accessToken.split('.')[1]));
      const tenantId = tokenPayload.tenant ?? data.data.user?.tenantId ?? '';
      localStorage.setItem('tenantId', tenantId);
      setUser({ ...data.data.user, tenantId });
      navigate('/terminal-center');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Invalid credentials');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6">
      {error && (
        <div className="text-red-600 text-sm text-center">{error}</div>
      )}
      <div className="space-y-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Platform super admin email"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        />
      </div>
      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-2 px-4 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
      >
        {isLoading ? 'Signing in...' : 'Sign in to Terminal Center'}
      </button>
      <p className="text-center text-sm text-gray-600">
        <Link to="/login" className="hover:underline">
          Login sebagai tenant (POS)
        </Link>
      </p>
    </form>
  );
}