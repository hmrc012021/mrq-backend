// Hand-authored to match the fields actually read/written by the original
// static-HTML CEO Dashboard and CRM apps. Not generated from `supabase gen
// types` since this connector doesn't have access to this project.

export interface MrqAction {
  id: string;
  domain?: string;
  deliverable_id: string | null;
  bucket: string | null;
  workstream: string | null;
  action: string | null;
  owner: string | null;
  status: string | null;
  priority: string | null;
  due_timing: string | null;
  next_step: string | null;
  dependency: string | null;
  notes: string | null;
  selected_for_week: boolean | null;
  sort_order: number | null;
}

export interface MrqDeliverable {
  id: string;
  domain?: string;
  bucket: string | null;
  workstream: string | null;
  deliverable: string | null;
  deliverable_type: string | null;
  target_period: string | null;
  owner: string | null;
  status: string | null;
  success_measure: string | null;
}

export interface MrqMilestone {
  id: string;
  domain?: string;
  bucket: string | null;
  workstream: string | null;
  milestone: string | null;
  target_period: string | null;
  owner: string | null;
  status: string | null;
}

export interface MrqDecision {
  id: string;
  domain?: string;
  bucket: string | null;
  workstream: string | null;
  decision: string | null;
  decision_date_approx: string | null;
  still_valid: string | null;
  consequence: string | null;
}

export interface MrqOperatingRule {
  id: string;
  topic: string | null;
  instruction: string | null;
}

export interface MrqSocialMetric {
  id: string;
  metric_date: string | null;
  channel: string | null;
  post_name: string | null;
  reach: number | null;
  impressions: number | null;
  profile_visits: number | null;
  link_clicks: number | null;
  saves: number | null;
  shares: number | null;
  comments: number | null;
  follows: number | null;
}

export interface MrqTrainingBlock {
  id: string;
  block_date: string | null;
  planned_start: string | null;
  planned_minutes: number | null;
  status: string | null;
  notes: string | null;
}

export interface CrmContact {
  contact_id: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  institution_role: string[] | null;
  venue_id: string | null;
  organization_name: string | null;
  organization_type: string | null;
  department_or_unit: string | null;
  stakeholder_group: string | null;
  source: string | null;
  city: string | null;
  country: string | null;
  date_added: string | null;
  stakeholder_role_primary: string | null;
  stakeholder_role_secondary: string | null;
  product_tier_relevance: string | null;
  priority_level: string | null;
  campaigns: string[] | null;
  why_this_matters: string | null;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  instagram: string | null;
  assistant_or_general_contact: string | null;
  outreach_status: string | null;
  relationship_status: string | null;
  contact_confidence: string | null;
  next_followup_date: string | null;
  completion_status: string | null;
}

export interface CrmInteraction {
  interaction_id: string;
  contact_id: string;
  date: string | null;
  channel: string | null;
  meeting_goal: string | null;
  next_action: string | null;
  owner: string | null;
}

export interface CrmNote {
  note_id: string;
  interaction_id: string;
  source_url: string | null;
  what_you_asked_or_said: string | null;
  what_they_said_or_did: string | null;
  what_still_needs_confirming: string | null;
  what_to_do_about_it: string | null;
}

export interface Venue {
  venue_id: string;
  venue_name: string;
  city: string | null;
  country: string | null;
}

export interface UserProfile {
  user_id: string;
  auth_uid: string | null;
  display_name: string | null;
  profile_type: string | null;
  total_encounters: number | null;
  total_visits: number | null;
  last_session_date: string | null;
  token_budget: number | null;
  budget_enforcement_enabled: boolean | null;
}

export interface GuidanceOutput {
  output_id: string;
  user_id: string | null;
  work_id: string | null;
  output_type: string | null;
  dna_angle: string | null;
  persona: string | null;
  language: string | null;
  created_at: string | null;
  tokens_used: number | null;
  cost_estimate: number | null;
}

export interface SignupRequest {
  id: number;
  name: string | null;
  email: string | null;
  institution: string | null;
  motivation: string | null;
  status: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  assigned_user_id: string | null;
  notes: string | null;
}

export interface Database {
  public: {
    Tables: {
      pos_action: { Row: MrqAction; Insert: Partial<MrqAction>; Update: Partial<MrqAction> };
      pos_deliverable: { Row: MrqDeliverable; Insert: Partial<MrqDeliverable>; Update: Partial<MrqDeliverable> };
      pos_milestone: { Row: MrqMilestone; Insert: Partial<MrqMilestone>; Update: Partial<MrqMilestone> };
      pos_decision: { Row: MrqDecision; Insert: Partial<MrqDecision>; Update: Partial<MrqDecision> };
      mrq_operating_rule: { Row: MrqOperatingRule; Insert: Partial<MrqOperatingRule>; Update: Partial<MrqOperatingRule> };
      mrq_social_metric: { Row: MrqSocialMetric; Insert: Partial<MrqSocialMetric>; Update: Partial<MrqSocialMetric> };
      mrq_training_block: { Row: MrqTrainingBlock; Insert: Partial<MrqTrainingBlock>; Update: Partial<MrqTrainingBlock> };
      crm_contact: { Row: CrmContact; Insert: Partial<CrmContact>; Update: Partial<CrmContact> };
      crm_interaction: { Row: CrmInteraction; Insert: Partial<CrmInteraction>; Update: Partial<CrmInteraction> };
      crm_note: { Row: CrmNote; Insert: Partial<CrmNote>; Update: Partial<CrmNote> };
      venue: { Row: Venue; Insert: Partial<Venue>; Update: Partial<Venue> };
      user_profile: { Row: UserProfile; Insert: Partial<UserProfile>; Update: Partial<UserProfile> };
      guidance_output: { Row: GuidanceOutput; Insert: Partial<GuidanceOutput>; Update: Partial<GuidanceOutput> };
      signup_request: { Row: SignupRequest; Insert: Partial<SignupRequest>; Update: Partial<SignupRequest> };
    };
  };
}
