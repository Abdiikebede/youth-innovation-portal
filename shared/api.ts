/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

/**
 * Example response type for /api/demo
 */
export interface DemoResponse {
  message: string;
}

/**
 * Platform statistics response
 */
export interface StatsResponse {
  totalUsers: number;
  verifiedUsers: number;
  totalProjects: number;
  publishedProjects: number;
  totalEvents: number;
  upcomingEvents: number;
  successRate: number;
  sectors: Array<{
    name: string;
    count: number;
  }>;
}
