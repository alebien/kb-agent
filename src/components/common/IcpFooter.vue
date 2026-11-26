<script setup lang="ts">
import { computed } from 'vue'
import {
  ICP_LICENSE_NO,
  ICP_LICENSE_URL,
  POLICE_LICENSE_NO,
  POLICE_LICENSE_URL,
} from '@/config/site'

/**
 * 备案信息页脚
 *
 * 合规要求：网站首页底部展示备案号，且点击可跳转工信部备案查询页。
 * 做成通用组件的原因是它要在多处复用（主布局、登录弹窗、错误页），
 * 且将来可能追加公安联网备案号，逻辑不能散落在各页面
 */
const props = withDefaults(
  defineProps<{
    /** ICP 备案号文本，默认取站点配置 */
    icpNo?: string
    /** 工信部备案查询链接，默认取站点配置 */
    icpUrl?: string
    /** 公安联网备案号文本，留空则不展示该段 */
    policeNo?: string
    /** 公安备案查询链接，默认取站点配置 */
    policeUrl?: string
    /** 整行内容的对齐方式，窄容器里可改 start 避免折行难看 */
    align?: 'center' | 'start'
    /** 是否使用紧凑样式，用于弹窗、卡片等高度受限的场景 */
    dense?: boolean
  }>(),
  {
    icpNo: ICP_LICENSE_NO,
    icpUrl: ICP_LICENSE_URL,
    policeNo: POLICE_LICENSE_NO,
    policeUrl: POLICE_LICENSE_URL,
    align: 'center',
    dense: false,
  },
)

/** 去掉首尾空白后的 ICP 备案号，空串表示不展示这一段 */
const resolvedIcpNo = computed(() => props.icpNo.trim())

/** 去掉首尾空白后的公安备案号，空串表示不展示这一段 */
const resolvedPoliceNo = computed(() => props.policeNo.trim())

/** 两条备案号都为空时整条页脚不渲染，避免页面上留一条空白横线 */
const hasLicense = computed(
  () => Boolean(resolvedIcpNo.value) || Boolean(resolvedPoliceNo.value),
)
</script>

<template>
  <footer
    v-if="hasLicense"
    class="icp-footer"
    :class="[`is-${align}`, { 'is-dense': dense }]"
  >
    <a
      v-if="resolvedIcpNo"
      class="icp-footer__link"
      :href="icpUrl"
      target="_blank"
      rel="noopener noreferrer"
    >
      {{ resolvedIcpNo }}
    </a>
    <span
      v-if="resolvedIcpNo && resolvedPoliceNo"
      class="icp-footer__divider"
      aria-hidden="true"
      >|</span
    >
    <a
      v-if="resolvedPoliceNo"
      class="icp-footer__link"
      :href="policeUrl"
      target="_blank"
      rel="noopener noreferrer"
    >
      {{ resolvedPoliceNo }}
    </a>
  </footer>
</template>

<style scoped>
.icp-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  padding: 6px var(--app-page-gutter);
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}

.icp-footer.is-center {
  justify-content: center;
}

.icp-footer.is-start {
  justify-content: flex-start;
}

.icp-footer.is-dense {
  padding: 0;
  font-size: 11px;
}

.icp-footer__link {
  color: inherit;
  text-decoration: none;
  transition: color 0.2s;
}

.icp-footer__link:hover,
.icp-footer__link:focus-visible {
  color: var(--el-color-primary);
  text-decoration: underline;
}

.icp-footer__divider {
  color: var(--el-border-color);
}
</style>