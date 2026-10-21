import { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Check, UploadCloud } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  fee: string;
  billing_cycle: 'monthly' | 'yearly' | 'lifetime';
  max_students: number | null;
  max_teachers: number | null;
  features: string[];
}

interface SubscriptionRequest {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  transaction_id: string;
  screenshot_url: string;
  created_at: string;
  plan_name: string;
  billing_cycle: string;
}

export function BillingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [schoolData, setSchoolData] = useState<any>(null);
  const [requests, setRequests] = useState<SubscriptionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [transactionId, setTransactionId] = useState('');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [plansRes, schoolRes, reqsRes] = await Promise.all([
          api.get<{ data: Plan[] }>('/billing/plans'),
          api.get<any>('/schools/current'),
          api.get<{ data: SubscriptionRequest[] }>('/billing/requests')
        ]);
        if (!cancelled) {
          setPlans(plansRes.data.data || plansRes.data);
          setSchoolData(schoolRes.data);
          setRequests(reqsRes.data.data || reqsRes.data);
        }
      } catch (err) {
        if (!cancelled) setError('Failed to load billing details.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;
    if (!screenshotFile) {
      setError('Please attach a payment screenshot');
      return;
    }

    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('planId', selectedPlan.id);
      formData.append('transactionId', transactionId);
      formData.append('screenshot', screenshotFile);

      // We cannot use standard api.post because of FormData (multipart/form-data)
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/billing/requests`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Failed to submit request');
      }

      setSuccess('Subscription request submitted successfully! Awaiting admin approval.');
      setSelectedPlan(null);
      setTransactionId('');
      setScreenshotFile(null);
      
      // Reload requests
      const reqsRes = await api.get<{ data: SubscriptionRequest[] }>('/billing/requests');
      setRequests(reqsRes.data.data || reqsRes.data);
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  const currentPlanId = schoolData?.plan_id;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Billing & Plans</h1>
        <p className="text-muted-foreground mt-2">Manage your SaaS subscription, request upgrades, and view billing history.</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <Card className="mb-6 bg-card/60 backdrop-blur-md shadow-sm border-border">
            <CardHeader>
              <CardTitle>Current Subscription</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-foreground w-24">Status: </span>
                  <span className={`px-3 py-1 text-xs rounded-full uppercase font-bold tracking-wider ${
                    schoolData?.subscription_status === 'active' ? 'bg-green-100 text-green-800' : 
                    schoolData?.subscription_status === 'trial' ? 'bg-blue-100 text-blue-800' : 
                    schoolData?.subscription_status === 'past_due' ? 'bg-orange-100 text-orange-800' : 
                    'bg-red-100 text-red-800'
                  }`}>
                    {schoolData?.subscription_status}
                  </span>
                </div>
                {schoolData?.plan_name && (
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-foreground w-24">Plan: </span>
                    <span className="text-foreground font-medium">{schoolData.plan_name}</span>
                  </div>
                )}
                {schoolData?.subscription_status === 'trial' && schoolData?.trial_ends_at && (
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-foreground w-24">Trial Ends: </span>
                    <span className="text-muted-foreground">{new Date(schoolData.trial_ends_at).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Upgrade Modal */}
          {selectedPlan && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <Card className="w-full max-w-lg shadow-2xl">
                <form onSubmit={handleSubmitRequest}>
                  <CardHeader>
                    <CardTitle>Request Plan Subscription</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      You selected the <span className="font-semibold text-foreground">{selectedPlan.name}</span> plan.
                      Please transfer the fee and upload your payment proof.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-muted/50 p-4 rounded-lg border border-slate-100 text-sm mb-4">
                      <p className="font-medium text-foreground mb-2">Bank Details for Transfer:</p>
                      <p className="text-muted-foreground">Bank Name: <span className="font-mono text-foreground">Meezan Bank</span></p>
                      <p className="text-muted-foreground">Account Title: <span className="font-mono text-foreground">EduCore ERP Solutions</span></p>
                      <p className="text-muted-foreground">Account Number: <span className="font-mono text-foreground">01234567891234</span></p>
                      <p className="text-muted-foreground font-semibold mt-2">Amount to Pay: Rs. {(parseInt(selectedPlan.fee)/100).toLocaleString()}</p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Transaction ID / Reference No</label>
                      <input 
                        type="text" 
                        required
                        className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="e.g. TID123456789"
                        value={transactionId}
                        onChange={e => setTransactionId(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Payment Screenshot</label>
                      <div 
                        className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          className="hidden" 
                          accept="image/*"
                          onChange={e => setScreenshotFile(e.target.files?.[0] || null)}
                        />
                        {screenshotFile ? (
                          <div className="flex flex-col items-center">
                            <Check className="h-8 w-8 text-green-500 mb-2" />
                            <span className="text-sm font-medium text-foreground">{screenshotFile.name}</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center text-muted-foreground">
                            <UploadCloud className="h-8 w-8 mb-2" />
                            <span className="text-sm">Click to upload screenshot</span>
                            <span className="text-xs mt-1">JPG, PNG up to 5MB</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-end gap-3 border-t bg-muted/50/50 p-4">
                    <Button type="button" variant="outline" onClick={() => setSelectedPlan(null)}>Cancel</Button>
                    <Button type="submit" disabled={submitting || !screenshotFile || !transactionId}>
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Submit Request
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </div>
          )}

          <h2 className="text-2xl font-bold tracking-tight text-foreground mt-10 mb-6">Available Plans</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => {
              const isCurrent = currentPlanId === plan.id;
              const fee = parseInt(plan.fee) / 100;
              
              return (
                <Card key={plan.id} className={`flex flex-col relative overflow-hidden transition-all duration-300 hover:shadow-xl ${isCurrent ? 'border-primary ring-2 ring-primary shadow-md' : 'border-border'}`}>
                  {isCurrent && (
                    <div className="absolute top-0 right-0 bg-primary text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                      CURRENT
                    </div>
                  )}
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl font-bold">{plan.name}</CardTitle>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-4xl font-extrabold tracking-tight text-foreground">Rs. {fee.toLocaleString()}</span>
                      <span className="text-sm font-medium text-muted-foreground capitalize">/ {plan.billing_cycle}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <ul className="space-y-3 text-sm text-muted-foreground">
                      <li className="flex items-center gap-3">
                        <div className="rounded-full bg-green-100 p-1"><Check className="h-3 w-3 text-green-600" /></div>
                        <span className="font-medium">{plan.max_students ? `Up to ${plan.max_students.toLocaleString()} Students` : 'Unlimited Students'}</span>
                      </li>
                      <li className="flex items-center gap-3">
                        <div className="rounded-full bg-green-100 p-1"><Check className="h-3 w-3 text-green-600" /></div>
                        <span className="font-medium">{plan.max_teachers ? `Up to ${plan.max_teachers.toLocaleString()} Teachers` : 'Unlimited Teachers'}</span>
                      </li>
                      {plan.features.map(f => (
                        <li key={f} className="flex items-center gap-3">
                          <div className="rounded-full bg-green-100 p-1"><Check className="h-3 w-3 text-green-600" /></div>
                          <span className="capitalize">{f.replace('_', ' ')} Module</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter className="pt-4 border-t border-slate-100">
                    <Button 
                      className="w-full font-semibold" 
                      variant={isCurrent ? "secondary" : "default"}
                      disabled={isCurrent}
                      onClick={() => setSelectedPlan(plan)}
                    >
                      {isCurrent ? 'Active Plan' : 'Select Plan'}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>

          {/* Past Requests Table */}
          {requests.length > 0 && (
            <div className="mt-12">
              <h2 className="text-2xl font-bold tracking-tight text-foreground mb-6">Subscription Requests History</h2>
              <div className="rounded-xl border border-border overflow-hidden bg-card">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-foreground text-xs uppercase font-semibold">
                    <tr>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Plan Requested</th>
                      <th className="px-6 py-4">Transaction ID</th>
                      <th className="px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {requests.map(req => (
                      <tr key={req.id} className="hover:bg-muted/50/50 transition-colors">
                        <td className="px-6 py-4 text-muted-foreground font-medium">
                          {new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="px-6 py-4 font-semibold text-foreground">
                          {req.plan_name} <span className="text-muted-foreground font-normal text-xs uppercase ml-1">({req.billing_cycle})</span>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground font-mono text-xs">
                          {req.transaction_id}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 text-xs rounded-full uppercase font-bold tracking-wider ${
                            req.status === 'approved' ? 'bg-green-100 text-green-800' : 
                            req.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {req.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
