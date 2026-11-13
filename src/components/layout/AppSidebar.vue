<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import {
  Document,
  Files,
  HomeFilled,
  Reading,
  Tickets,
  UploadFilled,
  User,
} from '@element-plus/icons-vue'
import AppLogo from '@/components/AppLogo.vue'
import { useAuthStore } from '@/stores/auth'
import { ROLE_LABELS } from '@/types/user'

const props = defineProps<{
  collapsed?: boolean
}>()

const emit = defineEmits<{
  navigate: []
}>()

const route = useRoute()
const authStore = useAuthStore()

const activeMenu = computed(() => route.path)
const roleLabel = computed(() =>
  authStore.user ? ROLE_LABELS[authStore.user.role] : '访客',
)
</script>

<template>
  <div class="sidebar-inner">
    <div class="sidebar-brand">
      <AppLogo :compact="props.collapsed" />
    </div>

    <div v-if="!props.collapsed" class="menu-caption">工作台</div>
    <el-menu
      :default-active="activeMenu"
      :collapse="props.collapsed"
      :collapse-transition="false"
      router
      class="sidebar-menu"
      @select="emit('navigate')"
    >
      <el-menu-item index="/">
        <el-icon><HomeFilled /></el-icon>
        <template #title>首页</template>
      </el-menu-item>
      <el-menu-item index="/topics">
        <el-icon><Reading /></el-icon>
        <template #title>课题管理</template>
      </el-menu-item>
      <el-menu-item index="/selections">
        <el-icon><Tickets /></el-icon>
        <template #title>选题管理</template>
      </el-menu-item>
      <el-menu-item index="/assignments">
        <el-icon><Document /></el-icon>
        <template #title>任务书管理</template>
      </el-menu-item>
      <el-menu-item index="/documents">
        <el-icon><Files /></el-icon>
        <template #title>过程文档</template>
      </el-menu-item>
      <el-menu-item index="/files">
        <el-icon><UploadFilled /></el-icon>
        <template #title>文件上传</template>
      </el-menu-item>
      <el-menu-item v-if="authStore.isAdmin" index="/users">
        <el-icon><User /></el-icon>
        <template #title>用户管理</template>
      </el-menu-item>
    </el-menu>

    <div class="sidebar-spacer" />

    <div v-if="!props.collapsed" class="sidebar-tip">
      <span class="tip-dot" />
      <div>
        <strong>系统运行正常</strong>
        <span>数据已与后端服务同步</span>
      </div>
    </div>

    <div class="sidebar-user" :class="{ compact: props.collapsed }">
      <el-avatar
        :size="34"
        :src="authStore.user?.avatarUrl || undefined"
        class="sidebar-avatar"
      >
        {{ authStore.user?.name?.slice(0, 1) || '用' }}
      </el-avatar>
      <div v-if="!props.collapsed" class="sidebar-user-copy">
        <strong>{{ authStore.user?.name || '当前用户' }}</strong>
        <span>{{ roleLabel }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sidebar-inner {
  display: flex;
  height: 100%;
  flex-direction: column;
  padding: 0 14px 18px;
}

.sidebar-brand {
  display: flex;
  height: 76px;
  align-items: center;
  padding: 0 8px;
}

.menu-caption {
  padding: 22px 14px 10px;
  color: rgb(178 200 229 / 48%);
  font-size: 13.2px;
  font-weight: 600;
  letter-spacing: 0.14em;
}

.sidebar-menu {
  border-right: 0;
  background: transparent;
}

.sidebar-menu:not(.el-menu--collapse) {
  width: 100%;
}

.sidebar-menu :deep(.el-menu-item) {
  height: 48px;
  margin: 5px 0;
  border-radius: 11px;
  color: rgb(214 226 242 / 72%);
}

.sidebar-menu :deep(.el-menu-item .el-icon) {
  width: 24px;
  font-size: 22.8px;
}

.sidebar-menu :deep(.el-menu-item:hover) {
  color: #fff;
  background: rgb(255 255 255 / 7%);
}

.sidebar-menu :deep(.el-menu-item.is-active) {
  color: #fff;
  background: linear-gradient(90deg, rgb(52 126 255 / 88%), rgb(52 126 255 / 54%));
  box-shadow: 0 8px 20px rgb(9 48 112 / 22%);
}

.sidebar-menu :deep(.el-menu-item.is-active::after) {
  position: absolute;
  right: 12px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #a8d1ff;
  content: '';
}

.sidebar-spacer {
  flex: 1;
}

.sidebar-tip {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0 5px 16px;
  padding: 13px 12px;
  border: 1px solid rgb(255 255 255 / 7%);
  border-radius: 12px;
  background: rgb(255 255 255 / 4%);
}

.tip-dot {
  width: 8px;
  height: 8px;
  flex: 0 0 8px;
  margin-top: 5px;
  border-radius: 50%;
  background: #45d6a2;
  box-shadow: 0 0 0 4px rgb(69 214 162 / 10%);
}

.sidebar-tip div {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.sidebar-tip strong {
  color: rgb(235 244 255 / 88%);
  font-size: 14.4px;
  font-weight: 600;
}

.sidebar-tip span:last-child {
  margin-top: 4px;
  color: rgb(190 209 233 / 45%);
  font-size: 12px;
}

.sidebar-user {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 10px 0;
  border-top: 1px solid rgb(255 255 255 / 8%);
}

.sidebar-user.compact {
  justify-content: center;
  padding-inline: 0;
}

.sidebar-avatar {
  color: #dcecff;
  background: linear-gradient(135deg, #2f78dd, #174a94);
}

.sidebar-user-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.sidebar-user-copy strong {
  overflow: hidden;
  color: #f4f8ff;
  font-size: 15.6px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar-user-copy span {
  margin-top: 3px;
  color: rgb(185 205 230 / 53%);
  font-size: 13.2px;
}
</style>

