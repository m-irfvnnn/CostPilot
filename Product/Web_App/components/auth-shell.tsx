'use client'

import Link from 'next/link'
import { ArrowLeft, Sparkles } from 'lucide-react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

export function AuthShell({ children, eyebrow, title, description }: { children: React.ReactNode; eyebrow: string; title: string; description?: string }) {
  return (
    <main className="min-h-screen bg-background px-5 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col">
        <header className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground"><Sparkles size={16} /></span>
            <span className="font-heading text-lg font-bold tracking-tight">CostPilot</span>
          </Link>
          <Link href="/" className="flex items-center gap-2 font-mono text-xs text-slate-500 hover:text-primary"><ArrowLeft size={14} /> Back home</Link>
        </header>
        <div className="grid flex-1 items-center gap-12 py-14 lg:grid-cols-[.75fr_1fr] lg:gap-24 lg:py-20">
          <div className="hidden lg:block">
            <p className="eyebrow"><i className="h-1.5 w-1.5 rounded-full bg-primary" />{eyebrow}</p>
            <h1 className="mt-5 max-w-md font-heading text-5xl font-bold leading-[1.05] tracking-[-.045em] text-slate-950">{title}</h1>
            {description && <p className="mt-6 max-w-md font-mono text-sm leading-7 text-slate-500">{description}</p>}
            <div className="mt-10 h-px w-24 bg-primary" />
          </div>
          <div className="mx-auto w-full max-w-md">{children}</div>
        </div>
      </div>
    </main>
  )
}

export function Field({ label, type = 'text', ...inputProps }: { label: string } & Omit<InputHTMLAttributes<HTMLInputElement>, 'className'>) {
  return <label className="block"><span className="font-mono text-[10px] font-bold uppercase tracking-[.14em] text-slate-500">{label}</span><input type={type} {...inputProps} className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-white px-4 font-mono text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/10" /></label>
}

export function Choice({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`rounded-lg border px-4 py-3 text-left font-mono text-xs transition-all ${selected ? 'border-primary bg-secondary text-primary ring-1 ring-primary' : 'border-slate-200 bg-white text-slate-600 hover:border-primary/50'}`}>{label}</button>
}

export function AuthFooter({ children }: { children: React.ReactNode }) { return <p className="mt-6 text-center font-mono text-xs text-slate-500">{children}</p> }

export function AuthHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="mb-8"><p className="eyebrow lg:hidden">{eyebrow}</p><h2 className="mt-3 font-heading text-3xl font-bold tracking-[-.04em] text-slate-950">{title}</h2><p className="mt-3 font-mono text-xs leading-6 text-slate-500">{description}</p></div>
}

export function AuthButton({ children, ...buttonProps }: { children: ReactNode } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'>) { return <button type="submit" {...buttonProps} className="button-primary flex h-12 w-full justify-center">{children}</button> }

export function Divider() { return <div className="my-6 flex items-center gap-3"><div className="h-px flex-1 bg-slate-200" /><span className="font-mono text-[10px] uppercase tracking-[.14em] text-slate-400">or</span><div className="h-px flex-1 bg-slate-200" /></div> }
