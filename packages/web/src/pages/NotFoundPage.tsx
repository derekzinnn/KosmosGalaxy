import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/AuthLayout';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <AuthLayout
      title="Página não encontrada"
      description="O endereço que você acessou não existe ou foi movido."
    >
      <Button className="w-full" size="lg" onClick={() => void navigate('/')}>
        Voltar ao início
      </Button>
    </AuthLayout>
  );
}
