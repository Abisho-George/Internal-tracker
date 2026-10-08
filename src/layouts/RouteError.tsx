import { useEffect } from 'react';
import { useNavigate, useRouteError } from 'react-router-dom';
import { House, RotateCcw } from 'lucide-react';
import { Button, Card, EmptyState } from '@/components';

/**
 * Friendly route error boundary. Shown in place of a page that threw while
 * rendering, so the shell (and the rest of the demo) keeps working.
 */
export function RouteError() {
  const error = useRouteError();
  const navigate = useNavigate();

  useEffect(() => {
    // Keep the details in the console for whoever is building the prototype.
    console.error(error);
  }, [error]);

  return (
    <Card className="mx-auto mt-6 max-w-xl">
      <EmptyState
        emoji="🧭"
        title="This page took a little detour"
        description="Something on this screen needs another look. Head home or reload to keep the demo going."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button icon={House} onClick={() => navigate('/', { replace: true })}>
              Take me home
            </Button>
            <Button variant="secondary" icon={RotateCcw} onClick={() => window.location.reload()}>
              Reload
            </Button>
          </div>
        }
      />
    </Card>
  );
}

export default RouteError;
