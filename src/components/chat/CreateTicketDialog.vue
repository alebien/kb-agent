<script setup lang="ts">
import { computed, ref, watch } from 'vue'

/** 工单分类取值 */
type TicketCategory = 'refund' | 'invoice' | 'membership' | 'logistics' | 'other'
/** 工单优先级取值 */
type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'

/** 建单确认弹窗，仅承载页面与表单，不调用建单接口 */
const props = withDefaults(
  defineProps<{
    /** 是否打开 */
    modelValue: boolean
    /** 建单标题默认值，通常取会话标题 */
    defaultTitle?: string
    /** 关联会话 id，只读展示 */
    conversationId?: string
    /** 会话已有工单号，仅用于展示复用提示，是否复用仍由后端判定 */
    existingTicketCode?: string
  }>(),
  {
    defaultTitle: '',
    conversationId: '',
    existingTicketCode: '',
  },
)

/** 向父级同步开合与确认结果 */
const emit = defineEmits<{
  /** 更新弹窗开关 */
  'update:modelValue': [value: boolean]
  /** 确认建单，携带表单内容 */
  confirm: [payload: { title: string; category: TicketCategory; priority: TicketPriority }]
}>()

/** 工单标题 */
const title = ref(props.defaultTitle)
/** 工单分类 */
const category = ref<TicketCategory>('refund')
/** 工单优先级 */
const priority = ref<TicketPriority>('medium')

/** 弹窗可见性，双向绑定到 el-dialog */
const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

/** 标题是否为空，空标题不允许提交 */
const isTitleEmpty = computed(() => !title.value.trim())

/** 分类选项 */
const CATEGORY_OPTIONS: Array<{ value: TicketCategory; label: string }> = [
  { value: 'refund', label: '退款' },
  { value: 'invoice', label: '发票' },
  { value: 'membership', label: '会员' },
  { value: 'logistics', label: '物流' },
  { value: 'other', label: '其他' },
]

/** 优先级选项 */
const PRIORITY_OPTIONS: Array<{ value: TicketPriority; label: string }> = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
  { value: 'urgent', label: '紧急' },
]

// 每次打开时把标题重置为最新会话标题
watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      title.value = props.defaultTitle
    }
  },
)

/** 确认建单，先做前端必填校验 */
function handleConfirm() {
  if (isTitleEmpty.value) {
    return
  }

  emit('confirm', {
    title: title.value.trim(),
    category: category.value,
    priority: priority.value,
  })
  visible.value = false
}
</script>

<template>
  <el-dialog v-model="visible" title="转人工建单" width="min(460px, 92vw)" append-to-body>
    <div class="ticket-form">
      <el-alert
        v-if="existingTicketCode"
        type="info"
        :closable="false"
        show-icon
        :title="`该会话已有工单 ${existingTicketCode}`"
        description="提交后由后端判断：原单未结单则复用，已结单选新建，前端不自行判定"
      />

      <label class="ticket-form__item">
        <span>工单标题</span>
        <el-input v-model="title" maxlength="60" show-word-limit placeholder="请输入工单标题" />
      </label>

      <div class="ticket-form__row">
        <label class="ticket-form__item">
          <span>分类</span>
          <el-select v-model="category">
            <el-option
              v-for="option in CATEGORY_OPTIONS"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </label>

        <label class="ticket-form__item">
          <span>优先级</span>
          <el-select v-model="priority">
            <el-option
              v-for="option in PRIORITY_OPTIONS"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </label>
      </div>

      <label class="ticket-form__item">
        <span>关联会话</span>
        <el-input :model-value="conversationId || '当前会话'" readonly />
      </label>

      <p class="ticket-form__tip">确认后将按上述信息创建工单，工单号由后端返回</p>
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :disabled="isTitleEmpty" @click="handleConfirm">确认建单</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.ticket-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ticket-form__item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.ticket-form__row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.ticket-form__tip {
  margin: 0;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}
</style>
