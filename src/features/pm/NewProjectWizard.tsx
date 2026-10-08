import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, CornerDownLeft, Sparkles, X } from 'lucide-react';
import { Button, Card, Chip, Page, celebrate, toast } from '@/components';
import {
  STANDARD_OUTBOUND_TARGETS,
  nextWorkingDay,
  peopleByRole,
  useApp,
  useCurrentUser,
  useSettings,
  useToday,
} from '@/store';
import { usePlanData } from './plan/planShared';
import { WizardSteps } from './plan/WizardSteps';
import { StepBasics } from './plan/wizard/StepBasics';
import { StepTargets } from './plan/wizard/StepTargets';
import { StepTasks } from './plan/wizard/StepTasks';
import { StepTeam } from './plan/wizard/StepTeam';
import { StepReview } from './plan/wizard/StepReview';
import { initialTaskPicks, type WizardDraft } from './plan/wizard/wizardModel';

const STEPS = ['Basics', 'Targets', 'Tasks', 'Team', 'Review & create'];

const STEP_INTRO: { title: string; text: string }[] = [
  { title: 'The basics', text: 'Only the name and client need typing. Everything else is a click.' },
  { title: 'Targets', text: 'Prefilled from a template — nudge any number with − / +.' },
  { title: 'Tasks', text: 'The sensible ones are already ticked. Set the usual quantity for a day.' },
  { title: 'Team', text: 'Tick the people who will work on it.' },
  { title: 'Review & create', text: 'One last look. You can jump back to any step.' },
];

/** Enter advances the wizard unless focus is on a control that uses Enter itself. */
function enterShouldAdvance(target: EventTarget | null, root: HTMLElement | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target !== document.body && !(root && root.contains(target))) return false;
  if (
    target.closest(
      'button, a, textarea, select, [role="radio"], [role="checkbox"], [role="menuitem"], [role="menuitemradio"], [role="dialog"]',
    )
  )
    return false;
  if (target instanceof HTMLInputElement) {
    if (target.type === 'checkbox' || target.type === 'radio') return false;
    if (target.inputMode === 'decimal') return false; // NumberStepper: Enter just commits the number
  }
  return true;
}

/** New project wizard (spec §8.2 C): five short steps, under 5 minutes. */
export default function NewProjectWizard() {
  const data = usePlanData();
  const me = useCurrentUser();
  const today = useToday();
  const settings = useSettings();
  const createProject = useApp((s) => s.createProject);
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  const taskTypes = useMemo(() => data.taskTypes.filter((t) => !t.archived), [data.taskTypes]);
  const resources = useMemo(() => peopleByRole(data.people, 'resource'), [data.people]);
  const pms = useMemo(() => peopleByRole(data.people, 'pm'), [data.people]);

  const [draft, setDraft] = useState<WizardDraft>(() => ({
    name: '',
    client: '',
    geography: 'US',
    startDate: nextWorkingDay(today),
    template: 'standard',
    targets: { ...STANDARD_OUTBOUND_TARGETS },
    tasks: initialTaskPicks(data.taskTypes),
    resourceIds: [],
    pmId: me.role === 'pm' ? me.id : (pms[0]?.id ?? me.id),
  }));
  const update = useCallback((patch: Partial<WizardDraft>) => setDraft((d) => ({ ...d, ...patch })), []);

  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [direction, setDirection] = useState(1);
  const [hintStep, setHintStep] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const clientRef = useRef<HTMLInputElement>(null);
  const firstRender = useRef(true);

  const basicsValid = !!draft.name.trim() && !!draft.client.trim() && /^\d{4}-\d{2}-\d{2}$/.test(draft.startDate);
  const tasksValid = taskTypes.some((t) => draft.tasks[t.id]?.on);
  const stepValid = useCallback((i: number) => (i === 0 ? basicsValid : i === 2 ? tasksValid : true), [basicsValid, tasksValid]);
  // The furthest step you can jump to: every step before it must be valid.
  let reachable = 0;
  while (reachable < Math.min(reached, STEPS.length - 1) && stepValid(reachable)) reachable++;

  const goTo = useCallback(
    (i: number) => {
      setDirection(i >= step ? 1 : -1);
      setStep(i);
      setReached((r) => Math.max(r, i));
      setHintStep(null);
    },
    [step],
  );

  const next = useCallback(() => {
    if (step >= STEPS.length - 1) return;
    if (!stepValid(step)) {
      setHintStep(step);
      if (step === 0) (draft.name.trim() ? clientRef : nameRef).current?.focus();
      return;
    }
    goTo(step + 1);
  }, [step, stepValid, draft.name, goTo]);

  const back = () => step > 0 && goTo(step - 1);

  // Move focus to the step heading on step changes (the name field on step 1).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = window.setTimeout(() => {
      if (step === 0) nameRef.current?.focus();
      else headingRef.current?.focus();
    }, 260);
    return () => window.clearTimeout(t);
  }, [step]);

  // Enter advances when the step is valid.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.defaultPrevented || e.isComposing || e.shiftKey || e.altKey || e.metaKey || e.ctrlKey) return;
      if (step >= STEPS.length - 1) return;
      if (!enterShouldAdvance(e.target, rootRef.current)) return;
      e.preventDefault();
      next();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [next, step]);

  const create = () => {
    if (!basicsValid) {
      goTo(0);
      setHintStep(0);
      return;
    }
    if (!tasksValid) {
      goTo(2);
      setHintStep(2);
      return;
    }
    setCreating(true);
    const name = draft.name.trim();
    createProject({
      name,
      client: draft.client.trim(),
      geography: draft.geography,
      startDate: draft.startDate,
      targets: { ...draft.targets },
      tasks: taskTypes.filter((t) => draft.tasks[t.id]?.on).map((t) => ({ taskTypeId: t.id, quantity: draft.tasks[t.id].qty })),
      resourceIds: resources.filter((p) => draft.resourceIds.includes(p.id)).map((p) => p.id),
      pmId: draft.pmId,
    });
    celebrate({ sides: true });
    toast({ title: `${name} is live`, description: 'Plan the first day whenever you are ready.', tone: 'celebrate', emoji: '🎉' });
    navigate('/projects');
  };

  const intro = STEP_INTRO[step];
  const isLast = step === STEPS.length - 1;

  return (
    <Page
      title="New project"
      subtitle="Set it up from a template — a name, a client and a few clicks."
      actions={
        <>
          <Chip tone="butter" size="md" title="About 3 minutes to set up">
            ⏱ ~3 min
          </Chip>
          <Button variant="ghost" icon={X} onClick={() => navigate('/projects')}>
            Cancel
          </Button>
        </>
      }
    >
      <div ref={rootRef} className="mx-auto max-w-5xl space-y-5">
        <Card padding="sm" className="px-3 sm:px-4">
          <WizardSteps steps={STEPS} current={step} reachable={Math.max(reachable, step)} onSelect={goTo} />
        </Card>

        <Card padding="lg" className="overflow-hidden">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.section
              key={step}
              aria-labelledby="wizard-step-title"
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: 24 * direction }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: -24 * direction }}
              transition={{ duration: reduce ? 0.01 : 0.2, ease: 'easeOut' }}
            >
              <header className="mb-6">
                <p className="text-xs font-bold uppercase tracking-wide text-accent-ink">
                  Step {step + 1} of {STEPS.length}
                </p>
                <h2 id="wizard-step-title" ref={headingRef} tabIndex={-1} className="mt-1 text-xl font-bold outline-none">
                  {intro.title}
                </h2>
                <p className="mt-1 text-sm text-muted">{intro.text}</p>
              </header>

              {step === 0 && (
                <StepBasics draft={draft} update={update} showHints={hintStep === 0} nameRef={nameRef} clientRef={clientRef} />
              )}
              {step === 1 && <StepTargets draft={draft} update={update} taskTypes={taskTypes} workdayHours={settings.workdayHours} />}
              {step === 2 && <StepTasks draft={draft} update={update} taskTypes={taskTypes} showHints={hintStep === 2} />}
              {step === 3 && (
                <StepTeam draft={draft} update={update} resources={resources} pms={pms} projects={data.projects} viewer={me} />
              )}
              {step === 4 && <StepReview draft={draft} taskTypes={taskTypes} people={data.people} onEdit={goTo} />}
            </motion.section>
          </AnimatePresence>

          <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line/70 pt-5">
            <Button variant="secondary" icon={ArrowLeft} onClick={back} disabled={step === 0}>
              Back
            </Button>
            <div className="flex flex-wrap items-center gap-3">
              {!isLast && (
                <span className="hidden items-center gap-1.5 text-xs text-muted sm:inline-flex">
                  or press
                  <kbd className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-sans text-[11px] font-semibold text-ink">
                    <CornerDownLeft className="h-3 w-3" aria-hidden />
                    Enter
                  </kbd>
                </span>
              )}
              {isLast ? (
                <Button size="lg" icon={Sparkles} onClick={create} loading={creating}>
                  Create project
                </Button>
              ) : (
                <Button iconRight={ArrowRight} onClick={next}>
                  Next: {STEPS[step + 1]}
                </Button>
              )}
            </div>
          </footer>
        </Card>
      </div>
    </Page>
  );
}
