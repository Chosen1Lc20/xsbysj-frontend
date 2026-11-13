<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Check,
  Clock,
  Delete,
  Document,
  EditPen,
  Link,
  Refresh,
  Search,
  View,
} from '@element-plus/icons-vue'
import { assignmentApi } from '@/api/assignment'
import AssignmentFormDialog from '@/components/assignment/AssignmentFormDialog.vue'
import { useAuthStore } from '@/stores/auth'
import {
  ASSIGNMENT_STATUS_LABELS,
  ASSIGNMENT_STATUS_OPTIONS,
  type AssignmentInfo,
  type AssignmentQuery,
  type AssignmentStatus,
} from '@/types/assignment'
import { formatDateTime } from '@/utils/format'

const router = useRouter()
const authStore = useAuthStore()
const loading = ref(false)
const assignments = ref<AssignmentInfo[]>([])
const total = ref(0)
const detailVisible = ref(false)
const selectedAssignment = ref<AssignmentInfo | null>(null)
const formVisible = ref(false)
const editingAssignment = ref<AssignmentInfo | null>(null)

const query = reactive<AssignmentQuery>({
  current: 1,
  pageSize: 9,
  title: '',
  status: '',
  sortField: 'updateTime',
  sortOrder: 'descend',
})

const stats = reactive({
  total: 0,
  draft: 0,
  issued: 0,
})

const isStudent = computed(() => authStore.user?.role === 'student')
const isTeacher = computed(() => authStore.user?.role === 'teacher')

const pageCopy = computed(() => {
  if (isStudent.value) {
    return {
      kicker: 'MY ASSIGNMENT',
      title: '我的任务书',
      description:
        '查看指导教师已经下发的毕业设计任务书、任务要求和截止时间。',
    }
  }
  if (isTeacher.value) {
    return {
      kicker: 'ASSIGNMENT MANAGEMENT',
      title: '任务书管理',
      description:
        '管理本人课题下已通过选题的任务书草稿，完善内容后下发给学生。',
    }
  }
  return {
    kicker: 'ASSIGNMENT RECORDS',
    title: '任务书归档查询',
    description:
      '查看全院毕业设计任务书的下发情况、任务内容和附件资料。',
  }
})

function statusClass(status: AssignmentStatus) {
  return `assignment-status status-${status.toLowerCase()}`
}

function isOverdue(assignment: AssignmentInfo) {
  if (!assignment.deadline || assignment.status !== 'ISSUED') {
    return false
  }
  return new Date(assignment.deadline.replace(' ', 'T')).getTime() < Date.now()
}

async function loadAssignments() {
  loading.value = true
  try {
    const result = await assignmentApi.list(query)
    assignments.value = result.records
    total.value = result.total
  } catch {
    assignments.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

async function loadStats() {
  if (isStudent.value) {
    stats.total = total.value
    stats.draft = 0
    stats.issued = total.value
    return
  }
  try {
    const [draft, issued] = await Promise.all([
      assignmentApi.list({ current: 1, pageSize: 1, status: 'DRAFT' }),
      assignmentApi.list({ current: 1, pageSize: 1, status: 'ISSUED' }),
    ])
    stats.draft = draft.total
    stats.issued = issued.total
    stats.total = draft.total + issued.total
  } catch {
    stats.total = 0
    stats.draft = 0
    stats.issued = 0
  }
}

async function refreshPage() {
  await loadAssignments()
  await loadStats()
}

function handleSearch() {
  query.current = 1
  loadAssignments()
}

function handleReset() {
  Object.assign(query, {
    current: 1,
    pageSize: 9,
    title: '',
    status: '',
    sortField: 'updateTime',
    sortOrder: 'descend',
  })
  loadAssignments()
}

function openDetail(assignment: AssignmentInfo) {
  selectedAssignment.value = assignment
  detailVisible.value = true
}

function openEdit(assignment: AssignmentInfo) {
  editingAssignment.value = assignment
  formVisible.value = true
}

async function issueAssignment(assignment: AssignmentInfo) {
  try {
    await ElMessageBox.confirm(
      `任务书下发后学生即可查看，且不能再编辑或删除。确认下发“${assignment.title}”吗？`,
      '下发任务书',
      {
        confirmButtonText: '确认下发',
        cancelButtonText: '暂不下发',
        type: 'info',
      },
    )
    await assignmentApi.issue(assignment.id)
    ElMessage.success('任务书已下发给学生')
    detailVisible.value = false
    await refreshPage()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      return
    }
  }
}

async function deleteAssignment(assignment: AssignmentInfo) {
  try {
    await ElMessageBox.confirm(
      `确定删除任务书草稿“${assignment.title}”吗？此操作无法撤销。`,
      '删除任务书',
      {
        confirmButtonText: '确认删除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'danger-confirm-button',
      },
    )
    await assignmentApi.remove(assignment.id)
    ElMessage.success('任务书草稿已删除')
    detailVisible.value = false
    await refreshPage()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      return
    }
  }
}

function openAttachment(assignment: AssignmentInfo) {
  if (assignment.fileUrl) {
    window.open(assignment.fileUrl, '_blank', 'noopener,noreferrer')
  }
}

function handleAssignmentSaved() {
  refreshPage()
}

onMounted(async () => {
  await loadAssignments()
  await loadStats()
})
</script>

<template>
  <div class="assignment-page">
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
        :icon="Document"
        @click="router.push('/selections')"
      >
        前往选题创建
      </el-button>
    </section>

    <section class="summary-grid">
      <article class="summary-card">
        <span class="summary-icon summary-blue"><el-icon><Document /></el-icon></span>
        <div><span>任务书总数</span><strong>{{ stats.total }}</strong></div>
        <small>当前可见记录</small>
      </article>
      <article class="summary-card">
        <span class="summary-icon summary-orange"><el-icon><EditPen /></el-icon></span>
        <div><span>草稿任务书</span><strong>{{ stats.draft }}</strong></div>
        <small>尚未下发给学生</small>
      </article>
      <article class="summary-card">
        <span class="summary-icon summary-green"><el-icon><Check /></el-icon></span>
        <div><span>已下发</span><strong>{{ stats.issued }}</strong></div>
        <small>学生可以查看</small>
      </article>
    </section>

    <section class="filter-panel">
      <el-form
        :model="query"
        label-position="top"
        class="filter-form"
        @submit.prevent="handleSearch"
      >
        <el-form-item label="任务书标题">
          <el-input
            v-model="query.title"
            placeholder="输入任务书标题"
            clearable
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item v-if="!isStudent" label="任务书状态">
          <el-select v-model="query.status" placeholder="全部状态" clearable>
            <el-option
              v-for="option in ASSIGNMENT_STATUS_OPTIONS"
              :key="option.value"
              :label="option.label"
              :value="option.value"
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

    <section v-loading="loading" class="assignment-list-panel">
      <div class="list-heading">
        <div>
          <h3>{{ isStudent ? '已下发任务书' : '任务书列表' }}</h3>
          <p>共找到 {{ total }} 份任务书</p>
        </div>
        <span v-if="isStudent && total" class="student-notice">
          任务书内容以指导教师最终下发版本为准
        </span>
      </div>

      <div v-if="assignments.length" class="assignment-grid">
        <article
          v-for="assignment in assignments"
          :key="assignment.id"
          class="assignment-card"
        >
          <div class="card-top">
            <span class="assignment-type">毕业设计任务书</span>
            <span :class="statusClass(assignment.status)">
              {{ ASSIGNMENT_STATUS_LABELS[assignment.status] }}
            </span>
          </div>

          <h3>{{ assignment.title }}</h3>
          <p class="content-preview">
            {{ assignment.content || '指导教师暂未填写任务书正文，请查看附件。' }}
          </p>

          <div class="assignment-meta">
            <div class="meta-person">
              <span class="meta-avatar">
                {{ assignment.studentName?.slice(0, 1) || '生' }}
              </span>
              <div>
                <strong>{{ assignment.studentName || '未知学生' }}</strong>
                <span>{{ assignment.studentNo || '--' }} · {{ assignment.studentDepartment || '院系未填写' }}</span>
              </div>
            </div>
            <div class="meta-topic">
              <span>关联课题</span>
              <strong>{{ assignment.topicTitle || '课题信息已删除' }}</strong>
            </div>
          </div>

          <div class="deadline-row">
            <span><el-icon><Clock /></el-icon> 截止时间</span>
            <strong :class="{ overdue: isOverdue(assignment) }">
              {{ formatDateTime(assignment.deadline) }}
            </strong>
          </div>

          <button
            v-if="assignment.fileName && assignment.fileUrl"
            type="button"
            class="attachment-row"
            @click="openAttachment(assignment)"
          >
            <el-icon><Document /></el-icon>
            <span>{{ assignment.fileName }}</span>
            <el-icon><Link /></el-icon>
          </button>
          <div v-else class="attachment-empty">暂无附件</div>

          <div class="card-actions">
            <el-button :icon="View" @click="openDetail(assignment)">
              查看详情
            </el-button>
            <template v-if="isTeacher && assignment.status === 'DRAFT'">
              <el-button
                type="primary"
                plain
                :icon="EditPen"
                @click="openEdit(assignment)"
              >
                编辑
              </el-button>
              <el-button type="primary" @click="issueAssignment(assignment)">
                下发
              </el-button>
              <el-button
                link
                type="danger"
                :icon="Delete"
                @click="deleteAssignment(assignment)"
              >
                删除
              </el-button>
            </template>
            <el-button
              v-if="isStudent && assignment.fileUrl"
              type="primary"
              :icon="Document"
              @click="openAttachment(assignment)"
            >
              下载附件
            </el-button>
          </div>
        </article>
      </div>

      <el-empty
        v-else
        :image-size="100"
        :description="isStudent ? '指导教师暂未下发任务书' : '暂无符合条件的任务书'"
      >
        <el-button
          v-if="isTeacher"
          type="primary"
          @click="router.push('/selections')"
        >
          前往选题管理创建
        </el-button>
      </el-empty>

      <div v-if="total" class="pagination-wrap">
        <span>每页 {{ query.pageSize }} 条，共 {{ total }} 条</span>
        <el-pagination
          v-model:current-page="query.current"
          v-model:page-size="query.pageSize"
          :total="total"
          :page-sizes="[9, 18, 36, 45]"
          layout="prev, pager, next, sizes"
          background
          @current-change="loadAssignments"
          @size-change="handleSearch"
        />
      </div>
    </section>

    <el-drawer
      v-model="detailVisible"
      title="任务书详情"
      size="min(560px, 92vw)"
    >
      <template v-if="selectedAssignment">
        <div class="detail-heading">
          <span :class="statusClass(selectedAssignment.status)">
            {{ ASSIGNMENT_STATUS_LABELS[selectedAssignment.status] }}
          </span>
          <h2>{{ selectedAssignment.title }}</h2>
          <p>{{ selectedAssignment.topicTitle }}</p>
        </div>

        <div class="detail-section">
          <h4>任务书正文</h4>
          <p class="detail-content">
            {{ selectedAssignment.content || '未填写任务书正文，请查看附件。' }}
          </p>
        </div>

        <div class="detail-grid">
          <div>
            <span>学生</span>
            <strong>{{ selectedAssignment.studentName || '--' }}</strong>
            <small>{{ selectedAssignment.studentNo || '--' }}</small>
          </div>
          <div>
            <span>指导教师</span>
            <strong>{{ selectedAssignment.teacherName || '--' }}</strong>
            <small>{{ selectedAssignment.studentDepartment || '--' }}</small>
          </div>
        </div>

        <div class="detail-section">
          <h4>任务时间</h4>
          <div class="detail-line">
            <span>截止时间</span>
            <strong :class="{ overdue: isOverdue(selectedAssignment) }">
              {{ formatDateTime(selectedAssignment.deadline) }}
            </strong>
          </div>
          <div class="detail-line">
            <span>下发时间</span>
            <strong>{{ formatDateTime(selectedAssignment.issueTime) }}</strong>
          </div>
          <div class="detail-line">
            <span>最近更新</span>
            <strong>{{ formatDateTime(selectedAssignment.updateTime) }}</strong>
          </div>
        </div>

        <div class="detail-section">
          <h4>任务书附件</h4>
          <button
            v-if="selectedAssignment.fileName && selectedAssignment.fileUrl"
            type="button"
            class="detail-attachment"
            @click="openAttachment(selectedAssignment)"
          >
            <el-icon><Document /></el-icon>
            <div>
              <strong>{{ selectedAssignment.fileName }}</strong>
              <span>点击打开或下载附件</span>
            </div>
            <el-icon><Link /></el-icon>
          </button>
          <p v-else class="no-attachment">暂无附件</p>
        </div>
      </template>

      <template #footer>
        <div v-if="selectedAssignment" class="drawer-footer">
          <el-button @click="detailVisible = false">关闭</el-button>
          <el-button
            v-if="isTeacher && selectedAssignment.status === 'DRAFT'"
            :icon="EditPen"
            @click="openEdit(selectedAssignment)"
          >
            编辑任务书
          </el-button>
          <el-button
            v-if="isTeacher && selectedAssignment.status === 'DRAFT'"
            type="primary"
            @click="issueAssignment(selectedAssignment)"
          >
            下发任务书
          </el-button>
        </div>
      </template>
    </el-drawer>

    <AssignmentFormDialog
      v-model="formVisible"
      mode="edit"
      :assignment="editingAssignment"
      @saved="handleAssignmentSaved"
    />
  </div>
</template>

<style scoped>
.assignment-page {
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
  margin: 7px 0;
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

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.summary-card {
  display: flex;
  min-height: 112px;
  align-items: center;
  gap: 13px;
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

.summary-card > div {
  display: flex;
  flex-direction: column;
}

.summary-card span:not(.summary-icon) {
  color: #7e8c9e;
  font-size: 10.8px;
}

.summary-card strong {
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
.assignment-list-panel {
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
  grid-template-columns: minmax(260px, 1.4fr) minmax(190px, 0.8fr) auto;
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

.assignment-list-panel {
  min-height: 360px;
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
  color: #99a5b4;
  font-size: 10.8px;
}

.student-notice {
  padding: 7px 10px;
  border-radius: 8px;
  color: #4c74a7;
  background: #eef5ff;
  font-size: 10.8px;
}

.assignment-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 17px;
}

.assignment-card {
  display: flex;
  min-width: 0;
  min-height: 400px;
  flex-direction: column;
  padding: 20px;
  border: 1px solid #e8edf4;
  border-radius: 15px;
  background: #fff;
  box-shadow: 0 5px 16px rgb(32 63 104 / 3%);
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.assignment-card:hover {
  border-color: #ccdcf0;
  box-shadow: 0 12px 28px rgb(33 77 133 / 8%);
  transform: translateY(-2px);
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.assignment-type,
.assignment-status {
  display: inline-flex;
  align-items: center;
  padding: 5px 9px;
  border-radius: 7px;
  font-size: 9.6px;
  font-weight: 600;
}

.assignment-type {
  color: #3075cf;
  background: #eaf2ff;
}

.status-draft {
  color: #9b681f;
  background: #fff3e1;
}

.status-issued {
  color: #197c63;
  background: #e7f7f1;
}

.assignment-card > h3 {
  display: -webkit-box;
  overflow: hidden;
  margin: 15px 0 8px;
  color: #26364c;
  font-size: 18px;
  font-weight: 650;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.content-preview {
  display: -webkit-box;
  overflow: hidden;
  min-height: 48px;
  color: #8491a3;
  font-size: 12px;
  line-height: 1.7;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.assignment-meta {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: auto;
  padding-top: 17px;
}

.meta-person {
  display: flex;
  align-items: center;
  gap: 9px;
}

.meta-avatar {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  place-items: center;
  border-radius: 50%;
  color: #e9f4ff;
  background: linear-gradient(135deg, #4386d9, #245d9c);
  font-size: 11px;
}

.meta-person > div,
.meta-topic {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.meta-person strong,
.meta-topic strong {
  overflow: hidden;
  color: #405066;
  font-size: 11px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta-person span,
.meta-topic span {
  overflow: hidden;
  margin-top: 2px;
  color: #99a5b4;
  font-size: 9.6px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.deadline-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 13px;
  padding-top: 12px;
  border-top: 1px solid #eef2f6;
}

.deadline-row span {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #8e9bac;
  font-size: 9.6px;
}

.deadline-row strong {
  color: #54708e;
  font-size: 10.8px;
  font-weight: 600;
}

.deadline-row strong.overdue {
  color: #bd5252;
}

.attachment-row,
.detail-attachment {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  gap: 8px;
  margin-top: 11px;
  padding: 9px 11px;
  border: 1px solid #e6ebf2;
  border-radius: 8px;
  color: #4b719f;
  background: #f8fafc;
  cursor: pointer;
  font-size: 9.6px;
}

.attachment-row span {
  overflow: hidden;
  flex: 1;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attachment-row > .el-icon:last-child {
  margin-left: auto;
}

.attachment-empty {
  margin-top: 11px;
  padding: 9px 11px;
  border-radius: 8px;
  color: #adb6c2;
  background: #fafbfd;
  font-size: 9.6px;
}

.card-actions {
  display: flex;
  min-height: 34px;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
  margin-top: 14px;
}

.card-actions :deep(.el-button) {
  height: 34px;
  margin-left: 0;
  padding: 0 11px;
  border-radius: 8px;
  font-size: 10.8px;
}

.card-actions :deep(.el-button:first-child) {
  border-color: #dfe6ef;
  color: #63748a;
  background: #fff;
}

.card-actions :deep(.el-button.is-link) {
  padding-inline: 2px;
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

.detail-heading {
  padding-bottom: 22px;
  border-bottom: 1px solid #edf1f5;
}

.detail-heading h2 {
  margin: 14px 0 7px;
  color: #26364c;
  font-size: 22.8px;
  line-height: 1.5;
}

.detail-heading p {
  color: #8f9cad;
  font-size: 10.8px;
}

.detail-section {
  padding-top: 22px;
}

.detail-section h4 {
  margin-bottom: 11px;
  color: #48586d;
  font-size: 11px;
}

.detail-content {
  color: #6f7f93;
  font-size: 12px;
  line-height: 1.95;
  white-space: pre-wrap;
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 20px;
}

.detail-grid > div {
  display: flex;
  flex-direction: column;
  padding: 13px 14px;
  border-radius: 10px;
  background: #f7f9fc;
}

.detail-grid span {
  color: #98a4b4;
  font-size: 9.6px;
}

.detail-grid strong {
  margin-top: 4px;
  color: #3d4d63;
  font-size: 12px;
}

.detail-grid small {
  margin-top: 3px;
  color: #8f9cac;
  font-size: 9.6px;
}

.detail-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid #f0f3f7;
}

.detail-line span {
  color: #96a2b2;
  font-size: 10.8px;
}

.detail-line strong {
  color: #5b6b80;
  font-size: 10.8px;
  font-weight: 500;
}

.detail-line strong.overdue {
  color: #bd5252;
}

.detail-attachment {
  padding: 13px 14px;
  background: #fafcff;
}

.detail-attachment > .el-icon:first-child {
  font-size: 22.8px;
}

.detail-attachment > div {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.detail-attachment strong {
  overflow: hidden;
  color: #405066;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-attachment span {
  margin-top: 3px;
  color: #98a4b4;
  font-size: 9.6px;
}

.no-attachment {
  color: #a6b0bd;
  font-size: 10.8px;
}

.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 9px;
}

@media (max-width: 1240px) {
  .assignment-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .page-intro {
    align-items: flex-start;
    flex-direction: column;
  }

  .summary-grid,
  .assignment-grid,
  .filter-form,
  .detail-grid {
    grid-template-columns: 1fr;
  }

  .filter-actions :deep(.el-button) {
    flex: 1;
  }

  .list-heading {
    align-items: flex-start;
    flex-direction: column;
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
