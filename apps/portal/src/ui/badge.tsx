import type { ComponentProps } from "react";
import { cn } from "./utils.ts";

const variants = {
  default: "border-[#bca5e042] bg-[#aa7ee917] text-[#d9c4f3]",
  success: "border-[#7bd6a43d] bg-[#26583d33] text-[#9ce5be]",
  warning: "border-[#d3ab6740] bg-[#74522522] text-[#f4d39a]",
};
export function Badge({
  variant = "default",
  className,
  ...props
}: ComponentProps<"span"> & { variant?: keyof typeof variants }) {
  return (
    <span
      data-slot="badge"
      className={cn(
        "inline-flex rounded-md border px-[9px] py-1 text-[11px] leading-[1.4] font-medium",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
