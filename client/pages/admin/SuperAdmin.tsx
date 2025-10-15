import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api } from "@/services/api"
import { LoaderIcon, Users, Shield, Calendar, Search, Filter, Download, Eye, Trash2, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { toast } from "sonner"

interface User {
  _id: string
  firstName: string
  lastName: string
  email: string
  role: 'user' | 'admin'
  verified: boolean
  avatar?: string
  profile?: {
    avatar?: string
  }
  createdAt: string
  githubStats?: {
    username: string
    totalCommits: number
    totalRepos: number
  }
}

interface Event {
  _id: string
  title: string
  description: string
  type: 'hackathon' | 'workshop' | 'competition' | 'announcement'
  startDate: string
  endDate?: string
  status: 'draft' | 'published' | 'completed' | 'cancelled'
  organizer: {
    userId: string
    name: string
  }
  participants: any[]
  currentParticipants: number
  maxParticipants?: number
  location?: string
  isVirtual: boolean
  createdAt: string
}

const SuperAdmin = () => {
  const [users, setUsers] = useState<User[]>([])
  const [admins, setAdmins] = useState<User[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("users")
  const [searchTerm, setSearchTerm] = useState("")
  const [filterRole, setFilterRole] = useState("all")
  const [filterVerified, setFilterVerified] = useState("all")
  const [filterEventType, setFilterEventType] = useState("all")

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch all data concurrently
      const [usersResponse, eventsResponse] = await Promise.all([
        api.getAllUsers(),
        api.getEvents()
      ])

      const allUsers = usersResponse.users || []
      
      // Separate users and admins
      const regularUsers = allUsers.filter((user: User) => user.role === 'user')
      const adminUsers = allUsers.filter((user: User) => user.role === 'admin')

      setUsers(regularUsers)
      setAdmins(adminUsers)
      setEvents(eventsResponse.events || eventsResponse || [])
    } catch (error) {
      console.error('Failed to fetch super admin data:', error)
      toast.error('Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }

  // Filter functions
  const filteredUsers = users.filter(user => {
    const matchesSearch = `${user.firstName} ${user.lastName} ${user.email}`.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesVerified = filterVerified === "all" || (filterVerified === "verified" ? user.verified : !user.verified)
    return matchesSearch && matchesVerified
  })

  const filteredAdmins = admins.filter(admin => {
    const matchesSearch = `${admin.firstName} ${admin.lastName} ${admin.email}`.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  })

  const filteredEvents = events.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         event.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = filterEventType === "all" || event.type === filterEventType
    return matchesSearch && matchesType
  })

  const getUserAvatar = (user: User) => {
    return user.avatar || user.profile?.avatar || ""
  }

  const getEventStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'bg-green-100 text-green-800'
      case 'draft': return 'bg-yellow-100 text-yellow-800'
      case 'completed': return 'bg-blue-100 text-blue-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'hackathon': return 'bg-purple-100 text-purple-800'
      case 'workshop': return 'bg-blue-100 text-blue-800'
      case 'competition': return 'bg-orange-100 text-orange-800'
      case 'announcement': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const exportData = (data: any[], filename: string) => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      [
        Object.keys(data[0]).join(","),
        ...data.map(item => Object.values(item).map(val => 
          typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val
        ).join(","))
      ].join("\n")
    
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoaderIcon className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading super admin data...</span>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6 text-destructive" />
            Super Admin Dashboard
          </h1>
          <p className="text-muted-foreground">Manage users, admins, and events across the platform</p>
        </div>
        
        {/* Stats Overview */}
        <div className="flex flex-wrap gap-4">
          <Card className="px-4 py-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">{users.length} Users</span>
            </div>
          </Card>
          <Card className="px-4 py-2">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium">{admins.length} Admins</span>
            </div>
          </Card>
          <Card className="px-4 py-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">{events.length} Events</span>
            </div>
          </Card>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users, admins, or events..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {activeTab === "users" && (
              <Select value={filterVerified} onValueChange={setFilterVerified}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Verification Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="verified">Verified Only</SelectItem>
                  <SelectItem value="unverified">Unverified Only</SelectItem>
                </SelectContent>
              </Select>
            )}
            
            {activeTab === "events" && (
              <Select value={filterEventType} onValueChange={setFilterEventType}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Event Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="hackathon">Hackathon</SelectItem>
                  <SelectItem value="workshop">Workshop</SelectItem>
                  <SelectItem value="competition">Competition</SelectItem>
                  <SelectItem value="announcement">Announcement</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Users</span>
            <Badge variant="secondary">{filteredUsers.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="admins" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Admins</span>
            <Badge variant="secondary">{filteredAdmins.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="events" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Events</span>
            <Badge variant="secondary">{filteredEvents.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Platform Users</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportData(filteredUsers, 'users')}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
          
          <div className="grid gap-4">
            {filteredUsers.map((user) => (
              <Card key={user._id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={getUserAvatar(user)} alt={`${user.firstName} ${user.lastName}`} />
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1">
                        <h3 className="font-semibold">{user.firstName} {user.lastName}</h3>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Badge variant={user.verified ? "default" : "secondary"}>
                            {user.verified ? "Verified" : "Unverified"}
                          </Badge>
                          {user.githubStats && (
                            <Badge variant="outline">
                              GitHub: {user.githubStats.totalCommits} commits
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className="text-right text-sm text-muted-foreground">
                        <p>Joined {new Date(user.createdAt).toLocaleDateString()}</p>
                      </div>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="h-4 w-4 mr-2" />
                            View Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Suspend User
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Admins Tab */}
        <TabsContent value="admins" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Platform Administrators</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportData(filteredAdmins, 'admins')}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
          
          <div className="grid gap-4">
            {filteredAdmins.map((admin) => (
              <Card key={admin._id} className="hover:shadow-md transition-shadow border-orange-200">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={getUserAvatar(admin)} alt={`${admin.firstName} ${admin.lastName}`} />
                        <AvatarFallback className="bg-destructive text-white">
                          {admin.firstName.charAt(0)}{admin.lastName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1">
                        <h3 className="font-semibold flex items-center gap-2">
                          {admin.firstName} {admin.lastName}
                          <Shield className="h-4 w-4 text-destructive" />
                        </h3>
                        <p className="text-sm text-muted-foreground">{admin.email}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Badge className="bg-destructive text-white">Administrator</Badge>
                          {admin.verified && (
                            <Badge variant="outline">Verified</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className="text-right text-sm text-muted-foreground">
                        <p>Admin since {new Date(admin.createdAt).toLocaleDateString()}</p>
                      </div>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="h-4 w-4 mr-2" />
                            View Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Revoke Admin
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Events Tab */}
        <TabsContent value="events" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Platform Events</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportData(filteredEvents, 'events')}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
          
          <div className="grid gap-4">
            {filteredEvents.map((event) => (
              <Card key={event._id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg">{event.title}</h3>
                        <Badge className={cn("text-xs", getEventStatusColor(event.status))}>
                          {event.status}
                        </Badge>
                        <Badge className={cn("text-xs", getEventTypeColor(event.type))}>
                          {event.type}
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {event.description}
                      </p>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="font-medium">Start:</span> {new Date(event.startDate).toLocaleDateString()}
                        </div>
                        {event.endDate && (
                          <div>
                            <span className="font-medium">End:</span> {new Date(event.endDate).toLocaleDateString()}
                          </div>
                        )}
                        <div>
                          <span className="font-medium">Organizer:</span> {event.organizer.name}
                        </div>
                        <div>
                          <span className="font-medium">Participants:</span> {event.currentParticipants}
                          {event.maxParticipants && ` / ${event.maxParticipants}`}
                        </div>
                        <div>
                          <span className="font-medium">Location:</span> {event.isVirtual ? "Virtual" : event.location || "TBD"}
                        </div>
                        <div>
                          <span className="font-medium">Created:</span> {new Date(event.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="h-4 w-4 mr-2" />
                            View Event
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Event
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default SuperAdmin
