// English dictionary, keyed by the Italian source string.
// Each area has its own file in ./dict to avoid edit conflicts.
import { core } from "./dict/core";
import { creators } from "./dict/creators";
import { clients } from "./dict/clients";
import { finance } from "./dict/finance";
import { content } from "./dict/content";
import { portals } from "./dict/portals";
import { campaign } from "./dict/campaign";
import { settings } from "./dict/settings";
import { dashboard } from "./dict/dashboard";

const shell: Record<string, string> = {
  // Shell / navigation
  "Campagne": "Campaigns",
  "Calendario Contenuti": "Content Calendar",
  "Contratti": "Contracts",
  "Clienti": "Clients",
  "Canali": "Channels",
  "Pagamenti da fare": "Payments due",
  "Impostazioni": "Settings",
  "Nuovo": "New",
  "Esci": "Sign out",
  "Lingua": "Language",
  // Last update badge
  "ora": "now",
  "{n}m fa": "{n}m ago",
  "{n}h fa": "{n}h ago",
  "{n}g fa": "{n}d ago",
  "Mai": "Never",
  "Aggiornato {when}": "Updated {when}",
  "Ultimo scraping: {when}": "Last scrape: {when}",
};

export const en: Record<string, string> = {
  ...core, ...creators, ...clients, ...finance, ...content, ...portals, ...campaign, ...settings,
  ...dashboard, ...shell,
};
