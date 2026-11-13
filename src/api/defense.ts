import { request } from './request'
import { normalizePageResult } from './page'
import type { PageResult } from '@/types/api'
import type {
  DefenseGroupInfo,
  DefenseGroupQuery,
  DefenseGroupSavePayload,
} from '@/types/defense'

export const defenseGroupApi = {
  list(params: DefenseGroupQuery) {
    return request<PageResult<DefenseGroupInfo>>({
      url: '/defense/group/list/page/vo',
      method: 'post',
      data: params,
    }).then(normalizePageResult)
  },

  get(id: string | number) {
    return request<DefenseGroupInfo>({
      url: '/defense/group/get/vo',
      method: 'get',
      params: { id },
    })
  },

  add(data: DefenseGroupSavePayload) {
    return request<string | number>({
      url: '/defense/group/add',
      method: 'post',
      data,
    })
  },

  update(data: DefenseGroupSavePayload) {
    return request<boolean>({
      url: '/defense/group/update',
      method: 'post',
      data,
    })
  },

  remove(id: string | number) {
    return request<boolean>({
      url: '/defense/group/delete',
      method: 'post',
      data: { id },
    })
  },
}
