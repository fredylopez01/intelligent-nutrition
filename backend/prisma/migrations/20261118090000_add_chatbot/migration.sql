-- CreateEnum
CREATE TYPE "ChatChannel" AS ENUM ('PUBLIC', 'INTERNAL');

-- CreateEnum
CREATE TYPE "ChatRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "chat_conversation" (
    "id" UUID NOT NULL,
    "channel" "ChatChannel" NOT NULL,
    "user_id" UUID,
    "client_key" VARCHAR(64) NOT NULL,
    "escalated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "chat_conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_message" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "role" "ChatRole" NOT NULL,
    "content" TEXT NOT NULL,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "cost_usd" DECIMAL(10,6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_knowledge_entry" (
    "id" UUID NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "content" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "chat_knowledge_entry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_conversation_user_id_idx" ON "chat_conversation"("user_id");

-- CreateIndex
CREATE INDEX "chat_conversation_channel_client_key_idx" ON "chat_conversation"("channel", "client_key");

-- CreateIndex
CREATE INDEX "chat_message_conversation_id_created_at_idx" ON "chat_message"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "chat_message_role_created_at_idx" ON "chat_message"("role", "created_at");

-- AddForeignKey
ALTER TABLE "chat_conversation" ADD CONSTRAINT "chat_conversation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_account"("person_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

