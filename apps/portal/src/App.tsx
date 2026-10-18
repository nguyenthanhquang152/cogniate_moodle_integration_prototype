import { Input, Select } from "./ui/input.tsx";
import { Card } from "./ui/card.tsx";
import { Button, buttonVariants } from "./ui/button.tsx";
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
import { Courses } from "./courses/Courses.tsx";
import { CourseDetail } from "./courses/CourseDetail.tsx";
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
      <main className="mx-auto flex w-[min(440px,calc(100vw-40px))] flex-col gap-[45px] pt-[85px] pb-[45px] [&>a]:self-center [&_h1]:my-2.5">
        <Loading />
      </main>
    );
  if (error)
    return (
      <main className="mx-auto flex w-[min(440px,calc(100vw-40px))] flex-col gap-[45px] pt-[85px] pb-[45px] [&>a]:self-center [&_h1]:my-2.5">
        <h1>Cogniate is unavailable</h1>
        <ErrorNotice error={error} />
        <Button
          onClick={() => {
            void loadSession();
          }}
        >
          Try again
        </Button>
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
    <main className="mx-auto flex w-[min(440px,calc(100vw-40px))] flex-col gap-[45px] pt-[85px] pb-[45px] [&>a]:self-center [&_h1]:my-2.5">
      <Link
        className="relative ml-3 self-start text-[31px] leading-[1.3] font-semibold tracking-[-1.8px] no-underline after:mx-auto after:mt-2 after:block after:h-0.5 after:w-[78%] after:bg-[linear-gradient(90deg,#d1c9b5,#b78bf9)] after:shadow-[0_4px_18px_3px_#b78bf944] after:content-[''] [&_span]:text-[#cbb2ec] max-[1100px]:text-[27px]"
        to="/signin"
      >
        Cogniate<span>.</span>
      </Link>
      <Card className="flex flex-col gap-5">
        <div>
          <p className="eyebrow mb-[5px] text-[10px] font-semibold tracking-[0.15em] text-[#b3a4c6]">
            YOUR COURSE LIBRARY
          </p>
          <h1>Welcome back</h1>
          <p className="text-muted-foreground">
            Sign in to connect your library to Moodle.
          </p>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-5">
          <label>
            Email
            <Input
              name="email"
              type="email"
              autoComplete="username"
              required
              autoFocus
            />
          </label>
          <label>
            Password
            <Input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <ErrorNotice error={error} />
          <Button variant="primary" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <p className="text-[12px] text-muted-foreground">
          Prototype · Use your seeded Cogniate account.
        </p>
      </Card>
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
    <div className="min-h-screen">
      <a
        className="fixed -top-[60px] left-4 z-100 rounded-lg bg-white p-3 text-[#18131f] focus:top-3"
        href="#main"
      >
        Skip to content
      </a>
      <aside
        aria-label="Workspace navigation"
        className="fixed inset-y-0 left-0 z-10 flex w-[216px] flex-col gap-[46px] border-r border-[#ffffff0d] bg-portal-sidebar px-4 pt-[30px] pb-[18px] max-[1100px]:w-[184px] max-[720px]:static max-[720px]:w-auto max-[720px]:gap-[22px] max-[720px]:p-[18px]"
      >
        <Link
          className="relative ml-3 self-start text-[31px] leading-[1.3] font-semibold tracking-[-1.8px] no-underline after:mx-auto after:mt-2 after:block after:h-0.5 after:w-[78%] after:bg-[linear-gradient(90deg,#d1c9b5,#b78bf9)] after:shadow-[0_4px_18px_3px_#b78bf944] after:content-[''] [&_span]:text-[#cbb2ec] max-[1100px]:text-[27px]"
          to="/integrations"
          aria-label="Cogniate home"
        >
          Cogniate<span>.</span>
        </Link>
        <nav
          aria-label="Main navigation"
          className="grid gap-1.5 max-[720px]:flex max-[720px]:flex-wrap"
        >
          {navigation.map(({ title, path, icon: Icon }) => (
            <NavLink
              key={title}
              to={path}
              className="w-full flex items-center gap-[13px] text-[#cfccd5] no-underline border-0 px-3.5 py-[11px] rounded-[9px] bg-transparent text-left hover:bg-[#ffffff08] aria-[current=page]:text-[#f7f2ff] aria-[current=page]:bg-portal-sidebar-active [&[aria-current=page]_svg]:text-[#ccb0f7] max-[720px]:w-auto max-[720px]:p-[9px] max-[720px]:text-[12px]"
            >
              <Icon size={19} aria-hidden="true" />
              {title}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto grid gap-1.5 max-[720px]:flex max-[720px]:flex-wrap">
          <NavLink
            to="/prototype/settings"
            className="w-full flex items-center gap-[13px] text-[#cfccd5] no-underline border-0 px-3.5 py-[11px] rounded-[9px] bg-transparent text-left hover:bg-[#ffffff08] aria-[current=page]:text-[#f7f2ff] aria-[current=page]:bg-portal-sidebar-active [&[aria-current=page]_svg]:text-[#ccb0f7] max-[720px]:w-auto"
          >
            <Settings size={19} aria-hidden="true" />
            Settings
          </NavLink>
          <button
            className="w-full flex items-center gap-[13px] text-[#cfccd5] no-underline border-0 px-3.5 py-[11px] rounded-[9px] bg-transparent text-left hover:bg-[#ffffff08] aria-[current=page]:text-[#f7f2ff] aria-[current=page]:bg-portal-sidebar-active [&[aria-current=page]_svg]:text-[#ccb0f7] max-[720px]:w-auto"
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
          <div className="mt-5 flex items-center gap-2.5 rounded-[30px] bg-[#292632] p-[7px] [&_strong]:block [&_strong]:text-[12px] [&_strong]:font-medium [&_small]:block [&_small]:text-[10px] [&_small]:text-[#d3c4a4] max-[720px]:hidden">
            <span
              className="grid size-[34px] place-items-center rounded-full border border-[#67c9e0] bg-[#087fa9] font-semibold"
              aria-hidden="true"
            >
              {session.user.name.charAt(0)}
            </span>
            <div>
              <strong>{session.user.name}</strong>
              <small>Course creator</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="ml-[216px] min-h-screen bg-[radial-gradient(ellipse_80%_40%_at_80%_0%,#b48ae92b,transparent_85%)] px-[54px] min-[1600px]:px-20 max-[1100px]:ml-[184px] max-[1100px]:px-[30px] max-[720px]:m-0 max-[720px]:px-5">
        <header className="mx-auto flex h-[102px] max-w-[1200px] items-center gap-[18px] max-[720px]:h-[86px]">
          <div className="flex items-center gap-2.5 rounded-[28px] border border-[#ffffff14] bg-[#0b0a10] px-3.5">
            <BookOpen size={16} aria-hidden="true" />
            <label className="sr-only" htmlFor="library">
              Library
            </label>
            <Select
              variant="library"
              id="library"
              value={session.library.id}
              onChange={() => undefined}
            >
              <option value={session.library.id}>{session.library.name}</option>
            </Select>
          </div>
          <Link
            to="/prototype/edit-library"
            className="inline-flex items-center gap-1.5 text-[12px] text-[#ccc5d9] no-underline hover:text-white"
          >
            Edit library <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] tracking-[0.03em] text-[#c3afd9] max-[720px]:hidden">
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
      <p className="text-muted-foreground">
        Use Integrations to connect Moodle, or Libraries to manage courses.
      </p>
      <Link
        to="/integrations"
        className={buttonVariants({ variant: "secondary", size: "default" })}
      >
        Go to Integrations
      </Link>
    </>
  );
}
