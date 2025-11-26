// components/ui/pagination.stories.tsx
import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from "./pagination";

const meta: Meta = {
  title: "UI/Pagination",
  component: Pagination,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
};
export default meta;

type Story = StoryObj<
  typeof Pagination & {
    page: number;
    pageCount: number;
  }
>;

/** Хелпер для компактного построения страниц с «…» */
function getVisiblePages(page: number, pageCount: number): Array<number | "..."> {
  const p = Math.max(1, Math.min(page, pageCount));
  const last = pageCount;
  const out: Array<number | "..."> = [];
  if (last <= 7) {
    for (let i = 1; i <= last; i++) out.push(i);
    return out;
  }
  out.push(1);
  if (p > 4) out.push("...");
  const start = Math.max(2, p - 1);
  const end = Math.min(last - 1, p + 1);
  for (let i = start; i <= end; i++) out.push(i);
  if (p < last - 3) out.push("...");
  out.push(last);
  return out;
}

/** Простой статичный пример — как на странице: номера слева, навигация справа */
export const Basic: Story = {
  render: () => (
    <Pagination className="border-t border-[var(--border)] px-4 py-3">
      <PaginationContent className="w-full items-center justify-between">
        {/* Лево: числа */}
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <PaginationItem key={n}>
              <PaginationLink
                href="#"
                className="tabular-nums"
                isActive={n === 2}
                onClick={(e) => e.preventDefault()}
              >
                {n}
              </PaginationLink>
            </PaginationItem>
          ))}
        </div>

        {/* Право: Prev/Next */}
        <div className="flex items-center gap-2">
          <PaginationItem>
            <PaginationPrevious href="#" onClick={(e) => e.preventDefault()} />
          </PaginationItem>
          <PaginationItem>
            <PaginationNext href="#" onClick={(e) => e.preventDefault()} />
          </PaginationItem>
        </div>
      </PaginationContent>
    </Pagination>
  ),
};

/** С «…» и активной страницей — макет как в продукте */
export const WithEllipsis: Story = {
  render: () => (
    <Pagination className="border-t border-[var(--border)] px-4 py-3">
      <PaginationContent className="w-full items-center justify-between">
        <div className="flex items-center gap-1">
          <PaginationItem>
            <PaginationLink href="#" className="tabular-nums" onClick={(e) => e.preventDefault()}>
              1
            </PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#" className="tabular-nums" onClick={(e) => e.preventDefault()}>
              5
            </PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#" className="tabular-nums" isActive onClick={(e) => e.preventDefault()}>
              6
            </PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#" className="tabular-nums" onClick={(e) => e.preventDefault()}>
              7
            </PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#" className="tabular-nums" onClick={(e) => e.preventDefault()}>
              10
            </PaginationLink>
          </PaginationItem>
        </div>

        <div className="flex items-center gap-2">
          <PaginationItem>
            <PaginationPrevious href="#" onClick={(e) => e.preventDefault()} />
          </PaginationItem>
          <PaginationItem>
            <PaginationNext href="#" onClick={(e) => e.preventDefault()} />
          </PaginationItem>
        </div>
      </PaginationContent>
    </Pagination>
  ),
};

/** Контролируемая сторис: можно менять page/pageCount; верстка — как в продукте */
export const Playground = {
  args: {
    page: 1,
    pageCount: 10,
  },
  render: (args: { page: number; pageCount: number }) => {
    const [page, setPage] = React.useState(args.page);
    const pageCount = Math.max(1, args.pageCount);

    React.useEffect(() => setPage(args.page), [args.page]);

    const pages = getVisiblePages(page, pageCount);
    const go = (p: number) => setPage(Math.max(1, Math.min(pageCount, p)));

    return (
      <Pagination className="border-t border-[var(--border)] px-4 py-3">
        <PaginationContent className="w-full items-center justify-between">
          <div className="flex items-center gap-1">
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  go(page - 1);
                }}
              />
            </PaginationItem>

            {pages.map((it, idx) =>
              it === "..." ? (
                <PaginationItem key={`e${idx}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={it}>
                  <PaginationLink
                    href="#"
                    className="tabular-nums"
                    isActive={it === page}
                    onClick={(e) => {
                      e.preventDefault();
                      go(it);
                    }}
                  >
                    {it}
                  </PaginationLink>
                </PaginationItem>
              )
            )}

            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  go(page + 1);
                }}
              />
            </PaginationItem>
          </div>

          <div className="text-sm text-muted-foreground">
            Страница {page} из {pageCount}
          </div>
        </PaginationContent>
      </Pagination>
    );
  },
};