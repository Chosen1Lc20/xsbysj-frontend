<script setup lang="ts">
defineProps<{
  compact?: boolean
}>()
</script>

<template>
  <div class="app-logo" :class="{ 'is-compact': compact }">
    <div class="logo-mark" aria-hidden="true">
      <svg viewBox="0 0 48 48" fill="none">
        <path
          d="M7 17.5 24 9l17 8.5L24 26 7 17.5Z"
          fill="currentColor"
          fill-opacity=".95"
        />
        <path
          d="M13 22.5v8.2c0 2.1 4.9 5.8 11 5.8s11-3.7 11-5.8v-8.2L24 28 13 22.5Z"
          fill="currentColor"
          fill-opacity=".55"
        />
        <path
          d="M40 19v10"
          stroke="currentColor"
          stroke-width="2.6"
          stroke-linecap="round"
        />
        <circle cx="40" cy="31.5" r="2.3" fill="currentColor" />
      </svg>
    </div>
    <div v-if="!compact" class="logo-copy">
      <strong>Sky毕业设计管理系统</strong>
      <span>Sky Graduation System</span>
    </div>
  </div>
</template>

<style scoped>
.app-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  color: #fff;
}

.logo-mark {
  display: grid;
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  place-items: center;
  border: 1px solid rgb(255 255 255 / 20%);
  border-radius: 13px;
  color: #8dc3ff;
  background: linear-gradient(145deg, rgb(255 255 255 / 16%), rgb(79 150 255 / 12%));
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 14%);
}

.logo-mark svg {
  width: 28px;
  height: 28px;
}

.logo-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.logo-copy strong {
  overflow: hidden;
  color: #fff;
  font-size: 15.6px;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.logo-copy span {
  margin-top: 2px;
  color: rgb(196 216 242 / 58%);
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  white-space: nowrap;
}

.is-compact {
  justify-content: center;
}
</style>

