export type TopicStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED'

export interface TopicInfo {
  id: string | number
  teacherId: string | number
  teacherName?: string | null
  teacherDepartment?: string | null
  title: string
  description?: string | null
  type?: string | null
  maxStudents: number
  selectedCount: string | number
  remainingSlots: number
  status: TopicStatus
  reviewerId?: string | number | null
  auditComment?: string | null
  reviewTime?: string | null
  createTime?: string | null
  editTime?: string | null
  updateTime?: string | null
}

export interface TopicQuery {
  current: number
  pageSize: number
  title?: string
  type?: string
  status?: TopicStatus | ''
  teacherId?: string | number
  sortField?: string
  sortOrder?: 'ascend' | 'descend'
}

export interface TopicForm {
  id?: string | number
  title: string
  description: string
  type: string
  maxStudents: number
}

export interface TopicReviewPayload {
  id: string | number
  approved: boolean
  auditComment?: string
}

export const TOPIC_STATUS_LABELS: Record<TopicStatus, string> = {
  DRAFT: '草稿',
  PENDING: '待审核',
  APPROVED: '审核通过',
  REJECTED: '审核驳回',
}

export const TOPIC_STATUS_OPTIONS = (
  Object.keys(TOPIC_STATUS_LABELS) as TopicStatus[]
).map((value) => ({
  value,
  label: TOPIC_STATUS_LABELS[value],
}))

export const TOPIC_TYPE_SUGGESTIONS = [
  '软件开发',
  '工程设计',
  '应用研究',
  '理论研究',
  '数据分析',
  '人工智能应用',
  '网络与信息安全',
  '其他',
]
