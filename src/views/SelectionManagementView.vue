<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Check,
  Clock,
  Document,
  Refresh,
  Search,
  Tickets,
  View,
  Warning,
} from '@element-plus/icons-vue'
import { assignmentApi } from '@/api/assignment'
import { selectionApi } from '@/api/selection'
import AssignmentFormDialog from '@/components/assignment/AssignmentFormDialog.vue'
import { useAuthStore } from '@/stores/auth'
import type { AssignmentSelectionContext } from '@/types/assignment'
import {
  SELECTION_STATUS_LABELS,
  SELECTION_STATUS_OPTIONS,
  type SelectionInfo,
  type SelectionQuery,
  type SelectionStatus,
} from '@/types/selection'
import { formatDateTime } from '@/utils/format'

const authStore = useAuthStore()
const loading = ref(false)
const selections = ref<SelectionInfo[]>([])
const total = ref(0)
const detailVisible = ref(false)
const selectedSelection = ref<SelectionInfo | null>(null)
const reviewVisible = ref(false)
const reviewSelection = ref<SelectionInfo | null>(null)
const reviewApproved = ref(true)
const reviewComment = ref('')
const reviewSubmitting = ref(false)
const assignmentDialogVisible = ref(false)
const assignmentSelection = ref<AssignmentSelectionContext>()
const assignedSelectionIds = ref<Set<string>>(new Set())

const query = reactive<SelectionQuery>({
  current: 1,
  pageSize: 10,
  topicTitle: '',
  status: '',
  sortField: 'selectionTime',
  sortOrder: 'descend',
})

const stats = reactive({
  total: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
})

const isStudent = computed(() => authStore.user?.role === 'student')
const isTeacher = computed(() => authStore.user?.role === 'teacher')
const isAdmin = computed(() => authStore.user?.role === 'admin')

const pageCopy = computed(() => {
  if (isStudent.value) {
    return {
      kicker: 'MY SELECTION',
      title: '我的选题',
      description:
        '查看本人提交的选题申请、指导教师审核意见和最终确认结果。',
    }
  }
  if (isTeacher.value) {
    return {
      kicker: 'SELECTION REVIEW',
      title: '选题审核',
      description:
        '审核学生针对本人课题提交的选题申请，并记录明确的审核意见。',
    }
  }
  return {
    kicker: 'SELECTION RECORDS',
    title: '选题记录管理',
    description:
      '查看全院课题选题申请、审核进度和指导教师处理结果。',
  }
})

function statusClass(status: SelectionStatus) {
  return `selection-status status-${status.toLowerCase()}`
}

function getInitial(name?: string | null) {
  return name?.slice(0, 1) || '生'
}

async function loadSelections() {
  loading.value = true
  try {
    const result = await selectionApi.list(query)
    selections.value = result.records
    total.value = result.total
  } catch {
    selections.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

async function loadStats() {
  try {
    const statuses: SelectionStatus[] = [
      'PENDING',
      'APPROVED',
      'REJECTED',
      'CANCELED',
    ]
    const [pending, approved, rejected, canceled] = await Promise.all(
      statuses.map((status) =>
        selectionApi.list({
          current: 1,
          pageSize: 1,
          status,
        }),
      ),
    )
    stats.pending = pending.total
    stats.approved = approved.total
    stats.rejected = rejected.total
    stats.total =
      pending.total + approved.total + rejected.total + canceled.total
  } catch {
    stats.total = 0
    stats.pending = 0
    stats.approved = 0
    stats.rejected = 0
  }
}

async function loadTeacherAssignments() {
  if (!isTeacher.value) {
    return
  }
  try {
    const ids = new Set<string>()
    let current = 1
    let pages = 1
    do {
      const result = await assignmentApi.list({
        current,
        pageSize: 50,
        sortField: 'updateTime',
        sortOrder: 'descend',
      })
      result.records.forEach((assignment) => {
        ids.add(String(assignment.selectionId))
      })
      pages = result.pages
      current += 1
    } while (current <= pages)
    assignedSelectionIds.value = ids
  } catch {
    assignedSelectionIds.value = new Set()
  }
}

function handleSearch() {
  query.current = 1
  loadSelections()
}

function handleReset() {
  Object.assign(query, {
    current: 1,
    pageSize: 10,
    topicTitle: '',
    status: '',
    sortField: 'selectionTime',
    sortOrder: 'descend',
  })
  loadSelections()
}

function openDetail(selection: SelectionInfo) {
  selectedSelection.value = selection
  detailVisible.value = true
}

async function cancelSelection(selection: SelectionInfo) {
  try {
    await ElMessageBox.confirm(
      `确定取消“${selection.topicTitle}”的选题申请吗？取消后可以重新申请其他课题。`,
      '取消选题',
      {
        confirmButtonText: '确认取消',
        cancelButtonText: '保留申请',
        type: 'warning',
      },
    )
    await selectionApi.cancel(selection.id)
    ElMessage.success('选题申请已取消')
    detailVisible.value = false
    await Promise.all([loadSelections(), loadStats()])
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      return
    }
  }
}

function openReview(selection: SelectionInfo) {
  reviewSelection.value = selection
  reviewApproved.value = true
  reviewComment.value = ''
  reviewVisible.value = true
}

function hasAssignment(selection: SelectionInfo) {
  return assignedSelectionIds.value.has(String(selection.id))
}

function openAssignmentForm(selection: SelectionInfo) {
  assignmentSelection.value = {
    id: selection.id,
    topicTitle: selection.topicTitle,
    studentName: selection.studentName,
    studentNo: selection.studentNo,
    studentDepartment: selection.studentDepartment,
  }
  assignmentDialogVisible.value = true
}

async function submitReview() {
  if (!reviewSelection.value) {
    return
  }
  if (!reviewApproved.value && !reviewComment.value.trim()) {
    ElMessage.warning('驳回选题时必须填写审核意见')
    return
  }

  reviewSubmitting.value = true
  try {
    await selectionApi.review({
      id: reviewSelection.value.id,
      approved: reviewApproved.value,
      auditComment: reviewComment.value.trim(),
    })
    ElMessage.success(reviewApproved.value ? '选题申请已通过' : '选题申请已驳回')
    reviewVisible.value = false
    detailVisible.value = false
    await Promise.all([loadSelections(), loadStats()])
  } catch {
    // 请求层统一显示错误信息。
  } finally {
    reviewSubmitting.value = false
  }
}

onMounted(async () => {
  await Promise.all([loadSelections(), loadStats(), loadTeacherAssignments()])
})
</script>

<template>
  <div class="selection-page">
    <section class="page-intro">
      <div>
        <span class="intro-kicker">{{ pageCopy.kicker }}</span>
        <h2>{{ pageCopy.title }}</h2>
        <p>{{ pageCopy.description }}</p>
      </div>
      <div class="intro-emblem">
        <el-icon><Tickets /></el-icon>
        <div>
          <span>当前记录</span>
          <strong>{{ stats.total }}</strong>
        </div>
      </div>
    </section>

    <section class="summary-grid">
      <article class="summary-card">
        <span class="summary-icon summary-blue"><el-icon><Tickets /></el-icon></span>
        <div><span>选题总数</span><strong>{{ stats.total }}</strong></div>
        <small>全部申请记录</small>
      </article>
      <article class="summary-card">
        <span class="summary-icon summary-orange"><el-icon><Clock /></el-icon></span>
        <div><span>待审核</span><strong>{{ stats.pending }}</strong></div>
        <small>等待教师处理</small>
      </article>
      <article class="summary-card">
        <span class="summary-icon summary-green"><el-icon><Check /></el-icon></span>
        <div><span>已通过</span><strong>{{ stats.approved }}</strong></div>
        <small>选题正式生效</small>
      </article>
      <article class="summary-card">
        <span class="summary-icon summary-red"><el-icon><Warning /></el-icon></span>
        <div><span>已驳回</span><strong>{{ stats.rejected }}</strong></div>
        <small>可重新选择课题</small>
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
            v-model="query.topicTitle"
            placeholder="输入课题名称"
            clearable
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="选题状态">
          <el-select v-model="query.status" placeholder="全部状态" clearable>
            <el-option
              v-for="option in SELECTION_STATUS_OPTIONS"
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

    <section class="table-panel">
      <div class="table-toolbar">
        <div>
          <h3>{{ isStudent ? '我的选题记录' : '选题申请列表' }}</h3>
          <p>共 {{ total }} 条选题记录</p>
        </div>
        <span v-if="isTeacher && stats.pending" class="pending-tip">
          {{ stats.pending }} 条申请等待审核
        </span>
      </div>

      <el-table
        v-loading="loading"
        :data="selections"
        row-key="id"
        class="selection-table"
        empty-text="暂无符合条件的选题记录"
      >
        <el-table-column v-if="!isStudent" label="学生" min-width="210">
          <template #default="{ row }">
            <div class="student-cell">
              <el-avatar :size="36">{{ getInitial(row.studentName) }}</el-avatar>
              <div>
                <strong>{{ row.studentName || '未知学生' }}</strong>
                <span>{{ row.studentNo || '--' }} · {{ row.studentDepartment || '院系未填写' }}</span>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="申请课题" min-width="240">
          <template #default="{ row }">
            <div class="topic-cell">
              <strong>{{ row.topicTitle || '课题信息已删除' }}</strong>
              <span v-if="isStudent">指导教师：{{ row.teacherName || '--' }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column v-if="isAdmin" label="指导教师" min-width="130">
          <template #default="{ row }">
            {{ row.teacherName || '--' }}
          </template>
        </el-table-column>

        <el-table-column label="申请时间" min-width="165">
          <template #default="{ row }">
            {{ formatDateTime(row.selectionTime) }}
          </template>
        </el-table-column>

        <el-table-column label="审核状态" width="125">
          <template #default="{ row }">
            <span :class="statusClass(row.status)">
              {{ SELECTION_STATUS_LABELS[row.status as SelectionStatus] }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="审核意见" min-width="190">
          <template #default="{ row }">
            <span :class="{ 'empty-value': !row.auditComment }">
              {{ row.auditComment || '暂无审核意见' }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="225" fixed="right">
          <template #default="{ row }">
            <div class="row-actions">
              <el-button link type="primary" :icon="View" @click="openDetail(row)">
                详情
              </el-button>
              <el-button
                v-if="isStudent && row.status === 'PENDING'"
                link
                type="danger"
                @click="cancelSelection(row)"
              >
                取消申请
              </el-button>
              <el-button
                v-if="isTeacher && row.status === 'PENDING'"
                link
                type="primary"
                @click="openReview(row)"
              >
                审核
              </el-button>
              <el-button
                v-if="
                  isTeacher &&
                  row.status === 'APPROVED' &&
                  !hasAssignment(row)
                "
                link
                type="primary"
                :icon="Document"
                @click="openAssignmentForm(row)"
              >
                创建任务书
              </el-button>
              <span
                v-if="
                  isTeacher &&
                  row.status === 'APPROVED' &&
                  hasAssignment(row)
                "
                class="assignment-created"
              >
                任务书已创建
              </span>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrap">
        <span>每页 {{ query.pageSize }} 条，共 {{ total }} 条</span>
        <el-pagination
          v-model:current-page="query.current"
          v-model:page-size="query.pageSize"
          :total="total"
          :page-sizes="[10, 20, 30, 50]"
          layout="prev, pager, next, sizes"
          background
          @current-change="loadSelections"
          @size-change="handleSearch"
        />
      </div>
    </section>

    <el-drawer
      v-model="detailVisible"
      title="选题详情"
      size="min(520px, 92vw)"
    >
      <template v-if="selectedSelection">
        <div class="detail-hero">
          <span :class="statusClass(selectedSelection.status)">
            {{ SELECTION_STATUS_LABELS[selectedSelection.status] }}
          </span>
          <h2>{{ selectedSelection.topicTitle || '课题信息已删除' }}</h2>
          <p>申请于 {{ formatDateTime(selectedSelection.selectionTime) }}</p>
        </div>

        <div class="detail-group">
          <h4>学生信息</h4>
          <div class="person-card">
            <el-avatar :size="44">{{ getInitial(selectedSelection.studentName) }}</el-avatar>
            <div>
              <strong>{{ selectedSelection.studentName || '未知学生' }}</strong>
              <span>{{ selectedSelection.studentNo || '--' }}</span>
              <small>{{ selectedSelection.studentDepartment || '院系未填写' }}</small>
            </div>
          </div>
        </div>

        <div class="detail-group">
          <h4>指导教师</h4>
          <div class="detail-line">
            <span>教师姓名</span>
            <strong>{{ selectedSelection.teacherName || '--' }}</strong>
          </div>
        </div>

        <div class="detail-group">
          <h4>审核信息</h4>
          <div v-if="selectedSelection.auditComment" class="audit-panel">
            <p>{{ selectedSelection.auditComment }}</p>
            <span>审核时间：{{ formatDateTime(selectedSelection.reviewTime) }}</span>
          </div>
          <el-empty v-else :image-size="52" description="暂无审核意见" />
        </div>

        <div class="detail-group">
          <h4>时间记录</h4>
          <div class="detail-line">
            <span>提交申请</span>
            <strong>{{ formatDateTime(selectedSelection.selectionTime) }}</strong>
          </div>
          <div class="detail-line">
            <span>最近更新</span>
            <strong>{{ formatDateTime(selectedSelection.updateTime) }}</strong>
          </div>
        </div>
      </template>
      <template #footer>
        <div v-if="selectedSelection" class="drawer-footer">
          <el-button @click="detailVisible = false">关闭</el-button>
          <el-button
            v-if="isStudent && selectedSelection.status === 'PENDING'"
            type="danger"
            plain
            @click="cancelSelection(selectedSelection)"
          >
            取消申请
          </el-button>
          <el-button
            v-if="isTeacher && selectedSelection.status === 'PENDING'"
            type="primary"
            @click="openReview(selectedSelection)"
          >
            审核选题
          </el-button>
          <el-button
            v-if="
              isTeacher &&
              selectedSelection.status === 'APPROVED' &&
              !hasAssignment(selectedSelection)
            "
            type="primary"
            :icon="Document"
            @click="openAssignmentForm(selectedSelection)"
          >
            创建任务书
          </el-button>
          <span
            v-if="
              isTeacher &&
              selectedSelection.status === 'APPROVED' &&
              hasAssignment(selectedSelection)
            "
            class="assignment-created"
          >
            任务书已创建
          </span>
        </div>
      </template>
    </el-drawer>

    <AssignmentFormDialog
      v-model="assignmentDialogVisible"
      mode="create"
      :selection="assignmentSelection"
      @saved="loadTeacherAssignments"
    />

    <el-dialog
      v-model="reviewVisible"
      title="审核选题申请"
      width="min(560px, 92vw)"
      destroy-on-close
    >
      <div v-if="reviewSelection" class="review-summary">
        <div class="review-student">
          <el-avatar :size="42">{{ getInitial(reviewSelection.studentName) }}</el-avatar>
          <div>
            <strong>{{ reviewSelection.studentName }}</strong>
            <span>{{ reviewSelection.studentNo }} · {{ reviewSelection.studentDepartment }}</span>
          </div>
        </div>
        <h3>{{ reviewSelection.topicTitle }}</h3>
        <p>申请时间：{{ formatDateTime(reviewSelection.selectionTime) }}</p>
      </div>
      <el-form label-position="top">
        <el-form-item label="审核结果">
          <el-radio-group v-model="reviewApproved" class="review-options">
            <el-radio-button :value="true">通过申请</el-radio-button>
            <el-radio-button :value="false">驳回申请</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item :label="reviewApproved ? '审核意见（选填）' : '驳回原因'">
          <el-input
            v-model="reviewComment"
            type="textarea"
            :rows="5"
            :placeholder="reviewApproved ? '可填写补充说明' : '请向学生说明驳回原因'"
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
.selection-page {
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

.intro-emblem {
  display: flex;
  min-width: 170px;
  align-items: center;
  gap: 12px;
  padding: 12px 15px;
  border: 1px solid #e8edf4;
  border-radius: 13px;
  background: #fff;
  box-shadow: var(--panel-shadow);
}

.intro-emblem > .el-icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  color: #2e72d0;
  background: #eaf2ff;
  font-size: 19.2px;
}

.intro-emblem > div {
  display: flex;
  flex-direction: column;
}

.intro-emblem span {
  color: #96a2b2;
  font-size: 9.6px;
}

.intro-emblem strong {
  color: #2b3b51;
  font-size: 21.6px;
  line-height: 1.2;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
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

.summary-red {
  color: #b14e4e;
  background: #ffeded;
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
.table-panel {
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
  grid-template-columns: minmax(250px, 1.4fr) minmax(180px, 0.8fr) auto;
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

.table-panel {
  overflow: hidden;
}

.table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 23px 17px;
  border-bottom: 1px solid #edf1f5;
}

.table-toolbar h3 {
  color: #2a394f;
  font-size: 18px;
  font-weight: 650;
}

.table-toolbar p {
  margin-top: 4px;
  color: #99a5b4;
  font-size: 10.8px;
}

.pending-tip {
  padding: 7px 10px;
  border-radius: 8px;
  color: #9b641f;
  background: #fff5e7;
  font-size: 10.8px;
}

.selection-table {
  width: 100%;
}

.selection-table :deep(.el-table__header th) {
  height: 43px;
  color: #77859a;
  background: #f8fafc;
  font-size: 10.8px;
  font-weight: 600;
}

.selection-table :deep(.el-table__body td) {
  height: 68px;
  border-bottom-color: #f0f3f7;
  color: #58677c;
  font-size: 11px;
}

.selection-table :deep(.el-table__body tr:hover > td) {
  background: #f9fbfe;
}

.student-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.student-cell .el-avatar,
.person-card .el-avatar,
.review-student .el-avatar {
  color: #e8f4ff;
  background: linear-gradient(135deg, #4386d9, #245d9c);
  font-size: 12px;
}

.student-cell > div,
.topic-cell {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.student-cell strong,
.topic-cell strong {
  overflow: hidden;
  color: #34455b;
  font-size: 11px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.student-cell span,
.topic-cell span {
  overflow: hidden;
  margin-top: 3px;
  color: #97a3b3;
  font-size: 9.6px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selection-status {
  display: inline-flex;
  align-items: center;
  padding: 5px 9px;
  border-radius: 7px;
  font-size: 9.6px;
  font-weight: 600;
}

.status-pending {
  color: #a9691d;
  background: #fff3e1;
}

.status-approved {
  color: #187b62;
  background: #e7f7f1;
}

.status-rejected {
  color: #ad4b4b;
  background: #ffeded;
}

.status-canceled {
  color: #6e7b8d;
  background: #f0f3f7;
}

.empty-value {
  color: #b0bac6;
}

.row-actions {
  display: flex;
  align-items: center;
}

.row-actions :deep(.el-button) {
  font-size: 10.8px;
}

.assignment-created {
  padding: 4px 7px;
  border-radius: 6px;
  color: #1b7f67;
  background: #e8f7f2;
  font-size: 9.6px;
  white-space: nowrap;
}

.pagination-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 23px;
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

.detail-hero {
  padding-bottom: 22px;
  border-bottom: 1px solid #edf1f5;
}

.detail-hero h2 {
  margin: 14px 0 7px;
  color: #26364c;
  font-size: 22.8px;
  line-height: 1.5;
}

.detail-hero p {
  color: #95a1b1;
  font-size: 10.8px;
}

.detail-group {
  padding-top: 21px;
}

.detail-group h4 {
  margin-bottom: 11px;
  color: #48586d;
  font-size: 11px;
}

.person-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border-radius: 11px;
  background: #f7f9fc;
}

.person-card > div {
  display: flex;
  flex-direction: column;
}

.person-card strong {
  color: #34455b;
  font-size: 12px;
}

.person-card span {
  margin-top: 2px;
  color: #7e8c9e;
  font-size: 10.8px;
}

.person-card small {
  margin-top: 2px;
  color: #9ca7b6;
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

.audit-panel {
  padding: 14px 15px;
  border: 1px solid #dfeee9;
  border-radius: 10px;
  background: #f4fbf8;
}

.audit-panel p {
  color: #5b726a;
  font-size: 11px;
  line-height: 1.75;
}

.audit-panel span {
  display: block;
  margin-top: 8px;
  color: #94a39e;
  font-size: 9.6px;
}

.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 9px;
}

.review-summary {
  margin: -8px 0 20px;
  padding: 16px 17px;
  border-radius: 11px;
  background: #f7f9fc;
}

.review-student {
  display: flex;
  align-items: center;
  gap: 10px;
}

.review-student > div {
  display: flex;
  flex-direction: column;
}

.review-student strong {
  color: #34455b;
  font-size: 12px;
}

.review-student span {
  margin-top: 2px;
  color: #8e9bab;
  font-size: 9.6px;
}

.review-summary h3 {
  margin: 14px 0 5px;
  color: #2e3f55;
  font-size: 16px;
  line-height: 1.5;
}

.review-summary > p {
  color: #8d99aa;
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

@media (max-width: 1200px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .page-intro {
    align-items: flex-start;
    flex-direction: column;
  }

  .intro-emblem {
    width: 100%;
  }

  .summary-grid,
  .filter-form {
    grid-template-columns: 1fr;
  }

  .filter-actions :deep(.el-button) {
    flex: 1;
  }

  .table-toolbar {
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
  }

  .pagination-wrap {
    align-items: flex-start;
    flex-direction: column;
    gap: 12px;
  }

  .pagination-wrap :deep(.el-pagination__sizes) {
    display: none;
  }
}
</style>
