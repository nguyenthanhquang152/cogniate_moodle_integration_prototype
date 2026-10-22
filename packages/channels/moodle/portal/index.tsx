import manifest from "../manifest.ts";
import type { ChannelUiModule, ChannelWizardProps } from "@cogniate/portal-sdk";
import { Card, Notice, Link, buttonVariants, ArrowRight, Download, idPath, useSession, fillText, ConnectionDetailBlock, pendingToolText } from "@cogniate/portal-sdk";
import { CreateConnection } from "./CreateConnection.tsx";
import { DynamicSetup } from "./DynamicSetup.tsx";
import { ManualSetup } from "./ManualSetup.tsx";
import { MoodleSteps } from "./MoodleSteps.tsx";
import { WebServices } from "./WebServices.tsx";
import { MoodleBackup } from "./MoodleBackup.tsx";
import { MoodleCourse } from "./MoodleCourse.tsx";

export function MoodleWizard(props: ChannelWizardProps) {
  const connection = props.connection;
  if (!connection) return <CreateConnection opener={props.opener} onCreated={props.onCreated} />;
  if (connection.status === "disabled") return <Notice>This connection is disconnected. Delete the old Cogniate tool in Moodle before you connect again.</Notice>;
  return <>
    {connection.status === "pending" ? connection.method === "dynamic"
      ? <DynamicSetup connection={connection} libraryName={props.libraryName} onChanged={props.onChanged} />
      : <ManualSetup connection={connection} libraryName={props.libraryName} onRegistered={props.onChanged} />
      : <MoodleReady connection={connection} libraryName={props.libraryName} />}
    <Notice>To reconnect, delete the old Cogniate tool in Moodle. Then disconnect this connection and connect again. Cogniate refuses every tool update.</Notice>
  </>;
}
export function MoodleReady({ connection, libraryName }: Pick<ChannelWizardProps, "libraryName"> & { connection: NonNullable<ChannelWizardProps["connection"]> }) {
  return <Card className="flex flex-col gap-5">
    <h2>{connection.status === "registered" ? "Registered" : "Your library is connected"}</h2>
    {connection.status === "registered" && connection.method === "dynamic" && <div><h3>Complete the steps in Moodle</h3><MoodleSteps method="dynamic" libraryName={libraryName} /></div>}
    {connection.status === "registered" && <p>The first launch from Moodle changes the status to Connected.</p>}
    <div className="flex flex-wrap items-center gap-3"><Link className={buttonVariants({ variant: "primary", size: "default" })} to="/libraries/courses">Go to Courses <ArrowRight size={16} aria-hidden="true" /></Link></div>
  </Card>;
}
const module: ChannelUiModule = {
  Wizard: MoodleWizard,
  TeacherSteps() {
    const session = useSession();
    return <p className="text-[12px] text-[#cbb9e0]">Teachers: {manifest.texts.teacherSteps.map((step) => fillText(step, { LMS: manifest.names.text, tool: `Cogniate (${session?.library.name ?? ""})`, site: "" })).join(" ")}</p>;
  },
  ConnectionDetails: ({ connection }) => <ConnectionDetailBlock connection={connection} openUrl={`${connection.siteUrl}/mod/lti/toolconfigure.php`} />,
  ConnectionError: ({ Default, ...props }) => <Default {...props} error={{
    ...props.error, title: props.error.title ?? "The Moodle connection failed.", action: props.error.action ?? (props.error.code === "MOODLE_TOOL_MAY_EXIST" && props.libraryName ? pendingToolText(`Cogniate (${props.libraryName})`) : undefined),
  }} />,
  connectionPanels: [({ connection, sdk }) => connection.capabilities.webServices ? <WebServices key={connection.id} connection={connection} onSaved={sdk.refresh} /> : null],
  coursePanels: [({ course, version }) => version?.format === "scorm12" ? <>
    <div className="grid justify-items-start gap-3 border-t border-border pt-5 [&_p]:text-[12px]">
      <a className={buttonVariants({ variant: "secondary", size: "default" })} href={`/app-api/courses/${idPath(course.id)}/versions/${idPath(version.id)}/download?kind=original`} download><Download size={16} aria-hidden="true" />Download SCORM package</a>
      <p className="text-muted-foreground">In Moodle: Edit mode → Add content → Activity or resource → SCORM package → Add</p>
    </div>
    <MoodleBackup key={version.id} courseId={course.id} versionId={version.id} />
  </> : null],
  publicationPanels: [({ publication }) => <MoodleCourse publication={publication} />],
};
export default module;
