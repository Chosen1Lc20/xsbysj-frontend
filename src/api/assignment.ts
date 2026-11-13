import { request } from './request'
import { normalizePageResult } from './page'
import type { PageResult } from '@/types/api'
import type {
  AssignmentCreatePayload,
  AssignmentInfo,
  AssignmentQuery,
  AssignmentUpdatePayload,
} from '@/types/assignment'

export const assignmentApi = {
  list(params: AssignmentQuery) {
    return request<PageResult<AssignmentInfo>>({
      url: '/assignment/list/page/vo',
      method: 'post',
      data: params,
    }).then(normalizePageResult)
  },

  get(id: string | number) {
    return request<AssignmentInfo>({
      url: '/assignment/get/vo',
      method: 'get',
      params: { id },
    })
  },

  add(data: AssignmentCreatePayload) {
    return request<string | number>({
      url: '/assignment/add',
      method: 'post',
      data,
    })
  },

  update(data: AssignmentUpdatePayload) {
    return request<boolean>({
      url: '/assignment/update',
      method: 'post',
      data,
    })
  },

  remove(id: string | number) {
    return request<boolean>({
      url: '/assignment/delete',
      method: 'post',
      data: { id },
    })
  },

  issue(id: string | number) {
    return request<boolean>({
      url: '/assignment/issue',
      method: 'post',
      data: { id },
    })
  },
}
