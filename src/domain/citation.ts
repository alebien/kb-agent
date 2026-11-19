/** 回答引用的知识来源 */
export interface Citation {
  /** 引用唯一标识 */
  id: string
  /** 来源文档 id，可跳转到文档详情 */
  documentId?: string
  /** 来源文档所属知识库 id，对应 KnowledgeBase.id，便于按库统计引用分布 */
  knowledgeBaseId?: string
  /** 来源文档名称 */
  name: string
  /** 来源补充说明；没有时不传 */
  description?: string
  /** 命中的原文片段，卡片只显示前几十字 */
  snippet?: string
  /**
   * 该文本块的完整原文，供来源详情抽屉展示
   * 后端去掉了 Markdown 标记但保留分段；老数据与 mock 缺失时抽屉回退到 snippet
   */
  content?: string
  /** 片段在文档中的页码，未知时不传 */
  page?: number
  /** 检索相似度分数，取值 0-1 */
  score?: number
  /** 来源是否已下线，下线时卡片置灰且不可点击 */
  unavailable?: boolean
  /**
   * 检索命中的贴题程度，0 至 1，按 IDF 加权，仅用于展示分档
   * 与 score 的分工：score 是相对最高分的排序值，confidence 是这块内容本身有多贴题
   * 老数据与 mock 场景可能缺失，缺失时卡片不显示相关度角标
   */
  confidence?: number
}

/** 引用相关度的展示档位 */
export interface CitationConfidenceLevel {
  /** 档位标识，用于拼接样式类名 */
  key: 'high' | 'medium' | 'low'
  /** 档位文案，直接上屏，不展示原始小数 */
  text: string
}

/**
 * 把 0 至 1 的相关度换算成三档文案
 *
 * 阈值与后端 confidence 的量纲绑定：多词查询上限 0.95，单词查询封顶 0.7，
 * 所以 0.8 以上只会出现在多词命中，0.6 以下属于明显偏弱
 *
 * @param confidence 后端给出的相关度，缺失时为 undefined
 * @returns 档位对象；缺失或非有限数时返回 null，调用方据此整段隐藏
 */
export function citationConfidenceLevel(confidence?: number): CitationConfidenceLevel | null {
  if (typeof confidence !== 'number' || !Number.isFinite(confidence)) {
    return null
  }

  if (confidence >= 0.8) {
    return { key: 'high', text: '相关度高' }
  }

  if (confidence >= 0.6) {
    return { key: 'medium', text: '相关度中' }
  }

  return { key: 'low', text: '相关度低' }
}
