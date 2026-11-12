export type SelectionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED'

export interface SelectionInfo {
  id: string | number
  studentId: string | number
  studentName?: string | null
  studentNo?: string | null
  studentDepartment?: string | null
  topicId: string | number
  topicTitle?: string | null
  teacherId?: string | number | null
  teacherName?: string | null
  selectionTime?: string | null
  status: SelectionStatus
  reviewerId?: string | number | null
  auditComment?: string | null
  reviewTime?: string | null
  createTime?: string | null
  editTime?: string | null
  updateTime?: string | null
}

export interface SelectionQuery {
  current: number
  pageSize: number
  id?: string | number
  topicId?: string | number
  studentId?: string | number
  topicTitle?: string
  status?: SelectionStatus | ''
  sortField?: string
  sortOrder?: 'ascend' | 'descend'
}

export interface SelectionReviewPayload {
  id: string | number
  approved: boolean
  auditComment?: string
}

export const SELECTION_STATUS_LABELS: Record<SelectionStatus, string> = {
  PENDING: '待审核',
  APPROVED: '已通过',
  REJECTED: '已驳回',
  CANCELED: '已取消',
}

export const SELECTION_STATUS_OPTIONS = (
  Object.keys(SELECTION_STATUS_LABELS) as SelectionStatus[]
).map((value) => ({
  value,
  label: SELECTION_STATUS_LABELS[value],
}))
