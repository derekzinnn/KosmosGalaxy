import { Camera, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { BannerCropper } from '@/components/admin/BannerCropper';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal, ModalContent } from '@/components/ui/modal';
import { useAuth } from '@/auth/useAuth';
import { authApi } from '@/lib/api-client';
import { messageFor } from '@/lib/api-error';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
/** Matches the API's ceiling; the crop re-encodes to something far smaller. */
const MAX_BYTES = 50 * 1024 * 1024;

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/**
 * A person editing their own account: photo, display name, and light/dark.
 *
 * Opened from the avatar in the header. The photo goes through the same crop
 * step a banner does — square and round here — so a portrait is framed on
 * purpose rather than however the browser happens to cut it. Every save comes
 * back with the updated user, which is pushed straight into the auth context so
 * the header reflects it without a reload. Theme lives here too because it is
 * the other thing that is purely "how I want my own view".
 */
export function ProfileModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user, updateUser } = useAuth();
  const fileInput = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(user?.name ?? '');
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const nameChanged = name.trim().length >= 2 && name.trim() !== user.name;

  const fail = (caught: unknown) => setError(messageFor(caught));

  async function saveName() {
    setError(null);
    setSavingName(true);
    try {
      const { user: updated } = await authApi.updateProfile(name.trim());
      updateUser(updated);
    } catch (caught) {
      fail(caught);
    } finally {
      setSavingName(false);
    }
  }

  function pickFile(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      setError('A foto precisa ser JPEG, PNG ou WebP.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('A imagem passa de 50 MB.');
      return;
    }
    setPendingPhoto(file);
  }

  async function uploadCropped(cropped: File) {
    setPendingPhoto(null);
    setError(null);
    setSavingPhoto(true);
    try {
      const { user: updated } = await authApi.uploadAvatar(cropped);
      updateUser(updated);
    } catch (caught) {
      fail(caught);
    } finally {
      setSavingPhoto(false);
    }
  }

  async function removePhoto() {
    setError(null);
    setSavingPhoto(true);
    try {
      const { user: updated } = await authApi.removeAvatar();
      updateUser(updated);
    } catch (caught) {
      fail(caught);
    } finally {
      setSavingPhoto(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          // Re-seed from the live user and drop any half-done crop on close.
          setName(user.name);
          setPendingPhoto(null);
          setError(null);
        }
      }}
    >
      <ModalContent title="Meu perfil" description="Sua foto, seu nome e o tema do aplicativo.">
        <div className="space-y-6">
          {error ? <Alert variant="error">{error}</Alert> : null}

          {/* Photo */}
          {pendingPhoto ? (
            <BannerCropper
              file={pendingPhoto}
              aspect={1}
              rounded
              outputWidth={512}
              hint="Arraste para reposicionar e use o controle para aproximar. O que estiver no círculo vira sua foto."
              onCancel={() => setPendingPhoto(null)}
              onApply={(cropped) => void uploadCropped(cropped)}
            />
          ) : (
            <div className="flex items-center gap-4">
              <span className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent text-lg font-semibold text-accent-foreground">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="size-full object-cover" />
                ) : (
                  initialsOf(user.name)
                )}
              </span>

              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileInput}
                  type="file"
                  accept={ACCEPTED.join(',')}
                  className="hidden"
                  onChange={(event) => {
                    pickFile(event.target.files?.[0]);
                    event.target.value = '';
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  loading={savingPhoto}
                  onClick={() => fileInput.current?.click()}
                >
                  <Camera aria-hidden />
                  {user.avatarUrl ? 'Trocar foto' : 'Enviar foto'}
                </Button>
                {user.avatarUrl ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                    disabled={savingPhoto}
                    onClick={() => void removePhoto()}
                  >
                    <Trash2 aria-hidden />
                    Remover
                  </Button>
                ) : null}
              </div>
            </div>
          )}

          {/* Name */}
          <form
            className="space-y-1.5"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (nameChanged) void saveName();
            }}
          >
            <Label htmlFor="profile-name">Nome</Label>
            <div className="flex gap-2">
              <Input
                id="profile-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Seu nome"
              />
              <Button type="submit" loading={savingName} disabled={!nameChanged}>
                Salvar
              </Button>
            </div>
          </form>

          {/* Theme */}
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Tema</p>
              <p className="text-xs text-muted-foreground">Claro, escuro ou o do sistema.</p>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
