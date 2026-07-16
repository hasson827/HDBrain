/**
 * JS port of src/affordability/calculator.py + user_profile.py.
 * Every function here must stay in lockstep with the Python source; parity is
 * verified by parity_test.html against the same expectations as
 * tests/test_affordability.py. Do not "improve" the math without updating both sides.
 */

export const HDB_DOWNPAYMENT_PCT = 0.25;
export const HDB_MSR_LIMIT = 0.30;
export const BANK_TDSR_LIMIT = 0.55;
export const BANK_LOAN_DEFAULT_RATE = 0.035;

/**
 * @typedef {Object} BuyerProfile
 * @property {number} monthlyIncome
 * @property {number} [downpaymentPct=0.25]
 * @property {number} [interestRate=0.026]
 * @property {number} [tenureYears=25]
 * @property {number} [msrLimit=0.30]
 * @property {number} [tdsrLimit=0.55]
 * @property {number} [existingDebtMonthly=0]
 * @property {number} [cpfAvailable=0]
 * @property {number|null} [cashSavings=null]
 * @property {"hdb"|"bank"} [loanType="hdb"]
 */

/** Fill in defaults, mirroring the BuyerProfile dataclass defaults. */
export function makeProfile(overrides) {
  return {
    monthlyIncome: overrides.monthlyIncome,
    downpaymentPct: overrides.downpaymentPct ?? 0.25,
    interestRate: overrides.interestRate ?? 0.026,
    tenureYears: overrides.tenureYears ?? 25,
    msrLimit: overrides.msrLimit ?? 0.30,
    tdsrLimit: overrides.tdsrLimit ?? 0.55,
    existingDebtMonthly: overrides.existingDebtMonthly ?? 0.0,
    cpfAvailable: overrides.cpfAvailable ?? 0.0,
    cashSavings: overrides.cashSavings ?? null,
    loanType: overrides.loanType ?? "hdb",
  };
}

export function forHdbLoan(monthlyIncome, overrides = {}) {
  return makeProfile({
    monthlyIncome,
    downpaymentPct: HDB_DOWNPAYMENT_PCT,
    interestRate: 0.026,
    msrLimit: HDB_MSR_LIMIT,
    tdsrLimit: BANK_TDSR_LIMIT,
    loanType: "hdb",
    ...overrides,
  });
}

export function forBankLoan(monthlyIncome, overrides = {}) {
  return makeProfile({
    monthlyIncome,
    downpaymentPct: 0.25,
    interestRate: overrides.interestRate ?? BANK_LOAN_DEFAULT_RATE,
    msrLimit: HDB_MSR_LIMIT,
    tdsrLimit: BANK_TDSR_LIMIT,
    loanType: "bank",
    ...overrides,
  });
}

/** Maximum allowable monthly mortgage payment under MSR and TDSR. */
export function maxMonthlyPayment(profile) {
  const msrCap = profile.monthlyIncome * profile.msrLimit;
  const tdsrCap = profile.monthlyIncome * profile.tdsrLimit - profile.existingDebtMonthly;
  return Math.max(0.0, Math.min(msrCap, tdsrCap));
}

/** Standard annuity formula: M = P * r * (1+r)^n / ((1+r)^n - 1). */
export function monthlyMortgage(price, downpaymentPct, interestRate, tenureYears) {
  const loan = price * (1 - downpaymentPct);
  if (loan <= 0) return 0.0;
  if (interestRate <= 0) return loan / (tenureYears * 12);

  const r = interestRate / 12;
  const n = tenureYears * 12;
  return (loan * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

/** Singapore Buyer's Stamp Duty (BSD) for residential property, 2024/2025 rates. */
export function stampDuty(price) {
  const brackets = [
    [180_000, 0.01],
    [180_000, 0.02],
    [640_000, 0.03],
    [500_000, 0.04],
    [1_500_000, 0.05],
    [Infinity, 0.06],
  ];

  let duty = 0.0;
  let remaining = price;
  for (const [cap, rate] of brackets) {
    if (remaining <= 0) break;
    const taxable = Math.min(remaining, cap);
    duty += taxable * rate;
    remaining -= taxable;
  }
  return duty;
}

/** Reverse of monthlyMortgage: given max monthly payment, return max loan. */
export function maxLoanFromPayment(monthlyPayment, interestRate, tenureYears) {
  if (monthlyPayment <= 0) return 0.0;
  if (interestRate <= 0) return monthlyPayment * tenureYears * 12;

  const r = interestRate / 12;
  const n = tenureYears * 12;
  return (monthlyPayment * (Math.pow(1 + r, n) - 1)) / (r * Math.pow(1 + r, n));
}

function validateProfile(profile) {
  if (!(profile.downpaymentPct >= 0 && profile.downpaymentPct < 1.0)) {
    throw new Error("downpaymentPct must be in [0, 1)");
  }
  if (profile.loanType !== "hdb" && profile.loanType !== "bank") {
    throw new Error("loanType must be 'hdb' or 'bank'");
  }
  if (!(profile.msrLimit > 0 && profile.msrLimit <= 1)) {
    throw new Error("msrLimit must be in (0, 1]");
  }
  if (!(profile.tdsrLimit > 0 && profile.tdsrLimit <= 1)) {
    throw new Error("tdsrLimit must be in (0, 1]");
  }
  if (profile.cashSavings !== null && profile.cashSavings < 0) {
    throw new Error("cashSavings must be >= 0 or null");
  }
}

/** Largest price whose downpayment + BSD fits within the upfront budget (bisection). */
export function maxPriceFromUpfrontBudget(budget, downpaymentPct) {
  if (budget <= 0) return 0.0;

  const upfront = (price) => price * downpaymentPct + stampDuty(price);

  let lo = 0.0;
  let hi = 1_000_000.0;
  while (upfront(hi) < budget && hi < 1e12) {
    hi *= 2;
  }
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (upfront(mid) <= budget) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return lo;
}

/**
 * Maximum property price affordable under MSR, TDSR, and downpayment constraints.
 * When cashSavings is not null, the price is additionally capped by the upfront
 * budget: downpayment + BSD must fit within cashSavings + cpfAvailable.
 */
export function maxAffordablePrice(profile) {
  validateProfile(profile);
  const maxMonthly = maxMonthlyPayment(profile);
  const maxLoan = maxLoanFromPayment(maxMonthly, profile.interestRate, profile.tenureYears);
  if (profile.downpaymentPct >= 1.0) return Infinity;
  const priceCapLoan = maxLoan / (1 - profile.downpaymentPct);

  if (profile.cashSavings === null) return priceCapLoan;

  const upfrontBudget = profile.cashSavings + profile.cpfAvailable;
  const priceCapUpfront = maxPriceFromUpfrontBudget(upfrontBudget, profile.downpaymentPct);
  return Math.min(priceCapLoan, priceCapUpfront);
}

/** Full affordability metrics dict for a given property price, mirroring affordability_metrics(). */
export function affordabilityMetrics(price, profile) {
  validateProfile(profile);
  const monthlyPay = monthlyMortgage(price, profile.downpaymentPct, profile.interestRate, profile.tenureYears);
  const downpayment = price * profile.downpaymentPct;
  const loanAmount = price - downpayment;
  const sd = stampDuty(price);
  const totalUpfront = Math.max(0.0, downpayment + sd - profile.cpfAvailable);
  const maxPrice = maxAffordablePrice(profile);
  const gap = price - maxPrice;
  const totalDebt = monthlyPay + profile.existingDebtMonthly;

  const msr = profile.monthlyIncome > 0 ? monthlyPay / profile.monthlyIncome : Infinity;
  const tdsr = profile.monthlyIncome > 0 ? totalDebt / profile.monthlyIncome : Infinity;

  return {
    price,
    maxAffordablePrice: maxPrice,
    monthlyPayment: monthlyPay,
    monthlyIncome: profile.monthlyIncome,
    existingDebtMonthly: profile.existingDebtMonthly,
    cashSavings: profile.cashSavings,
    msr,
    msrLimit: profile.msrLimit,
    tdsr,
    tdsrLimit: profile.tdsrLimit,
    pti: msr,
    priceToAnnualIncome: profile.monthlyIncome > 0 ? price / (profile.monthlyIncome * 12) : Infinity,
    downpayment,
    downpaymentPct: profile.downpaymentPct,
    loanAmount,
    loanToValue: price > 0 ? loanAmount / price : 0.0,
    stampDuty: sd,
    totalUpfrontCash: totalUpfront,
    affordable: monthlyPay <= maxMonthlyPayment(profile) && price <= maxPrice,
    affordabilityGap: gap,
    loanType: profile.loanType,
  };
}
