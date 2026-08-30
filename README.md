# Inteligência Soberana

Jekyll site for [inteligenciasoberana.com.br](https://inteligenciasoberana.com.br), published with GitHub Pages.

- `/` — bilingual manifesto (PT/EN)
- `/relatorio.html` — research report
- `/universidades.html` — 2026 discretionary budget of the 69 federal universities
- `/centros.html` — map of public AI research centers (CPA and INCT)
- `/producao.html` — Brazilian AI scientific output (OpenAlex snapshot)
- `/custo-prompt.html` — hidden cost of an AI prompt (interactive infographic)
- `/marco-legal.html` — radar of Brazil’s AI bill (PL 2338/2023)
- `/termos.html` — terms of use

## Preview locally

```bash
bundle install
bundle exec jekyll serve
```

Open [http://localhost:4000](http://localhost:4000).

## Refresh observatory data

The radar snapshot is a curated YAML file, not a live feed. To pull the latest official status, tramitação, and public hearings from the [Câmara Open Data API](https://dadosabertos.camara.leg.br/swagger/api.html?tab=api):

```bash
python3 scripts/fetch_marco_legal_ia.py
```

The script stamps `source.retrieved`, updates status and hearings, and prints what needs a human look. It does **not** overwrite the curated points of the bill, the vote window, or invitee sector tags. New hearings show up as stubs: complete invitee names from the official minutes if the parser missed anyone. Stdlib plus PyYAML (already used locally).

A GitHub Action (`.github/workflows/refresh-marco-legal.yml`) runs the same script at 08:00 UTC on the 1st and 16th of each month, and can be triggered by hand. If the YAML changed, it opens or updates the pull request on `chore/radar-marco-refresh`. Nothing lands on the default branch until that PR is merged.

## License

Copyright © 2026 Julio Cesar Fausto / Inteligência Soberana.

Unless otherwise stated, this work is licensed under [CC BY 4.0](LICENSE). Reuse, including commercial use, is allowed with attribution.

Suggested credit: *“Inteligência Soberana”, Julio Cesar Fausto, https://inteligenciasoberana.com.br, CC BY 4.0.*
