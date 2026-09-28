import Link from 'next/link'
import { cn } from './ui/utils'

export default function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Gojo home"
      className={cn('shrink-0 text-2xl font-extrabold tracking-tight text-primary', className)}
    >
      Gojo
    </Link>
  )
}
