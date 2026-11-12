<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowDown,
  Expand,
  Fold,
  SwitchButton,
  UserFilled,
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import { useAuthStore } from '@/stores/auth'
import { ROLE_LABELS } from '@/types/user'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const sidebarCollapsed = ref(false)
const mobileSidebarOpen = ref(false)
const isMobile = ref(false)

const currentTitle = computed(() => String(route.meta.title || '首页'))
const roleLabel = computed(() =>
  authStore.user ? ROLE_LABELS[authStore.user.role] : '访客',
)
const todayText = new Intl.DateTimeFormat('zh-CN', {
  month: 'long',
  day: 'numeric',
  weekday: 'long',
}).format(new Date())

function syncViewport() {
  isMobile.value = window.innerWidth <= 900
  if (!isMobile.value) {
    mobileSidebarOpen.value = false
  }
}

function toggleSidebar() {
  if (isMobile.value) {
    mobileSidebarOpen.value = !mobileSidebarOpen.value
    return
  }
  sidebarCollapsed.value = !sidebarCollapsed.value
}

async function handleUserCommand(command: string) {
  if (command === 'profile') {
    await router.push({ name: 'profile' })
    return
  }
  if (command !== 'logout') {
    return
  }
  await authStore.logout()
  ElMessage.success('已安全退出')
  await router.replace({ name: 'login' })
}

onMounted(() => {
  syncViewport()
  window.addEventListener('resize', syncViewport)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', syncViewport)
})
</script>

<template>
  <div class="app-shell">
    <aside
      class="app-sidebar"
      :class="{
        'is-collapsed': sidebarCollapsed,
        'is-mobile-open': mobileSidebarOpen,
      }"
    >
      <AppSidebar
        :collapsed="sidebarCollapsed"
        @navigate="mobileSidebarOpen = false"
      />
    </aside>

    <button
      v-if="mobileSidebarOpen"
      class="sidebar-overlay"
      aria-label="关闭侧边栏"
      @click="mobileSidebarOpen = false"
    />

    <div class="app-body">
      <header class="app-header">
        <div class="header-left">
          <button
            class="icon-button"
            :aria-label="sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'"
            @click="toggleSidebar"
          >
            <el-icon :size="19">
              <Expand v-if="sidebarCollapsed || isMobile" />
              <Fold v-else />
            </el-icon>
          </button>
          <div class="page-heading">
            <div class="breadcrumb-line">
              <span>毕业设计管理</span>
              <i>/</i>
              <strong>{{ currentTitle }}</strong>
            </div>
            <h1>{{ currentTitle }}</h1>
          </div>
        </div>

        <div class="header-right">
          <div class="header-date">
            <span>今日</span>
            <strong>{{ todayText }}</strong>
          </div>

          <el-dropdown
            :trigger="isMobile ? 'click' : 'hover'"
            :show-timeout="100"
            :hide-timeout="180"
            popper-class="user-dropdown"
            @command="handleUserCommand"
          >
            <button class="user-trigger">
              <el-avatar
                :size="36"
                :src="authStore.user?.avatarUrl || undefined"
                class="header-avatar"
              >
                {{ authStore.user?.name?.slice(0, 1) || '用' }}
              </el-avatar>
              <span class="user-meta">
                <strong>{{ authStore.user?.name || '当前用户' }}</strong>
                <small>{{ roleLabel }}</small>
              </span>
              <el-icon class="user-arrow"><ArrowDown /></el-icon>
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">
                  <el-icon><UserFilled /></el-icon>
                  个人主页
                </el-dropdown-item>
                <el-dropdown-item divided command="logout">
                  <el-icon><SwitchButton /></el-icon>
                  退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <main class="app-main">
        <RouterView />
      </main>

      <footer class="app-footer">
        <span>Sky毕业设计管理系统</span>
        <span class="footer-separator" />
        <span>让毕业设计管理更清晰、更高效</span>
        <span class="footer-version">v1.0.0</span>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  min-height: 100vh;
  background: var(--app-bg);
}

.app-sidebar {
  position: fixed;
  z-index: 40;
  inset: 0 auto 0 0;
  width: var(--sidebar-width);
  overflow: hidden;
  background:
    radial-gradient(circle at 20% 0, rgb(62 131 232 / 18%), transparent 28%),
    linear-gradient(180deg, #0d2444 0%, #081a33 100%);
  box-shadow: 8px 0 30px rgb(12 37 71 / 10%);
  transition: width 0.22s ease, transform 0.22s ease;
}

.app-sidebar.is-collapsed {
  width: var(--sidebar-collapsed-width);
}

.app-body {
  display: flex;
  width: calc(100% - var(--sidebar-width));
  min-height: 100vh;
  flex-direction: column;
  margin-left: var(--sidebar-width);
  transition: width 0.22s ease, margin-left 0.22s ease;
}

.app-sidebar.is-collapsed + .app-body {
  width: calc(100% - var(--sidebar-collapsed-width));
  margin-left: var(--sidebar-collapsed-width);
}

.app-header {
  position: sticky;
  z-index: 30;
  top: 0;
  display: flex;
  min-height: var(--header-height);
  align-items: center;
  justify-content: space-between;
  padding: 0 30px;
  border-bottom: 1px solid var(--border-color);
  background: rgb(255 255 255 / 88%);
  box-shadow: 0 4px 18px rgb(27 54 93 / 4%);
  backdrop-filter: blur(16px);
}

.header-left,
.header-right,
.user-trigger {
  display: flex;
  align-items: center;
}

.header-left {
  gap: 18px;
}

.header-right {
  gap: 24px;
}

.icon-button {
  display: grid;
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  place-items: center;
  border: 1px solid #e8edf5;
  border-radius: 11px;
  color: #52637b;
  background: #fff;
  cursor: pointer;
  transition: 0.18s ease;
}

.icon-button:hover {
  border-color: #cddcf1;
  color: var(--primary-color);
  background: #f5f9ff;
}

.breadcrumb-line {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #94a1b3;
  font-size: 13.2px;
}

.breadcrumb-line i {
  color: #c2cbd7;
  font-style: normal;
}

.breadcrumb-line strong {
  color: #66758a;
  font-weight: 500;
}

.page-heading h1 {
  margin: 3px 0 0;
  color: #17243a;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.header-date {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1.35;
}

.header-date span {
  color: #a0aaba;
  font-size: 12px;
}

.header-date strong {
  color: #52647c;
  font-size: 14.4px;
  font-weight: 600;
}

.user-trigger {
  gap: 10px;
  padding: 4px 6px 4px 4px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  cursor: pointer;
  transition: background 0.18s ease;
}

.user-trigger:hover {
  background: #f4f7fb;
}

.header-avatar {
  color: #eaf4ff;
  background: linear-gradient(135deg, #2e75d8, #174883);
}

.user-meta {
  display: flex;
  min-width: 70px;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
}

.user-meta strong {
  color: #26354b;
  font-size: 15.6px;
  font-weight: 600;
}

.user-meta small {
  margin-top: 2px;
  color: #98a4b4;
  font-size: 12px;
}

.user-arrow {
  margin-left: 2px;
  color: #9ba8b9;
  font-size: 14.4px;
}

.app-main {
  display: flex;
  width: 100%;
  flex: 1;
  flex-direction: column;
  padding: 26px 30px 30px;
}

.app-footer {
  display: flex;
  min-height: 52px;
  align-items: center;
  gap: 10px;
  padding: 0 30px;
  border-top: 1px solid #e9eef5;
  color: #9aa7b8;
  font-size: 13.2px;
}

.footer-separator {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #c8d1dd;
}

.footer-version {
  margin-left: auto;
  color: #b3bdc9;
}

.sidebar-overlay {
  position: fixed;
  z-index: 35;
  inset: 0;
  border: 0;
  background: rgb(9 26 49 / 48%);
  backdrop-filter: blur(2px);
}

@media (max-width: 900px) {
  .app-sidebar,
  .app-sidebar.is-collapsed {
    width: min(84vw, var(--sidebar-width));
    transform: translateX(-102%);
  }

  .app-sidebar.is-mobile-open {
    transform: translateX(0);
  }

  .app-body,
  .app-sidebar.is-collapsed + .app-body {
    width: 100%;
    margin-left: 0;
  }

  .app-header {
    padding: 0 18px;
  }

  .header-date,
  .user-meta {
    display: none;
  }

  .header-right {
    gap: 8px;
  }

  .app-main {
    padding: 20px 18px 24px;
  }

  .app-footer {
    padding: 0 18px;
  }
}

@media (max-width: 520px) {
  .breadcrumb-line {
    display: none;
  }

  .page-heading h1 {
    margin: 0;
    font-size: 21.6px;
  }

  .footer-separator,
  .app-footer span:nth-child(3) {
    display: none;
  }
}
</style>

