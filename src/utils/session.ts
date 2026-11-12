import type { UserInfo } from '@/types/user'

export const USER_STORAGE_KEY = 'xsbysj:current-user'

export function getStoredUser(): UserInfo | null {
  const value = localStorage.getItem(USER_STORAGE_KEY)
  if (!value) {
    return null
  }

  try {
    return JSON.parse(value) as UserInfo
  } catch {
    localStorage.removeItem(USER_STORAGE_KEY)
    return null
  }
}

export function setStoredUser(user: UserInfo) {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user))
}

export function clearStoredUser() {
  localStorage.removeItem(USER_STORAGE_KEY)
}
