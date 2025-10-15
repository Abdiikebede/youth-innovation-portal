import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { timeAgo } from '@/utils/time';

export default function Requests() {
  const qc = useQueryClient();
  const [type, setType] = useState<'funding' | 'certificate'>('funding');
  const [showForm, setShowForm] = useState(false);
  const [proposalFile, setProposalFile] = useState<File | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['my-requests'],
    queryFn: () => api.getMyRequests(),
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.createRequest(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-requests'] });
      setForm(initialForm);
      setProposalFile(null);
      alert('Request submitted successfully');
      setShowForm(false);
    },
    onError: async (err: any) => {
      alert(err?.message || 'Failed to submit request');
    }
  });

  const initialForm = useMemo(() => ({
    title: '',
    amount: '' as any,
    description: '', // used for certificate only
    projectLink: '', // not used for funding anymore
    certificateType: 'participation',
    link: '',
  }), []);

  const [form, setForm] = useState(initialForm);

  // use shared timeAgo()

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { type };
    if (type === 'funding') {
      const amt = Number(form.amount);
      if (!form.title || !form.amount || isNaN(amt) || amt <= 0) {
        alert('Please provide Title and Amount (>0)');
        return;
      }
      payload.title = form.title;
      payload.amount = amt;
      if (proposalFile) payload.proposal = proposalFile;
    } else {
      if (!form.certificateType || !form.description || !form.link) {
        alert('Please provide Certificate Type, Reference Link and Additional Details');
        return;
      }
      payload.certificateType = form.certificateType || 'participation';
      payload.description = form.description;
      payload.link = form.link;
    }
    createMutation.mutate(payload);
  };

  return (
    <div className="max-w-3xl mx-auto p-4">
      <p className="text-muted-foreground mb-4">Submit a request for funding or a certificate, and track your previous submissions.</p>

      {/* Type Switcher */}
      <div className="flex gap-2 mb-4">
        <Button
          variant="outline"
          className={
            type === 'funding' && showForm
              ? 'bg-[#2e9891] text-white border-[#2e9891] hover:bg-[#2e9891] active:bg-[#2e9891]'
              : 'hover:bg-[#2e9891] active:bg-[#2e9891] hover:text-white active:text-white'
          }
          onClick={() => { setType('funding'); setShowForm(true); }}
        >
          Funding
        </Button>
        <Button
          variant="outline"
          className={
            type === 'certificate' && showForm
              ? 'bg-[#2e9891] text-white border-[#2e9891] hover:bg-[#2e9891] active:bg-[#2e9891]'
              : 'hover:bg-[#2e9891] active:bg-[#2e9891] hover:text-white active:text-white'
          }
          onClick={() => { setType('certificate'); setShowForm(true); }}
        >
          Certificate
        </Button>
      </div>

      {showForm && (
        <form onSubmit={onSubmit} className="space-y-4 bg-card p-4 rounded-lg border">
          {type === 'funding' ? (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <input required className="w-full border rounded px-3 py-2 bg-background" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g., Seed funding for prototype" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Amount</label>
              <input required min={1} type="number" className="w-full border rounded px-3 py-2 bg-background" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="e.g., 50000" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Proposal Document (PDF/DOCX)</label>
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center px-3 py-2 border rounded bg-background hover:bg-muted cursor-pointer text-sm">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="hidden"
                    onChange={(e) => setProposalFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
                  />
                  {proposalFile ? 'Change file' : 'Upload file'}
                </label>
                {proposalFile && (
                  <span className="text-xs text-muted-foreground truncate max-w-[60%]">{proposalFile.name}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Optional. Max 25MB. Accepted: PDF, DOC, DOCX.</p>
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">Certificate Type</label>
              <select required className="w-full border rounded px-3 py-2 bg-background" value={form.certificateType} onChange={e => setForm({ ...form, certificateType: e.target.value })}>
                <option value="participation">Participation</option>
                <option value="completion">Completion</option>
                <option value="excellence">Excellence</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Reference Link</label>
              <input required className="w-full border rounded px-3 py-2 bg-background" value={form.link} onChange={e => setForm({ ...form, link: e.target.value })} placeholder="e.g., event page, project page" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Additional Details</label>
              <textarea required className="w-full border rounded px-3 py-2 bg-background" rows={4} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Anything we should know to issue your certificate" />
            </div>
          </>
        )}

          <div className="flex items-center justify-between">
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="bg-[#2e9891] text-white hover:bg-[#2e9891] active:bg-[#2e9891]"
            >
              {createMutation.isPending ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </form>
      )}

      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-2">My Requests</h2>
        {isLoading && <p>Loading...</p>}
        {error && <p className="text-red-500">Failed to load requests</p>}
        <div className="space-y-3">
          {data?.requests?.length ? data.requests.map((r: any) => (
            <div key={r._id} className="border rounded-lg p-4 bg-card">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm uppercase tracking-wide text-muted-foreground">{r.type}</span>
                <span className="text-xs px-2 py-1 rounded-full border bg-background">{r.status}</span>
              </div>
              {r.title && <h3 className="font-medium">{r.title}</h3>}
              {r.amount != null && <p className="text-sm">Amount: {r.amount}</p>}
              {r.certificateType && <p className="text-sm">Certificate: {r.certificateType}</p>}
              {r.description && <p className="text-sm text-muted-foreground mt-1">{r.description}</p>}
              {r.proposalUrl && (
                <div className="mt-2 text-sm">
                  <a href={r.proposalUrl} target="_blank" rel="noreferrer" className="text-innovation-600 hover:underline">View proposal</a>
                </div>
              )}
              <div className="text-xs text-muted-foreground mt-2">{timeAgo(r.createdAt)}</div>
            </div>
          )) : (
            <p className="text-muted-foreground">No requests yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
