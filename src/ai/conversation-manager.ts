import { prisma } from '../config/prisma';
import { ExtractedEntities } from './intents';

export interface SessionState extends Partial<ExtractedEntities> {
  lastSearchId?: string | null;
  selectedFlightId?: string | null;
  pendingIntent?: string | null; // intent we're mid-way through collecting fields for
}

export const conversationManager = {
  async getOrCreateSession(sessionId: string, userId?: string) {
    let session = await prisma.chatSession.findUnique({ where: { sessionId } });
    if (!session) {
      session = await prisma.chatSession.create({
        data: { sessionId, userId: userId ?? null, state: {} },
      });
    } else if (userId && !session.userId) {
      session = await prisma.chatSession.update({ where: { id: session.id }, data: { userId } });
    }
    return session;
  },

  getState(session: { state: any }): SessionState {
    return (session.state as SessionState) || {};
  },

  async updateState(sessionDbId: string, patch: Partial<SessionState>) {
    const session = await prisma.chatSession.findUnique({ where: { id: sessionDbId } });
    const current = (session?.state as SessionState) || {};
    const next = { ...current, ...patch };
    await prisma.chatSession.update({ where: { id: sessionDbId }, data: { state: next as any } });
    return next;
  },

  async clearState(sessionDbId: string, keys: (keyof SessionState)[]) {
    const session = await prisma.chatSession.findUnique({ where: { id: sessionDbId } });
    const current = (session?.state as SessionState) || {};
    for (const k of keys) delete current[k];
    await prisma.chatSession.update({ where: { id: sessionDbId }, data: { state: current as any } });
    return current;
  },

  async recordMessage(sessionDbId: string, role: 'USER' | 'ASSISTANT', message: string, intent?: string, metadata?: any) {
    await prisma.chatMessage.create({
      data: { sessionId: sessionDbId, role, message, intent, metadata },
    });
  },

  async getRecentMessages(sessionDbId: string, limit = 10) {
    const messages = await prisma.chatMessage.findMany({
      where: { sessionId: sessionDbId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return messages
      .reverse()
      .map((m) => ({ role: m.role === 'USER' ? 'user' : 'assistant', content: m.message }));
  },
};
