"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/components/layout/ThemeToggle"

const navLinks = [
  { href: "/", label: "Planner", emoji: "📅" },
  { href: "/meals", label: "Meals", emoji: "🍽️" },
  { href: "/log", label: "Log", emoji: "✅" },
  { href: "/weight", label: "Weight", emoji: "⚖️" },
  { href: "/stats", label: "Stats", emoji: "📊" },
  { href: "/shopping", label: "Shopping", emoji: "🛒" },
  { href: "/recipes", label: "Recipes", emoji: "📖" },
  { href: "/settings", label: "Settings", emoji: "⚙️" },
]

export function Header() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2.5 sm:px-4 sm:py-3">
        <Link href="/" className="flex items-center gap-1.5 group shrink-0">
          <span className="text-xl">🥗</span>
          <span className="hidden text-base font-bold tracking-tight text-primary group-hover:opacity-80 transition-opacity sm:inline">
            FoodPlanner
          </span>
        </Link>

        <nav className="flex items-center gap-0.5 sm:gap-1 overflow-x-auto">
          {navLinks.map((link) => {
            const active = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-medium whitespace-nowrap transition-all sm:px-3",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <span>{link.emoji}</span>
                <span className="hidden sm:inline">{link.label}</span>
              </Link>
            )
          })}
        </nav>

        <ThemeToggle />
      </div>
    </header>
  )
}
