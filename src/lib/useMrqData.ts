import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type {
  MrqAction, MrqDeliverable, MrqMilestone, MrqDecision,
  MrqOperatingRule, MrqSocialMetric, MrqTrainingBlock, PosDomain,
  CrmContact, CrmInteraction, CrmNote, Venue, UserProfile, GuidanceOutput, SignupRequest,
} from '@/types/database.types';

export interface MrqData {
  actions: MrqAction[];
  deliverables: MrqDeliverable[];
  milestones: MrqMilestone[];
  decisions: MrqDecision[];
  rules: MrqOperatingRule[];
  domains: PosDomain[];
  contacts: CrmContact[];
  interactions: CrmInteraction[];
  notes: CrmNote[];
  venues: Venue[];
  social: MrqSocialMetric[];
  training: MrqTrainingBlock[];
  userProfiles: UserProfile[];
  guidanceOutputs: GuidanceOutput[];
  signupRequests: SignupRequest[];
}

const EMPTY: MrqData = {
  actions: [], deliverables: [], milestones: [], decisions: [],
  rules: [], domains: [], contacts: [], interactions: [], notes: [],
  venues: [], social: [], training: [], userProfiles: [], guidanceOutputs: [], signupRequests: [],
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
        actions, deliverables, milestones, decisions,
        rules, domains, contacts, interactions, notes, venues, social, training,
        userProfiles, guidanceOutputs, signupRequests,
      ] = await Promise.all([
        supabase.from('pos_action').select('*').order('priority', { ascending: true }).order('sort_order', { ascending: true }).order('id', { ascending: true }),
        supabase.from('pos_deliverable').select('*').order('id'),
        supabase.from('pos_milestone').select('*').order('id'),
        supabase.from('pos_decision').select('*').order('id'),
        supabase.from('mrq_operating_rule').select('*').order('id'),
        supabase.from('pos_domain').select('code,domain_name,sort_order').eq('active', true).order('sort_order'),
        supabase.from('crm_contact').select('*').order('last_name', { ascending: true, nullsFirst: false }),
        supabase.from('crm_interaction').select('*').order('date', { ascending: false, nullsFirst: false }),
        supabase.from('crm_note').select('*'),
        supabase.from('venue').select('venue_id,venue_name,city,country').order('venue_name'),
        supabase.from('mrq_social_metric').select('*').order('metric_date', { ascending: false }),
        supabase.from('mrq_training_block').select('*').order('block_date', { ascending: false }),
        supabase.from('user_profile').select('user_id,auth_uid,display_name,profile_type,total_encounters,total_visits,last_session_date,token_budget,budget_enforcement_enabled'),
        supabase.from('guidance_output').select('output_id,user_id,work_id,output_type,dna_angle,persona,language,created_at,tokens_used,cost_estimate').order('created_at', { ascending: false }),
        supabase.from('signup_request').select('*').order('submitted_at', { ascending: false }),
      ]);

      for (const r of [actions, deliverables, milestones, decisions, rules, domains, contacts, interactions, notes, venues, social, training, userProfiles, guidanceOutputs, signupRequests]) {
        if (r.error) throw r.error;
      }

      setData({
        actions: actions.data ?? [],
        deliverables: deliverables.data ?? [],
        milestones: milestones.data ?? [],
        decisions: decisions.data ?? [],
        rules: rules.data ?? [],
        domains: domains.data ?? [],
        contacts: contacts.data ?? [],
        interactions: interactions.data ?? [],
        notes: notes.data ?? [],
        venues: venues.data ?? [],
        social: social.data ?? [],
        training: training.data ?? [],
        userProfiles: userProfiles.data ?? [],
        guidanceOutputs: guidanceOutputs.data ?? [],
        signupRequests: signupRequests.data ?? [],
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
