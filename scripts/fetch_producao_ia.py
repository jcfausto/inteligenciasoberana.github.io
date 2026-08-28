#!/usr/bin/env python3
"""Snapshot Brazilian AI works from OpenAlex for the observatory page.

Writes:
  _data/producao-ia.yml
  assets/data/producao-ia/{year}.json
"""

from __future__ import annotations

import json
import re
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
YEAR_FROM = 2015
YEAR_TO = date.today().year
MAILTO = "hello@inteligenciasoberana.com.br"
USER_AGENT = (
    "inteligenciasoberana-producao-ia "
    "(https://inteligenciasoberana.com.br; mailto:%s)" % MAILTO
)
FILTER = (
    "authorships.countries:br,"
    "primary_topic.subfield.id:1702|1707,"
    f"from_publication_date:{YEAR_FROM}-01-01,"
    f"to_publication_date:{YEAR_TO}-12-31,"
    "is_paratext:false,"
    "type:article|review|preprint"
)
SELECT = "id,doi,title,publication_year,cited_by_count,type,primary_topic,authorships"
PER_PAGE = 200
KEEP_TYPES = {"article", "review", "preprint"}
MONTHS_PT = (
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
)
MONTHS_EN = (
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
)
REGION_TO_UF = {
    "acre": "AC",
    "alagoas": "AL",
    "amapa": "AP",
    "amapá": "AP",
    "amazonas": "AM",
    "bahia": "BA",
    "ceara": "CE",
    "ceará": "CE",
    "distrito federal": "DF",
    "espirito santo": "ES",
    "espírito santo": "ES",
    "goias": "GO",
    "goiás": "GO",
    "maranhao": "MA",
    "maranhão": "MA",
    "mato grosso": "MT",
    "mato grosso do sul": "MS",
    "minas gerais": "MG",
    "para": "PA",
    "pará": "PA",
    "paraiba": "PB",
    "paraíba": "PB",
    "parana": "PR",
    "paraná": "PR",
    "pernambuco": "PE",
    "piaui": "PI",
    "piauí": "PI",
    "rio de janeiro": "RJ",
    "rio grande do norte": "RN",
    "rio grande do sul": "RS",
    "rondonia": "RO",
    "rondônia": "RO",
    "roraima": "RR",
    "santa catarina": "SC",
    "sao paulo": "SP",
    "são paulo": "SP",
    "sergipe": "SE",
    "tocantins": "TO",
}
EXTRA_SHORT = {
    "university of sao paulo": "USP",
    "universidade de sao paulo": "USP",
    "university of campinas": "UNICAMP",
    "state university of campinas": "UNICAMP",
    "universidade estadual de campinas": "UNICAMP",
    "sao paulo state university": "UNESP",
    "universidade estadual paulista": "UNESP",
    "rio de janeiro state university": "UERJ",
    "universidade do estado do rio de janeiro": "UERJ",
    "pontifical catholic university of rio de janeiro": "PUC-Rio",
    "pontificia universidade catolica do rio de janeiro": "PUC-Rio",
    "pontifical catholic university of sao paulo": "PUC-SP",
    "pontificia universidade catolica de sao paulo": "PUC-SP",
    "pontificia universidade catolica do rio grande do sul": "PUCRS",
    "pontifical catholic university of rio grande do sul": "PUCRS",
    "pontificia universidade catolica de minas gerais": "PUC-Minas",
    "pontifical catholic university of minas gerais": "PUC-Minas",
    "pontificia universidade catolica do parana": "PUCPR",
    "pontifical catholic university of parana": "PUCPR",
    "instituto tecnologico de aeronautica": "ITA",
    "aeronautics institute of technology": "ITA",
    "instituto militar de engenharia": "IME",
    "military institute of engineering": "IME",
    "instituto nacional de pesquisas espaciais": "INPE",
    "national institute for space research": "INPE",
    "fundacao oswaldo cruz": "Fiocruz",
    "oswaldo cruz foundation": "Fiocruz",
    "laboratorio nacional de computacao cientifica": "LNCC",
    "national laboratory for scientific computing": "LNCC",
    "instituto de matematica pura e aplicada": "IMPA",
    "institute for pure and applied mathematics": "IMPA",
    "fundacao getulio vargas": "FGV",
    "getulio vargas foundation": "FGV",
    "universidade estadual de londrina": "UEL",
    "universidade estadual de maringa": "UEM",
    "universidade do estado de santa catarina": "UDESC",
    "universidade estadual de ponta grossa": "UEPG",
    "universidade presbiteriana mackenzie": "Mackenzie",
    "mackenzie presbyterian university": "Mackenzie",
    "centro federal de educacao tecnologica de minas gerais": "CEFET-MG",
    "centro federal de educacao tecnologica celso suckow da fonseca": "CEFET-RJ",
    "instituto nacional de telecomunicacoes": "Inatel",
    "universidade do vale do rio dos sinos": "Unisinos",
    "universidade de caxias do sul": "UCS",
    "universidade de fortaleza": "Unifor",
    "universidade de brasilia": "UnB",
    "university of brasilia": "UnB",
}


def fold(text: str) -> str:
    if not text:
        return ""
    nfkd = unicodedata.normalize("NFKD", text)
    stripped = "".join(ch for ch in nfkd if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", stripped).strip().lower()


def yaml_quote(value: str) -> str:
    if value is None:
        return '""'
    text = str(value)
    if text == "":
        return '""'
    if re.search(r"[:#{}[\],&*?|!<>=%@`'\"]|^[-?]|^\s|\s$|\n", text):
        return json.dumps(text, ensure_ascii=False)
    return text


def short_id(url_or_id: str) -> str:
    if not url_or_id:
        return ""
    return url_or_id.rstrip("/").rsplit("/", 1)[-1]


def doi_compact(doi: str | None) -> str | None:
    if not doi:
        return None
    return re.sub(r"^https?://(dx\.)?doi\.org/", "", doi, flags=re.I)


def load_federal() -> list[dict]:
    path = ROOT / "_data" / "universidades.yml"
    items = []
    current = None
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("  - acronym:"):
            if current:
                items.append(current)
            current = {"acronym": line.split(":", 1)[1].strip()}
        elif current is not None:
            for key in ("slug", "name_pt", "name_en", "uf", "city"):
                prefix = f"    {key}:"
                if line.startswith(prefix):
                    current[key] = line.split(":", 1)[1].strip()
    if current:
        items.append(current)
    items.sort(key=lambda row: -len(row.get("name_pt") or ""))
    return items


def match_federal(name: str, federal: list[dict]) -> dict | None:
    folded = fold(name)
    if not folded:
        return None
    for row in federal:
        name_pt = fold(row.get("name_pt") or "")
        name_en = fold(row.get("name_en") or "")
        acronym = row["acronym"]
        if name_pt and name_pt in folded:
            return row
        if name_en and name_en in folded:
            return row
        if re.search(rf"(^|[^a-z0-9]){re.escape(fold(acronym))}([^a-z0-9]|$)", folded):
            return row
    return None


def match_extra(name: str) -> str | None:
    folded = fold(name)
    if folded in EXTRA_SHORT:
        return EXTRA_SHORT[folded]
    for key, short in sorted(EXTRA_SHORT.items(), key=lambda kv: -len(kv[0])):
        if key in folded:
            return short
    return None


def acronym_in_parens(name: str) -> str | None:
    match = re.search(r"\(([A-Za-z0-9][A-Za-z0-9.\-]{1,14})\)$", (name or "").strip())
    if not match:
        return None
    token = match.group(1)
    letters = re.sub(r"[^A-Za-z]", "", token)
    if len(letters) < 2:
        return None
    return token


def assign_short(name: str, federal: list[dict]) -> tuple[str, dict | None]:
    fed = match_federal(name, federal)
    if fed:
        return fed["acronym"], fed
    extra = match_extra(name)
    if extra:
        return extra, None
    paren = acronym_in_parens(name)
    if paren:
        return paren, None
    return name, None


def is_acronym(short: str) -> bool:
    compact = re.sub(r"[^A-Za-z0-9]", "", short or "")
    return 2 <= len(compact) <= 12 and compact.upper() == compact or short in {
        "UnB",
        "UFSCar",
        "Fiocruz",
        "Mackenzie",
        "Unisinos",
        "Unifor",
        "Inatel",
        "PUC-Rio",
        "PUC-SP",
        "PUC-Minas",
        "PUCRS",
        "PUCPR",
    }


def merge_key(short: str, inst_id: str) -> str:
    if is_acronym(short):
        return "short:" + fold(short)
    return "id:" + inst_id


def uf_from_geo(geo: dict | None) -> str | None:
    if not geo:
        return None
    region = fold(geo.get("region") or "")
    if region in REGION_TO_UF:
        return REGION_TO_UF[region]
    city = fold(geo.get("city") or "")
    if city in REGION_TO_UF:
        return REGION_TO_UF[city]
    return None


def openalex_get(url: str, retries: int = 6) -> dict:
    parsed = urllib.parse.urlparse(url)
    query = urllib.parse.parse_qs(parsed.query)
    query.setdefault("mailto", [MAILTO])
    url = urllib.parse.urlunparse(
        parsed._replace(query=urllib.parse.urlencode(query, doseq=True))
    )
    last_error = None
    delay = 1.0
    for _ in range(retries):
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=90) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as err:
            last_error = err
            if err.code in {429, 500, 502, 503, 504}:
                time.sleep(delay)
                delay = min(delay * 2, 30)
                continue
            raise
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as err:
            last_error = err
            time.sleep(delay)
            delay = min(delay * 2, 30)
    raise RuntimeError(f"OpenAlex request failed: {url}") from last_error


def fetch_works() -> list[dict]:
    params = {
        "filter": FILTER,
        "per_page": str(PER_PAGE),
        "select": SELECT,
        "cursor": "*",
        "sort": "publication_year:asc",
    }
    url = "https://api.openalex.org/works?" + urllib.parse.urlencode(params)
    works = []
    page = 0
    while url:
        payload = openalex_get(url)
        page += 1
        batch = payload.get("results") or []
        works.extend(batch)
        meta = payload.get("meta") or {}
        total = meta.get("count")
        print(f"  works page {page}: {len(works)}" + (f"/{total}" if total else ""), flush=True)
        cursor = (payload.get("meta") or {}).get("next_cursor")
        if not cursor or not batch:
            break
        params["cursor"] = cursor
        url = "https://api.openalex.org/works?" + urllib.parse.urlencode(params)
        time.sleep(0.12)
    return works


def brazilian_institutions(work: dict) -> list[dict]:
    seen = {}
    for authorship in work.get("authorships") or []:
        for inst in authorship.get("institutions") or []:
            if (inst.get("country_code") or "").upper() != "BR":
                continue
            inst_id = short_id(inst.get("id") or "")
            if not inst_id or inst_id in seen:
                continue
            seen[inst_id] = {
                "id": inst_id,
                "name": inst.get("display_name") or inst_id,
                "type": inst.get("type") or "",
                "ror": inst.get("ror") or "",
            }
    return list(seen.values())


def fetch_institution_meta(ids: list[str]) -> dict[str, dict]:
    meta = {}
    chunk_size = 50
    for i in range(0, len(ids), chunk_size):
        chunk = ids[i : i + chunk_size]
        filt = "openalex:" + "|".join(chunk)
        url = (
            "https://api.openalex.org/institutions?"
            + urllib.parse.urlencode({"filter": filt, "per_page": chunk_size})
        )
        payload = openalex_get(url)
        for inst in payload.get("results") or []:
            inst_id = short_id(inst.get("id") or "")
            geo = inst.get("geo") or {}
            meta[inst_id] = {
                "name": inst.get("display_name") or inst_id,
                "type": inst.get("type") or "",
                "city": geo.get("city") or "",
                "uf": uf_from_geo(geo) or "",
                "ror": (inst.get("ids") or {}).get("ror") or inst.get("ror") or "",
            }
        print(f"  institutions {min(i + chunk_size, len(ids))}/{len(ids)}", flush=True)
        time.sleep(0.12)
    return meta


def format_dates(today: date) -> tuple[str, str, str]:
    iso = today.isoformat()
    pt = f"{today.day} de {MONTHS_PT[today.month - 1]} de {today.year}"
    en = f"{today.day} {MONTHS_EN[today.month - 1]} {today.year}"
    return iso, pt, en


def write_yaml(path: Path, data: dict) -> None:
    years = data["years"]
    lines = [
        "# Brazilian AI scientific production snapshot from OpenAlex.",
        "# Unique-work national totals; institution table uses full counting.",
        f"# Filter: {FILTER}",
        "source:",
        "  name: OpenAlex",
        "  url: https://openalex.org",
        f"  query_url: {yaml_quote('https://api.openalex.org/works?filter=' + FILTER)}",
        f"  retrieved: {data['source']['retrieved']}",
        f"  retrieved_pt: {yaml_quote(data['source']['retrieved_pt'])}",
        f"  retrieved_en: {yaml_quote(data['source']['retrieved_en'])}",
        f"  filter: {yaml_quote(FILTER)}",
        "  subfields:",
        "    - id: 1702",
        '      name: "Artificial Intelligence"',
        "    - id: 1707",
        '      name: "Computer Vision and Pattern Recognition"',
        f"year_from: {data['year_from']}",
        f"year_to: {data['year_to']}",
        f"current_year_incomplete: {str(data['current_year_incomplete']).lower()}",
        "totals:",
        f"  works: {data['totals']['works']}",
        f"  institutions: {data['totals']['institutions']}",
        "years:",
    ]
    for row in years:
        lines.append(f"  - year: {row['year']}")
        lines.append(f"    works: {row['works']}")
    lines.append("institutions:")
    for inst in data["institutions"]:
        lines.append(f"  - id: {inst['id']}")
        lines.append(f"    name: {yaml_quote(inst['name'])}")
        lines.append(f"    short: {yaml_quote(inst['short'])}")
        lines.append(f"    type: {yaml_quote(inst['type'])}")
        lines.append(f"    city: {yaml_quote(inst['city'])}")
        lines.append(f"    uf: {yaml_quote(inst['uf'])}")
        if inst.get("federal_slug"):
            lines.append(f"    federal_slug: {inst['federal_slug']}")
        else:
            lines.append("    federal_slug:")
        lines.append(f"    works_total: {inst['works_total']}")
        lines.append("    counts: [" + ", ".join(str(n) for n in inst["counts"]) + "]")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    federal = load_federal()
    years = list(range(YEAR_FROM, YEAR_TO + 1))
    year_index = {year: i for i, year in enumerate(years)}

    print("Fetching works from OpenAlex…", flush=True)
    works_raw = fetch_works()

    year_works: dict[int, list[dict]] = defaultdict(list)
    inst_seen: dict[str, dict] = {}
    inst_ids = set()

    for work in works_raw:
        work_type = work.get("type") or ""
        if work_type and work_type not in KEEP_TYPES:
            continue
        year = work.get("publication_year")
        if not isinstance(year, int) or year not in year_index:
            continue
        insts = brazilian_institutions(work)
        for inst in insts:
            inst_ids.add(inst["id"])
            inst_seen.setdefault(inst["id"], inst)
        topic = ((work.get("primary_topic") or {}).get("display_name")) or ""
        year_works[year].append(
            {
                "id": short_id(work.get("id") or ""),
                "title": work.get("title") or "(untitled)",
                "year": year,
                "doi": doi_compact(work.get("doi")),
                "cited": int(work.get("cited_by_count") or 0),
                "topic": topic,
                "inst_ids": [inst["id"] for inst in insts],
            }
        )

    print(f"Fetching metadata for {len(inst_ids)} institutions…", flush=True)
    inst_meta = fetch_institution_meta(sorted(inst_ids))

    merged: dict[str, dict] = {}
    id_to_key: dict[str, str] = {}
    for inst_id, base in inst_seen.items():
        info = inst_meta.get(inst_id, {})
        name = info.get("name") or base["name"]
        short, fed = assign_short(name, federal)
        key = merge_key(short, inst_id)
        id_to_key[inst_id] = key
        bucket = merged.setdefault(
            key,
            {
                "id": inst_id,
                "name": name,
                "short": short,
                "type": info.get("type") or base.get("type") or "",
                "city": info.get("city") or "",
                "uf": (fed or {}).get("uf") or info.get("uf") or "",
                "federal_slug": (fed or {}).get("slug") or "",
                "counts": [0] * len(years),
                "works_total": 0,
            },
        )
        if fed and not bucket["federal_slug"]:
            bucket["federal_slug"] = fed.get("slug") or ""
            bucket["uf"] = fed.get("uf") or bucket["uf"]
            bucket["short"] = fed["acronym"]
        if len(name) < len(bucket["name"]):
            bucket["name"] = name
        if is_acronym(short) and not is_acronym(bucket["short"]):
            bucket["short"] = short

    credited_pairs = set()
    for year, papers in year_works.items():
        yi = year_index[year]
        for paper in papers:
            shorts = []
            seen_keys = set()
            for inst_id in paper["inst_ids"]:
                key = id_to_key.get(inst_id)
                if not key or key in seen_keys:
                    continue
                seen_keys.add(key)
                bucket = merged[key]
                shorts.append(bucket["short"])
                pair = (key, paper["id"])
                if pair not in credited_pairs:
                    credited_pairs.add(pair)
                    bucket["counts"][yi] += 1
                    bucket["works_total"] += 1
            paper["inst"] = shorts
            del paper["inst_ids"]

    institutions = sorted(
        merged.values(),
        key=lambda row: (-row["works_total"], fold(row["short"])),
    )
    year_rows = [{"year": year, "works": len(year_works[year])} for year in years]
    today = date.today()
    iso, pt, en = format_dates(today)

    data = {
        "source": {
            "retrieved": iso,
            "retrieved_pt": pt,
            "retrieved_en": en,
        },
        "year_from": YEAR_FROM,
        "year_to": YEAR_TO,
        "current_year_incomplete": True,
        "totals": {
            "works": sum(row["works"] for row in year_rows),
            "institutions": len(institutions),
        },
        "years": year_rows,
        "institutions": institutions,
    }

    yaml_path = ROOT / "_data" / "producao-ia.yml"
    json_dir = ROOT / "assets" / "data" / "producao-ia"
    json_dir.mkdir(parents=True, exist_ok=True)
    write_yaml(yaml_path, data)

    for old in json_dir.glob("*.json"):
        old.unlink()
    for year in years:
        papers = sorted(
            year_works[year],
            key=lambda row: (-row["cited"], fold(row["title"])),
        )
        (json_dir / f"{year}.json").write_text(
            json.dumps(papers, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )

    print(
        f"Wrote {yaml_path.relative_to(ROOT)} "
        f"({data['totals']['works']} works, {data['totals']['institutions']} institutions)",
        flush=True,
    )


if __name__ == "__main__":
    main()
