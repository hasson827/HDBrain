import re
import pandas as pd


def parse_remaining_lease(value):
    if pd.isna(value):
        return pd.NA
    if isinstance(value, (int, float)):
        return int(value * 12)
    s = str(value).strip().lower()
    years = 0
    months = 0
    m = re.search(r'(\d+)\s*years?', s)
    if m:
        years = int(m.group(1))
    m = re.search(r'(\d+)\s*months?', s)
    if m:
        months = int(m.group(1))
    return years * 12 + months


def parse_storey_range(value):
    if pd.isna(value):
        return pd.NA
    nums = [int(x) for x in re.findall(r'\d+', str(value))]
    if not nums:
        return pd.NA
    return sum(nums) / len(nums)


def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["month"] = pd.to_datetime(df["month"], errors="coerce")
    df["town"] = df["town"].str.strip().str.upper()
    df["flat_type"] = df["flat_type"].str.strip().str.upper()
    df["flat_model"] = df["flat_model"].str.strip().str.upper()
    df["block"] = df["block"].str.strip().str.upper()
    df["street_name"] = df["street_name"].str.strip().str.upper()

    df["remaining_lease_months"] = pd.to_numeric(
        df["remaining_lease"].apply(parse_remaining_lease), errors="coerce"
    )
    df["lease_commence_date"] = pd.to_numeric(df["lease_commence_date"], errors="coerce")

    # Fallback: infer remaining lease from lease_commence_date and transaction month
    # assuming 99-year lease
    inferred_months = (99 - (df["month"].dt.year - df["lease_commence_date"])) * 12
    df["remaining_lease_months"] = df["remaining_lease_months"].fillna(inferred_months)

    df["storey_mid"] = df["storey_range"].apply(parse_storey_range)
    df["floor_area_sqm"] = pd.to_numeric(df["floor_area_sqm"], errors="coerce")
    df["resale_price"] = pd.to_numeric(df["resale_price"], errors="coerce")
    df["flat_age"] = df["month"].dt.year - df["lease_commence_date"]

    # Drop rows missing critical fields
    df = df.dropna(subset=["resale_price", "floor_area_sqm", "lease_commence_date",
                           "remaining_lease_months", "storey_mid"])
    return df
