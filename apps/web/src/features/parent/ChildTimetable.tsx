import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { TimetableSlotRow } from '@/lib/dto';

interface Props {
  studentId: string;
}

const WEEKDAYS = [
  { num: 1, label: 'Mon' },
  { num: 2, label: 'Tue' },
  { num: 3, label: 'Wed' },
  { num: 4, label: 'Thu' },
  { num: 5, label: 'Fri' },
  { num: 6, label: 'Sat' },
  { num: 7, label: 'Sun' },
];

export function ChildTimetable({ studentId }: Props) {
  const [slots, setSlots] = useState<TimetableSlotRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<TimetableSlotRow[] | { data: TimetableSlotRow[] }>(`/parent/children/${studentId}/timetable`)
      .then((res) => {
        if (cancelled) return;
        const body = res.data;
        const innerSlots = Array.isArray(body) ? body : (body as { data: TimetableSlotRow[] }).data ?? [];
        setSlots(innerSlots);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load timetable.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  // Build slot lookup: [weekday][period] → slot
  const lookup: Record<number, Record<number, TimetableSlotRow>> = {};
  for (const s of slots) {
    if (!lookup[s.weekday]) lookup[s.weekday] = {};
    lookup[s.weekday][s.period] = s;
  }

  const maxPeriod = slots.length > 0 ? Math.max(...slots.map((s) => s.period)) : 8;
  const periods = Array.from({ length: Math.max(maxPeriod, 1) }, (_, i) => i + 1);

  if (slots.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card py-10 text-center text-sm text-muted-foreground">
        No timetable slots configured for this student.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        {WEEKDAYS.map((w) => (
          <span key={w.num} className="rounded bg-muted px-2 py-0.5">
            {w.num} = {w.label}
          </span>
        ))}
      </div>

      {/* Grid — overflow scroll on small screens */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground w-16">
                Period
              </th>
              {WEEKDAYS.map((w) => (
                <th
                  key={w.num}
                  className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground min-w-[110px]"
                >
                  {w.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map((period) => (
              <tr key={period} className="border-t border-slate-100">
                <td className="px-3 py-2 text-xs font-semibold text-muted-foreground align-top">
                  P{period}
                </td>
                {WEEKDAYS.map((w) => {
                  const slot = lookup[w.num]?.[period];
                  return (
                    <td key={w.num} className="px-2 py-1.5 align-top">
                      {slot ? (
                        <div
                          className={cn(
                            'rounded-lg bg-primary/10 border border-primary/20 px-2 py-1.5',
                          )}
                        >
                          <p className="font-medium text-primary text-xs leading-tight">
                            {slot.subjectName}
                          </p>
                          <p className="text-primary/80 text-xs leading-tight mt-0.5">
                            {slot.teacherName}
                          </p>
                          <p className="text-primary/60 text-xs mt-0.5">
                            {slot.startTime}–{slot.endTime}
                          </p>
                        </div>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
