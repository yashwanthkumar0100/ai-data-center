from __future__ import annotations

import json
import os
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title='AI Infrastructure Observatory API')

allowed_origins = os.getenv(
    'ALLOWED_ORIGINS',
    'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,https://*.netlify.app,https://fancy-pastelito-ac78d1.netlify.app',
).split(',')

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in allowed_origins if origin.strip()],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

FACILITIES: list[dict[str, Any]] = [
    {
        'id': 1,
        'name': 'Yotta NM1',
        'operator': 'Yotta',
        'hub': 'Mumbai-Pune',
        'district': 'Panvel',
        'classification_tier': 'Confirmed',
        'water_stress': 'High',
        'climate_vulnerability': 'High',
        'capacity_mw': 150,
        'latitude': 19.095,
        'longitude': 73.010,
        'rationale': 'Operator explicitly references GPU and AI compute expansion in public filings.',
        'source': 'Yotta investor filings',
        'last_verified': '2026-08-12',
    },
    {
        'id': 2,
        'name': 'Navi Mumbai Hyperscale 2',
        'operator': 'AdaniConneX',
        'hub': 'Mumbai-Pune',
        'district': 'Navi Mumbai',
        'classification_tier': 'Likely',
        'water_stress': 'High',
        'climate_vulnerability': 'Medium',
        'capacity_mw': 120,
        'latitude': 19.045,
        'longitude': 73.017,
        'rationale': 'Permit documents and operator expansion plans point to high-density compute racks.',
        'source': 'AdaniConneX expansion announcement',
        'last_verified': '2026-08-08',
    },
    {
        'id': 3,
        'name': 'Chennai DC 4',
        'operator': 'CtrlS',
        'hub': 'Chennai',
        'district': 'Chennai North',
        'classification_tier': 'Mixed-use',
        'water_stress': 'Extreme',
        'climate_vulnerability': 'High',
        'capacity_mw': 80,
        'latitude': 13.082,
        'longitude': 80.270,
        'rationale': 'General-purpose cloud facility known to host AI workloads alongside enterprise tenants.',
        'source': 'CtrlS capacity and cloud portfolio',
        'last_verified': '2026-07-28',
    },
    {
        'id': 4,
        'name': 'Hyderabad AI Cluster A',
        'operator': 'STT GDC India',
        'hub': 'Hyderabad',
        'district': 'Gachibowli',
        'classification_tier': 'Confirmed',
        'water_stress': 'Medium',
        'climate_vulnerability': 'Medium',
        'capacity_mw': 200,
        'latitude': 17.440,
        'longitude': 78.388,
        'rationale': 'Public release names GPU-rich AI and large language model workloads at the campus.',
        'source': 'STT public release',
        'last_verified': '2026-08-15',
    },
    {
        'id': 5,
        'name': 'Noida Cloud Campus',
        'operator': 'Nxtra',
        'hub': 'NCR',
        'district': 'Noida',
        'classification_tier': 'Likely',
        'water_stress': 'Medium',
        'climate_vulnerability': 'High',
        'capacity_mw': 90,
        'latitude': 28.535,
        'longitude': 77.391,
        'rationale': 'Regional hyperscale expansion and liquid-cooling references suggest AI-ready buildout.',
        'source': 'Nxtra project brief',
        'last_verified': '2026-08-03',
    },
    {
        'id': 6,
        'name': 'Bengaluru West DC',
        'operator': 'Equinix',
        'hub': 'Bengaluru',
        'district': 'Whitefield',
        'classification_tier': 'Mixed-use',
        'water_stress': 'Medium',
        'climate_vulnerability': 'Medium',
        'capacity_mw': 64,
        'latitude': 12.978,
        'longitude': 77.751,
        'rationale': 'Platform hosts enterprise and cloud workloads that are increasingly AI-enabled.',
        'source': 'Equinix India site sheet',
        'last_verified': '2026-08-09',
    },
    {
        'id': 7,
        'name': 'Dighi Edge Campus',
        'operator': 'EdgeConnex',
        'hub': 'Mumbai-Pune',
        'district': 'Dighi',
        'classification_tier': 'Unclassified',
        'water_stress': 'High',
        'climate_vulnerability': 'High',
        'capacity_mw': 55,
        'latitude': 18.522,
        'longitude': 72.909,
        'rationale': 'Facility identified but public disclosures are insufficient to confirm AI-specific usage.',
        'source': 'Industry listing and operator profile',
        'last_verified': '2026-07-19',
    },
    {
        'id': 8,
        'name': 'Hyderabad Mega DC',
        'operator': 'Sify',
        'hub': 'Hyderabad',
        'district': 'Madhapur',
        'classification_tier': 'Likely',
        'water_stress': 'Medium',
        'climate_vulnerability': 'Low',
        'capacity_mw': 110,
        'latitude': 17.450,
        'longitude': 78.388,
        'rationale': 'Regional AI cloud announcements align with facility expansion and rack density claims.',
        'source': 'Sify investor deck',
        'last_verified': '2026-08-11',
    },
    {
        'id': 9,
        'name': 'Bengaluru Campus 3',
        'operator': 'Nile',
        'hub': 'Bengaluru',
        'district': 'Bommasandra',
        'classification_tier': 'Unclassified',
        'water_stress': 'Low',
        'climate_vulnerability': 'Medium',
        'capacity_mw': 48,
        'latitude': 13.012,
        'longitude': 77.648,
        'rationale': 'Site is in active expansion but lacks clear public evidence of dedicated AI capacity.',
        'source': 'Regional listing and press report',
        'last_verified': '2026-08-02',
    },
]

DISTRICTS: list[dict[str, Any]] = [
    {
        'id': 'panvel', 'name': 'Panvel', 'hub': 'Mumbai-Pune',
        'water_stress': 'High', 'climate_vulnerability': 'High',
        'geometry': [[72.88, 19.00], [73.10, 19.00], [73.10, 19.18], [72.88, 19.18], [72.88, 19.00]],
    },
    {
        'id': 'navi-mumbai', 'name': 'Navi Mumbai', 'hub': 'Mumbai-Pune',
        'water_stress': 'High', 'climate_vulnerability': 'Medium',
        'geometry': [[72.91, 18.96], [73.15, 18.96], [73.15, 19.08], [72.91, 19.08], [72.91, 18.96]],
    },
    {
        'id': 'chennai-north', 'name': 'Chennai North', 'hub': 'Chennai',
        'water_stress': 'Extreme', 'climate_vulnerability': 'High',
        'geometry': [[80.17, 12.99], [80.37, 12.99], [80.37, 13.17], [80.17, 13.17], [80.17, 12.99]],
    },
    {
        'id': 'gachibowli', 'name': 'Gachibowli', 'hub': 'Hyderabad',
        'water_stress': 'Medium', 'climate_vulnerability': 'Medium',
        'geometry': [[78.31, 17.38], [78.47, 17.38], [78.47, 17.50], [78.31, 17.50], [78.31, 17.38]],
    },
    {
        'id': 'noida', 'name': 'Noida', 'hub': 'NCR',
        'water_stress': 'Medium', 'climate_vulnerability': 'High',
        'geometry': [[77.30, 28.46], [77.49, 28.46], [77.49, 28.61], [77.30, 28.61], [77.30, 28.46]],
    },
    {
        'id': 'whitefield', 'name': 'Whitefield', 'hub': 'Bengaluru',
        'water_stress': 'Medium', 'climate_vulnerability': 'Medium',
        'geometry': [[77.68, 12.91], [77.82, 12.91], [77.82, 13.06], [77.68, 13.06], [77.68, 12.91]],
    },
    {
        'id': 'bommasandra', 'name': 'Bommasandra', 'hub': 'Bengaluru',
        'water_stress': 'Low', 'climate_vulnerability': 'Medium',
        'geometry': [[77.57, 12.94], [77.72, 12.94], [77.72, 13.08], [77.57, 13.08], [77.57, 12.94]],
    },
    {
        'id': 'dighi', 'name': 'Dighi', 'hub': 'Mumbai-Pune',
        'water_stress': 'High', 'climate_vulnerability': 'High',
        'geometry': [[72.83, 18.46], [73.00, 18.46], [73.00, 18.59], [72.83, 18.59], [72.83, 18.46]],
    },
]


def _filtered_facilities(
    *,
    hub: str | None = None,
    tier: str | None = None,
    search: str | None = None,
) -> list[dict[str, Any]]:
    result = FACILITIES
    if hub and hub != 'All':
        result = [facility for facility in result if facility['hub'] == hub]
    if tier and tier != 'All':
        result = [facility for facility in result if facility['classification_tier'] == tier]
    if search:
        query = search.lower()
        result = [
            facility
            for facility in result
            if query in facility['name'].lower()
            or query in facility['operator'].lower()
            or query in facility['district'].lower()
            or query in facility['hub'].lower()
        ]
    return result


@app.get('/api/facilities')
def get_facilities(
    hub: str | None = Query(default=None),
    tier: str | None = Query(default=None),
    search: str | None = Query(default=None),
):
    return _filtered_facilities(hub=hub, tier=tier, search=search)


@app.get('/api/stats/summary')
def get_summary():
    total = len(FACILITIES)
    confirmed = sum(1 for facility in FACILITIES if facility['classification_tier'] == 'Confirmed')
    high_water = sum(1 for facility in FACILITIES if facility['water_stress'] in {'High', 'Extreme'})
    counts = {}
    for facility in FACILITIES:
        counts[facility['hub']] = counts.get(facility['hub'], 0) + 1
    top_hub = max(counts.items(), key=lambda item: item[1])[0]

    return {
        'total_facilities': total,
        'confirmed_ai_percent': round((confirmed / total) * 100, 1),
        'high_water_stress_count': high_water,
        'top_hub': top_hub,
        'hub_breakdown': counts,
    }


@app.get('/api/districts/geojson')
def get_districts_geojson():
    return {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'id': district['id'],
                'properties': {
                    'name': district['name'],
                    'hub': district['hub'],
                    'water_stress': district['water_stress'],
                    'climate_vulnerability': district['climate_vulnerability'],
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [district['geometry']],
                },
            }
            for district in DISTRICTS
        ],
    }


@app.get('/api/health')
def health():
    return {'status': 'ok'}


@app.get('/api/geocode')
def geocode_place(q: str = Query(min_length=2, max_length=120)):
    query = urlencode({'q': q, 'format': 'jsonv2', 'limit': 1, 'countrycodes': 'in', 'addressdetails': 1})
    request = Request(
        f'https://nominatim.openstreetmap.org/search?{query}',
        headers={'Accept': 'application/json', 'User-Agent': 'AI-Infrastructure-Observatory/1.0'},
    )

    try:
        with urlopen(request, timeout=8) as response:
            results = json.load(response)
    except Exception as error:
        raise HTTPException(status_code=502, detail='Place lookup is temporarily unavailable.') from error

    if not results:
        raise HTTPException(status_code=404, detail='No matching Indian place found.')

    result = results[0]
    address = result.get('address', {})
    return {
        'name': result.get('name') or address.get('city') or address.get('town') or address.get('village') or q,
        'state': address.get('state', ''),
        'display_name': result['display_name'],
        'lat': result['lat'],
        'lon': result['lon'],
    }
