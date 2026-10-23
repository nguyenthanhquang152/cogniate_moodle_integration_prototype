import manifest from "../manifest.ts";
import { channelText } from "@cogniate/portal-sdk";
import metadata from "./canvas-steps.json";

// The manifest owns the instruction text of the developer key (manual) steps; JSON owns the layout metadata and the
// Dynamic Registration texts (LA-E3-16). Every text fills {LMS}.
const instructions = [manifest.texts.adminSteps.slice(0, 2), manifest.texts.adminSteps.slice(2, 7), manifest.texts.adminSteps.slice(7), manifest.texts.teacherSteps];
const fill = (text: string) => channelText(manifest, text);
export default { ...metadata, get steps() { return metadata.steps.map((step, index) => ({
  ...step, instructions: instructions[index]!.map(fill),
})); }, get dynamic() {
  const { methods, registration, urlExpires, registered, waiting } = metadata.dynamic;
  const choice = (text: { label: string; help: string }) => ({ label: text.label, help: fill(text.help) });
  return {
    methods: { manual: choice(methods.manual), dynamic: choice(methods.dynamic) },
    registration: { ...registration, title: fill(registration.title), instructions: registration.instructions.map(fill) },
    urlExpires: fill(urlExpires), registered: fill(registered), waiting: fill(waiting),
  };
} };
