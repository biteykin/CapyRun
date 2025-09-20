// components/ui/search-input.tsx
"use client"
import * as React from "react"
import { cn } from "@/lib/utils"
import { Search } from "lucide-react"

type Props = React.InputHTMLAttributes<HTMLInputElement>

export default function SearchInput({ className, ...props }: Props) {
  return (
    <div className="search-input-wrapper">
      <Search className="search-input__icon" />
      <input
        data-slot="input"
        className={cn(
          "search-input rounded-[var(--radius)]",
          "border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className
        )}
        {...props}
      />
    </div>
  )
}