<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Check,
  Clock,
  Document,
  Files,
  Link,
  Refresh,
  Search,
  UploadFilled,
  View,
  Warning,
} from '@element-plus/icons-vue'
import { assignmentApi } from '@/api/assignment'
import { documentApi } from '@/api/document'
import { fileApi } from '@/api/file'
import { selectionApi } from '@/api/selection'
import { useAuthStore } from '@/stores/auth'
import type { AssignmentInfo } from '@/types/assignment'
import {
  DOCUMENT_AUDIT_STATUS_LABELS,
  DOCUMENT_AUDIT_STATUS_OPTIONS,
  DOCUMENT_TYPE_DESCRIPTIONS,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPE_OPTIONS,
  type DocumentAuditStatus,
  type DocumentInfo,
  type DocumentQuery,
  type DocumentType,
} from '@/types/document'
import type { SelectionInfo } from '@/types/selection'
import { formatDateTime } from '@/utils/format'

const authStore = useAuthStore()
const loading = ref(false)
const documents = ref<DocumentInfo[]>([])
const total = ref(0)
const approvedSelection = ref<SelectionInfo | null>(null)
const issuedAssignment = ref<AssignmentInfo | null>(null)
const submitVisible = ref(false)
const submitDocumentType = ref<DocumentType>('OPENING_REPORT')
const submitFile = ref<File | null>(null)
const submitFileRecordId = ref<string | number | null>(null)
const submitFileName = ref('')
const submitFileUrl = ref('')
const uploading = ref(false)
const uploadProgress = ref(0)
const submitting = ref(false)
const fileInputRef = ref<HTMLInputElement>()
const reviewVisible = ref(false)
const reviewDocument = ref<DocumentInfo | null>(null)
const reviewApproved = ref(true)
const reviewComment = ref('')
const reviewSubmitting = ref(false)
const historyVisible = ref(false)
const historyLoading = ref(false)
const historyTarget = ref<DocumentInfo | null>(null)
const historyDocuments = ref<DocumentInfo[]>([])

const query = reactive<DocumentQuery>({
  current: 1,
  pageSize: 10,
  documentType: '',
  auditStatus: '',
  latestOnly: true,
  sortField: 'submitTime',
  sortOrder: 'descend',
})

const stats = reactive({
  submitted: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
})

const isStudent = computed(() => authStore.user?.role === 'student')
const isTeacher = computed(() => authStore.user?.role === 'teacher')

const pageCopy = computed(() => {
  if (isStudent.value) {
    return {
      kicker: 'DOCUMENT WORKSPACE',
      title: '过程文档',
      description:
        '按毕业设计阶段提交过程材料，查看教师审核意见和文档历史版本。',
    }
  }
  if (isTeacher.value) {
    return {
      kicker: 'DOCUMENT REVIEW',
      title: '过程文档审核',
      description:
        '查看本人课题学生提交的最新过程文档，完成审核并保留历史版本记录。',
    }
  }
  return {
    kicker: 'DOCUMENT ARCHIVE',
    title: '过程文档归档',
    description:
      '查看全院毕业设计过程文档、审核状态、版本历史和教师意见。',
  }
})

const studentProgress = computed(() =>
  Math.round((stats.submitted / DOCUMENT_TYPE_OPTIONS.length) * 100),
)

const currentSubmitLabel = computed(
  () => DOCUMENT_TYPE_LABELS[submitDocumentType.value],
)

function getLatestDocument(type: DocumentType) {
  return documents.value.find(
    (document) => document.documentType === type && document.latest,
  )
}

function canSubmit(type: DocumentType) {
  const latest = getLatestDocument(type)
  return !latest || latest.auditStatus === 'REJECTED'
}

function statusClass(status?: DocumentAuditStatus | null) {
  return status ? `doc-status status-${status.toLowerCase()}` : 'doc-status status-empty'
}

function formatFileSize(size?: string | number | null) {
  const value = Number(size) || 0
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

async function loadStudentWorkspace() {
  approvedSelection.value = null
  issuedAssignment.value = null
  documents.value = []
  total.value = 0

  const selections = await selectionApi.list({
    current: 1,
    pageSize: 1,
    status: 'APPROVED',
  })
  approvedSelection.value = selections.records[0] || null
  if (!approvedSelection.value) {
    updateStudentStats()
    return
  }

  const [assignments, documentResult] = await Promise.all([
    assignmentApi.list({
      current: 1,
      pageSize: 1,
      selectionId: approvedSelection.value.id,
      status: 'ISSUED',
    }),
    documentApi.list({
      current: 1,
      pageSize: 50,
      selectionId: approvedSelection.value.id,
      latestOnly: true,
      sortField: 'submitTime',
      sortOrder: 'descend',
    }),
  ])
  issuedAssignment.value = assignments.records[0] || null
  documents.value = documentResult.records
  total.value = documentResult.total
  updateStudentStats()
}

function updateStudentStats() {
  stats.submitted = documents.value.length
  stats.pending = documents.value.filter(
    (document) => document.auditStatus === 'PENDING',
  ).length
  stats.approved = documents.value.filter(
    (document) => document.auditStatus === 'APPROVED',
  ).length
  stats.rejected = documents.value.filter(
    (document) => document.auditStatus === 'REJECTED',
  ).length
}

async function loadDocuments() {
  loading.value = true
  try {
    if (isStudent.value) {
      await loadStudentWorkspace()
      return
    }
    const result = await documentApi.list(query)
    documents.value = result.records
    total.value = result.total
  } catch {
    if (isStudent.value) {
      approvedSelection.value = null
      issuedAssignment.value = null
      documents.value = []
      total.value = 0
      updateStudentStats()
    } else {
      documents.value = []
      total.value = 0
    }
  } finally {
    loading.value = false
  }
}

async function loadStats() {
  if (isStudent.value) {
    updateStudentStats()
    return
  }
  try {
    const statuses: DocumentAuditStatus[] = [
      'PENDING',
      'APPROVED',
      'REJECTED',
    ]
    const results = await Promise.all(
      statuses.map((auditStatus) =>
        documentApi.list({
          current: 1,
          pageSize: 1,
          auditStatus,
          latestOnly: true,
        }),
      ),
    )
    stats.pending = results[0].total
    stats.approved = results[1].total
    stats.rejected = results[2].total
    stats.submitted =
      results[0].total + results[1].total + results[2].total
  } catch {
    stats.submitted = 0
    stats.pending = 0
    stats.approved = 0
    stats.rejected = 0
  }
}

async function refreshAll() {
  await loadDocuments()
  await loadStats()
}

function handleSearch() {
  query.current = 1
  loadDocuments()
}

function handleReset() {
  Object.assign(query, {
    current: 1,
    pageSize: 10,
    documentType: '',
    auditStatus: '',
    latestOnly: true,
    sortField: 'submitTime',
    sortOrder: 'descend',
  })
  loadDocuments()
}

function openSubmit(type: DocumentType) {
  if (!approvedSelection.value) {
    ElMessage.warning('请先完成选题并等待指导教师审核通过')
    return
  }
  submitDocumentType.value = type
  submitFile.value = null
  submitFileRecordId.value = null
  submitFileName.value = ''
  submitFileUrl.value = ''
  uploadProgress.value = 0
  submitVisible.value = true
}

function openFilePicker() {
  if (!uploading.value && !submitting.value) {
    fileInputRef.value?.click()
  }
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) {
    return
  }
  if (!/\.(pdf|doc|docx)$/i.test(file.name)) {
    ElMessage.warning('过程文档仅支持 PDF、DOC 或 DOCX')
    return
  }
  if (file.size > 50 * 1024 * 1024) {
    ElMessage.warning('文档大小不能超过 50 MB')
    return
  }

  uploading.value = true
  uploadProgress.value = 0
  try {
    const result = await fileApi.upload(file, (percent) => {
      uploadProgress.value = percent
    })
    submitFile.value = file
    submitFileRecordId.value = result.id
    submitFileName.value = result.fileName
    submitFileUrl.value = result.url
    uploadProgress.value = 100
    ElMessage.success('文档上传成功')
  } catch {
    // 请求层统一显示错误信息。
  } finally {
    uploading.value = false
  }
}

async function submitProcessDocument() {
  if (!approvedSelection.value) {
    ElMessage.warning('缺少已通过的选题信息')
    return
  }
  if (!submitFileRecordId.value) {
    ElMessage.warning('请先上传过程文档文件')
    return
  }

  submitting.value = true
  try {
    await documentApi.submit({
      selectionId: approvedSelection.value.id,
      documentType: submitDocumentType.value,
      fileRecordId: submitFileRecordId.value,
    })
    ElMessage.success(`${currentSubmitLabel.value}已提交审核`)
    submitVisible.value = false
    await refreshAll()
  } catch {
    // 请求层统一显示错误信息。
  } finally {
    submitting.value = false
  }
}

function openReview(document: DocumentInfo) {
  reviewDocument.value = document
  reviewApproved.value = true
  reviewComment.value = ''
  reviewVisible.value = true
}

async function submitReview() {
  if (!reviewDocument.value) {
    return
  }
  if (!reviewApproved.value && !reviewComment.value.trim()) {
    ElMessage.warning('驳回文档时必须填写审核意见')
    return
  }

  reviewSubmitting.value = true
  try {
    await documentApi.review({
      id: reviewDocument.value.id,
      approved: reviewApproved.value,
      auditComment: reviewComment.value.trim(),
    })
    ElMessage.success(reviewApproved.value ? '文档已审核通过' : '文档已驳回')
    reviewVisible.value = false
    await refreshAll()
  } catch {
    // 请求层统一显示错误信息。
  } finally {
    reviewSubmitting.value = false
  }
}

async function openHistory(document: DocumentInfo) {
  historyTarget.value = document
  historyDocuments.value = []
  historyVisible.value = true
  historyLoading.value = true
  try {
    const result = await documentApi.list({
      current: 1,
      pageSize: 50,
      selectionId: document.selectionId,
      documentType: document.documentType,
      latestOnly: false,
      sortField: 'version',
      sortOrder: 'descend',
    })
    historyDocuments.value = result.records
  } catch {
    historyDocuments.value = []
  } finally {
    historyLoading.value = false
  }
}

function openFile(document: DocumentInfo) {
  if (document.fileUrl) {
    window.open(document.fileUrl, '_blank', 'noopener,noreferrer')
  }
}

function openUploadedFile() {
  if (submitFileUrl.value) {
    window.open(submitFileUrl.value, '_blank', 'noopener,noreferrer')
  }
}

onMounted(async () => {
  await loadDocuments()
  await loadStats()
})
</script>

<template>
  <div class="document-page">
    <section class="page-intro">
      <div>
        <span class="intro-kicker">{{ pageCopy.kicker }}</span>
        <h2>{{ pageCopy.title }}</h2>
        <p>{{ pageCopy.description }}</p>
      </div>
      <div v-if="isStudent" class="student-progress">
        <div>
          <span>阶段提交进度</span>
          <strong>{{ stats.submitted }} / {{ DOCUMENT_TYPE_OPTIONS.length }}</strong>
        </div>
        <el-progress
          type="circle"
          :percentage="studentProgress"
          :width="58"
          :stroke-width="6"
          color="#2f76d2"
        />
      </div>
    </section>

    <section v-if="isStudent" class="selection-banner">
      <div v-if="approvedSelection" class="selection-summary">
        <span class="banner-icon"><el-icon><Document /></el-icon></span>
        <div>
          <span>当前毕业设计选题</span>
          <strong>{{ approvedSelection.topicTitle }}</strong>
          <p>{{ approvedSelection.teacherName }} · {{ approvedSelection.studentDepartment }}</p>
        </div>
        <div class="assignment-state">
          <span>任务书</span>
          <strong :class="{ warning: !issuedAssignment }">
            {{ issuedAssignment ? '已下发' : '尚未下发' }}
          </strong>
        </div>
      </div>
      <div v-else class="selection-empty">
        <el-icon><Warning /></el-icon>
        <div>
          <strong>当前没有审核通过的选题</strong>
          <p>完成选题并等待指导教师审核通过后才能提交过程文档。</p>
        </div>
      </div>
      <div
        v-if="approvedSelection && !issuedAssignment"
        class="assignment-warning"
      >
        <el-icon><Warning /></el-icon>
        指导教师尚未下发任务书，仍可按系统现有规则提交阶段文档。
      </div>
    </section>

    <section class="summary-grid">
      <article class="summary-card">
        <span class="summary-icon summary-blue"><el-icon><Document /></el-icon></span>
        <div><span>{{ isStudent ? '已提交类型' : '最新文档数' }}</span><strong>{{ stats.submitted }}</strong></div>
        <small>{{ isStudent ? '共 4 个阶段' : '每人每类一条' }}</small>
      </article>
      <article class="summary-card">
        <span class="summary-icon summary-orange"><el-icon><Clock /></el-icon></span>
        <div><span>待审核</span><strong>{{ stats.pending }}</strong></div>
        <small>等待教师处理</small>
      </article>
      <article class="summary-card">
        <span class="summary-icon summary-green"><el-icon><Check /></el-icon></span>
        <div><span>审核通过</span><strong>{{ stats.approved }}</strong></div>
        <small>阶段材料合格</small>
      </article>
      <article class="summary-card">
        <span class="summary-icon summary-red"><el-icon><Warning /></el-icon></span>
        <div><span>审核驳回</span><strong>{{ stats.rejected }}</strong></div>
        <small>可提交新版本</small>
      </article>
    </section>

    <template v-if="isStudent">
      <section class="stage-grid">
        <article
          v-for="(type, index) in DOCUMENT_TYPE_OPTIONS"
          :key="type.value"
          class="stage-card"
        >
          <div class="stage-top">
            <span class="stage-index">{{ String(index + 1).padStart(2, '0') }}</span>
            <span :class="statusClass(getLatestDocument(type.value)?.auditStatus)">
              {{
                getLatestDocument(type.value)
                  ? DOCUMENT_AUDIT_STATUS_LABELS[
                      getLatestDocument(type.value)!.auditStatus
                    ]
                  : '未提交'
              }}
            </span>
          </div>
          <h3>{{ type.label }}</h3>
          <p>{{ DOCUMENT_TYPE_DESCRIPTIONS[type.value] }}</p>

          <div
            v-if="getLatestDocument(type.value)"
            class="stage-latest"
          >
            <div>
              <span>当前版本</span>
              <strong>V{{ getLatestDocument(type.value)!.version }}</strong>
            </div>
            <div>
              <span>提交时间</span>
              <strong>{{ formatDateTime(getLatestDocument(type.value)!.submitTime) }}</strong>
            </div>
            <div class="stage-file">
              <span>{{ getLatestDocument(type.value)!.fileName }}</span>
              <el-button
                link
                type="primary"
                :icon="View"
                @click="openFile(getLatestDocument(type.value)!)"
              >
                查看
              </el-button>
            </div>
            <p
              v-if="getLatestDocument(type.value)!.auditComment"
              class="stage-comment"
            >
              审核意见：{{ getLatestDocument(type.value)!.auditComment }}
            </p>
          </div>
          <div v-else class="stage-empty">尚未提交此阶段文档</div>

          <div class="stage-actions">
            <el-button
              v-if="getLatestDocument(type.value)"
              :icon="Files"
              @click="openHistory(getLatestDocument(type.value)!)"
            >
              历史版本
            </el-button>
            <el-button
              type="primary"
              :icon="UploadFilled"
              :disabled="!approvedSelection || !canSubmit(type.value)"
              @click="openSubmit(type.value)"
            >
              {{
                !getLatestDocument(type.value)
                  ? '提交文档'
                  : getLatestDocument(type.value)!.auditStatus === 'REJECTED'
                    ? '重新提交'
                    : '不可重复提交'
              }}
            </el-button>
          </div>
        </article>
      </section>
    </template>

    <template v-else>
      <section class="filter-panel">
        <el-form
          :model="query"
          label-position="top"
          class="filter-form"
          @submit.prevent="handleSearch"
        >
          <el-form-item label="文档类型">
            <el-select v-model="query.documentType" placeholder="全部类型" clearable>
              <el-option
                v-for="option in DOCUMENT_TYPE_OPTIONS"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="审核状态">
            <el-select v-model="query.auditStatus" placeholder="全部状态" clearable>
              <el-option
                v-for="option in DOCUMENT_AUDIT_STATUS_OPTIONS"
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
            <h3>{{ isTeacher ? '待审与历史文档' : '最新过程文档' }}</h3>
            <p>共 {{ total }} 条最新版本记录</p>
          </div>
          <span v-if="isTeacher && stats.pending" class="pending-tip">
            {{ stats.pending }} 份文档等待审核
          </span>
        </div>

        <el-table
          v-loading="loading"
          :data="documents"
          row-key="id"
          class="document-table"
          empty-text="暂无符合条件的过程文档"
        >
          <el-table-column label="学生" min-width="205">
            <template #default="{ row }">
              <div class="student-cell">
                <el-avatar :size="36">{{ row.studentName?.slice(0, 1) || '生' }}</el-avatar>
                <div>
                  <strong>{{ row.studentName || '未知学生' }}</strong>
                  <span>{{ row.studentNo || '--' }} · {{ row.studentDepartment || '院系未填写' }}</span>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="文档类型" width="120">
            <template #default="{ row }">
              <span class="document-type-tag">{{ row.documentTypeText }}</span>
            </template>
          </el-table-column>
          <el-table-column label="版本" width="78">
            <template #default="{ row }">
              <strong class="version-text">V{{ row.version }}</strong>
            </template>
          </el-table-column>
          <el-table-column label="关联课题" min-width="220">
            <template #default="{ row }">
              <span class="topic-text">{{ row.topicTitle || '--' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="提交时间" min-width="165">
            <template #default="{ row }">{{ formatDateTime(row.submitTime) }}</template>
          </el-table-column>
          <el-table-column label="审核状态" width="120">
            <template #default="{ row }">
              <span :class="statusClass(row.auditStatus)">
                {{ DOCUMENT_AUDIT_STATUS_LABELS[row.auditStatus as DocumentAuditStatus] }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="190" fixed="right">
            <template #default="{ row }">
              <div class="row-actions">
                <el-button link type="primary" :icon="Files" @click="openHistory(row)">
                  版本
                </el-button>
                <el-button
                  v-if="row.fileUrl"
                  link
                  type="primary"
                  :icon="Link"
                  @click="openFile(row)"
                >
                  查看
                </el-button>
                <el-button
                  v-if="isTeacher && row.auditStatus === 'PENDING'"
                  link
                  type="primary"
                  @click="openReview(row)"
                >
                  审核
                </el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>

        <div v-if="total" class="pagination-wrap">
          <span>每页 {{ query.pageSize }} 条，共 {{ total }} 条</span>
          <el-pagination
            v-model:current-page="query.current"
            v-model:page-size="query.pageSize"
            :total="total"
            :page-sizes="[10, 20, 30, 50]"
            layout="prev, pager, next, sizes"
            background
            @current-change="loadDocuments"
            @size-change="handleSearch"
          />
        </div>
      </section>
    </template>

    <el-dialog
      v-model="submitVisible"
      :title="`提交${currentSubmitLabel}`"
      width="min(580px, 92vw)"
      destroy-on-close
      class="document-submit-dialog"
    >
      <div v-if="approvedSelection" class="submit-context">
        <span class="context-type">{{ currentSubmitLabel }}</span>
        <h3>{{ approvedSelection.topicTitle }}</h3>
        <p>{{ approvedSelection.teacherName }} · {{ approvedSelection.studentDepartment }}</p>
        <div v-if="!issuedAssignment" class="context-warning">
          指导教师尚未下发任务书，当前仍可提交阶段文档。
        </div>
      </div>

      <input
        ref="fileInputRef"
        class="file-input"
        type="file"
        accept=".pdf,.doc,.docx"
        @change="handleFileChange"
      />

      <div v-if="submitFileName" class="uploaded-file">
        <span class="uploaded-icon"><el-icon><Document /></el-icon></span>
        <div>
          <strong>{{ submitFileName }}</strong>
          <span>{{ formatFileSize(submitFile?.size) }} · 上传成功</span>
        </div>
        <el-button link type="primary" :icon="View" @click="openUploadedFile">
          查看
        </el-button>
        <el-button
          v-if="!uploading"
          link
          type="primary"
          :icon="UploadFilled"
          @click="openFilePicker"
        >
          替换
        </el-button>
      </div>
      <button
        v-else
        type="button"
        class="document-upload"
        :disabled="uploading || submitting"
        @click="openFilePicker"
      >
        <el-icon><UploadFilled /></el-icon>
        <span>{{ uploading ? '文件上传中...' : '选择过程文档文件' }}</span>
        <small>支持 PDF、DOC、DOCX，单个文件不超过 50 MB</small>
      </button>
      <div v-if="uploading" class="upload-progress">
        <span :style="{ width: `${uploadProgress}%` }" />
      </div>

      <div class="submit-note">
        待审核或审核通过的文档不能重复提交；被驳回后可上传文件生成新版本。
      </div>

      <template #footer>
        <el-button @click="submitVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="submitting"
          :disabled="uploading || !submitFileRecordId"
          @click="submitProcessDocument"
        >
          提交审核
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="reviewVisible"
      title="审核过程文档"
      width="min(570px, 92vw)"
      destroy-on-close
    >
      <div v-if="reviewDocument" class="review-summary">
        <div class="review-person">
          <el-avatar :size="42">{{ reviewDocument.studentName?.slice(0, 1) || '生' }}</el-avatar>
          <div>
            <strong>{{ reviewDocument.studentName }}</strong>
            <span>{{ reviewDocument.studentNo }} · {{ reviewDocument.topicTitle }}</span>
          </div>
        </div>
        <div class="review-document">
          <span>{{ reviewDocument.documentTypeText }}</span>
          <strong>V{{ reviewDocument.version }}</strong>
          <el-button
            v-if="reviewDocument.fileUrl"
            link
            type="primary"
            :icon="View"
            @click="openFile(reviewDocument)"
          >
            查看文件
          </el-button>
        </div>
      </div>
      <el-form label-position="top">
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

    <el-drawer
      v-model="historyVisible"
      title="文档版本历史"
      size="min(560px, 92vw)"
    >
      <template v-if="historyTarget">
        <div class="history-heading">
          <span class="document-type-tag">{{ historyTarget.documentTypeText }}</span>
          <h2>{{ historyTarget.topicTitle }}</h2>
          <p>{{ historyTarget.studentName }} · {{ historyTarget.studentNo }}</p>
        </div>

        <div v-loading="historyLoading" class="history-timeline">
          <article
            v-for="document in historyDocuments"
            :key="document.id"
            class="history-item"
          >
            <div class="history-dot" :class="{ latest: document.latest }" />
            <div class="history-card">
              <div class="history-top">
                <strong>版本 V{{ document.version }}</strong>
                <span :class="statusClass(document.auditStatus)">
                  {{ DOCUMENT_AUDIT_STATUS_LABELS[document.auditStatus] }}
                </span>
              </div>
              <p>{{ formatDateTime(document.submitTime) }} 提交</p>
              <button
                type="button"
                class="history-file"
                @click="openFile(document)"
              >
                <el-icon><Document /></el-icon>
                <span>{{ document.fileName }}</span>
                <el-icon><Link /></el-icon>
              </button>
              <div v-if="document.auditComment" class="history-comment">
                <span>{{ document.reviewerName || '指导教师' }}：</span>
                {{ document.auditComment }}
              </div>
              <small v-if="document.reviewTime">
                审核时间：{{ formatDateTime(document.reviewTime) }}
              </small>
            </div>
          </article>
          <el-empty
            v-if="!historyLoading && !historyDocuments.length"
            :image-size="80"
            description="暂无版本记录"
          />
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<style scoped>
.document-page {
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

.student-progress {
  display: flex;
  min-width: 210px;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
  padding: 12px 16px;
  border: 1px solid #e8edf4;
  border-radius: 13px;
  background: #fff;
  box-shadow: var(--panel-shadow);
}

.student-progress > div:first-child {
  display: flex;
  flex-direction: column;
}

.student-progress span {
  color: #96a2b2;
  font-size: 9.6px;
}

.student-progress strong {
  margin-top: 2px;
  color: #2c3d54;
  font-size: 18px;
}

.selection-banner {
  padding: 18px 20px;
  border: 1px solid var(--border-color);
  border-radius: 16px;
  background: #fff;
  box-shadow: var(--panel-shadow);
}

.selection-summary,
.selection-empty {
  display: flex;
  align-items: center;
  gap: 13px;
}

.banner-icon {
  display: grid;
  width: 45px;
  height: 45px;
  flex: 0 0 45px;
  place-items: center;
  border-radius: 12px;
  color: #2e74d0;
  background: #eaf2ff;
  font-size: 22.8px;
}

.selection-summary > div:nth-child(2),
.selection-empty > div {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.selection-summary span,
.selection-empty p {
  color: #94a0b0;
  font-size: 9.6px;
}

.selection-summary strong,
.selection-empty strong {
  overflow: hidden;
  margin-top: 3px;
  color: #35465c;
  font-size: 13.2px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selection-summary p {
  margin-top: 3px;
  color: #8d9aab;
  font-size: 9.6px;
}

.assignment-state {
  display: flex;
  min-width: 90px;
  flex-direction: column;
  align-items: flex-end;
}

.assignment-state strong {
  color: #198268;
  font-size: 11px;
}

.assignment-state strong.warning {
  color: #b27124;
}

.assignment-warning {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 14px;
  padding: 9px 11px;
  border-radius: 8px;
  color: #95631f;
  background: #fff7e9;
  font-size: 9.6px;
}

.selection-empty > .el-icon {
  color: #c5862e;
  font-size: 22.8px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.summary-card {
  display: flex;
  min-height: 108px;
  align-items: center;
  gap: 13px;
  padding: 17px 19px;
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

.stage-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.stage-card {
  display: flex;
  min-width: 0;
  min-height: 330px;
  flex-direction: column;
  padding: 19px;
  border: 1px solid var(--border-color);
  border-radius: 15px;
  background: #fff;
  box-shadow: var(--panel-shadow);
}

.stage-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.stage-index {
  color: #c0c9d4;
  font-size: 10.8px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.doc-status {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  padding: 5px 8px;
  border-radius: 6px;
  font-size: 9.6px;
  font-weight: 600;
}

.status-pending {
  color: #a8691d;
  background: #fff3e1;
}

.status-approved {
  color: #197c63;
  background: #e7f7f1;
}

.status-rejected {
  color: #ad4b4b;
  background: #ffeded;
}

.status-empty {
  color: #7a8798;
  background: #f1f4f8;
}

.stage-card > h3 {
  margin: 15px 0 7px;
  color: #2b3b51;
  font-size: 18px;
  font-weight: 650;
}

.stage-card > p {
  color: #8996a8;
  font-size: 10.8px;
  line-height: 1.7;
}

.stage-latest {
  display: flex;
  flex-direction: column;
  gap: 9px;
  margin-top: auto;
  padding-top: 16px;
}

.stage-latest > div {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.stage-latest span {
  color: #9ba6b5;
  font-size: 9.6px;
}

.stage-latest strong {
  color: #5f7087;
  font-size: 9.6px;
  font-weight: 500;
  text-align: right;
}

.stage-file {
  align-items: center;
  padding: 9px 10px;
  border-radius: 8px;
  background: #f7f9fc;
}

.stage-file span {
  overflow: hidden;
  color: #4d6a8c;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stage-file :deep(.el-button) {
  height: auto;
  padding: 0;
  font-size: 9.6px;
}

.stage-comment {
  padding: 8px 9px;
  border-radius: 7px;
  color: #9d655d !important;
  background: #fff4f2;
  font-size: 9.6px !important;
  line-height: 1.55 !important;
}

.stage-empty {
  margin-top: auto;
  padding: 13px 0;
  color: #a2adbb;
  font-size: 9.6px;
}

.stage-actions {
  display: flex;
  gap: 7px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid #edf1f5;
}

.stage-actions :deep(.el-button) {
  height: 34px;
  margin-left: 0;
  border-radius: 8px;
  font-size: 10.8px;
}

.stage-actions :deep(.el-button:last-child) {
  flex: 1;
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
  grid-template-columns: minmax(200px, 1fr) minmax(200px, 1fr) auto;
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

.document-table {
  width: 100%;
}

.document-table :deep(.el-table__header th) {
  height: 43px;
  color: #77859a;
  background: #f8fafc;
  font-size: 10.8px;
  font-weight: 600;
}

.document-table :deep(.el-table__body td) {
  height: 68px;
  border-bottom-color: #f0f3f7;
  color: #58677c;
  font-size: 11px;
}

.document-table :deep(.el-table__body tr:hover > td) {
  background: #f9fbfe;
}

.student-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.student-cell .el-avatar,
.review-person .el-avatar {
  color: #e8f4ff;
  background: linear-gradient(135deg, #4386d9, #245d9c);
  font-size: 12px;
}

.student-cell > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.student-cell strong {
  color: #34455b;
  font-size: 11px;
  font-weight: 600;
}

.student-cell span {
  overflow: hidden;
  margin-top: 3px;
  color: #97a3b3;
  font-size: 9.6px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.document-type-tag {
  display: inline-flex;
  width: fit-content;
  padding: 5px 8px;
  border-radius: 6px;
  color: #3275cc;
  background: #eaf2ff;
  font-size: 9.6px;
  font-weight: 600;
}

.version-text {
  color: #61728a;
  font-size: 10.8px;
}

.topic-text {
  overflow: hidden;
  display: block;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-actions {
  display: flex;
  align-items: center;
}

.row-actions :deep(.el-button) {
  font-size: 10.8px;
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

.file-input {
  display: none;
}

.submit-context {
  margin: -8px 0 20px;
  padding: 15px 16px;
  border-radius: 11px;
  background: #f7f9fc;
}

.context-type {
  display: inline-flex;
  padding: 4px 8px;
  border-radius: 6px;
  color: #3275cc;
  background: #eaf2ff;
  font-size: 9.6px;
  font-weight: 600;
}

.submit-context h3 {
  margin: 10px 0 5px;
  color: #314259;
  font-size: 15.6px;
  line-height: 1.5;
}

.submit-context p {
  color: #8f9cad;
  font-size: 10.8px;
}

.context-warning {
  margin-top: 10px;
  padding: 8px 10px;
  border-radius: 7px;
  color: #976421;
  background: #fff4e3;
  font-size: 9.6px;
}

.document-upload {
  display: flex;
  width: 100%;
  min-height: 140px;
  align-items: center;
  justify-content: center;
  gap: 5px;
  flex-direction: column;
  border: 1px dashed #cbd8e8;
  border-radius: 12px;
  color: #3478d0;
  background: #fafcff;
  cursor: pointer;
}

.document-upload:disabled {
  cursor: wait;
  opacity: 0.7;
}

.document-upload .el-icon {
  font-size: 27.6px;
}

.document-upload span {
  color: #536a88;
  font-size: 11px;
}

.document-upload small {
  color: #99a6b6;
  font-size: 9.6px;
}

.uploaded-file {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 14px;
  border: 1px solid #e1e8f1;
  border-radius: 10px;
  background: #fafcff;
}

.uploaded-icon {
  display: grid;
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  place-items: center;
  border-radius: 10px;
  color: #3275cc;
  background: #eaf2ff;
  font-size: 19.2px;
}

.uploaded-file > div {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.uploaded-file strong {
  overflow: hidden;
  color: #405066;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.uploaded-file span {
  margin-top: 3px;
  color: #98a4b4;
  font-size: 9.6px;
}

.uploaded-file :deep(.el-button) {
  padding-inline: 3px;
  font-size: 10.8px;
}

.upload-progress {
  height: 5px;
  overflow: hidden;
  margin-top: 9px;
  border-radius: 5px;
  background: #e8edf4;
}

.upload-progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #65a8f0, #2e76d2);
}

.submit-note {
  margin-top: 16px;
  color: #8d9aab;
  font-size: 9.6px;
  line-height: 1.7;
}

.review-summary {
  margin: -8px 0 20px;
  padding: 15px 16px;
  border-radius: 11px;
  background: #f7f9fc;
}

.review-person {
  display: flex;
  align-items: center;
  gap: 10px;
}

.review-person > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.review-person strong {
  color: #34455b;
  font-size: 12px;
}

.review-person span {
  overflow: hidden;
  margin-top: 2px;
  color: #8e9bab;
  font-size: 9.6px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.review-document {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: 13px;
  padding-top: 12px;
  border-top: 1px solid #e8edf4;
}

.review-document > span {
  color: #4e6f94;
  font-size: 10.8px;
  font-weight: 600;
}

.review-document > strong {
  color: #77879a;
  font-size: 10.8px;
}

.review-document :deep(.el-button) {
  margin-left: auto;
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

.history-heading {
  padding-bottom: 21px;
  border-bottom: 1px solid #edf1f5;
}

.history-heading h2 {
  margin: 13px 0 6px;
  color: #293a50;
  font-size: 21.6px;
  line-height: 1.5;
}

.history-heading p {
  color: #8e9bab;
  font-size: 10.8px;
}

.history-timeline {
  min-height: 180px;
  padding-top: 21px;
}

.history-item {
  position: relative;
  display: grid;
  grid-template-columns: 14px minmax(0, 1fr);
  gap: 11px;
  padding-bottom: 17px;
}

.history-item:not(:last-child)::before {
  position: absolute;
  top: 14px;
  bottom: 0;
  left: 5px;
  width: 1px;
  background: #dfe6ef;
  content: '';
}

.history-dot {
  position: relative;
  z-index: 1;
  width: 11px;
  height: 11px;
  margin-top: 4px;
  border: 3px solid #c1cbd8;
  border-radius: 50%;
  background: #fff;
}

.history-dot.latest {
  border-color: #347bd8;
  box-shadow: 0 0 0 4px rgb(52 123 216 / 10%);
}

.history-card {
  padding: 13px 14px;
  border: 1px solid #e8edf4;
  border-radius: 10px;
  background: #fafcfe;
}

.history-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.history-top > strong {
  color: #405167;
  font-size: 11px;
}

.history-card > p {
  margin-top: 5px;
  color: #97a3b3;
  font-size: 9.6px;
}

.history-file {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  gap: 7px;
  margin-top: 9px;
  padding: 8px 9px;
  border: 0;
  border-radius: 7px;
  color: #4c6a8e;
  background: #f1f5fa;
  cursor: pointer;
  font-size: 9.6px;
}

.history-file span {
  overflow: hidden;
  flex: 1;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-comment {
  margin-top: 9px;
  padding: 8px 9px;
  border-radius: 7px;
  color: #6f6151;
  background: #fff8ed;
  font-size: 9.6px;
  line-height: 1.6;
}

.history-comment span {
  color: #8d7656;
  font-weight: 600;
}

.history-card > small {
  display: block;
  margin-top: 7px;
  color: #a0aab7;
  font-size: 9.6px;
}

@media (max-width: 1280px) {
  .stage-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 980px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .page-intro {
    align-items: flex-start;
    flex-direction: column;
  }

  .student-progress {
    width: 100%;
    justify-content: space-between;
  }

  .selection-summary {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .assignment-state {
    width: 100%;
    align-items: flex-start;
  }

  .summary-grid,
  .stage-grid,
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

  .uploaded-file {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .uploaded-file > div {
    min-width: calc(100% - 52px);
  }
}
</style>
