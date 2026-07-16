"""Unit tests for the affordability engine."""

import pytest

from src.affordability.calculator import (
    affordability_metrics,
    max_affordable_price,
    max_loan_from_payment,
    monthly_mortgage,
    stamp_duty,
)
from src.affordability.user_profile import BuyerProfile


def test_monthly_mortgage_zero_interest():
    # $500k price, 0% down, 0% interest, 25 years -> $500k / 300 months
    assert monthly_mortgage(500_000, 0.0, 0.0, 25) == pytest.approx(500_000 / 300)


def test_monthly_mortgage_normal():
    # $500k price, 25% down, 2.6% annual, 25 years -> loan $375k
    pay = monthly_mortgage(500_000, 0.25, 0.026, 25)
    assert pay > 0
    # Approx known value: ~S$1,701/month
    assert pay == pytest.approx(1701, abs=5)


def test_max_loan_inverse_monthly_mortgage():
    pay = monthly_mortgage(500_000, 0.25, 0.026, 25)
    loan = max_loan_from_payment(pay, 0.026, 25)
    assert loan == pytest.approx(375_000, abs=1)


def test_stamp_duty_brackets():
    assert stamp_duty(180_000) == pytest.approx(1_800)
    assert stamp_duty(360_000) == pytest.approx(1_800 + 3_600)
    assert stamp_duty(1_000_000) == pytest.approx(
        180_000 * 0.01 + 180_000 * 0.02 + 640_000 * 0.03
    )
    assert stamp_duty(2_000_000) == pytest.approx(
        180_000 * 0.01
        + 180_000 * 0.02
        + 640_000 * 0.03
        + 500_000 * 0.04
        + 500_000 * 0.05
    )


def test_profile_defaults():
    p = BuyerProfile(monthly_income=8_000)
    assert p.downpayment_pct == 0.25
    assert p.msr_limit == 0.30
    assert p.tdsr_limit == 0.55
    assert p.loan_type == "hdb"
    assert p.existing_debt_monthly == 0.0


def test_max_affordable_price_msr_bound():
    # $8k income, 30% MSR -> $2,400/month max mortgage
    p = BuyerProfile(monthly_income=8_000)
    max_price = max_affordable_price(p)
    monthly = monthly_mortgage(max_price, p.downpayment_pct, p.interest_rate, p.tenure_years)
    assert monthly == pytest.approx(p.max_monthly_payment(), abs=1)
    assert monthly / p.monthly_income <= p.msr_limit + 1e-9


def test_max_affordable_price_tdsr_bound():
    # Existing debt of $2,400/month leaves $2,000/month for mortgage under 55% TDSR,
    # which is tighter than the $2,400 MSR cap.
    p = BuyerProfile(monthly_income=8_000, existing_debt_monthly=2_400)
    max_price = max_affordable_price(p)
    monthly = monthly_mortgage(max_price, p.downpayment_pct, p.interest_rate, p.tenure_years)
    total_debt = monthly + p.existing_debt_monthly
    assert total_debt / p.monthly_income <= p.tdsr_limit + 1e-9
    assert monthly / p.monthly_income <= p.msr_limit + 1e-9


def test_affordability_metrics_fields():
    p = BuyerProfile(monthly_income=8_000)
    m = affordability_metrics(500_000, p)
    expected_keys = {
        "price",
        "max_affordable_price",
        "monthly_payment",
        "monthly_income",
        "existing_debt_monthly",
        "cash_savings",
        "msr",
        "msr_limit",
        "tdsr",
        "tdsr_limit",
        "pti",
        "price_to_annual_income",
        "downpayment",
        "downpayment_pct",
        "loan_amount",
        "loan_to_value",
        "stamp_duty",
        "total_upfront_cash",
        "affordable",
        "affordability_gap",
        "loan_type",
    }
    assert set(m.keys()) == expected_keys
    assert m["downpayment_pct"] == 0.25
    assert m["loan_to_value"] == pytest.approx(0.75)
    assert m["msr_limit"] == 0.30
    assert m["tdsr_limit"] == 0.55


def test_affordability_boolean():
    p = BuyerProfile(monthly_income=8_000)
    max_price = max_affordable_price(p)
    assert affordability_metrics(max_price * 0.9, p)["affordable"] is True
    assert affordability_metrics(max_price * 1.1, p)["affordable"] is False


def test_factory_methods():
    hdb = BuyerProfile.for_hdb_loan(8_000)
    assert hdb.loan_type == "hdb"
    assert hdb.downpayment_pct == 0.25
    assert hdb.interest_rate == 0.026
    assert hdb.msr_limit == 0.30

    bank = BuyerProfile.for_bank_loan(8_000)
    assert bank.loan_type == "bank"
    assert bank.downpayment_pct == 0.25
    assert bank.interest_rate == 0.035

    bank_custom = BuyerProfile.for_bank_loan(
        8_000, interest_rate=0.04, downpayment_pct=0.30
    )
    assert bank_custom.interest_rate == 0.04
    assert bank_custom.downpayment_pct == 0.30


def test_invalid_profile():
    with pytest.raises(ValueError):
        max_affordable_price(BuyerProfile(monthly_income=8_000, downpayment_pct=-0.1))
    with pytest.raises(ValueError):
        max_affordable_price(BuyerProfile(monthly_income=8_000, downpayment_pct=1.0))
    with pytest.raises(ValueError):
        max_affordable_price(BuyerProfile(monthly_income=8_000, loan_type="cash"))
    with pytest.raises(ValueError):
        max_affordable_price(BuyerProfile(monthly_income=8_000, cash_savings=-1.0))


def test_cash_savings_none_keeps_loan_bound():
    # cash_savings defaults to None -> upfront constraint is not applied.
    p_unknown = BuyerProfile(monthly_income=8_000)
    p_rich = BuyerProfile(monthly_income=8_000, cash_savings=10_000_000)
    assert max_affordable_price(p_unknown) == pytest.approx(max_affordable_price(p_rich))


def test_cash_savings_caps_price():
    # $50k savings, 25% downpayment -> upfront budget binds far below the MSR bound.
    p = BuyerProfile(monthly_income=8_000, cash_savings=50_000)
    max_price = max_affordable_price(p)
    unconstrained = max_affordable_price(BuyerProfile(monthly_income=8_000))
    assert max_price < unconstrained
    # At the cap, downpayment + BSD should exhaust the budget.
    upfront = max_price * p.downpayment_pct + stamp_duty(max_price)
    assert upfront == pytest.approx(50_000, abs=1)
    # A price above the cap is not affordable even though the mortgage fits MSR.
    m = affordability_metrics(max_price * 1.05, p)
    assert m["affordable"] is False


def test_cash_savings_pools_with_cpf():
    p_cash_only = BuyerProfile(monthly_income=8_000, cash_savings=50_000)
    p_mixed = BuyerProfile(monthly_income=8_000, cash_savings=30_000, cpf_available=20_000)
    assert max_affordable_price(p_cash_only) == pytest.approx(max_affordable_price(p_mixed))


def test_cash_savings_zero_means_nothing_affordable():
    p = BuyerProfile(monthly_income=8_000, cash_savings=0.0)
    assert max_affordable_price(p) == 0.0
