import { useState, useEffect, type FormEvent } from 'react';
import {
  ShieldCheck,
  ShieldOff,
  Loader2,
  RefreshCw,
  Download,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '@/components/ui/dialog';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TwoFaStatus {
  twoFaEnabled: boolean;
  requiresSetup: boolean;
  role: string;
}

type SetupStep = 1 | 2 | 3;

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const payload = err.payload as { message?: string } | undefined;
    return payload?.message ?? 'Request failed. Please try again.';
  }
  return 'Something went wrong. Please try again.';
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Inline Setup Wizard (Dialog) ─────────────────────────────────────────────

interface SetupWizardProps {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}

function SetupWizardDialog({ open, onClose, onDone }: SetupWizardProps) {
  const [step, setStep] = useState<SetupStep>(1);

  // Step 1
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);

  // Step 2
  const [confirmCode, setConfirmCode] = useState('');
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // Step 3
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  // Fetch QR when dialog opens
  useEffect(() => {
    if (!open) return;
    // Reset state whenever dialog opens
    setStep(1);
    setQrDataUrl(null);
    setSecret(null);
    setSetupError(null);
    setConfirmCode('');
    setConfirmError(null);
    setRecoveryCodes([]);

    let cancelled = false;
    (async () => {
      setSetupLoading(true);
      try {
        const { data } = await api.post<{ secret: string; qrDataUrl: string }>(
          '/auth/2fa/setup',
          {},
        );
        if (cancelled) return;
        setQrDataUrl(data.qrDataUrl);
        setSecret(data.secret);
      } catch (err) {
        if (!cancelled) setSetupError(errorMessage(err));
      } finally {
        if (!cancelled) setSetupLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  async function onConfirm(e: FormEvent) {
    e.preventDefault();
    if (confirmCode.length !== 6) return;
    setConfirmLoading(true);
    setConfirmError(null);
    try {
      const { data } = await api.post<{ recoveryCodes: string[] }>('/auth/2fa/confirm', {
        token: confirmCode,
      });
      setRecoveryCodes(data.recoveryCodes);
      setStep(3);
    } catch (err) {
      setConfirmError(errorMessage(err));
    } finally {
      setConfirmLoading(false);
    }
  }

  function onDownload() {
    const content = [
      'School ERP — Two-Factor Recovery Codes',
      'Generated: ' + new Date().toISOString(),
      '',
      'Keep these codes safe. Each code can only be used once.',
      '',
      ...recoveryCodes,
    ].join('\n');
    downloadTextFile('school-erp-recovery-codes.txt', content);
  }

  const stepLabels = ['Scan QR', 'Verify', 'Save Codes'];

  return (
    <Dialog open={open} onClose={onClose} className="sm:max-w-lg">
      <DialogHeader
        title="Enable Two-Factor Authentication"
        description={`Step ${step} of 3 — ${stepLabels[step - 1]}`}
        onClose={onClose}
      />

      <DialogBody className="space-y-4">
        {/* Step 1 — Scan QR */}
        {step === 1 && (
          <div className="space-y-4">
            {setupLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
            {setupError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {setupError}
              </div>
            )}
            {qrDataUrl && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Scan this QR code with your authenticator app (e.g. Google Authenticator,
                  Authy).
                </p>
                <div className="flex justify-center">
                  <img
                    src={qrDataUrl}
                    alt="2FA QR code"
                    className="h-44 w-44 rounded-lg border border-border"
                  />
                </div>
                {secret && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Or enter this secret manually:</p>
                    <div className="rounded-lg bg-muted/50 px-3 py-2 font-mono text-sm tracking-widest text-foreground break-all">
                      {secret}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 2 — Verify */}
        {step === 2 && (
          <form id="confirm-form" onSubmit={onConfirm} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter the 6-digit code from your authenticator app to confirm setup.
            </p>
            {confirmError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {confirmError}
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="setup-confirm-code">
                Verification code
              </label>
              <Input
                id="setup-confirm-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                maxLength={6}
                autoFocus
                placeholder="000000"
                value={confirmCode}
                onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="text-center text-lg tracking-widest"
              />
            </div>
          </form>
        )}

        {/* Step 3 — Recovery Codes */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <strong>These codes will not be shown again.</strong> Save them now in a secure
              location. Each code can only be used once.
            </div>
            <div className="grid grid-cols-2 gap-2">
              {recoveryCodes.map((code) => (
                <div
                  key={code}
                  className="rounded-lg bg-primary/10 px-3 py-2 text-center font-mono text-sm font-medium text-primary tracking-wider"
                >
                  {code}
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full" onClick={onDownload}>
              <Download className="h-4 w-4" />
              Download Recovery Codes
            </Button>
          </div>
        )}
      </DialogBody>

      <DialogFooter>
        {step === 1 && (
          <>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => setStep(2)} disabled={!qrDataUrl}>
              Next
            </Button>
          </>
        )}
        {step === 2 && (
          <>
            <Button
              variant="outline"
              onClick={() => { setStep(1); setConfirmCode(''); setConfirmError(null); }}
            >
              Back
            </Button>
            <Button
              form="confirm-form"
              type="submit"
              disabled={confirmLoading || confirmCode.length !== 6}
            >
              {confirmLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm
            </Button>
          </>
        )}
        {step === 3 && (
          <Button onClick={onDone}>
            Done
          </Button>
        )}
      </DialogFooter>
    </Dialog>
  );
}

// ─── Disable 2FA Dialog ────────────────────────────────────────────────────────

interface DisableDialogProps {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}

function DisableTwoFaDialog({ open, onClose, onDone }: DisableDialogProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) { setCode(''); setError(null); }
  }, [open]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return;
    setLoading(true);
    setError(null);
    try {
      await api.post('/auth/2fa/disable', { token: code });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader
        title="Disable Two-Factor Authentication"
        description="Enter your current authenticator code to confirm."
        onClose={onClose}
      />
      <DialogBody>
        <form id="disable-form" onSubmit={onSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="disable-totp">
              Authenticator code
            </label>
            <Input
              id="disable-totp"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="text-center text-lg tracking-widest"
            />
          </div>
        </form>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          form="disable-form"
          type="submit"
          variant="destructive"
          disabled={loading || code.length !== 6}
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Disable 2FA
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

// ─── Regenerate Recovery Codes Dialog ─────────────────────────────────────────

interface RegenDialogProps {
  open: boolean;
  onClose: () => void;
}

function RegenCodesDialog({ open, onClose }: RegenDialogProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newCodes, setNewCodes] = useState<string[]>([]);

  useEffect(() => {
    if (!open) { setCode(''); setError(null); setNewCodes([]); }
  }, [open]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post<{ recoveryCodes: string[] }>(
        '/auth/2fa/recovery-codes/regenerate',
        { token: code },
      );
      setNewCodes(data.recoveryCodes);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function onDownload() {
    const content = [
      'School ERP — Two-Factor Recovery Codes (Regenerated)',
      'Generated: ' + new Date().toISOString(),
      '',
      'These are your new recovery codes. Previous codes are now invalid.',
      '',
      ...newCodes,
    ].join('\n');
    downloadTextFile('school-erp-recovery-codes.txt', content);
  }

  const hasCodes = newCodes.length > 0;

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader
        title="Regenerate Recovery Codes"
        description={hasCodes ? 'Save your new codes below.' : 'Enter your authenticator code to regenerate recovery codes.'}
        onClose={onClose}
      />
      <DialogBody>
        {!hasCodes ? (
          <form id="regen-form" onSubmit={onSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="regen-totp">
                Authenticator code
              </label>
              <Input
                id="regen-totp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                maxLength={6}
                autoFocus
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="text-center text-lg tracking-widest"
              />
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <strong>These codes will not be shown again.</strong> Your previous recovery codes
              are now invalid.
            </div>
            <div className="grid grid-cols-2 gap-2">
              {newCodes.map((c) => (
                <div
                  key={c}
                  className="rounded-lg bg-primary/10 px-3 py-2 text-center font-mono text-sm font-medium text-primary tracking-wider"
                >
                  {c}
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full" onClick={onDownload}>
              <Download className="h-4 w-4" />
              Download Codes
            </Button>
          </div>
        )}
      </DialogBody>
      <DialogFooter>
        {!hasCodes ? (
          <>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              form="regen-form"
              type="submit"
              disabled={loading || code.length !== 6}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Regenerate
            </Button>
          </>
        ) : (
          <Button onClick={onClose}>Done</Button>
        )}
      </DialogFooter>
    </Dialog>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export function SecuritySettingsPage() {
  const { user } = useAuth();

  const [status, setStatus] = useState<TwoFaStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [setupOpen, setSetupOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);

  async function loadStatus() {
    setStatusLoading(true);
    setStatusError(null);
    try {
      const { data } = await api.get<TwoFaStatus>('/auth/2fa/status');
      setStatus(data);
    } catch (err) {
      setStatusError(errorMessage(err));
    } finally {
      setStatusLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSetupDone() {
    setSetupOpen(false);
    loadStatus();
  }

  function handleDisableDone() {
    setDisableOpen(false);
    loadStatus();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Security Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage two-factor authentication for{' '}
          <span className="font-medium text-foreground">{user?.name ?? 'your account'}</span>.
        </p>
      </div>

      {/* Status card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Two-Factor Authentication</CardTitle>
            {status && (
              <Badge variant={status.twoFaEnabled ? 'success' : 'default'}>
                {status.twoFaEnabled ? '2FA Active' : '2FA Disabled'}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {statusLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading status…
            </div>
          )}

          {statusError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {statusError}
              <button
                className="ml-2 underline hover:no-underline"
                type="button"
                onClick={loadStatus}
              >
                Retry
              </button>
            </div>
          )}

          {!statusLoading && status && !status.twoFaEnabled && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/50 p-4">
                <ShieldOff className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    Protect your account with 2FA
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Two-factor authentication adds an extra layer of security. After enabling, you
                    will be asked for a code from your authenticator app each time you sign in.
                  </p>
                </div>
              </div>
              <Button onClick={() => setSetupOpen(true)}>
                <ShieldCheck className="h-4 w-4" />
                Enable 2FA
              </Button>
            </div>
          )}

          {!statusLoading && status && status.twoFaEnabled && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-emerald-800">
                    Two-factor authentication is active
                  </p>
                  <p className="text-sm text-emerald-700">
                    Your account is protected. You'll be asked for a verification code each time
                    you sign in.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  onClick={() => setRegenOpen(true)}
                  className="flex-1"
                >
                  <RefreshCw className="h-4 w-4" />
                  Regenerate Recovery Codes
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setDisableOpen(true)}
                  className="flex-1 sm:flex-none"
                >
                  <ShieldOff className="h-4 w-4" />
                  Disable 2FA
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <SetupWizardDialog
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        onDone={handleSetupDone}
      />
      <DisableTwoFaDialog
        open={disableOpen}
        onClose={() => setDisableOpen(false)}
        onDone={handleDisableDone}
      />
      <RegenCodesDialog
        open={regenOpen}
        onClose={() => setRegenOpen(false)}
      />
    </div>
  );
}
