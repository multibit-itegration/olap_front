import { TIMEZONE_CHOICES, WEEKDAY_LABELS } from '../../core/api/models/report.models';

export function describeCronSchedule(cron: string, timezone: string, dataPeriodDays: number): string {
  const parts = cron.split(' ');
  if (parts.length < 5) {
    return `Расписание задано, данные за ${dataPeriodDays} дней`;
  }

  const [minute, hour, dayOfMonth, , dayOfWeek] = parts;
  const time = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
  const timezoneLabel = getTimezoneLabel(timezone);
  const dataPeriodLabel = getDataPeriodLabel(dataPeriodDays);

  if (dayOfMonth !== '*' && dayOfMonth !== '?') {
    return `${dayOfMonth} числа каждого месяца в ${time}, ${dataPeriodLabel}, ${timezoneLabel}`;
  }

  if (dayOfWeek !== '*' && dayOfWeek !== '?') {
    const weekday = WEEKDAY_LABELS[Number(dayOfWeek)]?.toLowerCase() ?? `день ${dayOfWeek}`;
    return `Каждый ${weekday} в ${time}, ${dataPeriodLabel}, ${timezoneLabel}`;
  }

  return `Ежедневно в ${time}, ${dataPeriodLabel}, ${timezoneLabel}`;
}

export function formatScheduleNextRun(nextRunAt: string | null, timezone: string): string {
  if (!nextRunAt) {
    return 'Не запланирована';
  }

  const date = new Date(nextRunAt);
  if (Number.isNaN(date.getTime())) {
    return 'Не запланирована';
  }

  try {
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: getTimezoneValue(timezone)
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }
}

export function getTimezoneLabel(timezone: string): string {
  return TIMEZONE_CHOICES.find(option => option.value.toLowerCase() === timezone.toLowerCase())?.label
    ?? timezone;
}

function getTimezoneValue(timezone: string): string {
  return TIMEZONE_CHOICES.find(option => option.value.toLowerCase() === timezone.toLowerCase())?.value
    ?? timezone;
}

function getDataPeriodLabel(days: number): string {
  return `данные за ${days} ${getDayWord(days)}`;
}

function getDayWord(days: number): string {
  const lastTwoDigits = Math.abs(days) % 100;
  const lastDigit = Math.abs(days) % 10;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return 'дней';
  }

  if (lastDigit === 1) {
    return 'день';
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return 'дня';
  }

  return 'дней';
}
