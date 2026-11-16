import type { ComponentProps, ReactNode } from 'react'
import { buttonClass } from './buttonClass'

type ButtonProps = ComponentProps<'button'> & { variant?: 'primary' | 'ghost' }

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return <button {...props} className={buttonClass(variant, className)} />
}

interface ChipProps {
  active: boolean
  onClick: () => void
  children: ReactNode
  title?: string
}

/** Toggle-style choice in a group (root, chord type, level…). */
export function Chip({ active, onClick, children, title }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={title}
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
        active ? 'border-accent bg-accent text-ink' : 'border-line bg-raised text-text hover:border-mute'
      }`}
    >
      {children}
    </button>
  )
}

export function PageHeader({ title, intro }: { title: string; intro: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-3xl font-semibold sm:text-4xl">{title}</h1>
      <p className="mt-2 max-w-2xl text-mute">{intro}</p>
    </header>
  )
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <div className="mb-2 text-xs font-bold tracking-widest text-mute uppercase">{children}</div>
}

export function Meter({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
      <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  )
}
