import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AppLayout from '@/layouts/AppLayout.vue'

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { title: '登录' },
    },
    {
      path: '/',
      component: AppLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'home',
          component: () => import('@/views/HomeView.vue'),
          meta: { title: '首页', requiresAuth: true },
        },
        {
          path: 'users',
          name: 'users',
          component: () => import('@/views/UserManagementView.vue'),
          meta: {
            title: '用户管理',
            requiresAuth: true,
            adminOnly: true,
          },
        },
        {
          path: 'topics',
          name: 'topics',
          component: () => import('@/views/TopicManagementView.vue'),
          meta: {
            title: '课题管理',
            requiresAuth: true,
          },
        },
        {
          path: 'selections',
          name: 'selections',
          component: () => import('@/views/SelectionManagementView.vue'),
          meta: {
            title: '选题管理',
            requiresAuth: true,
          },
        },
        {
          path: 'assignments',
          name: 'assignments',
          component: () => import('@/views/AssignmentManagementView.vue'),
          meta: {
            title: '任务书管理',
            requiresAuth: true,
          },
        },
        {
          path: 'documents',
          name: 'documents',
          component: () => import('@/views/DocumentManagementView.vue'),
          meta: {
            title: '过程文档',
            requiresAuth: true,
          },
        },
        {
          path: 'defenses',
          name: 'defenses',
          component: () => import('@/views/DefenseManagementView.vue'),
          meta: {
            title: '答辩分组',
            requiresAuth: true,
          },
        },
        {
          path: 'files',
          name: 'files',
          component: () => import('@/views/FileUploadView.vue'),
          meta: {
            title: '文件上传',
            requiresAuth: true,
          },
        },
        {
          path: 'profile',
          name: 'profile',
          component: () => import('@/views/ProfileView.vue'),
          meta: {
            title: '个人主页',
            requiresAuth: true,
          },
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
      meta: { title: '页面不存在' },
    },
  ],
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()

  if (to.meta.requiresAuth) {
    const loggedIn = await authStore.restoreSession()
    if (!loggedIn) {
      return {
        name: 'login',
        query: { redirect: to.fullPath },
      }
    }

    if (to.meta.adminOnly && !authStore.isAdmin) {
      return { name: 'home' }
    }
  }

  if (to.name === 'login') {
    await authStore.restoreSession()
    if (authStore.isLoggedIn) {
      return { name: 'home' }
    }
  }

  document.title = `${String(to.meta.title || 'Sky毕业设计管理系统')} - Sky毕业设计管理系统`
  return true
})

export default router
