import { request } from './request'
import { normalizePageResult } from './page'
import type { PageResult } from '@/types/api'
import type {
  LoginForm,
  UserForm,
  UserInfo,
  UserQuery,
  TeacherOption,
  UserUpdatePayload,
} from '@/types/user'

export const userApi = {
  login(data: LoginForm) {
    return request<UserInfo>({
      url: '/user/login',
      method: 'post',
      data,
    })
  },

  getCurrentUser() {
    return request<UserInfo>({
      url: '/user/me',
      method: 'get',
    })
  },

  logout() {
    return request<string>({
      url: '/user/logout',
      method: 'post',
    })
  },

  listTeachers() {
    return request<TeacherOption[]>({
      url: '/user/teachers',
      method: 'get',
    })
  },

  async list(params: UserQuery) {
    const page = await request<PageResult<UserInfo>>({
      url: '/user/list/page/vo',
      method: 'post',
      data: params,
    })
    return normalizePageResult(page)
  },

  add(data: UserForm) {
    return request<string | number>({
      url: '/user/add',
      method: 'post',
      data,
    })
  },

  update(data: UserUpdatePayload) {
    return request<boolean>({
      url: '/user/update',
      method: 'post',
      data,
    })
  },

  remove(id: string | number) {
    return request<boolean>({
      url: '/user/delete',
      method: 'post',
      data: { id },
    })
  },
}
