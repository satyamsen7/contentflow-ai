export default function StatCard({ title, value, icon: Icon, color = 'var(--primary-lt)', subtitle }) {
  return (
    <div className="stat-card" style={{ '--card-color': color }}>
      <div className="stat-icon">
        {Icon && <Icon size={22} />}
      </div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-title">{title}</div>
        {subtitle && <div className="stat-subtitle">{subtitle}</div>}
      </div>
    </div>
  );
}
