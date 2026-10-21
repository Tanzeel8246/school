import { useState } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toMinor } from '@/lib/format';

interface Props {
  open: boolean;
  onClose: () => void;
}

const currentPeriod = () => new Date().toISOString().slice(0, 7); // YYYY-MM

/** POST /staff/payroll/run — generate payslips for a period. */
export function RunPayrollDialog({ open, onClose }: Props) {
  const [period, setPeriod] = useState(currentPeriod());
  const [allowances, setAllowances] = useState('');
  const [deductions, setDeductions] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<number | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const body: Record<string, unknown> = { period };
      if (allowances) body.allowances = toMinor(allowances);
      if (deductions) body.deductions = toMinor(deductions);
      const res = await api.post<{ generated?: number; count?: number; payslips?: unknown[] }>(
        '/staff/payroll/run',
        body,
      );
      const d = res.data;
      setResult(d.generated ?? d.count ?? d.payslips?.length ?? 0);
    } catch (err) {
      setError(err instanceof ApiError ? 'Payroll run failed.' : 'Payroll run failed.');
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setResult(null);
    setError(null);
    onClose();
  }

  return (
    <Dialog open={open} onClose={close}>
      <DialogHeader title="Run payroll" description="Generate payslips for a month." onClose={close} />
      <DialogBody className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        {result !== null ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <p className="text-sm text-foreground">
              Generated <span className="font-semibold">{result}</span> payslip{result === 1 ? '' : 's'} for{' '}
              {period}.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="period">Period (YYYY-MM)</Label>
              <Input
                id="period"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder="2026-06"
                pattern="\d{4}-\d{2}"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Allowances (Rs., optional)</Label>
                <Input
                  type="number"
                  value={allowances}
                  onChange={(e) => setAllowances(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Deductions (Rs., optional)</Label>
                <Input
                  type="number"
                  value={deductions}
                  onChange={(e) => setDeductions(e.target.value)}
                />
              </div>
            </div>
          </>
        )}
      </DialogBody>
      <DialogFooter>
        {result !== null ? (
          <Button onClick={close}>Done</Button>
        ) : (
          <>
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button disabled={busy || !/^\d{4}-\d{2}$/.test(period)} onClick={run}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Run payroll
            </Button>
          </>
        )}
      </DialogFooter>
    </Dialog>
  );
}
