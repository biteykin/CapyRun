import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
// @ts-ignore — утилита склеивания классов
import { cn } from "@/lib/utils"; // если нет — временно замени на простой classNames

/**
 * ВАЖНО:
 * Мы поддерживаем ДВА набора стилей:
 * 1) «ShadCN-подобные» (primary/secondary/ghost/success/warning) — через Tailwind-классы.
 * 2) «Legacy PostHog/глобальные» — прямо из global.css: .btn + .btn-*
 *    lemon  -> .btn .btn-yellow
 *    light  -> .btn .btn-light
 *    icon   -> .btn .btn-icon
 *    danger -> .btn .btn-delete
 *
 * Это позволит безболезненно мигрировать всё к единому виду.
 */

const twBase =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background " +
  "disabled:opacity-50 disabled:pointer-events-none rounded-[var(--radius)]";

const buttonVariants = cva(
  twBase,
  {
    variants: {
      variant: {
        // Primary теперь 1-в-1 как Dropdown-кнопка (жёлтая «Capy/PH»)
        // Цвет/обводка/тени/hover/active полностью совпадают.
        primary:
          "border border-black/10 bg-[#f9bd2b] text-black " +
          "font-semibold " +
          "shadow-[inset_0_-2px_0_rgba(0,0,0,0.25)] " +
          "hover:brightness-95 " +
          "active:translate-y-px active:shadow-[inset_0_-1px_0_rgba(0,0,0,0.3)] " +
          // переопределяем ring на мягкий чёрный, как в исходной кнопке
          "focus-visible:ring-black/10 ring-offset-0",
        // Secondary: тот же стиль, но на белом фоне
        secondary:
          "border border-black/10 bg-white text-black " +
          "font-semibold " +
          "shadow-[inset_0_-2px_0_rgba(0,0,0,0.08)] " +
          "hover:brightness-95 " +
          "active:translate-y-px active:shadow-[inset_0_-1px_0_rgba(0,0,0,0.12)] " +
          "focus-visible:ring-black/10 ring-offset-0",
        ghost:
          "bg-transparent text-foreground hover:bg-muted",
        success:
          "bg-[color:var(--color-success,oklch(0.76_0.15_163))] text-white hover:opacity-95",
        warning:
          "bg-[color:var(--color-warning,oklch(0.87_0.18_78))] text-black hover:opacity-95",

        /**
         * Ниже — ЛЕГАСИ-варианты. Сам класс «.btn» и конкретные модификаторы лежат в global.css.
         * Мы навешиваем эти классы напрямую, чтобы получить идентичный внешний вид.
         */
        lemon:
          "btn btn-yellow " +
          "[background:linear-gradient(135deg,var(--btn-yellow-from),var(--btn-yellow-to))] hover:brightness-[.97]",
        // светлая с жёлтой обводкой
        light:
          "btn btn-light text-[color:hsl(var(--btn-light-text))] border [border-color:hsl(var(--btn-light-border))] " +
          "[background:hsl(var(--btn-light-bg))] hover:[background:hsl(var(--btn-light-hover-bg))]",
        icon: "btn btn-icon",
        danger: "btn btn-delete",

        // уже существующий вариант dropdown — оставляем для выпадающих меню
        dropdown:
          "border border-black/10 bg-[#f9bd2b] text-black " +
          "font-semibold " +
          "shadow-[inset_0_-2px_0_rgba(0,0,0,0.25)] " +
          "hover:brightness-95 " +
          "active:translate-y-px active:shadow-[inset_0_-1px_0_rgba(0,0,0,0.3)] " +
          "focus-visible:ring-black/10 ring-offset-0",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
      },
      loading: {
        true: "cursor-wait opacity-80",
      },
      asIcon: {
        true: "px-2",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, asChild, asIcon, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    /**
     * Особый случай: «legacy»-варианты (.btn-*) уже задают отступы/радиусы.
     * Но мы хотим сохранить управляемый размер. Поэтому мягко добавим только высоту/паддинг,
     * не ломая их стили (они в .btn уже есть и не конфликтуют).
     */
    const isLegacy =
      variant === "lemon" || variant === "light" || variant === "icon" || variant === "danger";

    const sizePatch =
      size === "sm" ? "h-8 px-3 text-sm"
      : size === "lg" ? "h-12 px-6 text-base"
      : "h-10 px-4 text-sm";

    return (
      <Comp
        ref={ref}
        className={cn(
          buttonVariants({ variant, size, loading: !!isLoading, asIcon }),
          isLegacy && sizePatch,
          className
        )}
        {...props}
      >
        {isLoading && (
          <svg aria-hidden="true" className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
            <path d="M22 12a10 10 0 0 1-10 10" fill="currentColor"/>
          </svg>
        )}
        {children}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { buttonVariants };