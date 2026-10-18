import type { ComponentProps } from "react";
import { cn } from "./utils.ts";

const field =
  "min-w-0 w-full rounded-lg border border-[#4b4359] bg-[#0e0d13] text-[#f5effc] placeholder:text-[#9d94aa] aria-invalid:border-[#ed8d9c]";
export function Input({ className, type, ...props }: ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      type={type}
      className={cn(
        type === "radio"
          ? "size-[17px] shrink-0 accent-[#b78bf9]"
          : cn(field, type === "file" ? "p-2" : "px-3 py-[11px]"),
        type === "file" &&
          "max-w-full text-[12px] file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-[#383042] file:px-3 file:py-2 file:text-white",
        className,
      )}
      {...props}
    />
  );
}
export function Select({
  variant = "default",
  className,
  ...props
}: ComponentProps<"select"> & { variant?: "default" | "library" }) {
  return (
    <select
      data-slot="select"
      className={cn(
        variant === "library"
          ? "min-w-40 w-full border-0 bg-transparent py-2.5 pr-2.5 pl-0 text-[12px] text-[#f5effc]"
          : cn(field, "px-3 py-[11px]"),
        className,
      )}
      {...props}
    />
  );
}
export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(field, "px-3 py-[11px]", className)}
      {...props}
    />
  );
}
