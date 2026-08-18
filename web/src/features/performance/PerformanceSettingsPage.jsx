import { useForm } from 'react-hook-form';
import { useSelector } from 'react-redux';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useGetPerformanceSettingsQuery,
  useUpdatePerformanceSettingsMutation,
  useSetCategoryVisibilityMutation,
} from './performanceApi';
import { selectRole } from '@/features/auth/authSlice';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function PerformanceSettingsPage() {
  const isAdmin = useSelector(selectRole) === 'admin';
  const { data: settings, isLoading } = useGetPerformanceSettingsQuery();
  const [updateSettings, { isLoading: saving }] = useUpdatePerformanceSettingsMutation();
  const [setCategoryVisibility, { isLoading: togglingVisibility }] = useSetCategoryVisibilityMutation();

  async function onToggleCategoryVisibility() {
    try {
      const result = await setCategoryVisibility(!settings?.categoryVisibleToInstructors).unwrap();
      toast.success(result.message);
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to update setting');
    }
  }

  const { register, handleSubmit, formState: { errors, isDirty } } = useForm({
    values: settings
      ? {
          threshHigh:   settings.thresholds?.high   ?? 75,
          threshMedium: settings.thresholds?.medium ?? 50,
        }
      : {},
  });

  async function onSave(data) {
    const payload = {
      thresholds: {
        high:   Number(data.threshHigh),
        medium: Number(data.threshMedium),
      },
    };

    try {
      const result = await updateSettings(payload).unwrap();
      toast.success(result.message ?? `Thresholds saved — ${result.recalculated} students recalculated`);
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to save settings');
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={22} className="animate-spin text-ink-300" />
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <p className="eyebrow mb-1">Settings</p>
        <h2 className="text-ink-900 mb-1">Performance Settings</h2>
        <p className="text-ink-500" style={{ fontSize: 'var(--fs-small)' }}>
          Set the thresholds that determine each student's performance category from their
          average score. Changes apply on the next recalculation.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSave)} className="space-y-5" noValidate>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-ink-500 uppercase tracking-wide font-semibold">
              Performance Thresholds
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-ink-500 mb-4">
              Score ≥ HIGH → HIGH &nbsp;·&nbsp; Score ≥ MEDIUM → MEDIUM &nbsp;·&nbsp; otherwise → LOW.
              Values are percentages of the 0–100 average score.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { key: 'threshHigh',   label: 'HIGH threshold (%)' },
                { key: 'threshMedium', label: 'MEDIUM threshold (%)' },
              ].map(({ key, label }) => (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={key}>{label}</Label>
                  <Input
                    id={key}
                    type="number"
                    min={0}
                    max={100}
                    {...register(key, {
                      required: 'Required',
                      min: { value: 0,   message: 'Min 0' },
                      max: { value: 100, message: 'Max 100' },
                    })}
                    aria-invalid={!!errors[key]}
                  />
                  {errors[key] && <p className="text-xs text-danger">{errors[key].message}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-ink-500 uppercase tracking-wide font-semibold">
                Category Visibility
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4">
                <div className="max-w-sm">
                  <p className="text-sm text-ink-700 font-medium">
                    Let instructors show performance categories
                  </p>
                  <p className="text-xs text-ink-500 mt-1">
                    When on, instructors get a "Show Category" toggle on the Students, Groups, and
                    Scores pages so they can check how balanced their groups are. Off by default —
                    categories stay hidden everywhere until you turn this on.
                  </p>
                </div>
                <Button
                  type="button"
                  variant={settings?.categoryVisibleToInstructors ? 'default' : 'outline'}
                  onClick={onToggleCategoryVisibility}
                  disabled={togglingVisibility}
                  className="shrink-0 w-20"
                >
                  {togglingVisibility && <Loader2 size={14} className="animate-spin" />}
                  {settings?.categoryVisibleToInstructors ? 'On' : 'Off'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end pt-1">
          <Button type="submit" disabled={saving || !isDirty}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save settings
          </Button>
        </div>
      </form>
    </div>
  );
}
