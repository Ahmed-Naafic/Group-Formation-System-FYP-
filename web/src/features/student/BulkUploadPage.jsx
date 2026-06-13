import { useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Upload, FileSpreadsheet, X, Download, Copy, Check, Loader2, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useBulkUploadStudentsMutation } from './studentApi';
import { useGetClassByIdQuery } from '@/features/class/classApi';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

// ── Helpers ──────────────────────────────────────────────────────────────────

function downloadCsv(rows, filename) {
  const header = 'Student ID,Full Name,Temp Password';
  const lines  = rows.map((r) =>
    [r.studentId, `"${r.fullName}"`, r.tempPassword ?? '(existing account)'].join(',')
  );
  const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function CopyButton({ text, className }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={copy}
      className={cn('p-1 rounded text-ink-400 hover:text-ink-700 transition-colors', className)}
      aria-label="Copy"
    >
      {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
    </button>
  );
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

function TabBar({ tabs, active, onChange }) {
  return (
    <div className="flex border-b border-border">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            'px-4 py-2.5 text-sm font-medium transition-colors relative',
            active === t.id
              ? 'text-just-blue-700 border-b-2 border-just-blue-600 -mb-px'
              : 'text-ink-400 hover:text-ink-700',
          )}
        >
          {t.label}
          {t.count > 0 && (
            <span
              className={cn(
                'ml-1.5 rounded-full px-1.5 py-0.5 text-xs font-semibold',
                active === t.id ? 'bg-just-blue-100 text-just-blue-700' : 'bg-ink-100 text-ink-500',
              )}
            >
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function BulkUploadPage() {
  const { classId } = useParams();
  const { data: cls } = useGetClassByIdQuery(classId);
  const [bulkUpload, { isLoading: uploading }] = useBulkUploadStudentsMutation();

  const [file, setFile]             = useState(null);
  const [dragging, setDragging]     = useState(false);
  const [result, setResult]         = useState(null);
  const [activeTab, setActiveTab]   = useState('created');
  const [pendingTransfers, setPendingTransfers] = useState(null); // { wouldTransfer, totalTransfers }
  const inputRef = useRef(null);

  const className = cls?.name ?? 'Class';

  // ── File selection ──────────────────────────────────────────────────────

  function handleFileChange(e) {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  }

  function removeFile() { setFile(null); if (inputRef.current) inputRef.current.value = ''; }

  // ── Upload ──────────────────────────────────────────────────────────────

  async function handleUpload(confirmTransfers = false) {
    if (!file) return;
    try {
      const data = await bulkUpload({ classId, file, confirmTransfers }).unwrap();
      setResult(data);
      // Default to the transferred tab if there were any transfers, else created
      setActiveTab((data.transferred?.length ?? 0) > 0 ? 'transferred' : 'created');
      setPendingTransfers(null);
      const t = data.transferred?.length ?? 0;
      toast.success(
        `${data.created.length} created` +
        (t > 0 ? `, ${t} transferred` : '') +
        `, ${data.skipped.length} skipped, ${data.failed.length} failed`,
      );
    } catch (err) {
      // Server is asking for explicit confirmation before transferring students
      if (err?.data?.error?.code === 'TRANSFER_CONFIRMATION_REQUIRED') {
        setPendingTransfers(err.data.data);
        return;
      }
      toast.error(err?.data?.error?.message ?? 'Upload failed');
    }
  }

  function reset() {
    setFile(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  // ── Render ──────────────────────────────────────────────────────────────

  const tabs = result ? [
    { id: 'created',     label: 'Created',     count: result.created.length },
    { id: 'transferred', label: 'Transferred', count: result.transferred?.length ?? 0 },
    { id: 'skipped',     label: 'Skipped',     count: result.skipped.length },
    { id: 'failed',      label: 'Failed',      count: result.failed.length  },
  ] : [];

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <p className="eyebrow mb-1">
          <Link to="/classes" className="hover:underline">Classes</Link>
          {' / '}
          <Link to={`/classes/${classId}/students`} className="hover:underline">{className}</Link>
          {' / '}
          Students
        </p>
        <h2 className="text-ink-900 mb-1">Upload Students</h2>
        <p className="text-ink-500" style={{ fontSize: 'var(--fs-small)' }}>
          Upload a CSV or Excel file to enrol multiple students at once.
        </p>
      </div>

      {/* CSV format hint */}
      <div className="mb-5 rounded-lg border border-just-blue-100 bg-just-blue-50 px-4 py-3">
        <p className="text-xs font-semibold text-just-blue-700 mb-1">Required columns</p>
        <p className="text-xs text-just-blue-600 font-mono">
          studentId, fullName
        </p>
        <p className="text-xs font-semibold text-just-blue-700 mt-2 mb-1">Optional columns</p>
        <p className="text-xs text-just-blue-600 font-mono">
          averageScore (0–100), attendance (0–100)
        </p>
        <p className="text-xs text-just-blue-500 mt-2">
          Column headers are flexible — "Student ID", "student_id", "id" all work for studentId.
          Leave averageScore blank to mark a student as UNGRADED.
        </p>
      </div>

      {!result ? (
        /* ── Upload zone ──────────────────────────────────────────────────── */
        <div className="rounded-lg border border-border bg-white shadow-xs p-6 space-y-5">
          {/* Drop zone */}
          <div
            className={cn(
              'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-8 py-12 text-center transition-colors cursor-pointer',
              dragging
                ? 'border-just-blue-400 bg-just-blue-50'
                : 'border-border hover:border-just-blue-300 hover:bg-ink-50/50',
            )}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => !file && inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx"
              className="hidden"
              onChange={handleFileChange}
            />
            {file ? (
              <div className="flex items-center gap-3">
                <FileSpreadsheet size={28} className="text-just-green-500 shrink-0" />
                <div className="text-left">
                  <p className="text-sm font-medium text-ink-800">{file.name}</p>
                  <p className="text-xs text-ink-400">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); removeFile(); }}
                  className="ml-2 text-ink-400 hover:text-ink-700"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <>
                <Upload size={28} className="text-ink-300 mb-3" />
                <p className="text-sm font-medium text-ink-600">
                  Drop a file here or <span className="text-just-blue-600 underline">browse</span>
                </p>
                <p className="text-xs text-ink-400 mt-1">.csv or .xlsx · max 5 MB</p>
              </>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" asChild>
              <Link to={`/classes/${classId}/students`}>Cancel</Link>
            </Button>
            <Button onClick={() => handleUpload()} disabled={!file || uploading}>
              {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              {uploading ? 'Uploading…' : 'Upload'}
            </Button>
          </div>
        </div>
      ) : (
        /* ── Result view ──────────────────────────────────────────────────── */
        <div className="rounded-lg border border-border bg-white shadow-xs overflow-hidden">
          {/* Summary banner */}
          <div className="flex flex-wrap items-center gap-4 px-5 py-4 border-b border-border bg-ink-50/50">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-success" />
              <span className="text-sm font-semibold text-ink-700">{result.created.length} created</span>
            </div>
            {(result.transferred?.length ?? 0) > 0 && (
              <div className="flex items-center gap-2">
                <ArrowRight size={16} className="text-just-blue-500" />
                <span className="text-sm font-semibold text-just-blue-700">{result.transferred.length} transferred</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-500" />
              <span className="text-sm text-ink-500">{result.skipped.length} skipped</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-danger" />
              <span className="text-sm text-ink-500">{result.failed.length} failed</span>
            </div>
            <div className="ml-auto flex gap-2">
              {result.created.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadCsv(result.created, `students-${classId}.csv`)}
                >
                  <Download size={14} />
                  Download passwords
                </Button>
              )}
              <Button size="sm" onClick={reset}>Upload another</Button>
            </div>
          </div>

          {/* Tabs */}
          <TabBar tabs={tabs} active={activeTab} onChange={setActiveTab} />

          {/* Tab content */}
          <div className="p-0">
            {activeTab === 'created' && (
              result.created.length === 0 ? (
                <p className="p-6 text-sm text-ink-400 text-center">No students were created.</p>
              ) : (
                <>
                  <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100">
                    <p className="text-xs text-amber-700 font-medium">
                      Temporary passwords are shown below. Copy or download them now — they will
                      not be shown again after you leave this page.
                    </p>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student ID</TableHead>
                        <TableHead>Full Name</TableHead>
                        <TableHead>Temp Password</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.created.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs text-ink-500">{r.studentId}</TableCell>
                          <TableCell className="font-medium text-ink-800">{r.fullName}</TableCell>
                          <TableCell>
                            {r.tempPassword ? (
                              <div className="flex items-center gap-1">
                                <span className="font-mono text-xs font-semibold text-amber-800 select-all">
                                  {r.tempPassword}
                                </span>
                                <CopyButton text={r.tempPassword} />
                              </div>
                            ) : (
                              <Badge variant="secondary">Existing account</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )
            )}

            {activeTab === 'transferred' && (
              (result.transferred?.length ?? 0) === 0 ? (
                <p className="p-6 text-sm text-ink-400 text-center">No students were transferred.</p>
              ) : (
                <>
                  <div className="px-4 py-2.5 bg-just-blue-50 border-b border-just-blue-100">
                    <p className="text-xs text-just-blue-700 font-medium">
                      These students were moved from another class. Their previous enrollment has been archived.
                    </p>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student ID</TableHead>
                        <TableHead>Full Name</TableHead>
                        <TableHead>Transferred From</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.transferred.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs text-ink-500">{r.studentId}</TableCell>
                          <TableCell className="font-medium text-ink-800">{r.fullName}</TableCell>
                          <TableCell className="text-ink-500 text-sm">{r.fromClassName}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )
            )}

            {activeTab === 'skipped' && (
              result.skipped.length === 0 ? (
                <p className="p-6 text-sm text-ink-400 text-center">No rows were skipped.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student ID</TableHead>
                      <TableHead>Full Name</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.skipped.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs text-ink-500">{r.studentId}</TableCell>
                        <TableCell className="text-ink-700">{r.fullName}</TableCell>
                        <TableCell className="text-amber-700 text-xs">{r.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )
            )}

            {activeTab === 'failed' && (
              result.failed.length === 0 ? (
                <p className="p-6 text-sm text-ink-400 text-center">No rows failed.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Row</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.failed.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs text-ink-500">{r.row}</TableCell>
                        <TableCell className="text-danger text-xs">{r.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )
            )}
          </div>

          {/* Footer link */}
          <div className="px-5 py-3 border-t border-border bg-ink-50/30">
            <Link
              to={`/classes/${classId}/students`}
              className="text-sm text-just-blue-600 hover:underline"
            >
              ← Back to student list
            </Link>
          </div>
        </div>
      )}

      {/* ── Transfer confirmation dialog ────────────────────────────────────── */}
      <AlertDialog open={!!pendingTransfers} onOpenChange={(v) => !v && setPendingTransfers(null)}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Student Transfers</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingTransfers?.totalTransfers} student(s) are currently enrolled in other
              classes. Proceeding will move them to{' '}
              <span className="font-semibold text-ink-800">{className}</span>. Their previous
              enrollment will be archived.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="my-1 max-h-52 overflow-y-auto rounded-md border border-border divide-y divide-border text-sm">
            {pendingTransfers?.wouldTransfer.map((t) => (
              <div key={t.studentId} className="flex items-center gap-2 px-3 py-2">
                <span className="font-mono text-xs text-ink-400 shrink-0 w-20">{t.studentId}</span>
                <span className="text-ink-800 flex-1 truncate">{t.fullName}</span>
                <span className="text-xs text-ink-400 shrink-0">{t.fromClassName}</span>
                <ArrowRight size={11} className="text-ink-300 shrink-0" />
                <span className="text-xs font-medium text-just-blue-700 shrink-0">{t.toClassName}</span>
              </div>
            ))}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleUpload(true)}
              disabled={uploading}
            >
              {uploading && <Loader2 size={13} className="animate-spin" />}
              Confirm Transfer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
