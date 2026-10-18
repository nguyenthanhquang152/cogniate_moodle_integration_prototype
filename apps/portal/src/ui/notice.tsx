import type { ComponentProps } from "react";
import { cn } from "./utils.ts";

const variants = {
  default: "border-[#b39bdf40] bg-[#a57bd912]",
  error: "border-[#b7666b70] bg-[#85343c22] text-[#ffd0d5]",
  warning: "border-[#a8833f55] bg-[#8d5f1918] text-[#edd9b0]",
};
export function Notice({
  variant = "default",
  className,
  ...props
}: ComponentProps<"div"> & { variant?: keyof typeof variants }) {
  return (
    <div
      data-slot="notice"
      className={cn(
        "rounded-[9px] border px-4 py-3.5 text-[13px] wrap-anywhere [&_p+p]:mt-[7px] [&_small]:mt-1.5 [&_small]:block [&_ul]:mt-2.5 [&_ul]:pl-5 [&_li+li]:mt-2",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
