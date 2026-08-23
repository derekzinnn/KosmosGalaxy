import { Compass } from 'lucide-react';
import { useAuth } from '@/auth/useAuth';
import { EmptyState } from '@/components/states/EmptyState';
import { Card } from '@/components/ui/card';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/**
 * Placeholder for the classroom, which arrives in Phase 3.
 *
 * It is deliberately an honest empty state rather than fake progress bars:
 * a client seeing invented data on day one learns not to trust the real data
 * later.
 */
export function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-8">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          {greeting()}, {user ? firstNameOf(user.name) : ''}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Seu onboarding com a Kosmos acontece aqui.
        </p>
      </div>

      <Card>
        <EmptyState
          icon={Compass}
          title="Sua trilha ainda está sendo preparada"
          description="Assim que a Kosmos publicar seu conteúdo de onboarding, suas aulas aparecerão aqui. Avisaremos você por e-mail quando estiver pronto."
        />
      </Card>
    </div>
  );
}
