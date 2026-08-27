import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ModalTrigger } from '@/components/ui/modal';
import type * as ContentApi from '@/lib/content-api';
import type * as RouterDom from 'react-router-dom';
import { renderWithProviders } from '@/test/render';
import { NewTrackModal } from './NewTrackModal';

const navigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof RouterDom>()),
  useNavigate: () => navigate,
}));

vi.mock('@/lib/content-api', async (importOriginal) => ({
  ...(await importOriginal<typeof ContentApi>()),
  contentApi: {
    listVideos: vi.fn(),
    createTrack: vi.fn(),
    createModule: vi.fn(),
    createLesson: vi.fn(),
  },
}));

const { contentApi } = await import('@/lib/content-api');
const listVideos = vi.mocked(contentApi.listVideos);
const createTrack = vi.mocked(contentApi.createTrack);
const createModule = vi.mocked(contentApi.createModule);
const createLesson = vi.mocked(contentApi.createLesson);

function open() {
  return renderWithProviders(
    <NewTrackModal>
      <ModalTrigger>Nova trilha</ModalTrigger>
    </NewTrackModal>,
    { auth: { status: 'authenticated' } },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  listVideos.mockResolvedValue({
    videos: [
      {
        id: 'vid-ready',
        title: 'Aula pronta',
        durationSeconds: 3497,
        ready: true,
        thumbnailUrl: null,
      },
      {
        id: 'vid-encoding',
        title: 'Ainda convertendo',
        durationSeconds: null,
        ready: false,
        thumbnailUrl: null,
      },
    ],
  });
  createTrack.mockResolvedValue({
    track: {
      id: 't1',
      slug: 'onboarding',
      title: 'Onboarding',
      description: null,
      published: false,
      createdAt: '',
      updatedAt: '',
    },
  });
  createModule.mockResolvedValue({
    module: {
      id: 'm1',
      trackId: 't1',
      title: 'Módulo 1',
      description: null,
      order: 0,
      lessons: [],
    },
  });
  createLesson.mockResolvedValue({
    lesson: {
      id: 'l1',
      moduleId: 'm1',
      title: 'Aula pronta',
      description: null,
      order: 0,
      durationSeconds: 3497,
      isRequired: true,
      hasVideo: true,
      resources: [],
    },
  });
});

describe('NewTrackModal', () => {
  it('creates a bare track when no video is chosen', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByText('Nova trilha'));

    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Nome da trilha'), 'Onboarding Base');
    await user.click(within(dialog).getByRole('button', { name: 'Criar trilha' }));

    expect(createTrack).toHaveBeenCalledWith({ title: 'Onboarding Base', description: null });
    // No video, so no module or lesson is invented.
    expect(createModule).not.toHaveBeenCalled();
    expect(createLesson).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/admin/tracks/t1');
  });

  it('picks a video from the Panda library and lands it as the first lesson', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByText('Nova trilha'));

    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Nome da trilha'), 'Tráfego');

    await user.click(within(dialog).getByRole('button', { name: /Escolher vídeo/ }));
    // The library loaded; choose the ready one.
    await user.click(await within(dialog).findByRole('button', { name: /Aula pronta/ }));

    // Back on the form, the chosen video shows and can be renamed.
    await user.type(within(dialog).getByLabelText('Título da aula'), 'Introdução ao Tráfego');
    await user.click(within(dialog).getByRole('button', { name: 'Criar trilha' }));

    expect(createModule).toHaveBeenCalledWith('t1', { title: 'Módulo 1' });
    // The lesson carries the video's own id and its real duration, not a typed one.
    expect(createLesson).toHaveBeenCalledWith('m1', {
      title: 'Introdução ao Tráfego',
      externalVideoId: 'vid-ready',
      durationSeconds: 3497,
    });
  });

  it('will not let a still-encoding video be chosen', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByText('Nova trilha'));

    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /Escolher vídeo/ }));

    const encoding = await within(dialog).findByRole('button', { name: /Ainda convertendo/ });
    expect(encoding).toBeDisabled();
  });

  it('falls back to the video title when the lesson title is left blank', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByText('Nova trilha'));

    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Nome da trilha'), 'Tráfego');
    await user.click(within(dialog).getByRole('button', { name: /Escolher vídeo/ }));
    await user.click(await within(dialog).findByRole('button', { name: /Aula pronta/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Criar trilha' }));

    expect(createLesson).toHaveBeenCalledWith(
      'm1',
      expect.objectContaining({ title: 'Aula pronta' }),
    );
  });
});
