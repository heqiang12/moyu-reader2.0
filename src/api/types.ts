// 后端数据模型（前端渲染必需字段，与 reader-backend 实体对齐）

export type ReturnData<T> = {
  isSuccess: boolean
  errorMsg: string
  data: T
}

export type Book = {
  bookUrl: string
  name: string
  author: string
  kind?: string
  coverUrl?: string
  customCoverUrl?: string
  intro?: string
  customIntro?: string
  origin: string
  originName: string
  durChapterIndex: number
  durChapterTitle?: string
  totalChapterNum: number
  latestChapterTitle?: string
  latestChapterTime?: string
  group?: number
  wordCount?: string
  canUpdate?: boolean
  order?: number
  useReplaceRule?: boolean
  sources?: SearchBook[]
}

export type BookChapter = {
  url: string
  title: string
  index: number
  bookUrl: string
  isVolume?: boolean
  baseUrl?: string
  start?: number
  end?: number
}

export type SearchBook = {
  bookUrl: string
  name: string
  author: string
  origin: string
  originName?: string
  coverUrl?: string
  tocUrl?: string
  latestChapterTitle?: string
  intro?: string
  wordCount?: string
  kind?: string
  sources?: SearchBook[]
}

export type SearchBatch = {
  requestId: string
  books: SearchBook[]
}

export type ExploreKind = {
  title: string
  url: string
}

export type BookSource = {
  bookSourceName: string
  bookSourceUrl: string
  bookSourceGroup?: string | null
  bookSourceType?: number
  enabled?: boolean
  enabledExplore?: boolean
  exploreUrl?: string | null
  searchUrl?: string | null
  customOrder?: number
  weight?: number
  lastUpdateTime?: number
  bookSourceComment?: string
}

export type BookGroup = {
  groupId: number
  groupName: string
  order?: number
  show?: boolean
}

/** 阅读位置游标：主窗口与隐蔽窗口共用的统一坐标系 */
export type ReadingCursor = {
  bookUrl: string
  chapterIndex: number
  /** 章内进度 0-1，按正文字符 offset 计算 */
  progress: number
}

/** 统一分段结果：一段正文，start/end 为字符区间 */
export type Segment = {
  start: number
  end: number
  text: string
}
