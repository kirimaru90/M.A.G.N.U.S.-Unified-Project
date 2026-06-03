import { MessageService } from 'primeng/api';
import type { TerminalsApiService } from '../../core/terminal/terminals-api.service';

export function exportTerminal(
  api: TerminalsApiService,
  messageService: MessageService,
  terminalId: string,
): void {
  api.export(terminalId).subscribe({
    next: (content) => {
      // Exports strip the server-owned meta.id, so name the file from the user-authored
      // hiddenId, falling back to a slug of the title.
      const slug = (content.meta.hiddenId || content.meta.title || 'terminal')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'terminal';
      const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slug}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
    error: () => {
      messageService.add({ severity: 'error', summary: 'Errore durante l\'esportazione' });
    },
  });
}
