import express from 'express';
import { retrieveTopK } from '../rag/search';
import { db } from '../services/database';
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import fs from 'fs';
import path from 'path';

const router = express.Router();

function extractAnswer(text: string) {
  // Our doc text is "question\n\nanswer"; try to return the answer part
  const parts = text.split(/\n\n+/);
  return parts.length > 1 ? parts.slice(1).join('\n\n') : text;
}

function isGreeting(input: string) {
  const s = input.trim().toLowerCase();
  return [
    'hi', 'hello', 'hey', 'selam', 'good morning', 'good afternoon', 'good evening'
  ].some(k => s.includes(k));
}

function friendlyWelcome(lang: 'en'|'am'|'om' = 'en') {
  if (lang === 'am') {
    return "ሰላም! የMinT አስስታንት ነኝ። በእንግሊዝኛ፣ አማርኛ ወይም አፋን ኦሮሞ መወያየት ትችላላችሁ። ቋንቋን ለመቀየር የተጠቃሚ መምረጫውን ይጠቀሙ። ስለ ማረጋገጫ፣ ፕሮጀክቶች፣ ፋይናንስ እና ኢቫንቶች ጠይቁ።";
  }
  if (lang === 'om') {
    return "Akkam! Ani MinT Assistant. Afaan Ingilizii, Amaariffaa, ykn Afaan Oromoo waliin haasaʼuu dandeessu. Afaan jijjiiruuf filannoo fayyadamaa itti fayyadamaa. Mirkaneessa, projektoota, deeggarsa maallaqa fi eventoota gaafadhu.";
  }
  return "Hi! I’m MinT Assistant. You can chat in English, Amharic, or Afan Oromo. Use the language selector to switch. Ask about verification, projects, funding, or events.";
}

// Simple small-talk handler for general/polite chat
function smallTalk(input: string, lang: 'en'|'am'|'om' = 'en'): string | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;
  if (isGreeting(s)) return friendlyWelcome(lang);
  if (/(thank\s*you|thanks|tnx|thx|much\s+appreciated)/i.test(s)) {
    if (lang === 'am') return "እንኳን ደህና መጣችሁ! ተጨማሪ እርዳታ ከፈለጉ ይጠይቁ።";
    if (lang === 'om') return "Kama nagaan! Yoo waa biraa barbaaddan na gaafadhaa.";
    return "You're welcome! If you need anything else, just ask.";
  }
  if (/(bye|goodbye|see\s+you|cya|later)/i.test(s)) {
    if (lang === 'am') return "ደህና ሁኑ! መልካም ቀን ይሁን። 👋";
    if (lang === 'om') return "Nagaatti! Guyyaa gaarii qabaadhaa. 👋";
    return "Goodbye! Have a great day. 👋";
  }
  if (/(how\s+are\s+you|how\s+is\s+it\s+going|sup|what's\s+up)/i.test(s)) {
    if (lang === 'am') return "ደህና ነኝ፣ ለመርዳት ዝግጁ ነኝ። ዛሬ እንዴት ልርዳዎት?";
    if (lang === 'om') return "Gaarii nan jira; isiniif qophaa’ee jira! Har’a maal isin gargaara?";
    return "I'm doing great and ready to help! How can I assist you today?";
  }
  if (/(who\s+are\s+you|what\s+are\s+you|are\s+you\s+a\s+bot)/i.test(s)) {
    if (lang === 'am') return "እኔ የMinT ኢኖቬሽን ፖርታል አገልጋይ ነኝ — በፕሮጀክቶች፣ ማረጋገጫ፣ መጠየቂያዎችና ክስተቶች ላይ እርዳታ እሰጣለሁ።";
    if (lang === 'om') return "Ani gargaaraa MinT Innovation Portal — projjektoota, mirkaneessa, kadhatoowwan fi taateewwan irratti isin deeggara.";
    return "I'm the MinT Innovation Portal assistant — here to help with projects, verification, requests, and events.";
  }
  if (/(help|what\s+can\s+you\s+do|how\s+to\s+use)/i.test(s)) {
    return friendlyWelcome(lang);
  }
  if (/^(ok|okay|k|sure|alright|cool|nice|great)[.!\s]*$/i.test(s)) {
    if (lang === 'am') return "👍 ተቀብዬ አለኝ። ሌላ እንዲረዳዎ አለ?";
    if (lang === 'om') return "👍 Na gahu. Waan biraa isin gargaaruu danda’aa?";
    return "👍 Got it. Anything else I can help you with?";
  }
  return null;
}

// Lightweight normalization to improve intent matching
function normalizeInput(input: string) {
  const s = input.toLowerCase().trim();
  const replacements: Record<string, string> = {
    verfication: 'verification',
    certifcate: 'certificate',
    certficate: 'certificate',
    inovation: 'innovation',
  };
  let out = s;
  for (const [k, v] of Object.entries(replacements)) {
    // Use split/join for wide Node/TS compatibility (instead of replaceAll)
    out = out.split(k).join(v);
  }
  return out;
}

// Load baseline portal overview context
const overviewPath = path.join(process.cwd(), 'server', 'rag', 'portal-overview.md');
const portalOverview = fs.existsSync(overviewPath)
  ? fs.readFileSync(overviewPath, 'utf-8')
  : '';

// Simple language detection: prefer explicit lang, otherwise infer
function detectLang(input: string, hint?: string): 'en'|'am'|'om' {
  const h = (hint || '').toLowerCase();
  if (h === 'am' || h === 'om' || h === 'en') return h as any;
  // Ethiopic block -> Amharic
  if (/[\u1200-\u137F]/.test(input)) return 'am';
  // Basic Oromo keywords
  const omHints = /(akkam|maal|galatoomi|baga|nagaan|eessa|barbaada|tartiiba|akka|ragaa)/i;
  if (omHints.test(input)) return 'om';
  return 'en';
}

// Multilingual FAQ patterns
type Lang = 'en'|'am'|'om';
type QA = { patterns: RegExp[]; answer: string };
const FAQ: Record<Lang, QA[]> = {
  en: [
    { patterns: [/ministry\s+of\s+innovation|about\s+mint|what\s+is\s+mint/i], answer: "The Ministry of Innovation and Technology (MinT) of Ethiopia leads national innovation, digital transformation, and technology development. Learn more at http://www.mint.gov.et/." },
    { patterns: [/contact|phone|email/i], answer: "Contact MinT: Phone +251 11 8 132 191, Email contact@mint.gov.et, Website https://www.mint.gov.et." },
    { patterns: [/working\s*hours|open|time|hours/i], answer: "Working hours: Monday–Friday, 8:00–17:00 (local time)." },
    { patterns: [/programs|services|opportunities/i], answer: "MinT supports innovators with technology transfer, digitalization programs, expert mentorship, funding opportunities, events, and certification." },
    
    // Verification and Application
    { patterns: [/verify|verification|become\s+verified|apply\s*now/i], answer: "To get verified on the MinT Innovation Portal:\n1. Log in to your account\n2. Go to your Dashboard\n3. Click on 'Apply for Verification'\n4. Complete the verification form\n5. Upload required documents\n6. Submit for review\n\nVerification typically takes 3-5 business days." },
    
    // Account Management
    { patterns: [/register|sign\s*up|create\s*account/i], answer: "To create an account:\n1. Go to /register\n2. Enter your email and create a password\n3. Verify your email address\n4. Complete your profile information\n5. Start exploring the portal!" },
    
    { patterns: [/login|sign\s*in/i], answer: "Sign in options:\n1. Email/Password: Go to /login and enter your credentials\n2. Google: Click 'Sign in with Google'\n\nForgot password? Use the 'Reset Password' link on the login page." },
    
    // Profile Management
    { patterns: [/edit\s+profile|update\s+profile|change\s+profile/i], answer: "To edit your profile:\n1. Log in to your account\n2. Click on your profile picture/name in the top right\n3. Select 'Edit Profile'\n4. Update your information\n5. Click 'Save Changes'\n\nYou can update your personal details, contact information, and profile picture." },
    
    { patterns: [/change\s+password|update\s+password|reset\s+password/i], answer: "To change your password:\n1. Go to your Profile Settings\n2. Click on 'Change Password'\n3. Enter your current password\n4. Enter your new password\n5. Confirm the new password\n6. Click 'Update Password'\n\nFor password reset, use the 'Forgot Password' link on the login page." },
    
    // Account Deletion
    { patterns: [/delete\s+account|remove\s+account|close\s+account/i], answer: "To delete your account:\n1. Log in to your account\n2. Go to Account Settings\n3. Scroll to 'Danger Zone'\n4. Click 'Delete My Account'\n5. Confirm by typing 'DELETE'\n6. Click 'Permanently Delete'\n\n⚠️ Warning: This action cannot be undone. All your data will be permanently removed." },
    
    // Events and Activities
    { patterns: [/events?|upcoming|workshops?/i], answer: "Upcoming events and workshops:\n1. View all events at /events\n2. Filter by category or date\n3. Click on an event for details\n4. Register if required\n5. Add to your calendar\n\nCheck back regularly for updates!" },
    
    // Location and Contact
    { patterns: [/location|where|address|website/i], answer: "Ministry of Innovation and Technology (MinT)\nLocation: Addis Ababa, Ethiopia\nWebsite: https://www.mint.gov.et\nEmail: contact@mint.gov.et\nPhone: +251 11 8 132 191\n\nVisit our website for the most up-to-date contact information." },
  ],
  am: [
    { patterns: [/ስለ\s*ሚንት|ሚንት\s*ማን\s*ነው|የፈጠራ\s*እና\s*ቴክኖሎጂ\s*ሚኒስቴር/i], answer: "የኢትዮጵያ የፈጠራና ቴክኖሎጂ ሚኒስቴር (MinT) ብሔራዊ ፈጠራና ዲጂታላይዜሽን ጥረቶችን ይመራል። ዝርዝር ለመረዳት http://www.mint.gov.et/ ይጎብኙ።" },
    { patterns: [/እውቂያ|ስልክ|ኢሜይል/i], answer: "እውቂያ MinT፦ ስልክ +251 11 8 132 191፣ ኢሜይል contact@mint.gov.et፣ ድር ገፅ https://www.mint.gov.et።" },
    { patterns: [/ሰዓት|ስራ\s*ሰዓት|መክፈቻ/i], answer: "የስራ ሰዓት፦ ሰኞ–አርብ 8:00–17:00 (የአካባቢ ሰዓት)።" },
    { patterns: [/ፕሮግራሞች|አገልግሎቶች|እድሎች/i], answer: "MinT ቴክኖሎጂ ማስተላለፊያ፣ ዲጂታላይዜሽን፣ ሙያ መመሪያ፣ የፋይናንስ ዕድሎች፣ ክስተቶች እና ማረጋገጫ ድጋፍ ይሰጣል።" },
    { patterns: [/ማረጋገጫ|ምንጭ\s*ማረጋገጫ|ኢኖቬተር\s*ማረጋገጫ/i], answer: "እንደ ኢኖቬተር ለመረጋገጥ፦ 1) መገለጫዎ ይሙሉ 2) ፕሮጀክቶች ወይም GitHub ያቀርቡ 3) ዘርፍ ይምረጡ 4) በፖርታሉ ውስጥ ለግምገማ ያስገቡ።" },
    { patterns: [/መመዝገብ|ምዝገባ|አካውንት\s*መፍጠር/i], answer: "መመዝገብ ለማድረግ /register ይጎብኙ። ከዚያ መገለጫዎን ይሙሉ እና ዝግጁ ሲሆኑ ማረጋገጫ ይጀምሩ።" },
    { patterns: [/መግባት|ሎጊን|ኢንተር/i], answer: "ለመግባት /login ይጎብኙ። በኢሜይል/ቁልፍ ወይም በGoogle መግባት ይችላሉ። ከዚያ /app ወይም /admin ይመራሉ።" },
    { patterns: [/ክስተቶች|አስቀድሞ\s*የሚመጡ|upcoming/i], answer: "ቀረበ የክስተት መረጃ ለማየት /events ይጎብኙ።" },
    { patterns: [/አድራሻ|አካባቢ|ድር\s*ገፅ|ዌብሳይት/i], answer: "ድር ገፅ፦ https://www.mint.gov.et። ሚኒስቴሩ በአዲስ አበባ ይገኛል።" },
  ],
  om: [
    { patterns: [/akka\s*ataattii\s*mint|maal\s*dha\s*mint|ministry\s*innovation/i], answer: "Ministeerri Innooveshinii fi Teeknooloojii Itoophiyaa (MinT) innooveeshinii, jijjiirama dijitaalaa fi guddina teeknooloojii tumsaa fi hooggana. Odeeffannoo dabalataa http://www.mint.gov.et/." },
    { patterns: [/qunnamtii|bilbila|imeelii|email|contact/i], answer: "Qunnamtii MinT: Bilbila +251 11 8 132 191, Imeelii contact@mint.gov.et, Website https://www.mint.gov.et." },
    { patterns: [/sa'aatii|yeroo\s*hojii|banaa|cufaa/i], answer: "Sa’aatii hojii: Wiixata–Jimaata 8:00–17:00 (yeroo biyyaalessaa)." },
    { patterns: [/tajaajila|barbaachisummaa|carraa|programs|opportunities/i], answer: "MinT tajaajila teeknooloojii dabarsuu, dijitaala gochuu, gorsaa ogeeyyii, carraa deeggarsa maallaqaa, taateewwan fi ragaa kennuu ni deeggara." },
    { patterns: [/mirkaneessa|verify|ragaa\s*innovator/i], answer: "Mirkaneessa Innovator: 1) Piroofaayilii guutuu 2) Projeektoota/GitHub kenni 3) Kutaa (sector) filadhu 4) Falmii (review)f ergi." },
    { patterns: [/galmaa'uu|register|akkaa\s*account|sign\s*up/i], answer: "Galmee haaraa gochuuf gara /register deemi; booda piroofaayilii guutii fi yeroo qophoofte mirkaneessa dhiheessi." },
    { patterns: [/seenuu|login|sign\s*in/i], answer: "Seenuu /login irratti raawwadhu; email/koodiin ykn Google fayyadami. Itti aansuun gara /app ykn /admin geessamta." },
    { patterns: [/taatee|event|upcoming/i], answer: "Taateewwan (events) dhufan ilaaluuf fuula /events ilaali." },
    { patterns: [/iddoo|eessa|website|saayitii/i], answer: "Website: https://www.mint.gov.et. Ministirichi Finfinnee, Itoophiyaa keessatti argama." },
  ],
};

function matchFAQ(userText: string, lang: Lang): string | null {
  for (const qa of FAQ[lang]) {
    if (qa.patterns.some(r => r.test(userText))) return qa.answer;
  }
  return null;
}

router.post('/', async (req, res) => {
  try {
    const { message, lang: langHint, history = [], context } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required' });
    }

    const lang = detectLang(message, langHint);
    const userMsg = normalizeInput(message);

    // Professional safety filter for offensive/toxic inputs
    const toxicRegex = /(stupid|idiot|selfish|shut up|trash|useless|f\*?ck|bitch|dumb|nonsense|get lost)/i;
    if (toxicRegex.test(userMsg)) {
      const safeByLang: Record<'en'|'am'|'om', string> = {
        en: 'I’m here to help. Please ask a question about verification, projects, funding, or events.',
        am: 'ለርዳታ እዚህ ነኝ። እባክዎ ስለ ማረጋገጫ፣ ፕሮጀክቶች፣ ፋይናንስ ወይም ኢቫንቶች ጥያቄ ይጠይቁ።',
        om: 'Si gargaaruuf as jira. Mirkaneessa, projektoota, deeggarsa ykn eventoota irratti na gaafadhu.'
      };
      return res.json({ answer: safeByLang[lang], sources: [], modelUsed: 'safety', lang });
    }

    // Prepare a compact, safe conversation history block (last 4 turns max)
    const historyBlock = (() => {
      try {
        if (!Array.isArray(history) || history.length === 0) return '';
        
        // Only keep the most recent 4 messages to prevent context overflow
        const recentHistory = history.slice(-4);
        
        // Filter out any empty or invalid messages
        const validHistory = recentHistory.filter((h: any) => {
          const content = String(h?.content || '').trim();
          return content.length > 0;
        });

        // Format the history with clear role indicators
        const formattedHistory = validHistory.map((h: any) => {
          const role = (h?.role === 'assistant' ? 'Assistant' : 'User');
          const content = String(h.content || '').replace(/\s+/g, ' ').trim();
          return `${role}: ${content}`;
        });

        return formattedHistory.length > 0 
          ? `Current conversation context (most recent first):\n${formattedHistory.join('\n')}`
          : '';
      } catch (error) {
        console.error('Error processing chat history:', error);
        return '';
      }
    })();

    // Small-talk first: answer quickly without RAG
    const small = smallTalk(userMsg, lang);
    if (small) {
      return res.json({ answer: small, sources: [], modelUsed: 'small-talk', lang });
    }

    // Multilingual FAQ pass
    const faqAns = matchFAQ(userMsg, lang);
    if (faqAns) {
      return res.json({ answer: faqAns, sources: [{ id: 'local-faq' }], modelUsed: 'faq-local', lang });
    }

    // Quick intent: upcoming events
    const asksUpcoming = /(upcoming|coming up|next|soon).*event|any\s+event(s)?\s+(coming|upcoming|soon)|event\s+schedule|what\s+events\s+are\s+(there|available)/i.test(userMsg);
    if (asksUpcoming) {
      try {
        const events = await db.getEvents({ status: 'published', upcoming: true, limit: 5 });
        if (!events || events.length === 0) {
          const noneMsg = lang === 'am'
            ? 'በአሁኑ ጊዜ የሚመጡ ክስተቶች የሉም። እባክዎ በኋላ ደግሞ ይመልከቱ።'
            : lang === 'om'
              ? 'Ammaaf taateewwan dhufaa hin jiran. Mee booda deebi’itee ilaalaa.'
              : 'There are no upcoming events at the moment. Please check back later.';
          return res.json({
            answer: noneMsg,
            sources: [{ id: 'live-events' }],
            modelUsed: 'live-events',
            lang,
          });
        }
        const formatDate = (d: any) => {
          try { return new Date(d).toLocaleString(); } catch { return String(d); }
        };
        const lines = events.map((e: any, i: number) => {
          const when = e.startDate ? formatDate(e.startDate) : 'TBA';
          const reg = e.registrationOpen ? (e.registrationLink ? `Register: ${e.registrationLink}` : 'Registration open in Events page') : 'Registration closed';
          return `${i + 1}. ${e.title} (${e.type}) — ${when}${e.location ? ` — ${e.location}` : ''}. ${reg}.`;
        });
        const header = (() => {
          if (lang === 'am') return `${events.length === 1 ? 'የሚቀጥለው ክስተት እዚህ አለ' : 'የሚቀጥሉ ክስተቶች እነሆ'}:`;
          if (lang === 'om') return `${events.length === 1 ? 'Taatee itti aanu kana' : 'Taateewwan itti aanan kun'}:`;
          return `Here ${events.length === 1 ? 'is the next upcoming event' : 'are the next upcoming events'}:`;
        })();
        return res.json({
          answer: `${header}\n\n${lines.join('\n')}`,
          sources: [{ id: 'live-events' }],
          modelUsed: 'live-events',
          lang,
        });
      } catch (e) {
        console.warn('Chat upcoming-events query failed, continuing with RAG:', e);
      }
    }

    // Retrieval-Augmented Generation (RAG)
    let topK: any[] = [];
    try {
      // Retrieve top relevant docs/snippets, bias with optional context
      const ragQuery = context && typeof context === 'string' && context.trim()
        ? `${context}\n${userMsg}`
        : userMsg;
      topK = await retrieveTopK(ragQuery, 5);
    } catch (e) {
      console.warn('retrieveTopK failed:', e);
    }

    const lowConfidence = !topK.length || (typeof topK[0]?.score === 'number' && topK[0].score < 0.4);

    // Optional: Google Gemini answer in detected language
    if (process.env.USE_GEMINI === 'true' && process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      try {
        const model = google(process.env.GEMINI_MODEL || 'gemini-1.5-flash');
        const contextBlock = [
          historyBlock,
          context && typeof context === 'string' && context.trim() ? `Context hint:\n${context}` : '',
          portalOverview ? `Portal Overview:\n${portalOverview}` : '',
          ...topK.map(d => `- ${d.text}`),
        ].filter(Boolean).join('\n\n');

        const langName = lang === 'am' ? 'Amharic' : lang === 'om' ? 'Afan Oromo' : 'English';
        const greeting = lang === 'am'
          ? 'በአጭሩ እና በግልጽ ቋንቋ መልሱ።'
          : lang === 'om'
            ? 'Deebii gabaabaa fi ifaa kenni.'
            : 'Answer concisely and clearly.';

        const prompt = (
          lang === 'am'
            ? `እርስዎ የMinT ፖርታል አገልጋይ ነዎት። ለተጠየቀው ጥያቄ በአማርኛ እና ከታች ካለው አውታረ መረጃ ጋር ተያይዞ አጭር መልስ ይስጡ።\n\n${contextBlock}\n\nUser question:\n${message}\n\n${greeting}`
              : lang === 'om'
              ? `Ati tajaajila MinT Portal tajaajilaa. Gaaffii itti aanu kana akkaataa macaa fi haala armaan gadii irratti hundaa'uun Afaan Oromoo deebii gabaabaa kenni.\n\n${contextBlock}\n\nUser question:\n${message}\n\n${greeting}`
              : `You are the MinT Portal assistant. Using the context below (history, hint, docs), answer concisely in English with accurate portal guidance.\n\n${contextBlock}\n\nUser question:\n${message}\n\n${greeting}`
        );

        const { text } = await generateText({ model, prompt });
        return res.json({
          answer: text,
          sources: topK.map(d => ({ id: d.id, score: d.score, meta: d.meta })),
          modelUsed: 'gemini',
          lang,
        });
      } catch (e) {
        console.error('Gemini (Vercel AI SDK) call failed, falling back to RAG answer:', e);
      }
    }

    // Fallback: Return best RAG/overview answer
    const best = topK[0] || { text: '' };
    const overviewIntro = (() => {
      if (lang === 'am') {
        return 'ከፖርታሉ አጠቃላይ መመሪያ የተመረጡ አጠቃላይ እርምጃዎች እነሆ። ከተጠበቀው እርምጃ ካልተገኘ የመንገዱ ሁኔታ ወይም የማረጋገጫ ሁኔታዎ ላይ ሊያስተካክል ይችላል።';
      }
      if (lang === 'om') {
        return 'Kana jechuun, gorsa waliigalaa kan Fuula Ijoon (overview) irraa fudhatame. Yoo wanti eeggattan hin mulʼanne, hayyama account keessanii ykn haala mirkaneessii irratti hundaaʼee taʼuu dandaʼa.';
      }
      return "Here are general steps based on the portal overview. If you don't see the expected action, it may depend on your account permissions or verification status.";
    })();

    const wrappedDocAnswer = (() => {
      const docAns = extractAnswer(best.text);
      if (lang === 'am') {
        return `መልስ (ከሰነድ የተመረጠ):\n\n${docAns}`;
      }
      if (lang === 'om') {
        return `Deebii (maddeen irraa filatame):\n\n${docAns}`;
      }
      return docAns;
    })();

    const conciseFallbackByLang: Record<'en'|'am'|'om', string> = {
      en: 'Please rephrase with more detail (e.g., “how to verify”, “create project”, “upcoming events”).',
      am: 'እባክዎን በዝርዝር ይግለጹ (ምሳሌ፡ “እንዴት ልረጋገጥ”, “ፕሮጀክት መፍጠር”, “ቀረባ ኢቫንቶች”).',
      om: 'Ilaalcha balʼinaan ibsi (fakkeenyaaf: “akkamitti mirkanaaʼa”, “projekt uumuu”, “eventoota dhufu”).'
    };

    const answer = isGreeting(userMsg)
      ? friendlyWelcome(lang)
      : lowConfidence
        ? conciseFallbackByLang[lang]
        : wrappedDocAnswer;
    return res.json({
      answer,
      sources: [
        ...(portalOverview ? [{ id: 'portal-overview' as const }] : []),
        ...topK.map(d => ({ id: d.id, score: d.score, meta: d.meta })),
      ],
      modelUsed: 'faq',
      lang,
    });
  } catch (err: any) {
    console.error('Chat route error:', err);
    res.status(500).json({ error: 'Chat processing failed' });
  }
});

export default router;
