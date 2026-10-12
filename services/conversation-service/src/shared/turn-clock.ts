/**
 * A clock whose every reading is later than the one before (AICHAT-191). Two messages that
 * take their place in a conversation in the same millisecond still get distinct, ordered
 * times. Per process: with one conversation-service instance (the deployed setup) that is
 * enough; more instances would need the order from the database instead.
 */
export function createTurnClock(wallClock: () => number = Date.now): () => Date {
  let last = Number.NEGATIVE_INFINITY;
  return () => {
    last = Math.max(wallClock(), last + 1);
    return new Date(last);
  };
}

/** The clock the app uses to stamp `Message.sentAt`. */
export const turnClock = createTurnClock();
