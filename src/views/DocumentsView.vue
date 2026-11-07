<script setup lang="ts">
import { onMounted } from 'vue'
import DocumentList from '@/components/documents/DocumentList.vue'
import { PERMISSIONS } from '@/auth'
import { useDocumentStore } from '@/stores/documents'

/** 文档 store，提供文档列表 */
const documentStore = useDocumentStore()

onMounted(() => {
  void documentStore.load()
})
</script>

<template>
  <section class="page-surface documents-page">
    <!-- 文档页头部与筛选待实现 -->
    <div class="page-toolbar">
      <el-button v-permission="PERMISSIONS.DOCUMENT_MANAGE" type="primary">上传文档</el-button>
    </div>
    <DocumentList :items="documentStore.list" />
  </section>
</template>

<style scoped>
.documents-page {
  min-height: 100%;
  padding: 20px;
}

.page-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}
</style>
