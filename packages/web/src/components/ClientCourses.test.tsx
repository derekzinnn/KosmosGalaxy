import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { MyTrack } from '@/lib/content-api';
import { renderWithProviders } from '@/test/render';
import { ClientCourses } from './ClientCourses';

function track(over: Partial<MyTrack> & { id: string; title: string }): MyTrack {
  return {
    slug: over.id,
    description: null,
    published: true,
    createdAt: '',
    updatedAt: '',
    modules: [
      {
        id: `${over.id}-m1`,
        trackId: over.id,
        title: 'Módulo 1',
        description: null,
        order: 0,
        lessons: [
          {
            id: `${over.id}-l1`,
            moduleId: `${over.id}-m1`,
            title: 'Aula 1',
            description: null,
            order: 0,
            durationSeconds: 600,
            isRequired: true,
            hasVideo: true,
            resources: [],
          },
        ],
      },
    ],
    progress: {
      totalLessons: 1,
      completedLessons: 0,
      percent: 0,
      completed: false,
      started: false,
      nextLessonId: `${over.id}-l1`,
      ...over.progress,
    },
    ...over,
  };
}

const fresh = track({ id: 'fresh', title: 'Trilha Nova' });
const midway = track({
  id: 'midway',
  title: 'Trilha em Andamento',
  progress: {
    totalLessons: 4,
    completedLessons: 2,
    percent: 50,
    completed: false,
    started: true,
    nextLessonId: 'midway-l3',
  },
});
const finished = track({
  id: 'finished',
  title: 'Trilha Concluída',
  progress: {
    totalLessons: 3,
    completedLessons: 3,
    percent: 100,
    completed: true,
    started: true,
    nextLessonId: null,
  },
});

describe('ClientCourses', () => {
  it('shows each trilha as a card that links to where to continue', () => {
    renderWithProviders(<ClientCourses tracks={[midway]} />);

    const link = screen.getByRole('link', { name: /Trilha em Andamento/ });
    // Continue goes to the next unfinished lesson, not the first.
    expect(link).toHaveAttribute('href', '/aulas/midway-l3');
  });

  it('labels the action by where the person stands', () => {
    renderWithProviders(<ClientCourses tracks={[fresh, midway, finished]} />);
    expect(screen.getByText('Começar')).toBeInTheDocument();
    expect(screen.getByText('Continuar')).toBeInTheDocument();
    expect(screen.getByText('Revisar')).toBeInTheDocument();
  });

  it('counts each filter', () => {
    renderWithProviders(<ClientCourses tracks={[fresh, midway, finished]} />);
    expect(screen.getByRole('tab', { name: /Todas · 3/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Em andamento · 1/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Concluídas · 1/ })).toBeInTheDocument();
  });

  it('narrows the wall to what is still open', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ClientCourses tracks={[fresh, midway, finished]} />);

    await user.click(screen.getByRole('tab', { name: /Em andamento/ }));

    expect(screen.getByText('Trilha em Andamento')).toBeInTheDocument();
    expect(screen.queryByText('Trilha Nova')).not.toBeInTheDocument();
    expect(screen.queryByText('Trilha Concluída')).not.toBeInTheDocument();
  });

  it('reports progress to a screen reader, not only in colour', () => {
    renderWithProviders(<ClientCourses tracks={[midway]} />);
    const bar = screen.getByRole('progressbar', { name: /Trilha em Andamento/ });
    expect(bar).toHaveAttribute('aria-valuenow', '50');
  });

  it('invites action when a filter is empty', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ClientCourses tracks={[fresh]} />);

    await user.click(screen.getByRole('tab', { name: /Concluídas/ }));
    expect(screen.getByText('Nada concluído ainda')).toBeInTheDocument();
  });
});
