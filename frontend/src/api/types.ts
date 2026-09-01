export type ClaudeAccount = {
  id: string;
  label: string;
  ok: boolean;
  error: string | null;
  session_percent: number | null;
  session_resets_at: string | null;
  weekly_percent: number | null;
  weekly_resets_at: string | null;
  sonnet_percent: number | null;
  sonnet_resets_at: string | null;
  opus_percent: number | null;
  opus_resets_at: string | null;
};

export type GptAccount = {
  id: string;
  label: string;
  ok: boolean;
  error: string | null;
  session_percent: number | null;
  session_resets_at: string | null;
  weekly_percent: number | null;
  weekly_resets_at: string | null;
  plan: string | null;
};

export type CursorAccount = {
  id: string;
  label: string;
  ok: boolean;
  error: string | null;
  percent: number | null;
  other_percent: number | null;
  used_cents: number | null;
  limit_cents: number | null;
  remaining_cents: number | null;
  bonus_cents: number | null;
  cycle_end: string | null;
  plan: string | null;
  requests_used: number | null;
  requests_limit: number | null;
};

export type CreditsAccount = {
  id: string;
  label: string;
  ok: boolean;
  error: string | null;
  percent: number | null;
  limit_cents: number | null;
  used_cents: number | null;
  remaining_cents: number | null;
};

export type OpenCodeAccount = {
  id: string;
  label: string;
  ok: boolean;
  error: string | null;
  rolling_percent: number | null;
  rolling_resets_at: string | null;
  weekly_percent: number | null;
  weekly_resets_at: string | null;
  monthly_percent: number | null;
  monthly_resets_at: string | null;
  percent: number | null;
  limit_cents: number | null;
  used_cents: number | null;
  remaining_cents: number | null;
};

export type UsagePayload = {
  updated_at: string;
  claude: ClaudeAccount[];
  gpt: GptAccount[];
  cursor: CursorAccount[];
  openrouter: CreditsAccount[];
  deepseek: CreditsAccount[];
  opencode: OpenCodeAccount[];
  fal: CreditsAccount[];
};

export type AccountPublic = { id: string; label: string; suffix: string | null };

export type ProviderCardPublic = {
  source: string;
  label: string;
  configured: boolean;
  suffix: string | null;
  mode: string;
  hidden: boolean;
  local_label: string;
  primary_label: string;
  accounts: AccountPublic[];
};

export type DevicePublic = {
  ip: string | null;
  last_seen_s: number | null;
};

export type ConfigPublic = {
  ok: boolean;
  in_docker: boolean;
  mock: boolean;
  listen: { host: string; port: number };
  urls: {
    panel: string[];
    usage: string[];
    usage_lan: string;
    usage_local: string;
    secrets_h: string;
    secrets_h_file: string;
    board_ok: boolean;
  };
  lan_ips: string[];
  restart_needed_for_port: boolean;
  providers: Record<string, ProviderCardPublic>;
  device: DevicePublic;
};
