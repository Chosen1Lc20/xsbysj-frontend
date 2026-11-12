export type UserRole = 'admin' | 'teacher' | 'student'

export interface UserInfo {
  id: string | number
  useraccount: string
  userNo: string
  name: string
  role: UserRole
  department?: string | null
  avatarUrl?: string | null
}

export interface LoginForm {
  useraccount: string
  password: string
}

export interface UserQuery {
  current: number
  pageSize: number
  useraccount?: string
  userNo?: string
  name?: string
  role?: UserRole | ''
  department?: string
  sortField?: string
  sortOrder?: 'ascend' | 'descend'
}

export interface UserForm {
  id?: string | number
  useraccount: string
  password?: string
  userNo: string
  name: string
  role: UserRole
  department: string
  avatarUrl: string
}

export interface UserUpdatePayload {
  id: string | number
  useraccount?: string
  password?: string
  userNo?: string
  name?: string
  role?: UserRole
  department?: string
  avatarUrl?: string
}

export interface TeacherOption {
  id: string | number
  userNo: string
  name: string
  department?: string | null
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: '管理员',
  teacher: '指导教师',
  student: '学生',
}

export const ROLE_OPTIONS: Array<{ label: string; value: UserRole }> = [
  { label: '管理员', value: 'admin' },
  { label: '指导教师', value: 'teacher' },
  { label: '学生', value: 'student' },
]
