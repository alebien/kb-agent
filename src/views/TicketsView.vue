<script setup lang="ts">
import { onMounted } from 'vue'
import TicketList from '@/components/tickets/TicketList.vue'
import { useTicketStore } from '@/stores/tickets'

/** 工单 store，提供工单列表 */
const ticketStore = useTicketStore()

onMounted(() => {
  void ticketStore.load()
})
</script>

<template>
  <section class="page-surface tickets-page">
    <!-- 工单页头部与状态筛选待实现 -->
    <TicketList :items="ticketStore.list" />
  </section>
</template>

<style scoped>
.tickets-page {
  min-height: 100%;
  padding: 20px;
}
</style>
