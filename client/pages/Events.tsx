import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar, MapPin, Users, Clock, ExternalLink, Eye, UserPlus, User } from "lucide-react";
import { api } from "@/services/api";
import { toast } from "@/hooks/use-toast";

interface Event {
  _id: string;
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  location: string;
  maxParticipants: number;
  registrationLink?: string;
  type: string;
  category: string;
  status: 'upcoming' | 'ongoing' | 'completed' | 'published' | 'draft';
  prizes: string[];
  requirements: string[];
  organizer: {
    userId: string;
    name: string;
  } | string;
  images?: string[];
  createdAt: string;
  updatedAt: string;
}

export default function Events() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("All Types");

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const response = await api.getEvents();
      console.log('Events API response:', response);
      // Ensure we always have an array
      // Handle different response formats from the backend
      let eventsArray: Event[] = [];
      
      if (Array.isArray(response)) {
        eventsArray = response;
      } else if (response?.events && Array.isArray(response.events)) {
        eventsArray = response.events;
      } else if (response?.data && Array.isArray(response.data)) {
        eventsArray = response.data;
      }
      
      setEvents(eventsArray);
    } catch (error) {
      console.error('Failed to load events:', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (event: Event) => {
    setSelectedEvent(event);
    setShowDetailsDialog(true);
  };

  const handleRegister = (event: Event) => {
    if (event.registrationLink) {
      // Open the registration link in a new tab
      window.open(event.registrationLink, '_blank', 'noopener,noreferrer');
    } else {
      toast({
        title: "Registration Unavailable",
        description: "No registration link has been provided for this event.",
        variant: "destructive"
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'ongoing': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'completed': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="px-4 md:px-6 py-6">
        <div className="max-w-4xl mx-auto">
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-48 bg-white dark:bg-slate-900 rounded-xl animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-6 py-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          
          <p className="text-slate-600 dark:text-slate-400">
            Discover and join innovation events in your community
          </p>
          {/* Event Type Filter */}
          <div className="mt-4 w-full max-w-xs">
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                {['All Types','Hackathon','Competition','Meetup'].map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {events.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 mx-auto text-slate-400 mb-4" />
            <h3 className="font-semibold mb-2 text-slate-900 dark:text-slate-100">
              No events found
            </h3>
            <p className="text-slate-500 dark:text-slate-400">
              Check back later for upcoming innovation events and workshops.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {events
              .filter((event) => {
                if (selectedType === 'All Types') return true;
                const t = (event.type || '').toLowerCase();
                return t === selectedType.toLowerCase();
              })
              .map((event) => (
              <Card key={event._id || event.id} className="hover:shadow-lg transition-shadow overflow-hidden">
                <div className="flex flex-col md:flex-row">
                  {/* Only show the event image if present, no cover, no badge */}
                  {event.images && event.images.length > 0 && typeof event.images[0] === 'string' && event.images[0].trim() !== '' && (
                    <div className="w-full md:w-64 h-48 md:h-48 flex-shrink-0 overflow-hidden flex items-center justify-center bg-gray-100 dark:bg-gray-800">
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
                  )}
                  
                  {/* Event Content */}
                  <div className="flex-1 p-6">
                    <div className="flex flex-col h-full">
                      <div className="flex-1">
                        <CardTitle className="text-xl mb-3 line-clamp-2">{event.title}</CardTitle>
                        
                        {/* Event Details */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-600 dark:text-slate-400 mb-4">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">{formatDate(event.startDate)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">{event.location}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">
                              {event.maxParticipants ? `${event.maxParticipants} max` : 'Unlimited'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">
                              {typeof event.organizer === 'string' ? event.organizer : event.organizer?.name || 'Organizer not specified'}
                            </span>
                          </div>
                        </div>
                        
                        {/* Description */}
                        <p className="text-slate-700 dark:text-slate-300 line-clamp-3 mb-4">
                          {event.description}
                        </p>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex flex-col sm:flex-row gap-2 mt-auto">
                        <Button 
                          size="sm"
                          className="flex-1 bg-[#2e9891] text-white hover:bg-[#2e9891] active:bg-[#2e9891] border-[#2e9891]"
                          onClick={() => handleViewDetails(event)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </Button>
                        <Button 
                          size="sm" 
                          className="flex-1 bg-[#2e9891] text-white hover:bg-[#2e9891] active:bg-[#2e9891]"
                          onClick={() => handleRegister(event)}
                          disabled={!event.registrationLink}
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          {event.registrationLink ? 'Register Now' : 'Registration Closed'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Event Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedEvent?.title}</DialogTitle>
            <DialogDescription>
              Event Details and Information
            </DialogDescription>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-slate-500" />
                  <span className="text-sm">{formatDate(selectedEvent.startDate)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-slate-500" />
                  <span className="text-sm">{selectedEvent.location}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-500" />
                  <span className="text-sm">{selectedEvent.maxParticipants ? `${selectedEvent.maxParticipants} max participants` : 'Unlimited participants'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-slate-500" />
                  <Badge className={getStatusColor(selectedEvent.status)}>
                    {selectedEvent.status.charAt(0).toUpperCase() + selectedEvent.status.slice(1)}
                  </Badge>
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Description</h4>
                <p className="text-slate-700 dark:text-slate-300">{selectedEvent.description}</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Event Type</h4>
                <p className="text-slate-600 dark:text-slate-400 capitalize">{selectedEvent.type}</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Organizer</h4>
                <div className="flex items-center text-slate-600 dark:text-slate-400">
                  <User className="h-4 w-4 mr-2" />
                  {typeof selectedEvent.organizer === 'string' ? selectedEvent.organizer : selectedEvent.organizer?.name || 'Organizer not specified'}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
              Close
            </Button>
            <Button 
              onClick={() => {
                setShowDetailsDialog(false);
                if (selectedEvent) handleRegister(selectedEvent);
              }}
              disabled={!selectedEvent?.registrationLink}
              className="bg-[#2e9891] text-white hover:bg-[#2e9891] active:bg-[#2e9891]"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Register for Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
