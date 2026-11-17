export type ChatWindow = 'day' | 'hour'

export interface ChatBudget {
  monthlyUsd: number
  dailyUsd: number
  spentMonthUsd: number
  spentTodayUsd: number
}

export interface ChatStatus {
  available: boolean
  limit: number
  window: ChatWindow
  whatsappUrl: string | null
  budget?: ChatBudget
}

export interface ChatReply {
  conversationId: string
  response: string
  escalate: boolean
  whatsappUrl: string | null
  limit: number
  remaining: number
}

export interface SendChatPayload {
  message: string
  conversationId?: string
}

export interface ChatKnowledgeEntry {
  id: string
  title: string
  content: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface ChatKnowledgePayload {
  title: string
  content: string
  active?: boolean
}
