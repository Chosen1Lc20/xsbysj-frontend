export type DocumentType =
  | 'OPENING_REPORT'
  | 'MIDTERM_CHECK'
  | 'FIRST_DRAFT'
  | 'FINAL_DRAFT'

export type DocumentAuditStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface DocumentInfo {
  id: string | number
  selectionId: string | number
  studentId: string | number
  studentName?: string | null
  studentNo?: string | null
  studentDepartment?: string | null
  topicId: string | number
  topicTitle?: string | null
  teacherId: string | number
  teacherName?: string | null
  documentType: DocumentType
  documentTypeText?: string | null
  version: number
  latest: boolean
  fileRecordId: string | number
  fileName?: string | null
  fileUrl?: string | null
  fileExtension?: string | null
  fileSize?: string | number | null
  submitTime?: string | null
  auditStatus: DocumentAuditStatus
  auditStatusText?: string | null
  reviewerId?: string | number | null
  reviewerName?: string | null
  auditComment?: string | null
  reviewTime?: string | null
  createTime?: string | null
  editTime?: string | null
  updateTime?: string | null
}

export interface DocumentQuery {
  current: number
  pageSize: number
  id?: string | number
  selectionId?: string | number
  topicId?: string | number
  studentId?: string | number
  teacherId?: string | number
  documentType?: DocumentType | ''
  auditStatus?: DocumentAuditStatus | ''
  latestOnly?: boolean
  sortField?: string
  sortOrder?: 'ascend' | 'descend'
}

export interface DocumentSubmitPayload {
  selectionId: string | number
  documentType: DocumentType
  fileRecordId: string | number
}

export interface DocumentReviewPayload {
  id: string | number
  approved: boolean
  auditComment?: string
}

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  OPENING_REPORT: '开题报告',
  MIDTERM_CHECK: '中期检查',
  FIRST_DRAFT: '论文初稿',
  FINAL_DRAFT: '论文终稿',
}

export const DOCUMENT_TYPE_OPTIONS = (
  Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[]
).map((value) => ({
  value,
  label: DOCUMENT_TYPE_LABELS[value],
}))

export const DOCUMENT_TYPE_DESCRIPTIONS: Record<DocumentType, string> = {
  OPENING_REPORT: '说明研究背景、目标、技术路线和进度安排',
  MIDTERM_CHECK: '汇报阶段进展、阶段成果和后续工作计划',
  FIRST_DRAFT: '提交完整论文初稿供指导教师审阅',
  FINAL_DRAFT: '提交修改完善后的论文终稿',
}

export const DOCUMENT_AUDIT_STATUS_LABELS: Record<
  DocumentAuditStatus,
  string
> = {
  PENDING: '待审核',
  APPROVED: '审核通过',
  REJECTED: '审核驳回',
}

export const DOCUMENT_AUDIT_STATUS_OPTIONS = (
  Object.keys(DOCUMENT_AUDIT_STATUS_LABELS) as DocumentAuditStatus[]
).map((value) => ({
  value,
  label: DOCUMENT_AUDIT_STATUS_LABELS[value],
}))
