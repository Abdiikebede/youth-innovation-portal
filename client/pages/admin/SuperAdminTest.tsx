import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
// Removed Tabs components; using custom left sidebar for desktop
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LoaderIcon, Users, Shield, Calendar, Search, Filter, Download, Eye, EyeOff, Trash2, MoreHorizontal, Bell, User, LogOut, UserPlus } from "lucide-react"
import { cn } from "@/lib/utils"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { api } from "@/services/api"

interface User {
  _id: string
  firstName: string
  lastName: string
  email: string
  role: 'user' | 'admin' | 'superadmin'
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
  status: 'draft' | 'published' | 'completed' | 'cancelled' | 'pending_approval' | 'rejected'
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

const SuperAdminTest = () => {
  const navigate = useNavigate()
  const [users, setUsers] = useState<User[]>([])
  const [admins, setAdmins] = useState<User[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("users")
  const [searchTerm, setSearchTerm] = useState("")
  const [filterRole, setFilterRole] = useState("all")
  const [filterVerified, setFilterVerified] = useState("all")
  const [filterEventType, setFilterEventType] = useState("all")
  const [createAdminOpen, setCreateAdminOpen] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [newAdmin, setNewAdmin] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'admin'
  })
  // Removed post-create password dialog; success toast only
  // Cache of known admin passwords keyed by email (plain text only for newly created ones)
  const [adminPasswords, setAdminPasswords] = useState<Record<string, string>>(() => {
    try {
      const s = localStorage.getItem('admin_passwords')
      return s ? JSON.parse(s) : {}
    } catch {
      return {}
    }
  })
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({})
  useEffect(() => {
    try { localStorage.setItem('admin_passwords', JSON.stringify(adminPasswords)) } catch {}
  }, [adminPasswords])
  // Use AdminLayout chrome; hide internal header/sidebar
  const showInternalChrome = false
  // Profile dialog state
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileData, setProfileData] = useState<any | null>(null)

  // Relative time helper (e.g., 2h ago)
  const timeAgo = (iso: string) => {
    const ts = new Date(iso).getTime()
    if (Number.isNaN(ts)) return ''
    const diff = Date.now() - ts
    const sec = Math.max(1, Math.floor(diff / 1000))
    if (sec < 60) return `${sec}s ago`
    const min = Math.floor(sec / 60)
    if (min < 60) return `${min}m ago`
    const hr = Math.floor(min / 60)
    if (hr < 24) return `${hr}h ago`
    const day = Math.floor(hr / 24)
    if (day < 30) return `${day}d ago`
    const mo = Math.floor(day / 30)
    if (mo < 12) return `${mo}mo ago`
    const yr = Math.floor(mo / 12)
    return `${yr}y ago`
  }

  // View profile summary (users and admins)
  const handleViewProfile = async (id: string) => {
    try {
      setProfileOpen(true)
      setProfileLoading(true)
      setProfileData(null)
      const res = await fetch(`/api/users/${id}/summary`, { headers: { 'Authorization': `Bearer ${api.getToken()}` } })
      const data = await res.json()
      setProfileData(data)
    } catch (e: any) {
      toast.error('Failed to load profile')
    } finally {
      setProfileLoading(false)
    }
  }

  // Suspend user: set verified=false
  const handleSuspendUser = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/suspend`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${api.getToken()}` }
      })
      if (!res.ok) throw new Error(await res.text())
      toast.success('User suspended')
      fetchData()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to suspend user')
    }
  }

  // Revoke admin: delete from admins collection
  const handleRevokeAdmin = async (adminId: string) => {
    try {
      const res = await fetch(`/api/admin/admins/${adminId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${api.getToken()}` }
      })
      if (!res.ok) throw new Error(await res.text())
      toast.success('Admin revoked')
      fetchData()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to revoke admin')
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Authenticated requests via ApiService
      const [usersPayload, eventsPayload] = await Promise.all([
        api.getAllUsers(),
        api.getEvents(true),
      ])

      const allUsers = (usersPayload?.users ?? usersPayload ?? []) as any[]
      const eventsData = (eventsPayload?.events ?? eventsPayload ?? []) as any[]

      // Separate users and admins
      const regularUsers = allUsers.filter((user: User) => user.role === 'user')
      const adminUsers = allUsers.filter((user: User) => user.role === 'admin' || user.role === 'superadmin')

      setUsers(regularUsers)
      setAdmins(adminUsers)
      setEvents(eventsData as Event[])
    } catch (error) {
      console.error('Failed to fetch super admin data:', error)
      toast.error('Failed to fetch data from server')
    } finally {
      setLoading(false)
    }
  }

  // Filter functions
  const filteredUsers = users.filter(user => {
    const matchesSearch = `${user.firstName} ${user.lastName} ${user.email}`.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesVerified = filterVerified === "all" || (filterVerified === "verified" ? user.verified : !user.verified)
    const hasJoined = !!user.createdAt
    return matchesSearch && matchesVerified && hasJoined
  })

  const filteredAdmins = admins.filter(admin => {
    const matchesSearch = `${admin.firstName} ${admin.lastName} ${admin.email}`.toLowerCase().includes(searchTerm.toLowerCase())
    const hasJoined = !!admin.createdAt
    return matchesSearch && hasJoined
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
      case 'pending_approval': return 'bg-amber-100 text-amber-800'
      case 'rejected': return 'bg-gray-200 text-gray-700'
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

  const handleLogout = () => {
    api.logout()
    navigate('/login')
    toast.success('Logged out successfully')
  }

  // Event moderation handlers
  const handleApproveEvent = async (eventId: string) => {
    try {
      await api.approveEventAdmin(eventId)
      setEvents(prev => prev.map(ev => ev._id === eventId ? { ...ev, status: 'published' } as Event : ev))
      toast.success('Event approved')
    } catch (e: any) {
      toast.error(e?.message || 'Failed to approve event')
    }
  }

  const handleRejectEvent = async (eventId: string) => {
    try {
      await api.rejectEventAdmin(eventId)
      setEvents(prev => prev.map(ev => ev._id === eventId ? { ...ev, status: 'rejected' } as Event : ev))
      toast.success('Event rejected')
    } catch (e: any) {
      toast.error(e?.message || 'Failed to reject event')
    }
  }

  const getCurrentUser = () => {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      try {
        const user = JSON.parse(userStr)
        return {
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Admin',
          email: user.email || '',
          initials: `${user.firstName?.charAt(0) || ''}${user.lastName?.charAt(0) || ''}`.toUpperCase() || 'AD'
        }
      } catch {}
    }
    return { name: 'Admin', email: '', initials: 'AD' }
  }

  const handleCreateAdmin = async () => {
    try {
      if (!newAdmin.firstName || !newAdmin.lastName || !newAdmin.email || !newAdmin.password) {
        toast.error('All fields are required')
        return
      }

      if (newAdmin.password.length < 6) {
        toast.error('Password must be at least 6 characters')
        return
      }

      // Create admin via API
      const response = await fetch('/api/admin/create-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${api.getToken()}`
        },
        body: JSON.stringify({
          ...newAdmin,
          role: newAdmin.role
        })
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(error)
      }

      const result = await response.json()
      toast.success('Admin created successfully!')
      setCreateAdminOpen(false)
      // Cache original password locally for inline reveal on Admins list
      const plain = result?.plainPassword || newAdmin.password
      setAdminPasswords(prev => ({ ...prev, [newAdmin.email]: String(plain || '') }))
      setNewAdmin({ firstName: '', lastName: '', email: '', password: '', role: 'admin' })
      fetchData() // Refresh data
    } catch (error: any) {
      toast.error(error.message || 'Failed to create admin')
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
    toast.success(`${filename} data exported successfully!`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoaderIcon className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading super admin demo data...</span>
      </div>
    )
  }

  const currentUser = getCurrentUser()
  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Fixed Header */}
      <div className="bg-white shadow-sm border-b fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 gap-4">
            <div className="flex items-center space-x-3">
              <Shield className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Super Admin Dashboard</h1>
            </div>
            <div className="flex items-center gap-4">
              {/* Desktop Search in Header */}
              <div className="hidden md:block">
                <div className="relative w-[420px] lg:w-[520px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users, admins, or events..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              {/* Desktop Filters in Header */}
              <div className="hidden md:flex items-center gap-2">
                {activeTab === 'users' && (
                  <Select value={filterVerified} onValueChange={setFilterVerified}>
                    <SelectTrigger className="w-[180px] lg:w-[200px]">
                      <SelectValue placeholder="Verification Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Users</SelectItem>
                      <SelectItem value="verified">Verified Only</SelectItem>
                      <SelectItem value="unverified">Unverified Only</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {activeTab === 'events' && (
                  <Select value={filterEventType} onValueChange={setFilterEventType}>
                    <SelectTrigger className="w-[180px] lg:w-[200px]">
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src="/placeholder.svg" alt="Admin" />
                      <AvatarFallback className="bg-blue-600 text-white text-xs">
                        {currentUser.initials}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{currentUser.name}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {currentUser.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Add top padding to offset fixed header height */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-8">
        {/* Removed desktop status overview cards */}

        {/* Search and Filters (mobile only) */}
        <Card className="md:hidden">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
              {/* Mobile Search only (header contains desktop search) */}
              <div className="relative w-full md:hidden">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users, admins, or events..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {activeTab === "users" && (
                <div className="md:hidden">
                  <Select value={filterVerified} onValueChange={setFilterVerified}>
                    <SelectTrigger className="w-full sm:w-[180px] lg:w-[200px]">
                      <SelectValue placeholder="Verification Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Users</SelectItem>
                      <SelectItem value="verified">Verified Only</SelectItem>
                      <SelectItem value="unverified">Unverified Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {activeTab === "events" && (
                <div className="md:hidden">
                  <Select value={filterEventType} onValueChange={setFilterEventType}>
                    <SelectTrigger className="w-full sm:w-[180px] lg:w-[200px]">
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
                </div>
              )}
            </div>
          </CardContent>
        </Card>

      {/* Desktop content with left sidebar (md+) */}
      <div className={showInternalChrome ? "hidden md:grid md:grid-cols-[240px_1fr] md:gap-6" : "hidden md:grid md:grid-cols-[240px_1fr] md:gap-6"}>
        {/* Left Sidebar: sticky similar to Admins page */}
        <aside className="hidden md:flex md:flex-col gap-2 py-4 pr-2 sticky top-20 self-start">
          <button
            onClick={() => setActiveTab('users')}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
              activeTab === 'users' ? "bg-primary text-primary-foreground" : "text-gray-700 hover:bg-gray-100"
            )}
          >
            <Users className="h-4 w-4" />
            <span>Users</span>
            <Badge variant={activeTab === 'users' ? "secondary" : "outline"} className="ml-auto text-xs">{filteredUsers.length}</Badge>
          </button>
          <button
            onClick={() => setActiveTab('admins')}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
              activeTab === 'admins' ? "bg-primary text-primary-foreground" : "text-gray-700 hover:bg-gray-100"
            )}
          >
            <Shield className="h-4 w-4" />
            <span>Admins</span>
            <Badge variant={activeTab === 'admins' ? "secondary" : "outline"} className="ml-auto text-xs">{filteredAdmins.length}</Badge>
          </button>
          <button
            onClick={() => setActiveTab('events')}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
              activeTab === 'events' ? "bg-primary text-primary-foreground" : "text-gray-700 hover:bg-gray-100"
            )}
          >
            <Calendar className="h-4 w-4" />
            <span>Events</span>
            <Badge variant={activeTab === 'events' ? "secondary" : "outline"} className="ml-auto text-xs">{filteredEvents.length}</Badge>
          </button>
        </aside>
        {/* Right Content */}
        <div className="space-y-4">
          {activeTab === "users" && (
            <>
              <div className="flex justify-end items-center">
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
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}

          {activeTab === "admins" && (
            <>
              <div className="flex justify-end items-center">
                <div className="flex items-center gap-2">
                  <Dialog open={createAdminOpen} onOpenChange={setCreateAdminOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="flex items-center gap-2">
                        <UserPlus className="h-4 w-4" />
                        Create Admin
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>Create New Administrator</DialogTitle>
                        <DialogDescription>
                          Add a new administrator to the system. They will have access to the admin panel.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="firstName" className="text-right">
                            First Name
                          </Label>
                          <Input
                            id="firstName"
                            value={newAdmin.firstName}
                            onChange={(e) => setNewAdmin({...newAdmin, firstName: e.target.value})}
                            className="col-span-3"
                          />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="lastName" className="text-right">
                            Last Name
                          </Label>
                          <Input
                            id="lastName"
                            value={newAdmin.lastName}
                            onChange={(e) => setNewAdmin({...newAdmin, lastName: e.target.value})}
                            className="col-span-3"
                          />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="email" className="text-right">
                            Email
                          </Label>
                          <Input
                            id="email"
                            type="email"
                            value={newAdmin.email}
                            onChange={(e) => setNewAdmin({...newAdmin, email: e.target.value})}
                            className="col-span-3"
                          />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="password" className="text-right">
                            Password
                          </Label>
                          <Input
                            id="password"
                            type="password"
                            value={newAdmin.password}
                            onChange={(e) => setNewAdmin({...newAdmin, password: e.target.value})}
                            className="col-span-3"
                          />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="role" className="text-right">
                            Role
                          </Label>
                          <Select value={newAdmin.role} onValueChange={(value) => setNewAdmin({...newAdmin, role: value})}>
                            <SelectTrigger className="col-span-3">
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="superadmin">Super Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button type="submit" onClick={handleCreateAdmin}>
                          Create Administrator
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
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
                            {visiblePasswords[admin.email] && adminPasswords[admin.email] && (
                              <div className="mt-2 flex items-center gap-2 max-w-sm">
                                <Input type="text" readOnly value={adminPasswords[admin.email]} />
                              </div>
                            )}
                            <div className="flex flex-wrap gap-2 mt-2">
                              {admin.role === 'superadmin' ? (
                                <Badge className="bg-purple-600 text-white">Super Admin</Badge>
                              ) : (
                                <Badge className="bg-destructive text-white">Admin</Badge>
                              )}
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
                          <Button
                            variant="ghost"
                            size="icon"
                            title={visiblePasswords[admin.email] ? 'Hide password' : 'Show password'}
                            onClick={() => {
                              const pw = adminPasswords[admin.email]
                              if (!pw) { toast.info('Password not available for this admin') ; return }
                              setVisiblePasswords(v => ({ ...v, [admin.email]: !v[admin.email] }))
                            }}
                          >
                            {visiblePasswords[admin.email] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}

          {activeTab === "events" && (
            <>
              <div className="flex justify-end items-center">
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
                            <Badge className={cn("text-xs", getEventTypeColor(event.type))}>
                              {event.type}
                            </Badge>
                          </div>
                          {Array.isArray((event as any).images) && (event as any).images.length > 0 && (
                            <div className="mb-3">
                              <div className="grid grid-cols-3 gap-2">
                                {(event as any).images.slice(0,3).map((img: string, idx: number) => (
                                  <img
                                    key={idx}
                                    src={/^https?:\/\//i.test(img) ? img : `${window.location.origin}${img}`}
                                    alt={`${event.title} image ${idx+1}`}
                                    className="h-24 w-full object-cover rounded-md border"
                                    loading="lazy"
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                          
                          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                            {event.description}
                          </p>
                          <div className="space-y-1 text-sm">
                            <div><span className="font-medium">Organizer:</span> {event.organizer.name}</div>
                            <div><span className="font-medium">Start:</span> {new Date(event.startDate).toLocaleDateString()}</div>
                            {event.endDate && (
                              <div><span className="font-medium">End:</span> {new Date(event.endDate).toLocaleDateString()}</div>
                            )}
                            <div><span className="font-medium">Location:</span> {event.isVirtual ? 'Virtual' : (event.location || 'TBD')}</div>
                            <div className="text-muted-foreground">Created {timeAgo(event.createdAt)}</div>
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-2">
                          {event.status === 'pending_approval' ? (
                            <div className="flex gap-2">
                              <Button size="sm" variant="default" onClick={() => handleApproveEvent(event._id)}>
                                Approve
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => handleRejectEvent(event._id)}>
                                Reject
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mobile Content */}
      <div className="md:hidden">
        {activeTab === "users" && (
          <div className="space-y-4">
            <div className="flex justify-end items-center">
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
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={getUserAvatar(user)} alt={`${user.firstName} ${user.lastName}`} />
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1">
                        <h3 className="font-semibold text-sm">{user.firstName} {user.lastName}</h3>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          <Badge variant={user.verified ? "default" : "secondary"} className="text-xs">
                            {user.verified ? "Verified" : "Unverified"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeTab === "admins" && (
          <div className="space-y-4">
            <div className="flex justify-end items-center">
              <div className="flex items-center gap-2">
                <Dialog open={createAdminOpen} onOpenChange={setCreateAdminOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="flex items-center gap-2">
                      <UserPlus className="h-4 w-4" />
                      Create Admin
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Create New Administrator</DialogTitle>
                      <DialogDescription>
                        Add a new administrator to the system. They will have access to the admin panel.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="firstName" className="text-right">
                          First Name
                        </Label>
                        <Input
                          id="firstName"
                          value={newAdmin.firstName}
                          onChange={(e) => setNewAdmin({...newAdmin, firstName: e.target.value})}
                          className="col-span-3"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="lastName" className="text-right">
                          Last Name
                        </Label>
                        <Input
                          id="lastName"
                          value={newAdmin.lastName}
                          onChange={(e) => setNewAdmin({...newAdmin, lastName: e.target.value})}
                          className="col-span-3"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="email" className="text-right">
                          Email
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          value={newAdmin.email}
                          onChange={(e) => setNewAdmin({...newAdmin, email: e.target.value})}
                          className="col-span-3"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="password" className="text-right">
                          Password
                        </Label>
                        <Input
                          id="password"
                          type="password"
                          value={newAdmin.password}
                          onChange={(e) => setNewAdmin({...newAdmin, password: e.target.value})}
                          className="col-span-3"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="role" className="text-right">
                          Role
                        </Label>
                        <Select value={newAdmin.role} onValueChange={(value) => setNewAdmin({...newAdmin, role: value})}>
                          <SelectTrigger className="col-span-3">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="superadmin">Super Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" onClick={handleCreateAdmin}>
                        Create Administrator
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
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
            </div>

            <div className="grid gap-4">
              {filteredAdmins.map((admin) => (
                <Card key={admin._id} className="hover:shadow-md transition-shadow border-orange-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={getUserAvatar(admin)} alt={`${admin.firstName} ${admin.lastName}`} />
                        <AvatarFallback className="bg-destructive text-white">
                          {admin.firstName.charAt(0)}{admin.lastName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1">
                        <h3 className="font-semibold text-sm flex items-center gap-1">
                          {admin.firstName} {admin.lastName}
                          <Shield className="h-3 w-3 text-destructive" />
                        </h3>
                        <p className="text-xs text-muted-foreground">{admin.email}</p>
                        {visiblePasswords[admin.email] && adminPasswords[admin.email] && (
                          <div className="mt-2 flex items-center gap-2">
                            <Input type="text" readOnly value={adminPasswords[admin.email]} />
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1 mt-1">
                          <Badge className="bg-destructive text-white text-xs">
                            Administrator
                          </Badge>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        title={visiblePasswords[admin.email] ? 'Hide password' : 'Show password'}
                        onClick={() => {
                          const pw = adminPasswords[admin.email]
                          if (!pw) { toast.info('Password not available for this admin') ; return }
                          setVisiblePasswords(v => ({ ...v, [admin.email]: !v[admin.email] }))
                        }}
                      >
                        {visiblePasswords[admin.email] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeTab === "events" && (
          <div className="space-y-4">
            <div className="flex justify-end items-center">
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
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-sm">{event.title}</h3>
                        <Badge className={cn("text-xs", getEventTypeColor(event.type))}>
                          {event.type}
                        </Badge>
                      </div>

                      {Array.isArray((event as any).images) && (event as any).images.length > 0 && (
                        <div>
                          <div className="grid grid-cols-2 gap-2">
                            {(event as any).images.slice(0,2).map((img: string, idx: number) => (
                              <img
                                key={idx}
                                src={/^https?:\/\//i.test(img) ? img : `${window.location.origin}${img}`}
                                alt={`${event.title} image ${idx+1}`}
                                className="h-24 w-full object-cover rounded-md border"
                                loading="lazy"
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {event.description}
                      </p>

                      <div className="text-xs space-y-1">
                        <div><span className="font-medium">Organizer:</span> {event.organizer.name}</div>
                        <div><span className="font-medium">Start:</span> {new Date(event.startDate).toLocaleDateString()}</div>
                        {event.endDate && (
                          <div><span className="font-medium">End:</span> {new Date(event.endDate).toLocaleDateString()}</div>
                        )}
                        <div><span className="font-medium">Location:</span> {event.isVirtual ? 'Virtual' : (event.location || 'TBD')}</div>
                        <div className="text-muted-foreground">Created {timeAgo(event.createdAt)}</div>
                      </div>

                      {event.status === 'pending_approval' && (
                        <div className="pt-2 flex gap-2">
                          <Button size="sm" variant="default" onClick={() => handleApproveEvent(event._id)}>
                            Approve
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleRejectEvent(event._id)}>
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
      </div>

      {/* Mobile Footer Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border">
        <nav className="flex items-center justify-around px-1 py-2">
          <button
            onClick={() => setActiveTab("users")}
            className={cn(
              "relative flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200 min-w-0 flex-1 mx-1",
              activeTab === "users"
                ? "text-destructive bg-destructive/10"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <Users className="h-5 w-5 mb-1" />
            <span className="text-xs">Users</span>
            {filteredUsers.length > 0 && (
              <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 bg-blue-500 text-white flex items-center justify-center text-xs">
                {filteredUsers.length > 99 ? "99+" : filteredUsers.length}
              </Badge>
            )}
            {activeTab === "users" && (
              <div className="absolute top-1 left-1/2 transform -translate-x-1/2 w-6 h-1 bg-destructive rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab("admins")}
            className={cn(
              "relative flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200 min-w-0 flex-1 mx-1",
              activeTab === "admins"
                ? "text-destructive bg-destructive/10"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <Shield className="h-5 w-5 mb-1" />
            <span className="text-xs">Admins</span>
            {filteredAdmins.length > 0 && (
              <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 bg-red-500 text-white flex items-center justify-center text-xs">
                {filteredAdmins.length > 99 ? "99+" : filteredAdmins.length}
              </Badge>
            )}
            {activeTab === "admins" && (
              <div className="absolute top-1 left-1/2 transform -translate-x-1/2 w-6 h-1 bg-destructive rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab("events")}
            className={cn(
              "relative flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200 min-w-0 flex-1 mx-1",
              activeTab === "events"
                ? "text-destructive bg-destructive/10"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <Calendar className="h-5 w-5 mb-1" />
            <span className="text-xs">Events</span>
            {filteredEvents.length > 0 && (
              <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 bg-green-500 text-white flex items-center justify-center text-xs">
                {filteredEvents.length > 99 ? "99+" : filteredEvents.length}
              </Badge>
            )}
            {activeTab === "events" && (
              <div className="absolute top-1 left-1/2 transform -translate-x-1/2 w-6 h-1 bg-destructive rounded-full" />
            )}
          </button>
        </nav>
      </div>

      {/* Profile Dialog */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Profile Summary</DialogTitle>
            <DialogDescription>Quick view of user profile.</DialogDescription>
          </DialogHeader>
          {profileLoading ? (
            <div className="flex items-center gap-2"><LoaderIcon className="h-4 w-4 animate-spin" /> Loading...</div>
          ) : profileData ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={profileData.githubUrl ? `${profileData.avatar || ''}` : ''} />
                  <AvatarFallback>{(profileData.name || 'U').slice(0,2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">{profileData.name}</div>
                  <div className="text-muted-foreground">{profileData.email}</div>
                </div>
              </div>
              {profileData.githubUrl && (
                <div>GitHub: <a className="text-blue-600 underline" href={profileData.githubUrl} target="_blank" rel="noreferrer">{profileData.githubUrl}</a></div>
              )}
              <div>Followers: {profileData.followersCount ?? 0}</div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No data.</div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  )
}

export default SuperAdminTest
