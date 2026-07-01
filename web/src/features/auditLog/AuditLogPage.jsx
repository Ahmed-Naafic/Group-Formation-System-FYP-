import { useState } from 'react';
import { Loader2, ChevronLeft, ChevronRight, ShieldAlert } from 'lucide-react';
import { useGetAuditLogsQuery } from './auditLogApi';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

// ── Config ─────────────────────────────────────────────────────────────────────

const ACTIONS = [
  'GROUP_GENERATED',
  'TASK_CREATED',
  'SUBMISSION_GRADED',
  'PASSWORD_RESET',
];

const ENTITY_KINDS = ['Group', 'Task', 'Submission', 'User'];

const ACTION_VARIANT = {
  GROUP_GENERATED:   'default',
  TASK_CREATED:      'warning',
  SUBMISSION_GRADED: 'success',
  PASSWORD_RESET:    'secondary',
};

const ROLE_VARIANT = {
  admin:      'warning',
  instructor: 'default',
  student:    'success',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatTs(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function shortId(id) {
  if (!id) return '—';
  const s = String(id);
  return s.length > 8 ? `…${s.slice(-8)}` : s;
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AuditLogPage() {
  const [action,     setAction]     = useState('');
  const [entityKind, setEntityKind] = useState('');
  const [page,       setPage]       = useState(1);

  const { data, isLoading, error, isFetching } = useGetAuditLogsQuery({
    action:     action     || undefined,
    entityKind: entityKind || undefined,
    page,
    limit: 50,
  });

  const logs  = data?.logs   ?? [];
  const total = data?.total  ?? 0;
  const pages = data?.pages  ?? 1;

  function handleActionChange(val) {
    setAction(val === 'all' ? '' : val);
    setPage(1);
  }

  function handleEntityKindChange(val) {
    setEntityKind(val === 'all' ? '' : val);
    setPage(1);
  }

  function resetFilters() {
    setAction('');
    setEntityKind('');
    setPage(1);
  }

  const hasFilters = action || entityKind;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-ink-900 leading-none">Audit Log</h2>
          {total > 0 && (
            <p className="text-sm text-ink-500 mt-1">{total.toLocaleString()} entries</p>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <Select value={action || 'all'} onValueChange={handleActionChange}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {ACTIONS.map((a) => (
              <SelectItem key={a} value={a}>{a.replace(/_/g, ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={entityKind || 'all'} onValueChange={handleEntityKindChange}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All entities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All entities</SelectItem>
            {ENTITY_KINDS.map((k) => (
              <SelectItem key={k} value={k}>{k}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="text-ink-500">
            Reset
          </Button>
        )}

        {isFetching && !isLoading && (
          <Loader2 size={14} className="animate-spin text-ink-400 ml-1" />
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={22} className="animate-spin text-ink-300" />
        </div>
      ) : error ? (
        <p className="text-sm text-danger">{error?.data?.error?.message ?? 'Failed to load audit logs.'}</p>
      ) : logs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-white py-16 flex flex-col items-center gap-3">
          <ShieldAlert size={32} className="text-ink-200" />
          <p className="text-sm text-ink-400">No audit entries match your filters.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-white shadow-xs overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-44">Timestamp</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log._id}>
                  <TableCell className="text-xs text-ink-500 whitespace-nowrap">
                    {formatTs(log.timestamp)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-ink-800">
                        {log.actorId?.fullName ?? log.actorId?.email ?? '—'}
                      </span>
                      <Badge
                        variant={ROLE_VARIANT[log.actorRole] ?? 'secondary'}
                        className="text-[10px] px-1.5 py-0 h-4 capitalize"
                      >
                        {log.actorRole}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={ACTION_VARIANT[log.action] ?? 'secondary'} className="text-xs">
                      {log.action.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-ink-700">{log.entityKind}</span>
                    {log.entityId && (
                      <span className="ml-1.5 font-mono text-[11px] text-ink-400">
                        {shortId(log.entityId)}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-ink-500">
            Page {page} of {pages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1 || isFetching}
            >
              <ChevronLeft size={14} /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= pages || isFetching}
            >
              Next <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
