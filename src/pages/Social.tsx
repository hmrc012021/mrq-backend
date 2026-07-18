import { RecordTable } from '@/components/RecordTable';
import type { MrqSocialMetric } from '@/types/database.types';

export function Social({ rows, isAuthed, onRequireAuth, onReload }: { rows: MrqSocialMetric[]; isAuthed: boolean; onRequireAuth: () => void; onReload: () => void }) {
  return (
    <RecordTable<MrqSocialMetric>
      title="Social Metrics"
      table="mrq_social_metric"
      rows={rows}
      isAuthed={isAuthed}
      onRequireAuth={onRequireAuth}
      onReload={onReload}
      columns={[
        { key: 'metric_date', label: 'Date' },
        { key: 'channel', label: 'Channel' },
        { key: 'post_name', label: 'Post' },
        { key: 'reach', label: 'Reach' },
        { key: 'impressions', label: 'Impressions' },
        { key: 'profile_visits', label: 'Profile visits' },
        { key: 'link_clicks', label: 'Link clicks' },
        { key: 'saves', label: 'Saves' },
        { key: 'shares', label: 'Shares' },
        { key: 'comments', label: 'Comments' },
        { key: 'follows', label: 'Follows' },
      ]}
      formFields={[
        { key: 'id', label: 'ID' },
        { key: 'metric_date', label: 'Date' },
        { key: 'channel', label: 'Channel' },
        { key: 'post_name', label: 'Post' },
        { key: 'reach', label: 'Reach' },
        { key: 'impressions', label: 'Impressions' },
        { key: 'profile_visits', label: 'Profile visits' },
        { key: 'link_clicks', label: 'Link clicks' },
        { key: 'saves', label: 'Saves' },
        { key: 'shares', label: 'Shares' },
        { key: 'comments', label: 'Comments' },
        { key: 'follows', label: 'Follows' },
      ]}
    />
  );
}
