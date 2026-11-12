import { request } from './request'
import { normalizePageResult } from './page'
import type { PageResult } from '@/types/api'
import type {
  SelectionInfo,
  SelectionQuery,
  SelectionReviewPayload,
} from '@/types/selection'

export const selectionApi = {
  list(params: SelectionQuery) {
    return request<PageResult<SelectionInfo>>({
      url: '/selection/list/page/vo',
      method: 'post',
      data: params,
    }).then(normalizePageResult)
  },

  get(id: string | number) {
    return request<SelectionInfo>({
      url: '/selection/get/vo',
      method: 'get',
      params: { id },
    })
  },

  apply(topicId: string | number) {
    return request<string | number>({
      url: '/selection/apply',
      method: 'post',
      data: { topicId },
    })
  },

  cancel(id: string | number) {
    return request<boolean>({
      url: '/selection/cancel',
      method: 'post',
      data: { id },
    })
  },

  review(data: SelectionReviewPayload) {
    return request<boolean>({
      url: '/selection/review',
      method: 'post',
      data,
    })
  },
}
