import { ObjectId } from "mongodb";

export interface User {
  _id?: ObjectId | string
  email: string
  password?: string // Optional for Google users
  firstName: string
  lastName: string
  profileComplete: boolean
  verified: boolean
  role: "user" | "admin"
  googleId?: string // Google OAuth user id
  avatar?: string // Google profile picture
  profile?: {
    bio?: string
    sector?: string
    skills?: string[]
    githubUrl?: string
    linkedinUrl?: string
    avatar?: string
  }
  verificationApplication?: {
    type: "individual" | "team"
    sector: string
    projectTitle: string
    projectDescription: string
    githubUrl?: string
    teamMembers?: Array<{
      name: string
      email: string
      role: string
    }>
    duration: string
    status: "pending" | "under_review" | "approved" | "rejected"
    submittedAt: Date
    reviewedAt?: Date
    reviewedBy?: string
    rejectionReason?: string
  }
  certifications?: Array<{
    id: string
    title: string
    issuedAt: Date
    validUntil?: Date
  }>
  githubStats?: {
    username: string
    dailyCommits: number
    totalCommits: number
    lastCommitDate: Date
    streak: number
    totalRepos?: number
  }
  following?: string[] // Array of user IDs this user is following
  followers?: string[] // Array of user IDs following this user
  createdAt: Date
  updatedAt: Date
  resetPasswordToken?: string
  resetPasswordExpires?: Date
}

export interface Project {
  images?: string[];
  _id?: ObjectId | string
  title: string
  description: string
  sector: string
  author: {
    userId: string
    name: string
    verified: boolean
    avatar?: string
  }
  team?: {
    size: number
    members: Array<{
      userId?: string
      name: string
      role: string
    }>
  }
  duration: string
  status: "draft" | "published" | "completed" | "archived"
  tags: string[]
  githubUrl?: string
  demoUrl?: string
  likes: string[] // Array of user IDs who liked
  comments: Array<{
    userId: string
    userName: string
    content: string
    createdAt: Date
  }>
  follows: string[] // Array of user IDs who follow this project
  featured: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Event {
  _id?: ObjectId | string
  title: string
  description: string
  type: "hackathon" | "workshop" | "competition" | "announcement"
  startDate: Date
  endDate?: Date
  location?: string
  isVirtual: boolean
  maxParticipants?: number
  currentParticipants: number
  registrationOpen: boolean
  registrationLink?: string
  registrationDeadline?: Date
  status: "draft" | "published" | "completed" | "cancelled"
  organizer: {
    userId: string
    name: string
  }
  participants: Array<{
    userId: string
    name: string
    email: string
    registeredAt: Date
  }>
  requirements?: string[]
  prizes?: string[]
  images?: string[]
  createdAt: Date
  updatedAt: Date
  views?: number
}

export interface Notification {
  _id?: ObjectId | string
  userId: string
  type: "application_update" | "event_reminder" | "project_comment" | "system_announcement"
  title: string
  message: string
  read: boolean
  data?: Record<string, any>
  createdAt: Date
}
