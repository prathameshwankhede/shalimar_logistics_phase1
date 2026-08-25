# Threat Model & Security Controls — Shalimar Logistics

## 1. Threat Matrix

| Threat Category | Potential Risk | Mitigation Control Implemented |
|---|---|---|
| **SQL Injection** | Attacker injects malicious SQL syntax via input fields | All database queries use `mysql2` Prepared Statements (`?` placeholders). User input is never concatenated. |
| **Credential Leakage** | Plain text passwords exposed in Network DevTools responses | `sanitizeStateForClient()` strips `password` and `password_hash` properties from API state responses before returning HTTP output. |
| **Brute Force Attacks** | Automated password cracking attempts on login | `checkBruteForceLock()` tracks failed login attempts and locks out the account for 1 minute (60s) after 5 consecutive failures. |
| **Cross-Site Scripting (XSS)** | Malicious HTML/JS injected into requirement notes | `sanitizeInput()` strips script tags, event handlers, and dangerous characters. |
| **Unauthorized Data Reset** | Unauthenticated user attempts to clear system operational data | Admin authentication password check (`handleVerifySecuritySubmit`) and explicit confirmation dialog required before executing `_isResetOperation`. |
