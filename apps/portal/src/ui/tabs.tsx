import { useRef } from "react";

// One tab stop, arrow/Home/End navigation, and automatic panel activation.
export function Tabs({
  id,
  label,
  options,
  value,
  onValueChange,
}: {
  id: string;
  label: string;
  options: string[];
  value: string;
  onValueChange: (value: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      role="tablist"
      aria-label={label}
      className="mb-7 inline-flex flex-wrap gap-[3px] rounded-[30px] border border-[#ffffff12] bg-[#09080d] p-1 max-[720px]:rounded-[15px]"
    >
      {options.map((item, index) => (
        <button
          key={item}
          type="button"
          role="tab"
          id={`${id}-${index}`}
          aria-controls={`${id}-panel`}
          aria-selected={value === item}
          tabIndex={value === item ? 0 : -1}
          className="rounded-3xl border-0 bg-transparent px-[18px] py-2 text-[12px] font-medium text-[#d3cedc] aria-selected:bg-primary aria-selected:text-[#180f24] max-[720px]:px-3"
          onClick={() => onValueChange(item)}
          onKeyDown={(event) => {
            const next =
              event.key === "ArrowRight"
                ? (index + 1) % options.length
                : event.key === "ArrowLeft"
                  ? (index + options.length - 1) % options.length
                  : event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? options.length - 1
                      : null;
            if (next === null) return;
            event.preventDefault();
            onValueChange(options[next]!);
            const tabs =
              ref.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
            tabs?.[next]?.focus();
          }}
        >
          {item}
        </button>
      ))}
    </div>
  );
}
