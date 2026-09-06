---
title: Nutzungsanleitung
description: Praxisbeispiele, die zeigen, wie man oh-my-agent nutzt — von einfachen Aufgaben bis zur vollstaendigen Multi-Agenten-Orchestrierung.
---

# Wie Man oh-my-agent Benutzt

> Für eine einzelne Domäne starte mit einem Skill. Nutze die [Auswahlhilfe](/docs/core-concepts/workflows#choosing-a-skill-or-workflow), wenn die Aufgabe Koordination oder einen ausdrücklichen Qualitätsprozess braucht.

## Schnellstart

1. Oeffne dein Projekt in einer KI-IDE (Claude Code, Gemini, Cursor, etc.)
2. Skills werden automatisch aus `.agents/skills/` erkannt
3. Fang an zu chatten — beschreib, was du willst

Aufgaben in einer einzelnen Domäne brauchen keine besondere Syntax. Die [Auswahlhilfe für Skills und Workflows](/docs/core-concepts/workflows#choosing-a-skill-or-workflow) hilft dir, zwischen einem einzelnen Skill, `/work`, `/orchestrate`, `/ultrawork` und `/ralph` zu wählen.

---

## Beispiel 1: Einfache Einzelaufgabe

**Du tippst:**
```
"Erstelle eine Login-Formular-Komponente mit E-Mail- und Passwort-Feldern mit Tailwind CSS"
```

**Was passiert:**
- Der `oma-frontend` Skill aktiviert sich
- Laedt sein Ausfuehrungsprotokoll und Tech-Stack-Ressourcen bei Bedarf
- Du bekommst eine React-Komponente mit TypeScript, Tailwind, Formularvalidierung und Tests

Keine Slash-Befehle noetig. Beschreib einfach, was du willst.

## Beispiel 2: Multi-Domain-Projekt

**Du tippst:**
```
"Baue eine TODO-App mit Benutzer-Authentifizierung"
```

**Was passiert:**

1. Die Anfrage umfasst mehrere Domänen. Der Host-Agent kann anhand dieses Umfangs eine Koordination empfehlen. Der Erkennungs-Hook gleicht Text mit konfigurierten Keywords und Mustern ab; er klassifiziert nicht die Anzahl der Domänen. Ist er aktiviert, kann das englische Muster "Build a TODO app" `/orchestrate` aktivieren. Wähle den gewünschten Workflow mit einem ausdrücklichen Befehl.
2. **PM-Agent** plant die Arbeit: Auth-API, Datenbankschema, Frontend-UI, QA-Umfang. Der Agent stellt den Plan vor und fährt im bereits autorisierten Umfang fort. Er fragt nur nach wesentlichen fehlenden Entscheidungen oder einer neuen Autorisierung.
3. **Du startest Agenten:**
   ```bash
   oma agent spawn backend "JWT authentication API" session-01 -w ./apps/api &
   oma agent spawn frontend "Login and TODO UI" session-01 -w ./apps/web &
   wait
   ```
4. **Agenten arbeiten parallel** — jeder in seinem eigenen Workspace
5. **QA-Agent prueft** — Sicherheitsaudit, Integrationspruefung
6. **Du iterierst** — starte Agenten mit Verfeinerungen neu, wenn noetig

## Beispiel 3: Bugfixing

**Du tippst:**
```
"Es gibt einen Bug — beim Klick auf Login erscheint 'Cannot read property map of undefined'"
```

**Was passiert:**

1. `oma-debug` aktiviert sich automatisch (Keyword: "Bug")
2. Grundursache identifiziert — Komponente iteriert ueber `todos`, bevor Daten geladen sind
3. Fix angewendet — Ladezustaende und Null-Pruefungen
4. Regressionstest geschrieben
5. Aehnliche Muster gefunden und proaktiv in 3 weiteren Komponenten behoben

## Beispiel 4: Design-System

**Du tippst:**
```
"Designe eine dunkle Premium-Landing-Page fuer mein SaaS-Produkt"
```

**Was passiert:**

1. `oma-design` aktiviert sich (Keyword: "designe", "Landing Page")
2. Sammelt Kontext — Zielgruppe, Marke, aesthetische Richtung
3. Schlaegt 2-3 Designrichtungen vor mit Farb-, Typografie- und Layout-Optionen
4. Generiert `DESIGN.md` mit Tokens, Komponenten-Mustern und Barrierefreiheits-Regeln
5. Fuehrt Audit durch — Responsive, WCAG, Nielsen-Heuristiken
6. Bereit fuer `oma-frontend` zur Implementierung

## Beispiel 5: CLI Parallele Ausfuehrung

```bash
# Einzelner Agent
oma agent spawn backend "Implement JWT auth API" session-01

# Mehrere Agenten parallel
oma agent spawn backend "Auth API + DB migration" session-01 -w ./apps/api &
oma agent spawn frontend "Login form + error states" session-01 -w ./apps/web &
oma agent spawn mobile "Auth screens + biometrics" session-01 -w ./apps/mobile &
wait

# Echtzeit ueberwachen
oma dashboard terminal        # Terminal-UI
oma dashboard web    # Web-UI unter http://localhost:9847
```

---

## Workflow-Befehle

Tippe diese in deiner KI-IDE, um strukturierte Prozesse auszuloesen:

| Befehl | Was Er Tut | Wann Verwenden |
|--------|-----------|---------------|
| `/brainstorm` | Freie Ideenfindung und Erkundung | Bevor du dich auf einen Ansatz festlegst |
| `/plan` | PM-Aufgabenzerlegung, API-Vertraege und nachverfolgte Plan-Artefakte in `docs/plans/work/` (sequentiell `NNN-name.md`, `Status`-Feld fuer den Lebenszyklus) | Vor dem Start jedes komplexen Features; auch fuer komplexe Features, die nachverfolgten Fortschritt brauchen |
| `/work` | Schrittweise Planung, Implementierung und QA über mehrere Domänen im autorisierten Umfang | Features über mehrere Domänen hinweg, die Koordination brauchen |
| `/orchestrate` | Lädt oder erstellt einen Plan und delegiert parallele Ausführung mit Überwachung und Verifikation | Unabhängige Aufgaben für automatisierte parallele Koordination |
| `/ultrawork` | 5-Phasen-Qualitaets-Workflow (11 Review-Gates) | Maximale Qualitaetsauslieferung |
| `/ralph` | Wiederholte ultrawork-Ausführung mit unabhängigem Judge und Schutzvorrichtungen | Ausdrücklicher Auftrag zur Wiederholung bis zum Bestehen mechanischer Abschlusskriterien |
| `/review` | Sicherheits- + Performance- + Barrierefreiheits-Audit | Vor dem Merge |
| `/debug` | Strukturiertes Grundursachen-Debugging | Bugs untersuchen |
| `/design` | 7-Phasen-Design-Workflow → `DESIGN.md` | Design-Systeme aufbauen |
| `/scm` | Konventioneller Commit mit Typ/Scope-Analyse | Aenderungen committen |
| `/tools` | MCP-Server-Verwaltung | Externe Tools hinzufuegen |
| `/stack-set` | Tech-Stack-Konfiguration | Sprach-/Framework-Praeferenzen festlegen |
| `/deepinit` | Vollstaendige Projektinitialisierung | Setup in einer bestehenden Codebase |

Für die Qualitäts-Gates gelten diese Regeln:

- **PLAN_GATE:** Plan dokumentiert, Annahmen aufgelistet, Umfang autorisiert.
- **IMPL_GATE:** Anwendbare Prüfungen ohne Dateiausgabe und Tests bestehen, nur geplante Dateien geändert. Build-Prüfungen werden nur auf ausdrücklichen Wunsch ausgeführt.
- **SHIP_GATE:** Alle Prüfungen bestehen; die vorhandene Autorisierung gilt weiter. Veröffentlichung oder Deployment erfordert eine Autorisierung für diese Aktion.

---

## Auto-Erkennung (Ohne Slash-Befehle)

oh-my-agent erkennt Keywords in 11 Sprachen und aktiviert Workflows automatisch:

| Du Sagst | Workflow Der Sich Aktiviert |
|----------|----------------------------|
| "plan the auth feature" | `/plan` |
| "plane die Authentifizierung" | `/plan` |
| "do everything in parallel" | `/orchestrate` |
| "pruefe den Code" | `/review` |
| "designe die Seite" | `/design` |
| "brainstorm some ideas" | `/brainstorm` |

Fragen wie "was ist orchestrate?" werden herausgefiltert — sie loesen keine Workflows versehentlich aus.

---

## Verfuegbare Skills

| Skill | Am Besten Fuer | Ausgabe |
|-------|---------------|---------|
| oma-pm | "plane das", "zerlege" | `.agents/results/plan-{sessionId}.json` |
| oma-frontend | UI, Komponenten, Styling | React-Komponenten, Tests |
| oma-backend | APIs, Datenbanken, Auth | Endpoints, Modelle, Tests |
| oma-db | Schema, ERD, Migrationen | Schema-Design, Query-Optimierung |
| oma-mobile | Mobile Apps | Flutter-Screens, State-Management |
| oma-design | UI/UX, Design-Systeme | `DESIGN.md` mit Tokens |
| oma-brainstorm | Ideenfindung, Erkundung | Design-Dokument |
| oma-qa | Sicherheit, Performance, a11y | QA-Bericht mit priorisierten Fixes |
| oma-debug | Bugs, Fehler, Abstuerze | Behobener Code + Regressionstests |
| oma-tf-infra | Cloud-Infrastruktur | Terraform-Module |
| oma-dev-workflow | CI/CD, Automatisierung | Pipeline-Konfigurationen |
| oma-translation | Uebersetzung | Natuerlicher mehrsprachiger Inhalt |
| oma-orchestration | Parallele Ausfuehrung | Agenten-Ergebnisse |
| oma-scm | Git-Commits | Konventionelle Commits |

---

## Dashboards

### Terminal-Dashboard

```bash
oma dashboard terminal
```

Live-Tabelle mit Sitzungsstatus, Agentenzustaenden, Zuegen und letzter Aktivitaet. Ueberwacht `.serena/memories/` fuer Echtzeit-Updates.

### Web-Dashboard

```bash
oma dashboard web
# → http://localhost:9847
```

Features:
- Echtzeit-Updates via WebSocket
- Auto-Reconnect bei Verbindungsabbruechen
- Sitzungsstatus mit farbigen Agenten-Indikatoren
- Aktivitaetslog aus Fortschritts- und Ergebnisdateien

### Empfohlenes Layout

Verwende 3 Terminals:
1. Dashboard (`oma dashboard terminal`)
2. Agenten-Spawn-Befehle
3. Test-/Build-Logs

---

## Tipps

1. **Sei spezifisch** — "Baue eine TODO-App mit JWT Auth, React-Frontend, Express-Backend" schlaegt "mach eine App"
2. **Verwende Workspaces** — `-w ./apps/api` verhindert, dass Agenten sich gegenseitig in die Quere kommen
3. **Sperre Vertraege zuerst** — fuehre `/plan` aus, bevor du parallele Agenten startest
4. **Ueberwache aktiv** — Dashboards erkennen Probleme vor dem Merge
5. **Iteriere mit Re-Spawns** — verfeinere Agenten-Prompts, statt von vorne zu beginnen
6. **Passe die Koordination an die Aufgabe an.** Starte bei einer Domäne mit einem einzelnen Skill; nutze die [Auswahlhilfe](/docs/core-concepts/workflows#choosing-a-skill-or-workflow), wenn Koordination oder ein ausdrücklicher Qualitätsprozess nötig ist.

---

## Fehlerbehebung

| Problem | Loesung |
|---------|---------|
| Skills nicht in IDE erkannt | Pruefe, ob `.agents/skills/` mit `SKILL.md`-Dateien existiert, starte IDE neu |
| CLI nicht gefunden | `which gemini` / `which claude` — installiere fehlende |
| Agenten produzieren widersprüchlichen Code | Verwende separate Workspaces (`-w`), pruefe Ausgaben, starte mit Korrekturen neu |
| Dashboard zeigt "No agents detected" | Agenten haben noch nicht in `.serena/memories/` geschrieben — warte oder pruefe die Session-ID |
| Web-Dashboard startet nicht | Fuehre zuerst `bun install` aus |
| QA-Bericht hat 50+ Probleme | Konzentriere dich zuerst auf CRITICAL/HIGH, dokumentiere den Rest fuer spaeter |

---

Fuer die Integration in bestehende Projekte, siehe [Integrationsanleitung](./integration.md).
