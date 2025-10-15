import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ProjectCard } from "@/components/project-card";
import { api } from "@/services/api";
import {
  Search,
  Heart,
  UserPlus,
  Github,
  Calendar,
  Users,
  CheckCircle,
  Plus,
  Filter,
} from "lucide-react";

interface Project {
  _id: string;
  id?: string;
  title: string;
  description: string;
  sector: string;
  status: string;
  author: {
    userId: string;
    name: string;
    verified: boolean;
    avatar?: string;
  };
  team?: {
    size: number;
    members: string[];
  };
  duration: string;
  tags: string[];
  githubUrl?: string;
  demoUrl?: string;
  featured: boolean;
  likes: string[];
  comments: Array<any>;
  follows: string[];
  createdAt: string;
  updatedAt: string;
  images?: string[];
}

const sectors = [
  "All Sectors",
  "Education",
  "Technology",
  "Agriculture",
  "Health",
];

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSector, setSelectedSector] = useState("All Sectors");
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    fetchUser();
    fetchProjects();
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [searchQuery, selectedSector]);

  const fetchUser = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (token) {
        const response = await fetch('/api/users/me', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        }
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
    }
  };

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('status', 'published');
      
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }
      if (selectedSector !== "All Sectors") {
        params.append('sector', selectedSector);
      }

      const response = await fetch(`/api/projects?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        console.log('Fetched projects data:', data);
        // Backend returns projects as direct array, not wrapped in object
        if (Array.isArray(data)) {
          setProjects(data);
        } else if (data.projects && Array.isArray(data.projects)) {
          setProjects(data.projects);
        } else {
          console.error('Unexpected API response format:', data);
          setProjects([]);
        }
      }
    } catch (error) {
      console.error("Failed to load projects:", error);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (projectId: string) => {
    if (!user) return;

    try {
      const response = await fetch(`/api/projects/${projectId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        fetchProjects();
      }
    } catch (error) {
      console.error("Failed to like project:", error);
    }
  };

  const handleFollow = async (projectId: string) => {
    if (!user) return;

    try {
      const response = await fetch(`/api/projects/${projectId}/follow`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        fetchProjects();
      }
    } catch (error) {
      console.error("Failed to follow project:", error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-16 z-20 bg-background/95 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col space-y-4 md:space-y-0 md:flex-row md:items-center md:justify-between">
            <div>

              <p className="text-muted-foreground">
                Discover and connect with innovative projects from Ethiopia
              </p>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-full sm:w-64"
                />
              </div>
              <Select value={selectedSector} onValueChange={setSelectedSector}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#2e9891] text-white border-[#2e9891]">
                  {sectors.map((sector) => (
                    <SelectItem key={sector} value={sector} className="text-white hover:bg-[#278a84] focus:bg-[#278a84]">
                      {sector}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="h-80 animate-pulse bg-muted" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => {
              // Transform project data to match ProjectCard interface and ensure images is always an array
              const transformedProject = {
                ...project,
                id: project._id,
                createdAt: new Date(project.createdAt),
                images: Array.isArray(project.images) ? project.images : (project.images ? [project.images] : []),
                author: {
                  ...project.author,
                  avatar: project.author.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(project.author.name)}&backgroundColor=3b82f6&textColor=ffffff`
                }
              };
              return (
                <ProjectCard 
                  key={project._id} 
                  project={transformedProject}
                  onCodeClick={(githubUrl) => {
                    window.open(githubUrl, '_blank');
                  }}
                  userId={api.getCurrentUser()?._id}
                  user={api.getCurrentUser()}
                  showCollaborateButton
                  hideOwnerMenu
                  showGalleryPreview
                />
              );
            })}
          </div>
        )}

        {!loading && projects.length === 0 && (
          <div className="text-center py-16">
            <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
              <Filter className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No projects found</h3>
            <p className="text-muted-foreground mb-6">
              Try adjusting your search criteria or explore different sectors.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
