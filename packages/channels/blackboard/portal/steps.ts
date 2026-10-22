import manifest from "../manifest.ts";
import { channelText } from "@cogniate/portal-sdk";
import metadata from "./blackboard-steps.json";

// The manifest owns instruction text. JSON only owns the layout metadata.
const instructions = [manifest.texts.adminSteps.slice(0, 2), manifest.texts.adminSteps.slice(2, 9), manifest.texts.adminSteps.slice(9), manifest.texts.teacherSteps];
export default { ...metadata, get steps() { return metadata.steps.map((step, index) => ({
  ...step, instructions: instructions[index]!.map((text) => channelText(manifest, text)),
})); } };
