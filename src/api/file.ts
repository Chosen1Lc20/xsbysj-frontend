import { request } from './request'
import type { FileUploadResult } from '@/types/file'

export const fileApi = {
  upload(file: File) {
    const data = new FormData()
    data.append('file', file)

    return request<FileUploadResult>({
      url: '/file/upload',
      method: 'post',
      data,
      timeout: 20_000,
    })
  },
}
