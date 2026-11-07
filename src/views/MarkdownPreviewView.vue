<script setup lang="ts">
import { computed, ref } from 'vue'
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'
import { markdownSamples } from '@/mock'
import type { MarkdownSampleKey } from '@/mock'

/** 所有 Markdown 场景 key，用于导航和下拉选择 */
const sampleKeys = Object.keys(markdownSamples) as MarkdownSampleKey[]
/** 当前选中的 Markdown 场景 */
const activeKey = ref<MarkdownSampleKey>('refundPolicy')
/** 是否模拟流式输出状态，用于验证末尾光标 */
const isStreaming = ref(false)
/** 当前场景数据 */
const activeSample = computed(() => markdownSamples[activeKey.value])

/** 切换 Markdown 场景 */
function selectSample(key: string) {
  activeKey.value = key as MarkdownSampleKey
}
</script>

<template>
  <section class="markdown-preview page-surface">
    <aside class="preview-sidebar">
      <div class="preview-sidebar__heading">Markdown 联调</div>
      <el-menu :default-active="activeKey" class="preview-menu" @select="selectSample">
        <el-menu-item v-for="key in sampleKeys" :key="key" :index="key">
          {{ markdownSamples[key].title }}
        </el-menu-item>
      </el-menu>
    </aside>

    <main class="preview-main">
      <header class="preview-header">
        <div class="preview-heading">
          <h2>{{ activeSample.title }}</h2>
          <p>共 {{ sampleKeys.length }} 个场景，覆盖标题、列表、表格、代码块、引用和链接</p>
        </div>

        <div class="preview-actions">
          <el-select v-model="activeKey" class="preview-select" size="small">
            <el-option
              v-for="key in sampleKeys"
              :key="key"
              :label="markdownSamples[key].title"
              :value="key"
            />
          </el-select>
          <el-switch v-model="isStreaming" active-text="流式光标" />
        </div>
      </header>

      <el-scrollbar class="preview-scroll">
        <div class="preview-body">
          <MarkdownRenderer :content="activeSample.content" :streaming="isStreaming" />
        </div>
      </el-scrollbar>
    </main>
  </section>
</template>

<style scoped>
.markdown-preview {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.preview-sidebar {
  min-width: 0;
  padding: 18px 10px;
  overflow-y: auto;
  border-right: 1px solid var(--el-border-color-lighter);
}

.preview-sidebar__heading {
  padding: 0 12px 12px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  font-weight: 600;
}

.preview-menu {
  border-right: 0;
}

.preview-main {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
}

.preview-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 28px 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.preview-heading h2 {
  margin: 0;
  font-size: 18px;
}

.preview-heading p {
  margin: 4px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.preview-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: none;
}

.preview-select {
  display: none;
  width: 168px;
}

.preview-scroll {
  flex: 1;
  min-height: 0;
}

.preview-body {
  max-width: 880px;
  margin: 0 auto;
  padding: 28px;
}

@media (max-width: 760px) {
  .markdown-preview {
    grid-template-columns: 1fr;
  }

  .preview-sidebar {
    display: none;
  }

  .preview-select {
    display: block;
  }

  .preview-header {
    flex-wrap: wrap;
    padding: 16px;
  }

  .preview-actions {
    width: 100%;
    justify-content: space-between;
  }

  .preview-body {
    padding: 20px 16px;
  }
}
</style>
