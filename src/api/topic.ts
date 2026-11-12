import { request } from './request'
import { normalizePageResult } from './page'
import type { PageResult } from '@/types/api'
import type {
  TopicForm,
  TopicInfo,
  TopicQuery,
  TopicReviewPayload,
} from '@/types/topic'

export const topicApi = {
  list(params: TopicQuery) {
    return request<PageResult<TopicInfo>>({
      url: '/topic/list/page/vo',
      method: 'post',
      data: params,
    }).then(normalizePageResult)
  },

  get(id: string | number) {
    return request<TopicInfo>({
      url: '/topic/get/vo',
      method: 'get',
      params: { id },
    })
  },

  add(data: TopicForm) {
    return request<string | number>({
      url: '/topic/add',
      method: 'post',
      data,
    })
  },

  update(data: TopicForm) {
    return request<boolean>({
      url: '/topic/update',
      method: 'post',
      data,
    })
  },

  remove(id: string | number) {
    return request<boolean>({
      url: '/topic/delete',
      method: 'post',
      data: { id },
    })
  },

  submit(id: string | number) {
    return request<boolean>({
      url: '/topic/submit',
      method: 'post',
      data: { id },
    })
  },

  review(data: TopicReviewPayload) {
    return request<boolean>({
      url: '/topic/review',
      method: 'post',
      data,
    })
  },
}
