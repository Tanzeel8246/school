import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';

interface RequestData {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  transaction_id: string;
  screenshot_url: string;
  created_at: string;
  plan_name: string;
  billing_cycle: string;
  school_name: string;
  requested_by_name: string;
}

export function SubscriptionRequestsPage() {
  const [requests, setRequests] = useState<RequestData[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadRequests = async () => {
    try {
      const res = await api.get<{ data: RequestData[] }>('/billing/admin/requests');
      setRequests(res.data.data || res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    if (!confirm(`Are you sure you want to ${action} this request?`)) return;
    setProcessingId(id);
    try {
      await api.post(`/billing/admin/requests/${id}/${action}`, { notes: `Processed manually` });
      await loadRequests();
    } catch (err) {
      alert('Failed to process request');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return <div className="flex h-32 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Subscription Requests</h1>
        <p className="text-muted-foreground mt-2">Approve or reject plan upgrades requested by schools.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">No requests found.</div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden bg-card">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-foreground text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">School</th>
                    <th className="px-6 py-4">Plan Requested</th>
                    <th className="px-6 py-4">Transaction ID</th>
                    <th className="px-6 py-4">Proof</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {requests.map(req => (
                    <tr key={req.id} className="hover:bg-muted/50/50 transition-colors">
                      <td className="px-6 py-4 text-muted-foreground font-medium">
                        {new Date(req.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-foreground">{req.school_name}</div>
                        <div className="text-xs text-muted-foreground">By: {req.requested_by_name}</div>
                      </td>
                      <td className="px-6 py-4 font-semibold text-foreground">
                        {req.plan_name} <span className="text-muted-foreground font-normal text-xs uppercase ml-1">({req.billing_cycle})</span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground font-mono text-xs">
                        {req.transaction_id}
                      </td>
                      <td className="px-6 py-4">
                        <a href={req.screenshot_url} target="_blank" rel="noreferrer" className="flex items-center text-primary hover:underline text-xs font-medium">
                          View <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 text-xs rounded-full uppercase font-bold tracking-wider ${
                          req.status === 'approved' ? 'bg-green-100 text-green-800' : 
                          req.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {req.status === 'pending' && (
                          <div className="flex justify-end gap-2">
                            <Button 
                              size="sm" 
                              className="bg-green-600 hover:bg-green-700"
                              disabled={processingId === req.id}
                              onClick={() => handleAction(req.id, 'approve')}
                            >
                              {processingId === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                              Approve
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive"
                              disabled={processingId === req.id}
                              onClick={() => handleAction(req.id, 'reject')}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
