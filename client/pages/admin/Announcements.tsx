import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAdminSidebar } from "@/components/admin-layout"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  Calendar,
  MapPin,
  Users,
  Trophy,
  Filter,
  CheckCircle,
  Clock,
  AlertCircle,
} from "lucide-react"
import { format } from "date-fns"
import { api } from "@/services/api"
import { toast } from "@/hooks/use-toast"

interface Event {
  id: string
  _id?: string
  title: string
  description: string
  type: string
  category?: string
  startDate: string
  endDate?: string
  location?: string
  mode?: string
  maxParticipants?: number
  registrationLink?: string
  status: string
  prizes?: string[]
  requirements?: string[]
  createdAt: string
  updatedAt?: string
  organizer: {
    userId: string
    name: string
  }
  images?: string[]
  isVirtual?: boolean
  currentParticipants?: number
  registrationOpen?: boolean
  registrationDeadline?: string
}

export default function Announcements() {
  const navigate = useNavigate()
  const { refreshStats } = useAdminSidebar()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")

  useEffect(() => {
    loadEvents()
  }, [])

  const loadEvents = async () => {
    try {
      console.log('🔄 [Admin] Loading events...')
      const response = await api.getEvents()
      console.log('📦 [Admin] Received events:', response)
      
      // Handle both direct array and nested object response
      const eventsArray = Array.isArray(response) ? response : (response.events || [])
      console.log('📊 [Admin] Events count:', eventsArray.length)
      
      // Ensure all events have proper id field
      const eventsWithIds = eventsArray.map(event => ({
        ...event,
        id: event.id || event._id
      }))
      
      setEvents(eventsWithIds)
      console.log('✅ [Admin] Events loaded successfully:', eventsWithIds.length)
    } catch (error) {
      console.error('❌ [Admin] Failed to load events:', error)
      toast({
        title: "Error",
        description: "Failed to load events",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'published':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'draft':
        return <Clock className="h-4 w-4 text-orange-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'draft':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const filteredEvents = events.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = filterStatus === "all" || event.status === filterStatus
    return matchesSearch && matchesStatus
  })

  // Event action handlers
  const handleView = (event: Event) => {
    // Navigate to view event details page or show modal
    navigate(`/admin/events/${event.id}/view`)
  }

  const handleEdit = (event: Event) => {
    // Navigate to edit event page
    navigate(`/admin/events/${event.id}/edit`)
  }

  const handleDelete = async (eventId: string) => {
    try {
      const result = await api.deleteEvent(eventId)
      console.log('✅ Event deleted successfully:', result.message)
      
      // Remove the event from local state immediately
      setEvents(events.filter(event => event.id !== eventId))
      
      toast({
        title: "Success",
        description: "Event deleted successfully"
      })
      
      // Refresh sidebar stats to update the announcement badge count
      refreshStats()
    } catch (error) {
      console.error('❌ Failed to delete event:', error)
      toast({
        title: "Error",
        description: "Failed to delete event",
        variant: "destructive"
      })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-6">
      {/* Header with just the create button */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex justify-end">
          <Button
            onClick={() => navigate('/admin/create-event')}
            className="bg-[#2e9891] hover:bg-[#2e9891] active:bg-[#2e9891] text-white md:w-auto w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Event
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="max-w-7xl mx-auto mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search events..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="min-w-[120px] hover:bg-white active:bg-white focus:bg-white text-black hover:text-black active:text-black focus:text-black">
                      <Filter className="h-4 w-4 mr-2" />
                      {filterStatus === "all" ? "All Status" : 
                       filterStatus === "published" ? "Published" : "Draft"}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setFilterStatus("all")}>
                      All Status
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFilterStatus("published")}>
                      Published
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFilterStatus("draft")}>
                      Draft
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Events Grid */}
      <div className="max-w-7xl mx-auto">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="h-3 bg-muted rounded"></div>
                    <div className="h-3 bg-muted rounded w-5/6"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-12">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">No events found</h3>
              <p className="text-muted-foreground mb-6">
                {searchTerm || filterStatus !== "all" 
                  ? "Try adjusting your search or filters"
                  : "Create your first event to get started"
                }
              </p>

            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((event) => (
              <Card key={event.id} className="group hover:shadow-lg transition-all duration-200">
                {/* Event Image */}
                {event.images && event.images.length > 0 && typeof event.images[0] === 'string' && event.images[0].trim() !== '' ? (
                  <div className="w-full h-48 overflow-hidden flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                    <img
                      src={(() => {
                        const img = event.images[0] as string;
                        if (img.startsWith('http')) return img;
                        if (img.startsWith('/uploads/')) return img;
                        return `/uploads/${img}`;
                      })()}
                      alt={event.title}
                      className="w-full h-full object-contain p-2"
                      style={{ maxHeight: '100%', maxWidth: '100%' }}
                      onError={(e) => {
                        console.log('Event image failed to load:', event.images?.[0]);
                        const img = event.images[0] as string;
                        const full = img.startsWith('http') ? img : (img.startsWith('/uploads/') ? img : `/uploads/${img}`);
                        console.log('Full image path:', full);
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                ) : (
                  <div className="w-full h-48 bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <span className="text-gray-400">No image</span>
                  </div>
                )}
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg line-clamp-2 group-hover:text-innovation-600 transition-colors">
                        {event.title}
                      </CardTitle>
                      <div className="flex items-center space-x-2 mt-2">
                        <Badge variant="secondary" className="capitalize">
                          {event.type}
                        </Badge>
                        <Badge 
                          variant="outline" 
                          className={cn("capitalize", getStatusColor(event.status))}
                        >
                          <span className="flex items-center space-x-1">
                            {getStatusIcon(event.status)}
                            <span>{event.status}</span>
                          </span>
                        </Badge>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleView(event)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEdit(event)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Event
                        </DropdownMenuItem>
                        <Separator />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onSelect={(e) => e.preventDefault()}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Event
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Event</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{event.title}"? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(event.id)}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {event.description}
                  </p>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      <span>{format(new Date(event.startDate), "MMM dd, yyyy")}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      <span className="truncate">{event.location || 'TBD'}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      <span>{event.maxParticipants || 'Unlimited'} max</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Trophy className="h-3 w-3 text-muted-foreground" />
                      <span>{event.prizes?.length || 0} prizes</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      <span className="truncate">{event.organizer?.name || 'Admin'}</span>
                    </div>
                  </div>

                  {event.prizes && event.prizes.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Top Prize:</p>
                      <p className="text-xs bg-muted/50 p-2 rounded truncate">
                        {event.prizes[0]}
                      </p>
                    </div>
                  )}
                </CardContent>

                <CardFooter className="pt-2">
                  <div className="flex items-center justify-between w-full text-xs text-muted-foreground">
                    <span>Created {format(new Date(event.createdAt), "MMM dd")}</span>
                    <Badge variant="outline" className="text-xs">
                      {event.category || 'General'}
                    </Badge>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Stats Summary */}
      {filteredEvents.length > 0 && (
        <div className="max-w-7xl mx-auto mt-8">
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-foreground">{filteredEvents.length}</p>
                  <p className="text-xs text-muted-foreground">Total Events</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">
                    {filteredEvents.filter(e => e.status === 'published').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Published</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-orange-600">
                    {filteredEvents.filter(e => e.status === 'draft').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Drafts</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-innovation-600">
                    {filteredEvents.filter(e => e.type === 'hackathon').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Hackathons</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
