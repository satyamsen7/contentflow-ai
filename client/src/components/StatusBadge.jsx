const CONFIG = {
  pending:    { label: 'Pending',    cls: 'badge-pending'    },
  generating: { label: 'Generating', cls: 'badge-generating' },
  posted:     { label: 'Posted',     cls: 'badge-posted'     },
  failed:     { label: 'Failed',     cls: 'badge-failed'     },
  used:       { label: 'Used',       cls: 'badge-used'       },
  excel:      { label: 'Excel',      cls: 'badge-excel'      },
  manual:     { label: 'Manual',     cls: 'badge-manual'     },
};

export default function StatusBadge({ status }) {
  const { label, cls } = CONFIG[status] || { label: status, cls: '' };
  return <span className={`badge ${cls}`}>{label}</span>;
}
