import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save, Eye } from 'lucide-react';
import { api } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

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

export default function EditEvent() {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [eventData, setEventData] = useState<Partial<Event>>({
    title: '',
    description: '',
    type: 'hackathon',
    category: 'technology',
    startDate: '',
    endDate: '',
    location: '',
    mode: 'hybrid',
    maxParticipants: '',
    status: 'draft',
    prizes: [],
    requirements: []
  })

  useEffect(() => {
    if (eventId) {
      loadEvent()
    }
  }, [eventId])

  const loadEvent = async () => {
    try {
      setLoading(true)
      const response = await api.getEvent(eventId!)
      setEventData(response.event)
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

  const handleInputChange = (field: string, value: string) => {
    setEventData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleArrayChange = (field: 'prizes' | 'requirements', value: string) => {
    const items = value.split('\n').filter(item => item.trim())
    setEventData(prev => ({
      ...prev,
      [field]: items
    }))
  }

  const handleSave = async (status: string) => {
    if (!eventData.title || !eventData.description || !eventData.type) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      })
      return
    }

    setSaving(true)
    try {
      const updatedEvent = {
        ...eventData,
        status,
        updatedAt: new Date().toISOString()
      }

      await api.updateEvent(eventId!, updatedEvent)

      toast({
        title: "Success!",
        description: `Event ${status === 'published' ? 'published' : 'saved'} successfully`,
      })

      navigate('/admin/announcements')
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update event. Please try again.",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
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
              <h1 className="text-3xl font-bold text-foreground">Edit Event</h1>
              <p className="text-muted-foreground">Update event information and settings</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => navigate(`/admin/events/${eventId}/view`)}
              variant="outline"
            >
              <Eye className="h-4 w-4 mr-2" />
              View Event
            </Button>
          </div>
        </div>

        {/* Edit Form */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Event Title *</label>
                  <Input
                    value={eventData.title || ''}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder="Enter event title"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Description *</label>
                  <Textarea
                    value={eventData.description || ''}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Describe your event..."
                    rows={4}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Event Type *</label>
                    <Select value={eventData.type} onValueChange={(value) => handleInputChange('type', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hackathon">Hackathon</SelectItem>
                        <SelectItem value="workshop">Workshop</SelectItem>
                        <SelectItem value="competition">Competition</SelectItem>
                        <SelectItem value="conference">Conference</SelectItem>
                        <SelectItem value="networking">Networking</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Category</label>
                    <Select value={eventData.category} onValueChange={(value) => handleInputChange('category', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="technology">Technology</SelectItem>
                        <SelectItem value="business">Business</SelectItem>
                        <SelectItem value="design">Design</SelectItem>
                        <SelectItem value="social-impact">Social Impact</SelectItem>
                        <SelectItem value="healthcare">Healthcare</SelectItem>
                        <SelectItem value="education">Education</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Event Details */}
            <Card>
              <CardHeader>
                <CardTitle>Event Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Start Date</label>
                    <Input
                      type="datetime-local"
                      value={eventData.startDate ? new Date(eventData.startDate).toISOString().slice(0, 16) : ''}
                      onChange={(e) => handleInputChange('startDate', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">End Date</label>
                    <Input
                      type="datetime-local"
                      value={eventData.endDate ? new Date(eventData.endDate).toISOString().slice(0, 16) : ''}
                      onChange={(e) => handleInputChange('endDate', e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Location</label>
                  <Input
                    value={eventData.location || ''}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    placeholder="Event location or online platform"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Mode</label>
                    <Select value={eventData.mode} onValueChange={(value) => handleInputChange('mode', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="online">Online</SelectItem>
                        <SelectItem value="offline">Offline</SelectItem>
                        <SelectItem value="hybrid">Hybrid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Max Participants</label>
                    <Input
                      value={eventData.maxParticipants || ''}
                      onChange={(e) => handleInputChange('maxParticipants', e.target.value)}
                      placeholder="e.g., 100"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Additional Information */}
            <Card>
              <CardHeader>
                <CardTitle>Additional Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Prizes (one per line)</label>
                  <Textarea
                    value={eventData.prizes?.join('\n') || ''}
                    onChange={(e) => handleArrayChange('prizes', e.target.value)}
                    placeholder="1st Place: $5000&#10;2nd Place: $3000&#10;3rd Place: $1000"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Requirements (one per line)</label>
                  <Textarea
                    value={eventData.requirements?.join('\n') || ''}
                    onChange={(e) => handleArrayChange('requirements', e.target.value)}
                    placeholder="Must be 18+ years old&#10;Team size: 2-4 members&#10;Submit working prototype"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status */}
            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Current Status:</span>
                    <Badge variant="outline" className="capitalize">
                      {eventData.status}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={() => handleSave('draft')}
                  variant="outline"
                  className="w-full"
                  disabled={saving}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save as Draft'}
                </Button>
                
                <Button
                  onClick={() => handleSave('published')}
                  className="w-full bg-innovation-500 hover:bg-innovation-600"
                  disabled={saving}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Publishing...' : 'Update & Publish'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
