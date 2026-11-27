// Player-visible JSON contract from Fastify checkpoint 329a173.
import type { BoardLayoutId, BoardRevision, BondIssuerId, CourseId, CreditStatus, CustomerPreferenceId, DepositLot, FundingSource, GameplayProfile, Holding, LapSummary, LivingExpenseRulesVersion, Option, PendingPayment, Phase, Portfolio, RebalanceAction, SummaryLine, Term } from '../../../src/game/types.ts';
import type { LearningContext } from '../../../src/ai/mascot/learning.ts';
type FundingOption = { source: FundingSource; lotId?: string; minAmount: number; maxAmount: number }

export type ServerState = {
  boardLayout: BoardLayoutId;
  fox: {
    learningContext: LearningContext | null;
    version: number;
    source: 'deterministic';
    cards: {
      id: string;
      title: string;
      text: string;
    }[];
    evidence: {
      position: {
        source: 'engine-state-and-selectors';
        lap: number;
        phase: Phase;
        portfolio: Portfolio;
        deposits: DepositLot[];
        obligationsVnd: number;
        liquidatableFundsVnd: number;
        totalWorthVnd: number;
        borrowingAvailableVnd: number;
        pendingPayment: PendingPayment | null;
        fundingOptions: FundingOption[];
      };
      decision: {
        source: 'engine-journal';
        sequence: number;
        lap: number;
        turn: number;
        kind: 'roll' | 'settlement' | 'funding' | 'rebalancing' | 'setup' | 'encounter' | 'decision' | 'event_resolution' | 'market' | 'schedule' | 'insolvency';
        title: string;
        decision: string;
        consequence: string;
        action: RebalanceAction | undefined;
        eventId: string | undefined;
        decisionId: string | undefined;
        before: {
          portfolio: Portfolio;
          obligations: number;
          shortfallVnd: number;
        };
        after: {
          portfolio: Portfolio;
          obligations: number;
          shortfallVnd: number;
        };
        effects: {
          cashDelta: number;
          savingsDelta: number;
          stockDelta: number;
          bondDelta: number;
          goldDelta: number;
          businessDelta: number;
          debtDelta: number;
          expensePaid: number;
          lostSavingsInterest: number;
          obligationCreated: number;
        };
      } | null;
      event: {
        source: 'engine-event';
        id: string;
        title: string;
        description: string;
      } | null;
      market: {
        goldPriceVnd: {
          before: number;
          after: number;
        };
        source: 'engine-journal';
        sequence: number;
        lap: number;
        turn: number;
        kind: 'roll' | 'settlement' | 'funding' | 'rebalancing' | 'setup' | 'encounter' | 'decision' | 'event_resolution' | 'market' | 'schedule' | 'insolvency';
        title: string;
        decision: string;
        consequence: string;
        action: RebalanceAction | undefined;
        eventId: string | undefined;
        decisionId: string | undefined;
        before: {
          portfolio: Portfolio;
          obligations: number;
          shortfallVnd: number;
        };
        after: {
          portfolio: Portfolio;
          obligations: number;
          shortfallVnd: number;
        };
        effects: {
          cashDelta: number;
          savingsDelta: number;
          stockDelta: number;
          bondDelta: number;
          goldDelta: number;
          businessDelta: number;
          debtDelta: number;
          expensePaid: number;
          lostSavingsInterest: number;
          obligationCreated: number;
        };
      } | null;
      goldPrice: {
        source: 'engine-market';
        lap: number;
        beforeVnd: number;
        afterVnd: number;
      } | null;
      start: {
        source: 'engine-settlement';
        lap: number;
        lines: SummaryLine[];
        incomeTotalVnd: number;
        debtPrincipalPaidVnd: number;
      } | null;
      result: {
        targetVnd: number;
        totalWorthVnd: number;
        completedLaps: number[];
        outcome: 'insolvent' | 'victory' | 'defeat';
        lawfulProceedsVnd: string;
        source: 'official-result-and-selectors';
      } | null;
    };
  };
  boardRevision: BoardRevision | undefined;
  livingExpenseRulesVersion: LivingExpenseRulesVersion | undefined;
  event: {
    title: string;
    description: string;
  } | null;
  journal: {
    sequence: number;
    lap: number;
    kind: 'roll' | 'settlement' | 'funding' | 'rebalancing' | 'setup' | 'encounter' | 'decision' | 'event_resolution' | 'market' | 'schedule' | 'insolvency';
    title: string;
    decision: string;
    consequence: string;
    action: RebalanceAction | undefined;
    decisionId: string | undefined;
    eventId: string | undefined;
    debtDelta: number;
    savingsDelta: number;
    expensePaid: number;
    cashDelta: number;
    before: {
      portfolio: Portfolio;
      obligations: number;
      pendingCost: number;
      deposits: DepositLot[];
    };
    after: {
      portfolio: Portfolio;
      obligations: number;
      pendingCost: number;
      deposits: DepositLot[];
    };
  }[];
  gameplayProfile: GameplayProfile | undefined;
  goalRulesVersion: 'single-90m-v1' | undefined;
  phase: Phase;
  lap: number;
  totalLaps: number;
  turn: number;
  position: number;
  dice: number;
  scenarioId: string;
  eventId: string | null;
  pendingLanding: boolean;
  portfolio: Portfolio;
  recurringIncome: number;
  obligations: number;
  ownedCourses: CourseId[] | undefined;
  summaries: LapSummary[];
  pendingPayment: PendingPayment | null;
  termination: 'completed' | 'insolvent' | null;
  availableActions: ('advance' | 'roll' | 'choose' | 'fund' | 'trade')[];
  options: Option[];
  fundingOptions: FundingOption[];
  tradingAsset: 'bonds' | 'stocks' | 'gold' | null;
  bank: {
    canDeposit: boolean;
    canRepay: boolean;
    savingsRates: Record<Term, number>;
    deposits: DepositLot[];
    borrowingLimit: number;
    borrowingAvailable: number;
    netWorth: number;
    totalWorth: number;
    liquidatableFunds: number;
  };
  business: {
    owned: boolean;
    capital: number;
    currentSaleValue: number;
    currentStartIncome: number;
    upgrades: Record<string, number>;
    levels: number;
    maxUpgrades: number;
    purchaseCost: number;
    initialSaleValue: number;
    upgradeCost: number;
    currentCustomerPreference: {
      id: CustomerPreferenceId;
      label: string;
      example: string;
    };
    specializations: {
      currentStartIncomeIncrease: number;
      id: CustomerPreferenceId;
      label: string;
      example: string;
    }[];
    actions: ({
      kind: 'buy';
      asset: 'business';
      amount: number;
    } | {
      kind: 'sell';
      asset: 'business';
      amount: number;
    } | {
      kind: 'upgrade';
      asset: 'business';
      amount: number;
      customerPreferenceId?: 'checkin' | 'budget' | 'taste';
    })[];
  };
  start: {
    lap: number;
    settlementStatus: string;
    summary: LapSummary | null;
    finalCheckpoint: boolean;
    canFinishRebalancing: boolean;
    canRepay: boolean;
    sales: {
      maxAmount: number;
      lotId?: string;
      symbolId?: string;
      asset: 'bonds' | 'stocks' | 'gold';
    }[];
  };
  holdings: {
    stocks: Record<string, Holding>;
    gold: {
      units: number;
      costBasis: number;
    };
    bonds: {
      id: string;
      units: number;
      principal: number;
      status: 'active' | 'matured' | 'sold';
      issuerId: BondIssuerId | undefined;
      costBasis: number | undefined;
    }[];
  };
  market: {
    stocks: {
      id: string;
      currentPrice: number;
    }[];
    gold: {
      currentPrice: number;
    };
    bonds: {
      id: BondIssuerId;
      currentPrice: number;
      rating: string;
      status: CreditStatus;
    }[];
    appliedShocks: string[];
    normalLaps: number[];
  };
};
export type OfficialResult = {
  readonly outcome: 'insolvent' | 'victory' | 'defeat';
  readonly lawfulProceedsVnd: string;
} | null;
type FundingPayload = {
  source: 'savings';
  amount: number;
  lotId?: string;
} | {
  source: 'bonds';
  amount: number;
  lotId: string;
} | {
  source: 'stocks' | 'gold' | 'debt';
  amount: number;
}

type TradePayload = {
  kind: 'deposit';
  amount: number;
  term?: 1 | 3 | 2;
} | {
  kind: 'repay';
  amount: number;
} | {
  kind: 'buy';
  asset: 'business';
  amount: number;
} | {
  kind: 'sell';
  asset: 'business';
  amount: number;
} | {
  kind: 'upgrade';
  asset: 'business';
  amount: number;
  customerPreferenceId?: 'checkin' | 'budget' | 'taste';
} | {
  kind: 'buy' | 'sell';
  asset: 'gold';
  amount: number;
  completeEncounter?: boolean;
} | {
  kind: 'buy' | 'sell';
  asset: 'stocks';
  amount: number;
  completeEncounter?: boolean;
  symbolId?: string;
} | {
  kind: 'buy';
  asset: 'bonds';
  amount: number;
  issuerId: 'an-tam' | 'but-pha';
  completeEncounter?: boolean;
} | {
  kind: 'sell';
  asset: 'bonds';
  amount: number;
  lotId: string;
  completeEncounter?: boolean;
}

type DecisionAction =
  | { actionId: 'choose'; payload: { optionId: string } }
  | { actionId: 'fund'; payload: FundingPayload }
  | { actionId: 'trade'; payload: TradePayload }

export type GameActionRequest = { expectedStateVersion: number } & (
  | { actionId: 'advance' | 'roll'; payload: Record<string, never> }
  | DecisionAction
)

export type WhatIfRequest = {
  stateVersion: number
  sequence: number
  alternative: { mode: 'omit' } | { mode: 'replace'; action: DecisionAction }
}

export type WhatIfCatalog = {
  stateVersion: number;
  policy: 'retain-legal-then-required-v1';
  decisions: {
    title: string;
    label: string;
    original: {
      actionId: 'choose' | 'fund' | 'trade';
      payload: DecisionAction['payload'];
    };
    eventChoices: {
      optionId: string;
      label: string;
      detail: string;
    }[];
    canOmit: boolean;
    tradeAlternatives: {
      label: string;
      payload: TradePayload;
    }[];
    fundingOptions: FundingOption[];
    phase: Phase;
    lap: number;
    turn: number;
    position: number;
    eventId: string | null;
    sequence: number;
  }[];
};
type RecordedDecision = { decision: string; consequence: string }
type DecisionEvidence = { actual: RecordedDecision[]; alternative: RecordedDecision[] }
type StartDifference = { lap: number; lines: { label: string; actual: number; alternative: number; delta: number }[] }
type ContinuationCounts = { retained: number; notRetained: number }
type Endgame = NonNullable<OfficialResult> & {
  completedLaps: number[]
  cash: number
  totalWorth: number
  debt: number
  obligations: number
  recurringIncome: number
  portfolio: Portfolio
}
type FinancialDelta = Pick<Endgame, 'lawfulProceedsVnd' | 'cash' | 'totalWorth' | 'debt' | 'obligations' | 'recurringIncome'>
type CoachComparison = {
  version: number
  source: 'verified-what-if-replay'
  sequence: number
  cards: { id: string; title: string; text: string }[]
  continuation: ContinuationCounts & { fallbackCount: number }
} & (
  | { status: 'limited'; evidence: { decisions: DecisionEvidence; reason: string; completedLaps: number[] } }
  | { status: 'completed'; evidence: {
      decisions: DecisionEvidence & { cashDeltaVnd: number }
      actual: Endgame
      alternative: Endgame
      delta: FinancialDelta
      startDifferences: StartDifference[]
    } }
)

export type WhatIfEvaluation = {
  stateVersion: number
  policy: 'retain-legal-then-required-v1'
  sequence: number
  coach: CoachComparison
  continuation: ContinuationCounts & {
    fallback: {
      context: Pick<ServerState, 'phase' | 'lap' | 'turn' | 'position' | 'eventId'>
      action: Pick<GameActionRequest, 'actionId' | 'payload'>
      label: string
    }[]
  }
} & (
  | { status: 'limited'; reason: string; completedLaps: number[] }
  | { status: 'completed'; actual: Endgame; alternative: Endgame; delta: FinancialDelta
      explanation: { decision: DecisionEvidence & { cashDeltaVnd: number }; startDifferences: StartDifference[] } }
)

type Intent = {
  kind: 'gold' | 'bank' | 'stocks' | 'bonds' | 'business' | 'course' | 'advanced'
  action: 'skip' | 'buy' | 'sell' | 'deposit' | 'basic' | 'advanced' | 'upgrade'
}
type IntentRefusal = 'ambiguous' | 'unsupported' | 'multiple-changes'
type IntentReply = { status: 'intent'; intent: Intent } | { status: IntentRefusal }
type Assistance = 'not-requested' | 'used' | 'not-applicable' | 'disabled' | 'unavailable' | 'timeout' | 'rate-limited' | 'output-rejected'

export type WhatIfAssistantRequest =
  | { operation: 'interpret' | 'propose'; stateVersion: number; question: string; allowGemini?: boolean }
  | (WhatIfRequest & { operation: 'explain'; allowGemini?: boolean })

export type WhatIfAssistantReply = { version: 1; stateVersion: number; assistance: Assistance } & (
  | { operation: 'interpret'; interpretation: IntentReply; status: IntentReply['status'] }
  | { operation: 'propose'; interpretation: IntentReply; status: IntentRefusal | 'needs-details' }
  | { operation: 'propose'; interpretation: IntentReply; status: 'proposal'; requiresConfirmation: true
      proposal: WhatIfRequest; preview: { original: string; replacement: string } }
  | { operation: 'explain'; status: 'completed' | 'limited'; evaluation: WhatIfEvaluation
      claim: { id: string; text: string; basis: 'verified-final-cash' } | null }
)
