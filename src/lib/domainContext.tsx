import { createContext, useContext } from 'react';
import type { PosDomain } from '@/types/database.types';

export const ALL_DOMAINS = 'ALL';

export const DomainContext = createContext<{ domains: PosDomain[]; selected: string }>({ domains: [], selected: ALL_DOMAINS });
export const useDomains = () => useContext(DomainContext);
