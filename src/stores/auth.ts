import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { userApi } from '@/api/user'
import type { LoginForm, UserInfo } from '@/types/user'
import {
  clearStoredUser,
  getStoredUser,
  setStoredUser,
} from '@/utils/session'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserInfo | null>(getStoredUser())
  const initialized = ref(false)
  const loginLoading = ref(false)

  const isLoggedIn = computed(() => Boolean(user.value))
  const isAdmin = computed(() => user.value?.role === 'admin')

  async function login(form: LoginForm) {
    loginLoading.value = true
    try {
      const currentUser = await userApi.login(form)
      user.value = currentUser
      setStoredUser(currentUser)
      initialized.value = true
      return currentUser
    } finally {
      loginLoading.value = false
    }
  }

  async function restoreSession() {
    if (initialized.value) {
      return Boolean(user.value)
    }

    if (!user.value) {
      initialized.value = true
      return false
    }

    try {
      const currentUser = await userApi.getCurrentUser()
      user.value = currentUser
      setStoredUser(currentUser)
      return true
    } catch {
      user.value = null
      clearStoredUser()
      return false
    } finally {
      initialized.value = true
    }
  }

  async function logout() {
    try {
      await userApi.logout()
    } catch {
      // 即使服务端会话已失效，也继续清理本地状态。
    } finally {
      user.value = null
      initialized.value = true
      clearStoredUser()
    }
  }

  function setCurrentUser(currentUser: UserInfo) {
    user.value = currentUser
    setStoredUser(currentUser)
  }

  return {
    user,
    initialized,
    loginLoading,
    isLoggedIn,
    isAdmin,
    login,
    restoreSession,
    setCurrentUser,
    logout,
  }
})
