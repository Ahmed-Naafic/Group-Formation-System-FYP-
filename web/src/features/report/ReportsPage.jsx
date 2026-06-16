import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Loader2, FileSpreadsheet, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useGetCourseOfferingsQuery } from '@/features/courseOffering/courseOfferingApi';
import { selectCurrentToken } from '@/features/auth/authSlice';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

export default function ReportsPage() {
  const token = useSelector(selectCurrentToken);

  const [selectedOfferingId, setSelectedOfferingId] = useState('');
  const [downloading,        setDownloading]         = useState(null); // 'xlsx' | 'csv' | null

  const { data: offerings = [], isLoading } = useGetCourseOfferingsQuery();

  async function download(format) {
    setDownloading(format);
    try {
      const url = `${API_BASE}/api/reports/groups?courseOfferingId=${selectedOfferingId}&format=${format}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message ?? 'Download failed');
      }
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href  = URL.createObjectURL(blob);
      link.download = `groups.${format}`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      toast.error(err.message ?? 'Download failed');
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="max-w-lg">
      <h2 className="text-ink-900 mb-6">Reports</h2>

      <div className="space-y-5">
        {/* Course Offering selector */}
        <div className="space-y-1.5">
          <Label>Course Offering</Label>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-ink-400 rounded-md border border-border bg-ink-50 px-3 py-2">
              <Loader2 size={14} className="animate-spin" /> Loading offerings…
            </div>
          ) : (
            <Select value={selectedOfferingId} onValueChange={setSelectedOfferingId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an offering…" />
              </SelectTrigger>
              <SelectContent>
                {offerings.map((o) => (
                  <SelectItem key={o._id} value={String(o._id)}>
                    {o.courseId?.name ?? '—'}
                    {' — '}
                    {o.cohortId?.name ?? '—'}
                    {o.semesterId?.name ? ` (${o.semesterId.name})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Download card */}
        <div className="rounded-lg border border-border bg-white shadow-xs p-5">
          <p className="text-sm font-medium text-ink-800 mb-1">Group Formation Report</p>
          <p className="text-xs text-ink-400 mb-4">
            Exports groups summary and full student roster with performance data.
            XLSX includes two sheets; CSV is a flat student list.
          </p>
          <div className="flex gap-2">
            <Button onClick={() => download('xlsx')} disabled={!selectedOfferingId || !!downloading}>
              {downloading === 'xlsx'
                ? <Loader2 size={14} className="animate-spin" />
                : <FileSpreadsheet size={14} />}
              Download XLSX
            </Button>
            <Button variant="outline" onClick={() => download('csv')} disabled={!selectedOfferingId || !!downloading}>
              {downloading === 'csv'
                ? <Loader2 size={14} className="animate-spin" />
                : <FileText size={14} />}
              Download CSV
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
