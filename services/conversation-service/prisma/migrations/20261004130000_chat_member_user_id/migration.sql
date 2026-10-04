-- AICHAT-253: an invite is bound to the first verified user who opens it, then matched on userId only.
-- Existing invites start unbound (null) and are claimed again by a verified owner of the address.

-- AlterTable
ALTER TABLE "ChatMember" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "ChatMember_userId_idx" ON "ChatMember"("userId");
