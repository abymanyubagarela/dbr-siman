'use client'

import type { InputHTMLAttributes, SelectHTMLAttributes } from 'react'

export function Label({ children, htmlFor, wajib }: { children: React.ReactNode; htmlFor?: string; wajib?: boolean }) { return <label htmlFor={htmlFor} className="text-sm font-semibold text-slate-800">{children}{wajib && <span className="ml-1 text-rose-600" aria-label="wajib">*</span>}</label> }
export function Field({ label, error, children, htmlFor, wajib }: { label: string; error?: string; children: React.ReactNode; htmlFor?: string; wajib?: boolean }) { return <div className="flex flex-col gap-2" data-invalid={Boolean(error)}><Label htmlFor={htmlFor} wajib={wajib}>{label}</Label>{children}{error && <p role="alert" className="text-sm text-rose-600">{error}</p>}</div> }
export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) { return <input {...props} aria-invalid={props['aria-invalid']} className={`min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 disabled:cursor-not-allowed disabled:bg-slate-100 ${className}`} /> }
export function Select({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) { return <select {...props} className={`min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 disabled:cursor-not-allowed disabled:bg-slate-100 ${className}`} /> }

