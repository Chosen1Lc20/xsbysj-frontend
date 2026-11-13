export interface DefenseTeacher {
  id: string | number
  teacherId: string | number
  teacherNo?: string | null
  teacherName?: string | null
  teacherDepartment?: string | null
}

export interface DefenseStudent {
  id: string | number
  studentId: string | number
  studentNo?: string | null
  studentName?: string | null
  studentDepartment?: string | null
  selectionId: string | number
  topicId?: string | number | null
  topicTitle?: string | null
  teacherId?: string | number | null
  teacherName?: string | null
}

export interface DefenseGroupInfo {
  id: string | number
  groupName: string
  defenseTime: string
  location: string
  remark?: string | null
  teachers: DefenseTeacher[]
  students: DefenseStudent[]
  createTime?: string | null
  editTime?: string | null
  updateTime?: string | null
}

export interface DefenseGroupQuery {
  current: number
  pageSize: number
  id?: string | number
  groupName?: string
  location?: string
  teacherId?: string | number
  studentId?: string | number
  selectionId?: string | number
  defenseTimeStart?: string
  defenseTimeEnd?: string
  sortField?: string
  sortOrder?: 'ascend' | 'descend'
}

export interface DefenseGroupSavePayload {
  id?: string | number
  groupName: string
  defenseTime: string
  location: string
  remark?: string
  teacherIds: Array<string | number>
  studentIds: Array<string | number>
}
