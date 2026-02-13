from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import requests

WIKIDATA_SPARQL_ENDPOINT = "https://query.wikidata.org/sparql"
DEFAULT_QUERY = """
SELECT * WHERE {
  wd:Q1292442 wdt:P527 ?item .
  ?item wdt:P31 ?p31 .
  ?item wdt:P625 ?p625 .
  ?item wdt:P131 ?p131
}
"""


@dataclass
class Location:
    identifier: str
    label: str
    latitude: float
    longitude: float


def parse_point(point_value: str) -> tuple[float, float]:
    cleaned = point_value.replace("Point(", "").replace(")", "")
    longitude_str, latitude_str = cleaned.split(" ")
    return float(latitude_str), float(longitude_str)


def fetch_locations(query: str = DEFAULT_QUERY, timeout: int = 20) -> list[Location]:
    response = requests.get(
        WIKIDATA_SPARQL_ENDPOINT,
        headers={"Accept": "application/sparql-results+json"},
        params={"query": query},
        timeout=timeout,
    )
    response.raise_for_status()
    data = response.json()
    bindings: list[dict[str, Any]] = data.get("results", {}).get("bindings", [])

    locations: list[Location] = []
    for row in bindings:
        point_raw = row.get("p625", {}).get("value") or row.get("coord", {}).get("value")
        item_uri = row.get("item", {}).get("value")

        if not point_raw or not item_uri:
            continue

        identifier = item_uri.rsplit("/", 1)[-1]
        label = row.get("itemLabel", {}).get("value") or identifier
        latitude, longitude = parse_point(point_raw)
        locations.append(
            Location(
                identifier=identifier,
                label=label,
                latitude=latitude,
                longitude=longitude,
            )
        )

    return locations
