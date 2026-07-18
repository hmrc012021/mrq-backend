import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type {
  MrqAction, MrqDeliverable, MrqMilestone, MrqDecision, MrqReconciliationItem,
  MrqRawExtract, MrqSourceMap, MrqOperatingRule, MrqSocialMetric, MrqTrainingBlock,
  CrmContact, CrmInteraction, CrmNote, Venue,
} from '@/types/database.types';

export interface MrqData {
  actions: MrqAction[];
  deliverables: MrqDeliverable[];
  milestones: MrqMilestone[];
  decisions: MrqDecision[];
  reconciliation: MrqReconciliationItem[];
  raw: MrqRawExtract[];
  sources: MrqSourceMap[];
  rules: MrqOperatingRule[];
  contacts: CrmContact[];
  interactions: CrmInteraction[];
  notes: CrmNote[];
  venues: Venue[];
  social: MrqSocialMetric[];
  training: MrqTrainingBlock[];
}

const EMPTY: MrqData = {
  actions: [], deliverables: [], milestones: [], decisions: [], reconciliation: [],
  raw: [], sources: [], rules: [], contacts: [], interactions: [], notes: [],
  venues: [], social: [], training: [],
};

export function useMrqData() {
  const [data, setData] = useState<MrqData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        actions, deliverables, milestones, decisions, reconciliation,
        raw, sources, rules, contacts, interactions, notes, venues, social, training,
      ] = await Promise.all([
        supabase.from('mrq_action').select('*').order('priority', { ascending: true }).order('sort_order', { ascending: true }).order('id', { ascending: true }),
        supabase.from('mrq_deliverable').select('*').order('id'),
        supabase.from('mrq_milestone').select('*').order('id'),
        supabase.from('mrq_decision').select('*').order('id'),
        supabase.from('mrq_reconciliation_item').select('*').order('id'),
        supabase.from('mrq_raw_extract').select('*').order('id'),
        supabase.from('mrq_source_map').select('*').order('id'),
        supabase.from('mrq_operating_rule').select('*').order('id'),
        supabase.from('crm_contact').select('*').order('last_name', { ascending: true, nullsFirst: false }),
        supabase.from('crm_interaction').select('*').order('date', { ascending: false, nullsFirst: false }),
        supabase.from('crm_note').select('*'),
        supabase.from('venue').select('venue_id,venue_name,city,country').order('venue_name'),
        supabase.from('mrq_social_metric').select('*').order('metric_date', { ascending: false }),
        supabase.from('mrq_training_block').select('*').order('block_date', { ascending: false }),
      ]);

      for (const r of [actions, deliverables, milestones, decisions, reconciliation, raw, sources, rules, contacts, interactions, notes, venues, social, training]) {
        if (r.error) throw r.error;
      }

      setData({
        actions: actions.data ?? [],
        deliverables: deliverables.data ?? [],
        milestones: milestones.data ?? [],
        decisions: decisions.data ?? [],
        reconciliation: reconciliation.data ?? [],
        raw: raw.data ?? [],
        sources: sources.data ?? [],
        rules: rules.data ?? [],
        contacts: contacts.data ?? [],
        interactions: interactions.data ?? [],
        notes: notes.data ?? [],
        venues: venues.data ?? [],
        social: social.data ?? [],
        training: training.data ?? [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}
