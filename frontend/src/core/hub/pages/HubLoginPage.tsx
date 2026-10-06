import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../../@shared/services/api';
import { ACTIVE_HUB_KEY, useAuthStore } from '../../../@shared/hooks/useAuth';

/**
 * Hub V2 Fase 24 — the hub console's own sign-in.
 *
 * Deliberately **not** `/login`: that form resolves a tenant first, and a hub
 * member's own tenant is an accident of where they were hired. This one posts
 * the same credentials to `/auth/login` without an `X-Tenant-Id`, which is the
 * global-email fallback — an account is unique by email across provisioning, so
 * the server can find whoever they are and tell us which tenant issued the token.
 *
 * The pre-login localStorage wipe mirrors `TerminalLoginPage`: both consoles
 * replace whichever session was active, and leaving a stale `accessToken` or
 * `activeHubId` behind would send the request as somebody else — or into another
 * account's hub.
 */
export default function HubLoginPage() {
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
    localStorage.removeItem(ACTIVE_HUB_KEY);

    try {
      const { data } = await api.post('/auth/login', {
        email: email.trim(),
        password,
      });
      localStorage.setItem('accessToken', data.data.accessToken);
      localStorage.setItem('refreshToken', data.data.refreshToken);
      const tokenPayload = JSON.parse(atob(data.data.accessToken.split('.')[1]));
      const tenantId = tokenPayload.tenant ?? data.data.user?.tenantId ?? '';
      localStorage.setItem('tenantId', tenantId);
      setUser({ ...data.data.user, tenantId });
      navigate('/hub');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Email atau password salah');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6">
      {error && <div className="text-red-600 text-sm text-center">{error}</div>}
      <div className="space-y-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email anggota hub"
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
        {isLoading ? 'Memproses...' : 'Masuk ke Hub Center'}
      </button>
      <div className="space-y-1 text-center text-sm text-gray-600">
        <p>
          <Link to="/login" className="hover:underline">
            Login sebagai tenant (POS)
          </Link>
        </p>
        <p>
          <Link to="/terminal/login" className="hover:underline">
            Login sebagai admin platform
          </Link>
        </p>
      </div>
    </form>
  );
}
