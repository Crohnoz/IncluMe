# IncluMe

**L1 · Early Product**

IncluMe is an accessibility-oriented product exploration for finding, documenting and reviewing accessible parking information in Chile.

The project currently exposes a citizen-facing experience and a municipal demonstration surface. It is presented as an **early product**, not as a complete public infrastructure or authoritative accessibility registry.

## Repository structure

The default `main` branch is intentionally the **product and documentation surface**. The deployable public experiences live in dedicated branches so the citizen and municipal contexts remain easy to inspect independently.

- [`netlify-ciudadania`](https://github.com/Crohnoz/IncluMe/tree/netlify-ciudadania) — citizen-facing implementation
- [`netlify-municipalidades`](https://github.com/Crohnoz/IncluMe/tree/netlify-municipalidades) — municipal demonstration implementation
- [Public engineering evidence](https://github.com/Crohnoz/Crohnoz/blob/main/evidence/inclume.md) — curated product/engineering case

## Public surfaces

| Surface | Link | Purpose |
| --- | --- | --- |
| Citizen application | https://inclume-chile.netlify.app/ | Map, search and community contribution flow |
| Municipal demo | https://inclume-municipalidades.netlify.app/ | Territorial review, indicators and export concepts |
| Report / correction | https://inclume-chile.netlify.app/feedback/ | Submit a new point or correction |
| Submission status | https://inclume-municipalidades.netlify.app/estado/ | Review the state of a submitted contribution |

Netlify is the primary public demonstration surface. Repository branches are retained as inspectable implementation surfaces rather than pretending `main` is a monolithic production branch.

## Product questions being explored

IncluMe is currently useful for validating questions such as:

- how accessibility information should be represented clearly for citizens;
- how community contributions can be reviewed rather than accepted blindly;
- how a municipal or territorial operator could inspect submitted information;
- how public and administrative views should remain distinct;
- which evidence is required before accessibility information should be treated as trustworthy.

## Current boundaries

- The project remains an early-stage product exploration.
- Public demonstrations should not be interpreted as an official government registry.
- The two public contexts are demonstration surfaces, not proof of institutional adoption.
- Product maturity will advance only after stronger data validation, operational evidence and sustained real-user use.

## Maturity model

`L0 IDEA → ● L1 EARLY PRODUCT → L2 PILOT → L3 PRODUCTION → L4 SCALE`

The maturity label moves only when evidence supports it.

## Crohnoz Labs

IncluMe is part of the Crohnoz Labs product-engineering portfolio.

**Problem → System → Evidence → Scale**

- Crohnoz profile and public evidence: https://github.com/Crohnoz
- Crohnoz Labs: https://crohnozlabs.cl
