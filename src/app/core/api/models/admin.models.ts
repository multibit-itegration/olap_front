export type { License } from './license.models';

export interface IikoConnection {
  id: number;
  host: string;
  path: string;
  port: number;
  username_iiko: string;
  password_iiko: string;
  name: string;
}

export type MetricValue = string | number | null;

export interface ComparisonDetails {
  roubles?: MetricValue;
  percents?: MetricValue;
  count_diff?: MetricValue;
}

export interface ComparisonPeriods {
  to_previous_weekday?: ComparisonDetails;
  to_last_four_weekdays?: ComparisonDetails;
}

export interface BasicMetric {
  value?: MetricValue;
  comparison?: ComparisonPeriods;
}

export interface DiscountsMetric extends BasicMetric {
  percent_of_income?: MetricValue;
}

export interface MainMetrics {
  income?: BasicMetric;
  selfprice?: MetricValue;
  food_cost?: BasicMetric;
  avg_bill?: BasicMetric;
  orders_count?: BasicMetric;
  discounts?: DiscountsMetric;
}

export interface UserUpdateRequest {
  name?: string | null;
  phone?: string | null;
  password?: string | null;
  email?: string | null;
}

export interface UserUpdateResponse {
  id: number;
  name: string;
  phone: string;
  email: string | null;
}

export interface LicenseUpdateRequest {
  rms_id?: string | null;
  contract_num?: string | null;
  expiration_date?: string | null;
  comment?: string | null;
  plan?: string | null;
}

export interface IikoConnectionCreateRequest {
  host: string;
  path: string;
  port: number;
  username_iiko: string;
  password_iiko: string;
  name: string;
}

export interface IikoConnectionUpdateRequest {
  host?: string;
  path?: string;
  port?: number;
  username_iiko?: string;
  password_iiko?: string;
  name?: string;
}
