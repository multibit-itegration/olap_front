export interface License {
  id: number;
  user_id: number;
  rms_id: string | null;
  contract_num: string | null;
  expiration_date: string;
  comment: string | null;
  plan: string;
}
