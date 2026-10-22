import { cn } from "./ui/utils.ts";

const colors = {
  blue: "bg-[#f9f7fc] text-[#237cf3] text-[29px] tracking-[-2px]",
  orange: "bg-[#fff2e5] text-[#e65d00] text-[29px] tracking-[-2px]",
  pink: "bg-[#f9f7fc] text-[#b82d73] text-[29px] tracking-[-2px]",
  red: "bg-[#f9f7fc] text-[#bb2540] text-[19px] tracking-[-1px]",
  peach: "bg-[#edcebb] text-[#271e18] text-[29px] tracking-[-2px]",
  green: "bg-[#f9f7fc] text-[#116146] text-[29px] tracking-[-2px]",
  cyan: "bg-[linear-gradient(130deg,#6de5e2,#6540c5)] text-white italic text-[29px] tracking-[-2px]",
  purple: "bg-[#f9f7fc] text-[#6543dc] text-[35px] tracking-[-2px]",
};
export function IntegrationLogo({
  name = "",
  mark = "",
  color = "orange",
  large = false,
}: {
  name?: string;
  mark?: string;
  color?: string;
  large?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      title={name}
      className={cn(
        "inline-grid shrink-0 place-items-center font-bold",
        large ? "size-14 rounded-[14px]" : "size-[42px] rounded-[10px]",
        colors[color as keyof typeof colors] ?? colors.blue,
      )}
    >
      {mark}
    </span>
  );
}
