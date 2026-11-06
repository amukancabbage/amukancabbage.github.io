import { WORKFLOW_LABEL } from '../../haki/constants';
import type { WorkflowStatus } from '../../haki/types';

const tone: Record<WorkflowStatus, string> = {
  DRAFT: 'neutral',
  EXTRACTING: 'info',
  EXTRACTION_FAILED: 'bad',
  NEEDS_VERIFICATION: 'warn',
  SUBMITTED: 'info',
  NEEDS_REVISION: 'warn',
  REJECTED: 'bad',
  ARCHIVED: 'ok',
  CORRECTION_REQUESTED: 'warn',
};

export default function StatusBadge({ status }: { status: WorkflowStatus }) {
  return <span className={`badge badge-${tone[status]}`}>{WORKFLOW_LABEL[status]}</span>;
}
