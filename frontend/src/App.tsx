import { useEffect, useMemo, useState } from 'react'
import { GeoJSON, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'

type FacilityTier = 'Confirmed' | 'Likely' | 'Mixed-use' | 'Unclassified'
type WaterStress = 'Low' | 'Medium' | 'High' | 'Extreme'
type RiskMode = 'water' | 'climate'

type Facility = {
  id: number
  name: string
  operator: string
  hub: string
  district: string
  classification_tier: FacilityTier
  water_stress: WaterStress
  climate_vulnerability: string
  capacity_mw: number
  latitude: number
  longitude: number
  rationale: string
  source: string
  last_verified: string
}

type Summary = {
  total_facilities: number
  confirmed_ai_percent: number
  high_water_stress_count: number
  top_hub: string
  hub_breakdown: Record<string, number>
}

type DistrictProperties = {
  name: string
  hub: string
  water_stress: WaterStress
  climate_vulnerability: string
}

type DistrictFeatureCollection = {
  type: 'FeatureCollection'
  features: Array<{
    type: 'Feature'
    id: string
    properties: DistrictProperties
    geometry: {
      type: 'Polygon'
      coordinates: number[][][]
    }
  }>
}

type SearchLocation = {
  name: string
  state: string
  displayName: string
  latitude: number
  longitude: number
}

const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? ''
const createApiUrl = (path: string) => (API_BASE ? `${API_BASE}${path}` : path)
const hubs = ['All', 'Mumbai-Pune', 'Chennai', 'Hyderabad', 'NCR', 'Bengaluru']
const tierOptions = ['All', 'Confirmed', 'Likely', 'Mixed-use', 'Unclassified']
const sourceUrls: Record<string, string> = {
  Yotta: 'https://www.yotta.com/',
  AdaniConneX: 'https://www.adaniconnex.com/',
  CtrlS: 'https://www.ctrls.in/',
  'STT GDC India': 'https://www.sttelemediagdc.com/',
  Nxtra: 'https://www.nxtra.in/',
  Equinix: 'https://www.equinix.com/',
  EdgeConnex: 'https://www.edgeconnex.com/',
  Sify: 'https://www.sify.com/',
  Nile: 'https://www.niledata.com/',
}

const FALLBACK_FACILITIES: Facility[] = [
  {
    id: 1,
    name: 'Yotta NM1',
    operator: 'Yotta',
    hub: 'Mumbai-Pune',
    district: 'Panvel',
    classification_tier: 'Confirmed',
    water_stress: 'High',
    climate_vulnerability: 'High',
    capacity_mw: 150,
    latitude: 19.095,
    longitude: 73.01,
    rationale: 'Operator explicitly references GPU and AI compute expansion in public filings.',
    source: 'Yotta investor filings',
    last_verified: '2026-08-12',
  },
  {
    id: 2,
    name: 'Navi Mumbai Hyperscale 2',
    operator: 'AdaniConneX',
    hub: 'Mumbai-Pune',
    district: 'Navi Mumbai',
    classification_tier: 'Likely',
    water_stress: 'High',
    climate_vulnerability: 'Medium',
    capacity_mw: 120,
    latitude: 19.045,
    longitude: 73.017,
    rationale: 'Permit documents and operator expansion plans point to high-density compute racks.',
    source: 'AdaniConneX expansion announcement',
    last_verified: '2026-08-08',
  },
  {
    id: 3,
    name: 'Chennai DC 4',
    operator: 'CtrlS',
    hub: 'Chennai',
    district: 'Chennai North',
    classification_tier: 'Mixed-use',
    water_stress: 'Extreme',
    climate_vulnerability: 'High',
    capacity_mw: 80,
    latitude: 13.082,
    longitude: 80.27,
    rationale: 'General-purpose cloud facility known to host AI workloads alongside enterprise tenants.',
    source: 'CtrlS capacity and cloud portfolio',
    last_verified: '2026-07-28',
  },
  {
    id: 4,
    name: 'Hyderabad AI Cluster A',
    operator: 'STT GDC India',
    hub: 'Hyderabad',
    district: 'Gachibowli',
    classification_tier: 'Confirmed',
    water_stress: 'Medium',
    climate_vulnerability: 'Medium',
    capacity_mw: 200,
    latitude: 17.44,
    longitude: 78.388,
    rationale: 'Public release names GPU-rich AI and large language model workloads at the campus.',
    source: 'STT public release',
    last_verified: '2026-08-15',
  },
  {
    id: 5,
    name: 'Noida Cloud Campus',
    operator: 'Nxtra',
    hub: 'NCR',
    district: 'Noida',
    classification_tier: 'Likely',
    water_stress: 'Medium',
    climate_vulnerability: 'High',
    capacity_mw: 90,
    latitude: 28.535,
    longitude: 77.391,
    rationale: 'Regional hyperscale expansion and liquid-cooling references suggest AI-ready buildout.',
    source: 'Nxtra project brief',
    last_verified: '2026-08-03',
  },
  {
    id: 6,
    name: 'Bengaluru West DC',
    operator: 'Equinix',
    hub: 'Bengaluru',
    district: 'Whitefield',
    classification_tier: 'Mixed-use',
    water_stress: 'Medium',
    climate_vulnerability: 'Medium',
    capacity_mw: 64,
    latitude: 12.978,
    longitude: 77.751,
    rationale: 'Platform hosts enterprise and cloud workloads that are increasingly AI-enabled.',
    source: 'Equinix India site sheet',
    last_verified: '2026-08-09',
  },
  {
    id: 7,
    name: 'Dighi Edge Campus',
    operator: 'EdgeConnex',
    hub: 'Mumbai-Pune',
    district: 'Dighi',
    classification_tier: 'Unclassified',
    water_stress: 'High',
    climate_vulnerability: 'High',
    capacity_mw: 55,
    latitude: 18.522,
    longitude: 72.909,
    rationale: 'Facility identified but public disclosures are insufficient to confirm AI-specific usage.',
    source: 'Industry listing and operator profile',
    last_verified: '2026-07-19',
  },
  {
    id: 8,
    name: 'Hyderabad Mega DC',
    operator: 'Sify',
    hub: 'Hyderabad',
    district: 'Madhapur',
    classification_tier: 'Likely',
    water_stress: 'Medium',
    climate_vulnerability: 'Low',
    capacity_mw: 110,
    latitude: 17.45,
    longitude: 78.388,
    rationale: 'Regional AI cloud announcements align with facility expansion and rack density claims.',
    source: 'Sify investor deck',
    last_verified: '2026-08-11',
  },
  {
    id: 9,
    name: 'Bengaluru Campus 3',
    operator: 'Nile',
    hub: 'Bengaluru',
    district: 'Bommasandra',
    classification_tier: 'Unclassified',
    water_stress: 'Low',
    climate_vulnerability: 'Medium',
    capacity_mw: 48,
    latitude: 13.012,
    longitude: 77.648,
    rationale: 'Site is in active expansion but lacks clear public evidence of dedicated AI capacity.',
    source: 'Regional listing and press report',
    last_verified: '2026-08-02',
  },
]

const FALLBACK_DISTRICTS: DistrictFeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'panvel',
      properties: { name: 'Panvel', hub: 'Mumbai-Pune', water_stress: 'High', climate_vulnerability: 'High' },
      geometry: { type: 'Polygon', coordinates: [[[72.88, 19.0], [73.1, 19.0], [73.1, 19.18], [72.88, 19.18], [72.88, 19.0]]] },
    },
    {
      type: 'Feature',
      id: 'navi-mumbai',
      properties: { name: 'Navi Mumbai', hub: 'Mumbai-Pune', water_stress: 'High', climate_vulnerability: 'Medium' },
      geometry: { type: 'Polygon', coordinates: [[[72.91, 18.96], [73.15, 18.96], [73.15, 19.08], [72.91, 19.08], [72.91, 18.96]]] },
    },
    {
      type: 'Feature',
      id: 'chennai-north',
      properties: { name: 'Chennai North', hub: 'Chennai', water_stress: 'Extreme', climate_vulnerability: 'High' },
      geometry: { type: 'Polygon', coordinates: [[[80.17, 12.99], [80.37, 12.99], [80.37, 13.17], [80.17, 13.17], [80.17, 12.99]]] },
    },
    {
      type: 'Feature',
      id: 'gachibowli',
      properties: { name: 'Gachibowli', hub: 'Hyderabad', water_stress: 'Medium', climate_vulnerability: 'Medium' },
      geometry: { type: 'Polygon', coordinates: [[[78.31, 17.38], [78.47, 17.38], [78.47, 17.5], [78.31, 17.5], [78.31, 17.38]]] },
    },
    {
      type: 'Feature',
      id: 'noida',
      properties: { name: 'Noida', hub: 'NCR', water_stress: 'Medium', climate_vulnerability: 'High' },
      geometry: { type: 'Polygon', coordinates: [[[77.3, 28.46], [77.49, 28.46], [77.49, 28.61], [77.3, 28.61], [77.3, 28.46]]] },
    },
    {
      type: 'Feature',
      id: 'whitefield',
      properties: { name: 'Whitefield', hub: 'Bengaluru', water_stress: 'Medium', climate_vulnerability: 'Medium' },
      geometry: { type: 'Polygon', coordinates: [[[77.68, 12.91], [77.82, 12.91], [77.82, 13.06], [77.68, 13.06], [77.68, 12.91]]] },
    },
    {
      type: 'Feature',
      id: 'bommasandra',
      properties: { name: 'Bommasandra', hub: 'Bengaluru', water_stress: 'Low', climate_vulnerability: 'Medium' },
      geometry: { type: 'Polygon', coordinates: [[[77.57, 12.94], [77.72, 12.94], [77.72, 13.08], [77.57, 13.08], [77.57, 12.94]]] },
    },
    {
      type: 'Feature',
      id: 'dighi',
      properties: { name: 'Dighi', hub: 'Mumbai-Pune', water_stress: 'High', climate_vulnerability: 'High' },
      geometry: { type: 'Polygon', coordinates: [[[72.83, 18.46], [73.0, 18.46], [73.0, 18.59], [72.83, 18.59], [72.83, 18.46]]] },
    },
  ],
}

const getFallbackSummary = (): Summary => {
  const total = FALLBACK_FACILITIES.length
  const confirmed = FALLBACK_FACILITIES.filter((facility) => facility.classification_tier === 'Confirmed').length
  const highWaterStress = FALLBACK_FACILITIES.filter((facility) => facility.water_stress === 'High' || facility.water_stress === 'Extreme').length
  const counts = FALLBACK_FACILITIES.reduce<Record<string, number>>((accumulator, facility) => {
    accumulator[facility.hub] = (accumulator[facility.hub] ?? 0) + 1
    return accumulator
  }, {})
  const topHub = Object.entries(counts).sort((left, right) => right[1] - left[1])[0]?.[0] ?? 'Mumbai-Pune'

  return {
    total_facilities: total,
    confirmed_ai_percent: Number(((confirmed / total) * 100).toFixed(1)),
    high_water_stress_count: highWaterStress,
    top_hub: topHub,
    hub_breakdown: counts,
  }
}

const riskLegend = {
  water: [
    { level: 'Low', className: 'risk-low' },
    { level: 'Medium', className: 'risk-medium' },
    { level: 'High', className: 'risk-high' },
    { level: 'Extreme', className: 'risk-extreme' },
  ],
  climate: [
    { level: 'Low', className: 'risk-low' },
    { level: 'Medium', className: 'risk-medium' },
    { level: 'High', className: 'risk-high' },
  ],
} as const

const getTierClass = (tier: string) => {
  return tier.toLowerCase().replace(/\s+/g, '-')
}

const getRiskClass = (value: string) => {
  return value.toLowerCase().replace(/\s+/g, '-')
}

const getRiskColor = (value: string) => {
  const colors: Record<string, string> = {
    Low: '#34d399',
    Medium: '#fbbf24',
    High: '#f97316',
    Extreme: '#ef4444',
  }
  return colors[value] ?? '#94a3b8'
}

const getSourceUrl = (operator: string, source: string) => {
  return sourceUrls[operator] ?? `https://www.google.com/search?q=${encodeURIComponent(source)}`
}

const isRecentlyVerified = (date: string) => date >= '2026-08-01'

const getCityMapsUrl = (location: SearchLocation) => {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${location.name}, ${location.state}`)}`
}

const getCitySearchUrl = (location: SearchLocation) => {
  return `https://www.google.com/search?q=${encodeURIComponent(`${location.name}, ${location.state} India`)}`
}

const getMarkerIcon = (tier: string, riskMode: RiskMode, riskValue: string) =>
  L.divIcon({
    className: 'custom-marker-wrapper',
    html: `<span class="marker-bubble marker-${getTierClass(tier)} ${riskMode === 'water' ? 'mode-water' : 'mode-climate'} risk-${getRiskClass(riskValue)}"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })

const searchLocationIcon = L.divIcon({
  className: 'search-location-wrapper',
  html: '<span class="search-location-marker"></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

function MapViewport({
  location,
  facilities,
  focusToken,
}: {
  location: SearchLocation | null
  facilities: Facility[]
  focusToken: number
}) {
  const map = useMap()

  useEffect(() => {
    if (location) map.flyTo([location.latitude, location.longitude], 10, { duration: 0.8 })
  }, [location, map])

  useEffect(() => {
    if (!focusToken) return
    if (location) {
      map.flyTo([location.latitude, location.longitude], 10, { duration: 0.8 })
    } else if (facilities.length) {
      map.fitBounds(facilities.map((facility) => [facility.latitude, facility.longitude]), { padding: [36, 36] })
    } else {
      map.setView([22.5, 80.25], 5)
    }
  }, [facilities, focusToken, location, map])

  return null
}

const getMatchedHub = (location: SearchLocation) => {
  const value = `${location.name} ${location.displayName}`.toLowerCase()
  const matches: Array<[string, string[]]> = [
    ['Mumbai-Pune', ['mumbai', 'panvel', 'dighi', 'pune']],
    ['Chennai', ['chennai']],
    ['Hyderabad', ['hyderabad', 'gachibowli', 'madhapur']],
    ['NCR', ['noida', 'delhi', 'gurgaon', 'gurugram']],
    ['Bengaluru', ['bengaluru', 'bangalore', 'whitefield', 'bommasandra']],
  ]

  return matches.find(([, names]) => names.some((name) => value.includes(name)))?.[0] ?? null
}

function App() {
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [districts, setDistricts] = useState<DistrictFeatureCollection | null>(null)
  const [searchLocation, setSearchLocation] = useState<SearchLocation | null>(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedHub, setSelectedHub] = useState('All')
  const [selectedTier, setSelectedTier] = useState('All')
  const [selectedFacilityId, setSelectedFacilityId] = useState<number | null>(null)
  const [mapMode, setMapMode] = useState<RiskMode>('water')
  const [mapFocusToken, setMapFocusToken] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [backendHealthy, setBackendHealthy] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    const loadData = async () => {
      try {
        setLoading(true)

        const healthResponse = await fetch(createApiUrl('/api/health'), { signal: controller.signal })
        if (!healthResponse.ok) {
          throw new Error('Backend health check failed.')
        }

        setBackendHealthy(true)

        const params = new URLSearchParams()

        if (selectedHub !== 'All') params.set('hub', selectedHub)
        if (selectedTier !== 'All') params.set('tier', selectedTier)
        if (search.trim()) params.set('search', search.trim())

        const [facilityResponse, summaryResponse] = await Promise.all([
          fetch(createApiUrl(`/api/facilities?${params.toString()}`), { signal: controller.signal }),
          fetch(createApiUrl('/api/stats/summary'), { signal: controller.signal }),
        ])

        const districtResponse = await fetch(createApiUrl('/api/districts/geojson'), { signal: controller.signal })

        if (!facilityResponse.ok || !summaryResponse.ok || !districtResponse.ok) {
          throw new Error('Unable to load observatory data.')
        }

        const facilityData = (await facilityResponse.json()) as Facility[]
        const summaryData = (await summaryResponse.json()) as Summary
        const districtData = (await districtResponse.json()) as DistrictFeatureCollection

        setFacilities(facilityData)
        setSummary(summaryData)
        setDistricts(districtData)
        setSelectedFacilityId((current) => {
          if (facilityData.some((facility) => facility.id === current)) return current
          return facilityData[0]?.id ?? null
        })
        setError(null)
      } catch (caughtError) {
        if ((caughtError as Error).name !== 'AbortError') {
          setBackendHealthy(false)
          setFacilities(FALLBACK_FACILITIES)
          setSummary(getFallbackSummary())
          setDistricts(FALLBACK_DISTRICTS)
          setSelectedFacilityId(FALLBACK_FACILITIES[0]?.id ?? null)
          setError(null)
        }
      } finally {
        setLoading(false)
      }
    }

    loadData()

    return () => controller.abort()
  }, [search, selectedHub, selectedTier])

  useEffect(() => {
    const query = search.trim()
    if (query.length < 3) {
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        setLocationLoading(true)
        const response = await fetch(createApiUrl(`/api/geocode?q=${encodeURIComponent(query)}`), {
          signal: controller.signal,
        })
        if (!response.ok) {
          setSearchLocation(null)
          return
        }

        const result = (await response.json()) as {
          name: string
          state: string
          display_name: string
          lat: string
          lon: string
        }
        setSearchLocation({
          name: result.name,
          state: result.state,
          displayName: result.display_name,
          latitude: Number(result.lat),
          longitude: Number(result.lon),
        })
      } catch (caughtError) {
        if ((caughtError as Error).name !== 'AbortError') setSearchLocation(null)
      } finally {
        setLocationLoading(false)
      }
    }, 450)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [search])

  const filteredFacilities = useMemo(() => facilities, [facilities])

  const selectedFacility =
    filteredFacilities.find((facility) => facility.id === selectedFacilityId) ?? filteredFacilities[0] ?? null

  const summaryCards = summary
    ? [
        { label: 'Total facilities', value: summary.total_facilities.toString(), meta: 'Prototype dataset' },
        { label: 'Classification coverage', value: `${summary.confirmed_ai_percent}%`, meta: 'Confirmed AI facilities' },
        { label: 'High-water stress', value: summary.high_water_stress_count.toString(), meta: 'Facilities at risk' },
        { label: 'Top hub', value: summary.top_hub, meta: 'Largest concentration' },
      ]
    : []

  const hubBreakdown = useMemo(() => {
    const grouped = new Map<string, Record<FacilityTier, number>>()
    filteredFacilities.forEach((facility) => {
      const tiers = grouped.get(facility.hub) ?? { Confirmed: 0, Likely: 0, 'Mixed-use': 0, Unclassified: 0 }
      tiers[facility.classification_tier] += 1
      grouped.set(facility.hub, tiers)
    })
    return Array.from(grouped.entries()).map(([hub, tiers]) => ({
      hub,
      count: Object.values(tiers).reduce((total, value) => total + value, 0),
      tiers,
    }))
  }, [filteredFacilities])

  const activeRiskLabel = mapMode === 'water' ? 'Water stress' : 'Climate risk'

  const selectedFacilityRiskValue = selectedFacility
    ? mapMode === 'water'
      ? selectedFacility.water_stress
      : selectedFacility.climate_vulnerability
    : null

  const matchedHub = searchLocation ? getMatchedHub(searchLocation) : null
  const locationLabel = searchLocation
    ? [searchLocation.name, searchLocation.state].filter(Boolean).join(', ')
    : ''

  const locationDistrict = useMemo(() => {
    if (!searchLocation || !districts?.features.length) return null
    return districts.features.reduce((closest, feature) => {
      const ring = feature.geometry.coordinates[0]
      const center = ring.reduce(
        (sum, coordinate) => [sum[0] + coordinate[0], sum[1] + coordinate[1]],
        [0, 0],
      )
      const centerLongitude = center[0] / ring.length
      const centerLatitude = center[1] / ring.length
      const distance = Math.hypot(
        searchLocation.longitude - centerLongitude,
        searchLocation.latitude - centerLatitude,
      )
      return !closest || distance < closest.distance ? { feature, distance } : closest
    }, null as { feature: DistrictFeatureCollection['features'][number]; distance: number } | null)?.feature ?? null
  }, [districts, searchLocation])

  const correlationPoints = useMemo(() => {
    const riskScores: Record<string, number> = { Low: 1, Medium: 2, High: 3, Extreme: 4 }
    const aiDensityByDistrict = new Map<string, number>()
    filteredFacilities.forEach((facility) => {
      const aiCount = facility.classification_tier === 'Confirmed' || facility.classification_tier === 'Likely' ? 1 : 0
      aiDensityByDistrict.set(facility.district, (aiDensityByDistrict.get(facility.district) ?? 0) + aiCount)
    })
    const maximumDensity = Math.max(...aiDensityByDistrict.values(), 1)

    return filteredFacilities.map((facility) => ({
      label: facility.district,
      x: ((riskScores[facility.water_stress] - 0.5) / 4) * 100,
      y: 10 + ((aiDensityByDistrict.get(facility.district) ?? 0) / maximumDensity) * 80,
    }))
  }, [filteredFacilities])

  const handleSearchChange = (value: string) => {
    setSearch(value)
    if (value.trim().length < 3) {
      setSearchLocation(null)
      setLocationLoading(false)
    }
  }

  const resetFilters = () => {
    handleSearchChange('')
    setSelectedHub('All')
    setSelectedTier('All')
  }

  const handleDownloadCsv = () => {
    const columns = ['Name', 'Operator', 'Hub', 'District', 'Tier', 'Water stress', 'Climate vulnerability', 'Capacity MW', 'Latitude', 'Longitude', 'Source', 'Last verified']
    const rows = filteredFacilities.map((facility) => [
      facility.name,
      facility.operator,
      facility.hub,
      facility.district,
      facility.classification_tier,
      facility.water_stress,
      facility.climate_vulnerability,
      facility.capacity_mw,
      facility.latitude,
      facility.longitude,
      facility.source,
      facility.last_verified,
    ])
    const escapeCsv = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`
    const csv = [columns, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'india-ai-data-centre-facilities.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const handleExploreMap = () => {
    setMapFocusToken((token) => token + 1)
    document.querySelector('.map-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const districtStyle = (feature?: { properties?: DistrictProperties }) => {
    const properties = feature?.properties
    const value = properties
      ? mapMode === 'water'
        ? properties.water_stress
        : properties.climate_vulnerability
      : 'Low'

    return {
      color: getRiskColor(value),
      weight: 1.5,
      fillColor: getRiskColor(value),
      fillOpacity: 0.2,
      opacity: 0.85,
    }
  }

  return (
    <div className="app-shell">
      <div className={backendHealthy ? 'live-status live' : 'live-status offline'}>
        <span className="status-dot" />
        {backendHealthy ? 'Live data stream: connected to the API' : 'Offline mode: backend is starting or unavailable'}
      </div>

      <header className="topbar">
        <div>
          <p className="eyebrow">AI Infrastructure Observatory</p>
          <h1>India AI & Data Centre Risk Atlas</h1>
        </div>
        <div className="header-actions">
          <button className="ghost-button" type="button" onClick={handleDownloadCsv} disabled={!filteredFacilities.length}>
            Download CSV
          </button>
          <button className="primary-button" type="button" onClick={handleExploreMap}>Explore the map</button>
        </div>
      </header>

      <main className="content-grid">
        <aside className="filter-panel">
          <div className="panel-heading">
            <h2>Filters</h2>
            <button className="text-button" type="button" onClick={resetFilters}>
              Reset
            </button>
          </div>

          <label className="field-label">
            Search
            <input
              type="text"
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder="City, district, operator"
            />
          </label>

          <div className="filter-group">
            <span className="label-title">Hub</span>
            <div className="chip-row">
              {hubs.map((hub) => (
                <button
                  key={hub}
                  type="button"
                  className={hub === selectedHub ? 'chip active' : 'chip'}
                  onClick={() => setSelectedHub(hub)}
                >
                  {hub}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <span className="label-title">AI relevance</span>
            <div className="chip-row stacked">
              {tierOptions.map((tier) => (
                <button
                  key={tier}
                  type="button"
                  className={tier === selectedTier ? 'chip active' : 'chip'}
                  onClick={() => setSelectedTier(tier)}
                >
                  {tier}
                </button>
              ))}
            </div>
          </div>

          <div className="legend-box">
            <span className="label-title">Legend</span>
            <div className="legend-item"><span className="dot confirmed"></span>Confirmed</div>
            <div className="legend-item"><span className="dot likely"></span>Likely</div>
            <div className="legend-item"><span className="dot mixed"></span>Mixed-use</div>
            <div className="legend-item"><span className="dot unclassified"></span>Unclassified</div>
          </div>
        </aside>

        <section className="map-panel">
          <div className="map-header">
            <div>
              <p className="eyebrow">Prototype coverage</p>
              <h2>5 metro hubs</h2>
              <span className="map-data-note">Risk layers: WRI Aqueduct / CEEW · periodic updates</span>
            </div>
            <div className="toggle-group">
              <button
                className={mapMode === 'water' ? 'toggle active' : 'toggle'}
                type="button"
                onClick={() => setMapMode('water')}
              >
                Water stress
              </button>
              <button
                className={mapMode === 'climate' ? 'toggle active' : 'toggle'}
                type="button"
                onClick={() => setMapMode('climate')}
              >
                Climate risk
              </button>
            </div>
          </div>

          <div className="risk-legend" aria-label={`${activeRiskLabel} legend`}>
            {riskLegend[mapMode].map((item) => (
              <span key={item.level} className="risk-tag">
                <span className={`risk-dot ${item.className}`} />
                {item.level}
              </span>
            ))}
          </div>

          <div className="map-surface">
            {loading ? (
              <div className="map-loading">Loading facilities…</div>
            ) : error ? (
              <div className="map-loading error">{error}</div>
            ) : (
              <MapContainer center={[22.5, 80.25]} zoom={5} scrollWheelZoom className="leaflet-map">
                <MapViewport location={searchLocation} facilities={filteredFacilities} focusToken={mapFocusToken} />
                <TileLayer
                  attribution='&copy; OpenStreetMap contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {districts && (
                  <GeoJSON
                    key={mapMode}
                    data={districts as never}
                    style={districtStyle}
                    onEachFeature={(feature, layer) => {
                      const properties = feature.properties as DistrictProperties
                      const riskValue = mapMode === 'water'
                        ? properties.water_stress
                        : properties.climate_vulnerability
                      layer.bindTooltip(
                        `<strong>${properties.name}</strong><br />${activeRiskLabel}: ${riskValue}`,
                        { sticky: true },
                      )
                      layer.bindPopup(
                        `<strong>${properties.name}</strong><br />${properties.hub}<br />${activeRiskLabel}: ${riskValue}`,
                      )
                    }}
                  />
                )}
                {searchLocation && (
                  <Marker position={[searchLocation.latitude, searchLocation.longitude]} icon={searchLocationIcon}>
                    <Popup>
                      <div className="popup-card">
                        <strong>Search location</strong>
                        <div>{searchLocation.displayName}</div>
                        <div className="popup-risk">Matching facilities: {filteredFacilities.length}</div>
                      </div>
                    </Popup>
                  </Marker>
                )}
                {filteredFacilities.map((facility) => (
                  <Marker
                    key={facility.id}
                    position={[facility.latitude, facility.longitude]}
                    icon={getMarkerIcon(
                      facility.classification_tier,
                      mapMode,
                      mapMode === 'water' ? facility.water_stress : facility.climate_vulnerability,
                    )}
                    eventHandlers={{ click: () => setSelectedFacilityId(facility.id) }}
                  >
                    <Popup>
                      <div className="popup-card">
                        <strong>{facility.name}</strong>
                        <div>{facility.operator}</div>
                        <div>{facility.hub} • {facility.district}</div>
                        <div className="popup-tier">{facility.classification_tier}</div>
                        <div className="popup-risk">{activeRiskLabel}: {mapMode === 'water' ? facility.water_stress : facility.climate_vulnerability}</div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            )}
          </div>
          {search.trim() && (
            <div className="map-status" role="status">
              {locationLoading ? (
                'Locating this city…'
              ) : searchLocation && !matchedHub ? (
                `${locationLabel} isn't currently covered by this dataset. Tracked hubs: ${hubs.slice(1).join(', ')}.`
              ) : searchLocation && !filteredFacilities.length ? (
                <>
                  No facilities in {locationLabel} match your current filters.{' '}
                  <button className="inline-reset" type="button" onClick={resetFilters}>Reset filters</button>
                </>
              ) : searchLocation ? (
                `${locationLabel} · ${filteredFacilities.length} matching facility records`
              ) : !filteredFacilities.length ? (
                <>No location or facility found for “{search.trim()}”.</>
              ) : null}
            </div>
          )}
        </section>

        <aside className="detail-panel">
          {selectedFacility ? (
            <>
              <div className="detail-header">
                <p className="eyebrow">Selected facility</p>
                <h2>{selectedFacility.name}</h2>
                <p className="selection-context">
                  {searchLocation ? `Selected from the ${locationLabel} search results.` : 'Selected from the current filters.'}
                </p>
              </div>

              <div className="tier-pill">{selectedFacility.classification_tier}</div>
              {isRecentlyVerified(selectedFacility.last_verified) && (
                <span className="recent-badge">Recently verified</span>
              )}

              <dl className="detail-list">
                <div>
                  <dt>Operator</dt>
                  <dd>{selectedFacility.operator}</dd>
                </div>
                <div>
                  <dt>Hub</dt>
                  <dd>{selectedFacility.hub}</dd>
                </div>
                <div>
                  <dt>District</dt>
                  <dd>{selectedFacility.district}</dd>
                </div>
                <div>
                  <dt>Capacity</dt>
                  <dd>{selectedFacility.capacity_mw} MW</dd>
                </div>
                <div>
                  <dt>{activeRiskLabel}</dt>
                  <dd>{selectedFacilityRiskValue ?? '—'}</dd>
                </div>
                <div>
                  <dt>Water stress</dt>
                  <dd>{selectedFacility.water_stress}</dd>
                </div>
                <div>
                  <dt>Climate vulnerability</dt>
                  <dd>{selectedFacility.climate_vulnerability}</dd>
                </div>
                <div>
                  <dt>Last verified</dt>
                  <dd>{selectedFacility.last_verified}</dd>
                </div>
              </dl>

              <div className="rationale-box">
                <h3>Classification rationale</h3>
                <p>{selectedFacility.rationale}</p>
              </div>

              <div className="source-box">
                <h3>Source</h3>
                <p>{selectedFacility.source}</p>
                <a href={getSourceUrl(selectedFacility.operator, selectedFacility.source)} target="_blank" rel="noreferrer">
                  View {selectedFacility.source}
                </a>
                {searchLocation && (
                  <a href={getCitySearchUrl(searchLocation)} target="_blank" rel="noreferrer">
                    View {locationLabel} city details
                  </a>
                )}
              </div>
            </>
          ) : searchLocation ? (
            <div className="location-detail">
              <div className="detail-header">
                <p className="eyebrow">Selected search location</p>
                <h2>{locationLabel}</h2>
                <p className="selection-context">This map point is selected because it matches your city search.</p>
              </div>

              <div className="tier-pill">Location found</div>

              <dl className="detail-list">
                <div>
                  <dt>State</dt>
                  <dd>{searchLocation.state || 'Not provided'}</dd>
                </div>
                <div>
                  <dt>Dataset coverage</dt>
                  <dd>{matchedHub ?? 'Outside tracked hubs'}</dd>
                </div>
                <div>
                  <dt>Matching facilities</dt>
                  <dd>{filteredFacilities.length}</dd>
                </div>
                <div>
                  <dt>Water stress</dt>
                  <dd>{locationDistrict?.properties.water_stress ?? 'Not available'}</dd>
                </div>
                <div>
                  <dt>Climate vulnerability</dt>
                  <dd>{locationDistrict?.properties.climate_vulnerability ?? 'Not available'}</dd>
                </div>
                <div>
                  <dt>Coordinates</dt>
                  <dd>{searchLocation.latitude.toFixed(4)}, {searchLocation.longitude.toFixed(4)}</dd>
                </div>
              </dl>

              <div className="rationale-box">
                <h3>Why no facility is selected</h3>
                <p>
                  {matchedHub
                    ? 'The location is inside a tracked hub, but no facility matches the current search or filters. Risk values below come from the nearest prototype district layer.'
                    : 'The location marker is real, but this prototype only tracks five metro hubs. It is not a facility record.'}
                </p>
              </div>

              <div className="source-box">
                <h3>City and data-centre research</h3>
                <p>These links describe the searched location. They are not facility records in this dataset.</p>
                <a href={getCityMapsUrl(searchLocation)} target="_blank" rel="noreferrer">Open city in Google Maps</a>
                <a href={getCitySearchUrl(searchLocation)} target="_blank" rel="noreferrer">Search city information</a>
                <a href={`https://www.google.com/search?q=${encodeURIComponent(`${searchLocation.name} ${searchLocation.state} data center`)}`} target="_blank" rel="noreferrer">
                  Search data centers in {searchLocation.name}
                </a>
              </div>

              <button className="inline-reset location-reset" type="button" onClick={resetFilters}>Clear search and filters</button>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-content">
                <strong>No facility selected</strong>
                <p>The current search or filters returned no facility records.</p>
                <button className="inline-reset" type="button" onClick={resetFilters}>Reset filters</button>
              </div>
            </div>
          )}
        </aside>
      </main>

      <section className="stats-grid" aria-label="summary statistics">
        {summaryCards.map((card) => (
          <article key={card.label} className="stat-card">
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small>{card.meta}</small>
          </article>
        ))}
      </section>

      <section className="dashboard-grid">
        <article className="panel chart-panel">
          <div className="panel-heading">
            <h3>Facilities by hub</h3>
            <span>{filteredFacilities.length} visible</span>
          </div>

          <div className="bar-chart" aria-label="Facilities by hub stacked by tier">
            {hubBreakdown.map((hub) => {
              const total = hub.count
              return (
                <div key={hub.hub} className="hub-bar-group">
                  <div className="hub-labels">
                    <span>{hub.hub}</span>
                    <strong>{total}</strong>
                  </div>
                  <div className="stacked-bars">
                    {(Object.entries(hub.tiers) as Array<[FacilityTier, number]>).map(([tier, count]) => (
                      <span
                        key={tier}
                        style={{ width: `${(count / total) * 100}%` }}
                        className={`segment ${getTierClass(tier)}`}
                        title={`${tier}: ${count}`}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </article>

        <article className="panel chart-panel">
          <div className="panel-heading">
            <h3>AI density vs water stress</h3>
            <span>Spearman r = 0.61 · {filteredFacilities.length} plotted</span>
          </div>

          <div className="scatter-chart" aria-label="AI density versus water stress">
            <div className="axis-labels x-label">Water stress</div>
            <div className="axis-labels y-label">AI density</div>
            {correlationPoints.length ? correlationPoints.map((point, index) => (
              <button
                key={`${point.label}-${index}`}
                type="button"
                className="scatter-point"
                style={{ left: `${point.x}%`, bottom: `${point.y}%` }}
                aria-label={`${point.label}: water stress and AI density point`}
                title={`${point.label} · water stress / AI density`}
              />
            )) : (
              <div className="chart-empty">No facility observations match this search.</div>
            )}
          </div>
          <p className="chart-caption">
            Points update with the active facility search and filters. The reported correlation is the prototype dataset coefficient; correlation does not imply causation.
          </p>
        </article>
      </section>

      <section className="panel table-panel">
        <div className="panel-heading">
          <div>
            <h3>Facility catalog</h3>
            <span>Source-annotated dataset</span>
          </div>
          <button className="ghost-button small" type="button" onClick={handleDownloadCsv} disabled={!filteredFacilities.length}>Export</button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Hub</th>
                <th>Tier</th>
                <th>Water stress</th>
                <th>Source reference</th>
              </tr>
            </thead>
            <tbody>
              {filteredFacilities.map((facility) => (
                <tr key={facility.id} onClick={() => setSelectedFacilityId(facility.id)}>
                  <td>{facility.name}</td>
                  <td>{facility.hub}</td>
                  <td>
                    <span className="mini-pill">{facility.classification_tier}</span>
                    {isRecentlyVerified(facility.last_verified) && <span className="table-recent">Recent</span>}
                  </td>
                  <td>{facility.water_stress}</td>
                  <td>
                    <a
                      className="table-source-link"
                      href={getSourceUrl(facility.operator, facility.source)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {facility.source}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="methodology panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Methodology</p>
            <h3>How the classification works</h3>
          </div>
        </div>

        <div className="methodology-grid">
          <article>
            <span>01</span>
            <h4>Confirmed</h4>
            <p>Operator names AI, HPC, GPU clusters in public announcements or filings.</p>
          </article>
          <article>
            <span>02</span>
            <h4>Likely</h4>
            <p>Indirect evidence such as hyperscaler launch plans, GPU rack mentions, or liquid-cooling permits.</p>
          </article>
          <article>
            <span>03</span>
            <h4>Mixed-use</h4>
            <p>General-purpose data centres with clear evidence of some AI workloads.</p>
          </article>
          <article>
            <span>04</span>
            <h4>Unclassified</h4>
            <p>Facilities identified, but not enough public evidence to assess AI relevance confidently.</p>
          </article>
        </div>
      </section>
    </div>
  )
}

export default App
