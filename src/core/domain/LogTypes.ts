export interface LogEntry {
  t: string;
  m: string;
}

export interface TerminalSize {
  cols: number;
  row: number;
}

export interface LogsRawResponse {
  size: TerminalSize;
  entries: LogEntry[];
}

export interface LogsWsMessage {
  size?: TerminalSize;
  entries: LogEntry[];
}

export interface LogSubscribeRequest {
  enabled: boolean;
  clientId: string;
}