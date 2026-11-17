import type {
  ChatKnowledgeEntry,
  ChatKnowledgePayload,
  ChatReply,
  ChatStatus,
  SendChatPayload,
} from '../types/chat'

import { http } from './http'

export const chatService = {
  status: (token: string | null) =>
    http.get<ChatStatus>(token ? '/chat/status' : '/chat/public/status', { token }),

  send: (payload: SendChatPayload, token: string | null) =>
    http.post<ChatReply>(token ? '/chat' : '/chat/public', payload, { token }),

  listKnowledge: (token: string | null) =>
    http.get<ChatKnowledgeEntry[]>('/chat/knowledge', { token }),

  createKnowledge: (payload: ChatKnowledgePayload, token: string | null) =>
    http.post<ChatKnowledgeEntry>('/chat/knowledge', payload, { token }),

  updateKnowledge: (
    entryId: string,
    payload: Partial<ChatKnowledgePayload>,
    token: string | null,
  ) => http.patch<ChatKnowledgeEntry>(`/chat/knowledge/${entryId}`, payload, { token }),

  removeKnowledge: (entryId: string, token: string | null) =>
    http.delete<{ message: string }>(`/chat/knowledge/${entryId}`, { token }),
}
