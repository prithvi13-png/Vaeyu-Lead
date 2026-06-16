import { cn } from "@/lib/utils"

interface LogoProps {
  className?: string
}

export function Logo({ className }: LogoProps) {
  return (
    <img
      src="/logo.png"
      alt="Vaeyu"
      className={cn("size-8 object-contain", className)}
    />
  )
}
