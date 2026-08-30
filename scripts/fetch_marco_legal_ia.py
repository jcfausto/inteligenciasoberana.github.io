#!/usr/bin/env python3
"""Refresh the PL 2338/2023 radar snapshot from the Câmara open-data API.

Writes:
  _data/marco-legal-ia.yml

Preserves curated fields (points, officers, vote window, timeline prose,
invitee sectors). Adds new hearings/invitees parsed from event descriptions.
Does not commit.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

try:
    import yaml
except ImportError as exc:  # pragma: no cover
    raise SystemExit("PyYAML is required: pip install pyyaml") from exc

ROOT = Path(__file__).resolve().parents[1]
YAML_PATH = ROOT / "_data" / "marco-legal-ia.yml"
CAMARA_ID = 2487262
ORGAO_ID = 539776
INTRODUCED = "2023-05-03"  # Senate docket; not in the Câmara API
API_BASE = "https://dadosabertos.camara.leg.br/api/v2"
MAILTO = "hello@inteligenciasoberana.com.br"
USER_AGENT = (
    "inteligenciasoberana-marco-legal "
    "(https://inteligenciasoberana.com.br; mailto:%s)" % MAILTO
)
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

URLS = {
    "camara": (
        "https://www.camara.leg.br/proposicoesWeb/"
        "fichadetramitacao?idProposicao=2487262"
    ),
    "api": f"{API_BASE}/proposicoes/{CAMARA_ID}",
    "comissao": (
        "https://www2.camara.leg.br/atividade-legislativa/comissoes/"
        "comissoes-temporarias/especiais/57a-legislatura/"
        "comissao-especial-sobre-inteligencia-artificial-pl-2338-23"
    ),
    "inteiro_teor": (
        "https://www.camara.leg.br/proposicoesWeb/"
        "prop_mostrarintegra?codteor=2868197"
    ),
}

REGULATOR_HINTS = (
    "ANPD",
    "ANATEL",
    "ANS",
    "CADE",
    "BANCO CENTRAL",
    "CGI.BR",
    "CONSELHO NACIONAL DE EDUCACAO",
    "CONSELHO NACIONAL DE EDUCAÇÃO",
)
GOVERNMENT_HINTS = (
    "MINISTÉRIO",
    "MINISTERIO",
    "SECRETÁR",
    "SECRETAR",
    "CASA DA MOEDA",
    "SERPRO",
    "MINISTÉRIO PÚBLICO",
    "MINISTERIO PUBLICO",
    "PROCURADOR",
    "PREFEITURA",
    "BNDES",
    "MCTI",
    "SECOM",
    "PRESIDÊNCIA",
    "PRESIDENCIA",
    "UNICEF",
    "DEFENSOR",
    "MEC",
    "MINC",
)
ACADEMIA_HINTS = (
    "UNIVERSIDADE",
    "PROFESSOR",
    "INSPER",
    "UFG",
    "USP",
    "UFMG",
    "UFPE",
    "LNCC",
    "PESQUISADOR",
    "PUC-SP",
    "PUC SP",
    "IDP",
    "CIAAM",
    "CEIA",
    "PARQTEC",
)
COMPANY_HINTS = (
    "MICROSOFT",
    "OPENAI",
    "AWS",
    "AMAZON",
    "GOOGLE",
    "META",
    "IBM",
    "SALESFORCE",
    "TOTVS",
    "ABES",
    "BRASSCOM",
    "FEBRABAN",
    "CNI",
    "CNC",
    "ASSESPRO",
    "SCALA",
    "WIDELABS",
    "DHARMA",
    "STARTUP",
    "FECOMERCIO",
    "FECOMÉRCIO",
    "CNA",
    "CNSEG",
    "CONEXIS",
    "ABRINT",
    "SENAC",
    "SESI",
    "FENEP",
    "MBC",
    "MOVIMENTO BRASIL COMPETITIVO",
    "ABRIA",
    "SNEL",
    "ABRELIVROS",
    "PRÓ-MÚSICA",
    "PRO-MUSICA",
    "ABRAMUS",
    "ABDR",
    "EGEDA",
    "FUNDAÇÃO ITAÚ",
    "FUNDACAO ITAU",
    "ALAI",
)

HEARING_THEMES = {
    "76626": {
        "pt": "Conceitos de IA e modelos de regulação",
        "en": "AI concepts and regulatory models",
    },
    "76860": {
        "pt": "Proteção de direitos fundamentais e novas tecnologias",
        "en": "Fundamental-rights protection and new technologies",
    },
    "76970": {
        "pt": "Proteção de direitos fundamentais e novas tecnologias",
        "en": "Fundamental-rights protection and new technologies",
    },
    "77186": {
        "pt": "Estrutura de governança de IA",
        "en": "AI governance structure",
    },
    "77344": {
        "pt": "Estrutura de governança de IA",
        "en": "AI governance structure",
    },
    "77200": {
        "pt": "Ecossistema e competitividade nacionais",
        "en": "National ecosystem and competitiveness",
    },
    "77331": {
        "pt": "Infraestrutura para IA, fomento e sandbox regulatório",
        "en": "AI infrastructure, funding, and regulatory sandbox",
    },
    "77599": {
        "pt": "Infraestrutura para IA, fomento e sandbox regulatório",
        "en": "AI infrastructure, funding, and regulatory sandbox",
    },
    "78768": {
        "pt": "IA generativa e direitos autorais",
        "en": "Generative AI and copyright",
    },
    "78849": {
        "pt": "Deep nudes e crimes contra mulheres por IA",
        "en": "Deep nudes and AI-enabled crimes against women",
    },
    "78885": {
        "pt": "IA generativa e direitos autorais",
        "en": "Generative AI and copyright",
    },
    "79054": {
        "pt": "IA generativa, direitos autorais e integridade da informação",
        "en": "Generative AI, copyright, and information integrity",
    },
    "79189": {
        "pt": "Sistemas de IA, serviço público e infraestruturas críticas",
        "en": "AI systems, the public sector, and critical infrastructure",
    },
    "79191": {
        "pt": "Sistemas de IA, serviço público e infraestruturas críticas",
        "en": "AI systems, the public sector, and critical infrastructure",
    },
    "79640": {
        "pt": "IA na educação: riscos, inovações e o futuro da aprendizagem",
        "en": "AI in education: risks, innovations, and the future of learning",
    },
    "79688": {
        "pt": "IA na segurança pública e responsabilidades federativas",
        "en": "AI in public security and federal responsibilities",
    },
    "79832": {
        "pt": "Tecnologia de IA na educação básica",
        "en": "AI technology in basic education",
    },
}

TIMELINE_SEED = [
    {
        "id": "juristas",
        "date": "2022",
        "date_label": {"pt": "2022–2023", "en": "2022–2023"},
        "house": "pre",
        "current": False,
        "title": {
            "pt": "Comissão de Juristas",
            "en": "Commission of Jurists",
        },
        "lead": {
            "pt": "O Senado instala uma comissão de juristas, sob Ricardo Villas Bôas Cueva e Laura Schertel Mendes, para redigir a base do futuro marco.",
            "en": "The Senate installs a commission of jurists, chaired by Ricardo Villas Bôas Cueva and Laura Schertel Mendes, to draft the future framework.",
        },
    },
    {
        "id": "apresentacao",
        "date": "2023",
        "date_label": {"pt": "2023", "en": "2023"},
        "house": "senado",
        "current": False,
        "title": {
            "pt": "PL 2338/2023 no Senado",
            "en": "PL 2338/2023 in the Senate",
        },
        "lead": {
            "pt": "O senador Rodrigo Pacheco apresenta o projeto que dispõe sobre o desenvolvimento, o fomento e o uso ético da inteligência artificial.",
            "en": "Senator Rodrigo Pacheco introduces the bill on the development, promotion, and ethical use of artificial intelligence.",
        },
    },
    {
        "id": "ctia",
        "date": "2024",
        "date_label": {"pt": "2024", "en": "2024"},
        "house": "senado",
        "current": False,
        "title": {
            "pt": "CTIA e relatoria de Eduardo Gomes",
            "en": "CTIA and Eduardo Gomes’s report",
        },
        "lead": {
            "pt": "A Comissão Temporária Interna de Inteligência Artificial debate o texto sob relatoria do senador Eduardo Gomes e avalia centenas de emendas.",
            "en": "The Senate’s temporary AI committee debates the text under Senator Eduardo Gomes and reviews hundreds of amendments.",
        },
    },
    {
        "id": "senado-plenario",
        "date": "2024-12-10",
        "date_label": {"pt": "10 de dezembro de 2024", "en": "10 December 2024"},
        "house": "senado",
        "current": False,
        "title": {
            "pt": "Aprovação no Plenário do Senado",
            "en": "Senate floor approval",
        },
        "lead": {
            "pt": "O Plenário do Senado aprova o substitutivo. O texto segue à Câmara para revisão.",
            "en": "The Senate floor approves the substitute text. The bill goes to the Chamber of Deputies for review.",
        },
    },
    {
        "id": "camara-chegada",
        "date": "2025-03-17",
        "date_label": {"pt": "17 de março de 2025", "en": "17 March 2025"},
        "house": "camara",
        "current": False,
        "title": {
            "pt": "Chegada à Câmara",
            "en": "Arrival in the Chamber",
        },
        "lead": {
            "pt": "A Câmara recebe o Ofício SF nº 235/2025 e apresenta o PL 2338/2023 para revisão, nos termos do art. 65 da Constituição.",
            "en": "The Chamber receives Senate Official Letter No. 235/2025 and dockets PL 2338/2023 for review under Constitution art. 65.",
        },
    },
    {
        "id": "comissao",
        "date": "2025-04-29",
        "date_label": {"pt": "29 de abril de 2025", "en": "29 April 2025"},
        "house": "camara",
        "current": False,
        "title": {
            "pt": "Comissão Especial",
            "en": "Special Committee",
        },
        "lead": {
            "pt": "Ato da Presidência constitui a Comissão Especial destinada a proferir parecer ao PL 2338/2023.",
            "en": "A presidential act constitutes the Special Committee charged with reporting on PL 2338/2023.",
        },
    },
    {
        "id": "instalacao",
        "date": "2025-05-20",
        "date_label": {"pt": "20 de maio de 2025", "en": "20 May 2025"},
        "house": "camara",
        "current": False,
        "title": {
            "pt": "Instalação, presidência e relatoria",
            "en": "Installation, chair, and rapporteur",
        },
        "lead": {
            "pt": "A comissão se instala. Luísa Canziani assume a presidência; Aguinaldo Ribeiro é designado relator.",
            "en": "The committee is installed. Luísa Canziani takes the chair; Aguinaldo Ribeiro is named rapporteur.",
        },
    },
    {
        "id": "audiencias",
        "date": "2025-06",
        "date_label": {"pt": "junho–outubro de 2025", "en": "June–October 2025"},
        "house": "camara",
        "current": False,
        "title": {
            "pt": "Audiências públicas",
            "en": "Public hearings",
        },
        "lead": {
            "pt": "A comissão ouve governo, reguladores, academia, empresas e sociedade civil em dezenas de sessões formais.",
            "en": "The committee hears government, regulators, academia, companies, and civil society across dozens of formal sessions.",
        },
    },
    {
        "id": "parecer",
        "date": "2026-06-17",
        "date_label": {"pt": "desde 2025", "en": "since 2025"},
        "house": "camara",
        "current": True,
        "title": {
            "pt": "Aguardando parecer do relator",
            "en": "Awaiting the rapporteur’s opinion",
        },
        "lead": {
            "pt": "A ficha oficial permanece em “Aguardando Parecer”. Os registros recentes são sobretudo apensações, não um texto novo.",
            "en": "The official docket remains “Awaiting opinion.” Recent entries are mostly annexations, not a new text.",
        },
    },
]

POINTS_SEED = [
    {
        "id": "risco",
        "status": "no_texto",
        "title": {
            "pt": "Classificação por risco",
            "en": "Risk classification",
        },
        "summary": {
            "pt": "O texto aprovado no Senado separa sistemas por risco à vida e aos direitos fundamentais — excessivo (proibido), alto (regulado) e demais — e distingue IA de IA generativa.",
            "en": "The Senate-approved text ranks systems by risk to life and fundamental rights — excessive (banned), high (regulated), and the rest — and distinguishes AI from generative AI.",
        },
    },
    {
        "id": "proibicoes",
        "status": "no_texto",
        "title": {
            "pt": "Proibições de risco excessivo",
            "en": "Excessive-risk bans",
        },
        "summary": {
            "pt": "Ficam vedadas armas autônomas que selecionam e atacam alvos sem intervenção humana, sistemas para abuso sexual de crianças e adolescentes, e avaliação preditiva de personalidade para prever crimes.",
            "en": "Banned uses include autonomous weapons that select and strike targets without a human, systems for child sexual abuse, and personality scoring to predict crime.",
        },
    },
    {
        "id": "biometria",
        "status": "em_disputa",
        "title": {
            "pt": "Biometria em espaço público",
            "en": "Public-space biometrics",
        },
        "summary": {
            "pt": "Câmeras com reconhecimento em espaços públicos ficam restritas a busca de vítimas, desaparecidos e recaptura de foragidos, com autorização judicial e limite de pena.",
            "en": "Public facial-recognition cameras are limited to searching for victims, missing people, and recapturing fugitives, with a court order and a penalty threshold.",
        },
        "dispute": {
            "pt": "O recorte ainda divide convidados entre vedação ampla e exceções de segurança pública.",
            "en": "Invitees still split between a broad ban and public-security exceptions.",
        },
    },
    {
        "id": "governanca",
        "status": "em_disputa",
        "title": {
            "pt": "ANPD e o SIA",
            "en": "ANPD and the SIA",
        },
        "summary": {
            "pt": "A Autoridade Nacional de Proteção de Dados coordenaria o Sistema Nacional de Regulação e Governança de Inteligência Artificial, com autoridades setoriais e comitês de especialistas.",
            "en": "The National Data Protection Authority would coordinate the National AI Regulation and Governance System, with sector regulators and expert committees.",
        },
        "dispute": {
            "pt": "Parte dos convidados defende um órgão coordenador; outra parte teme concentração e prefere arranjo setorial.",
            "en": "Some invitees want a coordinating body; others fear concentration and prefer a sector-by-sector setup.",
        },
    },
    {
        "id": "direitos",
        "status": "no_texto",
        "title": {
            "pt": "Direitos de quem é afetado",
            "en": "Rights of affected people",
        },
        "summary": {
            "pt": "Quem sofre decisão automatizada relevante teria direito a informação, contestação e revisão humana.",
            "en": "Anyone subject to a material automated decision would have rights to information, challenge, and human review.",
        },
    },
    {
        "id": "responsabilidade",
        "status": "em_disputa",
        "title": {
            "pt": "Responsabilidade civil",
            "en": "Civil liability",
        },
        "summary": {
            "pt": "O marco prevê regras de responsabilidade civil para danos causados por sistemas de IA, em diálogo com o Código Civil e o CDC.",
            "en": "The bill sets civil-liability rules for harm from AI systems, alongside the Civil Code and the Consumer Code.",
        },
        "dispute": {
            "pt": "O desenho exato — nexo, ônus da prova, teto — ainda não fechou na Câmara.",
            "en": "The exact design — causation, burden of proof, caps — is still open in the Chamber.",
        },
    },
    {
        "id": "autoral",
        "status": "em_disputa",
        "title": {
            "pt": "Direitos autorais",
            "en": "Copyright",
        },
        "summary": {
            "pt": "Uso sem fins comerciais por pesquisa, jornalismo, museus, arquivos, bibliotecas e educação seria livre; uso comercial geraria remuneração ao titular.",
            "en": "Non-commercial use by research, journalism, museums, archives, libraries, and education would be free; commercial use would trigger remuneration.",
        },
        "dispute": {
            "pt": "É o principal impasse da Câmara: criadores pedem remuneração; plataformas e startups temem trava ao treino.",
            "en": "This is the Chamber’s main deadlock: creators want pay; platforms and startups fear a training freeze.",
        },
    },
    {
        "id": "trabalho",
        "status": "removido",
        "title": {
            "pt": "Salvaguardas trabalhistas",
            "en": "Labor safeguards",
        },
        "summary": {
            "pt": "O texto inicial buscava proteções mínimas para o mercado de trabalho. O processo na Câmara retirou essas salvaguardas.",
            "en": "The early draft sought baseline labor-market protections. The Chamber process stripped those safeguards.",
        },
        "dispute": {
            "pt": "Com cerca de 40% da força de trabalho na informalidade, a omissão deixa o trabalhador precário exposto à automação.",
            "en": "With about 40% of the workforce informal, the omission leaves precarious workers exposed to automation.",
        },
    },
    {
        "id": "sancoes",
        "status": "no_texto",
        "title": {
            "pt": "Sanções",
            "en": "Sanctions",
        },
        "summary": {
            "pt": "O texto do Senado prevê multas de até 2% do faturamento, limitadas a R$ 50 milhões por infração, além de outras medidas administrativas.",
            "en": "The Senate text provides for fines of up to 2% of revenue, capped at R$ 50 million per offense, plus other administrative measures.",
        },
    },
]

OFFICERS_SEED = [
    {
        "id": "pacheco",
        "role": "autor",
        "role_label": {"pt": "Autor", "en": "Author"},
        "name": "Rodrigo Pacheco",
        "party": "PSD",
        "uf": "MG",
        "house": "senado",
        "house_label": {"pt": "Senado Federal", "en": "Federal Senate"},
    },
    {
        "id": "eduardo-gomes",
        "role": "relator_senado",
        "role_label": {"pt": "Relator no Senado", "en": "Senate rapporteur"},
        "name": "Eduardo Gomes",
        "party": "PL",
        "uf": "TO",
        "house": "senado",
        "house_label": {"pt": "Senado Federal", "en": "Federal Senate"},
    },
    {
        "id": "canziani",
        "role": "presidente",
        "role_label": {"pt": "Presidência da Comissão Especial", "en": "Special Committee chair"},
        "name": "Luísa Canziani",
        "party": "PSD",
        "uf": "PR",
        "house": "camara",
        "house_label": {"pt": "Câmara dos Deputados", "en": "Chamber of Deputies"},
    },
    {
        "id": "aguinaldo",
        "role": "relator_camara",
        "role_label": {"pt": "Relator na Câmara", "en": "Chamber rapporteur"},
        "name": "Aguinaldo Ribeiro",
        "party": "PP",
        "uf": "PB",
        "house": "camara",
        "house_label": {"pt": "Câmara dos Deputados", "en": "Chamber of Deputies"},
    },
]


def format_dates(today: date) -> tuple[str, str, str]:
    iso = today.isoformat()
    pt = f"{today.day} de {MONTHS_PT[today.month - 1]} de {today.year}"
    en = f"{today.day} {MONTHS_EN[today.month - 1]} {today.year}"
    return iso, pt, en


def format_iso_date(iso: str) -> dict[str, str]:
    year, month, day = (int(p) for p in iso.split("-")[:3])
    return {
        "pt": f"{day} de {MONTHS_PT[month - 1]} de {year}",
        "en": f"{day} {MONTHS_EN[month - 1]} {year}",
    }


def title_name(name: str) -> str:
    small = {"da", "de", "do", "das", "dos", "e"}
    parts = []
    for i, raw in enumerate(name.split()):
        word = raw.strip()
        low = word.casefold()
        if i > 0 and low in small:
            parts.append(low)
        elif word.isupper() or word.islower():
            parts.append(word[:1].upper() + word[1:].lower())
        else:
            parts.append(word)
    return " ".join(parts)


def slugify(text: str) -> str:
    nfkd = unicodedata.normalize("NFKD", text)
    ascii_text = "".join(c for c in nfkd if not unicodedata.combining(c))
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_text).strip("-").lower()
    return slug or "convidado"


def api_get(path: str, params: dict | None = None) -> dict:
    query = f"?{urllib.parse.urlencode(params)}" if params else ""
    url = f"{API_BASE}{path}{query}"
    req = urllib.request.Request(
        url,
        headers={"Accept": "application/json", "User-Agent": USER_AGENT},
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise SystemExit(f"Câmara API HTTP {exc.code} for {url}") from exc
    except urllib.error.URLError as exc:
        raise SystemExit(f"Câmara API network error for {url}: {exc}") from exc


def api_get_all(path: str, params: dict) -> list[dict]:
    page = 1
    rows: list[dict] = []
    while True:
        payload = api_get(path, {**params, "pagina": page, "itens": 100})
        batch = payload.get("dados") or []
        rows.extend(batch)
        links = {item.get("rel"): item.get("href") for item in payload.get("links") or []}
        if "next" not in links or not batch:
            break
        page += 1
        if page > 20:
            break
    return rows


def load_existing() -> dict:
    if not YAML_PATH.exists():
        return {}
    return yaml.safe_load(YAML_PATH.read_text(encoding="utf-8")) or {}


def by_id(items: list[dict] | None) -> dict[str, dict]:
    return {str(item.get("id")): item for item in (items or []) if item.get("id")}


def merge_keep(old: dict, new: dict, preserve: tuple[str, ...]) -> dict:
    out = dict(new)
    for key in preserve:
        if key in old and old[key] not in (None, "", [], {}):
            out[key] = old[key]
    return out


def extract_theme(description: str) -> str:
    match = re.search(r"Tema:\s*(.+)", description or "", re.I)
    if match:
        line = match.group(1).strip()
        line = re.split(r"\n", line, maxsplit=1)[0].strip(" .")
        return line
    first = (description or "").strip().splitlines()
    return first[0].strip() if first else "Audiência pública"


SKIP_NAMES = {
    "mediador",
    "mediadora",
    "convidados",
    "convidadas",
    "participantes",
    "requerimento",
}


def invitees_block(description: str) -> str:
    text = description or ""
    start = re.search(
        r"(Convidados?:|Participantes Convidadas?:)",
        text,
        re.I,
    )
    if start:
        rest = text[start.end() :]
    elif re.search(r"^\s*\d+\)", text, re.M):
        rest = text[re.search(r"^\s*\d+\)", text, re.M).start() :]
    else:
        return ""
    rest = re.split(
        r"\n\s*(Requerimentos?:|\(Requerimento|B\s*[-–]\s*Delibera)",
        rest,
        maxsplit=1,
        flags=re.I,
    )[0]
    return rest.strip()


def split_entries(block: str) -> list[str]:
    if re.search(r"^\s*\d+\)", block, re.M):
        parts = re.split(r"\n?\s*\d+\)\s*", block)
        return [p.strip() for p in parts if p.strip()]
    lines = [ln.strip() for ln in block.splitlines() if ln.strip()]
    comma_ratio = sum(1 for ln in lines if "," in ln) / max(len(lines), 1)
    role_start = re.compile(
        r"^(Representante|Conselheir[ao]|Secretári[ao]|Diretor|Coordenador|"
        r"Presidente|Gerente|Instituto|Entidade)\b",
        re.I,
    )
    if lines and comma_ratio < 0.35:
        chunks: list[str] = []
        current: list[str] = []
        for line in lines:
            clean = re.sub(r"\([^)]*\)", "", line).strip(" .;-")
            letters = re.sub(r"[^A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç]", "", clean)
            upper_share = (
                sum(1 for c in letters if c.isupper()) / len(letters) if letters else 0
            )
            looks_name = (
                1 < len(clean.split()) <= 6
                and "REQ" not in line.upper()
                and not role_start.match(clean)
                and upper_share > 0.65
            )
            if looks_name and current:
                chunks.append(" ".join(current))
                current = [clean]
            else:
                current.append(line)
        if current:
            chunks.append(" ".join(current))
        return chunks
    parts = re.split(r";\s*(?:e\s+)?|\n\s*\n", block)
    cleaned = []
    for part in parts:
        bit = re.sub(r"\s+", " ", part).strip(" \n\t-–eE")
        if bit:
            cleaned.append(bit)
    return cleaned


def parse_person(raw: str) -> dict | None:
    text = re.sub(r"\s+", " ", raw).strip(" .;-")
    text = re.sub(r"\(REQs?[^)]*\)", "", text, flags=re.I)
    text = re.sub(
        r"\((?:confirmad[oa]|a confirmar|Não Participará|Confirmad[oa][^)]*|Participação [^)]*)\)",
        "",
        text,
        flags=re.I,
    )
    text = re.sub(r"Confirmad[oa][^.]*", "", text, flags=re.I)
    text = text.strip(" .;-")
    if not text or text.lower().startswith("representante da confederação da agricultura"):
        return None
    if "não participará" in text.lower() and "," not in text and " - " not in text:
        return None
    # "1) NAME - title" already stripped of number
    text = re.sub(r"^[-–]\s*", "", text)
    caps_then_title = re.match(
        r"^((?:[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ'’\-]+\s+){1,5}"
        r"[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ'’\-]+)[\.\s]+"
        r"([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç].+)$",
        text,
    )
    if caps_then_title:
        name, rest = caps_then_title.group(1), caps_then_title.group(2)
    elif " - " in text and "," not in text.split(" - ", 1)[0]:
        name, rest = text.split(" - ", 1)
    elif "," in text:
        name, rest = text.split(",", 1)
    else:
        words = text.split()
        cut = min(5, len(words))
        name, rest = " ".join(words[:cut]), " ".join(words[cut:])
    name = re.sub(r"^\d+\)\s*", "", name).strip(" .")
    name = name.replace(".", "").strip()
    if len(name) < 5 or name.casefold().rstrip(":") in SKIP_NAMES:
        return None
    if name.lower().startswith("requerimento"):
        return None
    if re.match(
        r"^(Representante|Conselheir|Secretári|Diretor|Coordenador|Presidente|Gerente|Tecnologia)\b",
        name,
        re.I,
    ):
        return None
    rest = rest.strip(" .;-")
    org = ""
    title = rest
    for sep in (" da ", " do ", " de ", " na ", " no "):
        if sep in rest:
            left, right = rest.split(sep, 1)
            if len(left) < 80:
                title = left.strip()
                org = (sep.strip() + " " + right).strip()
                # prefer the institution after "da/do"
                org = right.strip()
                break
    return {
        "name": name.title() if name == name.upper() else name,
        "org": org[:160],
        "title": title[:160],
    }


def classify_sector(name: str, org: str, title: str) -> str:
    blob = f"{name} {org} {title}".upper()
    blob_ascii = "".join(
        c for c in unicodedata.normalize("NFKD", blob) if not unicodedata.combining(c)
    )
    hay = f"{blob} {blob_ascii}"
    if any(h in hay for h in REGULATOR_HINTS):
        return "regulador"
    if any(h in hay for h in GOVERNMENT_HINTS):
        return "governo"
    if any(h in hay for h in ACADEMIA_HINTS):
        return "academia"
    if any(h in hay for h in COMPANY_HINTS):
        return "empresas"
    return "sociedade_civil"


def parse_hearing_invitees(description: str) -> list[dict]:
    block = invitees_block(description)
    if not block:
        return []
    people = []
    for raw in split_entries(block):
        person = parse_person(raw)
        if person:
            people.append(person)
    return people


def stage_from_situacao(situacao: str) -> str:
    text = (situacao or "").lower()
    if "transformad" in text or "lei" in text:
        return "lei"
    if "pront" in text and "pauta" in text:
        return "pauta"
    if "parecer" in text:
        return "parecer"
    return "parecer"


def bilingual(pt: str, en: str | None = None) -> dict[str, str]:
    return {"pt": pt, "en": en or pt}


def years_since(start: str, today: date) -> int:
    year, month, day = (int(part) for part in start.split("-")[:3])
    began = date(year, month, day)
    elapsed = today.year - began.year
    if (today.month, today.day) < (began.month, began.day):
        elapsed -= 1
    return max(elapsed, 0)


def build_status(prop: dict, existing: dict) -> dict:
    st = prop.get("statusProposicao") or {}
    situacao = st.get("descricaoSituacao") or "Aguardando Parecer"
    despacho = (st.get("despacho") or "").strip()
    when = (st.get("dataHora") or "")[:10]
    old = existing.get("status") or {}
    vote = old.get("vote_window") or "2026-q4"
    vote_label = old.get("vote_window_label") or {
        "pt": "Final de 2026",
        "en": "Late 2026",
    }
    labels = {
        "Aguardando Parecer": {
            "pt": "Aguardando parecer do relator",
            "en": "Awaiting rapporteur’s opinion",
        }
    }
    introduced = old.get("introduced") or INTRODUCED
    years = years_since(introduced, date.today())
    since = format_iso_date(introduced)
    return {
        "house": old.get("house") or "camara",
        "stage": stage_from_situacao(situacao),
        "label": labels.get(situacao) or bilingual(situacao),
        "last_move_date": when,
        "last_move_label": format_iso_date(when) if when else bilingual(""),
        "last_move": bilingual(despacho),
        "regime": st.get("regime") or "",
        "situacao": situacao,
        "introduced": introduced,
        "years_in_process": years,
        "years_in_process_since": {
            "pt": f"desde {since['pt']}",
            "en": f"since {since['en']}",
        },
        "vote_window": vote,
        "vote_window_label": vote_label,
    }


def build_timeline(status: dict, existing: dict) -> list[dict]:
    old_map = by_id(existing.get("timeline"))
    items = []
    for seed in TIMELINE_SEED:
        prev = old_map.get(seed["id"], {})
        item = dict(seed)
        item["current"] = seed["id"] == status.get("stage")
        if seed["id"] == "parecer" and status.get("last_move_date"):
            item["date"] = status["last_move_date"]
        if prev.get("title"):
            item["title"] = prev["title"]
        if prev.get("lead"):
            item["lead"] = prev["lead"]
        if prev.get("date_label") and seed["id"] != "parecer":
            item["date_label"] = prev["date_label"]
        items.append(item)
    return items


def build_hearings(events: list[dict], existing: dict) -> tuple[list[dict], list[dict], list[str]]:
    old_hearings = by_id(existing.get("hearings"))
    old_invitees = by_id(existing.get("invitees"))
    hearings: list[dict] = []
    invitees: dict[str, dict] = {}
    new_hearing_ids: list[str] = []

    audiencias = [
        ev
        for ev in events
        if "Audiência" in (ev.get("descricaoTipo") or "")
        or "Audiencia" in (ev.get("descricaoTipo") or "")
    ]
    audiencias.sort(key=lambda e: e.get("dataHoraInicio") or "")

    for ev in audiencias:
        hid = str(ev.get("id"))
        desc = ev.get("descricao") or ""
        theme_pt = extract_theme(desc)
        themes = HEARING_THEMES.get(hid) or {"pt": theme_pt, "en": theme_pt}
        prev = old_hearings.get(hid, {})
        if hid not in old_hearings:
            new_hearing_ids.append(hid)
        day = (ev.get("dataHoraInicio") or "")[:10]
        hearing = {
            "id": hid,
            "date": day,
            "theme": prev.get("theme") or themes,
            "url": ev.get("uri") or f"{API_BASE}/eventos/{hid}",
            "kind": "audiencia",
        }
        hearings.append(hearing)

        for person in parse_hearing_invitees(desc):
            pid = slugify(person["name"])
            if pid in invitees:
                seen = list(invitees[pid].get("hearings") or [])
                if hid not in seen:
                    seen.append(hid)
                invitees[pid]["hearings"] = seen
                invitees[pid]["name"] = title_name(person["name"])
                if person.get("org"):
                    invitees[pid]["org"] = person["org"]
                if person.get("title"):
                    invitees[pid]["title"] = person["title"]
            else:
                invitees[pid] = {
                    "id": pid,
                    "name": title_name(person["name"]),
                    "org": person.get("org") or "",
                    "title": person.get("title") or "",
                    "sector": classify_sector(
                        person["name"], person.get("org") or "", person.get("title") or ""
                    ),
                    "hearings": [hid],
                }

    for pid, prev in old_invitees.items():
        if pid in invitees and prev.get("sector"):
            invitees[pid]["sector"] = prev["sector"]

    ordered = sorted(
        invitees.values(),
        key=lambda item: (item.get("name") or "").casefold(),
    )
    return hearings, ordered, new_hearing_ids


def merge_points(existing: dict) -> list[dict]:
    old = by_id(existing.get("points"))
    if not old:
        return list(POINTS_SEED)
    out = []
    for seed in POINTS_SEED:
        prev = old.get(seed["id"], {})
        item = merge_keep(prev, seed, ("status", "title", "summary", "dispute"))
        out.append(item)
    for pid, prev in old.items():
        if pid not in {s["id"] for s in POINTS_SEED}:
            out.append(prev)
    return out


def merge_officers(existing: dict) -> list[dict]:
    old = by_id(existing.get("officers"))
    if not old:
        return list(OFFICERS_SEED)
    out = []
    for seed in OFFICERS_SEED:
        prev = old.get(seed["id"], {})
        out.append({**seed, **{k: prev[k] for k in prev if k in seed}})
    return out


def dump_yaml(data: dict) -> None:
    header = (
        "# Radar do Marco Legal da IA (PL 2338/2023).\n"
        "# Status, timeline acts, and hearings refresh from the Câmara API.\n"
        "# points, officers, vote_window, and invitee sectors are curated.\n"
        "# Do not edit retrieved dates by hand — run scripts/fetch_marco_legal_ia.py.\n"
    )
    YAML_PATH.write_text(
        header
        + yaml.dump(
            data,
            allow_unicode=True,
            sort_keys=False,
            default_flow_style=False,
            width=96,
        ),
        encoding="utf-8",
    )


def summarize(
    status: dict,
    hearings: list[dict],
    invitees: list[dict],
    new_hearing_ids: list[str],
    retrieved: str,
) -> str:
    missing = [
        h
        for h in hearings
        if not any(hid == h["id"] for person in invitees for hid in person.get("hearings") or [])
    ]
    lines = [
        f"Snapshot: {retrieved}",
        f"Status: {status['label']['pt']} ({status.get('situacao')})",
        f"Last official act: {status.get('last_move_date')} — {status['last_move']['pt']}",
        f"Hearings: {len(hearings)} · Invitees: {len(invitees)}",
    ]
    if new_hearing_ids:
        lines.append("New hearings without a prior record: " + ", ".join(new_hearing_ids))
        lines.append(
            "Complete invitee names from the official minutes if the parser missed anyone."
        )
    if missing:
        lines.append(
            "Hearings with zero parsed invitees: "
            + ", ".join(h["id"] for h in missing)
        )
    lines.append("")
    lines.append("Curated fields (points, labor/copyright notes, vote window) were not overwritten.")
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--summary",
        type=Path,
        help="Write a Markdown summary for a pull-request body.",
    )
    args = parser.parse_args()

    existing = load_existing()
    print("Fetching proposition, tramitações, and commission events…", flush=True)
    prop = api_get(f"/proposicoes/{CAMARA_ID}").get("dados") or {}
    events = api_get_all(
        "/eventos",
        {
            "idOrgao": ORGAO_ID,
            "dataInicio": "2025-05-01",
            "dataFim": date.today().isoformat(),
            "ordem": "ASC",
            "ordenarPor": "dataHoraInicio",
        },
    )

    iso, pt, en = format_dates(date.today())
    status = build_status(prop, existing)
    timeline = build_timeline(status, existing)
    hearings, invitees, new_ids = build_hearings(events, existing)
    points = merge_points(existing)
    officers = merge_officers(existing)

    data = {
        "source": {
            "retrieved": iso,
            "retrieved_pt": pt,
            "retrieved_en": en,
            "camara_id": CAMARA_ID,
            "orgao_id": ORGAO_ID,
            "urls": dict(URLS),
        },
        "status": status,
        "counts": {
            "hearings": len(hearings),
            "invitees": len(invitees),
        },
        "timeline": timeline,
        "points": points,
        "officers": officers,
        "hearings": hearings,
        "invitees": invitees,
    }
    dump_yaml(data)
    text = summarize(status, hearings, invitees, new_ids, iso)
    print(text, end="")
    if args.summary:
        args.summary.write_text(
            "## Radar do Marco Legal da IA\n\n```\n" + text + "```\n",
            encoding="utf-8",
        )
    print(f"Wrote {YAML_PATH.relative_to(ROOT)}", flush=True)


if __name__ == "__main__":
    main()
