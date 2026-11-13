import { request } from './request'
import { normalizePageResult } from './page'
import type { PageResult } from '@/types/api'
import type {
  DocumentInfo,
  DocumentQuery,
  DocumentReviewPayload,
  DocumentSubmitPayload,
} from '@/types/document'

export const documentApi = {
  list(params: DocumentQuery) {
    return request<PageResult<DocumentInfo>>({
      url: '/document/list/page/vo',
      method: 'post',
      data: params,
    }).then(normalizePageResult)
  },

  get(id: string | number) {
    return request<DocumentInfo>({
      url: '/document/get/vo',
      method: 'get',
      params: { id },
    })
  },

  submit(data: DocumentSubmitPayload) {
    return request<string | number>({
      url: '/document/submit',
      method: 'post',
      data,
    })
  },

  review(data: DocumentReviewPayload) {
    return request<boolean>({
      url: '/document/review',
      method: 'post',
      data,
    })
  },
}
