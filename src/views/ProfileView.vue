<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
} from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import {
  Camera,
  Check,
  Delete,
  OfficeBuilding,
  Postcard,
  RefreshLeft,
  School,
  UserFilled,
} from '@element-plus/icons-vue'
import { fileApi } from '@/api/file'
import { userApi } from '@/api/user'
import { useAuthStore } from '@/stores/auth'
import { ROLE_LABELS } from '@/types/user'

const authStore = useAuthStore()
const formRef = ref<FormInstance>()
const fileInputRef = ref<HTMLInputElement>()
const loading = ref(false)
const saving = ref(false)
const selectedAvatar = ref<File | null>(null)
const avatarPreview = ref('')

const form = reactive({
  name: '',
  department: '',
  avatarUrl: '',
})

const rules: FormRules = {
  name: [
    { required: true, message: '请输入姓名', trigger: 'blur' },
    { max: 64, message: '姓名不能超过 64 个字符', trigger: 'blur' },
  ],
  department: [{ max: 128, message: '院系不能超过 128 个字符', trigger: 'blur' }],
}

const roleLabel = computed(() =>
  authStore.user ? ROLE_LABELS[authStore.user.role] : '用户',
)

const userInitial = computed(() => form.name.trim().slice(0, 1) || '用')

const completion = computed(() => {
  const completed = [form.name, form.department, avatarPreview.value].filter(Boolean)
  return Math.round((completed.length / 3) * 100)
})

const hasChanges = computed(() => {
  const current = authStore.user
  if (!current) {
    return false
  }
  return (
    form.name.trim() !== current.name ||
    form.department.trim() !== (current.department || '') ||
    form.avatarUrl !== (current.avatarUrl || '') ||
    Boolean(selectedAvatar.value)
  )
})

const avatarHint = computed(() => {
  if (selectedAvatar.value) {
    return '新头像将在保存资料后生效'
  }
  return '建议上传正方形图片，文件不超过 5 MB'
})

function hydrateForm() {
  const current = authStore.user
  form.name = current?.name || ''
  form.department = current?.department || ''
  form.avatarUrl = current?.avatarUrl || ''
  avatarPreview.value = form.avatarUrl
  selectedAvatar.value = null
}

function revokeBlobUrl(url: string) {
  if (url.startsWith('blob:')) {
    URL.revokeObjectURL(url)
  }
}

function openFilePicker() {
  fileInputRef.value?.click()
}

function handleAvatarSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''

  if (!file) {
    return
  }
  if (!/\.(jpe?g|png|gif|webp)$/i.test(file.name)) {
    ElMessage.warning('仅支持 JPG、PNG、GIF 或 WebP 格式的图片')
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    ElMessage.warning('头像图片不能超过 5 MB')
    return
  }

  revokeBlobUrl(avatarPreview.value)
  selectedAvatar.value = file
  avatarPreview.value = URL.createObjectURL(file)
}

function removeAvatar() {
  revokeBlobUrl(avatarPreview.value)
  selectedAvatar.value = null
  avatarPreview.value = ''
  form.avatarUrl = ''
}

async function loadProfile() {
  loading.value = true
  try {
    const currentUser = await userApi.getCurrentUser()
    authStore.setCurrentUser(currentUser)
  } catch {
    // 网络异常时继续展示本地已缓存的登录用户信息。
  } finally {
    hydrateForm()
    loading.value = false
  }
}

async function saveProfile() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid || !authStore.user) {
    return
  }

  saving.value = true
  try {
    let avatarUrl = form.avatarUrl
    if (selectedAvatar.value) {
      const uploaded = await fileApi.upload(selectedAvatar.value)
      avatarUrl = uploaded.url
      form.avatarUrl = avatarUrl
      selectedAvatar.value = null
    }

    await userApi.update({
      id: authStore.user.id,
      name: form.name.trim(),
      department: form.department.trim(),
      avatarUrl,
    })

    authStore.setCurrentUser({
      ...authStore.user,
      name: form.name.trim(),
      department: form.department.trim(),
      avatarUrl: avatarUrl || null,
    })
    revokeBlobUrl(avatarPreview.value)
    hydrateForm()
    await formRef.value?.clearValidate()
    ElMessage.success('个人资料已更新')
  } catch {
    // 请求层负责展示服务端返回的错误。
  } finally {
    saving.value = false
  }
}

function resetProfile() {
  revokeBlobUrl(avatarPreview.value)
  hydrateForm()
  formRef.value?.clearValidate()
}

onMounted(loadProfile)
onBeforeUnmount(() => revokeBlobUrl(avatarPreview.value))
</script>

<template>
  <div v-loading="loading" class="profile-page">
    <section class="profile-hero">
      <div class="hero-grid" />
      <div class="hero-orbit orbit-one" />
      <div class="hero-orbit orbit-two" />

      <div class="hero-identity">
        <button
          type="button"
          class="avatar-button"
          aria-label="更换头像"
          @click="openFilePicker"
        >
          <el-avatar :size="104" :src="avatarPreview || undefined">
            {{ userInitial }}
          </el-avatar>
          <span class="avatar-overlay">
            <el-icon><Camera /></el-icon>
            <small>更换头像</small>
          </span>
        </button>
        <input
          ref="fileInputRef"
          class="file-input"
          type="file"
          accept=".jpg,.jpeg,.png,.gif,.webp,image/jpeg,image/png,image/gif,image/webp"
          @change="handleAvatarSelect"
        />

        <div class="identity-copy">
          <span class="identity-kicker">PERSONAL PROFILE</span>
          <h2>{{ form.name || '当前用户' }}</h2>
          <p>{{ form.department || '暂未填写所属院系' }}</p>
          <div class="identity-tags">
            <span>{{ roleLabel }}</span>
            <i />
            <span>{{ authStore.user?.useraccount }}</span>
          </div>
        </div>
      </div>

      <div class="completion-card">
        <div
          class="completion-ring"
          :style="{ '--progress': `${completion * 3.6}deg` }"
        >
          <div>
            <strong>{{ completion }}%</strong>
            <span>资料完整度</span>
          </div>
        </div>
        <div class="completion-copy">
          <strong>完善个人资料</strong>
          <p>完整的个人信息有助于教师和学生快速识别身份。</p>
        </div>
      </div>
    </section>

    <div class="profile-grid">
      <aside class="account-panel">
        <div class="panel-heading">
          <div>
            <span class="section-kicker">ACCOUNT INFO</span>
            <h3>账号信息</h3>
          </div>
          <span class="verified-badge">
            <el-icon><Check /></el-icon>
            已认证
          </span>
        </div>

        <div class="account-list">
          <div class="account-item">
            <span class="account-icon"><el-icon><UserFilled /></el-icon></span>
            <div>
              <span>登录账号</span>
              <strong>{{ authStore.user?.useraccount || '--' }}</strong>
            </div>
          </div>
          <div class="account-item">
            <span class="account-icon"><el-icon><Postcard /></el-icon></span>
            <div>
              <span>学号 / 工号</span>
              <strong>{{ authStore.user?.userNo || '--' }}</strong>
            </div>
          </div>
          <div class="account-item">
            <span class="account-icon"><el-icon><School /></el-icon></span>
            <div>
              <span>用户角色</span>
              <strong>{{ roleLabel }}</strong>
            </div>
          </div>
          <div class="account-item">
            <span class="account-icon"><el-icon><OfficeBuilding /></el-icon></span>
            <div>
              <span>所属院系</span>
              <strong>{{ form.department || '暂未填写' }}</strong>
            </div>
          </div>
        </div>

        <div class="account-tip">
          登录账号、学号或工号属于身份信息，如需更正请联系学院系统管理员。
        </div>
      </aside>

      <section class="edit-panel">
        <div class="panel-heading">
          <div>
            <span class="section-kicker">EDIT PROFILE</span>
            <h3>编辑个人资料</h3>
          </div>
          <span class="save-state" :class="{ changed: hasChanges }">
            <i />
            {{ hasChanges ? '有未保存的修改' : '资料已同步' }}
          </span>
        </div>

        <div class="editor-body">
          <div class="avatar-editor">
            <div class="avatar-preview">
              <el-avatar :size="82" :src="avatarPreview || undefined">
                {{ userInitial }}
              </el-avatar>
            </div>
            <div class="avatar-actions">
              <strong>个人头像</strong>
              <p>{{ avatarHint }}</p>
              <div>
                <el-button size="small" :icon="Camera" @click="openFilePicker">
                  选择图片
                </el-button>
                <el-button
                  v-if="avatarPreview"
                  size="small"
                  link
                  type="danger"
                  :icon="Delete"
                  @click="removeAvatar"
                >
                  移除头像
                </el-button>
              </div>
            </div>
          </div>

          <el-form
            ref="formRef"
            :model="form"
            :rules="rules"
            label-position="top"
            class="profile-form"
          >
            <div class="form-row">
              <el-form-item label="姓名" prop="name">
                <el-input
                  v-model="form.name"
                  placeholder="请输入姓名"
                  maxlength="64"
                  show-word-limit
                />
              </el-form-item>
              <el-form-item label="所属院系" prop="department">
                <el-input
                  v-model="form.department"
                  placeholder="如：计算机学院、软件工程系"
                  maxlength="128"
                  show-word-limit
                />
              </el-form-item>
            </div>

            <el-form-item label="登录账号">
              <el-input
                :model-value="authStore.user?.useraccount || ''"
                disabled
              />
            </el-form-item>

            <div class="form-note">
              姓名和院系会显示在课题、审核记录和答辩名单等业务页面中，请确保信息真实准确。
            </div>

            <div class="form-actions">
              <el-button :icon="RefreshLeft" @click="resetProfile">
                撤销修改
              </el-button>
              <el-button
                type="primary"
                :loading="saving"
                :disabled="!hasChanges"
                @click="saveProfile"
              >
                保存修改
              </el-button>
            </div>
          </el-form>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.profile-page {
  display: flex;
  width: 100%;
  max-width: 1420px;
  flex-direction: column;
  gap: 20px;
  margin: 0 auto;
}

.profile-hero {
  position: relative;
  display: flex;
  min-height: 220px;
  overflow: hidden;
  align-items: center;
  justify-content: space-between;
  padding: 38px 42px;
  border-radius: 20px;
  color: #fff;
  background:
    radial-gradient(circle at 78% 15%, rgb(89 157 250 / 25%), transparent 28%),
    linear-gradient(125deg, #102847 0%, #17477f 58%, #2365b3 100%);
  box-shadow: 0 16px 38px rgb(19 54 101 / 16%);
}

.hero-grid {
  position: absolute;
  inset: 0;
  opacity: 0.14;
  background-image:
    linear-gradient(rgb(255 255 255 / 16%) 1px, transparent 1px),
    linear-gradient(90deg, rgb(255 255 255 / 16%) 1px, transparent 1px);
  background-size: 52px 52px;
  mask-image: linear-gradient(90deg, transparent 20%, #000);
}

.hero-orbit {
  position: absolute;
  border: 1px solid rgb(151 201 255 / 12%);
  border-radius: 50%;
}

.orbit-one {
  top: -160px;
  right: -50px;
  width: 420px;
  height: 420px;
}

.orbit-two {
  top: -90px;
  right: 20px;
  width: 280px;
  height: 280px;
}

.hero-identity {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 25px;
}

.avatar-button {
  position: relative;
  width: 104px;
  height: 104px;
  flex: 0 0 104px;
  overflow: hidden;
  padding: 0;
  border: 3px solid rgb(255 255 255 / 38%);
  border-radius: 50%;
  background: #2e68a7;
  box-shadow: 0 12px 30px rgb(4 27 57 / 30%);
  cursor: pointer;
}

.avatar-button :deep(.el-avatar) {
  color: #ecf6ff;
  background: linear-gradient(135deg, #5192df, #245b98);
  font-size: 40.8px;
}

.avatar-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  flex-direction: column;
  color: #fff;
  background: rgb(8 31 62 / 64%);
  opacity: 0;
  backdrop-filter: blur(1px);
  transition: opacity 0.18s ease;
}

.avatar-overlay .el-icon {
  font-size: 25.2px;
}

.avatar-overlay small {
  font-size: 10.8px;
}

.avatar-button:hover .avatar-overlay {
  opacity: 1;
}

.file-input {
  display: none;
}

.identity-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.identity-kicker {
  color: rgb(155 205 255 / 74%);
  font-size: 10.8px;
  font-weight: 700;
  letter-spacing: 0.19em;
}

.identity-copy h2 {
  margin: 12px 0 5px;
  font-size: 36px;
  font-weight: 650;
  letter-spacing: -0.035em;
}

.identity-copy p {
  color: rgb(216 233 251 / 68%);
  font-size: 14.4px;
}

.identity-tags {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: 16px;
  color: rgb(226 240 255 / 62%);
  font-size: 12px;
}

.identity-tags span:first-child {
  padding: 4px 9px;
  border: 1px solid rgb(255 255 255 / 14%);
  border-radius: 7px;
  color: #ddeeff;
  background: rgb(255 255 255 / 8%);
}

.identity-tags i {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: rgb(216 233 251 / 35%);
}

.completion-card {
  position: relative;
  z-index: 2;
  display: flex;
  min-width: 280px;
  align-items: center;
  gap: 16px;
  padding: 18px 20px;
  border: 1px solid rgb(255 255 255 / 13%);
  border-radius: 16px;
  background: rgb(255 255 255 / 8%);
  backdrop-filter: blur(10px);
}

.completion-ring {
  display: grid;
  width: 76px;
  height: 76px;
  flex: 0 0 76px;
  place-items: center;
  border-radius: 50%;
  background: conic-gradient(#7fc0ff 0 var(--progress), rgb(255 255 255 / 10%) var(--progress));
}

.completion-ring::before {
  position: absolute;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: #19477f;
  content: '';
}

.completion-ring > div {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  flex-direction: column;
}

.completion-ring strong {
  font-size: 19.2px;
}

.completion-ring span {
  margin-top: 1px;
  color: rgb(217 235 255 / 57%);
  font-size: 8.4px;
}

.completion-copy {
  max-width: 150px;
}

.completion-copy strong {
  font-size: 14.4px;
}

.completion-copy p {
  margin-top: 6px;
  color: rgb(213 231 250 / 57%);
  font-size: 10.8px;
  line-height: 1.7;
}

.profile-grid {
  display: grid;
  grid-template-columns: minmax(280px, 0.72fr) minmax(520px, 1.55fr);
  gap: 20px;
}

.account-panel,
.edit-panel {
  min-width: 0;
  padding: 25px 27px;
  border: 1px solid var(--border-color);
  border-radius: var(--panel-radius);
  background: #fff;
  box-shadow: var(--panel-shadow);
}

.panel-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 23px;
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

.verified-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 8px;
  border-radius: 7px;
  color: #168061;
  background: #eaf8f3;
  font-size: 10.8px;
}

.account-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.account-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 12px;
  border-radius: 11px;
  background: #f8fafc;
}

.account-icon {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  place-items: center;
  border-radius: 9px;
  color: #3274cf;
  background: #eaf2ff;
  font-size: 19.2px;
}

.account-item > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.account-item span:not(.account-icon) {
  color: #98a4b4;
  font-size: 10.8px;
}

.account-item strong {
  overflow: hidden;
  margin-top: 3px;
  color: #3c4b61;
  font-size: 13.2px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-tip {
  margin-top: 18px;
  padding: 13px 14px;
  border: 1px solid #edf1f6;
  border-radius: 10px;
  color: #8c99aa;
  background: #fbfcfe;
  font-size: 10.8px;
  line-height: 1.7;
}

.save-state {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #98a4b4;
  font-size: 10.8px;
}

.save-state i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #48b894;
}

.save-state.changed {
  color: #c17a26;
}

.save-state.changed i {
  background: #e8a34b;
}

.avatar-editor {
  display: flex;
  align-items: center;
  gap: 18px;
  margin-bottom: 25px;
  padding: 17px;
  border: 1px dashed #dfe6ef;
  border-radius: 13px;
  background: #fafcff;
}

.avatar-preview {
  padding: 3px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 5px 16px rgb(35 80 138 / 10%);
}

.avatar-preview :deep(.el-avatar) {
  color: #eaf5ff;
  background: linear-gradient(135deg, #4386d9, #245d9c);
  font-size: 30px;
}

.avatar-actions {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.avatar-actions > strong {
  color: #3b4b61;
  font-size: 13.2px;
}

.avatar-actions p {
  margin: 4px 0 10px;
  color: #98a4b4;
  font-size: 10.8px;
}

.avatar-actions :deep(.el-button) {
  border-radius: 7px;
  font-size: 12px;
}

.profile-form :deep(.el-form-item__label) {
  padding-bottom: 7px;
  color: #5f6e82;
  font-size: 12px;
  font-weight: 600;
}

.profile-form :deep(.el-input__wrapper) {
  min-height: 42px;
  border-radius: 9px;
  box-shadow: 0 0 0 1px #e2e8f0 inset;
}

.profile-form :deep(.el-form-item) {
  margin-bottom: 21px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1.35fr;
  gap: 16px;
}

.form-note {
  padding: 12px 14px;
  border-radius: 9px;
  color: #8592a4;
  background: #f6f9fc;
  font-size: 10.8px;
  line-height: 1.7;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 9px;
  margin-top: 22px;
  padding-top: 19px;
  border-top: 1px solid #edf1f5;
}

.form-actions :deep(.el-button) {
  min-width: 96px;
  height: 38px;
  border-radius: 9px;
  font-size: 13.2px;
}

@media (max-width: 1100px) {
  .profile-grid {
    grid-template-columns: 1fr;
  }

  .account-list {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 780px) {
  .profile-hero {
    align-items: flex-start;
    flex-direction: column;
    gap: 25px;
    padding: 28px 25px;
  }

  .completion-card {
    width: 100%;
    min-width: 0;
  }

  .account-list,
  .form-row {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 520px) {
  .hero-identity {
    align-items: flex-start;
    flex-direction: column;
  }

  .account-panel,
  .edit-panel {
    padding: 21px 18px;
  }

  .avatar-editor {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>

