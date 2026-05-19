import { Injectable, computed, signal } from '@angular/core';

export type OnboardingStepId =
  | 'welcome'
  | 'add_database'
  | 'database_form'
  | 'go_to_reports'
  | 'add_report'
  | 'setup_schedule'
  | 'configure_report'
  | 'report_settings_overview'
  | 'update_report_structure'
  | 'go_to_profile'
  | 'restart_onboarding'
  | 'set_password';

export interface OnboardingStep {
  id: OnboardingStepId;
  eyebrow: string;
  title: string;
  description: string;
  actionLabel: string;
  targetLabel?: string;
  targetClass?: string;
}

export interface OnboardingTargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface OnboardingGuidePosition {
  top: number;
  width: number;
}

const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    id: 'welcome',
    eyebrow: 'Быстрый старт',
    title: 'Добро пожаловать в Олап Экспресс!',
    description:
      'Проведём вас по основным шагам: поможем добавить первую базу, отчёт и подготовить продукт к работе.',
    actionLabel: 'Вперёд!'
  },
  {
    id: 'add_database',
    eyebrow: 'Шаг 1',
    title: 'Добавьте первую базу',
    description: 'Нажмите на подсвеченную кнопку, чтобы открыть форму подключения.',
    actionLabel: 'Понятно',
    targetLabel: 'Добавить базу',
    targetClass: 'onboarding-add-database-target'
  },
  {
    id: 'database_form',
    eyebrow: 'Шаг 2',
    title: 'Заполните данные базы',
    description:
      'Данные для подключения можно получить в iikoOffice/iikoChain или уточнить у вашей технической поддержки.',
    actionLabel: 'Заполнить'
  },
  {
    id: 'go_to_reports',
    eyebrow: 'Шаг 3',
    title: 'Перейдите в отчёты',
    description: 'Откройте раздел отчётов для созданной базы, чтобы выбрать нужные отчёты.',
    actionLabel: 'Открыть',
    targetLabel: 'Отчёты',
    targetClass: 'onboarding-target-clone-reports'
  },
  {
    id: 'add_report',
    eyebrow: 'Шаг 4',
    title: 'Добавьте отчёты',
    description: 'Нажмите на подсвеченную кнопку, чтобы выбрать отчёты из списка доступных.',
    actionLabel: 'Добавить',
    targetLabel: 'Добавить отчёты',
    targetClass: 'onboarding-target-clone-add-report'
  },
  {
    id: 'setup_schedule',
    eyebrow: 'Шаг 5',
    title: 'Настройте общее расписание',
    description: 'Настройте расписание рассылки отчётов для этой базы.',
    actionLabel: 'Настроить',
    targetLabel: 'Настроить общее расписание отчётов',
    targetClass: 'onboarding-target-clone-schedule'
  },
  {
    id: 'configure_report',
    eyebrow: 'Шаг 6',
    title: 'Перейдите в настройки отчёта',
    description: 'Откройте настройки отчёта, чтобы проверить формат, канал и параметры рассылки.',
    actionLabel: 'Настроить',
    targetLabel: 'Настроить',
    targetClass: 'onboarding-target-clone-configure-report'
  },
  {
    id: 'report_settings_overview',
    eyebrow: 'Шаг 7',
    title: 'Проверьте основные настройки',
    description:
      'Формат — нужный файл отчёта. Рассылка — куда его получать. Тип рассылки — отключить отправку, использовать расписание базы или задать индивидуальное.',
    actionLabel: 'Далее',
    targetLabel: '',
    targetClass: 'onboarding-target-clone-settings-block'
  },
  {
    id: 'update_report_structure',
    eyebrow: 'Шаг 8',
    title: 'Обновите структуру отчёта',
    description:
      'Если структура отчёта изменилась в iiko, её можно экстренно обновить в приложении. Без ручного обновления она подтянется автоматически через 15-20 минут.',
    actionLabel: 'Обновить',
    targetLabel: 'Обновить структуру',
    targetClass: 'onboarding-target-clone-update-structure'
  },
  {
    id: 'go_to_profile',
    eyebrow: 'Шаг 9',
    title: 'Перейдите в профиль',
    description: 'Откройте профиль клиента, чтобы посмотреть личные настройки и дополнительные возможности.',
    actionLabel: 'Профиль',
    targetLabel: 'Профиль',
    targetClass: 'onboarding-target-clone-profile'
  },
  {
    id: 'restart_onboarding',
    eyebrow: 'Шаг 10',
    title: 'Обучение можно пройти повторно',
    description: 'Эта кнопка запускает обучение заново, если нужно вернуться к подсказкам позже.',
    actionLabel: 'Далее',
    targetLabel: 'Пройти обучение',
    targetClass: 'onboarding-target-clone-onboarding-start'
  },
  {
    id: 'set_password',
    eyebrow: 'Шаг 11',
    title: 'Задайте пароль для входа',
    description:
      'Если вы зарегистрировались через Telegram или VK, здесь можно задать пароль. С ним и номером телефона можно входить на https://olapsender.ru/.',
    actionLabel: 'Завершить',
    targetLabel: '',
    targetClass: 'onboarding-target-clone-password-field'
  }
];

@Injectable({
  providedIn: 'root'
})
export class OnboardingService {
  private readonly currentStepIndex = signal(0);
  private readonly isOpen = signal(false);
  private readonly currentTargetRect = signal<OnboardingTargetRect | null>(null);
  private readonly currentSecondaryTargetRect = signal<OnboardingTargetRect | null>(null);
  private readonly currentGuidePosition = signal<OnboardingGuidePosition | null>(null);
  private readonly currentTargetNavigationUrl = signal<string | null>(null);
  private readonly targetActivationVersion = signal(0);
  private readonly targetActivationStepId = signal<OnboardingStepId | null>(null);
  private readonly postWelcomeStepId = signal<OnboardingStepId>('add_database');
  private readonly isCompletionOpen = signal(false);

  readonly active = this.isOpen.asReadonly();
  readonly completionActive = this.isCompletionOpen.asReadonly();
  readonly targetRect = this.currentTargetRect.asReadonly();
  readonly secondaryTargetRect = this.currentSecondaryTargetRect.asReadonly();
  readonly guidePosition = this.currentGuidePosition.asReadonly();
  readonly targetNavigationUrl = this.currentTargetNavigationUrl.asReadonly();
  readonly targetActivation = this.targetActivationVersion.asReadonly();
  readonly targetActivationStep = this.targetActivationStepId.asReadonly();
  readonly step = computed(() => ONBOARDING_STEPS[this.currentStepIndex()]);
  readonly targetLabel = computed(() => this.step().targetLabel ?? this.step().actionLabel);
  readonly isFirstStep = computed(() => this.currentStepIndex() === 0);
  readonly isLastStep = computed(() => this.currentStepIndex() === ONBOARDING_STEPS.length - 1);

  start(): void {
    this.currentStepIndex.set(0);
    this.clearTargets();
    this.isCompletionOpen.set(false);
    this.isOpen.set(true);
  }

  openAtStep(stepId: Exclude<OnboardingStepId, 'welcome'>): void {
    const stepIndex = ONBOARDING_STEPS.findIndex(step => step.id === stepId);
    if (stepIndex === -1) {
      return;
    }

    this.clearTargets();
    this.currentStepIndex.set(stepIndex);
    this.isCompletionOpen.set(false);
    this.isOpen.set(true);
  }

  close(): void {
    this.clearTargets();
    this.isOpen.set(false);
    this.isCompletionOpen.set(false);
  }

  showCompletion(): void {
    this.clearTargets();
    this.isOpen.set(false);
    this.isCompletionOpen.set(true);
  }

  closeCompletion(): void {
    this.isCompletionOpen.set(false);
  }

  next(): void {
    if (this.isLastStep()) {
      this.close();
      return;
    }

    this.clearTargets();
    this.currentStepIndex.update(stepIndex => stepIndex + 1);
  }

  back(): void {
    if (this.isFirstStep()) {
      return;
    }

    this.clearTargets();
    this.currentStepIndex.update(stepIndex => stepIndex - 1);
  }

  continueFromWelcome(): void {
    if (this.step().id !== 'welcome') {
      this.next();
      return;
    }

    this.goToStep(this.postWelcomeStepId());
  }

  goToStep(stepId: OnboardingStepId): void {
    const stepIndex = ONBOARDING_STEPS.findIndex(step => step.id === stepId);
    if (stepIndex === -1) {
      return;
    }

    this.clearTargets();
    this.currentStepIndex.set(stepIndex);
  }

  setPostWelcomeStep(stepId: Exclude<OnboardingStepId, 'welcome'>): void {
    this.postWelcomeStepId.set(stepId);
  }

  setTargetRect(rect: OnboardingTargetRect | null): void {
    this.currentTargetRect.set(rect);
  }

  setSecondaryTargetRect(rect: OnboardingTargetRect | null): void {
    this.currentSecondaryTargetRect.set(rect);
  }

  setGuidePosition(position: OnboardingGuidePosition | null): void {
    this.currentGuidePosition.set(position);
  }

  setTargetNavigationUrl(url: string | null): void {
    this.currentTargetNavigationUrl.set(url);
  }

  activateTarget(): void {
    this.targetActivationStepId.set(this.step().id);
    this.targetActivationVersion.update(version => version + 1);
  }

  private clearTargets(): void {
    this.currentTargetRect.set(null);
    this.currentSecondaryTargetRect.set(null);
    this.currentGuidePosition.set(null);
    this.currentTargetNavigationUrl.set(null);
  }
}
