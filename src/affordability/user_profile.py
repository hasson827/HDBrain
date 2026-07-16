"""Buyer profile dataclass for the affordability engine."""

from dataclasses import dataclass


@dataclass
class BuyerProfile:
    """Household financial profile used to evaluate HDB affordability.

    Defaults reflect a typical HDB concessionary-loan buyer:
      - 10% downpayment
      - 2.6% annual interest
      - 25-year tenure
      - 30% Mortgage Servicing Ratio (MSR) limit
    """

    monthly_income: float          # Household monthly income (SGD)
    downpayment_pct: float = 0.10  # Downpayment as fraction of property price
    interest_rate: float = 0.026   # Annual interest rate
    tenure_years: int = 25         # Loan tenure in years
    msr_limit: float = 0.30        # Max mortgage payment / monthly income
    cpf_available: float = 0.0     # CPF funds available for upfront costs (SGD)

    def max_monthly_payment(self) -> float:
        """Maximum allowable monthly mortgage payment under MSR."""
        return self.monthly_income * self.msr_limit
