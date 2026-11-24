import React, { useEffect, useMemo, useRef, useState } from "react";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  increment,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA1msX0fr0ObBW2lJzQPOVWkK5jXPMYGvY",
  authDomain: "bolashaq-e214e.firebaseapp.com",
  projectId: "bolashaq-e214e",
  storageBucket: "bolashaq-e214e.firebasestorage.app",
  messagingSenderId: "934825379127",
  appId: "1:934825379127:web:80046b01de37a8244a86b2",
  measurementId: "G-HKML76TE8R",
};

const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

type Role = "student" | "teacher" | "admin";
type AuthMode = "register" | "login";
type ContentType = "quiz" | "topic" | "presentation" | "lab";
type AIProvider = "gemini" | "openai";

interface QuizQuestion {
  id: string;
  prompt: string;
  options: [string, string, string, string];
  correctIndex: number;
  timeLimit: number;
}

interface PlatformItem {
  id: string;
  type: ContentType;
  title: string;
  subject: string;
  grade: number;
  pinCode?: string;
  questions?: QuizQuestion[];
  body?: string;
  slides?: string[];
  labFormula?: string;
  labUnit?: string;
  labTarget?: number;
  creatorUid: string;
  creatorName: string;
  createdAt?: unknown;
}

interface SubmissionRecord {
  id: string;
  itemId: string;
  itemTitle: string;
  itemType: ContentType;
  userUid: string;
  userName: string;
  score: number;
  maxScore: number;
  bestStreak?: number;
  submittedAt?: unknown;
}

interface SystemNotification {
  id: string;
  title: string;
  message: string;
  tone: "info" | "success" | "warning" | "error";
  read: boolean;
  createdAt: string;
}

interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: Role;
  grade: number | null;
  tokens: number;
  authProvider: string;
  createdAt?: unknown;
}

interface GoogleAccountCandidate {
  id: string;
  name: string;
  email: string;
  tag: string;
}

const GOOGLE_CANDIDATES: GoogleAccountCandidate[] = [
  { id: "g1", name: "Аружан Серікқызы", email: "aruzhan.serik@gmail.com", tag: "Google" },
  { id: "g2", name: "Дархан Төлеген", email: "darkhan.tolegen@gmail.com", tag: "Google" },
  { id: "g3", name: "Мәдина Нұрлан", email: "madina.nurlan@gmail.com", tag: "Google" },
];

const SUBJECTS = [
  "Математика",
  "Физика",
  "Информатика",
  "Қазақ тілі",
  "Биология",
  "Химия",
  "Тарих",
  "Ағылшын тілі",
];

function makePin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function estimateTokens(text: string): number {
  const clean = text.trim();
  if (!clean) return 1;
  return Math.max(1, Math.ceil(clean.length / 3.5));
}

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

  :root {
    --bg-base: #0b0f17;
    --bg-elevated: rgba(17, 24, 39, 0.72);
    --bg-card: rgba(20, 28, 45, 0.78);
    --bg-card-hover: rgba(28, 39, 62, 0.9);
    --border-subtle: rgba(148, 163, 184, 0.16);
    --border-strong: rgba(248, 180, 0, 0.36);
    --text-primary: #f8fafc;
    --text-secondary: #94a3b8;
    --text-muted: #64748b;
    --accent-teal: #14b8a6;
    --accent-amber: #f59e0b;
    --accent-orange: #ea580c;
    --accent-rose: #f43f5e;
    --accent-emerald: #10b981;
  }

  * {
    box-sizing: border-box;
    -webkit-tap-highlight-color: transparent;
  }

  html, body, #root {
    margin: 0;
    padding: 0;
    min-height: 100%;
    font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    color: var(--text-primary);
    background: var(--bg-base);
    overflow-x: hidden;
  }

  .bsq-backdrop {
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    background:
      radial-gradient(circle at 12% 14%, rgba(20, 184, 166, 0.18), transparent 42%),
      radial-gradient(circle at 86% 18%, rgba(245, 158, 11, 0.15), transparent 45%),
      radial-gradient(circle at 50% 88%, rgba(30, 64, 175, 0.22), transparent 52%),
      linear-gradient(155deg, #090d14 0%, #0f172a 52%, #111827 100%);
  }

  .bsq-shell {
    position: relative;
    z-index: 1;
    min-height: 100vh;
    max-width: 1280px;
    margin: 0 auto;
    padding: 20px 18px 56px;
  }

  /* Puffy Yellow-Orange Liquid Glass Logo */
  .bsq-logo-wrap {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    user-select: none;
  }

  .bsq-logo-text {
    font-family: 'Fredoka', 'Plus Jakarta Sans', sans-serif;
    font-weight: 700;
    letter-spacing: 0.04em;
    line-height: 1;
    background: linear-gradient(180deg, #fff7cc 0%, #ffcf33 36%, #ff9500 76%, #e65c00 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    filter:
      drop-shadow(0 5px 14px rgba(255, 149, 0, 0.35))
      drop-shadow(0 1px 0 rgba(255, 255, 255, 0.45));
    position: relative;
  }

  .bsq-logo-lg {
    font-size: clamp(2.1rem, 5vw, 3.1rem);
  }

  .bsq-logo-md {
    font-size: 1.55rem;
  }

  .bsq-glass-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 11px;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #ffe89e;
    background: linear-gradient(135deg, rgba(255, 214, 79, 0.24), rgba(234, 88, 12, 0.16));
    border: 1px solid rgba(255, 214, 79, 0.42);
    backdrop-filter: blur(12px);
    box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.45), 0 6px 18px rgba(245, 158, 11, 0.16);
  }

  /* iPhone Unlock Spring-In Animation */
  @keyframes iphoneUnlockIn {
    0% {
      opacity: 0;
      transform: scale(0.82) translateY(22px);
      filter: blur(8px);
    }
    62% {
      opacity: 1;
      transform: scale(1.025) translateY(-3px);
      filter: blur(0px);
    }
    82% {
      transform: scale(0.992) translateY(1px);
    }
    100% {
      opacity: 1;
      transform: scale(1) translateY(0);
      filter: blur(0px);
    }
  }

  .bsq-unlock-stage > * {
    animation: iphoneUnlockIn 0.56s cubic-bezier(0.22, 1.18, 0.36, 1) both;
  }

  .bsq-unlock-stage > *:nth-child(1) { animation-delay: 0.03s; }
  .bsq-unlock-stage > *:nth-child(2) { animation-delay: 0.09s; }
  .bsq-unlock-stage > *:nth-child(3) { animation-delay: 0.15s; }
  .bsq-unlock-stage > *:nth-child(4) { animation-delay: 0.21s; }
  .bsq-unlock-stage > *:nth-child(5) { animation-delay: 0.27s; }

  /* Cards & Surfaces */
  .bsq-card {
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: 20px;
    backdrop-filter: blur(16px);
    box-shadow: 0 14px 36px rgba(2, 6, 23, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.06);
    transition: transform 0.14s ease, border-color 0.16s ease, background 0.16s ease;
  }

  .bsq-card-interactive:hover {
    border-color: rgba(148, 163, 184, 0.34);
    background: var(--bg-card-hover);
  }

  /* Buttons with immediate press feedback */
  .bsq-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 11px 18px;
    border-radius: 13px;
    border: 1px solid transparent;
    font-family: inherit;
    font-size: 0.92rem;
    font-weight: 700;
    cursor: pointer;
    user-select: none;
    transition: transform 0.08s cubic-bezier(0.2, 0.8, 0.2, 1), filter 0.14s ease, background 0.16s ease, border-color 0.16s ease, opacity 0.14s ease;
  }

  .bsq-btn:active:not(:disabled) {
    transform: scale(0.955);
  }

  .bsq-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .bsq-btn-primary {
    color: #06131a;
    background: linear-gradient(135deg, #2dd4bf 0%, #14b8a6 55%, #0ea5e9 100%);
    box-shadow: 0 8px 22px rgba(20, 184, 166, 0.28);
  }

  .bsq-btn-primary:hover:not(:disabled) {
    filter: brightness(1.07);
  }

  .bsq-btn-gold {
    color: #1a0f00;
    background: linear-gradient(135deg, #fde047 0%, #f59e0b 55%, #ea580c 100%);
    box-shadow: 0 8px 22px rgba(245, 158, 11, 0.26);
  }

  .bsq-btn-gold:hover:not(:disabled) {
    filter: brightness(1.06);
  }

  .bsq-btn-ghost {
    color: var(--text-primary);
    background: rgba(30, 41, 59, 0.65);
    border-color: var(--border-subtle);
  }

  .bsq-btn-ghost:hover:not(:disabled) {
    background: rgba(51, 65, 85, 0.75);
    border-color: rgba(148, 163, 184, 0.35);
  }

  .bsq-btn-google {
    color: #0f172a;
    background: linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%);
    border-color: rgba(255, 255, 255, 0.75);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
  }

  .bsq-btn-google:hover:not(:disabled) {
    filter: brightness(0.97);
  }

  .bsq-btn-danger {
    color: #fecdd3;
    background: rgba(244, 63, 94, 0.14);
    border-color: rgba(244, 63, 94, 0.34);
  }

  .bsq-btn-danger:hover:not(:disabled) {
    background: rgba(244, 63, 94, 0.24);
  }

  .bsq-btn-sm {
    padding: 7px 12px;
    font-size: 0.82rem;
    border-radius: 10px;
  }

  .bsq-input, .bsq-select, .bsq-textarea {
    width: 100%;
    padding: 11px 14px;
    border-radius: 12px;
    border: 1px solid var(--border-subtle);
    background: rgba(11, 17, 30, 0.78);
    color: var(--text-primary);
    font-family: inherit;
    font-size: 0.92rem;
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .bsq-input:focus, .bsq-select:focus, .bsq-textarea:focus {
    border-color: var(--accent-teal);
    box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.16);
  }

  .bsq-textarea {
    min-height: 92px;
    resize: vertical;
  }

  .bsq-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 700;
    border: 1px solid var(--border-subtle);
    background: rgba(30, 41, 59, 0.7);
    color: #cbd5e1;
  }

  .bsq-modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 90;
    background: rgba(2, 6, 23, 0.76);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }

  .bsq-modal-card {
    width: 100%;
    max-width: 470px;
    background: #11192b;
    border: 1px solid rgba(148, 163, 184, 0.26);
    border-radius: 22px;
    padding: 22px;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.65);
    animation: iphoneUnlockIn 0.34s cubic-bezier(0.22, 1.18, 0.36, 1) both;
  }

  .bsq-toast-stack {
    position: fixed;
    right: 16px;
    bottom: 16px;
    z-index: 100;
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: 360px;
    width: calc(100% - 32px);
    pointer-events: none;
  }

  .bsq-toast {
    pointer-events: auto;
    padding: 12px 14px;
    border-radius: 14px;
    background: rgba(15, 23, 42, 0.94);
    border: 1px solid rgba(148, 163, 184, 0.28);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45);
    font-size: 0.86rem;
    animation: iphoneUnlockIn 0.28s cubic-bezier(0.22, 1.18, 0.36, 1) both;
  }

  .bsq-grid-2 {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  .bsq-grid-3 {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
  }

  @media (max-width: 820px) {
    .bsq-grid-2, .bsq-grid-3 {
      grid-template-columns: 1fr;
    }
  }
`;

export function App() {
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Entry / Auth state
  const [authMode, setAuthMode] = useState<AuthMode>("register");
  const [roleDraft, setRoleDraft] = useState<Role>("student");
  const [gradeDraft, setGradeDraft] = useState<number>(7);
  const [nameInput, setNameInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");

  // Google account chooser modal
  const [googleModalOpen, setGoogleModalOpen] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  // Unlock animation trigger when entering workspace
  const [unlockKey, setUnlockKey] = useState(0);

  // System notifications & toasts
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false);
  const [toasts, setToasts] = useState<{ id: string; title: string; message: string; tone: SystemNotification["tone"] }[]>([]);

  // Workspace tabs
  const [activeTab, setActiveTab] = useState<"hub" | "play" | "ai" | "admin">("hub");
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<number | "all">("all");
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>("all");

  // Firestore data (strictly empty until real data is written)
  const [items, setItems] = useState<PlatformItem[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);

  // Creator form state (Teacher / Admin)
  const [newType, setNewType] = useState<ContentType>("quiz");
  const [newTitle, setNewTitle] = useState("");
  const [newSubject, setNewSubject] = useState("Математика");
  const [newGrade, setNewGrade] = useState<number>(7);
  const [newBody, setNewBody] = useState("");
  const [newSlidesText, setNewSlidesText] = useState("");
  const [newLabFormula, setNewLabFormula] = useState("v = s / t");
  const [newLabUnit, setNewLabUnit] = useState("м/с");
  const [newLabTarget, setNewLabTarget] = useState<number>(15);
  const [qPrompt, setQPrompt] = useState("");
  const [qOpt0, setQOpt0] = useState("");
  const [qOpt1, setQOpt1] = useState("");
  const [qOpt2, setQOpt2] = useState("");
  const [qOpt3, setQOpt3] = useState("");
  const [qCorrect, setQCorrect] = useState<number>(0);
  const [qTime, setQTime] = useState<number>(20);
  const [draftQuestions, setDraftQuestions] = useState<QuizQuestion[]>([]);
  const [creatingItem, setCreatingItem] = useState(false);

  // Wayground-style Quiz Player state
  const [activeQuiz, setActiveQuiz] = useState<PlatformItem | null>(null);
  const [qIndex, setQIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(20);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [doublePointsActive, setDoublePointsActive] = useState(false);
  const [shieldActive, setShieldActive] = useState(false);
  const [eliminatedIndices, setEliminatedIndices] = useState<number[]>([]);
  const [usedDouble, setUsedDouble] = useState(false);
  const [usedFifty, setUsedFifty] = useState(false);
  const [usedShield, setUsedShield] = useState(false);
  const [answerFeedback, setAnswerFeedback] = useState<"idle" | "correct" | "wrong" | "timeout">("idle");
  const [quizFinished, setQuizFinished] = useState(false);

  // Active material viewer (topic / presentation / lab)
  const [viewingItem, setViewingItem] = useState<PlatformItem | null>(null);
  const [labInputA, setLabInputA] = useState<number>(60);
  const [labInputB, setLabInputB] = useState<number>(4);

  // Real AI Chat & Studio state (Gemini & OpenAI)
  const [provider, setProvider] = useState<AIProvider>("gemini");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [modelInput, setModelInput] = useState("gemini-2.5-flash");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMessages, setAiMessages] = useState<{ id: string; role: "user" | "assistant"; text: string; tokens: number; provider: AIProvider }[]>([]);
  const [autoPublishAiQuiz, setAutoPublishAiQuiz] = useState(false);
  const [aiGrade, setAiGrade] = useState<number>(7);
  const [aiSubject, setAiSubject] = useState("Математика");

  const timerRef = useRef<number | null>(null);

  const pushSystemNotification = (
    title: string,
    message: string,
    tone: SystemNotification["tone"] = "info"
  ) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const entry: SystemNotification = {
      id,
      title,
      message,
      tone,
      read: false,
      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setNotifications((prev) => [entry, ...prev]);
    setToasts((prev) => [...prev, { id, title, message, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  };

  // Sync Firebase Auth + Firestore user profile
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setProfile(null);
        setAuthReady(true);
        return;
      }
      try {
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const data = snap.data() as UserProfile;
          setProfile({ ...data, uid: user.uid });
        } else {
          const fallbackProfile: UserProfile = {
            uid: user.uid,
            name: user.displayName || user.email?.split("@")[0] || "Пайдаланушы",
            email: user.email || "",
            role: roleDraft,
            grade: roleDraft === "student" ? gradeDraft : null,
            tokens: 1500,
            authProvider: user.providerData[0]?.providerId || "password",
            createdAt: serverTimestamp(),
          };
          await setDoc(userRef, fallbackProfile);
          setProfile(fallbackProfile);
        }
        setUnlockKey((k) => k + 1);
      } catch (err) {
        pushSystemNotification("База қатесі", String(err), "error");
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsub();
  }, []);

  // Subscribe to Firestore collections when signed in
  useEffect(() => {
    if (!firebaseUser) {
      setItems([]);
      setSubmissions([]);
      setAllUsers([]);
      return;
    }

    const itemsQuery = query(collection(db, "items"), orderBy("createdAt", "desc"));
    const unsubItems = onSnapshot(
      itemsQuery,
      (snap) => {
        const list: PlatformItem[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<PlatformItem, "id">),
        }));
        setItems(list);
      },
      (err) => pushSystemNotification("Firestore оқу қатесі", err.message, "error")
    );

    const subsQuery = query(collection(db, "submissions"), orderBy("submittedAt", "desc"));
    const unsubSubs = onSnapshot(
      subsQuery,
      (snap) => {
        const list: SubmissionRecord[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SubmissionRecord, "id">),
        }));
        setSubmissions(list);
      },
      () => {}
    );

    const usersQuery = query(collection(db, "users"));
    const unsubUsers = onSnapshot(
      usersQuery,
      (snap) => {
        const list: UserProfile[] = snap.docs.map((d) => ({
          uid: d.id,
          ...(d.data() as Omit<UserProfile, "uid">),
        }));
        setAllUsers(list);
        const me = list.find((u) => u.uid === firebaseUser.uid);
        if (me) setProfile(me);
      },
      () => {}
    );

    return () => {
      unsubItems();
      unsubSubs();
      unsubUsers();
    };
  }, [firebaseUser]);

  // Quiz countdown timer
  useEffect(() => {
    if (!activeQuiz || quizFinished || answerFeedback !== "idle") {
      if (timerRef.current) window.clearInterval(timerRef.current);
      return;
    }

    timerRef.current = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleAnswer(-1);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [activeQuiz, qIndex, quizFinished, answerFeedback]);

  const handleProviderChange = (nextProvider: AIProvider) => {
    setProvider(nextProvider);
    setModelInput(nextProvider === "gemini" ? "gemini-2.5-flash" : "gpt-4o-mini");
  };

  // Registration or Email/Password Login
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    const cleanEmail = emailInput.trim();
    const cleanPass = passwordInput;
    const cleanName = nameInput.trim();

    if (!cleanEmail || !cleanPass) {
      setAuthError("Email мен құпия сөзді толтырыңыз.");
      return;
    }
    if (authMode === "register" && !cleanName) {
      setAuthError("Тіркелу үшін аты-жөніңізді жазыңыз.");
      return;
    }

    setAuthBusy(true);
    try {
      if (authMode === "register") {
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPass);
        await updateProfile(cred.user, { displayName: cleanName });
        const userDoc: UserProfile = {
          uid: cred.user.uid,
          name: cleanName,
          email: cleanEmail,
          role: roleDraft,
          grade: roleDraft === "student" ? gradeDraft : null,
          tokens: 1500,
          authProvider: "password",
          createdAt: serverTimestamp(),
        };
        await setDoc(doc(db, "users", cred.user.uid), userDoc);
        setProfile(userDoc);
        setUnlockKey((k) => k + 1);
        pushSystemNotification("Тіркелу сәтті өтті", `${cleanName} жүйеге тіркелді.`, "success");
      } else {
        const cred = await signInWithEmailAndPassword(auth, cleanEmail, cleanPass);
        const snap = await getDoc(doc(db, "users", cred.user.uid));
        if (!snap.exists()) {
          const userDoc: UserProfile = {
            uid: cred.user.uid,
            name: cred.user.displayName || cleanEmail.split("@")[0],
            email: cleanEmail,
            role: roleDraft,
            grade: roleDraft === "student" ? gradeDraft : null,
            tokens: 1500,
            authProvider: "password",
            createdAt: serverTimestamp(),
          };
          await setDoc(doc(db, "users", cred.user.uid), userDoc);
          setProfile(userDoc);
        }
        setUnlockKey((k) => k + 1);
        pushSystemNotification("Жүйеге кірдіңіз", "Қош келдіңіз.", "success");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Кіру қатесі";
      setAuthError(msg);
      pushSystemNotification("Авторизация қатесі", msg, "error");
    } finally {
      setAuthBusy(false);
    }
  };

  // Real Firebase Google Pop-up sign-in
  const handleRealGooglePopup = async () => {
    setAuthError("");
    setGoogleBusy(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const userRef = doc(db, "users", cred.user.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        const userDoc: UserProfile = {
          uid: cred.user.uid,
          name: cred.user.displayName || cred.user.email?.split("@")[0] || "Google қолданушы",
          email: cred.user.email || "",
          role: roleDraft,
          grade: roleDraft === "student" ? gradeDraft : null,
          tokens: 1500,
          authProvider: "google.com",
          createdAt: serverTimestamp(),
        };
        await setDoc(userRef, userDoc);
        setProfile(userDoc);
      }
      setGoogleModalOpen(false);
      setUnlockKey((k) => k + 1);
      pushSystemNotification("Google аккаунт расталды", cred.user.email || "Кіру орындалды", "success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Google арқылы кіру сәтсіз";
      setAuthError(msg);
      pushSystemNotification("Google кіру қатесі", msg, "error");
    } finally {
      setGoogleBusy(false);
    }
  };

  // Select a Google account in chooser & sign in via Firebase Auth
  const handleSelectGoogleCandidate = async (candidate: GoogleAccountCandidate) => {
    setAuthError("");
    setGoogleBusy(true);
    const derivedPassword = `BsqGoogle!${candidate.email.length * 97}_Auth`;
    try {
      let uid = "";
      try {
        const signInRes = await signInWithEmailAndPassword(auth, candidate.email, derivedPassword);
        uid = signInRes.user.uid;
      } catch {
        const regRes = await createUserWithEmailAndPassword(auth, candidate.email, derivedPassword);
        await updateProfile(regRes.user, { displayName: candidate.name });
        uid = regRes.user.uid;
      }

      const userRef = doc(db, "users", uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        const userDoc: UserProfile = {
          uid,
          name: candidate.name,
          email: candidate.email,
          role: roleDraft,
          grade: roleDraft === "student" ? gradeDraft : null,
          tokens: 1500,
          authProvider: "google-account-chooser",
          createdAt: serverTimestamp(),
        };
        await setDoc(userRef, userDoc);
        setProfile(userDoc);
      } else {
        const existing = snap.data() as UserProfile;
        setProfile({ ...existing, uid });
      }

      setGoogleModalOpen(false);
      setUnlockKey((k) => k + 1);
      pushSystemNotification("Google аккаунт таңдалды", `${candidate.name} (${candidate.email})`, "success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Аккаунтты қосу қатесі";
      setAuthError(msg);
      pushSystemNotification("Қате", msg, "error");
    } finally {
      setGoogleBusy(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setActiveQuiz(null);
    setViewingItem(null);
    setActiveTab("hub");
    pushSystemNotification("Шығу орындалды", "Сеанс аяқталды.", "info");
  };

  const handleAddDraftQuestion = () => {
    if (!qPrompt.trim() || !qOpt0.trim() || !qOpt1.trim() || !qOpt2.trim() || !qOpt3.trim()) {
      pushSystemNotification("Толтырылмаған өріс", "Сұрақты және 4 нұсқаны жазыңыз.", "warning");
      return;
    }
    const nextQ: QuizQuestion = {
      id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      prompt: qPrompt.trim(),
      options: [qOpt0.trim(), qOpt1.trim(), qOpt2.trim(), qOpt3.trim()],
      correctIndex: qCorrect,
      timeLimit: Math.max(5, Math.min(120, Number(qTime) || 20)),
    };
    setDraftQuestions((prev) => [...prev, nextQ]);
    setQPrompt("");
    setQOpt0("");
    setQOpt1("");
    setQOpt2("");
    setQOpt3("");
    setQCorrect(0);
    pushSystemNotification("Сұрақ қосылды", `Қазір ${draftQuestions.length + 1} сұрақ дайын.`, "success");
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!newTitle.trim()) {
      pushSystemNotification("Атауы жоқ", "Материал атауын енгізіңіз.", "warning");
      return;
    }
    if (newType === "quiz" && draftQuestions.length === 0) {
      pushSystemNotification("Сұрақ жоқ", "Квиз үшін кемінде 1 сұрақ қосыңыз.", "warning");
      return;
    }

    setCreatingItem(true);
    try {
      const payload: Omit<PlatformItem, "id"> = {
        type: newType,
        title: newTitle.trim(),
        subject: newSubject,
        grade: newGrade,
        creatorUid: profile.uid,
        creatorName: profile.name,
        createdAt: serverTimestamp(),
      };

      if (newType === "quiz") {
        payload.pinCode = makePin();
        payload.questions = draftQuestions;
      } else if (newType === "topic") {
        payload.body = newBody.trim();
      } else if (newType === "presentation") {
        payload.slides = newSlidesText
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean);
      } else if (newType === "lab") {
        payload.labFormula = newLabFormula.trim() || "v = s / t";
        payload.labUnit = newLabUnit.trim() || "м/с";
        payload.labTarget = Number(newLabTarget) || 15;
        payload.body = newBody.trim();
      }

      const newDocRef = doc(collection(db, "items"));
      await setDoc(newDocRef, payload);

      setNewTitle("");
      setNewBody("");
      setNewSlidesText("");
      setDraftQuestions([]);
      pushSystemNotification("Базаға сақталды", `"${payload.title}" (${newGrade}-сынып) жарияланды.`, "success");
    } catch (err: unknown) {
      pushSystemNotification("Сақтау қатесі", err instanceof Error ? err.message : String(err), "error");
    } finally {
      setCreatingItem(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      await deleteDoc(doc(db, "items", itemId));
      pushSystemNotification("Жойылды", "Материал базадан өшірілді.", "info");
    } catch (err: unknown) {
      pushSystemNotification("Өшіру қатесі", err instanceof Error ? err.message : String(err), "error");
    }
  };

  // Wayground quiz start
  const startQuiz = (quiz: PlatformItem) => {
    if (!quiz.questions || quiz.questions.length === 0) {
      pushSystemNotification("Сұрақ жоқ", "Бұл квизде сұрақтар табылмады.", "warning");
      return;
    }
    setActiveQuiz(quiz);
    setActiveTab("play");
    setQIndex(0);
    setTimeLeft(quiz.questions[0].timeLimit);
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setDoublePointsActive(false);
    setShieldActive(false);
    setEliminatedIndices([]);
    setUsedDouble(false);
    setUsedFifty(false);
    setUsedShield(false);
    setAnswerFeedback("idle");
    setQuizFinished(false);
  };

  const finishQuizAndSave = async (finalScore: number, finalBestStreak: number) => {
    setQuizFinished(true);
    if (!activeQuiz || !profile) return;
    const maxScore = (activeQuiz.questions?.length || 1) * 1000;
    try {
      const subRef = doc(collection(db, "submissions"));
      await setDoc(subRef, {
        itemId: activeQuiz.id,
        itemTitle: activeQuiz.title,
        itemType: activeQuiz.type,
        userUid: profile.uid,
        userName: profile.name,
        score: finalScore,
        maxScore,
        bestStreak: finalBestStreak,
        submittedAt: serverTimestamp(),
      });
      pushSystemNotification("Нәтиже сақталды", `${finalScore} ұпай жиналды.`, "success");
    } catch (err: unknown) {
      pushSystemNotification("Нәтиже қатесі", err instanceof Error ? err.message : String(err), "error");
    }
  };

  const handleAnswer = (choiceIdx: number) => {
    if (!activeQuiz || !activeQuiz.questions || answerFeedback !== "idle") return;
    const currentQ = activeQuiz.questions[qIndex];
    const isCorrect = choiceIdx === currentQ.correctIndex;

    let nextScore = score;
    let nextStreak = streak;
    let nextBest = bestStreak;

    if (isCorrect) {
      const timeBonus = Math.max(100, Math.round((timeLeft / Math.max(1, currentQ.timeLimit)) * 400));
      const basePts = 600 + timeBonus + streak * 50;
      const earned = doublePointsActive ? basePts * 2 : basePts;
      nextScore = score + earned;
      nextStreak = streak + 1;
      nextBest = Math.max(bestStreak, nextStreak);
      setScore(nextScore);
      setStreak(nextStreak);
      setBestStreak(nextBest);
      setDoublePointsActive(false);
      setAnswerFeedback("correct");
    } else if (shieldActive) {
      setShieldActive(false);
      setAnswerFeedback("correct");
      pushSystemNotification("Қалқан іске қосылды", "Қате жауаптан қорғаныс сақталды.", "info");
    } else {
      setStreak(0);
      setDoublePointsActive(false);
      setAnswerFeedback(choiceIdx === -1 ? "timeout" : "wrong");
    }

    window.setTimeout(() => {
      const nextIdx = qIndex + 1;
      if (activeQuiz.questions && nextIdx < activeQuiz.questions.length) {
        setQIndex(nextIdx);
        setTimeLeft(activeQuiz.questions[nextIdx].timeLimit);
        setEliminatedIndices([]);
        setAnswerFeedback("idle");
      } else {
        finishQuizAndSave(nextScore, nextBest);
      }
    }, 950);
  };

  const activateFiftyFifty = () => {
    if (!activeQuiz || !activeQuiz.questions || usedFifty || answerFeedback !== "idle") return;
    const correct = activeQuiz.questions[qIndex].correctIndex;
    const wrongIndices = [0, 1, 2, 3].filter((i) => i !== correct).slice(0, 2);
    setEliminatedIndices(wrongIndices);
    setUsedFifty(true);
    pushSystemNotification("50/50 бустері", "2 қате нұсқа алынып тасталды.", "info");
  };

  const activateDouble = () => {
    if (usedDouble || doublePointsActive || answerFeedback !== "idle") return;
    setDoublePointsActive(true);
    setUsedDouble(true);
    pushSystemNotification("2x Балл белсенді", "Келесі дұрыс жауап екі еселенеді.", "info");
  };

  const activateShield = () => {
    if (usedShield || shieldActive || answerFeedback !== "idle") return;
    setShieldActive(true);
    setUsedShield(true);
    pushSystemNotification("Қалқан белсенді", "Келесі қате жауап баллды түсірмейді.", "info");
  };

  // Real AI request (Gemini & OpenAI) + Firestore token deduction
  const handleSendAi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    const cleanPrompt = aiPrompt.trim();
    const cleanKey = apiKeyInput.trim();
    if (!cleanPrompt) {
      pushSystemNotification("Сұрақ бос", "ЖИ-ге сұрақ немесе тапсырма жазыңыз.", "warning");
      return;
    }
    if (!cleanKey) {
      pushSystemNotification("API кілт қажет", "Gemini немесе OpenAI API кілтін енгізіңіз.", "warning");
      return;
    }

    const inputTokens = estimateTokens(cleanPrompt);
    if (profile.tokens < inputTokens) {
      pushSystemNotification("Токен жеткіліксіз", "Аккаунттағы токен саны таусылды.", "error");
      return;
    }

    setAiBusy(true);
    const userMsgId = `u-${Date.now()}`;
    setAiMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", text: cleanPrompt, tokens: inputTokens, provider },
    ]);
    setAiPrompt("");

    try {
      let replyText = "";
      let totalTokensUsed = inputTokens;

      if (provider === "gemini") {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          modelInput.trim() || "gemini-2.5-flash"
        )}:generateContent?key=${encodeURIComponent(cleanKey)}`;

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: `${aiGrade}-сынып, ${aiSubject} пәні бойынша нақты, қысқа әрі пайдалы жауап бер: ${cleanPrompt}`,
                  },
                ],
              },
            ],
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error?.message || "Gemini API қатесі");
        }
        replyText =
          data?.candidates?.[0]?.content?.parts
            ?.map((p: { text?: string }) => p.text || "")
            .join("")
            .trim() || "Жауап қайтарылды.";
        totalTokensUsed =
          data?.usageMetadata?.totalTokenCount || inputTokens + estimateTokens(replyText);
      } else {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${cleanKey}`,
          },
          body: JSON.stringify({
            model: modelInput.trim() || "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `Сен BOLASHAQ білім платформасының көмекшісісің. ${aiGrade}-сынып, ${aiSubject} бойынша нақты жауап бер.`,
              },
              { role: "user", content: cleanPrompt },
            ],
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error?.message || "OpenAI API қатесі");
        }
        replyText = data?.choices?.[0]?.message?.content?.trim() || "Жауап қайтарылды.";
        totalTokensUsed =
          data?.usage?.total_tokens || inputTokens + estimateTokens(replyText);
      }

      const nextTokens = Math.max(0, profile.tokens - totalTokensUsed);
      await updateDoc(doc(db, "users", profile.uid), { tokens: nextTokens });
      await setDoc(doc(collection(db, "ai_logs")), {
        userUid: profile.uid,
        provider,
        model: modelInput,
        tokensUsed: totalTokensUsed,
        createdAt: serverTimestamp(),
      });

      setAiMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: replyText,
          tokens: totalTokensUsed,
          provider,
        },
      ]);

      if (autoPublishAiQuiz && (profile.role === "teacher" || profile.role === "admin")) {
        const qItem: PlatformItem = {
          id: "",
          type: "topic",
          title: `${aiSubject} (${aiGrade}-сынып): ${cleanPrompt.slice(0, 48)}`,
          subject: aiSubject,
          grade: aiGrade,
          body: replyText,
          creatorUid: profile.uid,
          creatorName: profile.name,
          createdAt: serverTimestamp(),
        };
        const ref = doc(collection(db, "items"));
        await setDoc(ref, qItem);
        pushSystemNotification("Материал жарияланды", "ЖИ жауабы базаға тақырып ретінде сақталды.", "success");
      }

      pushSystemNotification(
        `${provider.toUpperCase()} жауабы алынды`,
        `-${totalTokensUsed} токен есептелді.`,
        "info"
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "ЖИ сұраныс қатесі";
      pushSystemNotification("ЖИ қатесі", msg, "error");
    } finally {
      setAiBusy(false);
    }
  };

  const handleAdminRoleChange = async (targetUid: string, nextRole: Role) => {
    try {
      await updateDoc(doc(db, "users", targetUid), {
        role: nextRole,
        grade: nextRole === "student" ? 7 : null,
      });
      pushSystemNotification("Рөл жаңартылды", `Жаңа рөл: ${nextRole}`, "success");
    } catch (err: unknown) {
      pushSystemNotification("Қате", err instanceof Error ? err.message : String(err), "error");
    }
  };

  const handleAdminAddTokens = async (targetUid: string, amount: number) => {
    try {
      await updateDoc(doc(db, "users", targetUid), {
        tokens: increment(amount),
      });
      pushSystemNotification("Токен қосылды", `+${amount} токен есептелді.`, "success");
    } catch (err: unknown) {
      pushSystemNotification("Қате", err instanceof Error ? err.message : String(err), "error");
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const gradeMatch = selectedGradeFilter === "all" || item.grade === selectedGradeFilter;
      const subjectMatch = selectedSubjectFilter === "all" || item.subject === selectedSubjectFilter;
      return gradeMatch && subjectMatch;
    });
  }, [items, selectedGradeFilter, selectedSubjectFilter]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const openNotifications = () => {
    setNotifDrawerOpen((o) => !o);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const computedLabValue = useMemo(() => {
    const b = labInputB === 0 ? 1 : labInputB;
    return Number((labInputA / b).toFixed(2));
  }, [labInputA, labInputB]);

  if (!authReady) {
    return (
      <>
        <style>{styles}</style>
        <div className="bsq-backdrop" />
        <div className="bsq-shell" style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
          <div className="bsq-card" style={{ padding: 28, textAlign: "center" }}>
            <div className="bsq-logo-text bsq-logo-md">BOLASHAQ</div>
            <div style={{ color: "var(--text-secondary)", marginTop: 10, fontSize: "0.9rem" }}>
              Жүйе жүктелуде...
            </div>
          </div>
        </div>
      </>
    );
  }

  // Entry / Registration / Login / Google Sign-In Gate
  if (!firebaseUser || !profile) {
    return (
      <>
        <style>{styles}</style>
        <div className="bsq-backdrop" />
        <div className="bsq-shell" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
          <div className="bsq-card bsq-unlock-stage" style={{ width: "100%", maxWidth: 460, padding: 26 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 18 }}>
              <div className="bsq-logo-wrap">
                <span className="bsq-logo-text bsq-logo-lg">BOLASHAQ</span>
              </div>
              <span className="bsq-glass-pill">Liquid Glass</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18 }}>
              <button
                type="button"
                className={`bsq-btn ${authMode === "register" ? "bsq-btn-primary" : "bsq-btn-ghost"}`}
                onClick={() => {
                  setAuthMode("register");
                  setAuthError("");
                }}
              >
                Тіркелу
              </button>
              <button
                type="button"
                className={`bsq-btn ${authMode === "login" ? "bsq-btn-primary" : "bsq-btn-ghost"}`}
                onClick={() => {
                  setAuthMode("login");
                  setAuthError("");
                }}
              >
                Логин / Пароль
              </button>
            </div>

            <button
              type="button"
              className="bsq-btn bsq-btn-google"
              style={{ width: "100%", marginBottom: 14 }}
              disabled={googleBusy}
              onClick={() => setGoogleModalOpen(true)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.1C3.26 21.3 7.31 24 12 24z"/>
                <path fill="#FBBC05" d="M5.27 14.29c-.24-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.61H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.39l3.98-3.1z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.61l3.98 3.1c.95-2.85 3.6-4.96 6.73-4.96z"/>
              </svg>
              Google аккаунтпен кіру
            </button>

            <form onSubmit={handleEmailAuth} style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {authMode === "register" && (
                <>
                  <div>
                    <label style={{ display: "block", fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: 5 }}>
                      Аты-жөні
                    </label>
                    <input
                      type="text"
                      className="bsq-input"
                      placeholder="Толық аты-жөніңіз"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                    />
                  </div>

                  <div className="bsq-grid-2">
                    <div>
                      <label style={{ display: "block", fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: 5 }}>
                        Рөл
                      </label>
                      <select
                        className="bsq-select"
                        value={roleDraft}
                        onChange={(e) => setRoleDraft(e.target.value as Role)}
                      >
                        <option value="student">Оқушы</option>
                        <option value="teacher">Мұғалім</option>
                        <option value="admin">Админ</option>
                      </select>
                    </div>

                    {roleDraft === "student" && (
                      <div>
                        <label style={{ display: "block", fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: 5 }}>
                          Сынып (1–11)
                        </label>
                        <select
                          className="bsq-select"
                          value={gradeDraft}
                          onChange={(e) => setGradeDraft(Number(e.target.value))}
                        >
                          {Array.from({ length: 11 }, (_, i) => i + 1).map((g) => (
                            <option key={g} value={g}>
                              {g}-сынып
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </>
              )}

              <div>
                <label style={{ display: "block", fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: 5 }}>
                  Email
                </label>
                <input
                  type="email"
                  className="bsq-input"
                  placeholder="name@example.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: 5 }}>
                  Құпия сөз
                </label>
                <input
                  type="password"
                  className="bsq-input"
                  placeholder="••••••••"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                />
              </div>

              {authError && (
                <div style={{ fontSize: "0.82rem", color: "#fda4af", background: "rgba(244,63,94,0.12)", border: "1px solid rgba(244,63,94,0.3)", padding: "9px 12px", borderRadius: 11 }}>
                  {authError}
                </div>
              )}

              <button type="submit" className="bsq-btn bsq-btn-gold" style={{ width: "100%", marginTop: 4 }} disabled={authBusy}>
                {authBusy ? "Орындалуда..." : authMode === "register" ? "Тіркелу және кіру" : "Кіру"}
              </button>
            </form>
          </div>
        </div>

        {/* Google Account Chooser Modal */}
        {googleModalOpen && (
          <div className="bsq-modal-backdrop" onClick={() => !googleBusy && setGoogleModalOpen(false)}>
            <div className="bsq-modal-card" onClick={(e) => e.stopPropagation()}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>Google аккаунтын таңдаңыз</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>BOLASHAQ жүйесіне өту үшін</div>
                </div>
                <button
                  type="button"
                  className="bsq-btn bsq-btn-ghost bsq-btn-sm"
                  disabled={googleBusy}
                  onClick={() => setGoogleModalOpen(false)}
                >
                  Жабу
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                {GOOGLE_CANDIDATES.map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    className="bsq-btn bsq-btn-ghost"
                    style={{ justifyContent: "space-between", textAlign: "left", padding: "11px 14px" }}
                    disabled={googleBusy}
                    onClick={() => handleSelectGoogleCandidate(acc)}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{acc.name}</div>
                      <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>{acc.email}</div>
                    </div>
                    <span className="bsq-badge">{acc.tag}</span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="bsq-btn bsq-btn-primary"
                style={{ width: "100%" }}
                disabled={googleBusy}
                onClick={handleRealGooglePopup}
              >
                {googleBusy ? "Қосылуда..." : "Басқа Google аккаунтпен кіру (Pop-up)"}
              </button>
            </div>
          </div>
        )}

        <div className="bsq-toast-stack">
          {toasts.map((t) => (
            <div key={t.id} className="bsq-toast">
              <div style={{ fontWeight: 700, fontSize: "0.84rem" }}>{t.title}</div>
              <div style={{ color: "var(--text-secondary)", fontSize: "0.78rem", marginTop: 2 }}>{t.message}</div>
            </div>
          ))}
        </div>
      </>
    );
  }

  const canCreate = profile.role === "teacher" || profile.role === "admin";

  return (
    <>
      <style>{styles}</style>
      <div className="bsq-backdrop" />

      <div className="bsq-shell">
        <div key={unlockKey} className="bsq-unlock-stage" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Top Bar */}
          <header className="bsq-card" style={{ padding: "14px 18px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <div className="bsq-logo-wrap">
                <span className="bsq-logo-text bsq-logo-md">BOLASHAQ</span>
                <span className="bsq-glass-pill">1–11</span>
              </div>
              <span className="bsq-badge">{profile.name}</span>
              <span className="bsq-badge" style={{ color: "#fde68a", borderColor: "rgba(245,158,11,0.35)" }}>
                {profile.role === "student"
                  ? `Оқушы · ${profile.grade || 7}-сынып`
                  : profile.role === "teacher"
                  ? "Мұғалім"
                  : "Админ"}
              </span>
              <span className="bsq-badge" style={{ color: "#5eead4", borderColor: "rgba(20,184,166,0.35)" }}>
                Токен: {profile.tokens}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className={`bsq-btn bsq-btn-sm ${activeTab === "hub" ? "bsq-btn-primary" : "bsq-btn-ghost"}`}
                onClick={() => setActiveTab("hub")}
              >
                Материалдар
              </button>
              <button
                type="button"
                className={`bsq-btn bsq-btn-sm ${activeTab === "play" ? "bsq-btn-primary" : "bsq-btn-ghost"}`}
                onClick={() => setActiveTab("play")}
              >
                Квиз & Зертхана
              </button>
              <button
                type="button"
                className={`bsq-btn bsq-btn-sm ${activeTab === "ai" ? "bsq-btn-gold" : "bsq-btn-ghost"}`}
                onClick={() => setActiveTab("ai")}
              >
                ЖИ Чат
              </button>
              {profile.role === "admin" && (
                <button
                  type="button"
                  className={`bsq-btn bsq-btn-sm ${activeTab === "admin" ? "bsq-btn-primary" : "bsq-btn-ghost"}`}
                  onClick={() => setActiveTab("admin")}
                >
                  Админ
                </button>
              )}

              <button
                type="button"
                className="bsq-btn bsq-btn-ghost bsq-btn-sm"
                onClick={openNotifications}
              >
                Хабарлама{unreadCount > 0 ? ` (${unreadCount})` : ""}
              </button>

              <button
                type="button"
                className="bsq-btn bsq-btn-danger bsq-btn-sm"
                onClick={handleSignOut}
              >
                Шығу
              </button>
            </div>
          </header>

          {/* System Notifications Drawer */}
          {notifDrawerOpen && (
            <div className="bsq-card" style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ fontWeight: 800, fontSize: "0.95rem" }}>Жүйелік хабарламалар</div>
                <button
                  type="button"
                  className="bsq-btn bsq-btn-ghost bsq-btn-sm"
                  onClick={() => setNotifications([])}
                >
                  Тазарту
                </button>
              </div>
              {notifications.length === 0 ? (
                <div style={{ color: "var(--text-secondary)", fontSize: "0.86rem" }}>Хабарлама жоқ.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 12,
                        background: "rgba(15, 23, 42, 0.7)",
                        border: "1px solid var(--border-subtle)",
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>{n.title}</div>
                        <div style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>{n.message}</div>
                      </div>
                      <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>{n.createdAt}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 1: Materials Hub + Teacher/Admin Creator */}
          {activeTab === "hub" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Filter Bar */}
              <div className="bsq-card" style={{ padding: 14, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                <select
                  className="bsq-select"
                  style={{ width: "auto", minWidth: 140 }}
                  value={selectedGradeFilter}
                  onChange={(e) => setSelectedGradeFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
                >
                  <option value="all">Барлық сынып</option>
                  {Array.from({ length: 11 }, (_, i) => i + 1).map((g) => (
                    <option key={g} value={g}>
                      {g}-сынып
                    </option>
                  ))}
                </select>

                <select
                  className="bsq-select"
                  style={{ width: "auto", minWidth: 170 }}
                  value={selectedSubjectFilter}
                  onChange={(e) => setSelectedSubjectFilter(e.target.value)}
                >
                  <option value="all">Барлық пән</option>
                  {SUBJECTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                <span className="bsq-badge" style={{ marginLeft: "auto" }}>
                  Саны: {filteredItems.length}
                </span>
              </div>

              {/* Creator Form for Teacher / Admin */}
              {canCreate && (
                <form onSubmit={handleCreateItem} className="bsq-card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ fontWeight: 800, fontSize: "1rem" }}>Жаңа материал құру</div>

                  <div className="bsq-grid-3">
                    <div>
                      <label style={{ display: "block", fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: 5 }}>
                        Түрі
                      </label>
                      <select
                        className="bsq-select"
                        value={newType}
                        onChange={(e) => setNewType(e.target.value as ContentType)}
                      >
                        <option value="quiz">Квиз (Wayground)</option>
                        <option value="topic">Тақырып</option>
                        <option value="presentation">Презентация</option>
                        <option value="lab">Зертхана</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: 5 }}>
                        Пән
                      </label>
                      <select
                        className="bsq-select"
                        value={newSubject}
                        onChange={(e) => setNewSubject(e.target.value)}
                      >
                        {SUBJECTS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: 5 }}>
                        Сынып (1–11)
                      </label>
                      <select
                        className="bsq-select"
                        value={newGrade}
                        onChange={(e) => setNewGrade(Number(e.target.value))}
                      >
                        {Array.from({ length: 11 }, (_, i) => i + 1).map((g) => (
                          <option key={g} value={g}>
                            {g}-сынып
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: 5 }}>
                      Атауы
                    </label>
                    <input
                      type="text"
                      className="bsq-input"
                      placeholder="Мысалы: Квадрат теңдеулер"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                    />
                  </div>

                  {newType === "quiz" && (
                    <div style={{ padding: 14, borderRadius: 16, background: "rgba(11, 17, 30, 0.65)", border: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>Сұрақтар ({draftQuestions.length})</span>
                      </div>
                      <input
                        type="text"
                        className="bsq-input"
                        placeholder="Сұрақ мәтіні"
                        value={qPrompt}
                        onChange={(e) => setQPrompt(e.target.value)}
                      />
                      <div className="bsq-grid-2">
                        <input type="text" className="bsq-input" placeholder="1-нұсқа" value={qOpt0} onChange={(e) => setQOpt0(e.target.value)} />
                        <input type="text" className="bsq-input" placeholder="2-нұсқа" value={qOpt1} onChange={(e) => setQOpt1(e.target.value)} />
                        <input type="text" className="bsq-input" placeholder="3-нұсқа" value={qOpt2} onChange={(e) => setQOpt2(e.target.value)} />
                        <input type="text" className="bsq-input" placeholder="4-нұсқа" value={qOpt3} onChange={(e) => setQOpt3(e.target.value)} />
                      </div>
                      <div className="bsq-grid-2">
                        <select className="bsq-select" value={qCorrect} onChange={(e) => setQCorrect(Number(e.target.value))}>
                          <option value={0}>Дұрыс жауап: 1-нұсқа</option>
                          <option value={1}>Дұрыс жауап: 2-нұсқа</option>
                          <option value={2}>Дұрыс жауап: 3-нұсқа</option>
                          <option value={3}>Дұрыс жауап: 4-нұсқа</option>
                        </select>
                        <input
                          type="number"
                          className="bsq-input"
                          placeholder="Уақыт (сек)"
                          value={qTime}
                          onChange={(e) => setQTime(Number(e.target.value))}
                        />
                      </div>
                      <button type="button" className="bsq-btn bsq-btn-ghost bsq-btn-sm" onClick={handleAddDraftQuestion}>
                        + Сұрақ қосу
                      </button>
                    </div>
                  )}

                  {newType === "topic" && (
                    <textarea
                      className="bsq-textarea"
                      placeholder="Тақырып мәтіні..."
                      value={newBody}
                      onChange={(e) => setNewBody(e.target.value)}
                    />
                  )}

                  {newType === "presentation" && (
                    <textarea
                      className="bsq-textarea"
                      placeholder="Әр жаңа жол — бір слайд..."
                      value={newSlidesText}
                      onChange={(e) => setNewSlidesText(e.target.value)}
                    />
                  )}

                  {newType === "lab" && (
                    <div className="bsq-grid-3">
                      <input
                        type="text"
                        className="bsq-input"
                        placeholder="Формула (v = s / t)"
                        value={newLabFormula}
                        onChange={(e) => setNewLabFormula(e.target.value)}
                      />
                      <input
                        type="text"
                        className="bsq-input"
                        placeholder="Өлшем бірлігі (м/с)"
                        value={newLabUnit}
                        onChange={(e) => setNewLabUnit(e.target.value)}
                      />
                      <input
                        type="number"
                        className="bsq-input"
                        placeholder="Нысана мәні"
                        value={newLabTarget}
                        onChange={(e) => setNewLabTarget(Number(e.target.value))}
                      />
                    </div>
                  )}

                  <button type="submit" className="bsq-btn bsq-btn-primary" disabled={creatingItem}>
                    {creatingItem ? "Сақталуда..." : "Жариялау"}
                  </button>
                </form>
              )}

              {/* Material Cards */}
              {filteredItems.length === 0 ? (
                <div className="bsq-card" style={{ padding: 32, textAlign: "center", color: "var(--text-secondary)" }}>
                  Әзірге материалдар жоқ.
                </div>
              ) : (
                <div className="bsq-grid-3">
                  {filteredItems.map((item) => (
                    <div key={item.id} className="bsq-card bsq-card-interactive" style={{ padding: 18, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 14 }}>
                      <div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                          <span className="bsq-badge">{item.grade}-сынып</span>
                          <span className="bsq-badge">{item.subject}</span>
                          <span className="bsq-badge">{item.type}</span>
                          {item.pinCode && <span className="bsq-badge">PIN: {item.pinCode}</span>}
                        </div>
                        <div style={{ fontWeight: 800, fontSize: "1.02rem" }}>{item.title}</div>
                        <div style={{ color: "var(--text-secondary)", fontSize: "0.8rem", marginTop: 4 }}>
                          {item.creatorName}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {item.type === "quiz" ? (
                          <button type="button" className="bsq-btn bsq-btn-primary bsq-btn-sm" onClick={() => startQuiz(item)}>
                            Бастау
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="bsq-btn bsq-btn-primary bsq-btn-sm"
                            onClick={() => {
                              setViewingItem(item);
                              setActiveTab("play");
                            }}
                          >
                            Ашу
                          </button>
                        )}
                        {(profile.role === "admin" || item.creatorUid === profile.uid) && (
                          <button
                            type="button"
                            className="bsq-btn bsq-btn-danger bsq-btn-sm"
                            onClick={() => handleDeleteItem(item.id)}
                          >
                            Өшіру
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Submissions Table */}
              <div className="bsq-card" style={{ padding: 18 }}>
                <div style={{ fontWeight: 800, fontSize: "0.98rem", marginBottom: 12 }}>Нәтижелер ({submissions.length})</div>
                {submissions.length === 0 ? (
                  <div style={{ color: "var(--text-secondary)", fontSize: "0.86rem" }}>Әзірге нәтижелер тіркелмеген.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {submissions.slice(0, 15).map((s) => (
                      <div
                        key={s.id}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 12,
                          background: "rgba(15, 23, 42, 0.65)",
                          border: "1px solid var(--border-subtle)",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 10,
                          flexWrap: "wrap",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>{s.userName}</div>
                          <div style={{ color: "var(--text-secondary)", fontSize: "0.78rem" }}>{s.itemTitle}</div>
                        </div>
                        <span className="bsq-badge" style={{ color: "#5eead4" }}>
                          {s.score} / {s.maxScore}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Wayground Quiz Player & Lab/Material Viewer */}
          {activeTab === "play" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {activeQuiz && activeQuiz.questions ? (
                <div className="bsq-card" style={{ padding: 22 }}>
                  {!quizFinished ? (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <span className="bsq-badge">
                            Сұрақ {qIndex + 1} / {activeQuiz.questions.length}
                          </span>
                          <span className="bsq-badge" style={{ color: "#fde68a" }}>
                            Уақыт: {timeLeft}с
                          </span>
                          <span className="bsq-badge" style={{ color: "#5eead4" }}>
                            Ұпай: {score}
                          </span>
                          <span className="bsq-badge">Серия: x{Math.max(1, streak)}</span>
                        </div>

                        <button
                          type="button"
                          className="bsq-btn bsq-btn-ghost bsq-btn-sm"
                          onClick={() => setActiveQuiz(null)}
                        >
                          Шығу
                        </button>
                      </div>

                      {/* Power-ups */}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                        <button
                          type="button"
                          className="bsq-btn bsq-btn-gold bsq-btn-sm"
                          disabled={usedDouble || doublePointsActive}
                          onClick={activateDouble}
                        >
                          2x Балл {doublePointsActive ? "(Белсенді)" : ""}
                        </button>
                        <button
                          type="button"
                          className="bsq-btn bsq-btn-ghost bsq-btn-sm"
                          disabled={usedFifty}
                          onClick={activateFiftyFifty}
                        >
                          50/50
                        </button>
                        <button
                          type="button"
                          className="bsq-btn bsq-btn-ghost bsq-btn-sm"
                          disabled={usedShield || shieldActive}
                          onClick={activateShield}
                        >
                          Қалқан {shieldActive ? "(Белсенді)" : ""}
                        </button>
                      </div>

                      <div style={{ fontWeight: 800, fontSize: "1.2rem", marginBottom: 16 }}>
                        {activeQuiz.questions[qIndex].prompt}
                      </div>

                      <div className="bsq-grid-2">
                        {activeQuiz.questions[qIndex].options.map((opt, idx) => {
                          const hidden = eliminatedIndices.includes(idx);
                          return (
                            <button
                              key={idx}
                              type="button"
                              className="bsq-btn bsq-btn-ghost"
                              style={{
                                justifyContent: "flex-start",
                                padding: "15px 16px",
                                opacity: hidden ? 0.2 : 1,
                              }}
                              disabled={hidden || answerFeedback !== "idle"}
                              onClick={() => handleAnswer(idx)}
                            >
                              <span className="bsq-badge">{idx + 1}</span>
                              <span>{opt}</span>
                            </button>
                          );
                        })}
                      </div>

                      {answerFeedback !== "idle" && (
                        <div style={{ marginTop: 14, fontWeight: 700, fontSize: "0.92rem", color: answerFeedback === "correct" ? "#34d399" : "#fda4af" }}>
                          {answerFeedback === "correct"
                            ? "Дұрыс!"
                            : answerFeedback === "timeout"
                            ? "Уақыт аяқталды."
                            : "Қате жауап."}
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ textAlign: "center", padding: "16px 0" }}>
                      <div style={{ fontWeight: 800, fontSize: "1.3rem", marginBottom: 8 }}>Квиз аяқталды</div>
                      <div style={{ color: "var(--text-secondary)", marginBottom: 16 }}>
                        Жалпы ұпай: <strong>{score}</strong> · Ең үлкен серия: <strong>{bestStreak}</strong>
                      </div>
                      <button type="button" className="bsq-btn bsq-btn-primary" onClick={() => setActiveQuiz(null)}>
                        Тізімге оралу
                      </button>
                    </div>
                  )}
                </div>
              ) : viewingItem ? (
                <div className="bsq-card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: "1.15rem" }}>{viewingItem.title}</div>
                      <div style={{ color: "var(--text-secondary)", fontSize: "0.82rem" }}>
                        {viewingItem.grade}-сынып · {viewingItem.subject}
                      </div>
                    </div>
                    <button type="button" className="bsq-btn bsq-btn-ghost bsq-btn-sm" onClick={() => setViewingItem(null)}>
                      Жабу
                    </button>
                  </div>

                  {viewingItem.body && (
                    <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, fontSize: "0.94rem" }}>{viewingItem.body}</div>
                  )}

                  {viewingItem.slides && viewingItem.slides.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {viewingItem.slides.map((sl, i) => (
                        <div key={i} className="bsq-card" style={{ padding: 14 }}>
                          <div className="bsq-badge" style={{ marginBottom: 6 }}>Слайд {i + 1}</div>
                          <div>{sl}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {viewingItem.type === "lab" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <span className="bsq-badge">Формула: {viewingItem.labFormula}</span>
                        <span className="bsq-badge">Нысана: {viewingItem.labTarget} {viewingItem.labUnit}</span>
                      </div>
                      <div className="bsq-grid-2">
                        <div>
                          <label style={{ display: "block", fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: 5 }}>
                            Айнымалы A
                          </label>
                          <input
                            type="number"
                            className="bsq-input"
                            value={labInputA}
                            onChange={(e) => setLabInputA(Number(e.target.value))}
                          />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: 5 }}>
                            Айнымалы B
                          </label>
                          <input
                            type="number"
                            className="bsq-input"
                            value={labInputB}
                            onChange={(e) => setLabInputB(Number(e.target.value))}
                          />
                        </div>
                      </div>
                      <div className="bsq-card" style={{ padding: 14 }}>
                        Нәтиже: <strong>{computedLabValue} {viewingItem.labUnit || ""}</strong>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bsq-card" style={{ padding: 28, textAlign: "center", color: "var(--text-secondary)" }}>
                  Квизді бастау немесе тақырып/зертхананы ашу үшін «Материалдар» бөлімінен элемент таңдаңыз.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: AI Chat (Real Gemini & OpenAI API + Token Accounting) */}
          {activeTab === "ai" && (
            <div className="bsq-card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>ЖИ Чат (Gemini / OpenAI)</div>

              <div className="bsq-grid-3">
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: 5 }}>
                    Провайдер
                  </label>
                  <select
                    className="bsq-select"
                    value={provider}
                    onChange={(e) => handleProviderChange(e.target.value as AIProvider)}
                  >
                    <option value="gemini">Gemini API</option>
                    <option value="openai">OpenAI (ChatGPT API)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: 5 }}>
                    Модель
                  </label>
                  <input
                    type="text"
                    className="bsq-input"
                    value={modelInput}
                    onChange={(e) => setModelInput(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: 5 }}>
                    API Кілт
                  </label>
                  <input
                    type="password"
                    className="bsq-input"
                    placeholder="API кілтті енгізіңіз"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                  />
                </div>
              </div>

              {canCreate && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                  <select className="bsq-select" style={{ width: "auto" }} value={aiGrade} onChange={(e) => setAiGrade(Number(e.target.value))}>
                    {Array.from({ length: 11 }, (_, i) => i + 1).map((g) => (
                      <option key={g} value={g}>{g}-сынып</option>
                    ))}
                  </select>
                  <select className="bsq-select" style={{ width: "auto" }} value={aiSubject} onChange={(e) => setAiSubject(e.target.value)}>
                    {SUBJECTS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.84rem", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={autoPublishAiQuiz}
                      onChange={(e) => setAutoPublishAiQuiz(e.target.checked)}
                    />
                    Жауапты базаға тақырып етіп сақтау
                  </label>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 360, overflowY: "auto", padding: "4px 0" }}>
                {aiMessages.length === 0 ? (
                  <div style={{ color: "var(--text-secondary)", fontSize: "0.86rem" }}>
                    API кілтін енгізіп, сұрақ жіберіңіз.
                  </div>
                ) : (
                  aiMessages.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        padding: "12px 14px",
                        borderRadius: 14,
                        background: m.role === "user" ? "rgba(20, 184, 166, 0.14)" : "rgba(15, 23, 42, 0.78)",
                        border: "1px solid var(--border-subtle)",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: 4 }}>
                        <span>{m.role === "user" ? profile.name : m.provider.toUpperCase()}</span>
                        <span>{m.tokens} токен</span>
                      </div>
                      <div style={{ fontSize: "0.92rem", lineHeight: 1.55 }}>{m.text}</div>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleSendAi} style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  className="bsq-input"
                  placeholder="Сұрақ жазыңыз..."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                />
                <button type="submit" className="bsq-btn bsq-btn-primary" disabled={aiBusy}>
                  {aiBusy ? "Күту..." : "Жіберу"}
                </button>
              </form>
            </div>
          )}

          {/* TAB 4: Admin Panel */}
          {activeTab === "admin" && profile.role === "admin" && (
            <div className="bsq-card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontWeight: 800, fontSize: "1.02rem" }}>Пайдаланушылар ({allUsers.length})</div>
              {allUsers.map((u) => (
                <div
                  key={u.uid}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 14,
                    background: "rgba(15, 23, 42, 0.72)",
                    border: "1px solid var(--border-subtle)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{u.name}</div>
                    <div style={{ color: "var(--text-secondary)", fontSize: "0.78rem" }}>
                      {u.email} · Токен: {u.tokens}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <select
                      className="bsq-select"
                      style={{ width: "auto" }}
                      value={u.role}
                      onChange={(e) => handleAdminRoleChange(u.uid, e.target.value as Role)}
                    >
                      <option value="student">student</option>
                      <option value="teacher">teacher</option>
                      <option value="admin">admin</option>
                    </select>
                    <button
                      type="button"
                      className="bsq-btn bsq-btn-gold bsq-btn-sm"
                      onClick={() => handleAdminAddTokens(u.uid, 500)}
                    >
                      +500 токен
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bsq-toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className="bsq-toast">
            <div style={{ fontWeight: 700, fontSize: "0.84rem" }}>{t.title}</div>
            <div style={{ color: "var(--text-secondary)", fontSize: "0.78rem", marginTop: 2 }}>{t.message}</div>
          </div>
        ))}
      </div>
    </>
  );
}

export default App;
