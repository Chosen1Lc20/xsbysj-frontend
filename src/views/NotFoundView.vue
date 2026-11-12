<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'

const router = useRouter()
</script>

<template>
  <div class="not-found">
    <div class="not-found-number">404</div>
    <span>PAGE NOT FOUND</span>
    <h1>页面走丢了</h1>
    <p>你访问的页面不存在，或已被移动到其他位置。</p>
    <el-button type="primary" :icon="ArrowLeft" @click="router.push('/')">
      返回首页
    </el-button>
  </div>
</template>

<style scoped>
.not-found {
  display: flex;
  min-height: 100vh;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  color: #8b98a9;
  background: #f4f7fb;
  text-align: center;
}

.not-found-number {
  color: #dce5f0;
  font-size: clamp(132px, 21.6vw, 264px);
  font-weight: 800;
  letter-spacing: -0.09em;
  line-height: 0.9;
}

.not-found > span {
  margin-top: -8px;
  color: #5289d2;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.22em;
}

.not-found h1 {
  margin: 16px 0 7px;
  color: #26364c;
  font-size: 33.6px;
}

.not-found p {
  margin-bottom: 23px;
  font-size: 14.4px;
}
</style>

