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


def max_affordable_price(profile: BuyerProfile) -> float:
    """Maximum property price affordable under the given MSR and downpayment constraints."""
    max_monthly = profile.max_monthly_payment()
    max_loan = max_loan_from_payment(max_monthly, profile.interest_rate, profile.tenure_years)
    if profile.downpayment_pct >= 1.0:
        return float("inf")
    return max_loan / (1 - profile.downpayment_pct)


def affordability_metrics(price: float, profile: BuyerProfile) -> Dict[str, float]:
    """Return a dictionary of affordability metrics for a given property price."""
    monthly_pay = monthly_mortgage(
        price,
        profile.downpayment_pct,
        profile.interest_rate,
        profile.tenure_years,
    )
    downpayment = price * profile.downpayment_pct
    sd = stamp_duty(price)
    total_upfront = max(0.0, downpayment + sd - profile.cpf_available)
    max_price = max_affordable_price(profile)
    gap = price - max_price

    return {
        "price": price,
        "max_affordable_price": max_price,
        "monthly_payment": monthly_pay,
        "monthly_income": profile.monthly_income,
        "pti": monthly_pay / profile.monthly_income if profile.monthly_income > 0 else float("inf"),
        "price_to_annual_income": price / (profile.monthly_income * 12) if profile.monthly_income > 0 else float("inf"),
        "downpayment": downpayment,
        "stamp_duty": sd,
        "total_upfront_cash": total_upfront,
        "affordable": monthly_pay <= profile.max_monthly_payment(),
        "affordability_gap": gap,
    }
