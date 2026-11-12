<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArrowRight,
  Calendar,
  Check,
  Document,
  Finished,
  Reading,
  School,
  User,
  UserFilled,
} from '@element-plus/icons-vue'
import { userApi } from '@/api/user'
import { useAuthStore } from '@/stores/auth'
import { ROLE_LABELS, type UserInfo, type UserRole } from '@/types/user'

const router = useRouter()
const authStore = useAuthStore()
const loading = ref(false)
const recentUsers = ref<UserInfo[]>([])

const stats = reactive({
  total: 0,
  student: 0,
  teacher: 0,
  admin: 0,
})

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 6) return '夜深了'
  if (hour < 12) return '上午好'
  if (hour < 18) return '下午好'
  return '晚上好'
})

const roleLabel = computed(() =>
  authStore.user ? ROLE_LABELS[authStore.user.role] : '用户',
)

const rolePercent = computed(() => {
  if (!stats.total) {
    return { student: 0, teacher: 0, admin: 0 }
  }
  return {
    student: Math.round((stats.student / stats.total) * 100),
    teacher: Math.round((stats.teacher / stats.total) * 100),
    admin: Math.round((stats.admin / stats.total) * 100),
  }
})

const dateCard = computed(() => {
  const now = new Date()
  return {
    day: String(now.getDate()).padStart(2, '0'),
    month: `${now.getMonth() + 1}月`,
    week: new Intl.DateTimeFormat('zh-CN', { weekday: 'long' }).format(now),
    year: now.getFullYear(),
  }
})

const flowSteps = [
  {
    title: '课题申报',
    description: '教师发布课题，学院完成内容审核',
    icon: Document,
  },
  {
    title: '选题确认',
    description: '学生提交志愿，教师确认双选结果',
    icon: Reading,
  },
  {
    title: '过程指导',
    description: '任务书与阶段材料在线提交审核',
    icon: User,
  },
  {
    title: '答辩归档',
    description: '安排答辩、录入成绩并统一归档',
    icon: Finished,
  },
]

async function loadDashboard() {
  if (!authStore.isAdmin) {
    return
  }

  loading.value = true
  try {
    const all = await userApi.list({
      current: 1,
      pageSize: 5,
      sortField: 'UpdateTime',
      sortOrder: 'descend',
    })
    stats.total = all.total
    recentUsers.value = all.records

    const roles: UserRole[] = ['student', 'teacher', 'admin']
    for (const role of roles) {
      const result = await userApi.list({
        current: 1,
        pageSize: 1,
        role,
      })
      stats[role] = result.total
    }
  } catch {
    // 请求层统一展示错误，页面保留可继续使用的空状态。
  } finally {
    loading.value = false
  }
}

function getInitial(name: string) {
  return name?.slice(0, 1) || '用'
}

onMounted(loadDashboard)
</script>

<template>
  <div class="dashboard">
    <section class="welcome-banner">
      <div class="welcome-content">
        <div class="welcome-eyebrow">
          <span class="pulse-dot" />
          SKY GRADUATION PROJECT WORKSPACE
        </div>
        <h2>{{ greeting }}，{{ authStore.user?.name || '老师' }}</h2>
        <p>
          欢迎进入毕业设计管理工作台。在这里集中处理账号、课题、过程材料与答辩事务，让每个环节清晰有序。
        </p>
        <div class="welcome-actions">
          <el-button
            v-if="authStore.isAdmin"
            type="primary"
            size="large"
            @click="router.push('/users')"
          >
            进入用户管理
            <el-icon class="el-icon--right"><ArrowRight /></el-icon>
          </el-button>
          <span class="identity-tag">{{ roleLabel }}工作台</span>
        </div>
      </div>

      <div class="calendar-card">
        <div class="calendar-top">
          <span>{{ dateCard.month }}</span>
          <strong>{{ dateCard.year }}</strong>
        </div>
        <div class="calendar-day">{{ dateCard.day }}</div>
        <div class="calendar-week">{{ dateCard.week }}</div>
        <div class="calendar-line" />
        <div class="calendar-note">
          <el-icon><Calendar /></el-icon>
          合理安排今日工作
        </div>
      </div>

      <div class="banner-ring ring-one" />
      <div class="banner-ring ring-two" />
      <div class="banner-lines" />
    </section>

    <section v-if="authStore.isAdmin" v-loading="loading" class="stats-grid">
      <article class="stat-card stat-total">
        <div class="stat-icon"><el-icon><UserFilled /></el-icon></div>
        <div class="stat-copy">
          <span>系统用户总数</span>
          <strong>{{ stats.total }}</strong>
          <small>当前平台全部账号</small>
        </div>
        <span class="stat-index">01</span>
      </article>
      <article class="stat-card stat-student">
        <div class="stat-icon"><el-icon><School /></el-icon></div>
        <div class="stat-copy">
          <span>学生账号</span>
          <strong>{{ stats.student }}</strong>
          <small>参与毕业设计的学生</small>
        </div>
        <span class="stat-index">02</span>
      </article>
      <article class="stat-card stat-teacher">
        <div class="stat-icon"><el-icon><Reading /></el-icon></div>
        <div class="stat-copy">
          <span>教师账号</span>
          <strong>{{ stats.teacher }}</strong>
          <small>承担指导工作的教师</small>
        </div>
        <span class="stat-index">03</span>
      </article>
      <article class="stat-card stat-admin">
        <div class="stat-icon"><el-icon><User /></el-icon></div>
        <div class="stat-copy">
          <span>管理员账号</span>
          <strong>{{ stats.admin }}</strong>
          <small>负责平台运行与审核</small>
        </div>
        <span class="stat-index">04</span>
      </article>
    </section>

    <section v-else class="profile-summary">
      <div class="profile-summary-icon">
        <el-avatar :size="58" :src="authStore.user?.avatarUrl || undefined">
          {{ getInitial(authStore.user?.name || '') }}
        </el-avatar>
      </div>
      <div class="profile-summary-copy">
        <span>当前身份</span>
        <strong>{{ roleLabel }}</strong>
        <p>
          {{ authStore.user?.department || '暂未填写所属院系' }} ·
          {{ authStore.user?.userNo || authStore.user?.useraccount }}
        </p>
      </div>
      <div class="profile-summary-status">
        <span class="status-dot" />
        账号状态正常
      </div>
    </section>

    <div class="dashboard-grid">
      <section class="panel workflow-panel">
        <div class="panel-heading">
          <div>
            <span class="section-kicker">WORKFLOW</span>
            <h3>毕业设计管理流程</h3>
          </div>
          <span class="panel-note">核心业务节点</span>
        </div>

        <div class="workflow-list">
          <article
            v-for="(step, index) in flowSteps"
            :key="step.title"
            class="workflow-item"
          >
            <div class="workflow-icon">
              <el-icon><component :is="step.icon" /></el-icon>
            </div>
            <div class="workflow-copy">
              <span>{{ String(index + 1).padStart(2, '0') }}</span>
              <strong>{{ step.title }}</strong>
              <p>{{ step.description }}</p>
            </div>
            <el-icon v-if="index < flowSteps.length - 1" class="workflow-arrow">
              <ArrowRight />
            </el-icon>
          </article>
        </div>
      </section>

      <section class="panel distribution-panel">
        <div class="panel-heading">
          <div>
            <span class="section-kicker">ACCOUNTS</span>
            <h3>账号角色分布</h3>
          </div>
          <span class="panel-note">实时数据</span>
        </div>

        <template v-if="authStore.isAdmin">
          <div class="role-ring-wrap">
            <div
              class="role-ring"
              :style="{
                '--student': `${rolePercent.student * 3.6}deg`,
                '--teacher': `${(rolePercent.student + rolePercent.teacher) * 3.6}deg`,
              }"
            >
              <div class="role-ring-inner">
                <strong>{{ stats.total }}</strong>
                <span>全部用户</span>
              </div>
            </div>
          </div>
          <div class="role-legend">
            <div>
              <i class="dot-student" />
              <span>学生</span>
              <strong>{{ stats.student }}</strong>
              <small>{{ rolePercent.student }}%</small>
            </div>
            <div>
              <i class="dot-teacher" />
              <span>教师</span>
              <strong>{{ stats.teacher }}</strong>
              <small>{{ rolePercent.teacher }}%</small>
            </div>
            <div>
              <i class="dot-admin" />
              <span>管理员</span>
              <strong>{{ stats.admin }}</strong>
              <small>{{ rolePercent.admin }}%</small>
            </div>
          </div>
        </template>
        <div v-else class="role-empty">
          <School />
          <strong>账号统计仅管理员可见</strong>
          <span>你可以在首页查看系统业务流程和账号信息。</span>
        </div>
      </section>
    </div>

    <div class="dashboard-grid bottom-grid">
      <section class="panel recent-panel">
        <div class="panel-heading">
          <div>
            <span class="section-kicker">RECENTLY UPDATED</span>
            <h3>最近维护账号</h3>
          </div>
          <el-button
            v-if="authStore.isAdmin"
            link
            type="primary"
            @click="router.push('/users')"
          >
            查看全部
            <el-icon class="el-icon--right"><ArrowRight /></el-icon>
          </el-button>
        </div>

        <div v-if="recentUsers.length" class="recent-list">
          <div v-for="item in recentUsers" :key="item.id" class="recent-item">
            <el-avatar :size="34" :src="item.avatarUrl || undefined">
              {{ getInitial(item.name) }}
            </el-avatar>
            <div class="recent-copy">
              <strong>{{ item.name }}</strong>
              <span>{{ item.useraccount }} · {{ item.userNo }}</span>
            </div>
            <span class="role-badge" :class="`role-${item.role}`">
              {{ ROLE_LABELS[item.role] }}
            </span>
          </div>
        </div>
        <el-empty
          v-else
          :image-size="68"
          :description="authStore.isAdmin ? '暂无账号数据' : '仅管理员可查看账号动态'"
        />
      </section>

      <section class="panel guide-panel">
        <div class="panel-heading">
          <div>
            <span class="section-kicker">QUICK GUIDE</span>
            <h3>系统使用提示</h3>
          </div>
        </div>
        <div class="guide-content">
          <div class="guide-mark">
            <el-icon><Check /></el-icon>
          </div>
          <div>
            <strong>账号信息由学院统一维护</strong>
            <p>
              管理员可创建和调整师生账号。若姓名、学号或院系信息有误，请及时联系学院管理员更正。
            </p>
          </div>
        </div>
        <div class="guide-footer">
          <span>数据安全</span>
          <i />
          <span>权限隔离</span>
          <i />
          <span>过程可追溯</span>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  width: 100%;
  max-width: 1580px;
  flex-direction: column;
  gap: 22px;
  margin: 0 auto;
}

.welcome-banner {
  position: relative;
  display: flex;
  min-height: 230px;
  overflow: hidden;
  align-items: center;
  justify-content: space-between;
  padding: 38px 44px;
  border-radius: var(--panel-radius);
  color: #fff;
  background:
    radial-gradient(circle at 80% 40%, rgb(77 151 255 / 24%), transparent 34%),
    linear-gradient(120deg, #102a50, #184b8d 64%, #2268bd);
  box-shadow: 0 16px 36px rgb(22 63 118 / 17%);
}

.welcome-content {
  position: relative;
  z-index: 3;
  max-width: 710px;
}

.welcome-eyebrow {
  display: flex;
  align-items: center;
  gap: 9px;
  color: rgb(195 222 255 / 68%);
  font-size: 10.8px;
  font-weight: 700;
  letter-spacing: 0.19em;
}

.pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #57d8ae;
  box-shadow: 0 0 0 4px rgb(87 216 174 / 12%);
}

.welcome-content h2 {
  margin: 17px 0 12px;
  font-size: clamp(31.2px, 3vw, 40.8px);
  font-weight: 650;
  letter-spacing: -0.035em;
}

.welcome-content p {
  max-width: 650px;
  color: rgb(213 230 250 / 68%);
  font-size: 15.6px;
  line-height: 1.85;
}

.welcome-actions {
  display: flex;
  align-items: center;
  gap: 18px;
  margin-top: 26px;
}

.welcome-actions :deep(.el-button) {
  height: 40px;
  padding: 0 18px;
  border: 0;
  border-radius: 10px;
  color: #17457f;
  background: #fff;
  font-size: 14.4px;
  font-weight: 600;
  box-shadow: 0 8px 20px rgb(2 28 65 / 18%);
}

.identity-tag {
  color: rgb(207 226 249 / 58%);
  font-size: 13.2px;
}

.calendar-card {
  position: relative;
  z-index: 3;
  display: flex;
  width: 154px;
  flex: 0 0 154px;
  align-items: center;
  flex-direction: column;
  padding: 16px 18px 14px;
  border: 1px solid rgb(255 255 255 / 16%);
  border-radius: 17px;
  background: rgb(255 255 255 / 9%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 12%);
  backdrop-filter: blur(12px);
}

.calendar-top {
  display: flex;
  width: 100%;
  justify-content: space-between;
  color: rgb(228 240 255 / 64%);
  font-size: 10.8px;
  letter-spacing: 0.06em;
}

.calendar-day {
  margin-top: 6px;
  font-size: 57.6px;
  font-weight: 300;
  letter-spacing: -0.05em;
  line-height: 1.15;
}

.calendar-week {
  color: rgb(229 241 255 / 78%);
  font-size: 13.2px;
}

.calendar-line {
  width: 100%;
  height: 1px;
  margin: 11px 0 9px;
  background: rgb(255 255 255 / 12%);
}

.calendar-note {
  display: flex;
  align-items: center;
  gap: 5px;
  color: rgb(218 234 253 / 56%);
  font-size: 10.8px;
}

.banner-ring {
  position: absolute;
  z-index: 1;
  border: 1px solid rgb(120 184 255 / 10%);
  border-radius: 50%;
}

.ring-one {
  top: -210px;
  right: 8%;
  width: 470px;
  height: 470px;
}

.ring-two {
  top: -130px;
  right: 13%;
  width: 310px;
  height: 310px;
}

.banner-lines {
  position: absolute;
  z-index: 0;
  inset: 0;
  opacity: 0.16;
  background-image: linear-gradient(
    90deg,
    transparent 49.8%,
    rgb(255 255 255 / 18%) 50%,
    transparent 50.2%
  );
  background-size: 76px 100%;
  mask-image: linear-gradient(90deg, transparent 45%, #000);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 18px;
}

.stat-card {
  position: relative;
  display: flex;
  min-height: 134px;
  overflow: hidden;
  align-items: center;
  gap: 16px;
  padding: 22px;
  border: 1px solid var(--border-color);
  border-radius: 16px;
  background: #fff;
  box-shadow: var(--panel-shadow);
}

.stat-card::after {
  position: absolute;
  right: -28px;
  bottom: -37px;
  width: 96px;
  height: 96px;
  border: 15px solid;
  border-radius: 50%;
  content: '';
  opacity: 0.045;
}

.stat-icon {
  display: grid;
  width: 46px;
  height: 46px;
  flex: 0 0 46px;
  place-items: center;
  border-radius: 13px;
  font-size: 25.2px;
}

.stat-total .stat-icon {
  color: #266bd1;
  background: #eaf2ff;
}

.stat-student .stat-icon {
  color: #167e69;
  background: #e6f7f2;
}

.stat-teacher .stat-icon {
  color: #c16a1a;
  background: #fff4e6;
}

.stat-admin .stat-icon {
  color: #7653c7;
  background: #f1edff;
}

.stat-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.stat-copy span {
  color: #768499;
  font-size: 13.2px;
}

.stat-copy strong {
  margin: 4px 0 2px;
  color: #1d2c42;
  font-size: 34.8px;
  font-weight: 700;
  line-height: 1.1;
}

.stat-copy small {
  overflow: hidden;
  color: #a0abba;
  font-size: 10.8px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stat-index {
  position: absolute;
  top: 16px;
  right: 17px;
  color: #e4e9f0;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.profile-summary {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 22px 25px;
  border: 1px solid var(--border-color);
  border-radius: 16px;
  background: #fff;
  box-shadow: var(--panel-shadow);
}

.profile-summary-copy {
  display: flex;
  flex-direction: column;
}

.profile-summary-copy span {
  color: #94a0b0;
  font-size: 12px;
}

.profile-summary-copy strong {
  margin: 3px 0;
  color: #233249;
  font-size: 21.6px;
}

.profile-summary-copy p {
  color: #8592a5;
  font-size: 13.2px;
}

.profile-summary-status {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-left: auto;
  padding: 7px 11px;
  border-radius: 8px;
  color: #168061;
  background: #eaf8f3;
  font-size: 12px;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #23b887;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(290px, 0.8fr);
  gap: 18px;
}

.bottom-grid {
  grid-template-columns: minmax(0, 1.35fr) minmax(320px, 1fr);
}

.panel {
  min-width: 0;
  padding: 22px 24px;
  border: 1px solid var(--border-color);
  border-radius: var(--panel-radius);
  background: #fff;
  box-shadow: var(--panel-shadow);
}

.panel-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 21px;
}

.section-kicker {
  color: #a0adbd;
  font-size: 9.6px;
  font-weight: 700;
  letter-spacing: 0.17em;
}

.panel-heading h3 {
  margin: 5px 0 0;
  color: #24334a;
  font-size: 18px;
  font-weight: 650;
}

.panel-note {
  padding: 5px 8px;
  border-radius: 6px;
  color: #8a99ad;
  background: #f5f7fa;
  font-size: 10.8px;
}

.workflow-list {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 5px;
}

.workflow-item {
  position: relative;
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: 10px;
  padding: 15px 10px;
  border-radius: 12px;
  transition: background 0.18s ease;
}

.workflow-item:hover {
  background: #f7faff;
}

.workflow-icon {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  place-items: center;
  border-radius: 10px;
  color: #2e73d2;
  background: #edf4ff;
  font-size: 19.2px;
}

.workflow-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.workflow-copy span {
  color: #b1bccb;
  font-size: 9.6px;
  font-weight: 700;
}

.workflow-copy strong {
  margin: 3px 0 5px;
  color: #34445a;
  font-size: 14.4px;
}

.workflow-copy p {
  color: #929eb0;
  font-size: 10.8px;
  line-height: 1.55;
}

.workflow-arrow {
  position: absolute;
  top: 25px;
  right: -7px;
  color: #d2dae4;
  font-size: 14.4px;
}

.distribution-panel {
  display: flex;
  flex-direction: column;
}

.role-ring-wrap {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 2px 0 16px;
}

.role-ring {
  display: grid;
  width: 126px;
  height: 126px;
  place-items: center;
  border-radius: 50%;
  background: conic-gradient(
    #4f8fea 0 var(--student),
    #36b792 var(--student) var(--teacher),
    #8b72d8 var(--teacher) 360deg
  );
}

.role-ring::before {
  position: absolute;
  width: 94px;
  height: 94px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 0 5px rgb(255 255 255 / 65%);
  content: '';
}

.role-ring-inner {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.role-ring-inner strong {
  color: #26364c;
  font-size: 30px;
  line-height: 1.1;
}

.role-ring-inner span {
  margin-top: 3px;
  color: #929eaf;
  font-size: 10.8px;
}

.role-legend {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.role-legend > div {
  display: grid;
  grid-template-columns: 8px 1fr auto 34px;
  align-items: center;
  gap: 8px;
}

.role-legend i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.dot-student {
  background: #4f8fea;
}

.dot-teacher {
  background: #36b792;
}

.dot-admin {
  background: #8b72d8;
}

.role-legend span {
  color: #758398;
  font-size: 12px;
}

.role-legend strong {
  color: #37475d;
  font-size: 13.2px;
}

.role-legend small {
  color: #a3aebe;
  font-size: 10.8px;
  text-align: right;
}

.role-empty {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  padding: 20px;
  color: #a4b0c0;
  text-align: center;
}

.role-empty svg {
  width: 34px;
  margin-bottom: 13px;
  opacity: 0.5;
}

.role-empty strong {
  color: #6f7e92;
  font-size: 14.4px;
}

.role-empty span {
  margin-top: 7px;
  font-size: 10.8px;
}

.recent-list {
  display: flex;
  flex-direction: column;
}

.recent-item {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 10px 4px;
  border-bottom: 1px solid #f0f3f7;
}

.recent-item:last-child {
  border-bottom: 0;
}

.recent-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.recent-copy strong {
  color: #38485e;
  font-size: 13.2px;
  font-weight: 600;
}

.recent-copy span {
  overflow: hidden;
  margin-top: 3px;
  color: #9aa6b6;
  font-size: 10.8px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.role-badge {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 10.8px;
}

.role-admin {
  color: #7355b8;
  background: #f1edff;
}

.role-teacher {
  color: #b86820;
  background: #fff3e4;
}

.role-student {
  color: #2375c7;
  background: #eaf3ff;
}

.guide-content {
  display: flex;
  align-items: flex-start;
  gap: 13px;
  padding: 18px;
  border-radius: 13px;
  background: linear-gradient(135deg, #f6f9ff, #fbfcfe);
}

.guide-mark {
  display: grid;
  width: 35px;
  height: 35px;
  flex: 0 0 35px;
  place-items: center;
  border-radius: 10px;
  color: #3278d8;
  background: #e7f0ff;
}

.guide-content strong {
  color: #3a4a60;
  font-size: 13.2px;
}

.guide-content p {
  margin-top: 7px;
  color: #8896a8;
  font-size: 10.8px;
  line-height: 1.75;
}

.guide-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 18px;
  color: #97a4b5;
  font-size: 10.8px;
}

.guide-footer i {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #c9d2dd;
}

@media (max-width: 1240px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .workflow-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .workflow-item:nth-child(2) .workflow-arrow {
    display: none;
  }
}

@media (max-width: 1020px) {
  .dashboard-grid,
  .bottom-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 680px) {
  .welcome-banner {
    min-height: auto;
    padding: 28px 25px;
  }

  .calendar-card {
    display: none;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .workflow-list {
    grid-template-columns: 1fr;
  }

  .workflow-arrow {
    display: none;
  }

  .profile-summary {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .profile-summary-status {
    width: 100%;
    margin-left: 0;
  }
}
</style>

