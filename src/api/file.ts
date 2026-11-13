import { request } from './request'
import type { FileUploadResult } from '@/types/file'

export const fileApi = {
  upload(file: File, onProgress?: (percent: number) => void) {
    const data = new FormData()
    data.append('file', file)

    return request<FileUploadResult>({
      url: '/file/upload',
      method: 'post',
      data,
      timeout: 20_000,
      onUploadProgress: (event) => {
        if (event.total && onProgress) {
          onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)))
        }
      },
    })
  },
}
