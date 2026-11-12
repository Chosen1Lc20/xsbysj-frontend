export function formatDateTime(value?: string | null) {
  if (!value) {
    return '--'
  }
  return value.replace('T', ' ')
}

export function displayText(value?: string | null, fallback = '暂未填写') {
  return value?.trim() || fallback
}
