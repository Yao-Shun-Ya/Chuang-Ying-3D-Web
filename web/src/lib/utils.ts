import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 用户展示名称：优先 display_name，其次邮箱前缀，最后回退 username */
export function userDisplayName(o: { display_name?: string | null; email?: string | null; username?: string }) {
  if (o.display_name) return o.display_name
  if (o.email) return o.email.split('@')[0]
  return o.username || ''
}
