<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { Location, User, UserFilled } from '@element-plus/icons-vue'
import { defenseGroupApi } from '@/api/defense'
import type { DefenseGroupInfo, DefenseGroupSavePayload } from '@/types/defense'
import type { SelectionInfo } from '@/types/selection'
import type { TeacherOption } from '@/types/user'

const props = defineProps<{
  modelValue: boolean
  mode: 'add' | 'edit'
  group?: DefenseGroupInfo | null
  teacherOptions: TeacherOption[]
  eligibleSelections: SelectionInfo[]
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
const submitting = ref(false)

const form = reactive({
  groupName: '',
  defenseTime: '',
  location: '',
  remark: '',
  teacherIds: [] as Array<string | number>,
  studentIds: [] as Array<string | number>,
})

const rules: FormRules = {
  groupName: [
    { required: true, message: '请输入答辩组名称', trigger: 'blur' },
    { max: 64, message: '答辩组名称不能超过 64 个字符', trigger: 'blur' },
  ],
  defenseTime: [
    { required: true, message: '请选择答辩时间', trigger: 'change' },
  ],
  location: [
    { required: true, message: '请输入答辩地点', trigger: 'blur' },
    { max: 255, message: '答辩地点不能超过 255 个字符', trigger: 'blur' },
  ],
  remark: [
    { max: 500, message: '答辩备注不能超过 500 个字符', trigger: 'blur' },
  ],
  teacherIds: [
    {
      validator: (_rule, value, callback) => {
        if (!Array.isArray(value) || value.length === 0) {
          callback(new Error('请至少选择一名答辩教师'))
          return
        }
        callback()
      },
      trigger: 'change',
    },
  ],
}

const dialogTitle = computed(() =>
  props.mode === 'add' ? '新建答辩组' : '编辑答辩组',
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
  form.groupName = props.mode === 'edit' ? props.group?.groupName || '' : ''
  form.defenseTime =
    props.mode === 'edit' ? props.group?.defenseTime || '' : ''
  form.location = props.mode === 'edit' ? props.group?.location || '' : ''
  form.remark = props.mode === 'edit' ? props.group?.remark || '' : ''
  form.teacherIds =
    props.mode === 'edit'
      ? (props.group?.teachers || []).map((teacher) => teacher.teacherId)
      : []
  form.studentIds =
    props.mode === 'edit'
      ? (props.group?.students || []).map((student) => student.studentId)
      : []
  nextTick(() => formRef.value?.clearValidate())
}

function studentLabel(selection: SelectionInfo) {
  return `${selection.studentName || '未知学生'} · ${selection.studentNo || '--'} · ${selection.topicTitle || '未命名课题'}`
}

function teacherLabel(teacher: TeacherOption) {
  return `${teacher.name} · ${teacher.department || teacher.userNo}`
}

async function submitForm() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) {
    return
  }

  const payload: DefenseGroupSavePayload = {
    groupName: form.groupName.trim(),
    defenseTime: form.defenseTime,
    location: form.location.trim(),
    remark: form.remark.trim(),
    teacherIds: form.teacherIds,
    studentIds: form.studentIds,
  }

  submitting.value = true
  try {
    if (props.mode === 'edit') {
      if (!props.group) {
        ElMessage.error('缺少答辩组信息')
        return
      }
      await defenseGroupApi.update({ ...payload, id: props.group.id })
      ElMessage.success('答辩组已更新')
    } else {
      await defenseGroupApi.add(payload)
      ElMessage.success('答辩组已创建')
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
    class="defense-form-dialog"
  >
    <p class="dialog-tip">
      答辩学生只能从已审核通过选题的学生中选择，每名学生只能加入一个答辩组。
    </p>

    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
      class="defense-form"
    >
      <div class="form-row">
        <el-form-item label="答辩组名称" prop="groupName">
          <el-input
            v-model="form.groupName"
            placeholder="如：计算机学院第一答辩组"
            maxlength="64"
            show-word-limit
          >
            <template #prefix><el-icon><UserFilled /></el-icon></template>
          </el-input>
        </el-form-item>
        <el-form-item label="答辩时间" prop="defenseTime">
          <el-date-picker
            v-model="form.defenseTime"
            type="datetime"
            placeholder="请选择答辩时间"
            value-format="YYYY-MM-DD HH:mm:ss"
            format="YYYY-MM-DD HH:mm"
          />
        </el-form-item>
      </div>

      <el-form-item label="答辩地点" prop="location">
        <el-input
          v-model="form.location"
          placeholder="如：信息楼 A302"
          maxlength="255"
          show-word-limit
        >
          <template #prefix><el-icon><Location /></el-icon></template>
        </el-input>
      </el-form-item>

      <el-form-item label="答辩教师" prop="teacherIds">
        <el-select
          v-model="form.teacherIds"
          multiple
          filterable
          collapse-tags
          collapse-tags-tooltip
          placeholder="选择一名或多名答辩教师"
        >
          <template #prefix><el-icon><User /></el-icon></template>
          <el-option
            v-for="teacher in teacherOptions"
            :key="teacher.id"
            :label="teacherLabel(teacher)"
            :value="teacher.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="答辩学生">
        <el-select
          v-model="form.studentIds"
          multiple
          filterable
          collapse-tags
          collapse-tags-tooltip
          placeholder="从已通过选题的学生中选择"
        >
          <el-option
            v-for="selection in eligibleSelections"
            :key="selection.studentId"
            :label="studentLabel(selection)"
            :value="selection.studentId"
          />
        </el-select>
        <div class="selection-hint">
          当前已选择 {{ form.studentIds.length }} 名学生。学生必须已有审核通过的选题。
        </div>
      </el-form-item>

      <el-form-item label="答辩备注" prop="remark">
        <el-input
          v-model="form.remark"
          type="textarea"
          :rows="4"
          placeholder="填写答辩流程、材料要求或其他说明（选填）"
          maxlength="500"
          show-word-limit
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submitForm">
        {{ mode === 'add' ? '创建答辩组' : '保存修改' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.dialog-tip {
  margin: -8px 0 20px;
  padding: 11px 13px;
  border-radius: 8px;
  color: #78879a;
  background: #f6f9fc;
  font-size: 10.8px;
  line-height: 1.65;
}

.defense-form :deep(.el-form-item__label) {
  padding-bottom: 7px;
  color: #5f6e82;
  font-size: 10.8px;
  font-weight: 600;
}

.defense-form :deep(.el-input__wrapper),
.defense-form :deep(.el-select__wrapper),
.defense-form :deep(.el-date-editor.el-input__wrapper) {
  min-height: 42px;
  border-radius: 9px;
  box-shadow: 0 0 0 1px #e1e7ef inset;
}

.defense-form :deep(.el-form-item) {
  margin-bottom: 20px;
}

.defense-form :deep(.el-select),
.defense-form :deep(.el-date-editor) {
  width: 100%;
}

.form-row {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 16px;
}

.selection-hint {
  margin-top: 7px;
  color: #99a5b4;
  font-size: 9.6px;
  line-height: 1.6;
}

@media (max-width: 640px) {
  .form-row {
    grid-template-columns: 1fr;
    gap: 0;
  }
}
</style>
