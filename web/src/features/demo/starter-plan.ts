import type { PlanCapabilities } from '../../store/capabilities';

/** Snapshot de presentación solicitado. Solo /demo; no sustituye al catálogo real del servidor. */
export const DEMO_STARTER = {
  code: 'STARTER', name: 'Starter', maxWorkers: 5, maxMonthlyAppointments: 300, maxStorageMb: 500, maxBranches: 1,
  website: true, loyalty: true, aiCopilot: true, whatsapp: true, multiBranch: false,
} as const satisfies Pick<PlanCapabilities, 'code' | 'name' | 'maxWorkers' | 'maxMonthlyAppointments' | 'maxStorageMb' | 'maxBranches' | 'website' | 'loyalty' | 'aiCopilot' | 'whatsapp' | 'multiBranch'>;
export const DEMO_STORAGE_LIMIT = DEMO_STARTER.maxStorageMb * 1024 ** 2;
export const DEMO_REWARD_COST = 25;
export type DemoView = 'overview' | 'agenda' | 'clients' | 'services' | 'sales' | 'website' | 'loyalty' | 'ai' | 'whatsapp' | 'plan';
export const storageMB = (bytes: number) => `${(bytes / 1024 ** 2).toLocaleString('es-PE', { maximumFractionDigits: 2 })} MB`;
