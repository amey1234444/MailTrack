export interface AccountView {
  id: string;
  email: string;
  status: string;
  synced_at: string | null;
  sync_complete: boolean;
}
export interface DocumentView {
  id: string;
  name: string;
  pages: number;
  bytes: number;
  created_at: string;
}
export interface MessageView {
  id: string;
  subject: string;
  sender: string;
  created_at: string;
  recipients: number;
  sent: number;
  issues: number;
  opens: number;
  clicks: number;
  replies: number;
  last_activity: string | null;
  recent_opens: number;
}
export interface Activity {
  id: string;
  kind: string;
  occurred_at: string;
  automated: boolean;
  recipient: string;
  subject: string;
  message_id: string;
}
export interface DashboardData {
  messages: MessageView[];
  hasMore: boolean;
  stats: { sent: number; opens: number; clicks: number; replies: number; document_views: number };
  activity: Activity[];
  chart: { day: string; opens: number; clicks: number }[];
}
export interface MessageDetail {
  message: { id: string; subject: string; sender: string; body: string };
  deliveries: {
    id: string;
    recipient: string;
    recipient_type: string;
    status: string;
    error: string | null;
    sent_at: string | null;
    replied_at: string | null;
    opens: number;
    clicks: number;
    first_open: string | null;
  }[];
  events: {
    id: string;
    kind: string;
    recipient: string;
    occurred_at: string;
    automated: boolean;
    detail: Record<string, unknown>;
  }[];
  eventLimit: number;
}
export interface MailboxView {
  gmail_id: string;
  subject: string;
  sender: string;
  recipients: string;
  snippet: string;
  labels: string[];
  received_at: string;
}
