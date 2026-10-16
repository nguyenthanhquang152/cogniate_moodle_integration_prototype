// Typed view of the state file "T4b" that the T4b1 and T4b2 specs share (lib/lti.ts saveState / loadState).
import { loadState } from './lti';

export interface T4bState {
  runId: string;
  thanhScorm: { courseId: string; versionId: string; title: string };
  thanhHtml: { courseId: string; versionId: string; title: string };
  bHtml: { courseId: string; versionId: string; title: string };
  thanhConnectionId: string;
  thanhTypeId: number;
  bManualConnectionId: string;
  bManualTypeId: number;
  thanhScormPublicationId: string;
  thanhHtmlPublicationId: string;
  bHtmlPublicationId: string;
  withdrawnPublicationId: string;
  xssCourseId: string;
  xssPublicationId: string;
  scormActivityCmid: number;
  scormActivityName: string;
  usedPickerUrl: string;
  pickerGetHeaders: Record<string, string>;
  pickerPostHeaders: Record<string, string>;
  playHeaders: Record<string, string>;
  embeddedHeaders: Record<string, string>;
  errorPageHeaders: Record<string, string>;
  firstToolLaunchUrl: string;
  firstPlayId: string;
}

export function t4b(): Partial<T4bState> {
  return loadState('T4b') as Partial<T4bState>;
}
