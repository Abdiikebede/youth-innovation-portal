import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Eye, XCircle, FileText, RefreshCw } from "lucide-react"
import { api } from "@/services/api"

interface Application {
  _id: string;
  userId: string;
  name: string;
  userName?: string;
  firstName?: string;
  lastName?: string;
  userFirstName?: string;
  userLastName?: string;
  email: string;
  userEmail?: string;
  avatar?: string;
  userAvatar?: string;
  userProfilePicture?: string;
  profileAvatar?: string;
  projectTitle: string;
  projectDescription: string;
  sector: string;
  duration: string;
  githubUrl?: string;
  githubUsername?: string;
  teamMembers: string[];
  submittedAt: string;
  status: string;
  rejectionReason?: string;
  reviewedAt?: string;
  updatedAt?: string;
  createdAt?: string;
}

export default function RejectedApplications() {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchRejectedApplications()
  }, [])

  const fetchRejectedApplications = async () => {
    try {
      setLoading(true)
      setError(null)
      console.log('🔄 Fetching rejected applications...')
      
      const response = await api.getApplicationsByStatus('rejected')
      console.log('✅ Rejected applications response:', response)
      
      setApplications(response.applications || [])
    } catch (error) {
      console.error('❌ Error fetching rejected applications:', error)
      setError('Failed to load rejected applications')
      setApplications([])
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status) => {
    return <Badge className="bg-red-100 text-red-800">Rejected</Badge>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={fetchRejectedApplications} disabled={loading} className="bg-[#2e9891] text-white hover:bg-[#2e9891] active:bg-[#2e9891]">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-500" />
            Rejected Applications ({applications.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-16 bg-muted rounded-lg"></div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                Error Loading Applications
              </h3>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={fetchRejectedApplications} className="bg-[#2e9891] text-white hover:bg-[#2e9891] active:bg-[#2e9891]">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          ) : applications.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                No Rejected Applications
              </h3>
              <p className="text-muted-foreground">
                No applications have been rejected yet.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {applications.map((application) => (
                <div
                  key={application._id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={application.userAvatar || application.avatar || application.profileAvatar || application.userProfilePicture} />
                      <AvatarFallback>
                        {(application.userName || application.name || application.userFirstName || application.firstName || 'U').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-semibold">
                          {application.userName || application.name || 
                           `${application.userFirstName || application.firstName || ''} ${application.userLastName || application.lastName || ''}`.trim() || 'Unknown User'}
                        </h4>
                        {getStatusBadge(application.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {application.projectTitle || 'No project title'}
                      </p>
                      <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                        <span>{application.email || application.userEmail || 'No email'}</span>
                        <span>•</span>
                        <span>
                          Rejected: {(() => {
                            const rejectedDate = new Date(application.reviewedAt || application.updatedAt || application.createdAt || application.submittedAt);
                            const now = new Date();
                            const diffInMs = now.getTime() - rejectedDate.getTime();
                            const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
                            const diffInHours = Math.floor(diffInMinutes / 60);
                            const diffInDays = Math.floor(diffInHours / 24);
                            
                            if (diffInDays > 0) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
                            if (diffInHours > 0) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
                            if (diffInMinutes > 0) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
                            return 'Just now';
                          })()} 
                        </span>
                        {application.rejectionReason && (
                          <>
                            <span>•</span>
                            <span>Reason: {application.rejectionReason}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {(() => {
                      const ghLink = (application.githubUrl && application.githubUrl.startsWith('http'))
                        ? application.githubUrl
                        : (application.githubUsername ? `https://github.com/${application.githubUsername}` : null);
                      return (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="border-slate-200"
                          disabled={!ghLink}
                          title={ghLink ? 'Open GitHub profile' : 'No GitHub provided'}
                        >
                          {ghLink ? (
                            <a href={ghLink} target="_blank" rel="noopener noreferrer">
                              GitHub
                            </a>
                          ) : (
                            <span className="pointer-events-none">GitHub</span>
                          )}
                        </Button>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
