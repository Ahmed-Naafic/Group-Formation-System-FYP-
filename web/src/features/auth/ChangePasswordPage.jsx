import { useForm } from 'react-hook-form';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Loader2, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { useChangePasswordMutation } from './authApi';
import { setCredentials, selectIsAuth } from './authSlice';
import { Button }  from '@/components/ui/button';
import { Input }   from '@/components/ui/input';
import { Label }   from '@/components/ui/label';
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent,
} from '@/components/ui/card';

export default function ChangePasswordPage() {
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  const isAuth    = useSelector(selectIsAuth);
  const [changePassword, { isLoading }] = useChangePasswordMutation();

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm();

  const newPassword = watch('newPassword');

  // Not authenticated at all → go to login
  if (!isAuth) {
    navigate('/login', { replace: true });
    return null;
  }

  async function onSubmit(data) {
    try {
      const result = await changePassword({
        newPassword: data.newPassword,
        // currentPassword is only sent for voluntary changes (no current user in forced flow)
      }).unwrap();

      dispatch(setCredentials({
        token:              result.token,
        user:               result.user,
        mustChangePassword: false,
      }));

      toast.success('Password changed — welcome!');
      navigate('/', { replace: true });
    } catch (err) {
      const message = err?.data?.error?.message ?? 'Failed to change password';
      setError('root', { message });
    }
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl mb-4"
            style={{ background: 'var(--just-gold-50)', border: '1px solid var(--just-gold-200)' }}
          >
            <ShieldAlert size={24} style={{ color: 'var(--just-gold-600)' }} strokeWidth={1.75} />
          </div>
          <p className="eyebrow mb-1">Security Required</p>
          <h1
            className="text-just-blue-700 text-center text-balance"
            style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--fs-h3)', fontWeight: 600 }}
          >
            Set Your Password
          </h1>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Create a new password</CardTitle>
            <CardDescription>
              Your account was created with a temporary password. Please set a
              permanent password before continuing.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>

              {errors.root && (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm text-red-700">{errors.root.message}</p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="newPassword">New password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  autoFocus
                  placeholder="Minimum 6 characters"
                  {...register('newPassword', {
                    required: 'New password is required',
                    minLength: { value: 6, message: 'Must be at least 6 characters' },
                  })}
                  aria-invalid={!!errors.newPassword}
                />
                {errors.newPassword && (
                  <p className="text-xs text-danger">{errors.newPassword.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Re-enter new password"
                  {...register('confirmPassword', {
                    required: 'Please confirm your password',
                    validate: (v) => v === newPassword || 'Passwords do not match',
                  })}
                  aria-invalid={!!errors.confirmPassword}
                />
                {errors.confirmPassword && (
                  <p className="text-xs text-danger">{errors.confirmPassword.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 size={16} className="animate-spin" />}
                Set password &amp; continue
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
