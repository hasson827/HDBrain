"""Buyer profile dataclass for the affordability engine."""

from dataclasses import dataclass
from typing import ClassVar, Literal, Optional


@dataclass
class BuyerProfile:
    """Household financial profile used to evaluate HDB affordability.

    Defaults reflect a typical HDB concessionary-loan buyer under current rules:
      - 25% downpayment (HDB LTV cap since 2024-08)
      - 2.6% annual interest (HDB concessionary rate)
      - 25-year tenure
      - 30% Mortgage Servicing Ratio (MSR) limit
      - 55% Total Debt Servicing Ratio (TDSR) limit
      - No existing monthly debt obligations
      - Cash savings unknown (upfront-budget constraint not applied)
    """

    monthly_income: float                          # Household monthly income (SGD)
    downpayment_pct: float = 0.25                  # Downpayment as fraction of property price
    interest_rate: float = 0.026                   # Annual interest rate
    tenure_years: int = 25                         # Loan tenure in years
    msr_limit: float = 0.30                        # Max mortgage payment / monthly income
    tdsr_limit: float = 0.55                       # Max total debt payments / monthly income
    existing_debt_monthly: float = 0.0             # Existing monthly debt obligations (SGD)
    cpf_available: float = 0.0                     # CPF funds available for upfront costs (SGD)
    cash_savings: Optional[float] = None           # Cash savings for upfront costs (SGD); None = unknown, skip upfront constraint
    loan_type: Literal["hdb", "bank"] = "hdb"      # Loan type: hdb or bank

    # Class-level policy parameters
    HDB_DOWNPAYMENT_PCT: ClassVar[float] = 0.25
    HDB_MSR_LIMIT: ClassVar[float] = 0.30
    BANK_TDSR_LIMIT: ClassVar[float] = 0.55
    BANK_LOAN_DEFAULT_RATE: ClassVar[float] = 0.035

    def max_monthly_payment(self) -> float:
        """Maximum allowable monthly mortgage payment under MSR and TDSR."""
        msr_cap = self.monthly_income * self.msr_limit
        tdsr_cap = self.monthly_income * self.tdsr_limit - self.existing_debt_monthly
        return max(0.0, min(msr_cap, tdsr_cap))

    @classmethod
    def for_hdb_loan(cls, monthly_income: float, **kwargs) -> "BuyerProfile":
        """Convenience factory for an HDB concessionary-loan buyer.

        Uses current policy defaults: 25% downpayment, 2.6% interest, 30% MSR.
        Any field can be overridden via keyword arguments.
        """
        defaults = {
            "downpayment_pct": cls.HDB_DOWNPAYMENT_PCT,
            "interest_rate": 0.026,
            "msr_limit": cls.HDB_MSR_LIMIT,
            "tdsr_limit": cls.BANK_TDSR_LIMIT,
            "loan_type": "hdb",
        }
        defaults.update(kwargs)
        return cls(monthly_income=monthly_income, **defaults)

    @classmethod
    def for_bank_loan(
        cls,
        monthly_income: float,
        interest_rate: float = BANK_LOAN_DEFAULT_RATE,
        **kwargs,
    ) -> "BuyerProfile":
        """Convenience factory for a bank-loan buyer.

        Defaults: 25% downpayment, 3.5% interest (adjustable), 30% MSR, 55% TDSR.
        Any field can be overridden via keyword arguments.
        """
        defaults = {
            "downpayment_pct": 0.25,
            "interest_rate": interest_rate,
            "msr_limit": cls.HDB_MSR_LIMIT,
            "tdsr_limit": cls.BANK_TDSR_LIMIT,
            "loan_type": "bank",
        }
        defaults.update(kwargs)
        return cls(monthly_income=monthly_income, **defaults)
