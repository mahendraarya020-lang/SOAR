interface ParsedLog {
  ip_address: string;
  timestamp: string;
  method: string;
  path: string;
  status_code: number;
}

export const parseNginxLog = (rawLog: string): ParsedLog | null => {
  // Contoh format log Nginx Standar:
  // 192.168.1.50 - - [19/May/2026:18:15:00 +0700] "POST /api/v1/auth/login HTTP/1.1" 401 23
  const nginxRegex = /^(\S+) \S+ \S+ \[(.*?)\] "(\S+) (\S+) \S+" (\d{3}) \d+/;
  
  const match = rawLog.match(nginxRegex);
  
  if (!match) return null;

  return {
    ip_address: match[1],
    timestamp: match[2],
    method: match[3],
    path: match[4],
    status_code: parseInt(match[5], 10)
  };
};
