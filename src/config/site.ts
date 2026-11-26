/**
 * 站点级元信息
 *
 * 备案号属于「上线合规」配置，不属于业务逻辑，因此单独放一处集中管理：
 * 换主体、加公安备案、临时下线展示，都只改这个文件，不动组件
 */

/** ICP 备案号，由阿里云备案控制台下发，格式形如 沪ICP备2026000000号-1 */
export const ICP_LICENSE_NO = '黑ICP备2026015521号'

/** 工信部备案查询地址，法规要求页脚备案号必须链接到这里 */
export const ICP_LICENSE_URL = 'https://beian.miit.gov.cn/'

/** 公安联网备案号，完成公安备案后填入；留空表示不展示这一段 */
export const POLICE_LICENSE_NO = ''

/** 公安备案查询地址，仅在填了 POLICE_LICENSE_NO 时使用 */
export const POLICE_LICENSE_URL = 'https://beian.mps.gov.cn/#/query/webSearch'
