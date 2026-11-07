<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules, InputInstance } from 'element-plus'
import { login as requestLogin } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'

/** 登录状态 store，提供弹窗开关与登录写入 */
const authStore = useAuthStore()
/** 路由实例，登录成功后返回受保护页面 */
const router = useRouter()

/** 登录表单实例，用于提交前校验 */
const formRef = ref<FormInstance>()
/** 密码输入框实例，打开弹窗时自动聚焦 */
const passwordInputRef = ref<InputInstance>()
/** 是否正在提交登录请求 */
const isSubmitting = ref(false)
/** 弹窗当前是否处于打开状态，避免关闭后延迟聚焦 */
let isDialogActive = false

/** 登录表单数据 */
const form = reactive({
  /** 登录账号 */
  account: '',
  /** 登录密码 */
  password: '',
  /** 是否记住账号，下次打开自动预填 */
  remember: true,
})

/** 表单校验规则 */
const rules: FormRules<typeof form> = {
  account: [
    { required: true, message: '请输入账号', trigger: 'blur' },
    { min: 2, max: 32, message: '账号长度为 2-32 个字符', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 32, message: '密码长度为 6-32 个字符', trigger: 'blur' },
  ],
}

/** 登录弹窗的显隐状态，与 auth store 双向同步 */
const visible = computed({
  get: () => authStore.isLoginDialogOpen,
  set: (value: boolean) => {
    if (value) {
      authStore.openLoginDialog()
      return
    }

    authStore.closeLoginDialog()
  },
})

/** 每次打开弹窗时重置表单，并预填上次记住的账号 */
function handleOpen() {
  form.account = authStore.rememberedAccount
  form.password = ''
  form.remember = true
  formRef.value?.clearValidate()

  isDialogActive = true
  window.setTimeout(() => {
    if (isDialogActive) {
      passwordInputRef.value?.focus()
    }
  }, 60)
}

/** 关闭动画结束后清理错误提示，避免下次打开闪现旧状态 */
function handleClosed() {
  isDialogActive = false
  formRef.value?.resetFields()
}

/** 校验表单并提交登录请求 */
async function submitLogin() {
  if (isSubmitting.value) {
    return
  }

  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) {
    return
  }

  isSubmitting.value = true

  try {
    const result = await requestLogin({
      account: form.account,
      password: form.password,
    })

    authStore.setRememberedAccount(form.remember ? form.account : '')
    authStore.login(result.user, result.token)

    /** 登录前被拦截的目标地址 */
    const redirect = authStore.consumePendingRedirect()
    authStore.closeLoginDialog()
    ElMessage.success(`欢迎回来，${result.user.name}`)

    if (redirect) {
      // 回跳只生效一次，路由参数里不带 redirect，刷新后不再恢复
      await router.replace(redirect)
    }
  } catch (error) {
    /** 接口返回的错误信息，未知错误使用兜底文案 */
    const message = error instanceof Error ? error.message : '登录失败，请稍后重试'
    ElMessage.error(message)
  } finally {
    isSubmitting.value = false
  }
}

/** 回车提交，输入法组合中不拦截 */
function handleSubmitKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.isComposing) {
    event.preventDefault()
    void submitLogin()
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    width="min(420px, 92vw)"
    align-center
    append-to-body
    :close-on-click-modal="!isSubmitting"
    :close-on-press-escape="!isSubmitting"
    :show-close="!isSubmitting"
    modal-class="login-dialog-overlay"
    class="login-dialog"
    @open="handleOpen"
    @closed="handleClosed"
  >
    <template #header>
      <div class="login-dialog__header">
        <div class="login-dialog__mark">K</div>
        <h2>登录 KnoAgent</h2>
        <p>登录后只查看和管理你自己的对话</p>
      </div>
    </template>

    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
      class="login-form"
      @keydown="handleSubmitKeydown"
    >
      <el-form-item label="账号" prop="account">
        <el-input
          v-model="form.account"
          placeholder="请输入账号"
          autocomplete="username"
          :disabled="isSubmitting"
          clearable
        >
          <template #prefix>
            <svg class="login-form__icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </template>
        </el-input>
      </el-form-item>

      <el-form-item label="密码" prop="password">
        <el-input
          ref="passwordInputRef"
          v-model="form.password"
          type="password"
          placeholder="请输入密码"
          autocomplete="current-password"
          :disabled="isSubmitting"
          show-password
        >
          <template #prefix>
            <svg class="login-form__icon" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="4" y="10" width="16" height="11" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
          </template>
        </el-input>
      </el-form-item>

      <div class="login-form__options">
        <el-checkbox v-model="form.remember" :disabled="isSubmitting">记住账号</el-checkbox>
      </div>

      <el-button
        type="primary"
        class="login-form__submit"
        :loading="isSubmitting"
        @click="submitLogin"
      >
        {{ isSubmitting ? '登录中...' : '登录' }}
      </el-button>

      <div class="login-form__demo">
        <p>演示账号，密码均为 123456</p>
        <span>agent 林晓 · agent2 周岚</span>
        <span>两个账号数据互相隔离，可用于验证会话隔离</span>
      </div>
    </el-form>
  </el-dialog>
</template>

<style scoped>
:global(.login-dialog) {
  max-width: 420px;
  border-radius: 16px;
}

:global(.login-dialog .el-dialog__header) {
  padding: 28px 28px 0;
}

:global(.login-dialog .el-dialog__body) {
  padding: 20px 28px 28px;
}

:global(.login-dialog-overlay) {
  backdrop-filter: blur(3px);
}

.login-dialog__header {
  text-align: center;
}

.login-dialog__mark {
  display: grid;
  width: 48px;
  height: 48px;
  margin: 0 auto 14px;
  place-items: center;
  color: #fff;
  font-size: 24px;
  font-weight: 700;
  background: var(--el-color-primary);
  border-radius: 14px;
}

.login-dialog__header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  line-height: 1.4;
}

.login-dialog__header p {
  margin: 6px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.login-form :deep(.el-form-item__label) {
  padding-bottom: 6px;
  font-size: 13px;
}

.login-form :deep(.el-form-item) {
  margin-bottom: 18px;
}

.login-form :deep(.el-input__wrapper) {
  padding: 1px 12px;
}

.login-form :deep(.el-input__inner) {
  height: 38px;
}

.login-form__icon {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentcolor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
}

.login-form__options {
  margin: -4px 0 18px;
}

.login-form__options :deep(.el-checkbox__label) {
  font-size: 13px;
}

.login-form__submit {
  width: 100%;
  height: 40px;
  font-size: 14px;
}

.login-form__demo {
  margin: 14px 0 0;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
  text-align: center;
}

.login-form__demo p {
  margin: 0 0 4px;
}

.login-form__demo span {
  display: block;
  margin-top: 2px;
}

@media (max-width: 640px) {
  :global(.login-dialog .el-dialog__header) {
    padding: 24px 20px 0;
  }

  :global(.login-dialog .el-dialog__body) {
    padding: 16px 20px 22px;
  }
}
</style>
