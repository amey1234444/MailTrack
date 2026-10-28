export interface User {
  id: string;
  google_sub: string;
  email: string;
  name: string;
  timezone: string;
}
export interface Account {
  id: string;
  user_id: string;
  google_sub: string;
  email: string;
  access_token: string;
  refresh_token: string;
  expires_at: Date;
  status: string;
  history_id: string | null;
  page_token: string | null;
  history_page: string | null;
  sync_complete: boolean;
  synced_at: Date | null;
}
export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: {
    mimeType?: string;
    headers?: { name: string; value: string }[];
    body?: { data?: string };
    parts?: GmailMessage['payload'][];
  };
}
