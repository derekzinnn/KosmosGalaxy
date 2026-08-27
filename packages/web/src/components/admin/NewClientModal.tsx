import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FormField } from '@/components/FormField';
import { MagicLinkHandoff } from '@/components/admin/MagicLinkHandoff';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Modal, ModalClose, ModalContent } from '@/components/ui/modal';
import { fieldErrorsFrom, messageFor } from '@/lib/api-error';
import { invitationApi, tenantApi } from '@/lib/content-api';
import { isValidEmail, slugify } from '@/lib/utils';

/**
 * Cadastrar um cliente é, na prática, duas coisas que sempre andam juntas:
 * criar a empresa e convidar quem vai cuidar do onboarding dela. Antes eram
 * dois passos em telas diferentes; aqui é um só, e termina entregando o link
 * de convite pronto para enviar.
 *
 * Se a empresa é criada mas o convite falha, a empresa fica — e o modal mostra
 * o erro do convite com a empresa já listada atrás, de onde dá para tentar
 * convidar de novo. Desfazer a criação seria pior: apagaria uma empresa que
 * pode já ter sido usada em outra aba.
 */
export function NewClientModal({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [emailTouched, setEmailTouched] = useState(false);
  const [result, setResult] = useState<{ email: string; acceptUrl: string } | null>(null);

  // Shown only once the field has been left, so the message does not nag while
  // an address is still being typed.
  const emailInvalid = emailTouched && email.trim() !== '' && !isValidEmail(email);

  function reset() {
    setName('');
    setEmail('');
    setError(null);
    setFieldErrors({});
    setEmailTouched(false);
    setResult(null);
  }

  const submit = useMutation({
    mutationFn: async () => {
      const { tenant } = await tenantApi.create({ name: name.trim(), slug: slugify(name) });
      await queryClient.invalidateQueries({ queryKey: ['tenants'] });
      const { invitation } = await invitationApi.create({
        email: email.trim(),
        role: 'CLIENT_OWNER',
        tenantId: tenant.id,
      });
      return invitation;
    },
    onSuccess: (invitation) => {
      setError(null);
      setFieldErrors({});
      setResult({ email: invitation.email, acceptUrl: invitation.acceptUrl });
    },
    onError: (caught) => {
      setError(messageFor(caught));
      setFieldErrors(fieldErrorsFrom(caught));
    },
  });

  const canSubmit = name.trim().length >= 2 && isValidEmail(email);

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          // Reset after the close animation so the form does not visibly
          // empty out while the panel is still fading.
          setTimeout(reset, 200);
        }
      }}
    >
      {children}

      <ModalContent
        title={result ? 'Cliente cadastrado' : 'Novo cliente'}
        description={
          result
            ? undefined
            : 'Cadastre a empresa e convide o responsável. Ele recebe um link para definir a senha e começar.'
        }
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
              submit.mutate();
            }}
          >
            {error ? <Alert variant="error">{error}</Alert> : null}

            <FormField
              label="Nome da empresa"
              placeholder="Padaria do Zé"
              required
              autoFocus
              value={name}
              error={fieldErrors.name ?? fieldErrors.slug}
              hint={name.trim() ? `Endereço: /${slugify(name)}` : undefined}
              onChange={(event) => setName(event.target.value)}
            />

            <FormField
              label="E-mail do responsável"
              type="email"
              autoComplete="off"
              placeholder="responsavel@empresa.com.br"
              required
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
              <Button type="submit" loading={submit.isPending} disabled={!canSubmit}>
                Cadastrar e convidar
              </Button>
            </div>
          </form>
        )}
      </ModalContent>
    </Modal>
  );
}
