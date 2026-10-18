import type { HTMLAttributes } from "react";
import { cn } from "./utils.ts";

const padding = {
  default: "p-[26px] max-[720px]:p-5",
  none: "p-0 max-[720px]:p-5",
  integration: "p-[22px]",
  results: "px-3 py-[22px] max-[720px]:p-5",
  empty: "px-[26px] py-14 max-[720px]:p-5",
};
export function Card({
  as: Component = "section",
  spacing = "default",
  className,
  ...props
}: HTMLAttributes<HTMLElement> & {
  as?: "section" | "article" | "div";
  spacing?: keyof typeof padding;
}) {
  return (
    <Component
      data-slot="card"
      className={cn(
        "rounded-card border border-card-border bg-card",
        padding[spacing],
        className,
      )}
      {...props}
    />
  );
}
