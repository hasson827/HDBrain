"""Core affordability calculations: mortgage, stamp duty, and max price."""

import math
from typing import Dict

from src.affordability.user_profile import BuyerProfile


def monthly_mortgage(price: float, downpayment_pct: float, interest_rate: float, tenure_years: int) -> float:
    """Compute monthly payment for an amortising loan.

    Uses the standard annuity formula:
        M = P * r * (1+r)^n / ((1+r)^n - 1)
    where r is the monthly interest rate and n is the number of months.
    """
    loan = price * (1 - downpayment_pct)
    if loan <= 0:
        return 0.0
    if interest_rate <= 0:
        return loan / (tenure_years * 12)

    r = interest_rate / 12
    n = tenure_years * 12
    payment = loan * r * (1 + r) ** n / ((1 + r) ** n - 1)
    return float(payment)


def stamp_duty(price: float) -> float:
    """Compute Singapore Buyer's Stamp Duty (BSD) for residential property.

    Rates (2024/2025 residential):
      - First  $180,000 : 1%
      - Next   $180,000 : 2%
      - Next   $640,000 : 3%
      - Next   $500,000 : 4%
      - Next $1,500,000 : 5%
      - Remainder       : 6%
    """
    brackets = [
        (180_000, 0.01),
        (180_000, 0.02),
        (640_000, 0.03),
        (500_000, 0.04),
        (1_500_000, 0.05),
        (math.inf, 0.06),
    ]

    duty = 0.0
    remaining = price
    for cap, rate in brackets:
        if remaining <= 0:
            break
        taxable = min(remaining, cap)
        duty += taxable * rate
        remaining -= taxable
    return float(duty)


def max_loan_from_payment(monthly_payment: float, interest_rate: float, tenure_years: int) -> float:
    """Reverse of monthly_mortgage: given max monthly payment, return max loan."""
    if monthly_payment <= 0:
        return 0.0
    if interest_rate <= 0:
        return monthly_payment * tenure_years * 12

    r = interest_rate / 12
    n = tenure_years * 12
    # L = M * ((1+r)^n - 1) / (r * (1+r)^n)
    loan = monthly_payment * ((1 + r) ** n - 1) / (r * (1 + r) ** n)
    return float(loan)


def _validate_profile(profile: BuyerProfile) -> None:
    """Validate profile parameters."""
    if not 0 <= profile.downpayment_pct < 1.0:
        raise ValueError("downpayment_pct must be in [0, 1)")
    if profile.loan_type not in ("hdb", "bank"):
        raise ValueError("loan_type must be 'hdb' or 'bank'")
    if profile.msr_limit <= 0 or profile.msr_limit > 1:
        raise ValueError("msr_limit must be in (0, 1]")
    if profile.tdsr_limit <= 0 or profile.tdsr_limit > 1:
        raise ValueError("tdsr_limit must be in (0, 1]")
    if profile.cash_savings is not None and profile.cash_savings < 0:
        raise ValueError("cash_savings must be >= 0 or None")


def max_price_from_upfront_budget(budget: float, downpayment_pct: float) -> float:
    """Largest price whose downpayment + BSD fits within the upfront budget.

    Solves P * downpayment_pct + stamp_duty(P) <= budget by bisection
    (the left side is strictly increasing in P).
    """
    if budget <= 0:
        return 0.0

    def upfront(price: float) -> float:
        return price * downpayment_pct + stamp_duty(price)

    lo, hi = 0.0, 1_000_000.0
    while upfront(hi) < budget and hi < 1e12:
        hi *= 2
    for _ in range(80):
        mid = (lo + hi) / 2
        if upfront(mid) <= budget:
            lo = mid
        else:
            hi = mid
    return float(lo)


def max_affordable_price(profile: BuyerProfile) -> float:
    """Maximum property price affordable under MSR, TDSR, and downpayment constraints.

    When `cash_savings` is provided (not None), the price is additionally capped by
    the upfront budget: downpayment + BSD must fit within cash_savings + cpf_available.
    Simplification: cash and CPF are pooled for upfront costs; the bank-loan rule that
    at least 5% must be paid in cash is not modelled.
    """
    _validate_profile(profile)
    max_monthly = profile.max_monthly_payment()
    max_loan = max_loan_from_payment(max_monthly, profile.interest_rate, profile.tenure_years)
    if profile.downpayment_pct >= 1.0:
        return float("inf")
    price_cap_loan = max_loan / (1 - profile.downpayment_pct)

    if profile.cash_savings is None:
        return price_cap_loan

    upfront_budget = profile.cash_savings + profile.cpf_available
    price_cap_upfront = max_price_from_upfront_budget(upfront_budget, profile.downpayment_pct)
    return min(price_cap_loan, price_cap_upfront)


def affordability_metrics(price: float, profile: BuyerProfile) -> Dict[str, float]:
    """Return a dictionary of affordability metrics for a given property price."""
    _validate_profile(profile)
    monthly_pay = monthly_mortgage(
        price,
        profile.downpayment_pct,
        profile.interest_rate,
        profile.tenure_years,
    )
    downpayment = price * profile.downpayment_pct
    loan_amount = price - downpayment
    sd = stamp_duty(price)
    total_upfront = max(0.0, downpayment + sd - profile.cpf_available)
    max_price = max_affordable_price(profile)
    gap = price - max_price
    total_debt = monthly_pay + profile.existing_debt_monthly

    msr = monthly_pay / profile.monthly_income if profile.monthly_income > 0 else float("inf")
    tdsr = total_debt / profile.monthly_income if profile.monthly_income > 0 else float("inf")

    return {
        "price": price,
        "max_affordable_price": max_price,
        "monthly_payment": monthly_pay,
        "monthly_income": profile.monthly_income,
        "existing_debt_monthly": profile.existing_debt_monthly,
        "cash_savings": profile.cash_savings,
        "msr": msr,
        "msr_limit": profile.msr_limit,
        "tdsr": tdsr,
        "tdsr_limit": profile.tdsr_limit,
        "pti": msr,
        "price_to_annual_income": price / (profile.monthly_income * 12) if profile.monthly_income > 0 else float("inf"),
        "downpayment": downpayment,
        "downpayment_pct": profile.downpayment_pct,
        "loan_amount": loan_amount,
        "loan_to_value": loan_amount / price if price > 0 else 0.0,
        "stamp_duty": sd,
        "total_upfront_cash": total_upfront,
        "affordable": (monthly_pay <= profile.max_monthly_payment()) and (price <= max_price),
        "affordability_gap": gap,
        "loan_type": profile.loan_type,
    }
