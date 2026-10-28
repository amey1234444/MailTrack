CREATE TABLE IF NOT EXISTS users (
 id text PRIMARY KEY, google_sub text NOT NULL UNIQUE, email text NOT NULL, name text NOT NULL,
 timezone text NOT NULL DEFAULT 'Asia/Kolkata', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash text PRIMARY KEY, user_id text NOT NULL REFERENCES users ON DELETE CASCADE,
 expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS accounts (
 id text PRIMARY KEY, user_id text NOT NULL REFERENCES users ON DELETE CASCADE,
 google_sub text NOT NULL, email text NOT NULL, access_token text NOT NULL, refresh_token text NOT NULL,
 expires_at timestamptz NOT NULL, status text NOT NULL DEFAULT 'connected',
 history_id text, page_token text, history_page text, sync_complete boolean NOT NULL DEFAULT false,
 synced_at timestamptz, sync_lock_until timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,google_sub)
);
CREATE TABLE IF NOT EXISTS invitations (
 id text PRIMARY KEY, user_id text NOT NULL REFERENCES users ON DELETE CASCADE, email text NOT NULL,
 token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, used_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS messages (
 id text PRIMARY KEY, user_id text NOT NULL REFERENCES users ON DELETE CASCADE,
 account_id text NOT NULL REFERENCES accounts ON DELETE CASCADE,
 request_key text NOT NULL, subject text NOT NULL, body text NOT NULL,
 document_ids jsonb NOT NULL DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,request_key)
);
CREATE TABLE IF NOT EXISTS deliveries (
 id text PRIMARY KEY, message_id text NOT NULL REFERENCES messages ON DELETE CASCADE,
 recipient text NOT NULL, recipient_type text NOT NULL DEFAULT 'to', token text NOT NULL UNIQUE,
 rfc_id text NOT NULL UNIQUE, gmail_id text, thread_id text,
 status text NOT NULL DEFAULT 'pending', claimed_at timestamptz, error text, sent_at timestamptz, replied_at timestamptz,
 UNIQUE(message_id,recipient)
);
CREATE TABLE IF NOT EXISTS links (
 id text PRIMARY KEY, delivery_id text NOT NULL REFERENCES deliveries ON DELETE CASCADE,
 token text NOT NULL UNIQUE, destination text NOT NULL
);
CREATE TABLE IF NOT EXISTS documents (
 id text PRIMARY KEY, user_id text NOT NULL REFERENCES users ON DELETE CASCADE,
 name text NOT NULL, data bytea NOT NULL, pages integer NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS document_shares (
 id text PRIMARY KEY, document_id text NOT NULL REFERENCES documents ON DELETE CASCADE,
 delivery_id text NOT NULL REFERENCES deliveries ON DELETE CASCADE,
 token text NOT NULL UNIQUE, revoked boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS events (
 id text PRIMARY KEY, delivery_id text NOT NULL REFERENCES deliveries ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('open','click','reply','document_view','page_view','download')),
 occurred_at timestamptz NOT NULL DEFAULT now(), automated boolean NOT NULL DEFAULT false,
 detail jsonb NOT NULL DEFAULT '{}', dedupe_key text UNIQUE
);
CREATE INDEX IF NOT EXISTS events_delivery_time ON events(delivery_id,occurred_at DESC);
CREATE TABLE IF NOT EXISTS mailbox_messages (
 account_id text NOT NULL REFERENCES accounts ON DELETE CASCADE, gmail_id text NOT NULL,
 thread_id text NOT NULL, subject text NOT NULL, sender text NOT NULL, recipients text NOT NULL,
 snippet text NOT NULL, labels jsonb NOT NULL DEFAULT '[]', headers jsonb NOT NULL DEFAULT '[]',
 received_at timestamptz NOT NULL, PRIMARY KEY(account_id,gmail_id)
);
CREATE INDEX IF NOT EXISTS mailbox_date ON mailbox_messages(account_id,received_at DESC);
CREATE TABLE IF NOT EXISTS rate_limits (
 key text PRIMARY KEY, hits integer NOT NULL, reset_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS accounts_owner ON accounts(user_id);
CREATE INDEX IF NOT EXISTS messages_owner_date ON messages(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS messages_account ON messages(account_id);
CREATE INDEX IF NOT EXISTS deliveries_message ON deliveries(message_id);
CREATE INDEX IF NOT EXISTS links_delivery ON links(delivery_id);
CREATE INDEX IF NOT EXISTS documents_owner ON documents(user_id);
CREATE INDEX IF NOT EXISTS shares_document ON document_shares(document_id);
CREATE INDEX IF NOT EXISTS shares_delivery ON document_shares(delivery_id);

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'oauth';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS imap_cursor jsonb;
ALTER TABLE mailbox_messages ADD COLUMN IF NOT EXISTS source_folder text;
ALTER TABLE mailbox_messages ADD COLUMN IF NOT EXISTS source_validity text;
ALTER TABLE mailbox_messages ADD COLUMN IF NOT EXISTS source_uid bigint;
CREATE INDEX IF NOT EXISTS mailbox_source ON mailbox_messages(account_id,source_folder);
