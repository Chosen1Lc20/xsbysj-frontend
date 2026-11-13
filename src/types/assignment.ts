export type AssignmentStatus = 'DRAFT' | 'ISSUED'

export interface AssignmentInfo {
  id: string | number
  selectionId: string | number
  studentId?: string | number | null
  studentName?: string | null
  studentNo?: string | null
  studentDepartment?: string | null
  topicId: string | number
  topicTitle?: string | null
  teacherId: string | number
  teacherName?: string | null
  title: string
  content?: string | null
  fileRecordId?: string | number | null
  fileName?: string | null
  fileUrl?: string | null
  deadline?: string | null
  status: AssignmentStatus
  issueTime?: string | null
  createTime?: string | null
  editTime?: string | null
  updateTime?: string | null
}

export interface AssignmentSelectionContext {
  id: string | number
  topicTitle?: string | null
  studentName?: string | null
  studentNo?: string | null
  studentDepartment?: string | null
}

export interface AssignmentQuery {
  current: number
  pageSize: number
  selectionId?: string | number
  topicId?: string | number
  studentId?: string | number
  teacherId?: string | number
  title?: string
  status?: AssignmentStatus | ''
  sortField?: string
  sortOrder?: 'ascend' | 'descend'
}

export interface AssignmentCreatePayload {
  selectionId: string | number
  title: string
  content?: string
  deadline: string
  fileRecordId?: string | number | null
}

export interface AssignmentUpdatePayload {
  id: string | number
  title: string
  content?: string
  deadline: string
  fileRecordId?: string | number | null
}

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  DRAFT: '草稿',
  ISSUED: '已下发',
}

export const ASSIGNMENT_STATUS_OPTIONS = (
  Object.keys(ASSIGNMENT_STATUS_LABELS) as AssignmentStatus[]
).map((value) => ({
  value,
  label: ASSIGNMENT_STATUS_LABELS[value],
}))
