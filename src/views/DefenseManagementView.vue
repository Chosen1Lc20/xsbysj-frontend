<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Calendar,
  Clock,
  Delete,
  EditPen,
  Location,
  Plus,
  Refresh,
  Search,
  User,
  UserFilled,
  View,
} from '@element-plus/icons-vue'
import { defenseGroupApi } from '@/api/defense'
import { selectionApi } from '@/api/selection'
import { userApi } from '@/api/user'
import DefenseGroupFormDialog from '@/components/defense/DefenseGroupFormDialog.vue'
import { useAuthStore } from '@/stores/auth'
import type { DefenseGroupInfo, DefenseGroupQuery } from '@/types/defense'
import type { SelectionInfo } from '@/types/selection'
import type { TeacherOption } from '@/types/user'
import { formatDateTime } from '@/utils/format'

const authStore = useAuthStore()
const loading = ref(false)
const groups = ref<DefenseGroupInfo[]>([])
const total = ref(0)
const teacherOptions = ref<TeacherOption[]>([])
const eligibleSelections = ref<SelectionInfo[]>([])
const detailVisible = ref(false)
const selectedGroup = ref<DefenseGroupInfo | null>(null)
const formVisible = ref(false)
const formMode = ref<'add' | 'edit'>('add')
const editingGroup = ref<DefenseGroupInfo | null>(null)
const optionsLoading = ref(false)

const query = reactive<DefenseGroupQuery>({
  current: 1,
  pageSize: 8,
  groupName: '',
  location: '',
  sortField: 'defenseTime',
  sortOrder: 'ascend',
})

const defenseTimeRange = ref<[string, string] | null>(null)
const stats = reactive({
  groups: 0,
  teachers: 0,
  students: 0,
  upcoming: 0,
})

const isAdmin = computed(() => authStore.user?.role === 'admin')
const isTeacher = computed(() => authStore.user?.role === 'teacher')
const pageCopy = computed(() => {
  if (isAdmin.value) {
    return {
      kicker: 'DEFENSE ARRANGEMENT',
      title: '答辩分组管理',
      description:
        '维护答辩组、答辩教师和学生名单，统一安排答辩时间与地点。',
    }
  }
  if (isTeacher.value) {
    return {
      kicker: 'MY DEFENSE GROUP',
      title: '我的答辩安排',
      description:
        '查看本人参与的答辩组、同组教师、答辩学生以及时间和地点安排。',
    }
  }
  return {
    kicker: 'DEFENSE NOTICE',
    title: '我的答辩安排',
    description:
      '查看本人所属答辩组、答辩教师、答辩时间和具体地点。',
  }
})

function parseDate(value: string) {
  return new Date(value.replace(' ', 'T')).getTime()
}

function isUpcoming(group: DefenseGroupInfo) {
  return parseDate(group.defenseTime) >= Date.now()
}

function dateParts(value: string) {
  const date = new Date(value.replace(' ', 'T'))
  return {
    month: `${date.getMonth() + 1}月`,
    day: String(date.getDate()).padStart(2, '0'),
    week: new Intl.DateTimeFormat('zh-CN', { weekday: 'short' }).format(date),
    time: new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date),
  }
}

function uniqueTeacherCount(list: DefenseGroupInfo[]) {
  return new Set(
    list.flatMap((group) =>
      group.teachers.map((teacher) => String(teacher.teacherId)),
    ),
  ).size
}

function uniqueStudentCount(list: DefenseGroupInfo[]) {
  return new Set(
    list.flatMap((group) =>
      group.students.map((student) => String(student.studentId)),
    ),
  ).size
}

function syncVisibleStats(list: DefenseGroupInfo[]) {
  stats.groups = total.value
  stats.teachers = uniqueTeacherCount(list)
  stats.students = uniqueStudentCount(list)
  stats.upcoming = list.filter(isUpcoming).length
}

async function loadGroups() {
  loading.value = true
  try {
    query.defenseTimeStart = defenseTimeRange.value?.[0]
    query.defenseTimeEnd = defenseTimeRange.value?.[1]
    const result = await defenseGroupApi.list(query)
    groups.value = result.records
    total.value = result.total
    if (isAdmin.value) {
      await loadAdminStats()
    } else {
      syncVisibleStats(result.records)
    }
  } catch {
    groups.value = []
    total.value = 0
    syncVisibleStats([])
  } finally {
    loading.value = false
  }
}

async function loadAdminStats() {
  try {
    const allGroups: DefenseGroupInfo[] = []
    let current = 1
    let pages = 1
    do {
      const result = await defenseGroupApi.list({
        current,
        pageSize: 50,
        sortField: 'defenseTime',
        sortOrder: 'ascend',
      })
      allGroups.push(...result.records)
      pages = result.pages
      current += 1
    } while (current <= pages)

    stats.groups = allGroups.length
    stats.teachers = uniqueTeacherCount(allGroups)
    stats.students = uniqueStudentCount(allGroups)
    stats.upcoming = allGroups.filter(isUpcoming).length
  } catch {
    syncVisibleStats(groups.value)
  }
}

async function loadAdminOptions() {
  if (!isAdmin.value) {
    return
  }
  optionsLoading.value = true
  try {
    const [teachers, selections] = await Promise.all([
      teacherOptions.value.length
        ? Promise.resolve(teacherOptions.value)
        : userApi.listTeachers(),
      loadAllApprovedSelections(),
    ])
    teacherOptions.value = teachers
    eligibleSelections.value = selections
  } catch {
    // 请求层统一显示错误信息。
  } finally {
    optionsLoading.value = false
  }
}

async function loadAllApprovedSelections() {
  const records: SelectionInfo[] = []
  let current = 1
  let pages = 1
  do {
    const result = await selectionApi.list({
      current,
      pageSize: 50,
      status: 'APPROVED',
    })
    records.push(...result.records)
    pages = result.pages
    current += 1
  } while (current <= pages)
  return records
}

function handleSearch() {
  query.current = 1
  loadGroups()
}

function handleReset() {
  Object.assign(query, {
    current: 1,
    pageSize: 8,
    groupName: '',
    location: '',
    sortField: 'defenseTime',
    sortOrder: 'ascend',
  })
  defenseTimeRange.value = null
  loadGroups()
}

function openDetail(group: DefenseGroupInfo) {
  selectedGroup.value = group
  detailVisible.value = true
}

async function openAddForm() {
  if (optionsLoading.value) {
    return
  }
  if (!teacherOptions.value.length || !eligibleSelections.value.length) {
    await loadAdminOptions()
  }
  formMode.value = 'add'
  editingGroup.value = null
  formVisible.value = true
}

async function openEditForm(group: DefenseGroupInfo) {
  if (!teacherOptions.value.length || !eligibleSelections.value.length) {
    await loadAdminOptions()
  }
  formMode.value = 'edit'
  editingGroup.value = group
  formVisible.value = true
}

async function deleteGroup(group: DefenseGroupInfo) {
  try {
    await ElMessageBox.confirm(
      `确定删除“${group.groupName}”吗？答辩教师和学生分配将一并移除。`,
      '删除答辩组',
      {
        confirmButtonText: '确认删除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'danger-confirm-button',
      },
    )
    await defenseGroupApi.remove(group.id)
    ElMessage.success('答辩组已删除')
    detailVisible.value = false
    await loadGroups()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      return
    }
  }
}

function handleSaved() {
  loadGroups()
}

function getInitial(name?: string | null) {
  return name?.slice(0, 1) || '用'
}

onMounted(async () => {
  await loadGroups()
})
</script>

<template>
  <div class="defense-page">
    <section class="page-intro">
      <div>
        <span class="intro-kicker">{{ pageCopy.kicker }}</span>
        <h2>{{ pageCopy.title }}</h2>
        <p>{{ pageCopy.description }}</p>
      </div>
      <el-button
        v-if="isAdmin"
        type="primary"
        size="large"
        :icon="Plus"
        :loading="optionsLoading"
        @click="openAddForm"
      >
        新建答辩组
      </el-button>
    </section>

    <section class="summary-grid">
      <article class="summary-card">
        <span class="summary-icon summary-blue"><el-icon><Calendar /></el-icon></span>
        <div><span>答辩组总数</span><strong>{{ stats.groups }}</strong></div>
        <small>{{ isAdmin ? '全院答辩组' : '本人所属答辩组' }}</small>
      </article>
      <article class="summary-card">
        <span class="summary-icon summary-green"><el-icon><User /></el-icon></span>
        <div><span>答辩教师</span><strong>{{ stats.teachers }}</strong></div>
        <small>{{ isAdmin ? '全院参与教师' : '本页参与教师' }}</small>
      </article>
      <article class="summary-card">
        <span class="summary-icon summary-purple"><el-icon><UserFilled /></el-icon></span>
        <div><span>答辩学生</span><strong>{{ stats.students }}</strong></div>
        <small>{{ isAdmin ? '全院答辩学生' : '本页答辩学生' }}</small>
      </article>
      <article class="summary-card">
        <span class="summary-icon summary-orange"><el-icon><Clock /></el-icon></span>
        <div><span>即将举行</span><strong>{{ stats.upcoming }}</strong></div>
        <small>{{ isAdmin ? '全院待答辩组' : '本页待答辩组' }}</small>
      </article>
    </section>

    <section class="filter-panel">
      <el-form
        :model="query"
        label-position="top"
        class="filter-form"
        @submit.prevent="handleSearch"
      >
        <el-form-item label="答辩组名称">
          <el-input
            v-model="query.groupName"
            placeholder="输入答辩组名称"
            clearable
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="答辩地点">
          <el-input
            v-model="query.location"
            placeholder="输入答辩地点"
            clearable
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="答辩时间">
          <el-date-picker
            v-model="defenseTimeRange"
            type="datetimerange"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            value-format="YYYY-MM-DD HH:mm:ss"
            format="YYYY-MM-DD HH:mm"
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

    <section v-loading="loading" class="defense-list-panel">
      <div class="list-heading">
        <div>
          <h3>{{ isAdmin ? '答辩组列表' : '我的答辩组' }}</h3>
          <p>共找到 {{ total }} 个答辩组</p>
        </div>
        <span v-if="!isAdmin" class="readonly-tip">
          答辩安排由学院管理员统一维护
        </span>
      </div>

      <div v-if="groups.length" class="defense-grid">
        <article v-for="group in groups" :key="group.id" class="defense-card">
          <div class="defense-card-top">
            <div class="date-tile">
              <span>{{ dateParts(group.defenseTime).month }}</span>
              <strong>{{ dateParts(group.defenseTime).day }}</strong>
              <small>{{ dateParts(group.defenseTime).week }}</small>
            </div>
            <div class="group-title">
              <span>GRADUATION DEFENSE</span>
              <h3>{{ group.groupName }}</h3>
              <p>
                <el-icon><Clock /></el-icon>
                {{ dateParts(group.defenseTime).time }}
                <i />
                <el-icon><Location /></el-icon>
                {{ group.location }}
              </p>
            </div>
            <span
              v-if="isUpcoming(group)"
              class="defense-badge upcoming"
            >
              即将举行
            </span>
            <span v-else class="defense-badge completed">已结束</span>
          </div>

          <div class="group-members">
            <div class="member-section">
              <div class="member-heading">
                <span>答辩教师</span>
                <strong>{{ group.teachers.length }} 人</strong>
              </div>
              <div class="avatar-stack">
                <el-tooltip
                  v-for="teacher in group.teachers.slice(0, 5)"
                  :key="teacher.id"
                  :content="`${teacher.teacherName} · ${teacher.teacherDepartment || '院系未填写'}`"
                >
                  <span class="stack-avatar teacher">
                    {{ getInitial(teacher.teacherName) }}
                  </span>
                </el-tooltip>
                <span v-if="group.teachers.length > 5" class="more-count">
                  +{{ group.teachers.length - 5 }}
                </span>
              </div>
            </div>

            <div class="member-divider" />

            <div class="member-section">
              <div class="member-heading">
                <span>答辩学生</span>
                <strong>{{ group.students.length }} 人</strong>
              </div>
              <div class="avatar-stack">
                <el-tooltip
                  v-for="student in group.students.slice(0, 5)"
                  :key="student.id"
                  :content="`${student.studentName} · ${student.topicTitle || '未关联课题'}`"
                >
                  <span class="stack-avatar student">
                    {{ getInitial(student.studentName) }}
                  </span>
                </el-tooltip>
                <span v-if="group.students.length > 5" class="more-count">
                  +{{ group.students.length - 5 }}
                </span>
                <span v-if="!group.students.length" class="empty-members">
                  暂未分配
                </span>
              </div>
            </div>
          </div>

          <p class="group-remark">
            {{ group.remark || '暂无答辩补充说明。' }}
          </p>

          <div class="card-actions">
            <el-button :icon="View" @click="openDetail(group)">
              查看详情
            </el-button>
            <template v-if="isAdmin">
              <el-button
                type="primary"
                plain
                :icon="EditPen"
                @click="openEditForm(group)"
              >
                编辑
              </el-button>
              <el-button
                link
                type="danger"
                :icon="Delete"
                @click="deleteGroup(group)"
              >
                删除
              </el-button>
            </template>
          </div>
        </article>
      </div>

      <el-empty
        v-else
        :image-size="100"
        :description="
          isAdmin
            ? '暂无符合条件的答辩组'
            : '你尚未被分配到答辩组'
        "
      >
        <el-button
          v-if="isAdmin"
          type="primary"
          @click="openAddForm"
        >
          创建第一个答辩组
        </el-button>
      </el-empty>

      <div v-if="total" class="pagination-wrap">
        <span>每页 {{ query.pageSize }} 条，共 {{ total }} 条</span>
        <el-pagination
          v-model:current-page="query.current"
          v-model:page-size="query.pageSize"
          :total="total"
          :page-sizes="[8, 16, 32, 48]"
          layout="prev, pager, next, sizes"
          background
          @current-change="loadGroups"
          @size-change="handleSearch"
        />
      </div>
    </section>

    <el-drawer
      v-model="detailVisible"
      title="答辩组详情"
      size="min(620px, 93vw)"
    >
      <template v-if="selectedGroup">
        <div class="detail-hero">
          <div class="detail-date">
            <span>{{ dateParts(selectedGroup.defenseTime).month }}</span>
            <strong>{{ dateParts(selectedGroup.defenseTime).day }}</strong>
            <small>{{ dateParts(selectedGroup.defenseTime).week }}</small>
          </div>
          <div>
            <span class="detail-kicker">DEFENSE GROUP</span>
            <h2>{{ selectedGroup.groupName }}</h2>
            <p>
              <el-icon><Clock /></el-icon>
              {{ formatDateTime(selectedGroup.defenseTime) }}
            </p>
            <p>
              <el-icon><Location /></el-icon>
              {{ selectedGroup.location }}
            </p>
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">
            <h4>答辩教师</h4>
            <span>{{ selectedGroup.teachers.length }} 人</span>
          </div>
          <div class="detail-person-list">
            <div
              v-for="teacher in selectedGroup.teachers"
              :key="teacher.id"
              class="detail-person"
            >
              <el-avatar :size="38">{{ getInitial(teacher.teacherName) }}</el-avatar>
              <div>
                <strong>{{ teacher.teacherName }}</strong>
                <span>{{ teacher.teacherNo || '--' }}</span>
                <small>{{ teacher.teacherDepartment || '院系未填写' }}</small>
              </div>
            </div>
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">
            <h4>答辩学生</h4>
            <span>{{ selectedGroup.students.length }} 人</span>
          </div>
          <div class="detail-person-list">
            <div
              v-for="student in selectedGroup.students"
              :key="student.id"
              class="detail-person student-person"
            >
              <el-avatar :size="38">{{ getInitial(student.studentName) }}</el-avatar>
              <div>
                <strong>{{ student.studentName }}</strong>
                <span>{{ student.studentNo || '--' }} · {{ student.studentDepartment || '院系未填写' }}</span>
                <small>{{ student.topicTitle || '未关联课题' }} · 指导教师 {{ student.teacherName || '--' }}</small>
              </div>
            </div>
            <el-empty
              v-if="!selectedGroup.students.length"
              :image-size="64"
              description="暂未分配答辩学生"
            />
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title"><h4>答辩备注</h4></div>
          <p class="detail-remark">
            {{ selectedGroup.remark || '暂无补充说明。' }}
          </p>
        </div>
      </template>

      <template #footer>
        <div v-if="selectedGroup" class="drawer-footer">
          <el-button @click="detailVisible = false">关闭</el-button>
          <template v-if="isAdmin">
            <el-button :icon="EditPen" @click="openEditForm(selectedGroup)">
              编辑答辩组
            </el-button>
            <el-button
              type="danger"
              plain
              :icon="Delete"
              @click="deleteGroup(selectedGroup)"
            >
              删除
            </el-button>
          </template>
        </div>
      </template>
    </el-drawer>

    <DefenseGroupFormDialog
      v-model="formVisible"
      :mode="formMode"
      :group="editingGroup"
      :teacher-options="teacherOptions"
      :eligible-selections="eligibleSelections"
      @saved="handleSaved"
    />
  </div>
</template>

<style scoped>
.defense-page {
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

.summary-green {
  color: #188269;
  background: #e7f7f2;
}

.summary-purple {
  color: #7157b7;
  background: #f0edff;
}

.summary-orange {
  color: #bd721f;
  background: #fff3e2;
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
.defense-list-panel {
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
  grid-template-columns: minmax(180px, 1fr) minmax(180px, 1fr) minmax(310px, 1.3fr) auto;
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
.filter-form :deep(.el-select__wrapper),
.filter-form :deep(.el-date-editor.el-input__wrapper) {
  min-height: 40px;
  border-radius: 9px;
  box-shadow: 0 0 0 1px #e4e9f1 inset;
}

.filter-form :deep(.el-date-editor) {
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

.defense-list-panel {
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

.readonly-tip {
  padding: 7px 10px;
  border-radius: 8px;
  color: #59708d;
  background: #eef4fb;
  font-size: 10.8px;
}

.defense-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 17px;
}

.defense-card {
  display: flex;
  min-width: 0;
  min-height: 330px;
  flex-direction: column;
  padding: 20px;
  border: 1px solid #e8edf4;
  border-radius: 15px;
  background: #fff;
  box-shadow: 0 5px 16px rgb(32 63 104 / 3%);
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.defense-card:hover {
  border-color: #ccdcf0;
  box-shadow: 0 12px 28px rgb(33 77 133 / 8%);
  transform: translateY(-2px);
}

.defense-card-top {
  display: flex;
  align-items: flex-start;
  gap: 13px;
}

.date-tile {
  display: flex;
  width: 62px;
  height: 70px;
  flex: 0 0 62px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  border-radius: 12px;
  color: #fff;
  background: linear-gradient(145deg, #2f76d4, #1b56a3);
  box-shadow: 0 8px 18px rgb(37 104 195 / 18%);
}

.date-tile span {
  font-size: 8.4px;
  opacity: 0.72;
}

.date-tile strong {
  margin-top: 1px;
  font-size: 24px;
  line-height: 1.1;
}

.date-tile small {
  margin-top: 1px;
  font-size: 8.4px;
  opacity: 0.7;
}

.group-title {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.group-title > span {
  color: #a0adbd;
  font-size: 8.4px;
  font-weight: 700;
  letter-spacing: 0.15em;
}

.group-title h3 {
  overflow: hidden;
  margin: 5px 0 7px;
  color: #2c3d54;
  font-size: 18px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-title p {
  display: flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;
  color: #8290a3;
  font-size: 9.6px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-title p i {
  width: 3px;
  height: 3px;
  margin: 0 3px;
  border-radius: 50%;
  background: #c4cdd8;
}

.defense-badge {
  flex: 0 0 auto;
  padding: 5px 8px;
  border-radius: 6px;
  font-size: 9.6px;
  font-weight: 600;
}

.defense-badge.upcoming {
  color: #197c63;
  background: #e7f7f1;
}

.defense-badge.completed {
  color: #7b8797;
  background: #f0f3f7;
}

.group-members {
  display: grid;
  grid-template-columns: 1fr 1px 1fr;
  gap: 15px;
  margin-top: auto;
  padding-top: 22px;
}

.member-divider {
  background: #e9eef4;
}

.member-section {
  min-width: 0;
}

.member-heading {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.member-heading span {
  color: #929eae;
  font-size: 9.6px;
}

.member-heading strong {
  color: #596a80;
  font-size: 9.6px;
  font-weight: 600;
}

.avatar-stack {
  display: flex;
  min-height: 32px;
  align-items: center;
  margin-top: 10px;
}

.stack-avatar {
  display: grid;
  width: 31px;
  height: 31px;
  margin-left: -5px;
  place-items: center;
  border: 2px solid #fff;
  border-radius: 50%;
  color: #fff;
  font-size: 9.6px;
}

.stack-avatar:first-child {
  margin-left: 0;
}

.stack-avatar.teacher {
  background: linear-gradient(135deg, #4b8bd8, #275f9f);
}

.stack-avatar.student {
  background: linear-gradient(135deg, #4bb69a, #267e69);
}

.more-count {
  display: grid;
  width: 31px;
  height: 31px;
  margin-left: -5px;
  place-items: center;
  border: 2px solid #fff;
  border-radius: 50%;
  color: #738397;
  background: #eef2f7;
  font-size: 8.4px;
}

.empty-members {
  color: #a8b2be;
  font-size: 9.6px;
}

.group-remark {
  display: -webkit-box;
  overflow: hidden;
  min-height: 34px;
  margin-top: 18px;
  padding: 10px 11px;
  border-radius: 8px;
  color: #8996a8;
  background: #f9fbfd;
  font-size: 9.6px;
  line-height: 1.6;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.card-actions {
  display: flex;
  min-height: 34px;
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

.detail-hero {
  display: flex;
  align-items: flex-start;
  gap: 17px;
  padding-bottom: 22px;
  border-bottom: 1px solid #edf1f5;
}

.detail-date {
  display: flex;
  width: 70px;
  height: 82px;
  flex: 0 0 70px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  border-radius: 14px;
  color: #fff;
  background: linear-gradient(145deg, #2f76d4, #1b56a3);
}

.detail-date span,
.detail-date small {
  font-size: 9.6px;
  opacity: 0.72;
}

.detail-date strong {
  margin: 2px 0;
  font-size: 27.6px;
  line-height: 1.05;
}

.detail-hero > div:last-child {
  min-width: 0;
}

.detail-kicker {
  color: #a0adbd;
  font-size: 8.4px;
  font-weight: 700;
  letter-spacing: 0.15em;
}

.detail-hero h2 {
  margin: 6px 0 11px;
  color: #283950;
  font-size: 21.6px;
  line-height: 1.45;
}

.detail-hero p {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 6px;
  color: #8190a3;
  font-size: 10.8px;
}

.detail-section {
  padding-top: 22px;
}

.detail-section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.detail-section-title h4 {
  color: #48586d;
  font-size: 11px;
}

.detail-section-title span {
  color: #99a5b4;
  font-size: 9.6px;
}

.detail-person-list {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.detail-person {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 11px 12px;
  border-radius: 9px;
  background: #f8fafc;
}

.detail-person .el-avatar {
  color: #eaf5ff;
  background: linear-gradient(135deg, #4789d5, #245d9b);
  font-size: 11px;
}

.student-person .el-avatar {
  background: linear-gradient(135deg, #45ae91, #267a66);
}

.detail-person > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.detail-person strong {
  color: #3e4f65;
  font-size: 11px;
}

.detail-person span {
  margin-top: 2px;
  color: #8d9aab;
  font-size: 9.6px;
}

.detail-person small {
  overflow: hidden;
  margin-top: 2px;
  color: #9ca8b7;
  font-size: 9.6px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-remark {
  padding: 13px 14px;
  border-radius: 9px;
  color: #718197;
  background: #f8fafc;
  font-size: 10.8px;
  line-height: 1.75;
  white-space: pre-wrap;
}

.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 9px;
}

@media (max-width: 1240px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .filter-form {
    grid-template-columns: 1fr 1fr;
  }

  .filter-actions {
    grid-column: span 2;
    justify-content: flex-end;
  }
}

@media (max-width: 900px) {
  .defense-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 700px) {
  .page-intro {
    align-items: flex-start;
    flex-direction: column;
  }

  .summary-grid,
  .filter-form {
    grid-template-columns: 1fr;
  }

  .filter-actions {
    grid-column: auto;
  }

  .filter-actions :deep(.el-button) {
    flex: 1;
  }

  .list-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .defense-card-top {
    flex-wrap: wrap;
  }

  .group-title h3 {
    overflow: visible;
    line-height: 1.45;
    text-overflow: clip;
    white-space: normal;
  }

  .group-members {
    grid-template-columns: 1fr;
  }

  .member-divider {
    width: 100%;
    height: 1px;
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
