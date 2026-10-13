import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { initials } from "@/lib/format"
import { cn } from "@/lib/utils"

const SIZES = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-lg",
  xl: "size-20 text-2xl",
}

/** Coloured initials avatar (photo when available). */
export function UserAvatar({
  name,
  color = "#10b981",
  src,
  size = "sm",
  className,
}: {
  name: string
  color?: string
  src?: string
  size?: keyof typeof SIZES
  className?: string
}) {
  return (
    <Avatar className={cn(SIZES[size], className)}>
      {src ? <AvatarImage src={src} alt={name} /> : null}
      <AvatarFallback className="font-semibold text-white" style={{ backgroundColor: color }}>
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  )
}

/** Avatar + name + subtitle row used in tables and lists. */
export function PersonCell({
  name,
  subtitle,
  color,
  size = "sm",
  className,
}: {
  name: string
  subtitle?: React.ReactNode
  color?: string
  size?: keyof typeof SIZES
  className?: string
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <UserAvatar name={name} color={color} size={size} />
      <div className="min-w-0">
        <div className="truncate font-medium">{name}</div>
        {subtitle ? <div className="truncate text-xs text-muted-foreground">{subtitle}</div> : null}
      </div>
    </div>
  )
}
