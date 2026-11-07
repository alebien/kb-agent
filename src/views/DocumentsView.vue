<script setup lang="ts">
import { onMounted } from 'vue'
import DocumentList from '@/components/documents/DocumentList.vue'
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
    <DocumentList :items="documentStore.list" />
  </section>
</template>

<style scoped>
.documents-page {
  min-height: 100%;
  padding: 20px;
}
</style>
