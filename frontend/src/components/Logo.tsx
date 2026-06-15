import { useId } from "react"
import { cn } from "@/lib/utils"

interface LogoProps {
  className?: string
}

export function Logo({ className }: LogoProps) {
  const id = useId()

  return (
    <svg
      viewBox="0 0 240 240"
      className={cn("size-8", className)}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2DD4BF" />
          <stop offset="100%" stopColor="#6366F1" />
        </linearGradient>
        <linearGradient id={`${id}-horn-left`} x1="1" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor="#99F6E4" />
          <stop offset="100%" stopColor="#2DD4BF" />
        </linearGradient>
        <linearGradient id={`${id}-horn-right`} x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#99F6E4" />
          <stop offset="100%" stopColor="#2DD4BF" />
        </linearGradient>
        <linearGradient id={`${id}-chevron`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#CFFAFE" />
          <stop offset="100%" stopColor="#A5B4FC" />
        </linearGradient>
      </defs>
      <path
        d="M82 66 C 55 44 26 46 22 76"
        stroke={`url(#${id}-horn-left)`}
        strokeWidth={18}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M158 66 C 185 44 214 46 218 76"
        stroke={`url(#${id}-horn-right)`}
        strokeWidth={18}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M76 70 L76 150 A44 44 0 0 0 164 150 L164 70"
        stroke={`url(#${id}-body)`}
        strokeWidth={34}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M94 86 L120 168 L146 86"
        stroke={`url(#${id}-chevron)`}
        strokeWidth={20}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}
