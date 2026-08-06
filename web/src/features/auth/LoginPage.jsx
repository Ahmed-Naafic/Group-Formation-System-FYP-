import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000').trim();
import { useLoginMutation } from './authApi';
import { setCredentials, selectIsAuth } from './authSlice';
import { Button }  from '@/components/ui/button';
import { Input }   from '@/components/ui/input';
import { Label }   from '@/components/ui/label';
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent,
} from '@/components/ui/card';

export default function LoginPage() {
  const dispatch   = useDispatch();
  const navigate   = useNavigate();
  const location   = useLocation();
  const isAuth     = useSelector(selectIsAuth);
  const [login, { isLoading }] = useLoginMutation();
  const [wakingUp, setWakingUp] = useState(false);
  const [elapsed, setElapsed]   = useState(0);

  // Tick a seconds counter while login is in-flight so the user can see progress
  useEffect(() => {
    if (!isLoading) { setElapsed(0); return; }
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isLoading]);

  const from = location.state?.from?.pathname ?? '/';

  // Silently ping the server on page load to wake Render's free-tier container
  // before the user even submits the form.
  useEffect(() => {
    fetch(`${API_BASE}/health`).catch(() => {});
  }, []);

  // Already authed → send home
  useEffect(() => {
    if (isAuth) navigate(from, { replace: true });
  }, [isAuth, navigate, from]);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm();

  async function onSubmit(data) {
    setWakingUp(false);
    try {
      const result = await login({
        identifier: data.identifier.trim(),
        password:   data.password,
      }).unwrap();

      dispatch(setCredentials({
        token:              result.token,
        user:               result.user,
        mustChangePassword: result.mustChangePassword ?? false,
      }));

      navigate(result.mustChangePassword ? '/change-password' : from, { replace: true });
    } catch (err) {
      if (err?.status === 'FETCH_ERROR') {
        setWakingUp(true);
        setError('root', { message: 'Server took too long to respond. Please try again.' });
      } else {
        setWakingUp(false);
        setError('root', { message: err?.data?.error?.message ?? 'Invalid credentials' });
      }
    }
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">

        {/* Crest + wordmark */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-white shadow-md border border-ink-100 mb-4">
            <img src="/logo-just.png" alt="JUST" className="h-12 w-12 object-contain" />
          </div>
          <p className="eyebrow mb-1">Jamhuriya University of Science &amp; Technology</p>
          <h1
            className="text-just-blue-700 text-center text-balance"
            style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--fs-h3)', fontWeight: 600 }}
          >
            Group Formation System
          </h1>
        </div>

        {/* Login card */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Admin and instructor access only</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>

              {/* Cold-start banner */}
              {isLoading && elapsed >= 3 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin text-amber-600 shrink-0" />
                  <p className="text-sm text-amber-700">
                    Server is starting up… {elapsed}s
                  </p>
                </div>
              )}

              {/* Root / API error */}
              {!isLoading && errors.root && (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm text-red-700">
                    {wakingUp
                      ? 'Server is slow to start (free hosting). Please try again.'
                      : errors.root.message}
                  </p>
                </div>
              )}

              {/* Identifier */}
              <div className="space-y-1.5">
                <Label htmlFor="identifier">Email</Label>
                <Input
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  autoFocus
                  placeholder="you@just.edu.so"
                  {...register('identifier', { required: 'Email is required' })}
                  aria-invalid={!!errors.identifier}
                />
                {errors.identifier && (
                  <p className="text-xs text-danger">{errors.identifier.message}</p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  {...register('password', {
                    required: 'Password is required',
                  })}
                  aria-invalid={!!errors.password}
                />
                {errors.password && (
                  <p className="text-xs text-danger">{errors.password.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 size={16} className="animate-spin" />}
                Sign in
              </Button>
            </form>
          </CardContent>
        </Card>

        <p
          className="mt-6 text-center text-ink-400"
          style={{ fontSize: 'var(--fs-micro)' }}
        >
          Students sign in via the JUST mobile app
        </p>
      </div>
    </div>
  );
}
