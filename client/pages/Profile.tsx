import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  User,
  Edit3,
  MapPin,
  Calendar,
  Github,
  ExternalLink,
  Award,
  Star,
  Heart,
  Users,
  FolderOpen,
  CheckCircle,
  Camera,
  Save,
  X,
  Trash2,
} from "lucide-react"
import { api } from "@/services/api"
import { toast } from "@/hooks/use-toast"

interface UserProfile {
  _id: string
  firstName: string
  lastName: string
  email: string
  verified: boolean
  createdAt: string
  avatar?: string
  bio?: string
  location?: string
  githubUrl?: string
  following?: string[]
  followers?: string[]
}

interface Project {
  _id: string
  title: string
  description: string
  sector: string
  status: string
  author: {
    userId: string
    name: string
    verified: boolean
  }
  likes: string[]
  comments: Array<any>
  follows: string[]
  tags: string[]
  createdAt: string
  updatedAt: string
}

interface CollabRequest {
  projectId: string;
  projectTitle: string;
  commentId: string;
  message: string;
  createdAt: string;
  status?: 'pending' | 'accepted' | 'rejected';
  timeAgo?: string;
  requester: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string;
  } | null;
  requesterStats?: {
    projectsCount: number;
    followersCount: number;
    collabHistoryCount: number;
    githubUsername?: string;
  };
}

export default function Profile() {
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [userProjects, setUserProjects] = useState<Project[]>([])
  const [projectsLoading, setProjectsLoading] = useState(true)
  const [collabRequests, setCollabRequests] = useState<CollabRequest[]>([])
  const [collabLoading, setCollabLoading] = useState(true)
  const [collabDialogOpen, setCollabDialogOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<CollabRequest | null>(null)
  const [collabAction, setCollabAction] = useState<'accept' | 'reject' | null>(null)
  const [collabSubmitting, setCollabSubmitting] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [viewRequest, setViewRequest] = useState<CollabRequest | null>(null)
  const [selectedCollabIds, setSelectedCollabIds] = useState<Set<string>>(new Set())
  const [bulkCollabOpen, setBulkCollabOpen] = useState(false)
  const [bulkAction, setBulkAction] = useState<'accept' | 'reject' | null>(null)

  useEffect(() => {
    fetchUserProfile()
    fetchUserProjects()
    fetchCollaborationRequests()
  }, [])

  const fetchUserProfile = async () => {
    try {
      const data = await api.getProfile();
      setUser(data.user);
    } catch (error) {
      toast({
        title: "Failed to fetch user profile",
        description: error.message || "Could not load profile info.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCollaborationRequests = async () => {
    try {
      setCollabLoading(true)
      const list = await api.getCollaborationRequests()
      setCollabRequests(list)
    } catch (error: any) {
      console.error('Failed to fetch collaboration requests:', error)
    } finally {
      setCollabLoading(false)
    }
  }

  const confirmCollabAction = (req: CollabRequest, action: 'accept' | 'reject') => {
    setSelectedRequest(req)
    setCollabAction(action)
    setCollabDialogOpen(true)
  }

  const openView = (req: CollabRequest) => {
    setViewRequest(req)
    setViewOpen(true)
  }

  const approveFromView = async () => {
    if (!viewRequest) return
    try {
      setCollabSubmitting(true)
      await api.acceptCollaboration(viewRequest.projectId, viewRequest.commentId)
      toast({ title: 'Collaboration accepted', description: `Added collaborator for ${viewRequest.projectTitle}` })
      // Optimistically update state to prevent further actions
      const actedId = viewRequest.commentId
      setCollabRequests(prev => prev.map(r => r.commentId === actedId ? { ...r, status: 'accepted' } : r))
      setSelectedCollabIds(prev => { const n = new Set(prev); n.delete(actedId); return n })
      setViewOpen(false)
      setViewRequest(null)
      fetchCollaborationRequests()
    } catch (error: any) {
      toast({ title: 'Action failed', description: error?.message || 'Please try again.', variant: 'destructive' })
    } finally {
      setCollabSubmitting(false)
    }
  }

  const rejectFromView = async () => {
    if (!viewRequest) return
    try {
      setCollabSubmitting(true)
      await api.rejectCollaboration(viewRequest.projectId, viewRequest.commentId)
      toast({ title: 'Collaboration rejected', description: `Rejected request for ${viewRequest.projectTitle}` })
      // Optimistically update state to prevent further actions
      const actedId = viewRequest.commentId
      setCollabRequests(prev => prev.map(r => r.commentId === actedId ? { ...r, status: 'rejected' } : r))
      setSelectedCollabIds(prev => { const n = new Set(prev); n.delete(actedId); return n })
      setViewOpen(false)
      setViewRequest(null)
      fetchCollaborationRequests()
    } catch (error: any) {
      toast({ title: 'Action failed', description: error?.message || 'Please try again.', variant: 'destructive' })
    } finally {
      setCollabSubmitting(false)
    }
  }

  const performCollabAction = async () => {
    if (!selectedRequest || !collabAction) return
    try {
      setCollabSubmitting(true)
      if (collabAction === 'accept') {
        await api.acceptCollaboration(selectedRequest.projectId, selectedRequest.commentId)
        toast({ title: 'Collaboration accepted', description: `Added collaborator for ${selectedRequest.projectTitle}` })
        // Optimistic update
        const actedId = selectedRequest.commentId
        setCollabRequests(prev => prev.map(r => r.commentId === actedId ? { ...r, status: 'accepted' } : r))
        setSelectedCollabIds(prev => { const n = new Set(prev); n.delete(actedId); return n })
      } else {
        await api.rejectCollaboration(selectedRequest.projectId, selectedRequest.commentId)
        toast({ title: 'Collaboration rejected', description: `Rejected request for ${selectedRequest.projectTitle}` })
        // Optimistic update
        const actedId = selectedRequest.commentId
        setCollabRequests(prev => prev.map(r => r.commentId === actedId ? { ...r, status: 'rejected' } : r))
        setSelectedCollabIds(prev => { const n = new Set(prev); n.delete(actedId); return n })
      }
      setCollabDialogOpen(false)
      setSelectedRequest(null)
      setCollabAction(null)
      fetchCollaborationRequests()
    } catch (error: any) {
      toast({ title: 'Action failed', description: error?.message || 'Please try again.', variant: 'destructive' })
    } finally {
      setCollabSubmitting(false)
    }
  }

  const toggleSelectCollab = (commentId: string, checked: boolean) => {
    setSelectedCollabIds(prev => {
      const next = new Set(prev)
      if (checked) next.add(commentId); else next.delete(commentId)
      return next
    })
  }

  const toggleSelectAllCollab = (checked: boolean) => {
    setSelectedCollabIds(() => checked ? new Set(collabRequests.filter(r => (r.status ?? 'pending') === 'pending').map(r => r.commentId)) : new Set())
  }

  const confirmBulkCollab = (action: 'accept' | 'reject') => {
    if (selectedCollabIds.size === 0) return
    setBulkAction(action)
    setBulkCollabOpen(true)
  }

  const performBulkCollab = async () => {
    if (!bulkAction || selectedCollabIds.size === 0) return
    try {
      setCollabSubmitting(true)
      const idSet = new Set(selectedCollabIds)
      let ok = 0
      let fail = 0
      for (const req of collabRequests) {
        if ((req.status ?? 'pending') !== 'pending') continue; // skip processed
        if (!idSet.has(req.commentId)) continue
        try {
          if (bulkAction === 'accept') {
            await api.acceptCollaboration(req.projectId, req.commentId)
          } else {
            await api.rejectCollaboration(req.projectId, req.commentId)
          }
          ok++
        } catch (e) {
          fail++
        }
      }
      toast({ title: 'Bulk completed', description: `Success: ${ok}, Failed: ${fail}` })
      setSelectedCollabIds(new Set())
      setBulkCollabOpen(false)
      setBulkAction(null)
      fetchCollaborationRequests()
    } catch (error: any) {
      toast({ title: 'Bulk action failed', description: error?.message || 'Please try again.', variant: 'destructive' })
    } finally {
      setCollabSubmitting(false)
    }
  }

  const fetchUserProjects = async () => {
    try {
      const response = await fetch('/api/projects', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json();
        console.log('Fetched projects for profile:', data);
        // Filter projects by current user
        const currentUser = await api.getCurrentUser();
        if (currentUser) {
          let myProjects: Project[] = [];
          if (Array.isArray(data)) {
            myProjects = data.filter((project: Project) => project.author.userId === currentUser._id);
          } else if (data.projects && Array.isArray(data.projects)) {
            myProjects = data.projects.filter((project: Project) => project.author.userId === currentUser._id);
          } else {
            console.error('Profile: Unexpected projects API response:', data);
            setProjectsError('Failed to fetch projects. Please try again.');
          }
          setUserProjects(myProjects);
        }
      } else {
        setProjectsError('Failed to fetch projects. Please try again.');
      }
    } catch (error) {
      console.error('Failed to fetch user projects:', error)
      setProjectsError('Failed to fetch projects. Please try again.');
    } finally {
      setProjectsLoading(false)
    }
  }



  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    bio: '',
    location: '',
    githubUrl: ''
  })
  const [updateLoading, setUpdateLoading] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    if (user) {
      const ghUsername = (user as any).githubUsername || (user as any)?.githubStats?.username;
      const ghUrl = user.githubUrl || (ghUsername ? `https://github.com/${ghUsername}` : '');
      setEditForm({
        firstName: user.firstName,
        lastName: user.lastName,
        bio: user.bio || '',
        location: user.location || '',
        githubUrl: ghUrl
      })
    }
  }, [user])

  const handleSaveProfile = async () => {
    setUpdateLoading(true);
    try {
      await api.updateProfile(editForm);
      await fetchUserProfile();
      setIsEditing(false);
      toast({
        title: "Profile updated successfully!",
        description: "Your changes have been saved.",
      });
    } catch (error) {
      toast({
        title: "Failed to update profile",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleCancelEdit = () => {
    if (user) {
      setEditForm({
        firstName: user.firstName,
        lastName: user.lastName,
        bio: user.bio || '',
        location: user.location || '',
        githubUrl: user.githubUrl || ''
      })
    }
    setIsEditing(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="h-64 bg-muted animate-pulse rounded-lg" />
            <div className="h-96 bg-muted animate-pulse rounded-lg" />
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Profile not found</h2>
          <p className="text-muted-foreground">Please try refreshing the page.</p>
        </div>
      </div>
    )
  }

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("avatar", file);
    try {
      // Send to backend (assume endpoint: /api/auth/avatar, method: POST)
      const res = await fetch("http://localhost:8081/api/auth/avatar", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`
        },
        body: formData
      });
      if (!res.ok) throw new Error("Failed to upload avatar");
      const data = await res.json();
      if (user && data.avatar) {
        setUser({ ...user, avatar: data.avatar });
      }
      toast({
        title: "Avatar updated!",
        description: "Your profile picture has been updated.",
      });
    } catch (err) {
      toast({
        title: "Failed to update avatar",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    }
  }

  const getStatusBadge = (status: string) => {
    return status === "Active" ? (
      <Badge className="bg-green-100 text-green-800">
        <CheckCircle className="h-3 w-3 mr-1" />
        Active
      </Badge>
    ) : (
      <Badge>
        <CheckCircle className="h-3 w-3 mr-1" />
        Completed
      </Badge>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-innovation-50/30">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Profile Header */}
        <Card>
          <CardContent className="p-6">
            {/* Delete account dialog */}
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete account?</DialogTitle>
                  <DialogDescription>
                    This will permanently delete your user account, your projects, likes, follows, comments, requests, and notifications. This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button onClick={() => setDeleteOpen(false)} disabled={deleteLoading}>
                    Cancel
                  </Button>
                  <Button
                    className="bg-red-600 hover:bg-red-700 text-white"
                    disabled={deleteLoading}
                    onClick={async () => {
                      try {
                        setDeleteLoading(true);
                        await api.deleteAccount();
                        toast({ title: "Account deleted", description: "Your account has been removed." });
                        // Redirect to landing/login
                        window.location.href = "/";
                      } catch (err: any) {
                        toast({ title: "Failed to delete account", description: err?.message || "Please try again.", variant: "destructive" });
                      } finally {
                        setDeleteLoading(false);
                      }
                    }}
                  >
                    {deleteLoading ? "Deleting..." : "Delete"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              <div className="relative">
                <Avatar className="h-24 w-24 md:h-32 md:w-32">
                  {user.avatar ? (
                    <AvatarImage src={user.avatar} alt="avatar" />
                  ) : null}
                  <AvatarFallback className="bg-innovation-500 text-white text-2xl">
                    {(user.firstName.charAt(0) + user.lastName.charAt(0)).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {isEditing && (
                  <div className="absolute bottom-0 right-0">
                    <label htmlFor="avatar-upload" className="cursor-pointer">
                      <div className="h-8 w-8 bg-innovation-500 rounded-full flex items-center justify-center hover:bg-innovation-600 transition-colors">
                        <Camera className="h-4 w-4 text-white" />
                      </div>
                      <input
                        id="avatar-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    {isEditing ? (
                      <div className="space-y-2">
                        <div>
                          <Label htmlFor="firstName">First Name</Label>
                          <Input
                            id="firstName"
                            value={editForm.firstName}
                            onChange={(e) => setEditForm(prev => ({ ...prev, firstName: e.target.value }))}
                            className="text-lg font-bold mb-2"
                          />
                          <Label htmlFor="lastName">Last Name</Label>
                          <Input
                            id="lastName"
                            value={editForm.lastName}
                            onChange={(e) => setEditForm(prev => ({ ...prev, lastName: e.target.value }))}
                            className="text-lg font-bold"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <h1 className="text-2xl md:text-3xl font-bold">{user.firstName} {user.lastName}</h1>
                        {user.verified && (
                          <CheckCircle className="h-6 w-6 text-innovation-500" />
                        )}
                      </div>
                    )}
                    <p className="text-muted-foreground">{user.email}</p>
                  </div>

                  <div className="flex items-center space-x-2">
                    {isEditing ? (
                      <>
                        <Button 
                          
                          onClick={handleCancelEdit}
                          disabled={updateLoading}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleSaveProfile}
                          disabled={updateLoading}
                          className="bg-innovation-500 hover:bg-innovation-600"
                        >
                          <Save className="h-4 w-4 mr-2" />
                          {loading ? "Saving..." : "Save Changes"}
                        </Button>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button 
                          onClick={() => setIsEditing(true)}
                        >
                          <Edit3 className="h-4 w-4 mr-2" />
                          Edit Profile
                        </Button>
                        <Button
                          onClick={() => setDeleteOpen(true)}
                          className="bg-red-600 hover:bg-red-700 text-white"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Account
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  {isEditing ? (
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="bio">Bio</Label>
                        <Textarea
                          id="bio"
                          value={editForm.bio}
                          onChange={(e) => setEditForm(prev => ({ ...prev, bio: e.target.value }))}
                          rows={3}
                          placeholder="Tell us about yourself..."
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="location">Location</Label>
                          <Input
                            id="location"
                            value={editForm.location}
                            onChange={(e) => setEditForm(prev => ({ ...prev, location: e.target.value }))}
                            placeholder="City, Country"
                          />
                        </div>
                        <div>
                          <Label htmlFor="github">GitHub URL</Label>
                          <Input
                            id="github"
                            value={editForm.githubUrl}
                            onChange={(e) => setEditForm(prev => ({ ...prev, githubUrl: e.target.value }))}
                            placeholder="https://github.com/username"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-muted-foreground leading-relaxed">{user.bio}</p>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center space-x-1">
                          <MapPin className="h-4 w-4" />
                          <span>{user.location}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4" />
                          <span>Joined {new Date(user.createdAt).toLocaleDateString()}</span>
                        </div>
                        {(() => {
                          const ghUsername = (user as any).githubUsername || (user as any)?.githubStats?.username;
                          const ghUrl = user.githubUrl || (ghUsername ? `https://github.com/${ghUsername}` : '');
                          if (!ghUrl) return null;
                          return (
                            <div className="flex items-center space-x-1">
                              <Github className="h-4 w-4" />
                              <a
                                href={ghUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-innovation-500 transition-colors"
                              >
                                GitHub Profile
                              </a>
                            </div>
                          );
                        })()}
                      </div>
                    </>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 pt-4 border-t">
                  <div className="text-center">
                    <div className="text-xl font-bold text-innovation-600">{userProjects.length}</div>
                    <div className="text-sm text-muted-foreground">Projects</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-innovation-600">{userProjects.reduce((sum, project) => sum + project.likes.length, 0)}</div>
                    <div className="text-sm text-muted-foreground">Total Likes</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-innovation-600">{user.followers?.length || 0}</div>
                    <div className="text-sm text-muted-foreground">Followers</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-innovation-600">{user.following?.length || 0}</div>
                    <div className="text-sm text-muted-foreground">Following</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-innovation-600">{userProjects.filter(p => p.status === 'published').length}</div>
                    <div className="text-sm text-muted-foreground">Published</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-innovation-600">{user.verified ? 'Yes' : 'No'}</div>
                    <div className="text-sm text-muted-foreground">Verified</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Collaboration Requests */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Collaboration Requests
              {collabRequests.length > 0 && (
                <Badge className="ml-2">{collabRequests.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {collabLoading ? (
              <div className="h-24 bg-muted animate-pulse rounded" />
            ) : collabRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No collaboration requests yet.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedCollabIds.size > 0 && selectedCollabIds.size === collabRequests.length}
                      onCheckedChange={(v) => toggleSelectAllCollab(Boolean(v))}
                      aria-label="Select all collaboration requests"
                    />
                    <span className="text-sm text-muted-foreground">Select all</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" disabled={selectedCollabIds.size === 0} onClick={() => confirmBulkCollab('reject')}>Reject Selected</Button>
                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" disabled={selectedCollabIds.size === 0} onClick={() => confirmBulkCollab('accept')}>Accept Selected</Button>
                  </div>
                </div>
                {collabRequests.map((req) => (
                  <div key={req.commentId} className="flex items-start justify-between border rounded p-3">
                    <div className="space-y-1">
                      <Checkbox
                        checked={selectedCollabIds.has(req.commentId)}
                        disabled={(req.status ?? 'pending') !== 'pending'}
                        onCheckedChange={(v) => toggleSelectCollab(req.commentId, Boolean(v))}
                        aria-label={`Select request ${req.commentId}`}
                      />
                      <div className="font-medium">{req.requester ? `${req.requester.firstName} ${req.requester.lastName}` : 'Unknown User'}</div>
                      <div className="text-sm text-muted-foreground">Project: {req.projectTitle}</div>
                      <div className="text-sm">{req.message}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{req.timeAgo || new Date(req.createdAt).toLocaleString()}</span>
                        {(req.status ?? 'pending') !== 'pending' && (
                          <Badge variant="secondary" className={(req.status === 'accepted') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                            {req.status === 'accepted' ? 'Accepted' : 'Rejected'}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openView(req)}>View</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Collaboration View Dialog */}
        <Dialog open={viewOpen} onOpenChange={setViewOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Collaboration Request</DialogTitle>
              <DialogDescription>Review requester details and take action.</DialogDescription>
            </DialogHeader>
            {viewRequest && (
              <div className="space-y-3 text-sm">
                <div><span className="font-medium">Full name:</span> {viewRequest.requester ? `${viewRequest.requester.firstName} ${viewRequest.requester.lastName}` : 'Unknown User'}</div>
                <div><span className="font-medium">Email:</span> {viewRequest.requester?.email || '-'}</div>
                <div><span className="font-medium">Project:</span> {viewRequest.projectTitle}</div>
                <div className="text-muted-foreground whitespace-pre-wrap"><span className="font-medium text-foreground">Message:</span> {viewRequest.message}</div>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div><span className="font-medium">Project posts:</span> {viewRequest.requesterStats?.projectsCount ?? 0}</div>
                  <div><span className="font-medium">Followers:</span> {viewRequest.requesterStats?.followersCount ?? 0}</div>
                  <div><span className="font-medium">Collaborate history:</span> {viewRequest.requesterStats?.collabHistoryCount ?? 0}</div>
                  <div><span className="font-medium">GitHub username:</span> {viewRequest.requesterStats?.githubUsername || '-'}</div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewOpen(false)} disabled={collabSubmitting}>Cancel</Button>
              <Button variant="destructive" onClick={rejectFromView} disabled={collabSubmitting || (viewRequest?.status ?? 'pending') !== 'pending'}>Reject</Button>
              <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={approveFromView} disabled={collabSubmitting || (viewRequest?.status ?? 'pending') !== 'pending'}>Accept</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Collaboration Confirm Dialog */}
        <Dialog open={collabDialogOpen} onOpenChange={setCollabDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{collabAction === 'accept' ? 'Accept collaboration?' : 'Reject collaboration?'}</DialogTitle>
              <DialogDescription>
                {collabAction === 'accept'
                  ? 'This will add the requester as a collaborator to your project.'
                  : 'This will notify the requester that their collaboration was rejected.'}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setCollabDialogOpen(false)} disabled={collabSubmitting}>Cancel</Button>
              <Button onClick={performCollabAction} disabled={collabSubmitting} className={collabAction === 'accept' ? 'bg-green-600 hover:bg-green-700 text-white' : ''} variant={collabAction === 'reject' ? 'destructive' : 'default'}>
                {collabSubmitting ? 'Processing…' : (collabAction === 'accept' ? 'Accept' : 'Reject')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Collaboration Bulk Confirm Dialog */}
        <Dialog open={bulkCollabOpen} onOpenChange={setBulkCollabOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {bulkAction === 'accept' ? `Accept ${selectedCollabIds.size} collaboration request(s)?` : `Reject ${selectedCollabIds.size} collaboration request(s)?`}
              </DialogTitle>
              <DialogDescription>
                {bulkAction === 'accept'
                  ? 'This will add all selected requesters as collaborators to their respective projects.'
                  : 'This will notify all selected requesters that their collaboration was rejected.'}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setBulkCollabOpen(false)} disabled={collabSubmitting}>Cancel</Button>
              <Button onClick={performBulkCollab} disabled={collabSubmitting || selectedCollabIds.size === 0} className={bulkAction === 'accept' ? 'bg-green-600 hover:bg-green-700 text-white' : ''} variant={bulkAction === 'reject' ? 'destructive' : 'default'}>
                {collabSubmitting ? 'Processing…' : 'Confirm'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Projects */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FolderOpen className="h-5 w-5" />
              <span>My Projects</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projectsLoading ? (
                [1, 2, 3].map((i) => (
                  <Card key={i} className="h-64 animate-pulse bg-muted" />
                ))
              ) : userProjects.map((project) => (
                <Card key={project._id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <h3 className="font-semibold line-clamp-2">{project.title}</h3>
                      {getStatusBadge(project.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {project.description}
                    </p>
                    
                    <div className="flex flex-wrap gap-1">
                      {project.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {project.tags.length > 3 && (
                        <Badge className="text-xs">
                          +{project.tags.length - 3}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-1 text-muted-foreground">
                        <Heart className="h-4 w-4" />
                        <span>{project.likes.length} likes</span>
                      </div>
                      <span className="text-muted-foreground">
                        {new Date(project.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
