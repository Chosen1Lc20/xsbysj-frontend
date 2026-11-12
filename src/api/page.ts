import type { PageResult } from '@/types/api'

export function normalizePageResult<T>(page: PageResult<T>): PageResult<T> {
  return {
    ...page,
    total: Number(page.total) || 0,
    size: Number(page.size) || 0,
    current: Number(page.current) || 1,
    pages: Number(page.pages) || 0,
  }
}
