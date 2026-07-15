import time
from pathlib import Path
import pandas as pd
import requests
import yaml


# Approximate town centroids for fallback when OneMap fails
TOWN_CENTROIDS = {
    "ANG MO KIO": (1.3691, 103.8454),
    "BEDOK": (1.3236, 103.9273),
    "BISHAN": (1.3526, 103.8353),
    "BUKIT BATOK": (1.3590, 103.7637),
    "BUKIT MERAH": (1.2819, 103.8239),
    "BUKIT PANJANG": (1.3774, 103.7719),
    "CHOA CHU KANG": (1.3840, 103.7471),
    "CLEMENTI": (1.3162, 103.7649),
    "GEYLANG": (1.3182, 103.8871),
    "HOUGANG": (1.3714, 103.8930),
    "JURONG EAST": (1.3329, 103.7436),
    "JURONG WEST": (1.3404, 103.7090),
    "KALLANG/WHAMPOA": (1.3138, 103.8621),
    "PASIR RIS": (1.3731, 103.9493),
    "PUNGGOL": (1.3984, 103.9072),
    "QUEENSTOWN": (1.2948, 103.8060),
    "SENGKANG": (1.3917, 103.8953),
    "SERANGOON": (1.3554, 103.8679),
    "TAMPINES": (1.3496, 103.9568),
    "TOA PAYOH": (1.3343, 103.8563),
    "WOODLANDS": (1.4382, 103.7890),
    "YISHUN": (1.4304, 103.8354),
    "SEMBAWANG": (1.4491, 103.8185),
    "SIMEI": (1.3434, 103.9539),
    "TENGAH": (1.3570, 103.7400),
    "CENTRAL AREA": (1.2966, 103.8534),
    "MARINE PARADE": (1.3021, 103.9070),
    "LIM CHU KANG": (1.4304, 103.7180),
    "MANDAI": (1.4100, 103.7900),
    "MUSEUM": (1.2966, 103.8500),
    "NEWTON": (1.3080, 103.8380),
    "NOVENA": (1.3200, 103.8400),
    "ORCHARD": (1.3048, 103.8318),
    "OUTRAM": (1.2818, 103.8380),
    "RIVER VALLEY": (1.2940, 103.8350),
    "ROCHOR": (1.3045, 103.8520),
    "SINGAPORE RIVER": (1.2880, 103.8500),
    "STRAITS VIEW": (1.2750, 103.8550),
    "TANGLIN": (1.3150, 103.8100),
    "TUAS": (1.3160, 103.6500),
    "WESTERN WATER CATCHMENT": (1.3800, 103.6700),
}


def _load_config():
    with open("config.yaml") as f:
        return yaml.safe_load(f)


def _search_onemap(address: str) -> tuple[float, float] | None:
    try:
        cfg = _load_config()
    except FileNotFoundError:
        return None
    url = cfg["onemap"]["base_url"]
    params = {"searchVal": address, "returnGeom": "Y", "getAddrDetails": "N"}
    try:
        r = requests.get(url, params=params, timeout=10)
        r.raise_for_status()
        data = r.json()
        if data.get("results"):
            lat = float(data["results"][0]["LATITUDE"])
            lng = float(data["results"][0]["LONGITUDE"])
            return lat, lng
    except Exception:
        pass
    return None


def build_address_cache(df: pd.DataFrame, cache_path: Path, town_centroids: dict | None = None,
                        use_api: bool = True) -> pd.DataFrame:
    cache_path = Path(cache_path)
    if town_centroids is None:
        town_centroids = TOWN_CENTROIDS

    if cache_path.exists():
        return pd.read_csv(
            cache_path,
            index_col=["block", "street_name"],
            dtype={"block": str, "street_name": str}
        )

    unique = df[["block", "street_name", "town"]].drop_duplicates().dropna()
    unique["block"] = unique["block"].astype(str)
    unique["street_name"] = unique["street_name"].astype(str)
    rows = []
    for _, row in unique.iterrows():
        address = f"{row['block']} {row['street_name']}"
        coords = _search_onemap(address) if use_api else None
        if coords is None:
            coords = town_centroids.get(row["town"], (1.35, 103.8))
        rows.append({
            "block": row["block"],
            "street_name": row["street_name"],
            "lat": coords[0],
            "lng": coords[1],
        })
        if use_api:
            time.sleep(0.2)  # polite rate limiting

    out = pd.DataFrame(rows).set_index(["block", "street_name"])
    out.index = out.index.set_levels(out.index.levels[0].astype(str), level=0)
    out.index = out.index.set_levels(out.index.levels[1].astype(str), level=1)
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(cache_path)
    return out
