
import { useState, useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { getVerificationStatus } from "@/lib/verificationStatus";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertCircle,
  CheckCircle,
  Github,
  Heart,
  Search,
  Shield,
  Trophy,
  Sparkles,
  Plus,
  Upload,
  Image,
  X,
  Loader2,
  UserPlus,
  Calendar,
  Users,
  Award,
  Star,
  Filter,
  Clock,
  ArrowRight,
  Zap,
} from "lucide-react";
import { ProjectCard as SharedProjectCard } from "@/components/project-card";

interface HomeProject {
  id: string;
  _id: string;
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
  images?: string[];
  createdAt: string;
  updatedAt: string;
}

const sectors = [
  "All Sectors",
  "Education",
  "Technology",
  "Agriculture",
  "Health",
];

const projectStatuses = [
  "Planning",
  "In Progress",
  "Testing",
  "Completed",
  "Deployed",
  "On Hold",
];

export default function Index() {
  const [selectedSector, setSelectedSector] = useState("All Sectors");
  const [searchQuery, setSearchQuery] = useState("");
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [verificationPending, setVerificationPending] = useState(false);

  // Application dialog state
  const [showApplication, setShowApplication] = useState(false);
  const [applicationStep, setApplicationStep] = useState(1);
  const [applicationData, setApplicationData] = useState({
    projectType: "",
    projectTitle: "",
    projectDescription: "",
    sector: "",
    duration: "",
    teamSize: "1",
    githubUsername: "", // Manual GitHub username (required)
  });
    // githubConnected: false,
  // Create Post dialog state
  const [showCreatePost, setShowCreatePost] = useState(false);
  interface PostData {
    projectName: string;
    projectDescription: string;
    status: string;
    sector: string;
    type: string;
    demoUrl: string;
    images: File[];
    teamSize: string;
  }

  const [postData, setPostData] = useState<PostData>({
    projectName: "",
    projectDescription: "",
    status: "",
    sector: "",
    type: "",
    demoUrl: "",
    images: [],
    teamSize: "",
  });
  const [submittingPost, setSubmittingPost] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        if (api.isAuthenticated()) {
          // Always use backend user object for verification status
          const userData = await api.getProfile();
          setUser(userData.user);
          // Check verification status
          const status = await getVerificationStatus(userData.user._id);
          setVerificationPending(!!status.hasPending && !status.isVerified);
        } else {
          setUser(null);
          setVerificationPending(false);
        }
      } catch (error) {
        setUser(null);
        setVerificationPending(false);
        console.error('Failed to fetch user data:', error);
      }
    };

    fetchUserData();
    loadProjects();

    // Listen for user data refresh events (e.g., after approval)
    const handleUserRefresh = () => {
      console.log('Refreshing user data...');
      fetchUserData();
    };

    window.addEventListener('user:refresh', handleUserRefresh);
    return () => {
      window.removeEventListener('user:refresh', handleUserRefresh);
    };
  }, []);

  useEffect(() => {
    loadProjects();
  }, [selectedSector, searchQuery]);

  const loadProjects = async () => {
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

      // Use API service with proper headers
      const response = await fetch(`/api/projects?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('auth_token') && {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          })
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Fetched projects:', data);
      console.log('First project images:', data[0]?.images);
      
      if (Array.isArray(data)) {
        // Add id property and fix team.members to match shared Project interface
        // Convert HomeProject to shared Project interface
        const convertedProjects = data.map(project => ({
          id: project._id,
          _id: project._id,
          title: project.title,
          description: project.description,
          sector: project.sector,
          author: {
            userId: project.author.userId,
            name: project.author.name,
            verified: project.author.verified,
            avatar: project.author.avatar
          },
          team: project.team ? {
            size: project.team.size,
            members: project.team.members.map((member: any) => 
              typeof member === 'string' ? member : member.name
            )
          } : undefined,
          duration: project.duration,
          githubUrl: project.githubUrl,
          demoUrl: project.demoUrl,
          likes: project.likes || [],
          comments: project.comments || [],
          createdAt: new Date(project.createdAt),
          tags: project.tags || [],
          featured: project.featured,
          images: project.images || []
        }));
        setProjects(convertedProjects);
      } else if (data.projects && Array.isArray(data.projects)) {
        // Add id property and fix team.members to match shared Project interface
        // Convert HomeProject to shared Project interface
        const convertedProjects = data.projects.map(project => ({
          id: project._id,
          _id: project._id,
          title: project.title,
          description: project.description,
          sector: project.sector,
          author: {
            userId: project.author.userId,
            name: project.author.name,
            verified: project.author.verified,
            avatar: project.author.avatar
          },
          team: project.team ? {
            size: project.team.size,
            members: project.team.members.map((member: any) => 
              typeof member === 'string' ? member : member.name
            )
          } : undefined,
          duration: project.duration,
          githubUrl: project.githubUrl,
          demoUrl: project.demoUrl,
          likes: project.likes || [],
          comments: project.comments || [],
          createdAt: new Date(project.createdAt),
          tags: project.tags || [],
          featured: project.featured,
          images: project.images || []
        }));
        setProjects(convertedProjects);
      } else {
        console.error('Unexpected API response format:', data);
        setProjects([]);
      }
    } catch (error) {
      console.error("Failed to load projects:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (projectId: string) => {
    if (!user) {
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        loadProjects();
      }
    } catch (error) {
      console.error("Failed to like project:", error);
    }
  };

  const handleFollow = async (projectId: string) => {
    if (!user) {
      return;
    }

    console.log('🔄 Starting follow operation for project:', projectId);
    try {
      const response = await fetch(`/api/projects/${projectId}/follow`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Get updated user data from the response for immediate UI update
        const responseData = await response.json();
        console.log('🔄 Follow response data:', responseData);
        if (responseData.user) {
          console.log('👤 Updating user with following:', responseData.user.following);
          setUser(responseData.user);
        } else {
          console.log('❌ No user data in response, falling back to profile fetch');
          // Fallback: fetch fresh user data
          const userData = await api.getProfile();
          setUser(userData.user);
        }
        // Also refresh projects to ensure consistency
        loadProjects();
      } else {
        console.error('❌ Follow request failed:', response.status, response.statusText);
      }
    } catch (error) {
      console.error("Failed to follow project:", error);
    }
  };

  const handleCodeClick = (githubUrl?: string) => {
    if (githubUrl) {
      window.open(githubUrl, '_blank');
    }
  };

  const handleApplicationSubmit = async () => {
    try {
      await api.submitApplication(applicationData);
      toast({
        title: "Application Submitted!",
        description: "Your application is submitted. We will notify you after admin review.",
      });
      setShowApplication(false);
      setApplicationStep(1);
      setApplicationData({
        projectType: "",
        projectTitle: "",
        projectDescription: "",
        sector: "",
        duration: "",
        teamSize: "1",
        githubUsername: "",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit application. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Remove GitHub OAuth, allow manual entry
  // Field is now optional and can be left blank

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setPostData((prev) => ({
      ...prev,
      // Append new files and cap at 4 total
      images: [...prev.images, ...files].slice(0, 4), // Max 4 images
    }));
  };

  const removeImage = (index: number) => {
    setPostData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const handleCreatePost = async () => {
    setSubmittingPost(true);
    try {
      // Prepare FormData with field names that match backend schema
      const formData = new FormData();
      
      // Required fields
      formData.append("title", postData.projectName || "");
      formData.append("description", postData.projectDescription || "");
      formData.append("sector", postData.sector || "");
      formData.append("duration", "6 months");
      
      // Optional fields
      // Auto-attach GitHub URL from user's profile/username (prefer profile URL exactly)
      const userProfileUrl = (user as any)?.githubUrl as string | undefined;
      let ghUrl = "";
      if (userProfileUrl && /^https?:\/\//i.test(userProfileUrl)) {
        ghUrl = userProfileUrl;
      } else {
        const ghUsername = (user as any)?.githubStats?.username
          || (user as any)?.githubUsername
          || (() => {
            const url = userProfileUrl;
            if (!url) return "";
            try {
              const u = new URL(url);
              const parts = u.pathname.split("/").filter(Boolean);
              return parts[0] || "";
            } catch {
              const parts = url.split("github.com/")[1]?.split("/") || [];
              return parts[0] || "";
            }
          })();
        ghUrl = ghUsername ? `https://github.com/${ghUsername}` : "";
      }
      if (ghUrl) formData.append("githubUrl", ghUrl);
      if (postData.demoUrl) formData.append("demoUrl", postData.demoUrl);
      
      // Tags as JSON array (required)
      const tags = [postData.sector, postData.status, postData.type].filter(Boolean);
      formData.append("tags", JSON.stringify(tags));
      
      // Team members as JSON array if Team
      if (postData.type === "Team") {
        formData.append("teamMembers", JSON.stringify([
          { name: "Team Member", role: "Developer" }
        ]));
      }
      // Images
      if (postData.images && postData.images.length > 0) {
        console.log('Uploading images:', postData.images);
        postData.images.forEach((file) => {
          formData.append("images", file);
        });
      }

      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("auth_token") || ""}`
          // Do NOT set Content-Type here; browser will set it with boundary
        },
        body: formData
      });

      if (response.ok) {
        setPostData({
          projectName: "",
          projectDescription: "",
          status: "",
          sector: "",
          type: "",
          demoUrl: "",
          images: [],
          teamSize: "",
        });

        setShowCreatePost(false);
        alert("Project created successfully! 🎉");
        loadProjects();
      } else {
        throw new Error('Failed to create project');
      }
    } catch (error) {
      console.error('Create project error:', error);
      alert("Failed to create project. Please try again.");
    } finally {
      setSubmittingPost(false);
    }
  };


  // ...existing state and logic...
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Always show sidebar and header for all users */}
      {/* Sidebar and header are rendered by Layout, but add fallback here for clarity */}
      {/* Mobile-First Header */}
      <div className="sticky top-16 z-20 bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800">
        <div className="px-4 md:px-6 py-4">
          <div className="flex flex-col space-y-3 md:space-y-0 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center justify-between">
              {/* Create Post Button - Only for verified users */}
              {user?.verified ? (
                <Dialog open={showCreatePost} onOpenChange={setShowCreatePost}>
                  <DialogTrigger asChild>
                    <Button className="bg-[#2e9891] hover:bg-[#2e9891] active:bg-[#2e9891] text-white font-semibold md:hidden">
                      <Plus className="h-4 w-4 mr-2" />
                      Share Post
                    </Button>
                  </DialogTrigger>
                </Dialog>
              ) : null}
            </div>

            {/* Desktop Filters and Create Button */}
            <div className="hidden md:flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64 border-slate-200 dark:border-slate-700"
                />
              </div>
              <Select value={selectedSector} onValueChange={setSelectedSector}>
                <SelectTrigger className="w-40 border-slate-200 dark:border-slate-700">
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

              {/* Only show Create Post for verified users, show Become Innovator for unverified */}
              {user?.verified ? (
                <Dialog open={showCreatePost} onOpenChange={setShowCreatePost}>
                  <DialogTrigger asChild>
                    <Button className="bg-[#2e9891] hover:bg-[#2e9891] active:bg-[#2e9891] text-white font-semibold">
                      <Plus className="h-4 w-4 mr-2" />
                      Share Post
                    </Button>
                  </DialogTrigger>
                </Dialog>
              ) : (
                <div className="flex items-center gap-2">
                  {/* Show pending status only if user has requested verification and is not yet approved */}
                  {verificationPending && (
                    <>
                      <div className="text-sm text-slate-500">Verification: Pending</div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => window.dispatchEvent(new Event('user:refresh'))}
                      >
                        Refresh
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Mobile Filter Toggle */}
            <div className="md:hidden">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="border-slate-200 dark:border-slate-700"
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </Button>
            </div>
          </div>

          {/* Mobile Filters Dropdown */}
          {showFilters && (
            <div className="md:hidden mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 border-slate-200 dark:border-slate-700"
                />
              </div>
              <Select value={selectedSector} onValueChange={setSelectedSector}>
                <SelectTrigger className="border-slate-200 dark:border-slate-700">
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
          )}
        </div>
      </div>

      {/* Create Post Dialog - Only for verified users */}
      {user?.verified && (
        <Dialog open={showCreatePost} onOpenChange={setShowCreatePost}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl">
            <DialogHeader>
              <div className="rounded-xl p-6 bg-gradient-to-r from-innovation-500/10 via-purple-500/10 to-blue-500/10 border border-slate-200 dark:border-slate-800">
                <DialogTitle className="text-2xl md:text-3xl font-bold text-center mb-2">Create New Post</DialogTitle>
                <DialogDescription className="text-center text-muted-foreground">
                  Share your innovative project with the community
                </DialogDescription>
              </div>
            </DialogHeader>
            
            <div className="py-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Project Name */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="projectName" className="text-sm font-medium">Project Name *</Label>
                <Input
                  id="projectName"
                  placeholder="Enter your project name"
                  value={postData.projectName}
                  onChange={(e) => setPostData(prev => ({ ...prev, projectName: e.target.value }))}
                  required
                  className="w-full h-11 rounded-lg border-slate-200 dark:border-slate-700 focus:ring-innovation-500"
                />
              </div>

              {/* Project Description */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="projectDescription" className="text-sm font-medium">Project Description *</Label>
                <Textarea
                  id="projectDescription"
                  placeholder="Describe your project, its goals, and impact..."
                  value={postData.projectDescription}
                  onChange={(e) => setPostData(prev => ({ ...prev, projectDescription: e.target.value }))}
                  required
                  className="w-full min-h-[120px] rounded-lg resize-y border-slate-200 dark:border-slate-700 focus:ring-innovation-500"
                />
              </div>

              {/* Sector - Dropdown */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Sector *</Label>
                <Select value={postData.sector} onValueChange={(v) => setPostData(prev => ({ ...prev, sector: v }))}>
                  <SelectTrigger className="h-11 rounded-lg border-slate-200 dark:border-slate-700 focus:ring-innovation-500">
                    <SelectValue placeholder="Choose sector" />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    {["Education", "Technology", "Agriculture", "Health"].map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Project Status - Dropdown */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Project Status *</Label>
                <Select value={postData.status} onValueChange={(v) => setPostData(prev => ({ ...prev, status: v }))}>
                  <SelectTrigger className="h-11 rounded-lg border-slate-200 dark:border-slate-700 focus:ring-innovation-500">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    {["Idea", "In Progress", "Completed"].map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Project Type - Dropdown */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Project Type *</Label>
                <Select value={postData.type} onValueChange={(v) => setPostData(prev => ({ ...prev, type: v }))}>
                  <SelectTrigger className="h-11 rounded-lg border-slate-200 dark:border-slate-700 focus:ring-innovation-500">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    {["Individual", "Team"].map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Team Size (if Team project) */}
              {postData.type === "Team" && (
                <div className="space-y-2">
                  <Label htmlFor="teamSize" className="text-sm font-medium">Team Size</Label>
                  <Input
                    id="teamSize"
                    type="number"
                    placeholder="Number of team members"
                    value={postData.teamSize}
                    onChange={(e) => setPostData(prev => ({ ...prev, teamSize: e.target.value }))}
                    required
                    className="w-full h-11 rounded-lg border-slate-200 dark:border-slate-700 focus:ring-innovation-500"
                    min="2"
                    max="20"
                  />
                </div>
              )}

              {/* Image Upload */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="projectImages" className="text-sm font-medium">Project Images (Optional)</Label>
                <Input
                  id="projectImages"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="w-full h-11 rounded-lg border-slate-200 dark:border-slate-700"
                />
                {postData.images.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {postData.images.map((file, index) => (
                      <div key={index} className="relative">
                        <img
                          src={URL.createObjectURL(file)}
                          alt={`Preview ${index + 1}`}
                          className="h-16 w-16 object-cover rounded border"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreatePost(false)}
                disabled={submittingPost}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleCreatePost}
                disabled={submittingPost || !postData.projectName || !postData.projectDescription || !postData.sector || !postData.status || !postData.type}
                className="bg-[#2e9891] hover:bg-[#2e9891] active:bg-[#2e9891]"
              >
                {submittingPost ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Sharing...
                  </>
                ) : (
                  "Share Post"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Show descriptive text and 'Apply Now' button for unverified users */}
      {!user?.verified && (
        <div className="px-4 md:px-6 py-6 flex justify-center">
          <div className="w-full max-w-xl rounded-2xl shadow-lg bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-cyan-500/10 dark:from-blue-900/20 dark:via-purple-900/20 dark:to-cyan-900/20 p-8 flex flex-col items-center">
            <div className="flex items-center space-x-2 mb-4">
              <span className="inline-flex items-center justify-center rounded-full bg-[#2e9891] text-white h-10 w-10">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364-6.364l-1.414 1.414M6.05 17.95l-1.414 1.414M17.95 17.95l-1.414-1.414M6.05 6.05L4.636 4.636" /></svg>
              </span>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Become a Verified Innovator</h2>
            </div>
            <p className="text-base md:text-lg text-slate-700 dark:text-slate-300 mb-6 text-center max-w-md">
              Unlock exclusive features, showcase your projects, and connect with Ethiopia's top innovators. Join our verified community today.
            </p>
            <Button
              className="bg-[#2e9891] hover:bg-[#2e9891] active:bg-[#2e9891] text-white font-semibold px-8 py-3 rounded-xl shadow-lg text-lg transition-all duration-200"
              onClick={async () => {
                // Check verification status before opening form
                if (!user?._id) {
                  toast({
                    title: 'Please log in',
                    description: 'You need to be logged in to apply for verification.',
                  });
                  return;
                }
                try {
                  const res = await fetch(`/api/verification/check/${user._id}`);
                  const result = await res.json();
                  if (result.hasPending) {
                    toast({
                      title: 'Application Pending',
                      description: 'Your verification is under review. You will be notified once the admin reviews your application.',
                    });
                    setShowApplication(false);
                    return;
                  }
                  if (result.isVerified) {
                    toast({
                      title: 'Already Verified',
                      description: 'You are already verified!'
                    });
                    return;
                  }
                  setShowApplication(true);
                } catch (error) {
                  // If error, do not allow form open
                  toast({
                    title: 'Error',
                    description: 'Could not check verification status. Please try again later.'
                  });
                }
              }}
            >
              Apply Now
            </Button>
            <Dialog open={showApplication} onOpenChange={setShowApplication}>
              <DialogContent className="max-w-md">
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  // Validate minimal fields before redirecting to GitHub
                  if (!applicationData.projectTitle || !applicationData.projectDescription || !applicationData.sector || !applicationData.projectType) {
                    toast({ title: 'Missing fields', description: 'Please complete all steps before submitting.' });
                    return;
                  }
                  if (!applicationData.githubUsername || !/^[a-zA-Z0-9-]{1,39}$/.test(applicationData.githubUsername)) {
                    toast({ title: 'Invalid GitHub username', description: 'Enter a valid GitHub username.' });
                    return;
                  }
                  try {
                    // Build compact payload to be created on backend after OAuth callback
                    const payload = {
                      projectTitle: applicationData.projectTitle,
                      projectDescription: applicationData.projectDescription,
                      sector: applicationData.sector,
                      type: applicationData.projectType,
                      teamSize: applicationData.teamSize,
                      githubUsername: applicationData.githubUsername,
                    };
                    // Validate GitHub username exists before redirecting
                    const ghUser = applicationData.githubUsername.trim();
                    try {
                      const resp = await fetch(`https://api.github.com/users/${encodeURIComponent(ghUser)}`);
                      if (resp.status === 404) {
                        toast({ title: 'GitHub user not found', description: 'Please enter a valid GitHub username.', variant: 'destructive' });
                        return;
                      }
                      if (!resp.ok) {
                        // Other errors (rate limit, network). Inform user but allow retry without redirecting.
                        toast({ title: 'Validation error', description: 'Could not validate GitHub username. Please try again.' });
                        return;
                      }
                    } catch {
                      toast({ title: 'Network error', description: 'Could not validate GitHub username. Check your connection and try again.' });
                      return;
                    }
                    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
                    toast({ title: 'Redirecting to GitHub…', description: 'We will submit your application after connecting your GitHub.' });
                    // Trigger OAuth with application payload encoded in state
                    api.githubConnectForVerification('/app', { application: b64 });
                  } catch (err: any) {
                    toast({ title: 'Error', description: err?.message || 'Failed to start GitHub authentication', variant: 'destructive' });
                  }
                }}>
                  {applicationStep === 1 && (
                    <div className="space-y-4">
                      <Label htmlFor="title">Project Title</Label>
                      <Input
                        id="title"
                        value={applicationData.projectTitle}
                        onChange={(e) => setApplicationData((prev) => ({ ...prev, projectTitle: e.target.value }))}
                        placeholder="Enter your project title"
                        required
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            setApplicationStep(2);
                          }
                        }}
                      />
                      <Button type="button" onClick={() => setApplicationStep(2)} className="w-full mt-2">Next</Button>
                    </div>
                  )}
                  {applicationStep === 2 && (
                    <div className="space-y-4">
                      <Label htmlFor="description">Project Description</Label>
                      <Textarea
                        id="description"
                        value={applicationData.projectDescription}
                        onChange={(e) => setApplicationData((prev) => ({ ...prev, projectDescription: e.target.value }))}
                        placeholder="Describe your project and its impact"
                        rows={4}
                        required
                      />
                      <Button type="button" onClick={() => setApplicationStep(3)} className="w-full mt-2">Next</Button>
                      <Button type="button" onClick={() => setApplicationStep(1)} variant="outline" className="w-full">Back</Button>
                    </div>
                  )}
                  {applicationStep === 3 && (
                    <div className="space-y-4">
                      <Label htmlFor="sector">Sector</Label>
                      <Select
                        value={applicationData.sector}
                        onValueChange={(value) => setApplicationData((prev) => ({ ...prev, sector: value }))}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select sector" />
                        </SelectTrigger>
                        <SelectContent>
                          {sectors.slice(1).map((sector) => (
                            <SelectItem key={sector} value={sector}>{sector}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" onClick={() => setApplicationStep(4)} className="w-full mt-2">Next</Button>
                      <Button type="button" onClick={() => setApplicationStep(2)} variant="outline" className="w-full">Back</Button>
                    </div>
                  )}
                  {applicationStep === 4 && (
                    <div className="space-y-4">
                      <Label>Project Type</Label>
                      <RadioGroup
                        value={applicationData.projectType}
                        onValueChange={(value) => setApplicationData((prev) => ({ ...prev, projectType: value }))}
                        required
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="individual" id="individual" />
                          <Label htmlFor="individual">Individual Project</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="team" id="team" />
                          <Label htmlFor="team">Team Project</Label>
                        </div>
                      </RadioGroup>
                      {applicationData.projectType === 'team' && (
                        <div>
                          <Label htmlFor="teamSize">Team Size</Label>
                          <Select
                            value={applicationData.teamSize}
                            onValueChange={(value) => setApplicationData((prev) => ({ ...prev, teamSize: value }))}
                            required
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select team size" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="2">2 members</SelectItem>
                              <SelectItem value="3">3 members</SelectItem>
                              <SelectItem value="4">4 members</SelectItem>
                              <SelectItem value="5+">5+ members</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <Button type="button" onClick={() => setApplicationStep(5)} className="w-full mt-2">Next</Button>
                      <Button type="button" onClick={() => setApplicationStep(3)} variant="outline" className="w-full">Back</Button>
                    </div>
                  )}
                  {applicationStep === 5 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <Github className="h-6 w-6" />
                        <Label className="text-base font-semibold m-0">Your GitHub Username</Label>
                      </div>
                      <Input
                        placeholder={user?.githubStats?.username ? `e.g. ${user.githubStats.username}` : "e.g. torvalds"}
                        value={applicationData.githubUsername}
                        onChange={(e) => setApplicationData((prev) => ({ ...prev, githubUsername: e.target.value.trim() }))}
                        required
                      />
                      <p className="text-xs text-slate-500">Enter your real GitHub username. For Google users, manual entry is required. For GitHub login users, your username is shown as a placeholder (you may change it if needed).</p>
                      <Button
                        type="submit"
                        className="w-full mt-2"
                        disabled={!applicationData.githubUsername}
                        onClick={async (e) => {
                          e.preventDefault();
                          // Validate minimal fields before submitting
                          if (!applicationData.projectTitle || !applicationData.projectDescription || !applicationData.sector || !applicationData.projectType) {
                            toast({ title: 'Missing fields', description: 'Please complete all steps before submitting.' });
                            return;
                          }
                          if (!applicationData.githubUsername || !/^[a-zA-Z0-9-]{1,39}$/.test(applicationData.githubUsername)) {
                            toast({ title: 'Invalid GitHub username', description: 'Enter a valid GitHub username.' });
                            return;
                          }
                          // Validate GitHub username exists
                          const ghUser = applicationData.githubUsername.trim();
                          try {
                            const resp = await fetch(`https://api.github.com/users/${encodeURIComponent(ghUser)}`);
                            if (resp.status === 404) {
                              toast({ title: 'GitHub user not found', description: 'Please enter a valid GitHub username.', variant: 'destructive' });
                              return;
                            }
                            if (!resp.ok) {
                              toast({ title: 'Validation error', description: 'Could not validate GitHub username. Please try again.' });
                              return;
                            }
                          } catch {
                            toast({ title: 'Network error', description: 'Could not validate GitHub username. Check your connection and try again.' });
                            return;
                          }
                          // Submit application (no forced OAuth for Google users)
                          try {
                            await api.submitApplication({ userId: user?._id, info: { ...applicationData } });
                            toast({ title: "Application Submitted!", description: "Your application is submitted. We will notify you after admin review." });
                            setShowApplication(false);
                            setApplicationStep(1);
                            setApplicationData({
                              projectType: "",
                              projectTitle: "",
                              projectDescription: "",
                              sector: "",
                              duration: "",
                              teamSize: "1",
                              githubUsername: "",
                            });
                          } catch (error) {
                            toast({ title: "Error", description: "Failed to submit application. Please try again.", variant: "destructive" });
                          }
                        }}
                      >
                        Submit Application
                      </Button>
                      <Button type="button" onClick={() => setApplicationStep(4)} variant="outline" className="w-full">Back</Button>
                    </div>
                  )}
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      )}

      {/* Projects Feed */}
      <div className="px-4 md:px-6 py-6">
        <div className="max-w-4xl mx-auto">
          {loading ? (
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-64 bg-white dark:bg-slate-900 rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {projects.map((pHomeProject) => (
                <SharedProjectCard 
                  key={pHomeProject._id} 
                  project={pHomeProject} 
                  onLike={handleLike}
                  onFollow={handleFollow}
                  onCodeClick={handleCodeClick}
                  userId={user?._id}
                  user={user}
                  imageFit="contain"
                />
              ))}
            </div>
          )}

          {projects.length === 0 && !loading && (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 mx-auto text-slate-400 mb-4" />
              <h3 className="font-semibold mb-2 text-slate-900 dark:text-slate-100">
                No Posts found
              </h3>
              <p className="text-slate-500 dark:text-slate-400">

              </p>
            </div>
          )}

          {/* Always show dashboard header and filters for all users */}
          {projects.length === 0 && loading && (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 mx-auto animate-spin text-slate-400 mb-4" />
              <h3 className="font-semibold mb-2 text-slate-900 dark:text-slate-100">
                Loading projects...
              </h3>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
