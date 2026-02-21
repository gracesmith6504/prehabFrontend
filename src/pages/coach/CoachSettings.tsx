import { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { Settings, Database, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function CoachSettings() {
  const [seeding, setSeeding] = useState(false);
  const [seeded, setSeeded] = useState(false);

  const handleSeedDemo = async () => {
    setSeeding(true);
    try {
      const { data, error } = await supabase.functions.invoke('seed-demo-data');

      if (error) throw error;

      if (data?.error) {
        if (data.error.includes('already seeded')) {
          toast.info('Demo data already loaded for this coach.');
          setSeeded(true);
        } else {
          toast.error(data.error);
        }
        return;
      }

      toast.success(`Demo data loaded! ${data.athletes_created} athletes created.`);
      setSeeded(true);
    } catch (err: any) {
      console.error('Seed error:', err);
      toast.error(err.message || 'Failed to seed demo data');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex items-center gap-3">
          <Settings className="h-6 w-6 text-primary" />
          <h1 className="font-heading text-2xl font-bold uppercase tracking-wider">Settings</h1>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 space-y-4 max-w-lg">
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5 text-primary" />
            <h2 className="font-heading text-lg font-semibold uppercase tracking-wide">Demo Data</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Load a demo squad of 5 athletes with realistic training, soreness, risk, and escalation data.
            This is for hackathon / demo purposes only.
          </p>
          <Button
            onClick={handleSeedDemo}
            disabled={seeding || seeded}
            className="gap-2 font-semibold"
          >
            {seeding ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Seeding…
              </>
            ) : seeded ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Demo Data Loaded
              </>
            ) : (
              <>
                <Database className="h-4 w-4" />
                Load Demo Data
              </>
            )}
          </Button>
          {seeded && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" />
              Refresh the page to see demo data across all pages.
            </p>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
