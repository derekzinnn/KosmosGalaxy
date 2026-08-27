import { Check, Copy, MailCheck } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * The handoff moment: an invitation exists, and here is the link to give the
 * client.
 *
 * While email is console-only this is how the link actually reaches anyone, so
 * it is not an afterthought panel — it is the point of the whole flow, and it
 * says plainly what to do next. When a real email provider is wired in, the
 * link will simply be sent, and this can shrink to a confirmation.
 *
 * The link is shown in full and selectable, with one-press copy, because the
 * one thing a person needs here is to get it into a message without fumbling.
 */
export function MagicLinkHandoff({ email, acceptUrl }: { email: string; acceptUrl: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(acceptUrl);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      // Clipboard blocked (insecure context, denied permission). The link is
      // right there to select by hand, so there is nothing to recover from.
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/5 px-4 py-3">
        <MailCheck className="size-5 shrink-0 text-success" aria-hidden />
        <p className="text-sm">
          Convite criado para <span className="font-medium break-all">{email}</span>
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Envie este link para o cliente. Ele define a senha e entra por aqui — o link vale por 7
          dias.
        </p>

        <div className="flex items-stretch gap-2">
          <input
            readOnly
            value={acceptUrl}
            aria-label="Link do convite"
            onFocus={(event) => {
              event.currentTarget.select();
            }}
            className="min-w-0 flex-1 rounded-lg border border-input bg-muted/40 px-3 py-2 font-mono text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25"
          />
          <Button type="button" variant="outline" onClick={() => void copy()} className="shrink-0">
            {copied ? (
              <>
                <Check className="size-4" aria-hidden />
                Copiado
              </>
            ) : (
              <>
                <Copy className="size-4" aria-hidden />
                Copiar
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
