<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Delete,
  EditPen,
  Plus,
  Refresh,
  Search,
  UserFilled,
} from '@element-plus/icons-vue'
import { userApi } from '@/api/user'
import {
  ROLE_LABELS,
  ROLE_OPTIONS,
  type UserForm,
  type UserInfo,
  type UserQuery,
  type UserUpdatePayload,
} from '@/types/user'

const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const dialogMode = ref<'add' | 'edit'>('add')
const formRef = ref<FormInstance>()
const total = ref(0)
const tableData = ref<UserInfo[]>([])

const query = reactive<UserQuery>({
  current: 1,
  pageSize: 10,
  useraccount: '',
  userNo: '',
  name: '',
  role: '',
  department: '',
  sortField: 'UpdateTime',
  sortOrder: 'descend',
})

const emptyForm = (): UserForm => ({
  useraccount: '',
  password: '',
  userNo: '',
  name: '',
  role: 'student',
  department: '',
  avatarUrl: '',
})

const form = reactive<UserForm>(emptyForm())
const isEdit = computed(() => dialogMode.value === 'edit')

const dialogTitle = computed(() =>
  isEdit.value ? '编辑用户信息' : '新增系统用户',
)

const rules: FormRules = {
  useraccount: [
    { required: true, message: '请输入用户账号', trigger: 'blur' },
    { min: 4, max: 23, message: '账号长度为 4 至 23 个字符', trigger: 'blur' },
  ],
  password: [
    {
      validator: (_rule, value, callback) => {
        if (!isEdit.value && !value) {
          callback(new Error('请输入登录密码'))
          return
        }
        if (value && (value.length < 4 || value.length > 13)) {
          callback(new Error('密码长度为 4 至 13 个字符'))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
  userNo: [
    { required: true, message: '请输入学号或工号', trigger: 'blur' },
    { max: 64, message: '学号或工号不能超过 64 个字符', trigger: 'blur' },
  ],
  name: [
    { required: true, message: '请输入姓名', trigger: 'blur' },
    { max: 64, message: '姓名不能超过 64 个字符', trigger: 'blur' },
  ],
  role: [{ required: true, message: '请选择用户角色', trigger: 'change' }],
  department: [{ max: 128, message: '院系不能超过 128 个字符', trigger: 'blur' }],
  avatarUrl: [
    { max: 512, message: '头像地址不能超过 512 个字符', trigger: 'blur' },
  ],
}

async function loadUsers() {
  loading.value = true
  try {
    const result = await userApi.list(query)
    tableData.value = result.records
    total.value = result.total
  } catch {
    tableData.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  query.current = 1
  loadUsers()
}

function handleReset() {
  Object.assign(query, {
    current: 1,
    pageSize: 10,
    useraccount: '',
    userNo: '',
    name: '',
    role: '',
    department: '',
    sortField: 'UpdateTime',
    sortOrder: 'descend',
  })
  loadUsers()
}

function resetForm() {
  Object.assign(form, emptyForm())
  delete form.id
  nextTick(() => formRef.value?.clearValidate())
}

function openAddDialog() {
  dialogMode.value = 'add'
  resetForm()
  dialogVisible.value = true
}

function openEditDialog(row: UserInfo) {
  dialogMode.value = 'edit'
  Object.assign(form, {
    id: row.id,
    useraccount: row.useraccount,
    password: '',
    userNo: row.userNo,
    name: row.name,
    role: row.role,
    department: row.department || '',
    avatarUrl: row.avatarUrl || '',
  })
  dialogVisible.value = true
  nextTick(() => formRef.value?.clearValidate())
}

async function submitForm() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) {
    return
  }

  submitting.value = true
  try {
    if (isEdit.value) {
      if (form.id === undefined) {
        return
      }
      const payload: UserUpdatePayload = { ...form, id: form.id }
      if (!payload.password) {
        delete payload.password
      }
      await userApi.update(payload)
      ElMessage.success('用户信息已更新')
    } else {
      await userApi.add({ ...form })
      ElMessage.success('用户创建成功')
    }
    dialogVisible.value = false
    await loadUsers()
  } catch {
    // 请求层已展示具体错误。
  } finally {
    submitting.value = false
  }
}

async function deleteUser(row: UserInfo) {
  try {
    await ElMessageBox.confirm(
      `确定要删除用户“${row.name}（${row.useraccount}）”吗？此操作无法撤销。`,
      '删除用户',
      {
        confirmButtonText: '确认删除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'danger-confirm-button',
      },
    )
    await userApi.remove(row.id)
    ElMessage.success('用户已删除')
    if (tableData.value.length === 1 && query.current > 1) {
      query.current -= 1
    }
    await loadUsers()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      return
    }
  }
}

function getInitial(name: string) {
  return name?.slice(0, 1) || '用'
}

onMounted(loadUsers)
</script>

<template>
  <div class="user-page">
    <section class="page-intro">
      <div>
        <span class="intro-kicker">ACCOUNT ADMINISTRATION</span>
        <h2>系统用户管理</h2>
        <p>统一维护管理员、指导教师与学生账号，确保系统身份信息准确有效。</p>
      </div>
      <div class="intro-metric">
        <div class="metric-icon"><el-icon><UserFilled /></el-icon></div>
        <div>
          <span>当前账号总数</span>
          <strong>{{ total }}</strong>
        </div>
      </div>
    </section>

    <section class="filter-panel">
      <el-form
        :model="query"
        label-position="top"
        class="filter-form"
        @submit.prevent="handleSearch"
      >
        <el-form-item label="用户账号">
          <el-input
            v-model="query.useraccount"
            placeholder="账号关键字"
            clearable
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="学号 / 工号">
          <el-input
            v-model="query.userNo"
            placeholder="学号或工号"
            clearable
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="姓名">
          <el-input
            v-model="query.name"
            placeholder="姓名关键字"
            clearable
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="用户角色">
          <el-select v-model="query.role" placeholder="全部角色" clearable>
            <el-option
              v-for="option in ROLE_OPTIONS"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="所属院系">
          <el-input
            v-model="query.department"
            placeholder="院系关键字"
            clearable
            @keyup.enter="handleSearch"
          />
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
          <h3>用户列表</h3>
          <p>共 {{ total }} 个系统账号</p>
        </div>
        <el-button type="primary" :icon="Plus" @click="openAddDialog">
          新增用户
        </el-button>
      </div>

      <el-table
        v-loading="loading"
        :data="tableData"
        row-key="id"
        class="user-table"
        empty-text="暂无符合条件的用户"
      >
        <el-table-column label="用户" min-width="210">
          <template #default="{ row }">
            <div class="user-cell">
              <el-avatar :size="36" :src="row.avatarUrl || undefined">
                {{ getInitial(row.name) }}
              </el-avatar>
              <div>
                <strong>{{ row.name }}</strong>
                <span>{{ row.useraccount }}</span>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="userNo" label="学号 / 工号" min-width="145" />
        <el-table-column label="角色" width="120">
          <template #default="{ row }">
            <span class="role-tag" :class="`role-${row.role}`">
              {{ ROLE_LABELS[row.role as keyof typeof ROLE_LABELS] }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="所属院系" min-width="170">
          <template #default="{ row }">
            <span :class="{ 'empty-value': !row.department }">
              {{ row.department || '暂未填写' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="账号 ID" min-width="170">
          <template #default="{ row }">
            <span class="id-cell">{{ row.id }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <div class="row-actions">
              <el-button
                link
                type="primary"
                :icon="EditPen"
                @click="openEditDialog(row)"
              >
                编辑
              </el-button>
              <el-button link type="danger" :icon="Delete" @click="deleteUser(row)">
                删除
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrap">
        <span>每页显示 {{ query.pageSize }} 条</span>
        <el-pagination
          v-model:current-page="query.current"
          v-model:page-size="query.pageSize"
          :total="total"
          :page-sizes="[10, 20, 30, 50]"
          layout="prev, pager, next, sizes"
          background
          @current-change="loadUsers"
          @size-change="handleSearch"
        />
      </div>
    </section>

    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="min(620px, 92vw)"
      destroy-on-close
      class="user-dialog"
    >
      <p class="dialog-description">
        {{
          isEdit
            ? '修改用户基础信息。密码留空时将保持原密码不变。'
            : '创建后用户可使用账号和初始密码登录系统。'
        }}
      </p>
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        class="user-form"
      >
        <div class="form-grid">
          <el-form-item label="用户账号" prop="useraccount">
            <el-input
              v-model="form.useraccount"
              placeholder="4 至 23 个字符"
              maxlength="23"
            />
          </el-form-item>
          <el-form-item
            :label="isEdit ? '登录密码（选填）' : '登录密码'"
            prop="password"
          >
            <el-input
              v-model="form.password"
              type="password"
              :placeholder="isEdit ? '留空则不修改密码' : '4 至 13 个字符'"
              autocomplete="new-password"
              show-password
              maxlength="13"
            />
          </el-form-item>
          <el-form-item label="学号 / 工号" prop="userNo">
            <el-input
              v-model="form.userNo"
              placeholder="请输入学号或工号"
              maxlength="64"
            />
          </el-form-item>
          <el-form-item label="姓名" prop="name">
            <el-input
              v-model="form.name"
              placeholder="请输入真实姓名"
              maxlength="64"
            />
          </el-form-item>
          <el-form-item label="用户角色" prop="role">
            <el-select v-model="form.role" placeholder="请选择角色">
              <el-option
                v-for="option in ROLE_OPTIONS"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="所属院系" prop="department">
            <el-input
              v-model="form.department"
              placeholder="如：计算机学院、软件工程系"
              maxlength="128"
            />
          </el-form-item>
        </div>
        <el-form-item label="头像地址（选填）" prop="avatarUrl">
          <el-input
            v-model="form.avatarUrl"
            placeholder="请输入可访问的图片 URL"
            maxlength="512"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitForm">
          {{ isEdit ? '保存修改' : '创建用户' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.user-page {
  display: flex;
  width: 100%;
  max-width: 1580px;
  flex-direction: column;
  gap: 18px;
  margin: 0 auto;
}

.page-intro {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 2px 4px;
}

.intro-kicker {
  color: #4384dc;
  font-size: 10.8px;
  font-weight: 700;
  letter-spacing: 0.18em;
}

.page-intro h2 {
  margin: 7px 0 6px;
  color: #1c2b42;
  font-size: 28.8px;
  font-weight: 700;
  letter-spacing: -0.025em;
}

.page-intro p {
  color: #8a97a8;
  font-size: 13.2px;
}

.intro-metric {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 178px;
  padding: 12px 15px;
  border: 1px solid #e8edf4;
  border-radius: 13px;
  background: #fff;
  box-shadow: var(--panel-shadow);
}

.metric-icon {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: 10px;
  color: #2e72d0;
  background: #eaf2ff;
  font-size: 20.4px;
}

.intro-metric div:last-child {
  display: flex;
  flex-direction: column;
}

.intro-metric span {
  color: #96a2b2;
  font-size: 10.8px;
}

.intro-metric strong {
  margin-top: 1px;
  color: #26364c;
  font-size: 25.2px;
  line-height: 1.15;
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
  grid-template-columns: repeat(5, minmax(130px, 1fr)) auto;
  gap: 13px;
  align-items: end;
}

.filter-form :deep(.el-form-item) {
  margin-bottom: 17px;
}

.filter-form :deep(.el-form-item__label) {
  padding-bottom: 6px;
  color: #6f7e91;
  font-size: 12px;
  font-weight: 600;
}

.filter-form :deep(.el-input__wrapper),
.filter-form :deep(.el-select__wrapper) {
  min-height: 38px;
  border-radius: 9px;
  box-shadow: 0 0 0 1px #e5eaf1 inset;
}

.filter-form :deep(.el-input__inner),
.filter-form :deep(.el-select__placeholder),
.filter-form :deep(.el-select__selected-item) {
  font-size: 13.2px;
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
  min-height: 38px;
  border-radius: 9px;
  font-size: 13.2px;
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
  margin: 0;
  color: #2a394f;
  font-size: 18px;
  font-weight: 650;
}

.table-toolbar p {
  margin-top: 4px;
  color: #99a5b4;
  font-size: 10.8px;
}

.table-toolbar :deep(.el-button) {
  height: 36px;
  padding: 0 15px;
  border-radius: 9px;
  font-size: 13.2px;
}

.user-table {
  width: 100%;
}

.user-table :deep(.el-table__header th) {
  height: 43px;
  color: #77859a;
  background: #f8fafc;
  font-size: 12px;
  font-weight: 600;
}

.user-table :deep(.el-table__body td) {
  height: 65px;
  border-bottom-color: #f0f3f7;
  color: #58677c;
  font-size: 13.2px;
}

.user-table :deep(.el-table__body tr:hover > td) {
  background: #f9fbfe;
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-cell .el-avatar {
  color: #dcecff;
  background: linear-gradient(135deg, #3c82df, #245b9e);
  font-size: 14.4px;
}

.user-cell div {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.user-cell strong {
  color: #304158;
  font-size: 13.2px;
  font-weight: 600;
}

.user-cell span {
  margin-top: 3px;
  color: #97a3b3;
  font-size: 10.8px;
}

.role-tag {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 10.8px;
  font-weight: 500;
}

.role-admin {
  color: #7154b8;
  background: #f1edff;
}

.role-teacher {
  color: #b5671f;
  background: #fff3e5;
}

.role-student {
  color: #2474c5;
  background: #eaf3ff;
}

.empty-value {
  color: #b0bac6;
}

.id-cell {
  color: #929eae;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10.8px;
}

.row-actions {
  display: flex;
  align-items: center;
}

.row-actions :deep(.el-button) {
  font-size: 12px;
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
  font-size: 12px;
}

.pagination-wrap :deep(.el-pagination button),
.pagination-wrap :deep(.el-pager li) {
  border-radius: 7px;
}

.dialog-description {
  margin: -8px 0 21px;
  padding: 11px 13px;
  border-radius: 8px;
  color: #78879a;
  background: #f6f9fc;
  font-size: 12px;
  line-height: 1.6;
}

.user-form :deep(.el-form-item__label) {
  padding-bottom: 6px;
  color: #5e6d81;
  font-size: 12px;
  font-weight: 600;
}

.user-form :deep(.el-input__wrapper),
.user-form :deep(.el-select__wrapper) {
  border-radius: 8px;
  box-shadow: 0 0 0 1px #e1e7ef inset;
}

.user-form :deep(.el-form-item) {
  margin-bottom: 19px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 16px;
}

.form-grid :deep(.el-select) {
  width: 100%;
}

:global(.user-dialog) {
  border-radius: 15px;
}

:global(.user-dialog .el-dialog__header) {
  padding: 22px 24px 8px;
}

:global(.user-dialog .el-dialog__title) {
  color: #25354b;
  font-size: 20.4px;
  font-weight: 650;
}

:global(.user-dialog .el-dialog__body) {
  padding: 15px 24px 3px;
}

:global(.user-dialog .el-dialog__footer) {
  padding: 13px 24px 22px;
}

:global(.danger-confirm-button) {
  border-color: #d84b4b !important;
  background: #d84b4b !important;
}

@media (max-width: 1280px) {
  .filter-form {
    grid-template-columns: repeat(3, minmax(150px, 1fr));
  }
}

@media (max-width: 760px) {
  .page-intro {
    align-items: flex-start;
    flex-direction: column;
    gap: 15px;
  }

  .intro-metric {
    width: 100%;
  }

  .filter-form {
    grid-template-columns: 1fr;
    gap: 0;
  }

  .filter-actions {
    width: 100%;
  }

  .filter-actions :deep(.el-button) {
    flex: 1;
  }

  .pagination-wrap {
    align-items: flex-start;
    flex-direction: column;
    gap: 12px;
  }

  .pagination-wrap :deep(.el-pagination__sizes) {
    display: none;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>

