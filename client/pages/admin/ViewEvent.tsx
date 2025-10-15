import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Calendar, Clock, MapPin, Users, Trophy, CheckCircle, AlertCircle, Edit, Trash2 } from 'lucide-react';
import { api } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Event {
  id: string
  title: string
  description: string
  type: string
  category: string
  startDate: string
  endDate: string
  location: string
  mode: string
  maxParticipants: string
  registrationLink: string
  status: string
  prizes: string[]
  requirements: string[]
  createdAt: string
}

export default function ViewEvent() {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (eventId) {
      loadEvent()
    }
  }, [eventId])

  const loadEvent = async () => {
    try {
      setLoading(true)
      const response = await api.getEvent(eventId!)
      setEvent(response.event)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load event details",
        variant: "destructive"
      })
      navigate('/admin/announcements')
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

  const handleEdit = () => {
    navigate(`/admin/events/${eventId}/edit`)
  }

  const handleDelete = async () => {
    if (!event) return
    
    if (window.confirm(`Are you sure you want to delete "${event.title}"? This action cannot be undone.`)) {
      try {
        await api.deleteEvent(event.id)
        toast({
          title: "Success",
          description: "Event deleted successfully"
        })
        navigate('/admin/announcements')
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to delete event",
          variant: "destructive"
        })
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="h-64 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-6">
        <div className="max-w-4xl mx-auto text-center py-12">
          <h2 className="text-2xl font-bold mb-4">Event Not Found</h2>
          <Button onClick={() => navigate('/admin/announcements')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Events
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              onClick={() => navigate('/admin/announcements')}
              className="p-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Event Details</h1>
              <p className="text-muted-foreground">View and manage event information</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button onClick={handleEdit} variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              Edit Event
            </Button>
            <Button onClick={handleDelete} variant="destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Event
            </Button>
          </div>
        </div>

        {/* Event Details */}
        <div className="space-y-6">
          {/* Main Info Card */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-2xl mb-3">{event.title}</CardTitle>
                  <div className="flex items-center space-x-2 mb-4">
                    <Badge variant="secondary" className="capitalize">
                      {event.type}
                    </Badge>
                    <Badge variant="outline" className={cn("capitalize", getStatusColor(event.status))}>
                      <span className="flex items-center space-x-1">
                        {getStatusIcon(event.status)}
                        <span>{event.status}</span>
                      </span>
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Description</h3>
                <p className="text-muted-foreground leading-relaxed">{event.description}</p>
              </div>

              <Separator />

              {/* Event Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Start Date</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(event.startDate).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">End Date</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(event.endDate).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Location</p>
                      <p className="text-sm text-muted-foreground">{event.location}</p>
                      <p className="text-xs text-muted-foreground capitalize">({event.mode})</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Max Participants</p>
                      <p className="text-sm text-muted-foreground">{event.maxParticipants}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Trophy className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Category</p>
                      <p className="text-sm text-muted-foreground capitalize">{event.category}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Prizes */}
              {event.prizes && event.prizes.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-semibold mb-3">Prizes</h3>
                    <div className="space-y-2">
                      {event.prizes.map((prize, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <Trophy className="h-4 w-4 text-yellow-500" />
                          <span className="text-sm">{prize}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Requirements */}
              {event.requirements && event.requirements.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-semibold mb-3">Requirements</h3>
                    <div className="space-y-2">
                      {event.requirements.map((requirement, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-sm">{requirement}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <Separator />

              {/* Meta Info */}
              <div className="text-xs text-muted-foreground">
                <p>Created: {new Date(event.createdAt).toLocaleDateString()}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
