export interface Report {
  id: number;
  iiko_connection_id: number;
  user_id: number;
  iiko_report_id: string | null;
  delivery_type: DeliveryType | null;
  address: string | null;
  format: string | null;
  iiko_report_structure: string | null;
  report_type: ReportType;
  name: string;
  schedule_type: ScheduleType;
  created_at: string;
}

export interface IikoReport {
  id: string;
  name: string;
  reportType: string;
}

export interface CreateReportsRequest {
  iiko_reports_ids: string[];
  format: string;
}

export type ReportType = 'SALES' | 'STOCK' | 'TRANSACTIONS' | 'DELIVERIES';

export type ScheduleType = 'trigger' | 'individual' | 'global' | null;
export type DeliveryType = 'telegram' | 'email' | 'vk';

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  SALES: 'OLAP по продажам',
  STOCK: 'Контроль и хранение',
  TRANSACTIONS: 'OLAP по проводкам',
  DELIVERIES: 'OLAP по доставке'
};

export const REPORT_TYPE_ORDER: ReportType[] = ['SALES', 'STOCK', 'TRANSACTIONS', 'DELIVERIES'];

export const SCHEDULE_TYPE_LABELS: Record<string, string> = {
  trigger: 'тригер',
  individual: 'индивид',
  global: 'общая'
};

export interface GlobalSchedule {
  id: number;
  user_id: number;
  iiko_connection_id: number;
  global_cron: string;
  timezone: string;
  data_period_days: number;
  next_run_at: string;
}

export interface CreateGlobalScheduleRequest {
  global_cron: string;
  timezone: string;
  data_period_days: number;
}

export interface UpdateGlobalScheduleRequest {
  global_cron?: string | null;
  timezone?: string | null;
  data_period_days: number;
}

export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly';

export const SCHEDULE_FREQUENCY_LABELS: Record<ScheduleFrequency, string> = {
  daily: 'Ежедневно',
  weekly: 'Еженедельно',
  monthly: 'Ежемесячно'
};

export interface TimezoneOption {
  value: string;
  label: string;
}

export const TIMEZONE_CHOICES: TimezoneOption[] = [
  { value: 'Europe/Kaliningrad', label: 'Калининград (UTC+2)' },
  { value: 'Europe/Moscow', label: 'Москва (UTC+3)' },
  { value: 'Europe/Samara', label: 'Самара (UTC+4)' },
  { value: 'Asia/Yekaterinburg', label: 'Екатеринбург (UTC+5)' },
  { value: 'Asia/Omsk', label: 'Омск (UTC+6)' },
  { value: 'Asia/Krasnoyarsk', label: 'Красноярск (UTC+7)' },
  { value: 'Asia/Irkutsk', label: 'Иркутск (UTC+8)' },
  { value: 'Asia/Yakutsk', label: 'Якутск (UTC+9)' },
  { value: 'Asia/Vladivostok', label: 'Владивосток (UTC+10)' },
  { value: 'Asia/Magadan', label: 'Магадан (UTC+11)' },
  { value: 'Asia/Kamchatka', label: 'Камчатка (UTC+12)' }
];

export const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Понедельник',
  2: 'Вторник',
  3: 'Среда',
  4: 'Четверг',
  5: 'Пятница',
  6: 'Суббота',
  0: 'Воскресенье'
};

export interface UpdateReportRequest {
  delivery_type?: DeliveryType | null;
  format?: string | null;
  schedule_type?: ScheduleType;
}

export interface IndividualSchedule {
  id: number;
  report_id: number;
  individual_cron: string;
  timezone: string;
  data_period_days: number;
  next_run_at: string;
}

export interface CreateIndividualScheduleRequest {
  individual_cron: string;
  timezone: string;
  data_period_days: number;
}

export interface UpdateIndividualScheduleRequest {
  individual_cron?: string | null;
  timezone?: string | null;
  data_period_days?: number;
}

export interface GroupSchedule {
  id: number;
  linked_chat_id: number;
  report_id: number;
  chat_title: string;
  group_cron: string;
  timezone: string;
  next_run_at: string;
  data_period_days: number;
  is_active: boolean;
}

export interface CreateGroupScheduleRequest {
  group_cron: string;
  timezone: string;
  data_period_days: number;
}

export interface UpdateGroupScheduleRequest {
  group_cron?: string | null;
  timezone?: string | null;
  data_period_days?: number | null;
  is_active?: boolean | null;
}
