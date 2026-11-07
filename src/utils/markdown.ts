import DOMPurify from 'dompurify'
import hljs from 'highlight.js/lib/common'
import 'highlight.js/styles/github-dark.css'
import MarkdownIt from 'markdown-it'

/**
 * 将纯文本中的 HTML 特殊字符转义为实体
 *
 * 用于代码块降级渲染：当语言未知或不支持高亮时，直接输出原始代码，
 * 必须先把 `<`、`&` 等字符转义，否则会被浏览器当成标签解析
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * markdown-it 的 `highlight` 钩子，负责把代码块内容转成高亮后的 HTML
 *
 * - `language` 由 Markdown 围栏代码块（```lang）解析得到；
 * - 仅当 highlight.js 注册过该语言时才高亮，避免抛出异常；
 * - `ignoreIllegals: true` 允许语法不完整或混有非法字符的代码继续高亮，
 *   这对流式输出中尚未闭合的代码块尤其重要；
 * - 未命中语言时回退为转义后的纯文本，保证内容不丢失且安全
 */
function highlightCode(code: string, language: string): string {
  if (language && hljs.getLanguage(language)) {
    return hljs.highlight(code, { language, ignoreIllegals: true }).value
  }
  return escapeHtml(code)
}

/**
 * 全局共享的 Markdown 解析实例
 *
 * 配置说明：
 * - `html: false`：禁止解析 Markdown 中的原生 HTML，从源头规避 XSS；
 * - `linkify: true`：自动把裸链接转成 `<a>`，方便识别 URL；
 * - `breaks: true`：把单个换行渲染为 `<br>`，符合聊天场景的输入习惯；
 * - `typographer: false`：关闭智能标点替换，避免中文内容被误改；
 * - `highlight`：接入上方的高亮函数，统一处理代码块
 *
 * 实例在模块级别创建，避免每次渲染都重新初始化解析器
 */
const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: false,
  highlight: highlightCode,
})

/**
 * 保存 markdown-it 默认的 `link_open` 规则
 *
 * 自定义规则时不能直接丢弃原规则，否则会丢失链接自身的 href/title 等属性
 * 这里优先取解析器已有规则，取不到时退化为 `renderToken`，保证兼容性
 */
const defaultLinkOpen =
  markdown.renderer.rules.link_open ??
  ((tokens, index, options, _env, self) => self.renderToken(tokens, index, options))

/**
 * 覆盖链接渲染规则，为所有链接追加安全属性：
 * - `target="_blank"`：在新标签页打开，避免聊天页面被外链替换；
 * - `rel="noopener noreferrer"`：阻止新页面通过 `window.opener` 反向操作当前页，
 *   同时不把当前页地址作为 Referer 泄露给目标站点
 *
 * 先改写 token 属性，再交回默认规则完成最终渲染
 */
markdown.renderer.rules.link_open = (tokens, index, options, env, self) => {
  /** 当前正在渲染的链接开始 token */
  const token = tokens[index]
  if (token) {
    token.attrSet('target', '_blank')
    token.attrSet('rel', 'noopener noreferrer')
  }
  return defaultLinkOpen(tokens, index, options, env, self)
}

/**
 * DOMPurify 白名单/黑名单配置
 *
 * markdown-it 已经关闭原生 HTML，这里再做一层“纵深防御”，防止未来
 * 打开 `html: true` 或引入第三方插件后意外输出危险内容：
 * - `ADD_ATTR`：保留上面为链接添加的 target/rel，避免被清洗掉；
 * - `FORBID_TAGS`：移除可执行脚本、表单、嵌入对象等高风险标签；
 * - `FORBID_ATTR`：移除内联样式和事件处理器，阻断样式污染与脚本注入
 */
const PURIFY_CONFIG = {
  ADD_ATTR: ['target', 'rel'],
  FORBID_TAGS: ['style', 'form', 'input', 'iframe', 'object', 'embed'],
  FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick'],
}

/**
 * 将 Markdown 源码渲染为可安全插入 DOM 的 HTML 字符串
 *
 * 适用于整段消息、文档正文等块级内容
 * 流程：Markdown 解析 → HTML 生成 → DOMPurify 清洗
 *
 * @param source Markdown 源码；传入空值时按空字符串处理
 * @returns 已清洗的 HTML，可直接配合 `v-html` 使用
 */
export function renderMarkdown(source: string): string {
  /** Markdown 解析后的原始 HTML */
  const html = markdown.render(source ?? '')
  return DOMPurify.sanitize(html, PURIFY_CONFIG)
}

/**
 * 渲染行内 Markdown，不会包裹 `<p>` 等块级标签
 *
 * 适用于标题、标签、列表项摘要等只允许行内格式的场景，
 * 例如把 `**重点**` 渲染成加粗文本而不破坏外层布局
 *
 * @param source 行内 Markdown 源码
 * @returns 已清洗的行内 HTML
 */
export function renderMarkdownInline(source: string): string {
  /** 行内 Markdown 解析后的原始 HTML */
  const html = markdown.renderInline(source ?? '')
  return DOMPurify.sanitize(html, PURIFY_CONFIG)
}

/**
 * 把 Markdown 转成纯文本，供「复制文本」使用
 *
 * 先渲染成 HTML 再读取 textContent，代码块、表格结构不会破坏，
 * 同时给块级元素补换行，避免段落与列表项被拼成一行
 *
 * @param source Markdown 源码
 * @returns 去掉标记后的纯文本
 */
export function markdownToPlainText(source: string): string {
  /** 临时容器，只用于提取文本，不挂载到页面 */
  const container = document.createElement('div')
  container.innerHTML = renderMarkdown(source ?? '')

  container
    .querySelectorAll('p, li, tr, h1, h2, h3, h4, h5, h6, blockquote, pre, br')
    .forEach((node) => {
      if (node.tagName === 'BR') {
        node.replaceWith('\n')
        return
      }

      node.append('\n')
    })

  /** 提取到的纯文本 */
  const text = container.textContent ?? ''
  return text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * 按字符数安全截断 Markdown，供长回答折叠使用
 *
 * 直接 slice 容易把代码围栏、表格切一半，折叠态会出现整页错乱：
 * - 优先回退到最近的空行，避免在段落中间断开；
 * - 若截断处仍处于未闭合的代码块内，自动补一个 ``` 收尾
 *
 * @param source Markdown 源码
 * @param limit 允许保留的最大字符数
 * @returns 截断后的 Markdown，未超限时原样返回
 */
export function truncateMarkdown(source: string, limit: number): string {
  if (source.length <= limit) {
    return source
  }

  /** 上限内的原始切片 */
  const slice = source.slice(0, limit)
  /** 最近的段落边界位置，找不到时为 -1 */
  const breakIndex = slice.lastIndexOf('\n\n')
  /** 实际保留的文本，段落边界过于靠前时不做回退 */
  const head = breakIndex > limit * 0.6 ? slice.slice(0, breakIndex) : slice
  /** 已出现的代码围栏数量，奇数表示代码块尚未闭合 */
  const fenceCount = (head.match(/^```/gm) ?? []).length
  return fenceCount % 2 === 1 ? `${head}\n` + '```' : head
}
