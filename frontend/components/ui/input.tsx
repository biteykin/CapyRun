import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const inputVariants = cva(
  [
    // базовые
    "w-full min-w-0 bg-[hsl(var(--input-bg,var(--input)))] text-foreground",
    "border border-input rounded-[var(--radius)]",
    "placeholder:text-muted-foreground",
    "transition-[box-shadow,color,border-color] outline-none",
    "selection:bg-primary selection:text-primary-foreground",
    // фокус-кольцо и бордер из токенов
    "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0",
    // disabled
    "disabled:pointer-events-none disabled:opacity-50",
    // invalid (aria-invalid=true)
    "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
    // input[type=file] стили
    "file:inline-flex file:h-7 file:px-2 file:rounded-[calc(var(--radius)-2px)] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground"
  ].join(" "),
  {
    variants: {
      size: {
        sm: "h-8 px-2.5 text-sm",
        md: "h-10 px-3 text-sm",
        lg: "h-12 px-4 text-base",
      },
      // вариант “ghost” иногда нужен для фильтров в тулбарах
      variant: {
        default: "",
        ghost:
          "bg-transparent hover:bg-[hsl(var(--muted))] border-transparent focus-visible:border-ring",
      },
      // когда есть иконка слева/справа — удобно дать внутренние отступы
      withLeftIcon: { true: "pl-9" },
      withRightIcon: { true: "pr-9" },
    },
    defaultVariants: {
      size: "md",
      variant: "default",
    },
  }
);

export type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> &
  VariantProps<typeof inputVariants> & {
    size?: "sm" | "md" | "lg";
  };

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, size, variant, withLeftIcon, withRightIcon, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        data-slot="input"
        className={cn(inputVariants({ size, variant, withLeftIcon, withRightIcon }), className)}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { inputVariants };
