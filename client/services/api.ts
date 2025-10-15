// Route API calls through Vite proxy to backend (avoids CORS/preflight)
export const API_BASE = "/api";

/**
 * API Service class to handle API requests
 */
class ApiService {
  // --- Chatbot storage cleanup helpers ---
  private getChatNamespaceFromCurrentUser(): string {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
      if (!raw) return 'guest';
      const u = JSON.parse(raw || 'null');
      const id = u?._id || u?.id || u?.email || u?.username;
      return (id ? String(id) : 'guest').toLowerCase();
    } catch {
      return 'guest';
    }
  }

  // Persist candidate namespaces derived from current user so the chatbot can
  // discover past chats across logout/login or ID format changes.
  private persistChatNamespaceCandidatesFromUser(u: any | null) {
    try {
      const prevRaw = localStorage.getItem('chat_ns_candidates');
      const prev: string[] = prevRaw ? JSON.parse(prevRaw) : [];
      const ids = (u ? [u._id, u.id, u.email, u.username] : [])
        .filter(Boolean)
        .map((v: any) => String(v).toLowerCase());
      const merged = Array.from(new Set([...(prev || []), ...ids]));
      localStorage.setItem('chat_ns_candidates', JSON.stringify(merged));
    } catch {}
  }

  // Public wrapper to allow UI to persist candidates when it updates localStorage user
  persistChatNamespaceCandidates(user: any | null) {
    this.persistChatNamespaceCandidatesFromUser(user);
  }

  private clearChatStorageForNamespace(ns: string) {
    try {
      const bases = [
        'chat_isOpen',
        'chat_isMinimized',
        'chat_lang',
        'chat_draft',
        'chat_messages',
        'chat_lastTopic',
      ];
      for (const b of bases) {
        const key = `${b}:${ns}`;
        localStorage.removeItem(key);
      }
    } catch {}
  }

  private clearChatStorageForCurrentUser() {
    const ns = this.getChatNamespaceFromCurrentUser();
    this.clearChatStorageForNamespace(ns);
  }
  // Notifications
  async getNotifications() {
    const response = await this.makeRequest(`${API_BASE}/notifications?t=${Date.now()}` , {
      method: 'GET',
      headers: this.getAuthHeaders(),
      cache: 'no-store',
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to get notifications: ${response.status} ${text}`);
    }
    return response.json();
  }

  // SuperAdmin: list pending events waiting for approval
  async getPendingEventsAdmin() {
    const response = await this.makeRequest(`${API_BASE}/admin/events/pending?t=${Date.now()}` , {
      method: 'GET',
      headers: this.getAuthHeaders(),
      cache: 'no-store',
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to get pending events: ${response.status} ${text}`);
    }
    return response.json();
  }

  // SuperAdmin: approve/reject pending event
  async approveEventAdmin(eventId: string) {
    const response = await this.makeRequest(`${API_BASE}/admin/events/${eventId}/approve`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to approve event: ${response.status} ${text}`);
    }
    return response.json();
  }

  async rejectEventAdmin(eventId: string) {
    const response = await this.makeRequest(`${API_BASE}/admin/events/${eventId}/reject`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to reject event: ${response.status} ${text}`);
    }
    return response.json();
  }
  

  // Public: fetch short user summary by ID
  async getUserSummary(id: string) {
    const response = await this.makeRequest(`${API_BASE}/users/${encodeURIComponent(id)}/summary?t=${Date.now()}`);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to load user summary: ${response.status} ${text}`);
    }
    return response.json();
  }

  // Admin: fetch all funding/certificate requests
  async getAllRequestsAdmin() {
    try {
      const response = await this.makeRequest(`${API_BASE}/admin/requests?t=${Date.now()}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
        cache: 'no-store',
      });
      if (!response.ok) {
        const text = await response.text();
        console.error('❌ [API] Admin requests failed:', response.status, text);
        if (response.status === 403) throw new Error('FORBIDDEN');
        throw new Error('Failed to fetch admin requests');
      }
      return response.json();
    } catch (error) {
      console.error('❌ [API] Error fetching admin requests:', error);
      throw error;
    }
  }

  // Back-compat alias used by some components
  async getAdminRequests() {
    return this.getAllRequestsAdmin();
  }

  async updateRequestStatusAdmin(requestId: string, status: 'pending' | 'submitted' | 'approved' | 'rejected', reason?: string) {
    const response = await this.makeRequest(`${API_BASE}/admin/requests/${requestId}/status`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ status, reason }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to update request status: ${response.status} ${text}`);
    }
    return response.json();
  }

  async bulkSubmitRequestsAdmin(ids: string[]) {
    // Server expects { requestIds: string[] }
    const response = await this.makeRequest(`${API_BASE}/admin/requests/bulk-submit`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ requestIds: ids }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to bulk submit: ${response.status} ${text}`);
    }
    return response.json();
  }
  

  async markAllNotificationsRead() {
    const response = await this.makeRequest(`${API_BASE}/notifications/read-all`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to mark all as read: ${response.status} ${text}`);
    }
    return response.json();
  }

  async markNotificationRead(id: string) {
    const response = await this.makeRequest(`${API_BASE}/notifications/${id}/read`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to mark notification as read: ${response.status} ${text}`);
    }
    return response.json();
  }
  async getApplicationsByStatus(status: string) {
    const url = `${API_BASE}/admin/applications?status=${status}`;
    console.log(`📡 [API] Fetching ${status} applications from:`, url);
    
    try {
      const response = await this.makeRequest(url, {
        headers: this.getAuthHeaders(),
      });
      
      console.log(`✅ [API] Response status for ${status} applications:`, response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [API] Error response (${response.status}):`, errorText);
        throw new Error(`Failed to get ${status} applications: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`📦 [API] Received ${status} applications data:`, data);
      
      // Ensure we always return an object with an applications array
      if (!data || typeof data !== 'object') {
        console.warn('[API] Invalid response format, expected object with applications array');
        return { applications: [] };
      }
      
      if (!Array.isArray(data.applications)) {
        console.warn('[API] Applications is not an array, normalizing to array');
        return { applications: [] };
      }
      
      return data;
      
    } catch (error) {
      console.error(`❌ [API] Error fetching ${status} applications:`, error);
      // Return empty array on error but log the error for debugging
      return { applications: [] };
    }
  }

  async getAdminNotifications() {
    try {
      const response = await this.makeRequest(`${API_BASE}/admin/notifications?t=${Date.now()}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
        cache: 'no-store',
      });
      if (!response.ok) {
        const text = await response.text();
        console.error('❌ [API] Admin notifications failed:', response.status, text);
        // Surface forbidden distinctly for caller to optionally fallback
        if (response.status === 403) {
          throw new Error('FORBIDDEN');
        }
        throw new Error('Failed to fetch admin notifications');
      }
      return response.json();
    } catch (error) {
      console.error('❌ [API] Error fetching admin notifications:', error);
      throw error;
    }
  }

  // Admin: approve a single verification application
  async approveApplication(applicationId: string) {
    const response = await this.makeRequest(
      `${API_BASE}/admin/applications/${applicationId}/approve`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
      },
    );
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to approve application: ${response.status} ${text}`);
    }
    return response.json();
  }

  // Projects: check current user's collaboration request status for a project
  async checkCollabStatus(projectId: string): Promise<{ exists: boolean; status?: string; projectTitle?: string }> {
    const response = await this.makeRequest(
      `${API_BASE}/projects/${projectId}/collaboration/status`,
      {
        method: 'GET',
        headers: this.getAuthHeaders(),
      },
    );
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to check collaboration status: ${response.status} ${text}`);
    }
    return response.json();
  }

  // Admin: reject a single verification application
  async rejectApplication(applicationId: string, reason: string) {
    const response = await this.makeRequest(
      `${API_BASE}/admin/applications/${applicationId}/reject`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ reason }),
      },
    );
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to reject application: ${response.status} ${text}`);
    }
    return response.json();
  }

  // Admin: bulk approve (client-side loop)
  async approveApplications(ids: string[]) {
    const results: { id: string; ok: boolean; error?: string }[] = [];
    for (const id of ids) {
      try {
        await this.approveApplication(id);
        results.push({ id, ok: true });
      } catch (e: any) {
        results.push({ id, ok: false, error: e?.message || String(e) });
      }
    }
    return results;
  }

  // Admin: bulk reject (client-side loop)
  async rejectApplications(ids: string[], reason: string) {
    const results: { id: string; ok: boolean; error?: string }[] = [];
    for (const id of ids) {
      try {
        await this.rejectApplication(id, reason);
        results.push({ id, ok: true });
      } catch (e: any) {
        results.push({ id, ok: false, error: e?.message || String(e) });
      }
    }
    return results;
  }

  // Projects: send a collaboration request via comment channel
  async sendCollabRequest(projectId: string, message: string) {
    const content = `[COLLAB REQUEST ${new Date().toISOString()}] ${message}`;
    const response = await this.makeRequest(
      `${API_BASE}/projects/${projectId}/comments`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ content }),
      },
    );
    if (!response.ok) {
      const text = await response.text();
      // Try to parse structured 409 duplicate response
      try {
        const json = JSON.parse(text);
        if (response.status === 409 && json && (json.status || json.projectTitle)) {
          const err: any = new Error('Duplicate collaboration request');
          err.code = 409;
          err.status = json.status;
          err.projectTitle = json.projectTitle;
          throw err;
        }
      } catch {}
      throw new Error(`Failed to send collaboration request: ${response.status} ${text}`);
    }
    return response.json();
  }

  // Google OAuth login
  googleLogin() {
    const frontend = encodeURIComponent(window.location.origin);
    window.location.href = `${API_BASE}/auth/google?frontend=${frontend}`;
  }

  // GitHub OAuth login
  githubLogin() {
    const frontend = encodeURIComponent(window.location.origin);
    window.location.href = `${API_BASE}/auth/github?frontend=${frontend}`;
  }

  // GitHub connect for Verification (does NOT switch account)
  githubConnectForVerification(returnPath: string = '/app', extraParams?: Record<string, string>) {
    const frontend = encodeURIComponent(window.location.origin);
    const user = this.getCurrentUser();
    const currentUserId = encodeURIComponent(user?._id || '');
    const ret = encodeURIComponent(returnPath);
    const extra = extraParams
      ? '&' + new URLSearchParams(Object.entries(extraParams)).toString()
      : '';
    window.location.href = `${API_BASE}/auth/github?mode=verify&currentUserId=${currentUserId}&return=${ret}&frontend=${frontend}${extra}`;
  }

  private getAuthHeaders() {
    const token = localStorage.getItem("auth_token");
    return {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  private async makeRequest(url: string, options: RequestInit = {}) {
    try {
      const response = await fetch(url, { cache: 'no-store', ...options });
      return response;
    } catch (error) {
      // Do not use mock mode; propagate the real error
      console.error("❌ [API] Network/request error:", error);
      throw error;
    }
  }

  // Auth endpoints
  async login(email: string, password: string) {
    const response = await this.makeRequest(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Login error response:", error);
      throw new Error(error.error || error.message || "Login failed");
    }

    const data = await response.json();
    if (data.token) {
      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      // Persist chat namespace candidates for this user for future discovery
      this.persistChatNamespaceCandidatesFromUser(data.user);
    }
    return data;
  }

  async forgotPassword(email: string) {
    const response = await this.makeRequest(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to request password reset: ${response.status} ${text}`);
    }
    return response.json();
  }

  async resetPassword(token: string, password: string) {
    const response = await this.makeRequest(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to reset password: ${response.status} ${text}`);
    }
    return response.json();
  }

  async deleteAccount() {
    const response = await this.makeRequest(`${API_BASE}/auth/account`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to delete account: ${response.status} ${text}`);
    }

    // Before removing user, persist candidates so history can still be referenced if needed
    try {
      const uStr = localStorage.getItem('user');
      const u = uStr ? JSON.parse(uStr) : null;
      this.persistChatNamespaceCandidatesFromUser(u);
    } catch {}
    // Clear chatbot history/state for this user (intentional on delete)
    this.clearChatStorageForCurrentUser();
    // Clear local auth state
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');

    return response.json();
  }

  async register(userData: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }) {
    const response = await this.makeRequest(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Registration failed");
    }

    const data = await response.json();
    if (data.token) {
      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
    }
    return data;
  }

  async getProfile() {
    try {
      const response = await this.makeRequest(`${API_BASE}/auth/profile`, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error("Failed to get profile");
      }

      return response.json();
    } catch (error) {
      const user = this.getCurrentUser();
      return { user };
    }
  }

  async updateProfile(profileData: Partial<{
    firstName: string;
    lastName: string;
    bio: string;
    location: string;
    githubUrl: string;
  }>) {
    try {
      const response = await this.makeRequest(`${API_BASE}/auth/profile`, {
        method: "PUT",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(profileData),
      });

      if (!response.ok) {
        throw new Error("Failed to update profile");
      }

      return response.json();
    } catch (error) {
      throw new Error("Failed to update profile");
    }
  }

  // Requests API
  async createRequest(payload: any) {
    const hasFile = payload && payload.proposal instanceof File;
    const isFormData = typeof FormData !== 'undefined' && (payload instanceof FormData || hasFile);
    const headers: Record<string, string> = { ...(this.getAuthHeaders() as any) };
    let body: any;
    if (isFormData) {
      if ('Content-Type' in headers) delete (headers as any)['Content-Type'];
      const fd = payload instanceof FormData ? payload : new FormData();
      if (!(payload instanceof FormData)) {
        // Append scalar fields
        Object.entries(payload).forEach(([k, v]) => {
          if (k === 'proposal') return; // handle separately
          if (v === undefined || v === null) return;
          fd.append(k, typeof v === 'number' ? String(v) : String(v));
        });
        if (payload.proposal instanceof File) {
          fd.append('proposal', payload.proposal);
        }
      }
      body = fd;
    } else {
      body = JSON.stringify(payload);
    }

    const response = await this.makeRequest(`${API_BASE}/requests`, {
      method: 'POST',
      headers,
      body,
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to submit request: ${response.status} ${text}`);
    }
    return response.json();
  }

  async updateProject(
    projectId: string,
    payload: any
  ) {
    const isFormData = typeof FormData !== 'undefined' && payload instanceof FormData;
    // Start from auth headers but ensure we DO NOT carry a default Content-Type when using FormData
    const headers: Record<string, string> = { ...(this.getAuthHeaders() as any) };
    if (isFormData && 'Content-Type' in headers) {
      delete (headers as any)['Content-Type'];
    }

    const response = await this.makeRequest(
      `${API_BASE}/projects/${projectId}`,
      {
        method: "PUT",
        headers,
        body: isFormData ? payload : JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to update project: ${response.status} ${text}`);
    }

    return response.json();
  }

  async deleteProject(projectId: string) {
    const response = await this.makeRequest(
      `${API_BASE}/projects/${projectId}`,
      {
        method: "DELETE",
        headers: this.getAuthHeaders(),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to delete project: ${response.status} ${text}`);
    }

    return response.json();
  }

  async getMyRequests() {
    const response = await this.makeRequest(`${API_BASE}/requests`, {
      headers: this.getAuthHeaders(),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to load my requests: ${response.status} ${text}`);
    }
    return response.json();
  }

  

  // Projects endpoints
  async getProjects(filters?: {
    sector?: string;
    status?: string;
    featured?: boolean;
    search?: string;
    limit?: number;
    skip?: number;
  }) {
    try {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined) {
            params.append(key, value.toString());
          }
        });
      }

      const response = await this.makeRequest(
        `${API_BASE}/projects?${params}`,
        {
          headers: this.getAuthHeaders(),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to get projects");
      }

      return response.json();
    } catch (error) {
      throw error;
    }
  }

  async createProject(projectData: {
    title: string;
    description: string;
    sector: string;
    duration: string;
    tags: string[];
    githubUrl?: string;
    teamMembers?: Array<{ name: string; role: string }>;
  }) {
    // Client-side guard to improve UX; server enforces as well
    const current = this.getCurrentUser();
    if (!current || !current.verified) {
      throw new Error('Only verified innovators can create projects');
    }
    const response = await this.makeRequest(`${API_BASE}/projects`, {
      method: "POST",
      headers: this.getAuthHeaders(),
      body: JSON.stringify(projectData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to create project");
    }

    return response.json();
  }

  async likeProject(projectId: string) {
    const response = await this.makeRequest(
      `${API_BASE}/projects/${projectId}/like`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
      },
    );

    if (!response.ok) {
      throw new Error("Failed to like project");
    }

    return response.json();
  }

  async followProject(projectId: string) {
    const response = await this.makeRequest(
      `${API_BASE}/projects/${projectId}/follow`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
      },
    );

    if (!response.ok) {
      throw new Error("Failed to follow project");
    }

    return response.json();
  }

  async addComment(projectId: string, content: string) {
    const response = await this.makeRequest(
      `${API_BASE}/projects/${projectId}/comments`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ content }),
      },
    );

    if (!response.ok) {
      throw new Error("Failed to add comment");
    }

    return response.json();
  }

  // Collaboration endpoints
  async getCollaborationRequests() {
    const response = await this.makeRequest(`${API_BASE}/projects/collaboration/requests`, {
      headers: this.getAuthHeaders(),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to load collaboration requests: ${response.status} ${text}`);
    }
    const data = await response.json();
    // Normalize: return array
    if (Array.isArray(data)) return data;
    return data.requests || [];
  }

  async acceptCollaboration(projectId: string, commentId: string) {
    const response = await this.makeRequest(`${API_BASE}/projects/${projectId}/collaboration/${commentId}/accept`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to accept collaboration: ${response.status} ${text}`);
    }
    return response.json();
  }

  async rejectCollaboration(projectId: string, commentId: string) {
    const response = await this.makeRequest(`${API_BASE}/projects/${projectId}/collaboration/${commentId}/reject`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to reject collaboration: ${response.status} ${text}`);
    }
    return response.json();
  }

  // Profile methods
  getCurrentUser() {
    const userStr = localStorage.getItem("user");
    return userStr ? JSON.parse(userStr) : null;
  }

  getToken() {
    return localStorage.getItem("auth_token");
  }

  logout() {
    try {
      const uStr = localStorage.getItem('user');
      const u = uStr ? JSON.parse(uStr) : null;
      // Persist candidates so we can discover past chats after re-login
      this.persistChatNamespaceCandidatesFromUser(u);
    } catch {}
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user");
    // Bump a timestamp key so other tabs receive a storage event
    try { localStorage.setItem('last_auth_change', String(Date.now())); } catch {}
    // Notify same-tab listeners (chatbot) to recompute namespace/past-chat
    try { window.dispatchEvent(new Event('auth:changed')); } catch {}
  }

  isAuthenticated() {
    return !!localStorage.getItem("auth_token");
  }

  async submitApplication(applicationData: any) {
    try {
      const response = await this.makeRequest(`${API_BASE}/verification`, {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(applicationData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Application submission failed" }));
        throw new Error(errorData.error || "Application submission failed");
      }

      return response.json();
    } catch (error) {
      console.error('Application submission error:', error);
      throw error; // Re-throw the error instead of returning mock success
    }
  }

  // Admin endpoints
  async getDashboardStats() {
    try {
      const response = await this.makeRequest(`${API_BASE}/admin/stats`, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error("Failed to get dashboard stats");
      }

      return response.json();
    } catch (error) {
        // No mock statistics. Return empty stats in fallback.
        return {
          stats: {
            totalUsers: 0,
            totalApplications: 0,
            pendingApplications: 0,
            approvedApplications: 0,
            totalProjects: 0,
            upcomingEvents: 0,
            verificationRate: 0
          }
        };
    }
  }

  async getPendingApplications() {
    try {
      const response = await this.makeRequest(
        `${API_BASE}/admin/applications`,
        {
          headers: this.getAuthHeaders(),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to get applications");
      }

      return response.json();
    } catch (error) {
      return { applications: [] };
    }
  }


  // Utility methods

  // Events endpoints
  async createEvent(eventData: any) {
    try {
      const isFormData = typeof FormData !== 'undefined' && eventData instanceof FormData;
      // Start from auth headers but ensure we DO NOT carry over a default Content-Type
      const headers: Record<string, string> = { ...(this.getAuthHeaders() as any) };
      if ('Content-Type' in headers) {
        delete (headers as any)['Content-Type'];
      }
      // If sending FormData, do NOT set Content-Type; the browser will set the boundary automatically.
      if (!isFormData) {
        (headers as any)['Content-Type'] = 'application/json';
      }

      const response = await this.makeRequest(`${API_BASE}/events`, {
        method: 'POST',
        headers,
        body: isFormData ? eventData : JSON.stringify(eventData),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create event: ${response.status} ${errorText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('❌ [API] Error creating event:', error);
      throw error;
    }
  }

  async getEvents(includeAll?: boolean) {
    const url = `${API_BASE}/events${includeAll ? '?all=1' : ''}`;
    console.log('📡 [API] Fetching events from:', url);
    
    try {
      const response = await this.makeRequest(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [API] Error response:', response.status, errorText);
        throw new Error(`Failed to get events: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('📦 [API] Received events data:', data);
      
      // Handle different response formats
      if (Array.isArray(data)) {
        return data;
      } else if (data.events && Array.isArray(data.events)) {
        return data.events;
      } else {
        console.warn('[API] Unexpected events response format:', data);
        return [];
      }
      
    } catch (error) {
      console.error('❌ [API] Error fetching events:', error);
      throw error; // Don't return empty array, let the component handle the error
    }
  }

  async getEvent(eventId: string) {
    try {
      const response = await this.makeRequest(`${API_BASE}/events/${eventId}`, {
        headers: this.getAuthHeaders(),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get event: ${response.status} ${errorText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('❌ [API] Error getting event:', error);
      throw error;
    }
  }

  async updateEvent(eventId: string, eventData: any) {
    try {
      const response = await this.makeRequest(`${API_BASE}/events/${eventId}`, {
        method: 'PUT',
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update event: ${response.status} ${errorText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('❌ [API] Error updating event:', error);
      throw error;
    }
  }

  async deleteEvent(eventId: string) {
    try {
      const response = await this.makeRequest(`${API_BASE}/events/${eventId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete event: ${response.status} ${errorText}`);
      }
      
      console.log('✅ [API] Event deleted successfully');
      // Return success object since DELETE returns 204 (no content)
      return { success: true, message: 'Event deleted successfully' };
    } catch (error) {
      console.error('❌ [API] Error deleting event:', error);
      throw error;
    }
  }

  async createEventWithImages(formData: FormData) {
    try {
      console.log('📡 [API] Creating event with images...');

      const response = await this.makeRequest(`${API_BASE}/events`, {
        method: 'POST',
        headers: {
          // Don't set Content-Type for FormData - browser will set it automatically with boundary
          ...this.getAuthHeaders(),
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [API] Event creation failed:', response.status, errorText);
        throw new Error(`Failed to create event: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ [API] Event created successfully with images');
      return result;
    } catch (error) {
      console.error('❌ [API] Error creating event with images:', error);
      throw error;
    }
  }

  // Super Admin: get all users with avatars
  async getAllUsers() {
    try {
      const response = await this.makeRequest(`${API_BASE}/admin/users`, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get all users: ${response.status} ${errorText}`);
      }

      return response.json();
    } catch (error) {
      console.error('❌ [API] Error fetching all users:', error);
      throw error;
    }
  }
}

export const api = new ApiService();
