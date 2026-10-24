import manifest from "../manifest.ts";
import { channelText } from "@cogniate/portal-sdk";
import metadata from "./moodle-steps.json";

// Dynamic instruction text has one source: the channel manifest.
export const moodleSteps = {
  ...metadata,
  get dynamic() { return metadata.dynamic.map((step, index) => ({ ...step, text: channelText(manifest, manifest.texts.adminSteps[index]!, "{libraryName}") })); },
};
export function MoodleSteps({
  method,
  libraryName,
}: {
  method: "dynamic" | "manual";
  libraryName: string;
}) {
  return (
    <ol className="mt-5 grid list-none gap-[22px] p-0">
      {moodleSteps[method].map((step, index) => (
        <li
          key={step.id}
          data-step-id={step.id}
          className="relative min-h-7 pl-[42px]"
        >
          <span
            aria-hidden="true"
            className="absolute -top-0.5 left-0 grid size-[27px] place-items-center rounded-full border border-[#a181c955] bg-[#211b2b] text-[12px] text-[#d4b8fa]"
          >
            {index + 1}
          </span>
          <p>{step.text.replaceAll("{libraryName}", libraryName)}</p>
          {step.menuPath.length > 0 && (
            <p className="mt-[5px] text-[12px] text-[#bcb0cc]">
              {step.menuPath.join(" → ")}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
