<script setup lang="ts">
import { ref } from 'vue'

const model = ref('DeepSeek-V3')
</script>

<template>
  <div class="header-actions">
    <el-tag type="info" effect="plain">知识库 128</el-tag>
    <el-select v-model="model" class="model-select">
      <el-option label="DeepSeek-V3" value="DeepSeek-V3" />
      <el-option label="GPT-4.1" value="GPT-4.1" />
    </el-select>
    <el-button plain>流程</el-button>
    <el-avatar :size="32" class="user-avatar">Y</el-avatar>
  </div>
</template>

<style scoped>
.header-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 10px;
}

.model-select {
  width: 128px;
}

.user-avatar {
  background: var(--el-color-primary);
}

@media (max-width: 900px) {
  .header-actions > .el-tag,
  .header-actions > .el-button {
    display: none;
  }
}

@media (max-width: 640px) {
  .header-actions {
    display: none;
  }
}
</style>
