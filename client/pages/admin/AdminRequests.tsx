import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/utils/time";

type RequestItem = {
  _id: string;
  userId: string;
  type: "funding" | "certificate";
  title?: string;
  amount?: number;
  description?: string;
  projectLink?: string;
  certificateType?: string;
  link?: string;
  proposalUrl?: string;
  proposalOriginalName?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  userFirstName?: string;
  userLastName?: string;
  userEmail?: string;
  userAvatar?: string;
  userName?: string;
};

const TypeBadge = ({ type }: { type: string }) => (
  <Badge className={type === 'funding' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'}>
    {type}
  </Badge>
);

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-rose-100 text-rose-800',
  };
  return <Badge className={map[status] || 'bg-slate-100 text-slate-800'}>{status}</Badge>;
};

export default function AdminRequests() {
  const [filter, setFilter] = useState<"funding" | "certificate">("funding");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    id: string;
    nextStatus: 'pending' | 'submitted';
  } | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewItem, setReviewItem] = useState<RequestItem | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-requests"],
    queryFn: async () => {
      const res = await api.getAllRequestsAdmin();
      return res.requests || [];
    },
  });

  // Static assets are served from the backend and proxied by Vite; use relative paths.

  const fundingCount = useMemo(
    () => (data ? data.filter((r: RequestItem) => r.type === "funding").length : 0),
    [data]
  );
  const certificateCount = useMemo(
    () => (data ? data.filter((r: RequestItem) => r.type === "certificate").length : 0),
    [data]
  );

  const filtered = useMemo(() => {
    if (!data) return [] as RequestItem[];
    return (data as RequestItem[]).filter((r) => r.type === filter);
  }, [data, filter]);

  const pendingIds = useMemo(() => filtered.filter(r => String(r.status).toLowerCase() !== 'submitted').map(r => r._id), [filtered]);
  const allVisibleIds = pendingIds; // backward compat alias
  const toggleSelect = (id: string, checked: boolean) => {
    // guard: only allow selecting pending items
    const target = filtered.find(r => r._id === id);
    if (!target || String(target.status).toLowerCase() === 'submitted') return;
    setSelected(prev => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };
  const toggleSelectAll = (checked: boolean) => {
    setSelected(() => checked ? new Set(pendingIds) : new Set());
  };
  const selectedCount = selected.size;

  const getAvatarUrl = (avatar?: string) => {
    if (!avatar) return "";
    if (avatar.startsWith("http://") || avatar.startsWith("https://")) return avatar;
    // ensure leading slash and return relative, e.g. /avatars/filename or /uploads/avatars/filename
    return avatar.startsWith("/") ? avatar : `/${avatar}`;
  };

  // use shared timeAgo()

  const requestStatusChange = (req: RequestItem) => {
    const current = (req.status || 'pending').toLowerCase();
    if (current === 'submitted') return; // irreversible; no action
    setPendingAction({ id: req._id, nextStatus: 'submitted' });
    setConfirmOpen(true);
  };

  const confirmUpdate = async () => {
    if (!pendingAction) return;
    try {
      setUpdating(true);
      await api.updateRequestStatusAdmin(pendingAction.id, pendingAction.nextStatus);
      toast({ title: 'Status updated', description: `Request marked as ${pendingAction.nextStatus}. This action is not reversible. Notification sent.` });
      setConfirmOpen(false);
      setPendingAction(null);
      await refetch();
    } catch (e: any) {
      toast({ title: 'Failed to update', description: e?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setUpdating(false);
    }
  };

  const confirmBulk = async () => {
    if (selectedCount === 0) return;
    try {
      setUpdating(true);
      await api.bulkSubmitRequestsAdmin(Array.from(selected));
      toast({ title: 'Submitted', description: `Marked ${selectedCount} request(s) as submitted. This action is not reversible. Notifications sent.` });
      setBulkOpen(false);
      setSelected(new Set());
      await refetch();
    } catch (e: any) {
      toast({ title: 'Bulk action failed', description: e?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setUpdating(false);
    }
  };

  const openReview = (item: RequestItem) => {
    setReviewItem(item);
    setReviewOpen(true);
  };

  const submitCurrent = async () => {
    if (!reviewItem) return;
    try {
      setUpdating(true);
      await api.updateRequestStatusAdmin(reviewItem._id, 'submitted');
      toast({ title: 'Submitted', description: 'Request has been marked as submitted.' });
      setReviewOpen(false);
      setReviewItem(null);
      await refetch();
    } catch (e: any) {
      toast({ title: 'Submit failed', description: e?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-4 gap-3">
        {/* Filters */}
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
          <button
            className={cn(
              "px-3 py-1.5 rounded-full text-sm border",
              filter === "funding" ? "bg-[#2e9891] text-white border-[#2e9891]" : "bg-background text-foreground hover:bg-muted"
            )}
            onClick={() => setFilter("funding")}
          >
            Funding <Badge className="ml-2 bg-emerald-100 text-emerald-800">{fundingCount}</Badge>
          </button>
          <button
            className={cn(
              "px-3 py-1.5 rounded-full text-sm border",
              filter === "certificate" ? "bg-[#2e9891] text-white border-[#2e9891]" : "bg-background text-foreground hover:bg-muted"
            )}
            onClick={() => setFilter("certificate")}
          >
            Certificate <Badge className="ml-2 bg-indigo-100 text-indigo-800">{certificateCount}</Badge>
          </button>
        </div>
        {/* Desktop actions only */}
        <div className="hidden md:flex items-center gap-2">
          <Button onClick={() => refetch()} className="bg-[#2e9891] text-white hover:bg-[#2e9891] active:bg-[#2e9891]">Refresh</Button>
          <Button
            disabled={selectedCount === 0}
            onClick={() => setBulkOpen(true)}
            className="bg-[#2e9891] text-white hover:bg-[#2e9891] active:bg-[#2e9891]"
          >
            Mark Submitted ({selectedCount})
          </Button>
        </div>
      </div>

      {isLoading && <div>Loading requests...</div>}
      {error && <div className="text-red-600">Failed to load requests</div>}

      {!isLoading && !error && (
        <>
          {/* Confirm dialog */}
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm status update</DialogTitle>
                <DialogDescription>
                  {pendingAction ? `Change status to '${pendingAction.nextStatus}' and notify the user?` : ''}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={updating}>Cancel</Button>
                <Button onClick={confirmUpdate} disabled={updating} className="bg-innovation-600 text-white hover:bg-innovation-700">
                  {updating ? 'Updating...' : 'Confirm'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Review dialog */}
          <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <TypeBadge type={reviewItem?.type || ''} />
                  <span>Review {reviewItem?.type === 'funding' ? 'Funding' : 'Certificate'} Request</span>
                </DialogTitle>
                <DialogDescription>Inspect details and take an action.</DialogDescription>
              </DialogHeader>
              {reviewItem && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Left: Details */}
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <StatusBadge status={reviewItem.status} />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">User</div>
                      <div className="font-medium">{reviewItem.userName || [reviewItem.userFirstName, reviewItem.userLastName].filter(Boolean).join(' ') || reviewItem.userEmail || '-'}</div>
                      <div className="text-xs text-muted-foreground">{reviewItem.userEmail || '-'}</div>
                    </div>
                    {reviewItem.type === 'funding' ? (
                      <>
                        <div>
                          <div className="text-xs text-muted-foreground">Title</div>
                          <div className="font-medium">{reviewItem.title || '-'}</div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-muted-foreground">Amount</div>
                          <div className="font-semibold">{reviewItem.amount ? `ETB ${reviewItem.amount}` : '-'}</div>
                        </div>
                        {reviewItem.projectLink && (
                          <div>
                            <div className="text-xs text-muted-foreground">Project Link</div>
                            <a className="text-innovation-600 hover:underline break-all" href={reviewItem.projectLink} target="_blank" rel="noreferrer">{reviewItem.projectLink}</a>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <div className="text-xs text-muted-foreground">Certificate</div>
                            <div className="font-medium">{reviewItem.certificateType || '-'}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">Created</div>
                            <div className="font-medium">{timeAgo(reviewItem.createdAt)}</div>
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Reference Link</div>
                          {reviewItem.link ? (
                            <a className="text-innovation-600 hover:underline break-all" href={reviewItem.link} target="_blank" rel="noreferrer">{reviewItem.link}</a>
                          ) : (
                            <div className="text-muted-foreground">-</div>
                          )}
                        </div>
                        {reviewItem.description && (
                          <div>
                            <div className="text-xs text-muted-foreground">Details</div>
                            <div className="text-muted-foreground whitespace-pre-wrap">{reviewItem.description}</div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Right: Proposal preview (funding only) */}
                  <div className="space-y-2">
                    {reviewItem.type === 'funding' ? (
                      reviewItem.proposalUrl ? (
                        <div className="p-4 border rounded-md">
                          <div className="text-sm text-muted-foreground mb-2">Proposal Document</div>
                          <a href={reviewItem.proposalUrl} target="_blank" rel="noreferrer">
                            <Button className="bg-[#2e9891] text-white hover:bg-[#2e9891] active:bg-[#2e9891]">Open Proposal</Button>
                          </a>
                          {reviewItem.proposalOriginalName && (
                            <div className="mt-2 text-xs text-muted-foreground break-all">{reviewItem.proposalOriginalName}</div>
                          )}
                        </div>
                      ) : (
                        <div className="h-[120px] flex items-center justify-center border rounded-md text-sm text-muted-foreground">No proposal uploaded</div>
                      )
                    ) : (
                      <div className="h-[120px] flex items-center justify-center border rounded-md text-sm text-muted-foreground">No attachment</div>
                    )}
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setReviewOpen(false)} disabled={updating}>Close</Button>
                {(() => {
                  const isSubmitted = (reviewItem?.status || '').toLowerCase() === 'submitted';
                  return (
                    <Button
                      onClick={submitCurrent}
                      disabled={updating || isSubmitted}
                      className={
                        `bg-[#2e9891] text-white hover:bg-[#2e9891] active:bg-[#2e9891] ${isSubmitted ? 'opacity-60 cursor-not-allowed hover:bg-[#2e9891]' : ''}`
                      }
                    >
                      {isSubmitted ? 'Already Submitted' : 'Mark Submitted'}
                    </Button>
                  );
                })()}
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Bulk confirm dialog */}
          <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Mark {selectedCount} request(s) as submitted?</DialogTitle>
                <DialogDescription>
                  This action is <strong>not reversible</strong>. The selected users will receive a notification to check their email and respond promptly.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBulkOpen(false)} disabled={updating}>Cancel</Button>
                <Button onClick={confirmBulk} disabled={updating || selectedCount === 0} className="bg-[#2e9891] text-white hover:bg-[#2e9891] active:bg-[#2e9891]">
                  {updating ? 'Submitting…' : `Confirm (${selectedCount})`}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {/* Mobile: cards (no refresh/mark submitted, no selection) */}
          <div className="grid gap-3 md:hidden">
            {filtered.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground">
                No requests yet.
              </div>
            ) : (
              filtered.map((r: RequestItem) => {
                const isSubmitted = String(r.status).toLowerCase() === 'submitted';
                return (
                <div key={r._id} className={`rounded-lg border border-border p-4 bg-card ${isSubmitted ? 'opacity-60' : ''}`}>
                  <div className="flex items-start gap-3">
                    <img src={r.userAvatar || '/avatar.png'} className="w-10 h-10 rounded-full object-cover" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{r.userName || [r.userFirstName, r.userLastName].filter(Boolean).join(' ') || r.userEmail || '-'}</div>
                      <div className="text-xs text-muted-foreground truncate">{r.userEmail || '-'}</div>
                    </div>
                    {isSubmitted ? (
                      <Badge className="bg-green-100 text-green-800">Submitted</Badge>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => openReview(r)}>
                        Review
                      </Button>
                    )}
                  </div>
                </div>
              );})
            )}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block overflow-x-auto rounded-lg border border-border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3">User</th>
                  <th className="text-left px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r: RequestItem) => {
                  const isSubmitted = String(r.status).toLowerCase() === 'submitted';
                  return (
                  <tr key={r._id} className={`border-b border-border ${isSubmitted ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img src={r.userAvatar || '/avatar.png'} className="w-8 h-8 rounded-full object-cover" />
                        <div>
                          <div className="font-medium">{r.userName || [r.userFirstName, r.userLastName].filter(Boolean).join(' ') || r.userEmail || '-'}</div>
                          <div className="text-xs text-muted-foreground">{r.userEmail}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {isSubmitted ? (
                        <Badge className="bg-green-100 text-green-800">Submitted</Badge>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => openReview(r)}>Review</Button>
                      )}
                    </td>
                  </tr>
                );})}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
