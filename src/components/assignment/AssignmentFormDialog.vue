<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import {
  Delete,
  Document,
  Link,
  UploadFilled,
} from '@element-plus/icons-vue'
import { assignmentApi } from '@/api/assignment'
import { fileApi } from '@/api/file'
import type {
  AssignmentInfo,
  AssignmentSelectionContext,
} from '@/types/assignment'

const props = defineProps<{
  modelValue: boolean
  mode: 'create' | 'edit'
  selection?: AssignmentSelectionContext
  assignment?: AssignmentInfo | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: []
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})
const formRef = ref<FormInstance>()
const fileInputRef = ref<HTMLInputElement>()
const submitting = ref(false)
const uploading = ref(false)
const uploadProgress = ref(0)

const form = reactive({
  title: '',
  content: '',
  deadline: '',
  fileRecordId: null as string | number | null,
  fileName: '',
  fileUrl: '',
})

const rules: FormRules = {
  title: [
    { required: true, message: '请输入任务书标题', trigger: 'blur' },
    { max: 255, message: '任务书标题不能超过 255 个字符', trigger: 'blur' },
  ],
  deadline: [{ required: true, message: '请选择任务截止时间', trigger: 'change' }],
}

const dialogTitle = computed(() =>
  props.mode === 'create' ? '创建任务书' : '编辑任务书',
)

const contextSelection = computed(() =>
  props.mode === 'create'
    ? props.selection
    : props.assignment
      ? {
          id: props.assignment.selectionId,
          topicTitle: props.assignment.topicTitle,
          studentName: props.assignment.studentName,
          studentNo: props.assignment.studentNo,
          studentDepartment: props.assignment.studentDepartment,
        }
      : undefined,
)

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      hydrateForm()
    }
  },
)

function hydrateForm() {
  form.title =
    props.mode === 'edit'
      ? props.assignment?.title || '毕业设计任务书'
      : '毕业设计任务书'
  form.content = props.mode === 'edit' ? props.assignment?.content || '' : ''
  form.deadline = props.mode === 'edit' ? props.assignment?.deadline || '' : ''
  form.fileRecordId =
    props.mode === 'edit' ? props.assignment?.fileRecordId || null : null
  form.fileName = props.mode === 'edit' ? props.assignment?.fileName || '' : ''
  form.fileUrl = props.mode === 'edit' ? props.assignment?.fileUrl || '' : ''
  uploadProgress.value = 0
  nextTick(() => formRef.value?.clearValidate())
}

function disablePastDates(date: Date) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date.getTime() < today.getTime()
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
    ElMessage.warning('任务书附件仅支持 PDF、DOC 或 DOCX')
    return
  }
  if (file.size > 50 * 1024 * 1024) {
    ElMessage.warning('附件大小不能超过 50 MB')
    return
  }

  uploading.value = true
  uploadProgress.value = 0
  try {
    const result = await fileApi.upload(file, (percent) => {
      uploadProgress.value = percent
    })
    form.fileRecordId = result.id
    form.fileName = result.fileName
    form.fileUrl = result.url
    uploadProgress.value = 100
    ElMessage.success('附件上传成功')
  } catch {
    // 请求层统一显示错误信息。
  } finally {
    uploading.value = false
  }
}

function removeAttachment() {
  form.fileRecordId = null
  form.fileName = ''
  form.fileUrl = ''
}

function openAttachment() {
  if (form.fileUrl) {
    window.open(form.fileUrl, '_blank', 'noopener,noreferrer')
  }
}

async function submitForm() {
  if (uploading.value) {
    ElMessage.warning('附件正在上传，请稍候')
    return
  }
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) {
    return
  }

  submitting.value = true
  try {
    if (props.mode === 'create') {
      if (!props.selection) {
        ElMessage.error('缺少选题信息，无法创建任务书')
        return
      }
      await assignmentApi.add({
        selectionId: props.selection.id,
        title: form.title.trim(),
        content: form.content.trim(),
        deadline: form.deadline,
        fileRecordId: form.fileRecordId,
      })
      ElMessage.success('任务书草稿已创建')
    } else {
      if (!props.assignment) {
        ElMessage.error('缺少任务书信息')
        return
      }
      await assignmentApi.update({
        id: props.assignment.id,
        title: form.title.trim(),
        content: form.content.trim(),
        deadline: form.deadline,
        fileRecordId: form.fileRecordId,
      })
      ElMessage.success('任务书已更新')
    }
    visible.value = false
    emit('saved')
  } catch {
    // 请求层统一显示错误信息。
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="dialogTitle"
    width="min(760px, 93vw)"
    destroy-on-close
    class="assignment-form-dialog"
  >
    <div v-if="contextSelection" class="selection-context">
      <div class="context-icon">
        <el-icon><Document /></el-icon>
      </div>
      <div>
        <span>关联选题</span>
        <strong>{{ contextSelection.topicTitle || '未命名课题' }}</strong>
        <p>
          {{ contextSelection.studentName || '未知学生' }} ·
          {{ contextSelection.studentNo || '--' }} ·
          {{ contextSelection.studentDepartment || '院系未填写' }}
        </p>
      </div>
    </div>

    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
      class="assignment-form"
    >
      <div class="form-row">
        <el-form-item label="任务书标题" prop="title">
          <el-input
            v-model="form.title"
            placeholder="请输入任务书标题"
            maxlength="255"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="任务截止时间" prop="deadline">
          <el-date-picker
            v-model="form.deadline"
            type="datetime"
            placeholder="请选择截止时间"
            value-format="YYYY-MM-DD HH:mm:ss"
            format="YYYY-MM-DD HH:mm"
            :disabled-date="disablePastDates"
          />
        </el-form-item>
      </div>

      <el-form-item label="任务书正文">
        <el-input
          v-model="form.content"
          type="textarea"
          :rows="9"
          placeholder="填写研究内容、任务要求、进度安排和预期成果等"
          maxlength="20000"
          show-word-limit
        />
      </el-form-item>

      <el-form-item label="任务书附件">
        <input
          ref="fileInputRef"
          class="file-input"
          type="file"
          accept=".pdf,.doc,.docx"
          @change="handleFileChange"
        />

        <div v-if="form.fileName" class="attachment-card">
          <span class="attachment-icon"><el-icon><Document /></el-icon></span>
          <div>
            <strong>{{ form.fileName }}</strong>
            <span>{{ mode === 'edit' ? '可重新上传替换当前附件' : '上传成功，保存后关联到任务书' }}</span>
          </div>
          <el-button
            v-if="form.fileUrl"
            link
            type="primary"
            :icon="Link"
            @click="openAttachment"
          >
            打开
          </el-button>
          <el-button
            v-if="mode === 'create'"
            link
            type="danger"
            :icon="Delete"
            @click="removeAttachment"
          >
            移除
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
          class="attachment-upload"
          :disabled="uploading || submitting"
          @click="openFilePicker"
        >
          <el-icon><UploadFilled /></el-icon>
          <span>{{ uploading ? '附件上传中...' : '上传 PDF、DOC、DOCX 附件' }}</span>
          <small>单个文件不超过 50 MB，可选</small>
        </button>

        <div v-if="uploading" class="upload-progress">
          <span :style="{ width: `${uploadProgress}%` }" />
        </div>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button :disabled="submitting" @click="visible = false">取消</el-button>
      <el-button
        type="primary"
        :loading="submitting"
        :disabled="uploading"
        @click="submitForm"
      >
        {{ mode === 'create' ? '创建草稿' : '保存修改' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.selection-context {
  display: flex;
  align-items: center;
  gap: 13px;
  margin: -8px 0 21px;
  padding: 15px 16px;
  border-radius: 11px;
  background: #f6f9fc;
}

.context-icon {
  display: grid;
  width: 43px;
  height: 43px;
  flex: 0 0 43px;
  place-items: center;
  border-radius: 11px;
  color: #2f74ce;
  background: #e7f1ff;
  font-size: 21.6px;
}

.selection-context > div:last-child {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.selection-context span {
  color: #97a3b3;
  font-size: 9.6px;
}

.selection-context strong {
  overflow: hidden;
  margin-top: 3px;
  color: #34455b;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selection-context p {
  margin-top: 3px;
  color: #8d9aab;
  font-size: 9.6px;
}

.assignment-form :deep(.el-form-item__label) {
  padding-bottom: 7px;
  color: #5f6e82;
  font-size: 10.8px;
  font-weight: 600;
}

.assignment-form :deep(.el-input__wrapper),
.assignment-form :deep(.el-date-editor.el-input__wrapper) {
  min-height: 41px;
  border-radius: 9px;
  box-shadow: 0 0 0 1px #e1e7ef inset;
}

.assignment-form :deep(.el-form-item) {
  margin-bottom: 20px;
}

.assignment-form :deep(.el-date-editor) {
  width: 100%;
}

.form-row {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 16px;
}

.file-input {
  display: none;
}

.attachment-card {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 11px;
  padding: 13px 14px;
  border: 1px solid #e3e9f1;
  border-radius: 10px;
  background: #fafcff;
}

.attachment-icon {
  display: grid;
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  place-items: center;
  border-radius: 9px;
  color: #3277cf;
  background: #eaf2ff;
  font-size: 19.2px;
}

.attachment-card > div {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.attachment-card strong {
  overflow: hidden;
  color: #405066;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attachment-card span {
  margin-top: 3px;
  color: #98a4b4;
  font-size: 9.6px;
}

.attachment-card :deep(.el-button) {
  flex: 0 0 auto;
  padding-inline: 3px;
  font-size: 10.8px;
}

.attachment-upload {
  display: flex;
  width: 100%;
  min-height: 102px;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex-direction: column;
  border: 1px dashed #ccd9e8;
  border-radius: 10px;
  color: #3979c8;
  background: #fafcff;
  cursor: pointer;
  transition: 0.18s ease;
}

.attachment-upload:hover:not(:disabled) {
  border-color: #3b80da;
  background: #f5f9ff;
}

.attachment-upload:disabled {
  cursor: wait;
  opacity: 0.7;
}

.attachment-upload .el-icon {
  font-size: 24px;
}

.attachment-upload span {
  color: #5f7290;
  font-size: 10.8px;
}

.attachment-upload small {
  color: #9ca8b7;
  font-size: 9.6px;
}

.upload-progress {
  width: 100%;
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
  background: linear-gradient(90deg, #66a9f0, #2f76d2);
  transition: width 0.18s ease;
}

@media (max-width: 640px) {
  .form-row {
    grid-template-columns: 1fr;
    gap: 0;
  }

  .attachment-card {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .attachment-card > div {
    min-width: calc(100% - 50px);
  }
}
</style>
