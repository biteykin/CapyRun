import type { Meta, StoryObj } from "@storybook/react";
import Link from "next/link";
import { Plus, Trash2, Wand2, ChevronDown } from "lucide-react";
import { Button } from "./button";
import * as React from "react";

const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
  args: { children: "Click me" },
  parameters: { layout: "padded" },
  argTypes: {
    variant: {
      control: "select",
      options: [
        "primary",
        "secondary",
        "ghost",
        "success",
        "warning",
        "danger",
        "lemon",
        "light",
        "icon",
      ],
    },
    size: {
      control: "inline-radio",
      options: ["sm", "md", "lg"],
    },
    isLoading: { control: "boolean" },
    asIcon: { control: "boolean" },
  },
  tags: ["autodocs"],
};
export default meta;

type Story = StoryObj<typeof Button>;

/**
 * Мини-компонент демо-дропдауна без порталов:
 * контейнер relative + меню absolute right-0 под кнопкой.
 */
function InlineDropdownDemo() {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <Button
        variant="dropdown"
        className="gap-1"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span>Dropdown</span>
        <ChevronDown className="-mr-1 h-4 w-4 opacity-70" />
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 rounded-xl border border-[var(--border)] bg-white p-1 shadow-[0_8px_24px_rgba(0,0,0,.08)] z-50"
        >
          <a
            className="block w-full rounded-lg px-3 py-2 text-left no-underline text-foreground hover:bg-[var(--color-bg-fill-tertiary)]"
            href="#"
          >
            Загрузить файл
            <div className="text-xs text-[var(--text-secondary)]">
              Импорт .fit и др.
            </div>
          </a>
          <a
            className="block w-full rounded-lg px-3 py-2 text-left no-underline text-foreground hover:bg-[var(--color-bg-fill-tertiary)]"
            href="#"
          >
            Добавить вручную
          </a>
        </div>
      )}
    </div>
  );
}

export const Default: Story = {};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-start gap-2">
      <Button variant="primary">Primary</Button>
      {/* визуальная проверка идентичности */}
      <div className="inline-flex items-center gap-2 ml-4">
        <span className="text-xs text-muted-foreground">Сравнение:</span>
        <Button variant="primary">Primary</Button>
        <Button variant="dropdown">Dropdown</Button>
      </div>
      {/* Secondary теперь белый с чёрной рамкой и жирным текстом */}
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="success">Success</Button>
      <Button variant="warning">Warning</Button>
      <Button variant="danger">Danger</Button>
      <Button variant="lemon">Lemon CTA</Button>
      <Button variant="light">Light</Button>
      <InlineDropdownDemo />
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Button size="sm">sm</Button>
      <Button size="md">md</Button>
      <Button size="lg">lg</Button>
    </div>
  ),
};

export const States: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Button disabled>Disabled</Button>
      <Button isLoading>Loading</Button>
      <Button variant="danger" isLoading>
        Deleting…
      </Button>
    </div>
  ),
};

export const WithIcons: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Button>
        <Plus className="h-4 w-4" /> Add
      </Button>
      <Button variant="secondary">
        <Wand2 className="h-4 w-4" /> Magic
      </Button>
      <Button variant="danger">
        <Trash2 className="h-4 w-4" /> Delete
      </Button>
      {/* компактная икон-кнопка */}
      <Button asIcon aria-label="More">
        <ChevronDown className="h-4 w-4" />
      </Button>
      {/* квадратная икон-кнопка через variant=icon */}
      <Button asIcon className="h-9 w-9 p-0" aria-label="More">
        <ChevronDown className="h-4 w-4" />
      </Button>
    </div>
  ),
};

export const AsLink: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Link href="/workouts">
        <Button variant="ghost">← Назад</Button>
      </Link>
      <Button asChild>
        <a href="https://example.com" target="_blank" rel="noreferrer">
          External link
        </a>
      </Button>
    </div>
  ),
};

export const LegacyVsNew: Story = {
  render: () => (
    <div className="grid gap-6">
      <div>
        <div className="mb-2 text-sm text-muted-foreground">
          Legacy (global.css) vs Button (lemon)
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn btn-yellow" type="button">
            .btn-yellow
          </button>
          <Button variant="lemon">Button lemon</Button>
        </div>
      </div>

      <div>
        <div className="mb-2 text-sm text-muted-foreground">
          Legacy (light) vs Button (light)
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn btn-light" type="button">
            .btn-light
          </button>
          <Button variant="light">Button light</Button>
        </div>
      </div>

      <div>
        <div className="mb-2 text-sm text-muted-foreground">
          Legacy (delete) vs Button (danger)
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn btn-delete" type="button">
            .btn-delete
          </button>
          <Button variant="danger">Button danger</Button>
        </div>
      </div>

      <div>
        <div className="mb-2 text-sm text-muted-foreground">
          Legacy (icon) vs Button (icon)
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn btn-icon" type="button">
            <Plus className="mr-2 h-4 w-4" /> .btn-icon
          </button>
          <Button asIcon className="h-9 px-3">
            <Plus className="h-4 w-4" /> Button icon
          </Button>
          <Button asIcon className="h-9 w-9 p-0" aria-label="Add">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div>
        <div className="mb-2 text-sm text-muted-foreground">
          Legacy (secondary) vs Button (secondary)
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            style={{
              border: "1px solid rgba(0,0,0,0.10)",
              background: "#fff",
              color: "#000",
              fontWeight: 600,
              boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.08)",
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
            }}
          >
            .btn-secondary (custom)
          </button>
          <Button variant="secondary">Button secondary</Button>
        </div>
      </div>
    </div>
  ),
};

export const AsChildSafe: Story = {
  render: () => (
    <div>
      <Button asChild>
        <a href="https://example.com" target="_blank" rel="noreferrer">
          Safe asChild link
        </a>
      </Button>
    </div>
  ),
};

export const Playground: Story = {
  name: "Playground",
  render: () => (
    <div className="p-4">
      <InlineDropdownDemo />
    </div>
  ),
};