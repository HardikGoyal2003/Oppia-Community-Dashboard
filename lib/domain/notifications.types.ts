/** Notification transports a message can be delivered through. */
export type NotificationChannelKey = "EMAIL" | "IN_APP";

/** A resolved delivery target. `email` may be null (e.g. private GitHub profile). */
export type NotificationRecipient = {
  uid: string;
  email: string | null;
  fullName: string;
};

/** A rendered message handed to a channel for delivery. */
export type NotificationMessage = {
  subject: string;
  title: string;
  bodyText: string;
  bodyHtml: string;
  /** App-relative path recipients can open from the in-app bell. */
  deepLinkPath: string;
};

/** Outcome of one channel delivery attempt. */
export type NotificationChannelResult = {
  channel: NotificationChannelKey;
  deliveredTo: string[];
  failed: Array<{ uid: string; reason: string }>;
};

/**
 * A notification transport. Adding a new transport (Google Chat, Slack, ...)
 * means implementing this interface and registering it in `channels/index.ts`.
 */
export type NotificationChannel = {
  key: NotificationChannelKey;
  /** Whether the channel is configured and enabled right now. */
  isAvailable(): boolean;
  send(
    recipients: NotificationRecipient[],
    message: NotificationMessage,
  ): Promise<NotificationChannelResult>;
};

/** Delivery lifecycle recorded in the notificationDeliveries collection. */
export type NotificationDeliveryStatus = "SENT" | "SKIPPED" | "FAILED";

/** One audited delivery attempt for a (kind, period, team, channel) tuple. */
export type NotificationDeliveryModel = {
  /** `${kind}__${periodKey}__${teamKey}__${channel}` — doubles as idempotency key. */
  id: string;
  /** Delivery kind, e.g. `daily_action_items_digest`. */
  kind: string;
  channel: NotificationChannelKey;
  teamKey: string;
  /** Stable period bucket, e.g. the IST date key. */
  periodKey: string;
  /** Exact action-item document ids included in this delivery. */
  actionItemIds: string[];
  recipientUids: string[];
  itemCount: number;
  status: NotificationDeliveryStatus;
  error: string | null;
  recordedAt: Date;
};
