import type { ComponentProps } from "react";
import { cn } from "./utils.ts";

const variants = {
  default: "border-transparent bg-primary text-[#180f24]",
  primary:
    "border-[#c4a2f455] bg-(image:--portal-gradient-button) text-[#1b1028]",
  secondary: "border-[#ffffff0e] bg-[#292631] text-[#f0eaf8]",
  destructive: "border-transparent bg-[#9e3948] text-white",
  link: "self-start border-0 bg-transparent px-0 py-[5px] text-left text-[13px] font-normal text-[#d4b0ff] underline underline-offset-4",
  destructiveLink:
    "self-start border-0 bg-transparent px-0 py-[5px] text-left text-[13px] font-normal text-[#ffafb9] underline underline-offset-4",
  icon: "size-9 rounded-lg border border-border bg-transparent p-0 text-white",
};
type Variant = keyof typeof variants;
type Size = "default" | "sm";

export function buttonVariants({
  variant = "default",
  size = "default",
  className,
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
} = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-55 [&:hover:not(:disabled)]:brightness-110",
    !(["link", "destructiveLink", "icon"] as Variant[]).includes(variant) &&
      "border font-semibold whitespace-nowrap no-underline",
    !(["link", "destructiveLink", "icon"] as Variant[]).includes(variant) &&
      (size === "sm"
        ? "min-h-8 rounded-[22px] px-3.5 py-1.5 text-[11px]"
        : "min-h-[42px] rounded-[9px] px-[18px] py-2.5 text-[13px]"),
    variants[variant],
    className,
  );
}

export function Button({
  variant,
  size,
  className,
  ...props
}: ComponentProps<"button"> & {
  variant?: Variant;
  size?: Size;
}) {
  return (
    <button
      data-slot="button"
      className={buttonVariants({ variant, size, className })}
      {...props}
    />
  );
}
