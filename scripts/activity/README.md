# Suivi automatique du temps

Claude Code et les apps envoient des « pings » à `POST /api/activity/ping`. MyTrack regroupe les pings
proches en sessions et ajoute les minutes à la tâche « Travail — <clé> » du projet associé.

## Mise en place

1. Exécuter `prisma/migrations/0009_activity_tracking.sql` dans le SQL Editor de Supabase.
2. MyTrack > Profil > Suivi automatique > « Copier la config », puis l'enregistrer dans `~/.config/mytrack/activity.json`.
3. `node scripts/activity/install-claude-hooks.mjs` (ajoute les hooks à `~/.claude/settings.json`).

## Claude Code

Clé = nom du dépôt git (un worktree donne le dépôt principal). Pour regrouper plusieurs dossiers sous une
même clé, ou exclure un dossier, mettre un fichier `.mytrack-key` (une ligne, `ignore` pour exclure) dans
le dossier ou un parent. La session se ferme à `SessionEnd`, ou après 15 min sans ping.

## Apps (dev uniquement)

Copier `MyTrackHeartbeat.tsx` dans l'app, le monter dans le layout racine et définir
`NEXT_PUBLIC_MYTRACK_URL`, `NEXT_PUBLIC_MYTRACK_TOKEN`, `NEXT_PUBLIC_MYTRACK_KEY` dans `.env.local`.
Un ping toutes les 60 s quand l'onglet est visible, focalisé et actif ; fermeture après 3 min de silence.
Inactif en production.
