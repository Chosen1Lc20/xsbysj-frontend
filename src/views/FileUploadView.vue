<script setup lang="ts">
import { computed, markRaw, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Check,
  CopyDocument,
  Delete,
  Document,
  Link,
  Picture,
  RefreshLeft,
  UploadFilled,
  Warning,
} from '@element-plus/icons-vue'
import { fileApi } from '@/api/file'
import type { FileUploadResult } from '@/types/file'
import { useAuthStore } from '@/stores/auth'

interface UploadEntry {
  id: string
  file: File
  status: 'ready' | 'uploading' | 'success' | 'error'
  progress: number
  result?: FileUploadResult
  errorMessage?: string
}

const authStore = useAuthStore()
const fileInputRef = ref<HTMLInputElement>()
const entries = ref<UploadEntry[]>([])
const dragActive = ref(false)
const uploadingAll = ref(false)

const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx']
const maxFileSize = 50 * 1024 * 1024

const pendingCount = computed(
  () =>
    entries.value.filter(
      (entry) => entry.status === 'ready' || entry.status === 'error',
    ).length,
)

const successCount = computed(
  () => entries.value.filter((entry) => entry.status === 'success').length,
)

function openFilePicker() {
  if (uploadingAll.value) {
    return
  }
  fileInputRef.value?.click()
}

function addFiles(fileList: FileList | File[]) {
  const files = Array.from(fileList)
  let skipped = 0

  files.forEach((file) => {
    const extension = file.name.split('.').pop()?.toLowerCase() || ''
    if (!allowedExtensions.includes(extension)) {
      skipped += 1
      return
    }
    if (file.size > maxFileSize) {
      skipped += 1
      return
    }

    entries.value.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file: markRaw(file),
      status: 'ready',
      progress: 0,
    })
  })

  if (skipped) {
    ElMessage.warning(
      `${skipped} 个文件未加入队列，请确认格式正确且单个文件不超过 50 MB`,
    )
  }
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files?.length) {
    addFiles(input.files)
  }
  input.value = ''
}

function handleDrop(event: DragEvent) {
  dragActive.value = false
  if (uploadingAll.value || !event.dataTransfer?.files.length) {
    return
  }
  addFiles(event.dataTransfer.files)
}

async function uploadEntry(entry: UploadEntry) {
  entry.status = 'uploading'
  entry.progress = 0
  entry.errorMessage = undefined

  try {
    entry.result = await fileApi.upload(entry.file, (percent) => {
      entry.progress = percent
    })
    entry.progress = 100
    entry.status = 'success'
  } catch (error) {
    entry.status = 'error'
    entry.errorMessage =
      error instanceof Error ? error.message : '上传失败，请稍后重试'
  }
}

async function uploadAll() {
  if (uploadingAll.value) {
    return
  }
  const queue = entries.value.filter(
    (entry) => entry.status === 'ready' || entry.status === 'error',
  )
  if (!queue.length) {
    ElMessage.info('没有待上传的文件')
    return
  }

  uploadingAll.value = true
  try {
    for (const entry of queue) {
      await uploadEntry(entry)
    }
    if (queue.every((entry) => entry.status === 'success')) {
      ElMessage.success(`${queue.length} 个文件上传完成`)
    } else {
      ElMessage.warning('部分文件上传失败，可点击重试')
    }
  } finally {
    uploadingAll.value = false
  }
}

async function retryEntry(entry: UploadEntry) {
  if (uploadingAll.value) {
    return
  }
  uploadingAll.value = true
  try {
    await uploadEntry(entry)
    if (entry.status === 'success') {
      ElMessage.success('文件已重新上传')
    }
  } finally {
    uploadingAll.value = false
  }
}

function removeEntry(entry: UploadEntry) {
  if (entry.status === 'uploading') {
    return
  }
  entries.value = entries.value.filter((item) => item.id !== entry.id)
}

function clearCompleted() {
  entries.value = entries.value.filter((entry) => entry.status !== 'success')
}

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function isImage(entry: UploadEntry) {
  return /\.(jpe?g|png|gif|webp)$/i.test(entry.file.name)
}

function fileIcon(entry: UploadEntry) {
  return isImage(entry) ? Picture : Document
}

function statusLabel(entry: UploadEntry) {
  if (entry.status === 'uploading') return '上传中'
  if (entry.status === 'success') return '上传成功'
  if (entry.status === 'error') return '上传失败'
  return '等待上传'
}

async function copyUrl(url: string) {
  try {
    await navigator.clipboard.writeText(url)
    ElMessage.success('访问地址已复制')
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = url
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    ElMessage.success('访问地址已复制')
  }
}

function openResult(entry: UploadEntry) {
  if (entry.result?.url) {
    window.open(entry.result.url, '_blank', 'noopener,noreferrer')
  }
}
</script>

<template>
  <div class="file-page">
    <section class="page-intro">
      <div>
        <span class="intro-kicker">FILE UPLOAD CENTER</span>
        <h2>文件上传</h2>
        <p>
          上传头像或毕业设计相关文档。文件将安全保存到对象存储，并返回可直接访问的地址。
        </p>
      </div>
      <div class="user-context">
        <el-avatar :size="40" :src="authStore.user?.avatarUrl || undefined">
          {{ authStore.user?.name?.slice(0, 1) || '用' }}
        </el-avatar>
        <div>
          <span>当前上传用户</span>
          <strong>{{ authStore.user?.name || '当前用户' }}</strong>
        </div>
      </div>
    </section>

    <section class="upload-layout">
      <div class="upload-main">
        <div
          class="drop-zone"
          :class="{ active: dragActive, disabled: uploadingAll }"
          @click="openFilePicker"
          @dragenter.prevent="dragActive = true"
          @dragover.prevent="dragActive = true"
          @dragleave.prevent="dragActive = false"
          @drop.prevent="handleDrop"
        >
          <input
            ref="fileInputRef"
            class="file-input"
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx"
            @change="handleFileChange"
          />
          <div class="drop-icon">
            <el-icon><UploadFilled /></el-icon>
          </div>
          <h3>拖拽文件到这里，或点击选择</h3>
          <p>支持一次选择多个文件，每个文件将单独上传</p>
          <div class="format-list">
            <span>JPG</span>
            <span>PNG</span>
            <span>GIF</span>
            <span>WEBP</span>
            <span>PDF</span>
            <span>DOC</span>
            <span>DOCX</span>
          </div>
        </div>

        <div class="upload-panel">
          <div class="panel-heading">
            <div>
              <h3>上传队列</h3>
              <p>
                待上传 {{ pendingCount }} 个 · 已成功 {{ successCount }} 个
              </p>
            </div>
            <div class="heading-actions">
              <el-button
                v-if="successCount"
                link
                @click="clearCompleted"
              >
                清理已完成
              </el-button>
              <el-button
                type="primary"
                :icon="UploadFilled"
                :loading="uploadingAll"
                :disabled="!pendingCount"
                @click="uploadAll"
              >
                开始上传
              </el-button>
            </div>
          </div>

          <div v-if="entries.length" class="file-list">
            <article
              v-for="entry in entries"
              :key="entry.id"
              class="file-item"
              :class="`is-${entry.status}`"
            >
              <button
                v-if="entry.status === 'success' && isImage(entry)"
                type="button"
                class="file-preview image-preview"
                @click="openResult(entry)"
              >
                <img :src="entry.result?.url" :alt="entry.file.name" />
              </button>
              <span v-else class="file-preview">
                <el-icon><component :is="fileIcon(entry)" /></el-icon>
              </span>

              <div class="file-content">
                <div class="file-meta-row">
                  <div class="file-meta">
                    <strong>{{ entry.file.name }}</strong>
                    <span>
                      {{ formatFileSize(entry.file.size) }} ·
                      {{ entry.file.type || '未知类型' }}
                    </span>
                  </div>
                  <span class="file-status" :class="`status-${entry.status}`">
                    <el-icon v-if="entry.status === 'success'"><Check /></el-icon>
                    <el-icon v-else-if="entry.status === 'error'"><Warning /></el-icon>
                    {{ statusLabel(entry) }}
                  </span>
                </div>

                <div v-if="entry.status === 'uploading'" class="progress-row">
                  <div class="progress-track">
                    <span :style="{ width: `${entry.progress}%` }" />
                  </div>
                  <strong>{{ entry.progress }}%</strong>
                </div>

                <div
                  v-else-if="entry.status === 'success' && entry.result"
                  class="result-row"
                >
                  <span class="result-url">{{ entry.result.url }}</span>
                  <el-button
                    link
                    type="primary"
                    :icon="CopyDocument"
                    @click="copyUrl(entry.result.url)"
                  >
                    复制地址
                  </el-button>
                  <el-button
                    link
                    type="primary"
                    :icon="Link"
                    @click="openResult(entry)"
                  >
                    打开
                  </el-button>
                </div>

                <p v-else-if="entry.status === 'error'" class="error-message">
                  {{ entry.errorMessage || '上传失败，请稍后重试' }}
                </p>
              </div>

              <div class="file-actions">
                <el-button
                  v-if="entry.status === 'error'"
                  link
                  type="primary"
                  :icon="RefreshLeft"
                  :disabled="uploadingAll"
                  @click="retryEntry(entry)"
                >
                  重试
                </el-button>
                <el-button
                  link
                  type="danger"
                  :icon="Delete"
                  :disabled="entry.status === 'uploading'"
                  @click="removeEntry(entry)"
                >
                  移除
                </el-button>
              </div>
            </article>
          </div>

          <el-empty
            v-else
            :image-size="90"
            description="暂未选择文件，请从上方添加"
          />
        </div>
      </div>

      <aside class="upload-guide">
        <div class="guide-card">
          <span class="guide-kicker">UPLOAD RULES</span>
          <h3>上传说明</h3>
          <div class="guide-list">
            <div>
              <span>01</span>
              <p>支持图片、PDF、DOC 和 DOCX 文件。</p>
            </div>
            <div>
              <span>02</span>
              <p>单个文件大小不能超过 50 MB。</p>
            </div>
            <div>
              <span>03</span>
              <p>图片文件将标记为头像，其他文件标记为附件。</p>
            </div>
            <div>
              <span>04</span>
              <p>上传成功后可复制访问地址，用于任务书或业务资料关联。</p>
            </div>
          </div>
        </div>

        <div class="notice-card">
          <el-icon><Warning /></el-icon>
          <div>
            <strong>当前页面不上传真实隐私数据</strong>
            <p>
              开发与测试阶段请使用脱敏材料，避免上传身份证、联系方式等敏感信息。
            </p>
          </div>
        </div>
      </aside>
    </section>
  </div>
</template>

<style scoped>
.file-page {
  display: flex;
  width: 100%;
  max-width: 1420px;
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
  max-width: 760px;
  color: #8795a8;
  font-size: 13.2px;
  line-height: 1.7;
}

.user-context {
  display: flex;
  min-width: 185px;
  align-items: center;
  gap: 11px;
  padding: 11px 14px;
  border: 1px solid #e8edf4;
  border-radius: 13px;
  background: #fff;
  box-shadow: var(--panel-shadow);
}

.user-context .el-avatar {
  color: #e8f4ff;
  background: linear-gradient(135deg, #4386d9, #245d9c);
}

.user-context > div {
  display: flex;
  flex-direction: column;
}

.user-context span {
  color: #97a3b3;
  font-size: 9.6px;
}

.user-context strong {
  margin-top: 2px;
  color: #2f4056;
  font-size: 13.2px;
}

.upload-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 310px;
  align-items: start;
  gap: 20px;
}

.upload-main {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 18px;
}

.drop-zone {
  display: flex;
  min-height: 250px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  padding: 28px;
  border: 2px dashed #cbd9ea;
  border-radius: 18px;
  background:
    radial-gradient(circle at 50% 0, rgb(66 139 234 / 7%), transparent 40%),
    #fff;
  box-shadow: var(--panel-shadow);
  cursor: pointer;
  transition: border-color 0.18s ease, background 0.18s ease, transform 0.18s ease;
}

.drop-zone:hover,
.drop-zone.active {
  border-color: #3a82df;
  background:
    radial-gradient(circle at 50% 0, rgb(66 139 234 / 12%), transparent 45%),
    #fbfdff;
  transform: translateY(-1px);
}

.drop-zone.disabled {
  cursor: wait;
  opacity: 0.72;
  transform: none;
}

.file-input {
  display: none;
}

.drop-icon {
  display: grid;
  width: 64px;
  height: 64px;
  place-items: center;
  border-radius: 18px;
  color: #2f79d8;
  background: linear-gradient(145deg, #e9f3ff, #f5f9ff);
  box-shadow: 0 8px 22px rgb(50 110 190 / 11%);
  font-size: 31.2px;
}

.drop-zone h3 {
  margin: 17px 0 7px;
  color: #2b3c52;
  font-size: 18px;
}

.drop-zone > p {
  color: #8e9bac;
  font-size: 11px;
}

.format-list {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 7px;
  margin-top: 17px;
}

.format-list span {
  padding: 4px 8px;
  border: 1px solid #e4eaf2;
  border-radius: 6px;
  color: #68798e;
  background: #f8fafc;
  font-size: 9.6px;
  font-weight: 600;
}

.upload-panel,
.guide-card,
.notice-card {
  border: 1px solid var(--border-color);
  border-radius: var(--panel-radius);
  background: #fff;
  box-shadow: var(--panel-shadow);
}

.upload-panel {
  min-height: 300px;
  padding: 22px 23px 18px;
}

.panel-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding-bottom: 17px;
  border-bottom: 1px solid #edf1f5;
}

.panel-heading h3 {
  color: #2b3b51;
  font-size: 18px;
  font-weight: 650;
}

.panel-heading p {
  margin-top: 4px;
  color: #98a5b5;
  font-size: 10.8px;
}

.heading-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.heading-actions :deep(.el-button) {
  height: 37px;
  border-radius: 9px;
  font-size: 11px;
}

.file-list {
  display: flex;
  flex-direction: column;
}

.file-item {
  display: flex;
  align-items: flex-start;
  gap: 13px;
  padding: 17px 2px;
  border-bottom: 1px solid #f0f3f7;
}

.file-item:last-child {
  border-bottom: 0;
}

.file-preview {
  display: grid;
  width: 46px;
  height: 46px;
  overflow: hidden;
  flex: 0 0 46px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 11px;
  color: #3277cf;
  background: #eaf2ff;
  font-size: 22.8px;
}

.image-preview {
  cursor: zoom-in;
}

.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.file-content {
  min-width: 0;
  flex: 1;
}

.file-meta-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.file-meta {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.file-meta strong {
  overflow: hidden;
  color: #3b4b61;
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-meta span {
  margin-top: 4px;
  color: #98a4b4;
  font-size: 9.6px;
}

.file-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
  padding: 4px 7px;
  border-radius: 6px;
  font-size: 9.6px;
}

.status-ready {
  color: #6b7b8f;
  background: #f1f4f8;
}

.status-uploading {
  color: #2b70c9;
  background: #eaf2ff;
}

.status-success {
  color: #197d63;
  background: #e7f7f1;
}

.status-error {
  color: #ad4d4d;
  background: #ffeded;
}

.progress-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
}

.progress-track {
  height: 5px;
  overflow: hidden;
  flex: 1;
  border-radius: 5px;
  background: #e9eef5;
}

.progress-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #65a8f0, #2e76d2);
  transition: width 0.18s ease;
}

.progress-row strong {
  color: #4f78ad;
  font-size: 9.6px;
}

.result-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 7px;
  margin-top: 9px;
}

.result-url {
  overflow: hidden;
  max-width: 460px;
  color: #69809e;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 9.6px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-row :deep(.el-button) {
  flex: 0 0 auto;
  height: auto;
  padding: 0;
  font-size: 9.6px;
}

.error-message {
  margin-top: 8px;
  color: #b05353;
  font-size: 9.6px;
}

.file-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 2px;
  padding-top: 1px;
}

.file-actions :deep(.el-button) {
  height: auto;
  padding: 2px;
  font-size: 10.8px;
}

.upload-guide {
  position: sticky;
  top: calc(var(--header-height) + 20px);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.guide-card {
  padding: 23px 22px;
}

.guide-kicker {
  color: #9eabba;
  font-size: 9.6px;
  font-weight: 700;
  letter-spacing: 0.16em;
}

.guide-card h3 {
  margin: 6px 0 20px;
  color: #2b3b51;
  font-size: 18px;
}

.guide-list {
  display: flex;
  flex-direction: column;
  gap: 17px;
}

.guide-list > div {
  display: flex;
  align-items: flex-start;
  gap: 11px;
}

.guide-list span {
  display: grid;
  width: 27px;
  height: 27px;
  flex: 0 0 27px;
  place-items: center;
  border-radius: 8px;
  color: #3075cf;
  background: #eaf2ff;
  font-size: 9.6px;
  font-weight: 700;
}

.guide-list p {
  color: #78879a;
  font-size: 11px;
  line-height: 1.7;
}

.notice-card {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  padding: 17px;
  border-color: #f0e3cd;
  background: #fffaf1;
}

.notice-card > .el-icon {
  margin-top: 2px;
  color: #c5852c;
  font-size: 19.2px;
}

.notice-card strong {
  color: #7c633e;
  font-size: 11px;
}

.notice-card p {
  margin-top: 6px;
  color: #9b8b73;
  font-size: 10.8px;
  line-height: 1.7;
}

@media (max-width: 1040px) {
  .upload-layout {
    grid-template-columns: 1fr;
  }

  .upload-guide {
    position: static;
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 720px) {
  .page-intro {
    align-items: flex-start;
    flex-direction: column;
  }

  .user-context {
    width: 100%;
  }

  .drop-zone {
    min-height: 230px;
    padding: 23px 16px;
  }

  .upload-panel {
    padding-inline: 17px;
  }

  .panel-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .heading-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .file-item {
    flex-wrap: wrap;
  }

  .file-content {
    min-width: calc(100% - 60px);
  }

  .file-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .result-row {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .guide-card {
    padding: 20px 18px;
  }

  .upload-guide {
    grid-template-columns: 1fr;
  }
}
</style>
