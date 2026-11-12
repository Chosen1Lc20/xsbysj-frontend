import axios, { AxiosError, type AxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'
import type { ApiResponse } from '@/types/api'
import { clearStoredUser } from '@/utils/session'

const client = axios.create({
  baseURL: '/api',
  timeout: 10_000,
  withCredentials: true,
})

export class ApiError extends Error {
  code: number

  constructor(code: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

function redirectToLogin() {
  clearStoredUser()
  if (window.location.pathname === '/login') {
    return
  }
  const redirect = `${window.location.pathname}${window.location.search}`
  window.location.replace(`/login?redirect=${encodeURIComponent(redirect)}`)
}

client.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.code === 'ECONNABORTED') {
      ElMessage.error('请求超时，请稍后重试')
    } else if (!error.response) {
      ElMessage.error('无法连接服务器，请确认后端服务已启动')
    } else if (error.response.status >= 500) {
      ElMessage.error('服务暂时不可用，请稍后重试')
    } else if (error.response.status !== 200) {
      ElMessage.error('请求失败，请稍后重试')
    }
    return Promise.reject(error)
  },
)

export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await client.request<ApiResponse<T>>(config)
  const result = response.data

  if (result.code === 0) {
    return result.data
  }

  if (result.code === 40100) {
    redirectToLogin()
  }

  const message = result.message || '操作失败，请稍后重试'
  ElMessage.error(message)
  throw new ApiError(result.code, message)
}

export default client
