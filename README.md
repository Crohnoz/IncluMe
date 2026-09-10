<div align="center">

<img src="https://raw.githubusercontent.com/Crohnoz/Crohnoz/main/brand/assets/logo-horizontal-dark.svg" alt="Crohnoz Labs" width="340" />

# IncluMe

### `L1 · Early Product`

**Accessibility information designed as a citizen + institutional workflow, not just a map.**

<a href="https://inclume-chile.netlify.app/"><img src="https://img.shields.io/badge/OPEN-CITIZEN_DEMO-EC4899?style=for-the-badge" height="34" alt="Citizen demo" /></a>
<a href="https://inclume-municipalidades.netlify.app/"><img src="https://img.shields.io/badge/OPEN-MUNICIPAL_DEMO-8B5CF6?style=for-the-badge" height="34" alt="Municipal demo" /></a>
<a href="https://github.com/Crohnoz/Crohnoz/blob/main/evidence/inclume.md"><img src="https://img.shields.io/badge/READ-ENGINEERING_CASE-3B82F6?style=for-the-badge" height="34" alt="Engineering case" /></a>

**Discover → Report → Review → Correct → Improve**

</div>

---

## Product role

IncluMe is an accessibility-oriented early product exploring how people can **find, report and correct accessible-parking information** while a separate institutional workflow reviews and interprets those contributions.

The product is intentionally presented as `L1`. Public demonstrations prove the interaction model and multi-stakeholder workflow; they do **not** imply official government adoption or authoritative national coverage.

---

## Why this is more than a map

Accessibility information can be incomplete, outdated or difficult to verify. Simply putting points on a map does not solve the trust problem.

IncluMe therefore separates two perspectives:

| Surface | Purpose |
|---|---|
| **Citizen experience** | Search, discover, contribute and request corrections |
| **Institutional / municipal experience** | Review submissions, inspect territorial information and track contribution state |

The product question is not only **“where is an accessible parking space?”** but also **“how does information become trustworthy enough to act on?”**

---

## What it demonstrates today

| Capability | Current evidence |
|---|---|
| **Inclusive product framing** | Accessibility is treated as an operational information problem, not decorative compliance |
| **Geospatial UX** | Citizen-facing map and search workflows |
| **Community contribution** | New information and correction requests have explicit submission paths |
| **Review boundary** | Citizen contributions are separated from institutional review rather than accepted blindly |
| **Multi-stakeholder design** | Public and administrative surfaces have different responsibilities |
| **Status feedback** | Submitted contributions can be represented through a review/status lifecycle |

---

## Public surfaces

| Surface | Link | Purpose |
|---|---|---|
| **Citizen application** | https://inclume-chile.netlify.app/ | Map, search and community contribution flow |
| **Municipal demo** | https://inclume-municipalidades.netlify.app/ | Territorial review, indicators and export concepts |
| **Report / correction** | https://inclume-chile.netlify.app/feedback/ | Submit a new point or correction |
| **Submission status** | https://inclume-municipalidades.netlify.app/estado/ | Inspect contribution review state |

Netlify is the primary public demonstration surface.

---

## Repository architecture

The default `main` branch is intentionally the **product/documentation surface**. Deployable experiences live in dedicated branches so citizen and municipal contexts remain independently inspectable:

- [`netlify-ciudadania`](https://github.com/Crohnoz/IncluMe/tree/netlify-ciudadania) — citizen-facing implementation;
- [`netlify-municipalidades`](https://github.com/Crohnoz/IncluMe/tree/netlify-municipalidades) — municipal demonstration implementation;
- [public engineering evidence](https://github.com/Crohnoz/Crohnoz/blob/main/evidence/inclume.md) — curated case study.

This split avoids pretending that `main` is a single monolithic production application when the current product is explicitly exploratory.

---

## Product questions under validation

### Trust
Which evidence should be required before accessibility information is treated as reliable?

### Contribution quality
How should a correction or new point be submitted so the process is useful without creating unnecessary friction?

### Institutional review
What does a municipal or territorial operator need to inspect, prioritize and resolve submitted information?

### Public / administrative separation
Which information belongs in the citizen experience and which belongs only in the review surface?

---

## Current boundaries

IncluMe remains an early-stage product exploration.

The public applications are **demonstration surfaces**, not an official registry. They do not prove institutional adoption, national coverage or sustained operational use. Advancement in maturity requires stronger data-validation mechanisms, real-user evidence and a demonstrated review operation over time.

---

## Current maturity

<div align="center">

### `L0 IDEA → ● L1 EARLY PRODUCT → L2 PILOT → L3 PRODUCTION → L4 SCALE`

</div>

The next gate is not more visual polish. It is **evidence that the citizen contribution + institutional review loop works repeatedly with trustworthy data and real operational participation**.

---

<div align="center">

### Crohnoz Labs

**People first · Evidence before claims.**

<a href="https://github.com/Crohnoz"><img src="https://img.shields.io/badge/RETURN-ENRIQUE_FLORES_PROFILE-8B5CF6?style=for-the-badge" height="34" alt="Professional profile" /></a>
<a href="https://crohnozlabs.cl"><img src="https://img.shields.io/badge/ENTER-CROHNOZ_LABS-EC4899?style=for-the-badge" height="34" alt="Crohnoz Labs" /></a>

**Problem → System → Evidence → Scale**

</div>
