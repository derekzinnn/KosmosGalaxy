import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { FormField } from '@/components/FormField';
import { MagicLinkHandoff } from '@/components/admin/MagicLinkHandoff';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Modal, ModalClose, ModalContent } from '@/components/ui/modal';
import { fieldErrorsFrom, messageFor } from '@/lib/api-error';
import { invitationApi } from '@/lib/content-api';
import { isValidEmail } from '@/lib/utils';

/**
 * Invite (or re-invite) the person who owns a client's onboarding, for a
 * company that already exists. Re-inviting supersedes any earlier pending
 * link, so an owner who lost the first email just gets a fresh one.
 */
export function InviteOwnerModal({
  tenantId,
  tenantName,
  children,
}: {
  tenantId: string;
  tenantName: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [emailTouched, setEmailTouched] = useState(false);
  const [result, setResult] = useState<{ email: string; acceptUrl: string } | null>(null);

  const emailInvalid = emailTouched && email.trim() !== '' && !isValidEmail(email);

  function reset() {
    setEmail('');
    setError(null);
    setFieldErrors({});
    setEmailTouched(false);
    setResult(null);
  }

  const invite = useMutation({
    mutationFn: () => invitationApi.create({ email: email.trim(), role: 'CLIENT_OWNER', tenantId }),
    onSuccess: ({ invitation }) => {
      setError(null);
      setResult({ email: invitation.email, acceptUrl: invitation.acceptUrl });
    },
    onError: (caught) => {
      setError(messageFor(caught));
      setFieldErrors(fieldErrorsFrom(caught));
    },
  });

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setTimeout(reset, 200);
      }}
    >
      {children}

      <ModalContent
        title={result ? 'Convite pronto' : 'Convidar responsável'}
        description={result ? undefined : tenantName}
      >
        {result ? (
          <div className="space-y-6">
            <MagicLinkHandoff email={result.email} acceptUrl={result.acceptUrl} />
            <div className="flex justify-end">
              <ModalClose asChild>
                <Button>Concluir</Button>
              </ModalClose>
            </div>
          </div>
        ) : (
          <form
            className="space-y-5"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              invite.mutate();
            }}
          >
            {error ? <Alert variant="error">{error}</Alert> : null}

            <FormField
              label="E-mail do responsável"
              type="email"
              autoComplete="off"
              placeholder="responsavel@empresa.com.br"
              required
              autoFocus
              value={email}
              error={fieldErrors.email ?? (emailInvalid ? 'Informe um e-mail válido.' : undefined)}
              onChange={(event) => setEmail(event.target.value)}
              onBlur={() => setEmailTouched(true)}
            />

            <div className="flex justify-end gap-3 pt-1">
              <ModalClose asChild>
                <Button type="button" variant="ghost">
                  Cancelar
                </Button>
              </ModalClose>
              <Button type="submit" loading={invite.isPending} disabled={!isValidEmail(email)}>
                Gerar convite
              </Button>
            </div>
          </form>
        )}
      </ModalContent>
    </Modal>
  );
}
