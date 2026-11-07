<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

/** 当前路由信息，用于读取被拦截的原始地址 */
const route = useRoute()
/** 路由实例，用于返回对话页 */
const router = useRouter()

/** 被拦截的原始地址，缺失时显示通用提示 */
const blockedPath = computed(() => (typeof route.query.from === 'string' ? route.query.from : ''))

/** 返回对话首页 */
function backToChat() {
  void router.replace({ name: 'chat-draft' })
}
</script>

<template>
  <section class="page-surface forbidden-page">
    <el-result
      icon="warning"
      title="无权访问此页面"
      :sub-title="blockedPath ? `当前账号没有访问 ${blockedPath} 的权限` : '当前账号无权访问此页面'"
    >
      <template #extra>
        <el-button type="primary" @click="backToChat">返回对话</el-button>
      </template>
    </el-result>
  </section>
</template>

<style scoped>
.forbidden-page {
  display: grid;
  min-height: 100%;
  place-items: center;
  padding: 24px;
}
</style>
