import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Clock,
  Eye,
  CheckCircle,
  XCircle,
  Github,
  Calendar,
  User,
} from "lucide-react"
import { useAdminSidebar } from "@/components/admin-layout"

interface Application {
  _id: string;
  userId: string;
  userName: string;
  userEmail: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  avatar?: string;
  userAvatar?: string;
  userFirstName?: string;
  userLastName?: string;
  userProfilePicture?: string;
  profileAvatar?: string;
  projectTitle: string;
  projectDescription: string;
  sector: string;
  duration: string;
  teamSize?: string;
  type: string; // individual or team
  githubUrl?: string;
  githubUsername?: string;
  teamMembers: string[];
  submittedAt: string;
  status: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export default function ApprovedApplications() {
  const { refreshStats } = useAdminSidebar()
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchApplications()
  }, []) // No mock data, only fetch from backend

  // Add a refresh mechanism when component becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchApplications()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [])

  const fetchApplications = async () => {
    try {
      setLoading(true)
      const response = await fetch('http://localhost:8081/api/admin/applications?status=approved', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        setApplications(data.applications || [])
      }
    } catch (error) {
      console.error('Failed to fetch applications:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleViewDetails = (appId: string) => {
    console.log('View details for:', appId)
    // Navigate to detailed view
  }

  const handleApprove = async (appId: string) => {
    try {
      const response = await fetch(`http://localhost:8081/api/admin/applications/${appId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        alert('Application approved successfully!')
        fetchApplications()
        try { await refreshStats() } catch {}
      }
    } catch (error) {
      console.error('Failed to approve application:', error)
      alert('Failed to approve application')
    }
  }

  const handleReject = async (appId: string, reason = 'Rejected by admin') => {
    try {
      const response = await fetch(`http://localhost:8081/api/admin/applications/${appId}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      })

      if (response.ok) {
        alert('Application rejected successfully!')
        fetchApplications()
        await refreshStats()
      }
    } catch (error) {
      console.error('Failed to reject application:', error)
      alert('Failed to reject application')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header with just the badge */}
      <div className="flex justify-end">
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="text-green-600 border-green-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            {applications.length} Approved
          </Badge>
        </div>
      </div>

      {/* Applications Grid */}
      <div className="grid grid-cols-1 gap-6">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="h-64 animate-pulse bg-muted" />
            ))}
          </div>
        ) : applications.map((app) => (
          <Card key={app._id} className="hover:shadow-md transition-all duration-300">
            <CardHeader className="pb-4">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="flex items-center space-x-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={app.userAvatar || app.avatar || app.profileAvatar || app.userProfilePicture} />
                    <AvatarFallback>
                      {(app.userName || app.userFirstName || app.firstName || 'U').charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="font-semibold text-foreground">{app.userName || `${app.userFirstName || app.firstName || ""} ${app.userLastName || app.lastName || ""}`.trim() || "Unknown User"}</h3>
                      <Badge variant="outline" className="text-xs">
                        {app.type || "Unknown Type"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{app.userEmail || app.email || ""}</p>
                    <h4 className="font-medium text-sm text-foreground">{app.projectTitle || "Untitled Project"}</h4>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>{app.submittedAt ? (() => {
                    const now = new Date();
                    const submitted = new Date(app.submittedAt);
                    const diffInMs = now.getTime() - submitted.getTime();
                    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
                    const diffInHours = Math.floor(diffInMinutes / 60);
                    const diffInDays = Math.floor(diffInHours / 24);
                    
                    if (diffInDays > 0) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
                    if (diffInHours > 0) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
                    if (diffInMinutes > 0) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
                    return 'Just now';
                  })() : 'Unknown'}</span>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4 pt-0">
              <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                {app.projectDescription || "No description provided"}
              </p>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Sector:</span>
                  <p className="font-medium">{app.sector || "Not specified"}</p>
                </div>
                {app.type === "team" && (
                  <div>
                    <span className="text-muted-foreground">Team Size:</span>
                    <p className="font-medium">{app.teamSize || 0} members</p>
                  </div>
                )}
                {(() => {
                  const ghLink = (app.githubUrl && app.githubUrl.startsWith('http'))
                    ? app.githubUrl
                    : (app.githubUsername ? `https://github.com/${app.githubUsername}` : null);
                  if (!ghLink) return null;
                  return (
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" asChild className="border-slate-200 hover:bg-transparent active:bg-transparent focus:bg-transparent text-foreground hover:text-foreground active:text-foreground focus:text-foreground">
                        <a href={ghLink} target="_blank" rel="noopener noreferrer" title="Open GitHub profile" aria-label="Open GitHub profile">
                          <Github className="h-4 w-4" />
                        </a>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-red-200 text-red-600 hover:bg-transparent active:bg-transparent focus:bg-transparent hover:text-red-600 active:text-red-600 focus:text-red-600"
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Reject
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Reject this application?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action will move the applicant to the Rejected list. You can’t undo this.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleReject(app._id)} className="bg-red-600 text-white hover:bg-red-700">
                              Yes, Reject
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  );
                })()}
              </div>

            </CardContent>
          </Card>
        ))}
      </div>

      {!loading && applications.length === 0 && (
        <div className="text-center py-12">
          <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">No Active Applications</h3>
          <p className="text-muted-foreground">All applications have been processed.</p>
        </div>
      )}
    </div>
  )
}
