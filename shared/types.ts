export type TicketStatus =
  | 'open'
  | 'triage_required'
  | 'in_progress'
  | 'closed';

export type TicketPriority =
  | 'normal'
  | 'high';

export type Ticket = {
  id: string;
  owner_sub: string;
  title: string;
  body: string;
  status: TicketStatus;
  priority: TicketPriority;
  attachment_key: string | null;
  created_at: string;
  updated_at: string;
};

export type NotificationLog = {
  id: string;
  ticket_id: string;
  type: string;
  status: string;
  created_at: string;
};

export type WorkflowLog = {
  id: string;
  ticket_id: string;
  execution_arn: string | null;
  status: string;
  created_at: string;
};
