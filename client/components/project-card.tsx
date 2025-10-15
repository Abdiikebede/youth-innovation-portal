import { useState } from "react"
import { api } from "@/services/api"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import {
  Heart,
  MessageCircle,
  Share2,
  User,
  Github,
  ExternalLink,
  Star,
  Calendar,
  Bookmark,
  Users,
  ImageIcon,
  EllipsisVertical,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Project {
  id: string
  _id?: string
  title: string
  description: string
  sector: string
  author: {
    userId: string
    name: string
    avatar?: string
    verified: boolean
  }
  team?: {
    size: number
    members: string[]
  }
  duration: string
  githubUrl?: string
  demoUrl?: string
  likes: string[]
  comments: Array<{
    userId: string;
    userName: string;
    content: string;
    createdAt: Date;
  }> | number
  createdAt: Date
  tags: string[]
  featured?: boolean
  images?: string[]
}

interface ProjectCardProps {
  project: Project
  onLike?: (projectId: string) => void
  onFollow?: (projectId: string) => void
  onCodeClick?: (githubUrl: string) => void
  userId?: string
  user?: any
  showCollaborateButton?: boolean
  hideOwnerMenu?: boolean
  imageFit?: 'cover' | 'contain'
  showGalleryPreview?: boolean
}

export function ProjectCard({ project, onLike, onFollow, onCodeClick, userId, user, showCollaborateButton, hideOwnerMenu, imageFit = 'cover', showGalleryPreview = false }: ProjectCardProps) {
  console.log('ProjectCard received project:', project.title, 'images:', project.images);
  // Log images for debugging
  if (project.images) {
    console.log('Project images:', project.images);
  }
  const [liked, setLiked] = useState(false)
  const [following, setFollowing] = useState(user?.following?.includes(project.author.userId) || false)
  const [likeCount, setLikeCount] = useState(project.likes?.length || 0)
  const [isLoading, setIsLoading] = useState(false)
  const isOwner = (userId && (project.author?.userId === userId)) || (user && user._id && project.author?.userId === user._id)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [formTitle, setFormTitle] = useState(project.title)
  const [formDescription, setFormDescription] = useState(project.description)
  const [formGithub, setFormGithub] = useState((project as any).githubUrl || "")
  const [formDuration, setFormDuration] = useState(project.duration || "")
  const [formSector, setFormSector] = useState(project.sector || "")
  const [collabOpen, setCollabOpen] = useState(false)
  const [collabMsg, setCollabMsg] = useState("")
  const [collabBusy, setCollabBusy] = useState(false)
  const [existingImages, setExistingImages] = useState<string[]>(Array.isArray(project.images) ? (project.images as string[]) : [])
  const [newImages, setNewImages] = useState<File[]>([])
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [authorOpen, setAuthorOpen] = useState(false)
  const [authorLoading, setAuthorLoading] = useState(false)
  const [authorSummary, setAuthorSummary] = useState<any>(null)

  // Resolve a GitHub URL to open for the project: ONLY the author's stored project URL
  const resolveGithubUrl = () => {
    const projUrl = (project as any).githubUrl as string | undefined
    if (projUrl && /^https?:\/\//i.test(projUrl)) return projUrl
    return ""
  }


  // Resolve any image value (string path/URL) to a usable src
  const resolveImgSrc = (image?: string) => {
    if (!image) return ''
    const raw = image.trim()
    if (raw.startsWith('http') || raw.startsWith('/image/')) return raw
    const filename = (raw.split('/').pop() || '').split('\\').pop() || ''
    return filename ? `/image/${filename}` : ''
  }

  const openCollab = async () => {
    if (isOwner) return
    try {
      const pid = project.id || (project as any)._id
      const status = await api.checkCollabStatus(pid)
      if (status?.exists) {
        const title = status.projectTitle || project.title
        const st = status.status || 'pending'
        alert(`Your collaboration request for '${title}' is already submitted. Current status: ${st}.`)
        return
      }
    } catch (err) {
      console.warn('Collab status pre-check failed, proceeding to open dialog', err)
    }
    setCollabMsg("")
    setCollabOpen(true)
  }

  const sendCollab = async () => {
    try {
      setCollabBusy(true)
      const pid = project.id || (project as any)._id
      await api.sendCollabRequest(pid, collabMsg.trim())
      setCollabOpen(false)
      alert(`Collaboration request for '${project.title}' submitted. You will be contacted soon via email.`)
    } catch (e: any) {
      console.error('Failed to send collaboration request', e)
      if (e && e.code === 409) {
        // Duplicate – show status info and do NOT reopen dialog
        const status = (e.status || 'pending') as string
        const pTitle = e.projectTitle || project.title
        alert(`Your collaboration request for '${pTitle}' is already submitted. Current status: ${status}.`)
        setCollabOpen(false)
        return
      }
      alert('Failed to send collaboration request')
    } finally {
      setCollabBusy(false)
    }
  }

  const openEdit = () => {
    if (!isOwner) return
    setFormTitle(project.title)
    setFormDescription(project.description)
    setFormGithub((project as any).githubUrl || "")
    setFormDuration(project.duration || "")
    setFormSector(project.sector || "")
    setExistingImages(Array.isArray(project.images) ? (project.images as string[]) : [])
    setNewImages([])
    setEditOpen(true)
  }

  const submitEdit = async () => {
    try {
      if (!isOwner) return
      setIsLoading(true)
      // Build multipart payload to persist image removals/additions
      const fd = new FormData()
      fd.append('title', formTitle)
      fd.append('description', formDescription)
      fd.append('githubUrl', formGithub)
      fd.append('sector', formSector)
      // Send the list of images to keep (server should reconcile)
      fd.append('keepImages', JSON.stringify(existingImages))
      // Append newly added images
      newImages.forEach((file) => fd.append('images', file))

      await api.updateProject(project.id || (project as any)._id, fd as any)
      setEditOpen(false)
      // Optionally optimistic update; simplest is refresh
      window.location.reload()
    } catch (err) {
      console.error('Update project failed', err)
      alert('Failed to update project')
    } finally {
      setIsLoading(false)
    }
  }

  const confirmDelete = () => {
    if (!isOwner) return
    setDeleteOpen(true)
  }

  const submitDelete = async () => {
    try {
      if (!isOwner) return
      setIsLoading(true)
      await api.deleteProject(project.id || (project as any)._id)
      setDeleteOpen(false)
      window.location.reload()
    } catch (err) {
      console.error('Delete project failed', err)
      alert('Failed to delete project')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLike = async () => {
    if (isLoading) return

    try {
      setIsLoading(true)
      if (onLike) {
        onLike(project.id || project._id)
      } else {
        await api.likeProject(project.id || project._id)
      }
      setLiked(!liked)
      setLikeCount(prev => liked ? prev - 1 : prev + 1)
    } catch (error) {
      console.error('Failed to like project:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFollow = async () => {
    if (isLoading) return

    try {
      setIsLoading(true)
      if (onFollow) {
        onFollow(project.id || project._id)
      } else {
        // Default follow functionality - you can implement this if needed
        console.log('Follow functionality not implemented')
      }
      setFollowing(!following)
    } catch (error) {
      console.error('Failed to follow project:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Open the author profile dialog (non-owners only)
  const openAuthorDialog = async () => {
    if (isOwner) return
    try {
      setAuthorLoading(true)
      const userIdToLoad = project.author?.userId
      if (!userIdToLoad) return
      const res = await api.getUserSummary(userIdToLoad)
      setAuthorSummary(res)
      setAuthorOpen(true)
    } catch (e) {
      console.error('Failed to load author summary', e)
    } finally {
      setAuthorLoading(false)
    }
  }

  const getSectorColor = (sector: string) => {
    const colors = {
      health: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300",
      agriculture: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300",
      education: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300",
      finance: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300",
      transportation: "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300",
      environment: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300",
      energy: "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300",
      technology: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300",
    }
    return colors[sector.toLowerCase()] || "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300"
  }

  return (
    <Card className={cn("group hover:shadow-lg transition-all duration-300", project.featured && "ring-2 ring-innovation-500")}>
      {project.featured && (
        <div className="bg-gradient-to-r from-innovation-500 to-ethiopia-500 text-white text-xs font-medium px-3 py-1 rounded-t-lg flex items-center">
          <Star className="h-3 w-3 mr-1" />
          Featured Innovation
        </div>
      )}
      
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={project.author.avatar || undefined} />
              <AvatarFallback className="bg-innovation-100 text-innovation-800">
                {project.author.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center space-x-2">
                {isOwner ? (
                  <h4 className="text-sm font-medium">{project.author.name}</h4>
                ) : (
                  <button
                    type="button"
                    onClick={openAuthorDialog}
                    className="text-sm font-medium text-innovation-600 hover:underline"
                    title="View profile details"
                  >
                    {project.author.name}
                  </button>
                )}
                
              </div>
              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>{(() => {
  const now = new Date();
  const created = new Date(project.createdAt);
  const diffInMs = now.getTime() - created.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays > 0) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  if (diffInHours > 0) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  if (diffInMinutes > 0) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
  return 'Just now';
})()}</span>
                {project.team && (
                  <>
                    <span>•</span>
                    <Users className="h-3 w-3" />
                    <span>{project.team.size} members</span>
                  </>
                )}
              </div>
            </div>
          </div>
          {/* Owner actions: Three-dot menu (can be hidden via prop) */}
          {isOwner && !hideOwnerMenu && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" aria-label="Open actions">
                  <EllipsisVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={openEdit}>Edit</DropdownMenuItem>
                <DropdownMenuItem className="text-red-600" onClick={confirmDelete}>Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Project Image Display */}
        {project.images && project.images.length > 0 && (
          <div className="w-full mb-3">
            {showGalleryPreview ? (
              // Projects page: grid preview up to 4 images
              (() => {
                const imgs = (project.images || []).slice(0, 4).map((i) => resolveImgSrc(i as string)).filter(Boolean)
                if (imgs.length === 1) {
                  return (
                    <img src={imgs[0]} alt={`${project.title} - 1`} className="w-full h-48 sm:h-56 object-cover rounded-lg" />
                  )
                }
                if (imgs.length === 2) {
                  return (
                    <div className="grid grid-cols-2 gap-2">
                      {imgs.map((src, idx) => (
                        <img key={idx} src={src} className="w-full h-40 sm:h-44 object-cover rounded-md" />
                      ))}
                    </div>
                  )
                }
                if (imgs.length === 3) {
                  return (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <img src={imgs[0]} className="w-full h-44 sm:h-52 object-cover rounded-md" />
                      </div>
                      <div className="grid grid-rows-2 gap-2">
                        <img src={imgs[1]} className="w-full h-20 sm:h-24 object-cover rounded-md" />
                        <img src={imgs[2]} className="w-full h-20 sm:h-24 object-cover rounded-md" />
                      </div>
                    </div>
                  )
                }
                // 4 images
                return (
                  <div className="grid grid-cols-2 gap-2">
                    {imgs.map((src, idx) => (
                      <img key={idx} src={src} className="w-full h-36 sm:h-44 object-cover rounded-md" />
                    ))}
                  </div>
                )
              })()
            ) : (
              // Home: single cover image without zoom (contain)
              (() => {
                const first = resolveImgSrc(project.images[0])
                return first ? (
                  <img
                    src={first}
                    alt={`${project.title} - Cover`}
                    className={cn(
                      "w-full h-48 sm:h-56 md:h-56 lg:h-60 rounded-lg cursor-pointer bg-white",
                      imageFit === 'contain' ? 'object-contain' : 'object-cover'
                    )}
                    onClick={() => setGalleryOpen(true)}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none'
                    }}
                  />
                ) : null
              })()
            )}
          </div>
        )}
        <div>
          <CardTitle className="text-lg mb-2 group-hover:text-innovation-600 transition-colors">
            {project.title}
          </CardTitle>
          <p className="text-sm text-muted-foreground line-clamp-3">
            {project.description}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge className={getSectorColor(project.sector)}>
            {project.sector}
          </Badge>
          {project.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
          {project.tags.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{project.tags.length - 3} more
            </Badge>
          )}
        </div>

        </CardContent>

      {/* Author quick profile dialog */}
      <Dialog open={authorOpen} onOpenChange={setAuthorOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Profile details</DialogTitle>
          </DialogHeader>
          {authorLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : authorSummary ? (
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Full name:</span> {authorSummary.fullName || '-'}
              </div>
              <div>
                <span className="font-medium">Email:</span> {authorSummary.email || '-'}
              </div>
              <div>
                <span className="font-medium">Followers:</span> {authorSummary.followersCount ?? 0}
              </div>
              <div>
                <span className="font-medium">GitHub:</span>{' '}
                {authorSummary.githubUsername ? (
                  <a
                    href={authorSummary.githubUrl || `https://github.com/${authorSummary.githubUsername}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-innovation-600 hover:underline"
                  >
                    {authorSummary.githubUsername}
                  </a>
                ) : (
                  '-'
                )}
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No data</div>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setAuthorOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

        <CardFooter className="flex items-center justify-between pt-2">
          <div className="flex items-center space-x-4">
            {onLike && (
              <Button
                variant="ghost"
                size="sm"
                className={`text-muted-foreground hover:text-red-500 ${liked ? 'text-red-500' : ''}`}
                onClick={handleLike}
                disabled={isLoading}
              >
                {liked ? <Heart className="h-4 w-4 fill-current" /> : <Heart className="h-4 w-4" />}
                <span className="text-xs ml-1">{likeCount}</span>
              </Button>
            )}
            
            {onFollow && project.author.userId !== userId && (
            <Button
              variant="ghost"
              size="sm"
              className={`text-muted-foreground hover:text-primary ${following ? 'text-primary' : ''}`}
              onClick={handleFollow}
              disabled={isLoading}
            >
              <span className="text-xs">{following ? 'Following' : 'Follow'}</span>
            </Button>
          )}
            {/* Collaborate CTA: button on Projects page (when showCollaborateButton), otherwise non-clickable count */}
            {showCollaborateButton ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-primary"
                onClick={openCollab}
                disabled={isLoading || isOwner}
              >
                <Users className="h-4 w-4 mr-1" />
                <span className="text-xs">Collaborate</span>
              </Button>
            ) : (
              (() => {
                const collabCount = Array.isArray(project.comments)
                  ? project.comments.filter((c: any) => typeof c?.content === 'string' && c.content.includes('[COLLAB REQUEST')).length
                  : (typeof project.comments === 'number' ? project.comments : 0);
                return (
                  <div className="flex items-center text-muted-foreground text-xs px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
                    <Users className="h-4 w-4 mr-1" />
                    {collabCount} {collabCount === 1 ? 'collaborator' : 'collaborators'}
                  </div>
                );
              })()
            )}
          </div>

          {(resolveGithubUrl()) && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-innovation-600"
              onClick={() => {
                const url = resolveGithubUrl();
                if (!url) return;
                if (onCodeClick) onCodeClick(url); else window.open(url, '_blank');
              }}
              disabled={!resolveGithubUrl()}
            >
              <Github className="h-4 w-4 mr-1" />
              <span className="text-xs">Code</span>
            </Button>
          )}
        </CardFooter>

      {/* Gallery Modal */}
      {project.images && project.images.length > 0 && (
        <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
          <DialogContent className="max-w-3xl w-[95vw]">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg">{project.title}</DialogTitle>
            </DialogHeader>
            <div className="w-full">
              {(() => {
                const imgs = (project.images || []).slice(0, 4).map((i) => resolveImgSrc(i as string)).filter(Boolean)
                const count = imgs.length
                if (count === 1) {
                  return (
                    <img src={imgs[0]} alt={project.title} className="w-full max-h-[70vh] object-contain rounded-md" />
                  )
                }
                if (count === 2) {
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {imgs.map((src, idx) => (
                        <img key={idx} src={src} className="w-full h-56 sm:h-64 object-cover rounded-md" />
                      ))}
                    </div>
                  )
                }
                if (count === 3) {
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {/* Large left */}
                      <div className="sm:col-span-2">
                        <img src={imgs[0]} className="w-full h-64 sm:h-full object-cover rounded-md" />
                      </div>
                      {/* Two stacked on right (on desktop); on mobile they stack naturally */}
                      <div className="grid grid-rows-2 gap-2">
                        <img src={imgs[1]} className="w-full h-32 sm:h-40 object-cover rounded-md" />
                        <img src={imgs[2]} className="w-full h-32 sm:h-40 object-cover rounded-md" />
                      </div>
                    </div>
                  )
                }
                // 4 images: 2x2 grid
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {imgs.map((src, idx) => (
                      <img key={idx} src={src} className="w-full h-40 sm:h-48 object-cover rounded-md" />
                    ))}
                  </div>
                )
              })()}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Post</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sector">Sector</Label>
              <Select value={formSector} onValueChange={setFormSector}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select sector" />
                </SelectTrigger>
                <SelectContent>
                  {['Education','Technology','Agriculture','Health'].map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={6} className="min-h-[140px]" />
            </div>
            {/* Images management */}
            <div className="space-y-2 md:col-span-2">
              <Label>Images</Label>
              {existingImages.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {existingImages.map((img, idx) => {
                    let src = ''
                    if (typeof img === 'string') {
                      const filename = img.split('/').pop() || ''
                      src = `/image/${filename}`
                    }
                    return (
                      <div key={idx} className="relative">
                        {src ? (
                          <img src={src} className="h-24 w-24 object-cover rounded-lg border" />
                        ) : (
                          <div className="h-24 w-24 rounded-lg border flex items-center justify-center text-xs text-muted-foreground">Image</div>
                        )}
                        <button
                          type="button"
                          onClick={() => setExistingImages(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-600 text-white text-sm leading-6 text-center shadow"
                          aria-label="Remove image"
                        >
                          ×
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
              {newImages.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
                  {newImages.map((file, idx) => (
                    <div key={idx} className="relative">
                      <img src={URL.createObjectURL(file)} className="h-24 w-24 object-cover rounded-lg border" />
                      <button
                        type="button"
                        onClick={() => setNewImages(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-600 text-white text-sm leading-6 text-center shadow"
                        aria-label="Remove new image"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <Input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []) as File[]
                  if (files.length) setNewImages(prev => [...prev, ...files])
                }}
              />
              <p className="text-xs text-muted-foreground">You can remove existing images or upload additional ones.</p>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="github">GitHub URL</Label>
              <Input id="github" value={formGithub} onChange={(e) => setFormGithub(e.target.value)} placeholder="https://github.com/user/repo" />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 sticky bottom-0 bg-background/95 supports-[backdrop-filter]:bg-background/60 backdrop-blur border-t mt-4 py-3">
            <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={submitEdit} disabled={isLoading}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Collaborate dialog */}
      <Dialog open={collabOpen} onOpenChange={setCollabOpen}>
        <DialogContent className="max-w-md w-[95vw] rounded-xl">
          <div className="-mt-4 -mx-4 mb-4 px-5 py-4 bg-primary/10 border-b border-primary/20 rounded-t-xl">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-base font-semibold leading-none">Request Collaboration</h3>
                <p className="text-xs text-muted-foreground">Contact the owner and share how you can contribute.</p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="text-sm">
              <div className="font-medium">Project</div>
              <div className="text-muted-foreground">{project.title}</div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="collab-message">Message</Label>
              <Textarea
                id="collab-message"
                value={collabMsg}
                onChange={(e) => setCollabMsg(e.target.value)}
                rows={5}
                maxLength={500}
                className="min-h-[120px] resize-y focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                placeholder="Hi! I'd love to collaborate on this project. I can help with ..."
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Tip: Be specific about your skills and availability.</span>
                <span>{collabMsg.length}/500</span>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setCollabOpen(false)}>Cancel</Button>
            <Button onClick={sendCollab} disabled={collabBusy || collabMsg.trim().length === 0}>
              {collabBusy ? 'Sending…' : 'Send Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your post.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>No</AlertDialogCancel>
            <AlertDialogAction onClick={submitDelete} disabled={isLoading} className="bg-red-600 hover:bg-red-700">
              Yes, delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
