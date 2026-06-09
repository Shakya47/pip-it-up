import { useState, useEffect, useRef } from 'react'
import { PipWrapper, PipTrigger, usePipContext } from '@pip-it-up/react'
import { CheckCircle2, Play, RotateCcw } from 'lucide-react'

interface BuildStep {
  name: string;
  status: 'idle' | 'running' | 'completed';
  duration?: number;
}

const INITIAL_STEPS: BuildStep[] = [
  { name: 'Installing Dependencies', status: 'idle' },
  { name: 'Checking Types', status: 'idle' },
  { name: 'Running Migrations', status: 'idle' },
  { name: 'Running Tests', status: 'idle' },
  { name: 'Building Application', status: 'idle' },
  { name: 'Deploying', status: 'idle' }
];

export default function BuildProgressDemo() {
  const [steps, setSteps] = useState<BuildStep[]>(INITIAL_STEPS);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(-1);
  const [isRunning, setIsRunning] = useState(false);
  const startTimeRef = useRef<number>(0);
  const [currentDuration, setCurrentDuration] = useState<number>(0);

  useEffect(() => {
    if (!isRunning || activeStepIndex < 0 || activeStepIndex >= steps.length) {
      return;
    }

    startTimeRef.current = Date.now();
    const interval = setInterval(() => {
      setCurrentDuration((Date.now() - startTimeRef.current) / 1000);
    }, 50);

    const stepDurations = [2.5, 1.2, 1.8, 3.0, 4.0, 1.5]; // mock durations for each step
    const targetDuration = stepDurations[activeStepIndex];

    const timeout = setTimeout(() => {
      clearInterval(interval);
      setSteps((prev) => {
        const next = [...prev];
        next[activeStepIndex] = {
          ...next[activeStepIndex],
          status: 'completed',
          duration: targetDuration,
        };
        return next;
      });

      if (activeStepIndex + 1 < steps.length) {
        setSteps((prev) => {
          const next = [...prev];
          next[activeStepIndex + 1] = {
            ...next[activeStepIndex + 1],
            status: 'running',
          };
          return next;
        });
        setActiveStepIndex(activeStepIndex + 1);
        setCurrentDuration(0);
      } else {
        setIsRunning(false);
        setActiveStepIndex(-1);
      }
    }, targetDuration * 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [isRunning, activeStepIndex, steps.length]);

  const startBuild = () => {
    setSteps([
      { ...INITIAL_STEPS[0], status: 'running' },
      ...INITIAL_STEPS.slice(1),
    ]);
    setActiveStepIndex(0);
    setIsRunning(true);
    setCurrentDuration(0);
  };

  const resetBuild = () => {
    setSteps(INITIAL_STEPS);
    setActiveStepIndex(-1);
    setIsRunning(false);
    setCurrentDuration(0);
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 p-4 rounded-xl shadow-md bg-white dark:bg-gray-800 text-center flex flex-col gap-4">
      <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-3">
        <div className="text-left">
          <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200">Build Progress</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={startBuild}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded disabled:opacity-40 transition-colors cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            Start
          </button>
          <button
            onClick={resetBuild}
            disabled={!isRunning && steps[0].status === 'idle'}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-200 hover:bg-slate-350 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded disabled:opacity-40 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
          <PipTrigger
            pipId="build-progress-pip"
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition-all duration-200 shadow-sm cursor-pointer"
          />
        </div>
      </div>

      <div className="max-w-md mx-auto w-full">
        <PipWrapper id="build-progress-pip" width={380} height={430}>
          <BuildProgressCard steps={steps} currentDuration={currentDuration} />
        </PipWrapper>
      </div>
    </div>
  );
}

interface BuildProgressCardProps {
  steps: BuildStep[];
  currentDuration: number;
}

function BuildProgressCard({ steps, currentDuration }: BuildProgressCardProps) {
  const { isInsidePip } = usePipContext();

  return (
    <div
      className={`font-sans flex flex-col gap-5 w-full h-full transition-all duration-300 ${
        isInsidePip
          ? 'bg-slate-900 text-white p-6'
          : 'border border-gray-200 dark:border-gray-700 p-6 rounded-2xl shadow-xl bg-slate-900 text-white'
      }`}
    >
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-2xl text-slate-100 tracking-tight">
          Feat: Add amazing feature
        </h3>
      </div>

      <div className="flex flex-col gap-2.5 overflow-y-auto max-h-[300px]">
        {steps.map((step) => {
          const isStepRunning = step.status === 'running';
          const isStepCompleted = step.status === 'completed';
          const isStepIdle = step.status === 'idle';

          return (
            <div
              key={step.name}
              className={`flex items-center p-3.5 rounded-xl bg-slate-800/80 text-white transition-all duration-300 ${
                isStepIdle ? 'justify-center' : 'justify-between'
              }`}
            >
              <div className="flex items-center gap-3">
                {isStepCompleted && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                )}
                {isStepRunning && (
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
                )}
                <span
                  className={`text-sm font-medium ${
                    isStepRunning
                      ? 'text-blue-400 font-semibold'
                      : isStepCompleted
                      ? 'text-slate-200'
                      : 'text-slate-400/80'
                  }`}
                >
                  {step.name}
                </span>
              </div>
              
              {!isStepIdle && (
                <div className="text-xs font-mono text-slate-400">
                  {isStepCompleted && step.duration && (
                    <span className="text-emerald-500 font-semibold">in {step.duration.toFixed(3)}s</span>
                  )}
                  {isStepRunning && (
                    <span className="text-blue-400">{currentDuration.toFixed(3)}s</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
