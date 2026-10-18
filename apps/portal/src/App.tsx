import { createContext, useContext, useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import {
  ArrowUpRight,
  BookOpen,
  Building2,
  ChartNoAxesCombined,
  CircleHelp,
  Images,
  LayoutDashboard,
  LogOut,
  PanelsTopLeft,
  Settings,
  Sparkles,
} from "lucide-react";
import { api } from "./api.ts";
import type { Session } from "./types.ts";
import { ErrorNotice, Loading } from "./ui.tsx";
import { Integrations } from "./Integrations.tsx";
import { Connect } from "./connect/Connect.tsx";
import { Courses, CourseDetail } from "./courses/Courses.tsx";
import { Results } from "./results/Results.tsx";

const SessionContext = createContext<Session | null>(null);
export const useSession = (): Session => useContext(SessionContext)!;

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const navigate = useNavigate();
  async function loadSession() {
    setError(null);
    try {
      setSession(await api<Session>("/me"));
    } catch (reason) {
      if (
        !(
          reason instanceof Error &&
          "status" in reason &&
          reason.status === 401
        )
      )
        setError(reason);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void loadSession();
    const expire = () => {
      setSession(null);
      navigate("/signin", { replace: true });
    };
    window.addEventListener("portal:session-expired", expire);
    return () => window.removeEventListener("portal:session-expired", expire);
  }, []); // The session is loaded once; writes and expiry events update it.
  if (loading)
    return (
      <main className="signin">
        <Loading />
      </main>
    );
  if (error)
    return (
      <main className="signin">
        <h1>Cogniate is unavailable</h1>
        <ErrorNotice error={error} />
        <button
          className="button"
          onClick={() => {
            void loadSession();
          }}
        >
          Try again
        </button>
      </main>
    );
  return (
    <SessionContext.Provider value={session}>
      <Routes>
        <Route
          path="/signin"
          element={
            session ? (
              <Navigate to="/integrations" replace />
            ) : (
              <SignIn onSignedIn={loadSession} />
            )
          }
        />
        <Route
          element={
            session ? (
              <Frame onLogout={() => setSession(null)} />
            ) : (
              <Navigate to="/signin" replace />
            )
          }
        >
          <Route index element={<Navigate to="/integrations" replace />} />
          <Route path="integrations" element={<Integrations />} />
          <Route path="integrations/moodle/connect" element={<Connect />} />
          <Route
            path="integrations/moodle/:connectionId"
            element={<Connect />}
          />
          <Route path="libraries/courses" element={<Courses />} />
          <Route
            path="libraries/courses/:courseId"
            element={<CourseDetail />}
          />
          <Route
            path="libraries/courses/:courseId/publish"
            element={<CourseDetail publish />}
          />
          <Route
            path="publications/:publicationId/results"
            element={<Results />}
          />
          <Route path="prototype/:page" element={<Placeholder />} />
          <Route
            path="*"
            element={
              <main>
                <h1>Page not found</h1>
                <Link to="/integrations">Go to Integrations</Link>
              </main>
            }
          />
        </Route>
      </Routes>
    </SessionContext.Provider>
  );
}
function SignIn({ onSignedIn }: { onSignedIn: () => Promise<void> }) {
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await api("/session", {
        method: "POST",
        body: { email: data.get("email"), password: data.get("password") },
      });
      await onSignedIn();
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="signin">
      <Link className="brand" to="/signin">
        Cogniate<span>.</span>
      </Link>
      <section className="panel stack">
        <div>
          <p className="eyebrow">YOUR COURSE LIBRARY</p>
          <h1>Welcome back</h1>
          <p className="muted">Sign in to connect your library to Moodle.</p>
        </div>
        <form onSubmit={submit} className="stack">
          <label>
            Email
            <input
              name="email"
              type="email"
              autoComplete="username"
              required
              autoFocus
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <ErrorNotice error={error} />
          <button className="button primary" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="fine-print">
          Prototype · Use your seeded Cogniate account.
        </p>
      </section>
    </main>
  );
}
const navigation = [
  { title: "Dashboard", path: "/prototype/dashboard", icon: LayoutDashboard },
  { title: "Company", path: "/prototype/company", icon: Building2 },
  { title: "Integrations", path: "/integrations", icon: PanelsTopLeft },
  { title: "Assets", path: "/prototype/assets", icon: Images },
  { title: "Libraries", path: "/libraries/courses", icon: BookOpen },
  {
    title: "Analytics",
    path: "/prototype/analytics",
    icon: ChartNoAxesCombined,
  },
];
function Frame({ onLogout }: { onLogout: () => void }) {
  const session = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const focusId = (location.state as { focus?: string } | null)?.focus;
    // Route data can arrive after the first frame. Restore focus when its opener exists.
    const focus = () => {
      if (document.querySelector("dialog[open]")) {
        observer.disconnect();
        return;
      }
      const target =
        (focusId
          ? document.getElementById(focusId)
          : document.querySelector<HTMLElement>("main h1")) ??
        (focusId?.startsWith("moodle-")
          ? document.getElementById("moodle-manage")
          : null);
      if (target) {
        target.focus();
        observer.disconnect();
      }
    };
    const observer = new MutationObserver(focus);
    observer.observe(document.getElementById("main")!, {
      childList: true,
      subtree: true,
    });
    const timer = requestAnimationFrame(focus);
    return () => {
      cancelAnimationFrame(timer);
      observer.disconnect();
    };
  }, [location.pathname, location.state]);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link className="brand" to="/integrations" aria-label="Cogniate home">
          Cogniate<span>.</span>
        </Link>
        <nav aria-label="Main navigation">
          {navigation.map(({ title, path, icon: Icon }) => (
            <NavLink key={title} to={path}>
              <Icon size={19} aria-hidden="true" />
              {title}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <NavLink to="/prototype/settings">
            <Settings size={19} aria-hidden="true" />
            Settings
          </NavLink>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await api("/session", { method: "DELETE" });
                onLogout();
                navigate("/signin");
              } catch (reason) {
                setError(reason);
              } finally {
                setBusy(false);
              }
            }}
          >
            <LogOut size={19} aria-hidden="true" />
            Logout
          </button>
          <div className="user-chip">
            <span className="avatar" aria-hidden="true">
              {session.user.name.charAt(0)}
            </span>
            <div>
              <strong>{session.user.name}</strong>
              <small>Course creator</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="library-switch">
            <BookOpen size={16} aria-hidden="true" />
            <label className="sr-only" htmlFor="library">
              Library
            </label>
            <select
              id="library"
              value={session.library.id}
              onChange={() => undefined}
            >
              <option value={session.library.id}>{session.library.name}</option>
            </select>
          </div>
          <Link to="/prototype/edit-library" className="quiet-link">
            Edit library <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
          <span className="prototype-label">
            <Sparkles size={14} aria-hidden="true" />
            Prototype
          </span>
        </header>
        <main id="main">
          <ErrorNotice error={error} />
          <Outlet />
        </main>
        <footer>
          <CircleHelp size={14} aria-hidden="true" />
          Cogniate × Moodle · Integration prototype
        </footer>
      </div>
    </div>
  );
}
function Placeholder() {
  return (
    <>
      <h1 tabIndex={-1}>Not part of this prototype</h1>
      <p className="muted">
        Use Integrations to connect Moodle, or Libraries to manage courses.
      </p>
      <Link to="/integrations" className="button secondary">
        Go to Integrations
      </Link>
    </>
  );
}
