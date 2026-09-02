# Third-Party Software Licenses & Notices

This document details the open-source third-party software libraries, dependencies, fonts, and assets utilized in the **TransFlow Logistics / Shalimar Nutrients Transport Procurement Portal**.

All third-party components included in this project remain subject to their respective open-source licenses as documented below.

---

## 1. Direct Runtime & Production Dependencies

### React
* **Package:** `react` & `react-dom`
* **Version:** `19.2.8`
* **License:** MIT License
* **Copyright:** Copyright (c) Meta Platforms, Inc. and affiliates.
* **Terms:** Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, subject to retaining the copyright notice.

### Express
* **Package:** `express`
* **Version:** `5.2.1`
* **License:** MIT License
* **Copyright:** Copyright (c) 2009-2014 TJ Holowaychuk <tj@vision-media.ca>, Copyright (c) 2013-2014 Roman Shtylman <shtylman+expressjs@gmail.com>, Copyright (c) 2014-2015 Douglas Christopher Wilson <doug@somethingdoug.com>
* **Terms:** Standard MIT permissive terms. Commercial use permitted.

### MySQL2
* **Package:** `mysql2`
* **Version:** `3.24.2`
* **License:** MIT License
* **Copyright:** Copyright (c) 2016 Andrey Sidorov <sidorares@yandex.ru> and contributors.
* **Terms:** Standard MIT permissive terms. Commercial use permitted.

### bcryptjs
* **Package:** `bcryptjs`
* **Version:** `3.0.3`
* **License:** BSD-3-Clause License
* **Copyright:** Copyright (c) 2012 Nevins Bartolomeo <nevins.bartolomeo@gmail.com>, Copyright (c) 2012 Daniel Wirtz <dcode@dcode.io>
* **Terms:** Redistribution and use in source and binary forms, with or without modification, are permitted provided that the copyright notice and condition list are retained.

### jsonwebtoken
* **Package:** `jsonwebtoken`
* **Version:** `9.0.3`
* **License:** MIT License
* **Copyright:** Copyright (c) 2015 Auth0, Inc. <support@auth0.com>
* **Terms:** Standard MIT permissive terms. Commercial use permitted.

### CORS
* **Package:** `cors`
* **Version:** `2.8.6`
* **License:** MIT License
* **Copyright:** Copyright (c) 2013 Troy Goode <troygoode@gmail.com>
* **Terms:** Standard MIT permissive terms. Commercial use permitted.

### dotenv
* **Package:** `dotenv`
* **Version:** `17.4.2`
* **License:** BSD-2-Clause License
* **Copyright:** Copyright (c) 2015, Scott Motte. All rights reserved.
* **Terms:** Standard BSD-2-Clause permissive terms. Commercial use permitted.

### Lucide React
* **Package:** `lucide-react`
* **Version:** `1.31.0`
* **License:** ISC License
* **Copyright:** Copyright (c) 2026 Lucide Icons and Contributors.
* **Terms:** Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the copyright notice appears in all copies.

### ExcelJS
* **Package:** `exceljs`
* **Version:** `4.4.0`
* **License:** MIT License
* **Copyright:** Copyright (c) 2014-2019 Guyon Roche
* **Terms:** Standard MIT permissive terms. Commercial use permitted.

### jsPDF
* **Package:** `jspdf`
* **Version:** `4.2.1`
* **License:** MIT License
* **Copyright:** Copyright (c) 2010-2025 James Hall, Copyright (c) 2015-2025 yWorks GmbH
* **Terms:** Standard MIT permissive terms. Commercial use permitted.

### html2canvas
* **Package:** `html2canvas`
* **Version:** `1.4.1`
* **License:** MIT License
* **Copyright:** Copyright (c) 2012 Niklas von Hertzen
* **Terms:** Standard MIT permissive terms. Commercial use permitted.

### canvas-confetti
* **Package:** `canvas-confetti`
* **Version:** `1.9.4`
* **License:** ISC License
* **Copyright:** Copyright (c) 2020, Kiril Vatev
* **Terms:** Standard ISC permissive terms. Commercial use permitted.

---

## 2. Key Transitive Dependencies

### JSZip
* **Package:** `jszip` (Transitive dependency of `exceljs`)
* **Version:** `3.10.1`
* **License:** Dual-licensed under **MIT License** OR **GPL-3.0-or-later**
* **Election:** TransFlow Logistics exercises the **MIT License** option. Commercial use is permitted without copyleft obligation.
* **Copyright:** Copyright (c) 2009-2016 Stuart Knightley, David Duponchel, Franz Buchinger, António Afonso

### Mozilla Public License 2.0 (MPL-2.0) Packages
* Build-time tooling packages in the dependency tree licensed under MPL-2.0 provide file-level copyleft.
* These components are used exclusively as un-modified build or linting utilities and do not affect or taint the proprietary application codebase.

### Apache-2.0, BSD & ISC Transitive Packages
* All additional transitive packages are governed by standard permissive licenses (Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, MIT).
* None impose reciprocal copyleft or source-disclosure requirements on proprietary software.

---

## 3. Typography & Fonts

### Plus Jakarta Sans
* **Designer / Foundry:** Gumpita Rahayu / Tokotype
* **License:** SIL Open Font License, Version 1.1 (OFL-1.1)
* **Terms:** Free for commercial use, web embedding, digital distribution, and software bundling.

### Outfit
* **Designer / Foundry:** Onsen Studio
* **License:** SIL Open Font License, Version 1.1 (OFL-1.1)
* **Terms:** Free for commercial use, web embedding, digital distribution, and software bundling.

---

## 4. Software Classification & Intellectual Property Boundaries

To maintain legal clarity, the software and assets in this repository are categorized into three distinct classes:

### Category A: Proprietary Project Deliverables
* Original application source code, frontend and backend implementations, custom React components, database schemas, stored procedures, migration scripts, and business workflows.
* Governed exclusively by the proprietary [`LICENSE`](./LICENSE) and [`IP_OWNERSHIP.md`](./IP_OWNERSHIP.md).

### Category B: Third-Party Open-Source Software
* External libraries, packages, frameworks, utilities, and fonts documented in Sections 1, 2, and 3 of this document.
* Governed exclusively by their respective open-source licenses (MIT, ISC, BSD, SIL OFL 1.1).
* The proprietary license does not claim ownership of these open-source packages, nor does it restrict rights granted by their authors.

### Category C: Client-Supplied Materials
* Trademarks, brand names, corporate logos, GSTIN/PAN identifiers, plant specifications, and operational parameters provided by the client.
* Remain the property of the client as outlined in [`CLIENT_IP_HANDOVER_NOTICE.md`](./CLIENT_IP_HANDOVER_NOTICE.md).

