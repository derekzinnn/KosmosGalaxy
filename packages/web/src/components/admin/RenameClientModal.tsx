import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FormField } from '@/components/FormField';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Modal, ModalClose, ModalContent } from '@/components/ui/modal';
import { fieldErrorsFrom, messageFor } from '@/lib/api-error';
import { tenantApi } from '@/lib/content-api';

/**
 * Rename a client company.
 *
 * Only the display name changes — the slug is left alone on purpose, because a
 * shared link points at it and must not break under a rename (the API refuses
 * to touch it either). The field opens pre-filled with the current name, since
 * a rename is almost always a small edit rather than a fresh start.
 */
export function RenameClientModal({
  tenantId,
  currentName,
  children,
}: {
  tenantId: string;
  currentName: string;
  children: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const submit = useMutation({
    mutationFn: () => tenantApi.update(tenantId, { name: name.trim() }),
    onSuccess: async () => {
      setOpen(false);
      // The name shows up in several places — the roster, the funnel and the
      // drill-down header — so refresh all of them.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tenants'] }),
        queryClient.invalidateQueries({ queryKey: ['funnel'] }),
        queryClient.invalidateQueries({ queryKey: ['client-drilldown', tenantId] }),
      ]);
    },
    onError: (caught) => {
      setError(messageFor(caught));
      setFieldErrors(fieldErrorsFrom(caught));
    },
  });

  const canSubmit = name.trim().length >= 2 && name.trim() !== currentName;

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          // Start each open from the current name, discarding any earlier draft.
          setName(currentName);
          setError(null);
          setFieldErrors({});
        }
      }}
    >
      {children}

      <ModalContent title="Editar nome do cliente" description="O endereço (/slug) não muda.">
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
            error={fieldErrors.name}
            onChange={(event) => setName(event.target.value)}
          />

          <div className="flex justify-end gap-3 pt-1">
            <ModalClose asChild>
              <Button type="button" variant="ghost">
                Cancelar
              </Button>
            </ModalClose>
            <Button type="submit" loading={submit.isPending} disabled={!canSubmit}>
              Salvar
            </Button>
          </div>
        </form>
      </ModalContent>
    </Modal>
  );
}
