import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import {
  CalendarIcon,
  MapPin,
  Users,
  Trophy,
  Gift,
  Clock,
  FileText,
  Image as ImageIcon,
  X,
  Plus,
  CheckCircle,
  AlertTriangle,
  Upload,
  User,
  Link2,
} from "lucide-react"
import { format } from "date-fns"
import { api } from "@/services/api"

interface EventData {
  title: string
  description: string
  type: string
  category: string
  startDate: Date | undefined
  endDate: Date | undefined
  registrationDeadline: Date | undefined
  location: string
  mode: string
  maxParticipants: string
  registrationLink: string
  prizes: string[]
  requirements: string[]
  images: (File | string)[]
  status: string
  organizer: {
    name: string;
    userId?: string;
  }
}

export default function CreateEvent() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [eventData, setEventData] = useState<EventData>({
    title: '',
    description: '',
    type: '',
    category: '',
    startDate: undefined,
    endDate: undefined,
    registrationDeadline: undefined,
    location: '',
    mode: 'online',
    maxParticipants: '',
    registrationLink: '',
    prizes: [],
    requirements: [],
    images: [],
    status: 'upcoming',
    organizer: {
      name: 'Innovation Portal Admin',
      userId: ''
    }
  }) // No mock data, only empty/default

  const [newPrize, setNewPrize] = useState("")
  const [newRequirement, setNewRequirement] = useState("")

  // Handle drag and drop events
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const processImageFiles = (files: File[]) => {
    const validFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (validFiles.length === 0) {
      toast({
        title: 'Invalid files',
        description: 'Please upload valid image files',
        variant: 'destructive',
      });
      return;
    }

    // Check total images won't exceed limit
    const totalImages = eventData.images.length + validFiles.length;
    if (totalImages > 5) {
      toast({
        title: 'Too many images',
        description: 'You can upload a maximum of 5 images',
        variant: 'destructive',
      });
      return;
    }

    // Add new files to state
    setEventData(prev => ({
      ...prev,
      images: [...prev.images, ...validFiles]
    }));
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      processImageFiles(files);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    processImageFiles(files);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    setEventData(prev => {
      const newImages = [...prev.images];
      newImages.splice(index, 1);
      return { ...prev, images: newImages };
    });
  };

  const handleSubmit = async (status: 'published' | 'draft') => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('title', eventData.title);
      formData.append('description', eventData.description);
      formData.append('type', eventData.type || 'workshop');
      formData.append('category', eventData.category || 'general');
      if (eventData.startDate) formData.append('startDate', eventData.startDate.toISOString());
      if (eventData.endDate) formData.append('endDate', eventData.endDate.toISOString());
      if (eventData.registrationDeadline) formData.append('registrationDeadline', eventData.registrationDeadline.toISOString());
      formData.append('location', eventData.location || 'Online');
      formData.append('mode', eventData.mode || 'online');
      formData.append('maxParticipants', eventData.maxParticipants?.toString() || '0');
      formData.append('registrationLink', eventData.registrationLink || '');
      formData.append('status', status);
      formData.append('organizerName', eventData.organizer.name);
      if (eventData.organizer.userId) formData.append('organizerUserId', eventData.organizer.userId);
      eventData.prizes.forEach(p => formData.append('prizes', p));
      eventData.requirements.forEach(r => formData.append('requirements', r));
      eventData.images.forEach(img => {
        if (img instanceof File) {
          formData.append('images', img);
        }
      });
      await api.createEvent(formData);
      toast({
        title: 'Success!',
        description: `Event ${status === 'published' ? 'published' : 'saved as draft'} successfully`,
      });
      navigate('/admin/announcements');
    } catch (error) {
      console.error('Error creating event:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create event',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof EventData, value: any) => {
    setEventData(prev => {
      const updated = {
        ...prev,
        [field]: value
      } as EventData;
      
      // Preserve images in state update - critical fix for image loss
      if (field !== 'images' && prev.images.length > 0) {
        updated.images = [...prev.images];
      }
      
      return updated;
    });
  };

  const addPrize = () => {
    if (newPrize.trim()) {
      setEventData(prev => ({
        ...prev,
        prizes: [...prev.prizes, newPrize.trim()]
      }));
      setNewPrize("");
    }
  };

  const removePrize = (index: number) => {
    setEventData(prev => ({
      ...prev,
      prizes: prev.prizes.filter((_, i) => i !== index)
    }));
  };

  const addRequirement = () => {
    if (newRequirement.trim()) {
      setEventData(prev => ({
        ...prev,
        requirements: [...prev.requirements, newRequirement.trim()]
      }));
      setNewRequirement("");
    }
  };

  const removeRequirement = (index: number) => {
    setEventData(prev => ({
      ...prev,
      requirements: prev.requirements.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Create Event</h1>
            <p className="text-muted-foreground">Design engaging hackathons and innovation events for the community</p>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate('/admin/announcements')}
            className="hidden md:flex"
          >
            Back to Events
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>Basic Information</span>
              </CardTitle>
              <CardDescription>
                Set up the fundamental details of your event
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Event Title *</Label>
                  <Input
                    id="title"
                    placeholder="e.g., AI Innovation Hackathon 2024"
                    value={eventData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Event Type *</Label>
                  <Select value={eventData.type} onValueChange={(value) => handleInputChange('type', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select event type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hackathon">Hackathon</SelectItem>
                      <SelectItem value="competition">Competition</SelectItem>
                      <SelectItem value="meetup">Meetup</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={eventData.category} onValueChange={(value) => handleInputChange('category', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="technology">Technology</SelectItem>
                      <SelectItem value="health">Health</SelectItem>
                      <SelectItem value="education">Education</SelectItem>
    
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mode">Event Mode</Label>
                  <Select value={eventData.mode} onValueChange={(value) => handleInputChange('mode', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in-person">In-Person</SelectItem>
                      <SelectItem value="virtual">Virtual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Event Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Describe your event, its goals, and what participants can expect..."
                  value={eventData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          {/* Schedule & Location */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CalendarIcon className="h-5 w-5" />
                <span>Schedule & Location</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !eventData.startDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {eventData.startDate ? format(eventData.startDate, "PPP") : "Pick start date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={eventData.startDate}
                        onSelect={(date) => handleInputChange('startDate', date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !eventData.endDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {eventData.endDate ? format(eventData.endDate, "PPP") : "Pick end date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={eventData.endDate}
                        onSelect={(date) => handleInputChange('endDate', date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Registration Deadline</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !eventData.registrationDeadline && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {eventData.registrationDeadline ? format(eventData.registrationDeadline, "PPP") : "Pick deadline"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={eventData.registrationDeadline}
                        onSelect={(date) => handleInputChange('registrationDeadline', date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location">Location <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="location"
                      placeholder="E.g., Online, University of Gondar, etc."
                      className="pl-10"
                      value={eventData.location}
                      onChange={(e) => handleInputChange('location', e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="organizer">Organizer</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="organizer"
                      placeholder="Event organizer name"
                      className="pl-10"
                      value={eventData.organizer.name}
                      onChange={(e) => handleInputChange("organizer", { ...eventData.organizer, name: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="registrationLink">Registration Link</Label>
                  <div className="relative">
                    <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="registrationLink"
                      type="url"
                      placeholder="https://example.com/register"
                      className="pl-10"
                      value={eventData.registrationLink}
                      onChange={(e) => handleInputChange('registrationLink', e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="maxParticipants">Max Participants</Label>
                  <Input
                    id="maxParticipants"
                    type="number"
                    placeholder="e.g., 100"
                    value={eventData.maxParticipants}
                    onChange={(e) => handleInputChange('maxParticipants', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Prizes & Requirements */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Trophy className="h-5 w-5" />
                <span>Prizes & Requirements</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Prizes */}
              <div className="space-y-3">
                <Label>Prizes & Rewards</Label>
                <div className="flex space-x-2">
                  <Input
                    placeholder="e.g., 1st Place: 50,000 ETB + Mentorship"
                    value={newPrize}
                    onChange={(e) => setNewPrize(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addPrize()}
                  />
                  <Button onClick={addPrize} size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {eventData.prizes.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {eventData.prizes.map((prize, index) => (
                      <Badge key={index} variant="secondary" className="flex items-center space-x-1">
                        <Gift className="h-3 w-3" />
                        <span>{prize}</span>
                        <button onClick={() => removePrize(index)}>
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Requirements */}
              <div className="space-y-3">
                <Label>Requirements & Eligibility</Label>
                <div className="flex space-x-2">
                  <Input
                    placeholder="e.g., Must be Ethiopian citizen aged 18-35"
                    value={newRequirement}
                    onChange={(e) => setNewRequirement(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addRequirement()}
                  />
                  <Button onClick={addRequirement} size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {eventData.requirements.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {eventData.requirements.map((req, index) => (
                      <Badge key={index} variant="outline" className="flex items-center space-x-1">
                        <CheckCircle className="h-3 w-3" />
                        <span>{req}</span>
                        <button onClick={() => removeRequirement(index)}>
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Media Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <ImageIcon className="h-5 w-5" />
                <span>Event Media</span>
              </CardTitle>
              <CardDescription>
                Upload images to showcase your event (optional - max 5 images)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div 
                  className={`border-2 border-dashed rounded-lg p-4 md:p-6 text-center transition-colors ${
                    isDragging 
                      ? 'border-primary bg-primary/10' 
                      : 'border-muted-foreground/25 hover:border-primary/50'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input type="file" multiple accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageUpload} />
                  <p className="text-sm md:text-base font-medium text-foreground mb-1">Upload Event Images</p>
                  <p className="text-xs md:text-sm text-muted-foreground">Click to browse or drag and drop (max 5 images)</p>
                </div>

                {eventData.images.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-foreground">
                        Uploaded Images ({eventData.images.length}/5)
                      </h4>
                      <Badge variant="secondary" className="text-xs">
                        {eventData.images.length} image{eventData.images.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                      {eventData.images.map((image, index) => {
                        const imageUrl = typeof image === 'string' ? image : URL.createObjectURL(image)
                        return (
                          <div key={index} className="relative group">
                            <div 
                              className="bg-muted rounded-lg overflow-hidden shadow-md"
                              style={{ aspectRatio: '16/9' }}
                            >
                              <img 
                                src={imageUrl} 
                                alt={`Preview ${index + 1}`}
                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                style={{ maxHeight: '220px', minHeight: '120px' }}
                              />
                            </div>
                            <button
                              onClick={() => removeImage(index)}
                              className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1.5 hover:bg-destructive/90 shadow-md transition-colors"
                              title="Remove image"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Publishing Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5" />
                <span>Publish Event</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={() => handleSubmit('published')}
                disabled={loading}
                className="w-full"
              >
                {loading ? "Publishing..." : "Publish Event"}
              </Button>
              <Button
                onClick={() => handleSubmit('draft')}
                disabled={loading}
                variant="outline"
                className="w-full"
              >
                {loading ? "Saving..." : "Save as Draft"}
              </Button>
              <Separator />
              <p className="text-xs text-muted-foreground">
                Published events will be visible to all users in the Events section and notifications will be sent.
              </p>
            </CardContent>
          </Card>

          {/* Event Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5" />
                <span>Quick Preview</span>
              </CardTitle>
            </CardHeader>
            {/* Image Preview */}
            {eventData.images && eventData.images.length > 0 ? (
              <div className="w-full h-48 flex items-center justify-center overflow-hidden bg-muted rounded-lg shadow-md">
                {eventData.images[0] instanceof File ? (
                  <img
                    src={URL.createObjectURL(eventData.images[0] as File)}
                    alt="Preview"
                    className="w-full h-full object-contain"
                    style={{ maxHeight: '192px', minHeight: '120px' }}
                  />
                ) : (
                  typeof eventData.images[0] === 'string' && (
                    <img
                      src={(() => {
                        const img = eventData.images[0] as string;
                        if (img.startsWith('/uploads/')) return img; // served via Vite proxy to backend 8081
                        if (img.startsWith('http')) return img;
                        return `/uploads/${img}`;
                      })()}
                      alt="Preview"
                      className="w-full h-full object-contain"
                      style={{ maxHeight: '192px', minHeight: '120px' }}
                    />
                  )
                )}
              </div>
            ) : (
              <div className="w-full h-48 flex items-center justify-center bg-muted rounded-lg">
                <ImageIcon className="h-12 w-12 text-blue-500 dark:text-blue-400" />
              </div>
            )}
            <CardContent className="space-y-3">
              <div className="p-3 bg-muted/50 rounded-lg">
                <h4 className="font-medium text-sm">
                  {eventData.title || "Event Title"}
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {eventData.type && eventData.category ? `${eventData.type} • ${eventData.category}` : "Event Type • Category"}
                </p>
                <p className="text-xs text-muted-foreground mt-2 line-clamp-3">
                  {eventData.description || "Event description will appear here..."}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center space-x-1">
                  <CalendarIcon className="h-3 w-3" />
                  <span>{eventData.startDate ? format(eventData.startDate, "MMM dd") : "Start Date"}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <MapPin className="h-3 w-3" />
                  <span>{eventData.location || "Location"}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Users className="h-3 w-3" />
                  <span>{eventData.maxParticipants || "0"} max</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Trophy className="h-3 w-3" />
                  <span>{eventData.prizes.length} prizes</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
