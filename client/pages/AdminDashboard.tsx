// Helper to format relative time
function getRelativeTime(dateString: string) {
  if (!dateString) return '';
  const now = new Date();
  const date = new Date(dateString);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (isNaN(diff)) return '';
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} minute${Math.floor(diff / 60) === 1 ? '' : 's'} ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hour${Math.floor(diff / 3600) === 1 ? '' : 's'} ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)} day${Math.floor(diff / 86400) === 1 ? '' : 's'} ago`;
  return date.toLocaleDateString();
}

import React, { useEffect, useState } from "react";
import { api } from "@/services/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Eye } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const AdminDashboard = () => {
  const [stats, setStats] = useState<any>({});
  const [pending, setPending] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<any | null>(null);
  const [showApplicationDialog, setShowApplicationDialog] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [rejectConfirmOpen, setRejectConfirmOpen] = useState(false);
  // Live GitHub repo count override for dialog
  const [ghRepoCount, setGhRepoCount] = useState<number | null>(null);

  // When dialog opens and username is available, fetch live repo count
  useEffect(() => {
    if (!showApplicationDialog || !selectedApplication) {
      setGhRepoCount(null);
      return;
    }
    const displayUsername = selectedApplication?.githubUsername
      || selectedApplication?.githubUsernameEntered
      || null;
    if (!displayUsername) { setGhRepoCount(null); return; }
    let aborted = false;
    (async () => {
      try {
        const resp = await fetch(`https://api.github.com/users/${encodeURIComponent(displayUsername)}`);
        if (!resp.ok) return;
        const data = await resp.json();
        if (!aborted && typeof data.public_repos === 'number') {
          setGhRepoCount(data.public_repos);
        }
      } catch {}
    })();
    return () => { aborted = true; };
  }, [showApplicationDialog, selectedApplication]);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const statsRes = await api.getDashboardStats();
        setStats(statsRes.stats || {});
        const pendingRes = await api.getApplicationsByStatus("pending");
        setPending(pendingRes.applications || []);
        const events = await api.getEvents();
        setAnnouncements((events || []).filter((e: any) => e.type === "announcement"));
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);


  const handleApprove = async (id?: string) => {
    const appId = id || selectedApplication?._id;
    if (!appId) return;
    setApproving(appId);
    try {
      await api.approveApplication(appId);
      setPending(pending.filter((a) => a._id !== appId));
      setStats((s: any) => ({ ...s, approvedApplications: (s.approvedApplications || 0) + 1, pendingApplications: (s.pendingApplications || 1) - 1 }));
      setShowApplicationDialog(false);
      setSelectedApplication(null);
    } finally {
      setApproving(null);
    }
  };

  const handleReject = async () => {
    if (!selectedApplication) return;
    setApproving(selectedApplication._id);
    try {
      await api.rejectApplication(selectedApplication._id, 'Application rejected by admin');
      setPending(pending.filter((a) => a._id !== selectedApplication._id));
      setStats((s: any) => ({ ...s, rejectedApplications: (s.rejectedApplications || 0) + 1, pendingApplications: (s.pendingApplications || 1) - 1 }));
      setShowApplicationDialog(false);
      setSelectedApplication(null);
    } finally {
      setApproving(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const copy = new Set(prev);
      if (copy.has(id)) copy.delete(id); else copy.add(id);
      return copy;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(pending.map(p => p._id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const bulkApprove = async () => {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    try {
      const ids = Array.from(selectedIds);
      await api.approveApplications(ids);
      setPending(prev => prev.filter(p => !selectedIds.has(p._id)));
      setStats((s: any) => ({
        ...s,
        approvedApplications: (s.approvedApplications || 0) + selectedIds.size,
        pendingApplications: Math.max(0, (s.pendingApplications || 0) - selectedIds.size)
      }));
      clearSelection();
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkReject = () => {
    if (selectedIds.size === 0) return;
    setBulkRejectOpen(true);
  };

  const confirmBulkReject = async () => {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    try {
      const ids = Array.from(selectedIds);
      const reason = 'Application rejected by admin';
      await api.rejectApplications(ids, reason);
      setPending(prev => prev.filter(p => !selectedIds.has(p._id)));
      setStats((s: any) => ({
        ...s,
        rejectedApplications: (s.rejectedApplications || 0) + selectedIds.size,
        pendingApplications: Math.max(0, (s.pendingApplications || 0) - selectedIds.size)
      }));
      clearSelection();
      setBulkRejectOpen(false);
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      {/* Removed Admin Dashboard heading as requested */}
      {loading ? (
        <div>Loading...</div>
      ) : (
        <>
          {/* Status Badges */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="flex flex-col items-center p-4 bg-muted rounded-lg">
              <span className="text-sm text-muted-foreground">Total Users</span>
              <Badge className="bg-blue-100 text-blue-800 text-lg mt-2">{stats.totalUsers || 0}</Badge>
            </div>
            <div className="flex flex-col items-center p-4 bg-muted rounded-lg">
              <span className="text-sm text-muted-foreground">Approved Users</span>
              <Badge className="bg-green-100 text-green-800 text-lg mt-2">{stats.approvedApplications || 0}</Badge>
            </div>
            <div className="flex flex-col items-center p-4 bg-muted rounded-lg">
              <span className="text-sm text-muted-foreground">Pending Users</span>
              <Badge className="bg-orange-100 text-orange-800 text-lg mt-2">{stats.pendingApplications || 0}</Badge>
            </div>
            <div className="flex flex-col items-center p-4 bg-muted rounded-lg">
              <span className="text-sm text-muted-foreground">Rejected Users</span>
              <Badge className="bg-red-100 text-red-800 text-lg mt-2">{stats.rejectedApplications || 0}</Badge>
            </div>
            <div className="flex flex-col items-center p-4 bg-muted rounded-lg">
              <span className="text-sm text-muted-foreground">Announcements</span>
              <Badge className="bg-indigo-100 text-indigo-800 text-lg mt-2">{stats.totalAnnouncements || 0}</Badge>
            </div>
            <div className="flex flex-col items-center p-4 bg-muted rounded-lg">
              <span className="text-sm text-muted-foreground">Responses</span>
              <Badge className="bg-purple-100 text-purple-800 text-lg mt-2">{stats.totalResponses ?? stats.totalRequests ?? 0}</Badge>
            </div>
          </div>


          {/* Pending Applications */}
          <div className="mb-10">
            <h2 className="text-xl font-semibold mb-4">Pending Applications</h2>
            {pending.length === 0 ? (
              <div className="text-muted-foreground">No pending applications.</div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-md bg-muted">
                  <div className="text-sm text-muted-foreground">
                    Selected: {selectedIds.size} / {pending.length}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={selectAll} disabled={bulkBusy}>Select All</Button>
                    <Button variant="outline" size="sm" onClick={clearSelection} disabled={bulkBusy}>Clear</Button>
                    <Button size="sm" onClick={bulkApprove} disabled={bulkBusy || selectedIds.size===0}>Approve Selected</Button>
                    <Button variant="destructive" size="sm" onClick={bulkReject} disabled={bulkBusy || selectedIds.size===0}>Reject Selected</Button>
                  </div>
                </div>
                {pending.map((app) => (
                  <div key={app._id} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                    <div className="flex items-center space-x-4">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={selectedIds.has(app._id)}
                        onChange={() => toggleSelect(app._id)}
                        aria-label="Select application"
                      />
                      <Avatar className="h-12 w-12">
                        <AvatarImage 
                          src={app.userAvatar || app.avatar || app.photoURL || app.photoUrl || app.user?.photoURL || app.user?.photoUrl || 
                               app.profileAvatar || app.userProfilePicture || app.user?.avatar || app.user?.profileAvatar || app.user?.image ||
                               (app.user?.email && `https://lh3.googleusercontent.com/a/${app.user?.email.split('@')[0]}/s96-c`)} 
                        />
                        <AvatarFallback>{
                          (app.userFirstName || app.firstName || app.userName || app.name || app.userEmail || app.email || 'U').charAt(0).toUpperCase()
                        }</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-semibold">
                            {(() => {
                              const first = app.userFirstName || app.firstName || '';
                              const last = app.userLastName || app.lastName || '';
                              const combined = `${first} ${last}`.trim();
                              return combined || app.userName || app.name || app.userEmail || app.email || 'Unknown User';
                            })()}
                          </h4>
                        </div>
                        <div className="font-medium text-sm">{app.projectTitle || 'No project title'}</div>
                        <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                          <span>{app.userEmail || app.email}</span>
                          <span>•</span>
                          <span>{app.submittedAt ? getRelativeTime(app.submittedAt) : '-'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button variant="outline" size="sm" onClick={() => { setSelectedApplication(app); setShowApplicationDialog(true); }}>
                        <Eye className="h-4 w-4 mr-2" /> Review
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bulk Reject Confirm Dialog */}
          <Dialog open={bulkRejectOpen} onOpenChange={setBulkRejectOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reject {selectedIds.size} application(s)?</DialogTitle>
                <DialogDescription>
                  This will mark all selected pending applications as rejected. Do you want to proceed?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBulkRejectOpen(false)} disabled={bulkBusy}>Cancel</Button>
                <Button variant="destructive" onClick={confirmBulkReject} disabled={bulkBusy || selectedIds.size === 0}>
                  {bulkBusy ? 'Rejecting…' : 'Yes, Reject'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Application Detail Dialog */}
          {showApplicationDialog && selectedApplication && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
              <div className="absolute inset-0 bg-black/60" onClick={() => { setShowApplicationDialog(false); setSelectedApplication(null); }} />
              <div className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
                {/* Header */}
                <div className="relative overflow-hidden rounded-t-2xl">
                  <div className="h-28 sm:h-32 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500" />
                  <div className="absolute top-4 sm:top-5 left-4 sm:left-6 flex items-center gap-4 z-10">
                    <Avatar className="h-20 w-20 sm:h-24 sm:w-24 ring-4 ring-white shadow-lg">
                      <AvatarImage 
                        src={selectedApplication.userAvatar || selectedApplication.avatar || selectedApplication.photoURL || selectedApplication.photoUrl || 
                             selectedApplication.user?.photoURL || selectedApplication.user?.photoUrl || selectedApplication.profileAvatar || 
                             selectedApplication.userProfilePicture || selectedApplication.user?.avatar || selectedApplication.user?.profileAvatar || 
                             selectedApplication.user?.image} 
                      />
                      <AvatarFallback>{
                        (selectedApplication.userFirstName || selectedApplication.firstName || selectedApplication.userName || 
                         selectedApplication.name || selectedApplication.userEmail || selectedApplication.email || 'U').charAt(0).toUpperCase()
                      }</AvatarFallback>
                    </Avatar>
                    <div className="pb-2">
                      <h2 className="text-xl sm:text-2xl font-bold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]">
                        {(() => {
                          const first = selectedApplication.userFirstName || '';
                          const last = selectedApplication.userLastName || '';
                          const combined = `${first} ${last}`.trim();
                          return combined || selectedApplication.userEmail || selectedApplication.email || 'Unknown User';
                        })()}
                      </h2>
                      <p className="text-white/95 text-xs sm:text-sm drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]">{selectedApplication?.userEmail || selectedApplication?.email || ''}</p>
                    </div>
                  </div>
                  <div className="absolute right-3 top-3">
                    <Button size="sm" variant="secondary" onClick={() => { setShowApplicationDialog(false); setSelectedApplication(null); }}>✕</Button>
                  </div>
                </div>
                {/* Content */}
                <div className="px-4 sm:px-6 pt-8 sm:pt-12 pb-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left: Project overview */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="rounded-xl border border-slate-200 p-4 sm:p-6 bg-white">
                      <div className="flex flex-wrap items-center gap-2 mb-4">
                        <Badge variant="secondary" className="bg-orange-100 text-orange-800">Pending</Badge>
                        {selectedApplication?.sector ? (<Badge variant="secondary">{selectedApplication.sector}</Badge>) : null}
                        {selectedApplication?.type || selectedApplication?.applicationType ? (
                          <Badge variant="secondary">{selectedApplication.applicationType || selectedApplication.type}</Badge>
                        ) : null}
                        <span className="text-sm text-muted-foreground">Submitted {selectedApplication?.submittedAt ? getRelativeTime(selectedApplication.submittedAt) : ''}</span>
                      </div>
                      <h3 className="text-2xl font-semibold mb-2">{selectedApplication?.projectTitle || 'Untitled Project'}</h3>
                      <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{selectedApplication?.projectDescription || 'No description provided'}</p>
                    </div>

                    {/* GitHub card */}
                    <div className="rounded-xl border border-slate-200 p-4 sm:p-6 bg-white">
                      <h4 className="font-semibold mb-3">GitHub</h4>
                      {(() => {
                        const display = selectedApplication?.githubUsername
                          || selectedApplication?.githubUsernameEntered
                          || null;
                        const ghRepos = selectedApplication?.githubTotalRepos ?? null;
                        return (
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">{display ? `@${display}` : 'No GitHub username provided'}</div>
                              <div className="text-sm text-gray-600">Total public repos: {ghRepoCount ?? ghRepos ?? '—'}</div>
                            </div>
                            {display ? (
                              <a
                                href={`https://github.com/${display}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline text-sm"
                              >
                                View Profile
                              </a>
                            ) : null}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Right: Quick actions */}
                  <div className="space-y-4">
                    <div className="rounded-xl border border-slate-200 p-4 sm:p-6 bg-white">
                      <h4 className="font-semibold mb-3">Actions</h4>
                      <div className="flex flex-col gap-3">
                        <Button onClick={() => handleApprove()} disabled={approving === selectedApplication._id}>{approving === selectedApplication._id ? 'Approving...' : 'Approve'}</Button>
                        <Button variant="destructive" onClick={() => setRejectConfirmOpen(true)} disabled={approving === selectedApplication._id}>Reject</Button>
                        <Button variant="outline" onClick={() => { setShowApplicationDialog(false); setSelectedApplication(null); }}>Close</Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Announcements section removed as requested */}
          {/* Single Reject Confirm Dialog */}
          <Dialog open={rejectConfirmOpen} onOpenChange={setRejectConfirmOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reject this application?</DialogTitle>
                <DialogDescription>
                  This will mark the application as rejected. Do you want to proceed?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRejectConfirmOpen(false)} disabled={approving !== null}>Cancel</Button>
                <Button variant="destructive" onClick={async () => { await handleReject(); setRejectConfirmOpen(false); }} disabled={approving !== null}>
                  {approving ? 'Rejecting…' : 'Yes, Reject'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
};

export default AdminDashboard;
