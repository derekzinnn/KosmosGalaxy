import { screen, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api-error';
import { classroomApi } from '@/lib/classroom-api';
import { contentApi } from '@/lib/content-api';
import type * as ContentApi from '@/lib/content-api';
import { renderWithProviders } from '@/test/render';
import { LessonPage } from './LessonPage';

vi.mock('@/lib/classroom-api', () => ({
  classroomApi: { playback: vi.fn(), progress: vi.fn(), heartbeat: vi.fn() },
}));

vi.mock('@/lib/content-api', async (importOriginal) => ({
  ...(await importOriginal<typeof ContentApi>()),
  contentApi: { myTracks: vi.fn() },
}));

const playback = vi.mocked(classroomApi.playback);
const progress = vi.mocked(classroomApi.progress);
const myTracks = vi.mocked(contentApi.myTracks);

function lesson(id: string, title: string, order: number) {
  return {
    id,
    moduleId: 'module-1',
    title,
    description: null,
    order,
    durationSeconds: 600,
    isRequired: true,
    hasVideo: true,
    resources: [],
  };
}

const track = {
  id: 'track-1',
  slug: 'onboarding',
  title: 'Onboarding Kosmos',
  description: null,
  published: true,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  progress: {
    totalLessons: 3,
    completedLessons: 1,
    percent: 33,
    completed: false,
    started: true,
    nextLessonId: 'lesson-2',
  },
  modules: [
    {
      id: 'module-1',
      trackId: 'track-1',
      title: 'Primeiros passos',
      description: null,
      order: 0,
      lessons: [
        lesson('lesson-1', 'Bem-vindo', 0),
        lesson('lesson-2', 'Como funciona', 1),
        lesson('lesson-3', 'Configuração', 2),
      ],
    },
  ],
};

function renderLesson(lessonId = 'lesson-1') {
  return renderWithProviders(
    <Routes>
      <Route path="/aulas/:lessonId" element={<LessonPage />} />
    </Routes>,
    { route: `/aulas/${lessonId}`, auth: { status: 'authenticated' } },
  );
}

beforeEach(() => {
  vi.clearAllMocks();

  myTracks.mockResolvedValue({ tracks: [track] });

  playback.mockResolvedValue({
    playback: {
      lessonId: 'lesson-1',
      url: 'https://video.invalid/signed',
      expiresAt: '2026-08-26T12:10:00.000Z',
      durationSeconds: 600,
      resumeAtSeconds: 0,
    },
  });

  // First done, second is current, third still locked.
  progress.mockResolvedValue({
    progress: {
      trackId: 'track-1',
      completed: false,
      nextLessonId: 'lesson-2',
      lessons: [
        {
          lessonId: 'lesson-1',
          locked: false,
          completed: true,
          maxPositionSeconds: 600,
          totalWatchedSeconds: 600,
        },
        {
          lessonId: 'lesson-2',
          locked: false,
          completed: false,
          maxPositionSeconds: 0,
          totalWatchedSeconds: 0,
        },
        {
          lessonId: 'lesson-3',
          locked: true,
          completed: false,
          maxPositionSeconds: 0,
          totalWatchedSeconds: 0,
        },
      ],
    },
  });
});

describe('LessonPage', () => {
  it('shows the lesson and the trilha it belongs to', async () => {
    renderLesson();

    expect(await screen.findByRole('heading', { name: 'Bem-vindo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Onboarding Kosmos/ })).toBeInTheDocument();
  });

  it('renders the outline with every lesson', async () => {
    renderLesson();

    const outline = await screen.findByRole('navigation', { name: 'Aulas da trilha' });
    expect(within(outline).getByText('Bem-vindo')).toBeInTheDocument();
    expect(within(outline).getByText('Como funciona')).toBeInTheDocument();
    expect(within(outline).getByText('Configuração')).toBeInTheDocument();
  });

  it('makes unlocked lessons navigable and locked ones not', async () => {
    renderLesson();

    const outline = await screen.findByRole('navigation', { name: 'Aulas da trilha' });

    expect(within(outline).getByRole('link', { name: /Como funciona/ })).toHaveAttribute(
      'href',
      '/aulas/lesson-2',
    );

    // The locked one must not be reachable by clicking it.
    expect(within(outline).queryByRole('link', { name: /Configuração/ })).not.toBeInTheDocument();
  });

  it('marks the lesson being watched as the current page', async () => {
    renderLesson('lesson-2');

    const outline = await screen.findByRole('navigation', { name: 'Aulas da trilha' });
    expect(within(outline).getByRole('link', { name: /Como funciona/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('plays the signed URL it was given, in the provider iframe', async () => {
    const { container } = renderLesson();

    await screen.findByRole('heading', { name: 'Bem-vindo' });

    // An iframe, not a <video>: Panda burns the watermark inside its own
    // player, so the URL is loaded in their frame rather than as a media file.
    const frame = container.querySelector('iframe');
    expect(frame).toHaveAttribute('src', 'https://video.invalid/signed');
  });

  it('explains a locked lesson instead of showing a broken player', async () => {
    progress.mockRejectedValue(new ApiError('LESSON_LOCKED', 403, 'locked'));

    renderLesson('lesson-3');

    expect(await screen.findByText('Esta aula ainda não foi liberada')).toBeInTheDocument();
    expect(screen.getByText(/Termine a aula anterior para liberar esta/)).toBeInTheDocument();
    // A locked lesson does not become unlocked by retrying, so no retry button.
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument();
  });

  it('offers a retry when the playback URL could not be minted', async () => {
    playback.mockRejectedValue(new ApiError('LESSON_HAS_NO_VIDEO', 404, 'no video'));

    renderLesson();

    expect(await screen.findByText('Não conseguimos liberar o vídeo')).toBeInTheDocument();
    expect(screen.getByText(/Esta aula ainda não tem vídeo/)).toBeInTheDocument();
  });

  it('says so when the lesson is not in any assigned trilha', async () => {
    myTracks.mockResolvedValue({ tracks: [] });

    renderLesson();

    expect(await screen.findByText('Não encontramos esta aula')).toBeInTheDocument();
  });
});
