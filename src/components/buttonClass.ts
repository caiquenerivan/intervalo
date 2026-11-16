/** Button look as a class string, so links can share it. */
export function buttonClass(variant: 'primary' | 'ghost' = 'primary', extra = '') {
  const look =
    variant === 'primary'
      ? 'bg-accent text-ink hover:brightness-110 disabled:opacity-40'
      : 'border border-line bg-raised text-text hover:border-mute disabled:opacity-40'
  return `inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition ${look} ${extra}`
}
