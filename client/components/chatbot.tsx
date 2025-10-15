import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  X,
  Send,
  User,
  Minimize2,
  Maximize2,
  CheckCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Message {
  id: number
  text: string
  isBot: boolean
  timestamp: Date
}

export function Chatbot() {
  // Determine a per-user namespace to avoid shared chat history across users
  const getUserNamespace = () => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('user') : null
      if (!raw) return 'guest'
      const u = JSON.parse(raw)
      const id = u?._id || u?.id || u?.email || u?.username
      return (id ? String(id) : 'guest').toLowerCase()
    } catch {
      return 'guest'
    }
  }

  // Extract namespace portion from a storage key like `chat_messages:<ns>`
  const nsFromKey = (key: string): string | null => {
    const idx = key.indexOf(':')
    if (idx === -1) return null
    return key.slice(idx + 1)
  }

  // Determine a rough last-updated timestamp from stored transcript
  const lastTimestampOf = (arr: any[]): number => {
    if (!Array.isArray(arr) || arr.length === 0) return 0
    let maxTs = 0
    for (const m of arr) {
      const ts = (m?.timestamp ?? m?.date ?? 0)
      const n = typeof ts === 'string' ? Date.parse(ts) : Number(ts)
      if (!isNaN(n) && n > maxTs) maxTs = n
    }
    return maxTs || 0
  }

  // Read current user object for namespace candidates
  const getUserObject = (): any | null => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('user') : null
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }

  // Build possible namespaces for this user to support identifier changes and persisted candidates
  const getCandidateNamespaces = (primary: string): string[] => {
    const u = getUserObject()
    const set = new Set<string>([(primary || 'guest').toLowerCase()])
    if (u) {
      ;[u._id, u.id, u.email, u.username]
        .filter(Boolean)
        .map((v: any) => String(v).toLowerCase())
        .forEach((v: string) => set.add(v))
    }
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('chat_ns_candidates') : null
      const persisted: string[] = raw ? JSON.parse(raw) : []
      if (Array.isArray(persisted)) persisted.forEach(v => v && set.add(String(v).toLowerCase()))
    } catch {}
    return Array.from(set)
  }

  // Determine if a stored transcript is a real past chat (has at least one user message)
  const hasRealHistory = (arr: any[]): boolean => {
    if (!Array.isArray(arr)) return false
    try {
      return arr.some((m) => {
        if (!m || typeof m !== 'object') return false
        if (m.isBot === false) return true
        const role = (m.role || m.sender || '').toString().toLowerCase()
        if (role === 'user') return true
        return false
      })
    } catch {
      return false
    }
  }

  const [ns, setNs] = useState<string>(getUserNamespace())

  // LocalStorage base keys (will be namespaced per user)
  const LS_BASE = {
    open: "chat_isOpen",
    minimized: "chat_isMinimized",
    lang: "chat_lang",
    draft: "chat_draft",
    messages: "chat_messages",
    topic: "chat_lastTopic",
  } as const

  const k = (base: typeof LS_BASE[keyof typeof LS_BASE]) => `${base}:${ns}`

  const safeRead = <T,>(key: string, fallback: T): T => {
    try {
      if (typeof window === "undefined") return fallback
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : fallback
    } catch {
      return fallback
    }
  }

  const [isOpen, setIsOpen] = useState<boolean>(() => safeRead<boolean>(k(LS_BASE.open), false))
  const [isMinimized, setIsMinimized] = useState<boolean>(() => safeRead<boolean>(k(LS_BASE.minimized), false))
  // Language first so we can seed localized welcome
  const [lang, setLang] = useState<'en' | 'am' | 'om'>(() => safeRead<'en' | 'am' | 'om'>(k(LS_BASE.lang), 'en'))
  const [message, setMessage] = useState<string>(() => safeRead<string>(k(LS_BASE.draft), ""))

  const welcomeByLang = (l: 'en' | 'am' | 'om') => {
    switch (l) {
      case 'am':
        return "ሰላም! የMinT አስስታንት ነኝ። በእንግሊዝኛ፣ አማርኛ ወይም አፋን ኦሮሞ መወያየት ትችላላችሁ። ቋንቋን ለመቀየር ከላይ ያለውን መምረጫ ይጠቀሙ። ስለ ማረጋገጫ፣ ፕሮጀክቶች፣ ፋይናንስ እና ኢቫንቶች ጠይቁ።"
      case 'om':
        return "Akkam! Ani MinT Assistant. Afaan Ingilizii, Amaariffaa, ykn Afaan Oromoo waliin haasaʼuu dandeessu. Afaan jijjiiruuf gara gubbaa mirgaa jiran filannoo fayyadamaa. Mirkaneessa, projektoota, deeggarsa maallaqa fi eventoota gaafadhu."
      default:
        return "Hi! I'm MinT Assistant. You can chat in English, Amharic, or Afan Oromo. Use the language selector to switch. Ask about verification, projects, funding, or events."
    }
  }

  // Enumerate all possible storage keys that may contain past chat history
  const getAllHistoryKeys = (primaryNs?: string): string[] => {
    const current = (primaryNs || ns || getUserNamespace()).toLowerCase()
    const candidates = getCandidateNamespaces(current)
    const keys: string[] = []
    for (const cand of candidates) {
      keys.push(`${LS_BASE.messages}:${cand}`)
    }
    // Legacy support: older builds may have used an un-namespaced key
    keys.push(LS_BASE.messages as any)
    return Array.from(new Set(keys))
  }

  // Normalize any stored transcript variants into current Message[] shape
  const normalizeStoredMessages = (arr: any[]): Message[] => {
    if (!Array.isArray(arr)) return []
    return arr
      .map((m: any, i: number) => {
        if (!m) return null
        const text = m.text ?? m.content ?? m.message ?? ''
        const botish = (typeof m.isBot === 'boolean') ? m.isBot : (
          (typeof m.role === 'string' && m.role.toLowerCase() !== 'user') ||
          (typeof m.sender === 'string' && m.sender.toLowerCase() !== 'user') ||
          m.bot === true
        )
        const ts = m.timestamp ?? m.date ?? Date.now()
        if (!text) return null
        return {
          id: Number(m.id) || (Date.now() + i),
          text: String(text),
          isBot: !!botish,
          timestamp: new Date(ts)
        } as Message
      })
      .filter(Boolean) as Message[]
  }

  const loadPastChat = () => {
    // Evaluate all candidate keys, then pick the best match using priority rules
    const keys = getAllHistoryKeys(ns)
    const currentNs = (ns || getUserNamespace()).toLowerCase()
    const userObj = getUserObject()
    const userIds = new Set<string>(
      [userObj?._id, userObj?.id, userObj?.email, userObj?.username]
        .filter(Boolean)
        .map((v: any) => String(v).toLowerCase())
    )

    type Cand = { key: string; ns: string | null; messages: any[]; last: number; }
    const candidates: Cand[] = []
    for (const key of keys) {
      const storedRaw = safeRead<any>(key, null as any)
      const stored = Array.isArray(storedRaw) ? storedRaw : (Array.isArray(storedRaw?.messages) ? storedRaw.messages : [])
      if (!hasRealHistory(stored)) continue
      const keyNs = nsFromKey(key)
      // Only consider:
      // - If guest session: allow guest ns and legacy
      // - If logged-in: allow only ns === currentNs or ns in userIds; ignore guest/legacy
      const isGuest = currentNs === 'guest'
      const allow = isGuest
        ? (!keyNs || keyNs === 'guest')
        : (keyNs === currentNs || (!!keyNs && userIds.has(keyNs)))
      if (!allow) continue
      candidates.push({ key, ns: keyNs, messages: stored, last: lastTimestampOf(stored) })
    }
    if (candidates.length === 0) return

    // Rank candidates: 1) ns === currentNs, 2) ns in userIds (excluding 'guest'), 3) other namespaced, 4) legacy (null)
    const score = (c: Cand) => {
      if (c.ns === currentNs) return 4000 + c.last
      if (c.ns && c.ns !== 'guest' && userIds.has(c.ns)) return 3000 + c.last
      if (c.ns && c.ns !== 'guest') return 2000 + c.last
      return 1000 + c.last // legacy
    }
    candidates.sort((a, b) => score(b) - score(a))
    const best = candidates[0]
    const normalized = normalizeStoredMessages(best.messages)
    if (normalized.length === 0) return
    setMessages(normalized)
    const currentKey = k(LS_BASE.messages)
    if (best.key !== currentKey) {
      try { localStorage.setItem(currentKey, JSON.stringify(normalized)) } catch {}
    }
  }

  

  // Track if there is a previously saved chat for this user (any candidate namespace)
  const initialHasHistory = (() => {
    const current = getUserNamespace()
    const keys = getAllHistoryKeys(current)
    const userObj = getUserObject()
    const userIds = new Set<string>(
      [userObj?._id, userObj?.id, userObj?.email, userObj?.username]
        .filter(Boolean)
        .map((v: any) => String(v).toLowerCase())
    )
    for (const key of keys) {
      const keyNs = nsFromKey(key)
      const isGuest = current === 'guest'
      const allow = isGuest
        ? (!keyNs || keyNs === 'guest')
        : (keyNs === current || (!!keyNs && userIds.has(keyNs)))
      if (!allow) continue
      const storedRaw = safeRead<any>(key, null as any)
      const stored = Array.isArray(storedRaw) ? storedRaw : (Array.isArray(storedRaw?.messages) ? storedRaw.messages : [])
      if (hasRealHistory(stored)) return true
    }
    return false
  })()
  const [hasPastChat, setHasPastChat] = useState<boolean>(() => initialHasHistory)

  // Past chats load manually via the button for a more explicit UX

  // Recompute namespace and whether a past chat exists for that namespace
  const recomputeNsAndPast = React.useCallback(() => {
    const current = getUserNamespace()
    if (current !== ns) setNs(current)
    try {
      const keys = getAllHistoryKeys(current)
      const userObj = getUserObject()
      const userIds = new Set<string>(
        [userObj?._id, userObj?.id, userObj?.email, userObj?.username]
          .filter(Boolean)
          .map((v: any) => String(v).toLowerCase())
      )
      let found = false
      for (const key of keys) {
        const keyNs = nsFromKey(key)
        const isGuest = current === 'guest'
        const allow = isGuest
          ? (!keyNs || keyNs === 'guest')
          : (keyNs === current || (!!keyNs && userIds.has(keyNs)))
        if (!allow) continue
        const storedRaw = safeRead<any>(key, null as any)
        const stored = Array.isArray(storedRaw) ? storedRaw : (Array.isArray(storedRaw?.messages) ? storedRaw.messages : [])
        if (hasRealHistory(stored)) { found = true; break }
      }
      setHasPastChat(found)
    } catch {}
  }, [ns])

  // Keep namespace in sync with auth changes (logout/login)
  React.useEffect(() => {
    // Run on mount
    recomputeNsAndPast()
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'user' || e.key === 'chat_ns_candidates' || e.key === 'last_auth_change' || e.key === null) {
        recomputeNsAndPast()
      }
    }
    const onFocus = () => recomputeNsAndPast()
    const onAuthChanged = () => recomputeNsAndPast()
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', onFocus)
    window.addEventListener('auth:changed', onAuthChanged as any)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('auth:changed', onAuthChanged as any)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Also recompute when chat is opened (same-tab login/logout flows)
  React.useEffect(() => {
    if (isOpen) {
      recomputeNsAndPast()
    }
  }, [isOpen, recomputeNsAndPast])

  // If namespace changes for any reason, refresh hasPastChat check
  React.useEffect(() => {
    recomputeNsAndPast()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ns])

  // When switching to a new namespace with no history, show a fresh localized welcome
  React.useEffect(() => {
    if (!hasPastChat) {
      const fresh = [{ id: Date.now(), text: welcomeByLang(lang), isBot: true, timestamp: new Date() }]
      const currentlyFresh = messages.length === 1 && messages[0]?.isBot === true
      if (!currentlyFresh || messages[0].text !== fresh[0].text) {
        setMessages(fresh as Message[])
        setMessage("")
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ns, hasPastChat, lang])

  // Start with welcome only; allow explicit loading of past chat if available
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: 1,
      text: welcomeByLang(lang),
      isBot: true,
      timestamp: new Date(),
    },
  ])
  const [isOnline, setIsOnline] = useState(false)
  // Track last user topic to support follow-ups like "next", "continue"
  const [lastTopic, setLastTopic] = useState<string>(() => safeRead<string>(k(LS_BASE.topic), ""))
  const messagesEndRef = React.useRef<HTMLDivElement | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState<string | null>(null)

  const scrollToBottom = (smooth = true) => {
    try {
      messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
    } catch {}
  }

  // Online indicator toggles when chat is opened/closed
  React.useEffect(() => {
    if (isOpen) setIsOnline(true)
    else setIsOnline(false)
  }, [isOpen])

  // Auto-scroll when messages change
  React.useEffect(() => {
    scrollToBottom(true)
  }, [messages])

  // Persist state to localStorage
  React.useEffect(() => {
    try {
      localStorage.setItem(k(LS_BASE.open), JSON.stringify(isOpen))
    } catch {}
  }, [isOpen])

  React.useEffect(() => {
    try {
      localStorage.setItem(k(LS_BASE.minimized), JSON.stringify(isMinimized))
    } catch {}
  }, [isMinimized])

  React.useEffect(() => {
    try {
      localStorage.setItem(k(LS_BASE.lang), JSON.stringify(lang))
    } catch {}
  }, [lang])

  // When language changes, update welcome if chat is fresh; otherwise append a short notice
  React.useEffect(() => {
    setMessages(prev => {
      const hasUserMsg = prev.some(m => !m.isBot)
      if (!hasUserMsg && prev.length > 0 && prev[0].isBot) {
        const updated = [...prev]
        updated[0] = { ...updated[0], text: welcomeByLang(lang) }
        return updated
      }
      // Append concise language switch note
      const noteByLang: Record<'en'|'am'|'om', string> = {
        en: 'Language set. You can chat in this language now.',
        am: 'ቋንቋ ተቀይሯል። አሁን በዚህ ቋንቋ መወያየት ትችላለህ/ሽ።',
        om: 'Afaan filatameera. Amma afaan kanaan na waliin haasa’i.'
      }
      return [
        ...prev,
        { id: Date.now(), text: noteByLang[lang], isBot: true, timestamp: new Date() }
      ]
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang])

  React.useEffect(() => {
    try {
      localStorage.setItem(k(LS_BASE.draft), JSON.stringify(message))
    } catch {}
  }, [message])

  // Persist last topic
  React.useEffect(() => {
    try {
      localStorage.setItem(k(LS_BASE.topic), JSON.stringify(lastTopic))
    } catch {}
  }, [lastTopic])

  // Persist messages per-user namespace
  React.useEffect(() => {
    try {
      localStorage.setItem(k(LS_BASE.messages), JSON.stringify(messages))
    } catch (error) {
      console.error('Error saving messages:', error)
    }
  }, [messages, ns])

  // Public asset served by Vite from project root /public
  const botLogo = "/Chatbot%20YIP.png"
  // Logo sizes (in pixels) – adjust as needed
  const launcherLogoSize = 48
  const headerLogoSize = 28
  const messageLogoSize = 28

  const preloadedResponses = {
    // Getting started
    "how to use": "Quick start: 1) Create an account or log in 2) Complete your profile 3) Apply for verification 4) Once verified, post projects and join events. Use the top navigation: Home (/app), Projects, Events, Innovators, Profile.",
    "login": "Go to /login, sign in with email/password or continue with Google. After login, you'll be redirected to /app or /admin based on your role.",
    "register": "Open /register and fill in your details. You can later complete your profile and apply for verification from your profile page.",
    "profile": "Profile lets you update your info and avatar. Access it via the top nav: Profile. Keep it complete before applying for verification.",

    // Verification & projects (Updated per product flow)
    "how to verify": "1. Go to `/app` (Home).\n2. Click Apply Now.\n3. Fill the required information.\n4. Submit for review.",
    "get verified": "1. Go to `/app` (Home).\n2. Click Apply Now.\n3. Fill the required information.\n4. Submit for review.",
    "verified": "1. Go to `/app` (Home).\n2. Click Apply Now.\n3. Fill the required information.\n4. Submit for review.",
    "verification": "1. Go to `/app` (Home).\n2. Click Apply Now.\n3. Fill the required information.\n4. Submit for review.",
    "apply now": "1. Go to `/app` (Home).\n2. Click Apply Now.\n3. Fill the required information.\n4. Submit for review.",
    "post project": "After verification, go to Projects > Create Project. Fill title, description, sector, and upload images. Submit to publish so it appears on /projects and /app.",
    "github": "Connecting GitHub helps us validate your activity and showcase your work. Go to Profile to link your GitHub account.",

    // Events
    "create event": "Admins can create events at /admin/create-event. Fill in title, description, dates, add images (drag and drop), and publish. Images are uploaded and will display on the Events page.",
    "events page": "Visit /events to see upcoming events. Click an event to view details. Admins can edit or delete events from their pages.",
    "upload images": "When creating events or projects, use the image uploader to attach PNG/JPG files. A preview appears before submission.",

    // Organization info
    "internship office": "The Ministry of Innovation and Technology (MinT) internship office is in Addis Ababa, main building. Hours: 8:00–17:00, Mon–Fri.",
    "sectors": "We support innovation in: Health, Agriculture, Education, Finance, Transportation, Environment, Energy, and Technology.",

    // MiNT quick facts
    "mint": "MiNT stands for the Ministry of Innovation and Technology of Ethiopia. Official website: https://www.mint.gov.et",
    "ministry of innovation and technology": "The Ministry of Innovation and Technology (MinT), Ethiopia. Official website: https://www.mint.gov.et",
    "about mint": "The Ministry of Innovation and Technology (MinT) leads Ethiopia’s national innovation, science and technology agenda, supports innovators and digital transformation. Official site: https://www.mint.gov.et",
    "official website": "Official website of Ethiopia’s Ministry of Innovation and Technology (MinT): https://www.mint.gov.et",
    "website": "Official website of Ethiopia’s Ministry of Innovation and Technology (MinT): https://www.mint.gov.et",
    "what is mint": "MinT is Ethiopia’s Ministry of Innovation and Technology. Learn more at https://www.mint.gov.et",
    "name": "Official name: Ministry of Innovation and Technology (MinT), Ethiopia.",

    // MinT Ethiopia office details (Ethiopia, Africa)
    "where is mint": "MinT is located in Addis Ababa, Ethiopia (Africa). The main office is near the Science and Technology campus/government district.",
    "location": "MinT Headquarters: Addis Ababa, Ethiopia. Hours: 8:00–17:00, Monday–Friday.",
    "address": "Addis Ababa, Ethiopia – Ministry of Innovation and Technology (MiNT) main building.",
    "office hours": "Office hours: Monday–Friday, 8:00 AM – 5:00 PM East Africa Time (EAT).",
    "contact": "General contact: contact@mint.gov.et, Phone: +251 11 813 2191. Official site: https://www.mint.gov.et",
    "email": "Official email: contact@mint.gov.et",
    "phone": "+251 11 813 2191",
    "mission": "MiNT’s mission is to drive national innovation, science, and technology for sustainable development and digital transformation in Ethiopia.",
    "vision": "MiNT’s vision: a competitive, innovative Ethiopia empowered by science and technology.",
    "innovation technology office": "The Innovation and Technology Office (MiNT, Ethiopia) coordinates programs, technology transfer, capacity building, and national innovation initiatives.",
  } as Record<string, string>

  // Quick-reply suggestions to keep UX fast and professional
  const suggestionsByLang: Record<'en'|'am'|'om', string[]> = {
    en: [
      'How do I get verified?',
      'Create a project',
      'Upcoming events',
      'Request funding',
      'Official website'
    ],
    am: [
      'እባክዎ ስለ ማረጋገጫ አስተያየት ላኩኝ።',
      'ፕሮጀክት መፍጠር',
      'ቀረባ ኢቫንቶች',
      'ፋይናንስ መጠየቅ',
      'የመንግሥት ድረ-ገጽ'
    ],
    om: [
      'Akkamitti mirkanaaʼa?',
      'Projekt uumuu',
      'Eventoota dhufu',
      'Deeggarsa maallaqa kadhachuu',
      'Website olaanaa'
    ],
  }

  // Keep responses short and clean
  const sanitizeAnswer = (text: string, l: 'en'|'am'|'om'): string => {
    if (!text) return text
    const longOrNoisy = /Quick Overview|# |## |\* |- |APICallError|Connect Timeout|UND_ERR_CONNECT_TIMEOUT/i.test(text) || text.length > 450
    if (!longOrNoisy) return text
    const brief: Record<'en'|'am'|'om', string> = {
      en: 'Please clarify your question (verification, projects, funding, or events).',
      am: 'ጥያቄዎን ይግለጹ (ማረጋገጫ፣ ፕሮጀክት፣ ፋይናንስ ወይም ኢቫንቶች).',
      om: 'Gaaffii kee iftoomsi (mirkaneessa, projektoota, deeggarsa, yookaan eventoota).'
    }
    return brief[l]
  }

  // Professional intent router with safety filter and concise replies
  const getBotResponse = (userMessage: string): string => {
    const lowercaseMessage = userMessage.toLowerCase()
    const isGreetingRegex = /(?:^|\b)(hello|hi|hey)(?:\b|!|\.|\?|,)/i
    // Safety: handle insults/offensive content professionally
    const toxicRegex = /(stupid|idiot|selfish|shut up|trash|useless|f\*?ck|bitch|dumb|nonsense|get lost)/i
    if (toxicRegex.test(lowercaseMessage)) {
      const safeByLang: Record<'en'|'am'|'om', string> = {
        en: 'I’m here to help. Please ask a question about verification, projects, funding, or events.',
        am: 'ለርዳታ እዚህ ነኝ። እባክዎ ስለ ማረጋገጫ፣ ፕሮጀክቶች፣ ፋይናንስ ወይም ኢቫንቶች ጥያቄ ይጠይቁ።',
        om: 'Si gargaaruuf as jira. Mirkaneessa, projektoota, deeggarsa ykn eventoota irratti na gaafadhu.'
      }
      return safeByLang[lang]
    }
    
    for (const [key, response] of Object.entries(preloadedResponses)) {
      if (lowercaseMessage.includes(key)) {
        return response
      }
    }

    // Default responses
    if (isGreetingRegex.test(userMessage)) {
      const greetByLang: Record<'en'|'am'|'om', string> = {
        en: 'Hi! How can I help?',
        am: 'ሰላም! እንዴት ልርዳዎ?',
        om: 'Akkam! Maal si gargaaruu?'
      }
      return greetByLang[lang]
    }

    // Requests for personal/staff contacts -> point to official channels
    const contactIntent = /(someone|staff|person|employee|inside|office).*\b(contact|phone|number|email|whatsapp)|\b(give me (his|her) contact)/i
    if (contactIntent.test(userMessage)) {
      const replyByLang: Record<'en'|'am'|'om', string> = {
        en: 'For privacy, I can’t share personal contacts. Please use official channels: contact@mint.gov.et or +251 11 813 2191. Visit http://www.mint.gov.et',
        am: 'ስለ ግላዊነት የግል መገኛ መረጃ አካፍልም። ኦፊሴላዊ መንገዶችን ይጠቀሙ፡ contact@mint.gov.et ወይም +251 11 813 2191። ይመልከቱ http://www.mint.gov.et',
        om: 'Sababa icciitii qofaa, qunnamtii dhuunfaa hin kennu. Karaalee sirrii: contact@mint.gov.et ykn +251 11 813 2191. Daawwadhaa http://www.mint.gov.et'
      }
      return replyByLang[lang]
    }

    // Clarify no feelings / AI assistant identity
    const feelingsIntent = /(have|got|with) (feelings|emotion|emotions|feel)|do you (feel|have feelings)|are you (human|a person)/i
    if (feelingsIntent.test(userMessage)) {
      const replyByLang: Record<'en'|'am'|'om', string> = {
        en: "I’m an AI assistant for the MinT Innovation Portal — I don’t have feelings, but I can help with verification, projects, funding, or events.",
        am: "እኔ የMinT Innovation Portal ረዳት ነው ፣ ስሜት የለኝም። ግን ስለ ማረጋገጫ፣ ፕሮጀክቶች፣ ፋይናንስ ወይም ኢቫንቶች ልርዳ እችላለሁ።",
        om: "Ani deeggaraa AI MinT Innovation Portal ti — yaada qalbii hin qabu; garuu mirkaneessa, projektoota, deeggarsa maallaqaa fi eventoota irratti si gargaaruu nan dandaʼa."
      }
      return replyByLang[lang]
    }

    if (/(help|guide|support|assist)/i.test(lowercaseMessage)) {
      const byLang: Record<'en'|'am'|'om', string> = {
        en: 'I can help with verification, projects, funding, and events. Ask a specific question or pick a suggestion below.',
        am: 'ስለ ማረጋገጫ፣ ፕሮጀክቶች፣ ፋይናንስ እና ኢቫንቶች ልርዳ እችላለሁ። በተለይ ጠይቁ ወይም ከታች ምክሮችን ይምረጡ።',
        om: 'Mirkaneessa, projektoota, deeggarsa fi eventoota irratti si gargaaruu nan dandaʼa. Gaaffii addaa gaafadhu yookaan filannoo gadi aanaa fili.'
      }
      return byLang[lang]
    }

    // Concise fallback
    const fallbackByLang: Record<'en'|'am'|'om', string> = {
      en: 'Please rephrase with more detail (e.g., “how to verify”, “create project”, “upcoming events”).',
      am: 'እባክዎን በዝርዝር ይግለጹ (ምሳሌ፡ “እንዴት ልረጋገጥ”, “ፕሮጀክት መፍጠር”, “ቀረባ ኢቫንቶች”).',
      om: 'Ilaalcha balʼinaan ibsi (fakkeenyaaf: “akkamitti mirkanaaʼa”, “projekt uumuu”, “eventoota dhufu”).'
    }
    return fallbackByLang[lang]
  }

  const sendMessage = async () => {
    if (!message.trim()) return

    // Use current input with short-turn context (previous user/bot + lastTopic only)
    const userText = message.trim()
    const rev = [...messages].reverse()
    const prevUser = (rev.find(m => !m.isBot)?.text) || ''
    const prevBot = (rev.find(m => m.isBot)?.text) || ''
    const followUpRegex = /^(next|continue|what about|and|more|that|it|them|those|this)\b/i
    const isFollowUp = followUpRegex.test(userText)

    const userMessage: Message = {
      id: Date.now(),
      text: userText,
      isBot: false,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])

    const pendingId = Date.now() + 1
    setMessages(prev => [
      ...prev,
      { id: pendingId, text: "Thinking...", isBot: true, timestamp: new Date() },
    ])
    // Ensure the pending status is visible immediately
    scrollToBottom(true)

    setMessage("")
    setIsSending(true)

    try {
      // Send only minimal context (previous turn + lastTopic) to keep answers related but not long-threaded
      const payload: any = {
        message: userText,
        lang,
        context: {
          lastTopic,
          prevUser,
          prevBot,
          isFollowUp
        }
      }
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) throw new Error('chat api error')
      const data = await res.json()
      // Force short greeting for hi/hello/hey regardless of server response
      const isGreeting = /(?:^|\b)(hello|hi|hey)(?:\b|!|\.|\?|,)/i.test(userText)
      let answer = data?.answer || getBotResponse(userText)
      if (isGreeting) {
        const greetByLang: Record<'en'|'am'|'om', string> = {
          en: 'Hi! How can I help?',
          am: 'ሰላም! እንዴት ልርዳዎ?',
          om: 'Akkam! Maal si gargaaruu?'
        }
        answer = greetByLang[lang]
      }

      // Client-side normalization for verification flow regardless of backend
      const verifyRegex = /(\bverify\b|verification|get\s*verified|apply\s*now)/i
      if (verifyRegex.test(userText)) {
        answer = preloadedResponses['how to verify']
      }

      // Correct any incorrect English-only claim from upstream
      if (/only\s+supports\s+english/i.test(answer || '')) {
        answer = 'You can chat in English, Amharic, or Afan Oromo. Use the top-right selector to switch.'
      }

      const clean = sanitizeAnswer(answer, lang)
      setMessages(prev => prev.map(m => m.id === pendingId ? { ...m, text: clean } : m))

      // Update lastTopic with a concise slice of the latest user request
      setLastTopic(userText.slice(0, 160))
      setActiveSuggestion(null)
    } catch (err) {
      // Short, friendly error message
      const netErrorByLang: Record<'en'|'am'|'om', string> = {
        en: 'Network issue. Please try again.',
        am: 'የኔትወርክ ችግኝ ነበር። እባክዎ እንደገና ይሞክሩ።',
        om: 'Rakkoo network jira. Maaloo deebiʼi irra deebiʼi.'
      }
      const fallback = getBotResponse(userText)
      const clean = sanitizeAnswer(fallback, lang)
      const finalText = clean || netErrorByLang[lang]
      setMessages(prev => prev.map(m => m.id === pendingId ? { ...m, text: finalText } : m))
      setActiveSuggestion(null)
    }
    setIsSending(false)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      sendMessage()
    }
  }

  // Lightweight rich renderer: ordered lists, inline code, and autolinks
  // Remove AutoLink component as it's no longer needed

  // Clean message text by removing URLs and bracketed link labels
  const cleanMessageText = (text: string): string => {
    if (!text) return ''
    return text
      .replace(/https?:\/\/[^\s]+/g, ' ')
      .replace(/\s*\[[^\]]*\]\s*/g, ' ')
      .replace(/\s*\([^)]*\)\s*/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
  }

  const renderMessage = (text: string, isFirstMessage: boolean) => {
    if (!text) return null
    const cleaned = cleanMessageText(text)
    if (!cleaned) return null
    const lines = cleaned.split(/\r?\n/).filter(l => l.trim().length > 0)
    const isOrderedBlock = lines.length > 1 && lines.every(l => /^\d+\.\s/.test(l))
    if (isOrderedBlock) {
      return (
        <ol className="list-decimal ml-4 space-y-1">
          {lines.map((l, i) => (
            <li key={i} className="pl-1 text-[13px] leading-relaxed">{l.replace(/^\d+\.\s/, '').trim()}</li>
          ))}
        </ol>
      )
    }
    return <div className="text-sm">{cleaned}</div>
  }

  // When past chat exists and session is fresh, hide the welcome bubble and only show the button
  const isFreshWelcome = React.useMemo(() => messages.length === 1 && (messages[0]?.isBot === true), [messages])
  const displayMessages = React.useMemo(() => {
    return hasPastChat && isFreshWelcome ? [] : messages
  }, [hasPastChat, isFreshWelcome, messages])

  if (!isOpen) {
    return (
      <div
        role="button"
        aria-label="Open chatbot"
        title="Chat with us"
        onClick={() => setIsOpen(true)}
        className="fixed right-6 bottom-6 md:bottom-6 mb-16 md:mb-0 z-[9999] cursor-pointer select-none p-0 bg-transparent border-0 shadow-none transition-all"
      >
        <div className="grid place-items-center">
          <img
            src={botLogo}
            alt="Chatbot Logo"
            className="object-contain"
            style={{ width: launcherLogoSize, height: launcherLogoSize }}
          />
        </div>
      </div>
    )
  }

  return (
    <Card
      className={cn(
        "fixed right-6 z-50 shadow-2xl transition-all duration-300",
        "bottom-6 md:bottom-6 mb-16 md:mb-0",
        isMinimized ? "w-80 h-16" : "w-[22rem] md:w-96 h-[24rem]"
      )}
    >
      <CardHeader className="flex items-start justify-between space-y-0 p-3 bg-[#2e9891] text-white border-b border-transparent rounded-t-xl">
        <div className="flex items-center gap-3 min-w-0">
          <div className="grid place-items-center">
            <img
              src={botLogo}
              alt="Assistant"
              className="object-contain"
              style={{ width: headerLogoSize, height: headerLogoSize }}
            />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-base leading-5 font-semibold text-white truncate">
              MinT Innovation Assistant
            </CardTitle>
            <div className="mt-0.5 text-[11px] text-white/85 flex items-center gap-2">
              <CheckCircle className="h-3.5 w-3.5" /> {isOnline ? "Online" : "Offline"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Language selector */}
          <select
            aria-label="Select language"
            className="text-xs rounded-md px-2 py-1 bg-white text-[#2e9891] focus:outline-none focus:ring-2 focus:ring-white/50 shadow-sm"
            value={lang}
            onChange={(e) => setLang(e.target.value as any)}
          >
            <option value="en">English</option>
            <option value="am">Amharic</option>
            <option value="om">Afan Oromo</option>
          </select>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMinimized(!isMinimized)}
            className="h-7 w-7 p-0 hover:bg-white/10 text-white"
            aria-label={isMinimized ? "Maximize chat" : "Minimize chat"}
          >
            {isMinimized ? (
              <Maximize2 className="h-4 w-4" />
            ) : (
              <Minimize2 className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(false)}
            className="h-7 w-7 p-0 hover:bg-white/10 text-white"
            aria-label="Close chat"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      {!isMinimized && (
        <CardContent className="p-0 flex flex-col h-[calc(100%-4.25rem)]">
          <div className="flex-1 p-4 bg-[#f6fbfa] overflow-y-auto">
            <div className="space-y-3">

              {/* Load past chat button if any candidate namespace has real history */}
              {hasPastChat && isFreshWelcome && (
                <div className="p-3 pt-0">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={loadPastChat}
                    className="text-xs w-full justify-center gap-2 font-medium"
                  >
                    Load previous conversation
                  </Button>
                  <div className="mt-2 text-[11px] text-slate-500 text-center">We found past messages for your account.</div>
                </div>
              )}
              {displayMessages.map((msg, idx) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex items-end gap-2",
                    msg.isBot ? "justify-start" : "justify-end"
                  )}
                >
                  {msg.isBot && (
                    <div className="flex items-center justify-center flex-shrink-0">
                      <img
                        src={botLogo}
                        alt="Bot"
                        className="object-contain"
                        style={{ width: messageLogoSize, height: messageLogoSize }}
                      />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[75%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed shadow-sm",
                      msg.isBot
                        ? "bg-white text-slate-800 border border-slate-200"
                        : "bg-[#2e9891] text-white"
                    )}
                  >
                    {msg.isBot ? renderMessage(msg.text, idx === 0) : msg.text}
                  </div>
                  {!msg.isBot && (
                    <div className="h-7 w-7 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 text-slate-700 shadow-sm">
                      <User className="h-3.5 w-3.5" />
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
              {/* Quick suggestions (welcome-only, hidden if past chat exists) */}
              {isFreshWelcome && !hasPastChat && (
                <div className="pt-1 flex flex-wrap gap-2">
                  {suggestionsByLang[lang].map((s) => {
                  const active = activeSuggestion === s
                  return (
                    <button
                      key={s}
                      disabled={isSending}
                      className={cn(
                        "text-xs px-2.5 py-1.5 rounded-full border shadow-sm transition-all",
                        active
                          ? "bg-[#e6f4f3] border-[#2e9891] text-[#277f79] ring-2 ring-[#2e9891]/30"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                      )}
                      onClick={() => { setActiveSuggestion(s); setMessage(s); setTimeout(() => sendMessage(), 0); }}
                    >
                      {s}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          </div>

          <div className="p-3 border-t bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70 rounded-b-xl">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Ask me anything..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1 h-10 rounded-xl bg-white border-slate-200 focus-visible:ring-[#2e9891]"
              />
              <Button
                onClick={sendMessage}
                size="sm"
                disabled={isSending}
                className="h-10 px-3 rounded-xl bg-[#2e9891] hover:bg-[#277f79] text-white disabled:opacity-60 disabled:cursor-not-allowed"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
