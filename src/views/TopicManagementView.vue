<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowRight,
  Check,
  Collection,
  Delete,
  EditPen,
  Plus,
  Refresh,
  Search,
  Tickets,
  View,
  Warning,
} from '@element-plus/icons-vue'
import { selectionApi } from '@/api/selection'
import { topicApi } from '@/api/topic'
import { userApi } from '@/api/user'
import { useAuthStore } from '@/stores/auth'
import type { SelectionInfo } from '@/types/selection'
import {
  TOPIC_STATUS_LABELS,
  TOPIC_STATUS_OPTIONS,
  TOPIC_TYPE_SUGGESTIONS,
  type TopicForm,
  type TopicInfo,
  type TopicQuery,
  type TopicStatus,
} from '@/types/topic'
import type { TeacherOption } from '@/types/user'
import { formatDateTime } from '@/utils/format'

const router = useRouter()
const authStore = useAuthStore()
const loading = ref(false)
const submitting = ref(false)
const topics = ref<TopicInfo[]>([])
const total = ref(0)
const teachers = ref<TeacherOption[]>([])
const activeSelection = ref<SelectionInfo | null>(null)
const detailVisible = ref(false)
const selectedTopic = ref<TopicInfo | null>(null)
const formVisible = ref(false)
const formMode = ref<'add' | 'edit'>('add')
const formRef = ref<FormInstance>()
const reviewVisible = ref(false)
const reviewTopic = ref<TopicInfo | null>(null)
const reviewApproved = ref(true)
const reviewComment = ref('')
const reviewSubmitting = ref(false)

const query = reactive<TopicQuery>({
  current: 1,
  pageSize: 9,
  title: '',
  type: '',
  status: '',
  teacherId: undefined,
  sortField: 'updateTime',
  sortOrder: 'descend',
})

const stats = reactive({
  total: 0,
  pending: 0,
  approved: 0,
  improve: 0,
})

const emptyForm = (): TopicForm => ({
  title: '',
  description: '',
  type: '',
  maxStudents: 1,
})

const form = reactive<TopicForm>(emptyForm())

const isStudent = computed(() => authStore.user?.role === 'student')
const isTeacher = computed(() => authStore.user?.role === 'teacher')
const isEditing = computed(() => formMode.value === 'edit')

const pageCopy = computed(() => {
  if (isStudent.value) {
    return {
      kicker: 'TOPIC EXPLORATION',
      title: '发现毕业设计课题',
      description:
        '浏览学院已审核通过的课题，结合研究方向和指导教师选择适合自己的毕业设计。',
    }
  }
  if (isTeacher.value) {
    return {
      kicker: 'MY TOPICS',
      title: '我的课题',
      description:
        '创建和维护本人发布的毕业设计课题，提交学院审核并查看审核反馈。',
    }
  }
  return {
    kicker: 'TOPIC REVIEW',
    title: '课题审核管理',
    description:
      '查看教师申报的毕业设计课题，审核内容与名额设置并给出明确意见。',
  }
})

const activeStatus = computed(() =>
  activeSelection.value
    ? {
        PENDING: '待教师审核',
        APPROVED: '选题已通过',
        REJECTED: '选题已驳回',
        CANCELED: '选题已取消',
      }[activeSelection.value.status]
    : '尚未提交选题',
)

const rules: FormRules = {
  title: [
    { required: true, message: '请输入课题名称', trigger: 'blur' },
    { max: 255, message: '课题名称不能超过 255 个字符', trigger: 'blur' },
  ],
  type: [
    { required: true, message: '请选择或输入课题类型', trigger: 'change' },
    { max: 64, message: '课题类型不能超过 64 个字符', trigger: 'blur' },
  ],
  maxStudents: [
    { required: true, message: '请设置可选人数', trigger: 'change' },
    {
      validator: (_rule, value, callback) => {
        if (!Number.isInteger(value) || value < 1 || value > 20) {
          callback(new Error('可选人数必须为 1 至 20 的整数'))
          return
        }
        callback()
      },
      trigger: 'change',
    },
  ],
  description: [
    { required: true, message: '请输入课题简介', trigger: 'blur' },
    { max: 5000, message: '课题简介不能超过 5000 个字符', trigger: 'blur' },
  ],
}

function getInitial(name?: string | null) {
  return name?.slice(0, 1) || '师'
}

function selectedNumber(topic: TopicInfo) {
  return Number(topic.selectedCount) || 0
}

function quotaPercent(topic: TopicInfo) {
  if (!topic.maxStudents) {
    return 0
  }
  return Math.min(100, Math.round((selectedNumber(topic) / topic.maxStudents) * 100))
}

function canEdit(topic: TopicInfo) {
  return topic.status === 'DRAFT' || topic.status === 'REJECTED'
}

function isActiveTopic(topic: TopicInfo) {
  return activeSelection.value?.topicId === topic.id
}

function canApply(topic: TopicInfo) {
  return (
    isStudent.value &&
    !activeSelection.value &&
    topic.remainingSlots > 0 &&
    topic.status === 'APPROVED'
  )
}

function statusClass(status: TopicStatus) {
  return `status-${status.toLowerCase()}`
}

async function loadTopics() {
  loading.value = true
  try {
    const result = await topicApi.list(query)
    topics.value = result.records
    total.value = result.total
  } catch {
    topics.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

async function loadStats() {
  if (isStudent.value) {
    return
  }
  try {
    const [draft, pending, approved, rejected] = await Promise.all(
      (['DRAFT', 'PENDING', 'APPROVED', 'REJECTED'] as TopicStatus[]).map(
        (status) =>
          topicApi.list({
            current: 1,
            pageSize: 1,
            status,
          }),
      ),
    )
    stats.total = draft.total + pending.total + approved.total + rejected.total
    stats.pending = pending.total
    stats.approved = approved.total
    stats.improve = draft.total + rejected.total
  } catch {
    stats.total = 0
    stats.pending = 0
    stats.approved = 0
    stats.improve = 0
  }
}

async function loadTeachers() {
  try {
    teachers.value = await userApi.listTeachers()
  } catch {
    teachers.value = []
  }
}

async function loadActiveSelection() {
  if (!isStudent.value) {
    return
  }
  try {
    const [pending, approved] = await Promise.all([
      selectionApi.list({ current: 1, pageSize: 1, status: 'PENDING' }),
      selectionApi.list({ current: 1, pageSize: 1, status: 'APPROVED' }),
    ])
    activeSelection.value = pending.records[0] || approved.records[0] || null
  } catch {
    activeSelection.value = null
  }
}

function handleSearch() {
  query.current = 1
  loadTopics()
}

function handleReset() {
  Object.assign(query, {
    current: 1,
    pageSize: 9,
    title: '',
    type: '',
    status: '',
    teacherId: undefined,
    sortField: 'updateTime',
    sortOrder: 'descend',
  })
  loadTopics()
}

function openDetail(topic: TopicInfo) {
  selectedTopic.value = topic
  detailVisible.value = true
}

function resetTopicForm() {
  Object.assign(form, emptyForm())
  delete form.id
  nextTick(() => formRef.value?.clearValidate())
}

function openAddForm() {
  formMode.value = 'add'
  resetTopicForm()
  formVisible.value = true
}

function openEditForm(topic: TopicInfo) {
  formMode.value = 'edit'
  Object.assign(form, {
    id: topic.id,
    title: topic.title,
    description: topic.description || '',
    type: topic.type || '',
    maxStudents: topic.maxStudents,
  })
  formVisible.value = true
  nextTick(() => formRef.value?.clearValidate())
}

async function saveTopic() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) {
    return
  }

  submitting.value = true
  try {
    if (isEditing.value && form.id !== undefined) {
      await topicApi.update({ ...form, id: form.id })
      ElMessage.success('课题信息已更新')
    } else {
      await topicApi.add({ ...form })
      ElMessage.success('课题已创建')
    }
    formVisible.value = false
    await Promise.all([loadTopics(), loadStats()])
  } catch {
    // 请求层统一显示错误信息。
  } finally {
    submitting.value = false
  }
}

async function deleteTopic(topic: TopicInfo) {
  try {
    await ElMessageBox.confirm(
      `确定删除课题“${topic.title}”吗？删除后无法恢复。`,
      '删除课题',
      {
        confirmButtonText: '确认删除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'danger-confirm-button',
      },
    )
    await topicApi.remove(topic.id)
    ElMessage.success('课题已删除')
    detailVisible.value = false
    await Promise.all([loadTopics(), loadStats()])
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      return
    }
  }
}

async function submitTopic(topic: TopicInfo) {
  try {
    await ElMessageBox.confirm(
      `提交“${topic.title}”后，审核完成前将不能继续修改。确认提交吗？`,
      '提交课题审核',
      {
        confirmButtonText: '确认提交',
        cancelButtonText: '暂不提交',
        type: 'info',
      },
    )
    await topicApi.submit(topic.id)
    ElMessage.success('课题已提交审核')
    detailVisible.value = false
    await Promise.all([loadTopics(), loadStats()])
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      return
    }
  }
}

function openReview(topic: TopicInfo) {
  reviewTopic.value = topic
  reviewApproved.value = true
  reviewComment.value = ''
  reviewVisible.value = true
}

async function submitReview() {
  if (!reviewTopic.value) {
    return
  }
  if (!reviewApproved.value && !reviewComment.value.trim()) {
    ElMessage.warning('驳回课题时必须填写审核意见')
    return
  }

  reviewSubmitting.value = true
  try {
    await topicApi.review({
      id: reviewTopic.value.id,
      approved: reviewApproved.value,
      auditComment: reviewComment.value.trim(),
    })
    ElMessage.success(reviewApproved.value ? '课题已审核通过' : '课题已驳回')
    reviewVisible.value = false
    detailVisible.value = false
    await Promise.all([loadTopics(), loadStats()])
  } catch {
    // 请求层统一显示错误信息。
  } finally {
    reviewSubmitting.value = false
  }
}

async function applyTopic(topic: TopicInfo) {
  try {
    await ElMessageBox.confirm(
      `确认申请“${topic.title}”吗？提交后需等待指导教师审核。`,
      '申请课题',
      {
        confirmButtonText: '提交申请',
        cancelButtonText: '再考虑一下',
        type: 'info',
      },
    )
    await selectionApi.apply(topic.id)
    ElMessage.success('选题申请已提交')
    detailVisible.value = false
    await Promise.all([loadTopics(), loadActiveSelection()])
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      return
    }
  }
}

onMounted(async () => {
  await Promise.all([
    loadTopics(),
    loadStats(),
    loadTeachers(),
    loadActiveSelection(),
  ])
})
</script>

<template>
  <div class="topic-page">
    <section class="page-intro">
      <div>
        <span class="intro-kicker">{{ pageCopy.kicker }}</span>
        <h2>{{ pageCopy.title }}</h2>
        <p>{{ pageCopy.description }}</p>
      </div>
      <el-button
        v-if="isTeacher"
        type="primary"
        size="large"
        :icon="Plus"
        @click="openAddForm"
      >
        发布课题
      </el-button>
    </section>

    <section v-if="isStudent" class="student-overview">
      <article class="overview-card overview-available">
        <span class="overview-icon"><el-icon><Collection /></el-icon></span>
        <div>
          <span>当前可选课题</span>
          <strong>{{ total }}</strong>
          <small>均为学院审核通过的课题</small>
        </div>
      </article>
      <article class="overview-card overview-selection">
        <span class="overview-icon"><el-icon><Tickets /></el-icon></span>
        <div>
          <span>我的当前选题</span>
          <strong class="selection-title">
            {{ activeSelection?.topicTitle || '暂未选择课题' }}
          </strong>
          <small>
            {{ activeSelection?.teacherName || '选择课题后等待指导教师审核' }}
          </small>
        </div>
      </article>
      <article class="overview-card overview-status">
        <span
          class="status-orb"
          :class="{
            pending: activeSelection?.status === 'PENDING',
            approved: activeSelection?.status === 'APPROVED',
          }"
        />
        <div>
          <span>选题状态</span>
          <strong>{{ activeStatus }}</strong>
          <el-button link type="primary" @click="router.push('/selections')">
            查看我的选题
            <el-icon class="el-icon--right"><ArrowRight /></el-icon>
          </el-button>
        </div>
      </article>
    </section>

    <section v-else class="summary-grid">
      <article class="summary-card">
        <span class="summary-icon summary-blue"><el-icon><Collection /></el-icon></span>
        <div><span>课题总数</span><strong>{{ stats.total }}</strong></div>
        <small>全部课题</small>
      </article>
      <article class="summary-card">
        <span class="summary-icon summary-orange"><el-icon><Warning /></el-icon></span>
        <div><span>待审核</span><strong>{{ stats.pending }}</strong></div>
        <small>等待学院处理</small>
      </article>
      <article class="summary-card">
        <span class="summary-icon summary-green"><el-icon><Check /></el-icon></span>
        <div><span>审核通过</span><strong>{{ stats.approved }}</strong></div>
        <small>可进入学生选题</small>
      </article>
      <article class="summary-card">
        <span class="summary-icon summary-purple"><el-icon><EditPen /></el-icon></span>
        <div><span>待完善</span><strong>{{ stats.improve }}</strong></div>
        <small>草稿或审核驳回</small>
      </article>
    </section>

    <section class="filter-panel">
      <el-form
        :model="query"
        label-position="top"
        class="filter-form"
        @submit.prevent="handleSearch"
      >
        <el-form-item label="课题名称">
          <el-input
            v-model="query.title"
            placeholder="输入课题名称"
            clearable
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="课题类型">
          <el-select
            v-model="query.type"
            placeholder="全部类型"
            clearable
            filterable
            allow-create
          >
            <el-option
              v-for="type in TOPIC_TYPE_SUGGESTIONS"
              :key="type"
              :label="type"
              :value="type"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="!isStudent" label="课题状态">
          <el-select v-model="query.status" placeholder="全部状态" clearable>
            <el-option
              v-for="option in TOPIC_STATUS_OPTIONS"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="!isTeacher" label="指导教师">
          <el-select
            v-model="query.teacherId"
            placeholder="全部教师"
            clearable
            filterable
          >
            <el-option
              v-for="teacher in teachers"
              :key="teacher.id"
              :label="`${teacher.name} · ${teacher.department || teacher.userNo}`"
              :value="teacher.id"
            />
          </el-select>
        </el-form-item>
        <div class="filter-actions">
          <el-button type="primary" :icon="Search" @click="handleSearch">
            查询
          </el-button>
          <el-button :icon="Refresh" @click="handleReset">重置</el-button>
        </div>
      </el-form>
    </section>

    <section v-loading="loading" class="topic-list-section">
      <div class="list-heading">
        <div>
          <h3>{{ isStudent ? '课题列表' : '课题管理列表' }}</h3>
          <p>共找到 {{ total }} 个课题</p>
        </div>
        <span v-if="isStudent && activeSelection" class="selection-lock-tip">
          已有进行中的选题，暂不能申请其他课题
        </span>
      </div>

      <div v-if="topics.length" class="topic-grid">
        <article
          v-for="(topic, index) in topics"
          :key="topic.id"
          class="topic-card"
          :class="{ exhausted: topic.remainingSlots <= 0 }"
          :style="{ '--delay': `${index * 35}ms` }"
        >
          <div class="topic-card-top">
            <span class="topic-type">{{ topic.type || '未分类' }}</span>
            <span
              class="topic-status"
              :class="statusClass(topic.status)"
            >
              {{ TOPIC_STATUS_LABELS[topic.status] }}
            </span>
          </div>

          <h3>{{ topic.title }}</h3>
          <p class="topic-description">
            {{ topic.description || '指导教师暂未填写课题简介。' }}
          </p>

          <div v-if="isTeacher && topic.status === 'REJECTED' && topic.auditComment" class="audit-hint">
            <el-icon><Warning /></el-icon>
            <span>{{ topic.auditComment }}</span>
          </div>

          <div class="teacher-row">
            <el-avatar :size="34">
              {{ getInitial(topic.teacherName) }}
            </el-avatar>
            <div>
              <strong>{{ topic.teacherName || '未分配教师' }}</strong>
              <span>{{ topic.teacherDepartment || '院系未填写' }}</span>
            </div>
          </div>

          <div class="quota-block">
            <div class="quota-copy">
              <span>已选 {{ selectedNumber(topic) }} / {{ topic.maxStudents }} 人</span>
              <strong :class="{ full: topic.remainingSlots <= 0 }">
                {{ topic.remainingSlots > 0 ? `剩余 ${topic.remainingSlots} 个名额` : '名额已满' }}
              </strong>
            </div>
            <div class="quota-track">
              <span
                :class="{ full: topic.remainingSlots <= 0 }"
                :style="{ width: `${quotaPercent(topic)}%` }"
              />
            </div>
          </div>

          <div class="topic-actions">
            <el-button :icon="View" @click="openDetail(topic)">查看详情</el-button>
            <template v-if="isStudent">
              <el-button
                v-if="isActiveTopic(topic)"
                type="success"
                plain
                disabled
              >
                已申请该课题
              </el-button>
              <el-button
                v-else
                type="primary"
                :disabled="!canApply(topic)"
                @click="applyTopic(topic)"
              >
                {{ topic.remainingSlots <= 0 ? '名额已满' : '申请选题' }}
              </el-button>
            </template>
            <template v-else-if="isTeacher">
              <el-button
                v-if="canEdit(topic)"
                type="primary"
                plain
                :icon="EditPen"
                @click="openEditForm(topic)"
              >
                编辑
              </el-button>
              <el-button
                v-if="canEdit(topic)"
                type="primary"
                @click="submitTopic(topic)"
              >
                提交审核
              </el-button>
              <el-button
                v-if="canEdit(topic)"
                type="danger"
                link
                :icon="Delete"
                @click="deleteTopic(topic)"
              >
                删除
              </el-button>
            </template>
            <template v-else>
              <el-button
                v-if="topic.status === 'PENDING'"
                type="primary"
                @click="openReview(topic)"
              >
                审核课题
              </el-button>
              <el-button v-else type="primary" plain @click="openDetail(topic)">
                查看审核信息
              </el-button>
            </template>
          </div>
        </article>
      </div>

      <el-empty
        v-else
        :image-size="100"
        :description="isStudent ? '暂无符合条件且可选的课题' : '暂无符合条件的课题'"
      />

      <div v-if="total" class="pagination-wrap">
        <span>每页 {{ query.pageSize }} 条，共 {{ total }} 条</span>
        <el-pagination
          v-model:current-page="query.current"
          v-model:page-size="query.pageSize"
          :total="total"
          :page-sizes="[9, 18, 36, 45]"
          layout="prev, pager, next, sizes"
          background
          @current-change="loadTopics"
          @size-change="handleSearch"
        />
      </div>
    </section>

    <el-drawer
      v-model="detailVisible"
      title="课题详情"
      size="min(540px, 92vw)"
      class="topic-drawer"
    >
      <template v-if="selectedTopic">
        <div class="drawer-heading">
          <div>
            <span class="topic-type">{{ selectedTopic.type || '未分类' }}</span>
            <span
              class="topic-status"
              :class="statusClass(selectedTopic.status)"
            >
              {{ TOPIC_STATUS_LABELS[selectedTopic.status] }}
            </span>
          </div>
          <h2>{{ selectedTopic.title }}</h2>
          <div class="drawer-teacher">
            <el-avatar :size="42">{{ getInitial(selectedTopic.teacherName) }}</el-avatar>
            <div>
              <strong>{{ selectedTopic.teacherName }}</strong>
              <span>{{ selectedTopic.teacherDepartment || '院系未填写' }}</span>
            </div>
          </div>
        </div>

        <div class="detail-section">
          <h4>课题简介</h4>
          <p class="detail-description">
            {{ selectedTopic.description || '指导教师暂未填写课题简介。' }}
          </p>
        </div>

        <div class="detail-stats">
          <div><span>计划人数</span><strong>{{ selectedTopic.maxStudents }}</strong></div>
          <div><span>已选人数</span><strong>{{ selectedNumber(selectedTopic) }}</strong></div>
          <div><span>剩余名额</span><strong>{{ selectedTopic.remainingSlots }}</strong></div>
        </div>

        <div v-if="selectedTopic.auditComment" class="audit-panel">
          <div class="audit-panel-title">
            <el-icon><Check /></el-icon>
            学院审核意见
          </div>
          <p>{{ selectedTopic.auditComment }}</p>
          <span>审核时间：{{ formatDateTime(selectedTopic.reviewTime) }}</span>
        </div>

        <div class="detail-timeline">
          <div><span>创建时间</span><strong>{{ formatDateTime(selectedTopic.createTime) }}</strong></div>
          <div><span>最近更新</span><strong>{{ formatDateTime(selectedTopic.updateTime) }}</strong></div>
        </div>
      </template>

      <template #footer>
        <div v-if="selectedTopic" class="drawer-footer">
          <template v-if="isStudent">
            <el-button @click="detailVisible = false">关闭</el-button>
            <el-button
              type="primary"
              :disabled="!canApply(selectedTopic)"
              @click="applyTopic(selectedTopic)"
            >
              {{ isActiveTopic(selectedTopic) ? '已申请该课题' : '申请选题' }}
            </el-button>
          </template>
          <template v-else-if="isTeacher">
            <el-button
              v-if="canEdit(selectedTopic)"
              :icon="EditPen"
              @click="openEditForm(selectedTopic)"
            >
              编辑课题
            </el-button>
            <el-button
              v-if="canEdit(selectedTopic)"
              type="primary"
              @click="submitTopic(selectedTopic)"
            >
              提交审核
            </el-button>
          </template>
          <template v-else>
            <el-button @click="detailVisible = false">关闭</el-button>
            <el-button
              v-if="selectedTopic.status === 'PENDING'"
              type="primary"
              @click="openReview(selectedTopic)"
            >
              审核课题
            </el-button>
          </template>
        </div>
      </template>
    </el-drawer>

    <el-dialog
      v-model="formVisible"
      :title="isEditing ? '编辑课题' : '发布新课题'"
      width="min(680px, 92vw)"
      destroy-on-close
      class="topic-form-dialog"
    >
      <p class="dialog-tip">
        课题创建后默认为草稿状态，确认内容无误后提交学院审核。
      </p>
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
      >
        <el-form-item label="课题名称" prop="title">
          <el-input
            v-model="form.title"
            placeholder="请输入清晰、具体的课题名称"
            maxlength="255"
            show-word-limit
          />
        </el-form-item>
        <div class="form-row">
          <el-form-item label="课题类型" prop="type">
            <el-select
              v-model="form.type"
              placeholder="选择或输入类型"
              filterable
              allow-create
              default-first-option
            >
              <el-option
                v-for="type in TOPIC_TYPE_SUGGESTIONS"
                :key="type"
                :label="type"
                :value="type"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="可选人数" prop="maxStudents">
            <el-input-number
              v-model="form.maxStudents"
              :min="1"
              :max="20"
              controls-position="right"
            />
          </el-form-item>
        </div>
        <el-form-item label="课题简介" prop="description">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="7"
            placeholder="介绍研究背景、主要内容、预期成果及对学生的要求"
            maxlength="5000"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="saveTopic">
          {{ isEditing ? '保存修改' : '创建课题' }}
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="reviewVisible"
      title="审核课题"
      width="min(560px, 92vw)"
      destroy-on-close
    >
      <div v-if="reviewTopic" class="review-summary">
        <span class="topic-type">{{ reviewTopic.type || '未分类' }}</span>
        <h3>{{ reviewTopic.title }}</h3>
        <p>{{ reviewTopic.teacherName }} · {{ reviewTopic.teacherDepartment }}</p>
      </div>
      <el-form label-position="top" class="review-form">
        <el-form-item label="审核结果">
          <el-radio-group v-model="reviewApproved" class="review-options">
            <el-radio-button :value="true">审核通过</el-radio-button>
            <el-radio-button :value="false">驳回修改</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item :label="reviewApproved ? '审核意见（选填）' : '驳回原因'">
          <el-input
            v-model="reviewComment"
            type="textarea"
            :rows="5"
            :placeholder="reviewApproved ? '可填写补充说明' : '请明确说明需要修改的内容'"
            maxlength="1000"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reviewVisible = false">取消</el-button>
        <el-button
          :type="reviewApproved ? 'primary' : 'danger'"
          :loading="reviewSubmitting"
          @click="submitReview"
        >
          {{ reviewApproved ? '确认通过' : '确认驳回' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.topic-page {
  display: flex;
  width: 100%;
  max-width: 1580px;
  flex-direction: column;
  gap: 20px;
  margin: 0 auto;
}

.page-intro {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 5px 2px 3px;
}

.intro-kicker {
  color: #4384dc;
  font-size: 10.8px;
  font-weight: 700;
  letter-spacing: 0.18em;
}

.page-intro h2 {
  margin: 7px 0 7px;
  color: #1c2b42;
  font-size: 28.8px;
  font-weight: 700;
  letter-spacing: -0.03em;
}

.page-intro p {
  color: #8795a8;
  font-size: 13.2px;
  line-height: 1.7;
}

.page-intro :deep(.el-button) {
  height: 42px;
  padding: 0 18px;
  border-radius: 10px;
  font-size: 13.2px;
}

.student-overview {
  display: grid;
  grid-template-columns: 0.8fr 1.35fr 1fr;
  gap: 17px;
}

.overview-card {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 14px;
  padding: 20px 21px;
  border: 1px solid var(--border-color);
  border-radius: 16px;
  background: #fff;
  box-shadow: var(--panel-shadow);
}

.overview-icon {
  display: grid;
  width: 46px;
  height: 46px;
  flex: 0 0 46px;
  place-items: center;
  border-radius: 13px;
  color: #2e72d0;
  background: #eaf2ff;
  font-size: 22.8px;
}

.overview-selection .overview-icon {
  color: #19836b;
  background: #e8f8f3;
}

.overview-card > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.overview-card span:not(.overview-icon, .status-orb) {
  color: #8e9bad;
  font-size: 10.8px;
}

.overview-card strong {
  overflow: hidden;
  margin: 3px 0;
  color: #27374d;
  font-size: 25.2px;
  font-weight: 700;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.overview-card strong.selection-title {
  font-size: 15.6px;
}

.overview-card small {
  overflow: hidden;
  color: #a1acba;
  font-size: 10.8px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.overview-status {
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, #f7fbff, #fff);
}

.status-orb {
  width: 14px;
  height: 14px;
  flex: 0 0 14px;
  border: 4px solid #d5deea;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 0 6px rgb(162 176 194 / 10%);
}

.status-orb.pending {
  border-color: #e7a13c;
  box-shadow: 0 0 0 6px rgb(231 161 60 / 10%);
}

.status-orb.approved {
  border-color: #34b28c;
  box-shadow: 0 0 0 6px rgb(52 178 140 / 10%);
}

.overview-card :deep(.el-button) {
  align-self: flex-start;
  height: auto;
  margin-top: 3px;
  padding: 0;
  font-size: 10.8px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.summary-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 13px;
  min-height: 112px;
  padding: 18px 20px;
  border: 1px solid var(--border-color);
  border-radius: 15px;
  background: #fff;
  box-shadow: var(--panel-shadow);
}

.summary-icon {
  display: grid;
  width: 43px;
  height: 43px;
  flex: 0 0 43px;
  place-items: center;
  border-radius: 12px;
  font-size: 21.6px;
}

.summary-blue {
  color: #2d70cb;
  background: #eaf2ff;
}

.summary-orange {
  color: #bd721f;
  background: #fff3e2;
}

.summary-green {
  color: #188269;
  background: #e7f7f2;
}

.summary-purple {
  color: #7358b9;
  background: #f0edff;
}

.summary-card > div {
  display: flex;
  flex-direction: column;
}

.summary-card > div span {
  color: #7e8c9e;
  font-size: 10.8px;
}

.summary-card > div strong {
  margin-top: 2px;
  color: #26364c;
  font-size: 27.6px;
  line-height: 1.15;
}

.summary-card > small {
  margin-left: auto;
  align-self: flex-end;
  color: #a4afbd;
  font-size: 9.6px;
}

.filter-panel,
.topic-list-section {
  border: 1px solid var(--border-color);
  border-radius: var(--panel-radius);
  background: #fff;
  box-shadow: var(--panel-shadow);
}

.filter-panel {
  padding: 20px 22px 3px;
}

.filter-form {
  display: grid;
  grid-template-columns:
    minmax(190px, 1.2fr) minmax(150px, 0.85fr) minmax(150px, 0.85fr)
    minmax(180px, 1fr) auto;
  gap: 14px;
  align-items: end;
}

.filter-form :deep(.el-form-item) {
  margin-bottom: 17px;
}

.filter-form :deep(.el-form-item__label) {
  padding-bottom: 6px;
  color: #6f7e91;
  font-size: 10.8px;
  font-weight: 600;
}

.filter-form :deep(.el-input__wrapper),
.filter-form :deep(.el-select__wrapper) {
  min-height: 40px;
  border-radius: 9px;
  box-shadow: 0 0 0 1px #e4e9f1 inset;
}

.filter-form :deep(.el-input__inner),
.filter-form :deep(.el-select__placeholder),
.filter-form :deep(.el-select__selected-item) {
  font-size: 12px;
}

.filter-form :deep(.el-select) {
  width: 100%;
}

.filter-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 17px;
}

.filter-actions :deep(.el-button) {
  min-height: 40px;
  border-radius: 9px;
  font-size: 12px;
}

.topic-list-section {
  min-height: 340px;
  padding: 22px 23px 18px;
}

.list-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 19px;
}

.list-heading h3 {
  color: #2a394f;
  font-size: 18px;
  font-weight: 650;
}

.list-heading p {
  margin-top: 4px;
  color: #98a5b5;
  font-size: 10.8px;
}

.selection-lock-tip {
  padding: 7px 10px;
  border-radius: 8px;
  color: #a06a25;
  background: #fff7e9;
  font-size: 10.8px;
}

.topic-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 17px;
}

.topic-card {
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 350px;
  flex-direction: column;
  padding: 20px;
  border: 1px solid #e8edf4;
  border-radius: 15px;
  background: #fff;
  box-shadow: 0 5px 16px rgb(32 63 104 / 3%);
  animation: card-in 0.34s ease both;
  animation-delay: var(--delay);
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.topic-card:hover {
  border-color: #ccdcf0;
  box-shadow: 0 12px 28px rgb(33 77 133 / 8%);
  transform: translateY(-2px);
}

.topic-card.exhausted:not(:has(.topic-status)) {
  background: #fbfcfe;
}

.topic-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.topic-type,
.topic-status {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  padding: 5px 9px;
  border-radius: 7px;
  font-size: 10.8px;
  font-weight: 600;
}

.topic-type {
  overflow: hidden;
  color: #3075cf;
  background: #eaf2ff;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topic-status {
  margin-left: auto;
}

.status-draft {
  color: #6f7c8e;
  background: #f1f4f8;
}

.status-pending {
  color: #ad6b1e;
  background: #fff3e1;
}

.status-approved {
  color: #197b63;
  background: #e7f7f1;
}

.status-rejected {
  color: #b64d4d;
  background: #ffeded;
}

.topic-card > h3 {
  display: -webkit-box;
  overflow: hidden;
  margin: 16px 0 9px;
  color: #26364c;
  font-size: 18px;
  font-weight: 650;
  letter-spacing: -0.015em;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.topic-description {
  display: -webkit-box;
  overflow: hidden;
  min-height: 49px;
  color: #8491a3;
  font-size: 12px;
  line-height: 1.7;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.audit-hint {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin-top: 11px;
  padding: 9px 10px;
  border-radius: 8px;
  color: #a9574b;
  background: #fff3f1;
  font-size: 10.8px;
  line-height: 1.55;
}

.audit-hint .el-icon {
  margin-top: 2px;
  flex: 0 0 auto;
}

.teacher-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: auto;
  padding-top: 16px;
}

.teacher-row .el-avatar {
  color: #e8f4ff;
  background: linear-gradient(135deg, #4386d9, #245d9c);
  font-size: 12px;
}

.teacher-row > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.teacher-row strong {
  color: #405066;
  font-size: 12px;
  font-weight: 600;
}

.teacher-row span {
  overflow: hidden;
  margin-top: 2px;
  color: #9aa6b5;
  font-size: 10.8px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quota-block {
  margin-top: 14px;
  padding-top: 13px;
  border-top: 1px solid #eef2f6;
}

.quota-copy {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.quota-copy span {
  color: #8d99aa;
  font-size: 10.8px;
}

.quota-copy strong {
  color: #3172c8;
  font-size: 10.8px;
  font-weight: 600;
}

.quota-copy strong.full {
  color: #b45a54;
}

.quota-track {
  height: 5px;
  overflow: hidden;
  margin-top: 8px;
  border-radius: 5px;
  background: #edf1f6;
}

.quota-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #62a5f1, #2872d0);
}

.quota-track span.full {
  background: linear-gradient(90deg, #e39a73, #ce655c);
}

.topic-actions {
  display: flex;
  min-height: 34px;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
  margin-top: 16px;
}

.topic-actions :deep(.el-button) {
  height: 34px;
  margin-left: 0;
  padding: 0 11px;
  border-radius: 8px;
  font-size: 10.8px;
}

.topic-actions :deep(.el-button:first-child) {
  border-color: #dfe6ef;
  color: #63748a;
  background: #fff;
}

.topic-actions :deep(.el-button.is-link) {
  padding-inline: 3px;
}

.pagination-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 21px;
  padding-top: 17px;
  border-top: 1px solid #edf1f5;
}

.pagination-wrap > span {
  color: #9ba6b5;
  font-size: 10.8px;
}

.pagination-wrap :deep(.el-pagination) {
  --el-pagination-button-bg-color: #f4f7fa;
  --el-pagination-hover-color: #2f74d4;
  font-size: 10.8px;
}

.pagination-wrap :deep(.el-pagination button),
.pagination-wrap :deep(.el-pager li) {
  border-radius: 7px;
}

.drawer-heading {
  padding-bottom: 22px;
  border-bottom: 1px solid #edf1f5;
}

.drawer-heading > div:first-child {
  display: flex;
  gap: 8px;
}

.drawer-heading h2 {
  margin: 15px 0 18px;
  color: #24334a;
  font-size: 24px;
  line-height: 1.45;
}

.drawer-teacher {
  display: flex;
  align-items: center;
  gap: 11px;
}

.drawer-teacher .el-avatar {
  color: #e8f4ff;
  background: linear-gradient(135deg, #4386d9, #245d9c);
}

.drawer-teacher > div {
  display: flex;
  flex-direction: column;
}

.drawer-teacher strong {
  color: #3b4b61;
  font-size: 12px;
}

.drawer-teacher span {
  margin-top: 3px;
  color: #94a0b0;
  font-size: 10.8px;
}

.detail-section {
  padding: 23px 0 20px;
}

.detail-section h4 {
  color: #48586d;
  font-size: 12px;
}

.detail-description {
  margin-top: 10px;
  color: #748297;
  font-size: 12px;
  line-height: 1.9;
  white-space: pre-wrap;
}

.detail-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.detail-stats > div {
  display: flex;
  align-items: center;
  flex-direction: column;
  padding: 14px 8px;
  border-radius: 11px;
  background: #f6f9fc;
}

.detail-stats span {
  color: #94a0af;
  font-size: 9.6px;
}

.detail-stats strong {
  margin-top: 3px;
  color: #2c3d54;
  font-size: 21.6px;
}

.audit-panel {
  margin-top: 18px;
  padding: 15px 16px;
  border: 1px solid #dfeee9;
  border-radius: 11px;
  background: #f4fbf8;
}

.audit-panel-title {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #287d68;
  font-size: 11px;
  font-weight: 600;
}

.audit-panel p {
  margin: 9px 0 7px;
  color: #5f746d;
  font-size: 11px;
  line-height: 1.75;
}

.audit-panel > span {
  color: #93a39e;
  font-size: 9.6px;
}

.detail-timeline {
  display: flex;
  flex-direction: column;
  gap: 9px;
  margin-top: 20px;
  padding-top: 17px;
  border-top: 1px solid #edf1f5;
}

.detail-timeline > div {
  display: flex;
  justify-content: space-between;
}

.detail-timeline span {
  color: #9aa6b5;
  font-size: 10.8px;
}

.detail-timeline strong {
  color: #65758a;
  font-size: 10.8px;
  font-weight: 500;
}

.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 9px;
}

.drawer-footer :deep(.el-button) {
  height: 38px;
  border-radius: 9px;
  font-size: 11px;
}

.dialog-tip {
  margin: -8px 0 20px;
  padding: 11px 13px;
  border-radius: 8px;
  color: #78879a;
  background: #f6f9fc;
  font-size: 10.8px;
}

.topic-form-dialog :deep(.el-form-item__label),
.review-form :deep(.el-form-item__label) {
  padding-bottom: 7px;
  color: #5f6e82;
  font-size: 10.8px;
  font-weight: 600;
}

.topic-form-dialog :deep(.el-input__wrapper),
.topic-form-dialog :deep(.el-select__wrapper),
.review-form :deep(.el-input__wrapper) {
  border-radius: 9px;
  box-shadow: 0 0 0 1px #e1e7ef inset;
}

.topic-form-dialog :deep(.el-form-item),
.review-form :deep(.el-form-item) {
  margin-bottom: 20px;
}

.topic-form-dialog :deep(.el-select),
.topic-form-dialog :deep(.el-input-number) {
  width: 100%;
}

.form-row {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 16px;
}

.review-summary {
  margin: -8px 0 20px;
  padding: 16px 17px;
  border-radius: 11px;
  background: #f7f9fc;
}

.review-summary h3 {
  margin: 9px 0 5px;
  color: #2e3f55;
  font-size: 16px;
  line-height: 1.5;
}

.review-summary p {
  color: #8996a8;
  font-size: 10.8px;
}

.review-options {
  width: 100%;
}

.review-options :deep(.el-radio-button) {
  width: 50%;
}

.review-options :deep(.el-radio-button__inner) {
  width: 100%;
}

@keyframes card-in {
  from {
    opacity: 0;
    transform: translateY(7px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 1280px) {
  .topic-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .filter-form {
    grid-template-columns: repeat(3, minmax(160px, 1fr));
  }

  .filter-actions {
    grid-column: span 3;
    justify-content: flex-end;
  }
}

@media (max-width: 980px) {
  .student-overview {
    grid-template-columns: 1fr 1fr;
  }

  .overview-status {
    grid-column: span 2;
  }
}

@media (max-width: 720px) {
  .page-intro {
    align-items: flex-start;
    flex-direction: column;
  }

  .student-overview,
  .summary-grid,
  .topic-grid,
  .filter-form,
  .form-row {
    grid-template-columns: 1fr;
  }

  .overview-status,
  .filter-actions {
    grid-column: auto;
  }

  .filter-actions {
    justify-content: stretch;
  }

  .filter-actions :deep(.el-button) {
    flex: 1;
  }

  .list-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .topic-actions {
    flex-wrap: wrap;
  }

  .pagination-wrap {
    align-items: flex-start;
    flex-direction: column;
    gap: 13px;
  }

  .pagination-wrap :deep(.el-pagination__sizes) {
    display: none;
  }
}
</style>
