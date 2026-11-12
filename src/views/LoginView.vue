<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { ArrowRight, Lock, User } from '@element-plus/icons-vue'
import AppLogo from '@/components/AppLogo.vue'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const formRef = ref<FormInstance>()

const form = reactive({
  useraccount: '',
  password: '',
})

const rules: FormRules = {
  useraccount: [
    { required: true, message: '请输入账号', trigger: 'blur' },
    { min: 4, max: 23, message: '账号长度为 4 至 23 个字符', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 4, max: 13, message: '密码长度为 4 至 13 个字符', trigger: 'blur' },
  ],
}

async function handleLogin() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) {
    return
  }

  try {
    await authStore.login(form)
    ElMessage.success(`欢迎回来，${authStore.user?.name || '用户'}`)
    const redirect =
      typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await router.replace(redirect)
  } catch {
    // 请求层已展示后端返回的错误信息。
  }
}
</script>

<template>
  <div class="login-page">
    <section class="login-showcase">
      <div class="showcase-glow glow-one" />
      <div class="showcase-glow glow-two" />
      <div class="showcase-grid" />

      <div class="showcase-content">
        <AppLogo />
        <div class="showcase-copy">
          <span class="eyebrow">SKY GRADUATION PROJECT PLATFORM</span>
          <h1>让每一段<br />毕业设计旅程<br /><em>清晰可见</em></h1>
          <p>
            从课题发布、学生选题到过程审核、答辩归档，统一管理毕业设计全流程。
          </p>
        </div>

        <div class="process-preview">
          <div class="preview-line" />
          <div
            v-for="(item, index) in ['课题申报', '选题确认', '过程指导', '答辩归档']"
            :key="item"
            class="preview-step"
          >
            <span>{{ String(index + 1).padStart(2, '0') }}</span>
            <strong>{{ item }}</strong>
          </div>
        </div>
      </div>

      <div class="showcase-footer">
        <span>Sky毕业设计管理系统</span>
        <span>规范 · 协同 · 高效</span>
      </div>
    </section>

    <section class="login-panel">
      <div class="login-form-wrap">
        <div class="mobile-logo">
          <AppLogo />
        </div>
        <div class="form-heading">
          <span class="form-eyebrow">ACCOUNT LOGIN</span>
          <h2>欢迎回来</h2>
          <p>请使用系统账号登录毕业设计管理平台</p>
        </div>

        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          label-position="top"
          size="large"
          @submit.prevent="handleLogin"
        >
          <el-form-item label="账号" prop="useraccount">
            <el-input
              v-model="form.useraccount"
              placeholder="请输入用户账号"
              autocomplete="username"
              :prefix-icon="User"
              clearable
              @keyup.enter="handleLogin"
            />
          </el-form-item>
          <el-form-item label="密码" prop="password">
            <el-input
              v-model="form.password"
              type="password"
              placeholder="请输入登录密码"
              autocomplete="current-password"
              :prefix-icon="Lock"
              show-password
              @keyup.enter="handleLogin"
            />
          </el-form-item>

          <button
            type="button"
            class="login-button"
            :disabled="authStore.loginLoading"
            @click="handleLogin"
          >
            <span>{{ authStore.loginLoading ? '正在登录...' : '登录系统' }}</span>
            <el-icon v-if="!authStore.loginLoading"><ArrowRight /></el-icon>
            <span v-else class="button-spinner" />
          </button>
        </el-form>

        <div class="login-help">
          <span class="help-icon">i</span>
          <p>如忘记密码或账号无法登录，请联系学院系统管理员处理。</p>
        </div>
      </div>

      <div class="login-copyright">
        © {{ new Date().getFullYear() }} Sky毕业设计管理系统
      </div>
    </section>
  </div>
</template>

<style scoped>
.login-page {
  display: grid;
  min-height: 100vh;
  grid-template-columns: minmax(460px, 1.08fr) minmax(460px, 0.92fr);
  background: #fff;
}

.login-showcase {
  position: relative;
  display: flex;
  min-height: 100vh;
  overflow: hidden;
  flex-direction: column;
  padding: 46px clamp(44px, 6vw, 92px) 36px;
  color: #fff;
  background:
    linear-gradient(145deg, rgb(10 34 68 / 94%), rgb(8 27 55 / 98%)),
    #0b2140;
}

.showcase-grid {
  position: absolute;
  inset: 0;
  opacity: 0.16;
  background-image:
    linear-gradient(rgb(255 255 255 / 18%) 1px, transparent 1px),
    linear-gradient(90deg, rgb(255 255 255 / 18%) 1px, transparent 1px);
  background-size: 54px 54px;
  mask-image: linear-gradient(to bottom right, #000, transparent 72%);
}

.showcase-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(1px);
}

.glow-one {
  top: -170px;
  right: -110px;
  width: 480px;
  height: 480px;
  background: radial-gradient(circle, rgb(47 124 246 / 34%), transparent 68%);
}

.glow-two {
  bottom: -260px;
  left: -140px;
  width: 620px;
  height: 620px;
  border: 1px solid rgb(100 169 255 / 12%);
  background: radial-gradient(circle, rgb(45 120 223 / 18%), transparent 66%);
}

.showcase-content {
  position: relative;
  z-index: 2;
  display: flex;
  flex: 1;
  flex-direction: column;
}

.showcase-copy {
  margin: auto 0 0;
  padding: clamp(42px, 8vh, 92px) 0 40px;
}

.eyebrow,
.form-eyebrow {
  color: #73b4ff;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.2em;
}

.showcase-copy h1 {
  margin: 20px 0 22px;
  font-size: clamp(50.4px, 5.16vw, 79.2px);
  font-weight: 600;
  letter-spacing: -0.055em;
  line-height: 1.17;
}

.showcase-copy h1 em {
  color: #80baff;
  font-style: normal;
}

.showcase-copy p {
  max-width: 500px;
  color: rgb(207 224 245 / 67%);
  font-size: 18px;
  line-height: 1.9;
}

.process-preview {
  position: relative;
  display: grid;
  max-width: 620px;
  grid-template-columns: repeat(4, 1fr);
  margin-bottom: clamp(30px, 6vh, 70px);
  padding: 20px 0;
}

.preview-line {
  position: absolute;
  top: 27px;
  right: 11%;
  left: 11%;
  height: 1px;
  background: linear-gradient(
    90deg,
    rgb(112 178 255 / 8%),
    rgb(112 178 255 / 45%),
    rgb(112 178 255 / 8%)
  );
}

.preview-step {
  position: relative;
  display: flex;
  align-items: center;
  flex-direction: column;
}

.preview-step span {
  position: relative;
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 1px solid rgb(123 184 255 / 35%);
  border-radius: 50%;
  color: #91c6ff;
  background: #0c2548;
  font-size: 10.8px;
  font-weight: 700;
}

.preview-step:first-of-type span {
  border-color: #62a8ff;
  color: #fff;
  background: #2572d5;
  box-shadow: 0 0 0 6px rgb(54 133 235 / 13%);
}

.preview-step strong {
  margin-top: 12px;
  color: rgb(221 234 250 / 67%);
  font-size: 13.2px;
  font-weight: 500;
}

.showcase-footer {
  position: relative;
  z-index: 2;
  display: flex;
  justify-content: space-between;
  padding-top: 24px;
  border-top: 1px solid rgb(255 255 255 / 8%);
  color: rgb(187 209 237 / 42%);
  font-size: 12px;
  letter-spacing: 0.05em;
}

.login-panel {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 64px clamp(40px, 7vw, 110px);
  background:
    radial-gradient(circle at 90% 10%, rgb(68 139 243 / 5%), transparent 30%),
    #fff;
}

.login-form-wrap {
  width: 100%;
  max-width: 410px;
}

.mobile-logo {
  display: none;
}

.form-heading {
  margin-bottom: 36px;
}

.form-eyebrow {
  color: #387ee0;
}

.form-heading h2 {
  margin: 11px 0 9px;
  color: #15233a;
  font-size: 40.8px;
  font-weight: 700;
  letter-spacing: -0.045em;
}

.form-heading p {
  color: #929eae;
  font-size: 15.6px;
}

.login-form-wrap :deep(.el-form-item) {
  margin-bottom: 24px;
}

.login-form-wrap :deep(.el-form-item__label) {
  padding-bottom: 8px;
  color: #4d5d72;
  font-size: 14.4px;
  font-weight: 600;
}

.login-form-wrap :deep(.el-input__wrapper) {
  height: 50px;
  border-radius: 12px;
  background: #f8fafc;
  box-shadow: 0 0 0 1px #e5ebf3 inset;
  transition: 0.2s ease;
}

.login-form-wrap :deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #bdcce0 inset;
}

.login-form-wrap :deep(.el-input__wrapper.is-focus) {
  background: #fff;
  box-shadow: 0 0 0 1px #397fe4 inset, 0 0 0 4px rgb(57 127 228 / 8%);
}

.login-form-wrap :deep(.el-input__inner) {
  color: #26364c;
  font-size: 15.6px;
}

.login-button {
  display: flex;
  width: 100%;
  height: 50px;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 7px;
  border: 0;
  border-radius: 12px;
  color: #fff;
  background: linear-gradient(135deg, #276fd2, #1855b2);
  box-shadow: 0 10px 24px rgb(35 105 205 / 22%);
  cursor: pointer;
  font-size: 16.8px;
  font-weight: 600;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.login-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 14px 28px rgb(35 105 205 / 27%);
}

.login-button:disabled {
  cursor: wait;
  opacity: 0.72;
}

.button-spinner {
  width: 15px;
  height: 15px;
  border: 2px solid rgb(255 255 255 / 32%);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.75s linear infinite;
}

.login-help {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  margin-top: 28px;
  padding: 14px 15px;
  border: 1px solid #edf1f6;
  border-radius: 11px;
  background: #fafbfd;
}

.help-icon {
  display: grid;
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  place-items: center;
  border-radius: 50%;
  color: #6c91c7;
  background: #e8f0fb;
  font-family: Georgia, serif;
  font-size: 12px;
  font-weight: 700;
}

.login-help p {
  color: #8996a7;
  font-size: 13.2px;
  line-height: 1.65;
}

.login-copyright {
  position: absolute;
  bottom: 28px;
  color: #b2bcc9;
  font-size: 12px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 900px) {
  .login-page {
    grid-template-columns: 1fr;
  }

  .login-showcase {
    display: none;
  }

  .login-panel {
    min-height: 100vh;
    padding: 60px 24px 80px;
    background:
      linear-gradient(180deg, #f4f8fd 0, #fff 38%),
      #fff;
  }

  .mobile-logo {
    display: block;
    margin-bottom: 48px;
    padding: 15px 17px;
    border-radius: 15px;
    background: #102b51;
  }
}
</style>

