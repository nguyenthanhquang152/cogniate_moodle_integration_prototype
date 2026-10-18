// Types of app contract §7 shared by the content host (server) and the runtime (browser), so the two sides cannot
// drift (B-T5a-02).
import type { HtmlProfile, HtmlProgress } from './html.ts';

export interface RuntimeState {
  format: 'scorm12' | 'html';
  packageBaseUrl: string;
  launchPath: string;
  preview: boolean;
  learner: { id: string; name: string };
  sessionId: string;
  lastSeq: number;
  scorm: {
    /** Saved values of the attempt (exit and session_time are never given back); core.total_time is the earlier sessions' time. */
    cmi: Record<string, unknown> & { core: Record<string, unknown> & { total_time: string } };
    entry: string;
    masteryScore: number | null;
    launchData: string;
    credit: 'credit' | 'no-credit';
  } | null;
  html: { profile: HtmlProfile & { launchPath?: string }; progress: HtmlProgress } | null;
}
